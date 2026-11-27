import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'data');
const DATA_FILE = resolve(DATA_DIR, 'devflow.json');
const HOST = '127.0.0.1';
const PORT = 3001;
const MAX_BODY = 1024 * 1024;

let state = { workflows: [], activity: [] };
let persistQueue = Promise.resolve();
let schedulerBusy = false;

function id() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function addActivity(type, workflowName, details) {
  state.activity.unshift({
    id: id(),
    type,
    workflowName,
    details,
    createdAt: new Date().toISOString()
  });
  state.activity = state.activity.slice(0, 100);
}

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

function persist() {
  const contents = JSON.stringify(state, null, 2);
  persistQueue = persistQueue.then(async () => {
    const temporaryFile = DATA_FILE + '.tmp';
    await writeFile(temporaryFile, contents, 'utf8');
    await rename(temporaryFile, DATA_FILE);
  });
  return persistQueue;
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk.toString();
    if (raw.length > MAX_BODY) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function cleanWorkflow(input) {
  const interval = Number(input.intervalMinutes);
  const intervalMinutes = interval === 1 || interval === 5 ? interval : undefined;
  const name = String(input.name || '').trim().slice(0, 60);
  if (!name) return null;
  const active = Boolean(input.active);
  const nextRun = Number(input.nextRunAt);
  return {
    id: String(input.id || id()),
    name,
    description: String(input.description || '').trim().slice(0, 180) || 'A workflow created in DevFlow.',
    trigger: intervalMinutes ? 'Every ' + intervalMinutes + ' minute' + (intervalMinutes === 1 ? '' : 's') : 'Manual only',
    action: 'Record a reminder',
    active,
    runs: Math.max(0, Number.parseInt(input.runs, 10) || 0),
    updatedAt: String(input.updatedAt || 'Just now'),
    intervalMinutes,
    nextRunAt: intervalMinutes
      ? (Number.isFinite(nextRun) && nextRun > 0 ? nextRun : (active ? Date.now() + intervalMinutes * 60_000 : undefined))
      : undefined
  };
}

async function handle(request, response) {
  const url = new URL(request.url || '/', 'http://' + HOST + ':' + PORT);
  const pathname = url.pathname;

  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, service: 'devflow-backend', scheduler: 'running' });
  }

  if (request.method === 'GET' && pathname === '/api/state') {
    return sendJson(response, 200, snapshot());
  }

  if (request.method === 'POST' && pathname === '/api/state/import') {
    const body = await readBody(request);
    if (state.workflows.length === 0 && state.activity.length === 0) {
      const importedWorkflows = Array.isArray(body.workflows) ? body.workflows.slice(0, 200) : [];
      const importedActivity = Array.isArray(body.activity) ? body.activity.slice(0, 100) : [];
      state.workflows = importedWorkflows.map(cleanWorkflow).filter(Boolean);
      state.activity = importedActivity.map((event) => ({
        id: String(event.id || id()),
        type: String(event.type || 'Imported'),
        workflowName: String(event.workflowName || 'Workflow'),
        details: String(event.details || 'Imported from this browser.'),
        createdAt: String(event.createdAt || new Date().toISOString())
      }));
      await persist();
    }
    return sendJson(response, 200, snapshot());
  }

  if (request.method === 'POST' && pathname === '/api/workflows') {
    const body = await readBody(request);
    const workflow = cleanWorkflow({
      ...body,
      active: true,
      runs: 0,
      updatedAt: 'Just now',
      nextRunAt: body.intervalMinutes ? Date.now() + Number(body.intervalMinutes) * 60_000 : undefined
    });
    if (!workflow) return sendJson(response, 400, { error: 'Please provide a workflow name.' });
    state.workflows.unshift(workflow);
    addActivity('Created', workflow.name, workflow.intervalMinutes
      ? 'Workflow saved on the DevFlow backend. It will be scheduled while the backend is running.'
      : 'Manual workflow created and saved on the DevFlow backend.');
    await persist();
    return sendJson(response, 201, snapshot());
  }

  const workflowRoute = pathname.match(/^\/api\/workflows\/([^/]+)(?:\/(run))?$/);
  if (workflowRoute) {
    const workflowId = decodeURIComponent(workflowRoute[1]);
    const workflow = state.workflows.find((item) => item.id === workflowId);
    if (!workflow) return sendJson(response, 404, { error: 'Workflow not found.' });

    if (request.method === 'PATCH' && !workflowRoute[2]) {
      const body = await readBody(request);
      if (typeof body.active !== 'boolean') {
        return sendJson(response, 400, { error: 'The active field must be true or false.' });
      }
      workflow.active = body.active;
      workflow.updatedAt = 'Just now';
      if (workflow.active && workflow.intervalMinutes) {
        workflow.nextRunAt = Date.now() + workflow.intervalMinutes * 60_000;
      }
      addActivity(workflow.active ? 'Resumed' : 'Paused', workflow.name,
        workflow.active ? 'Workflow reactivated on the backend.' : 'Workflow paused. Scheduled runs are stopped.');
      await persist();
      return sendJson(response, 200, snapshot());
    }

    if (request.method === 'POST' && workflowRoute[2] === 'run') {
      workflow.runs += 1;
      workflow.updatedAt = 'Just now';
      addActivity('Run', workflow.name, 'Manual run recorded by the DevFlow backend. External integrations are not connected yet.');
      await persist();
      return sendJson(response, 200, snapshot());
    }

    if (request.method === 'DELETE' && !workflowRoute[2]) {
      state.workflows = state.workflows.filter((item) => item.id !== workflowId);
      addActivity('Deleted', workflow.name, 'Workflow removed from the DevFlow backend.');
      await persist();
      return sendJson(response, 200, snapshot());
    }
  }

  return sendJson(response, 404, { error: 'API route not found.' });
}

async function runDueWorkflows() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const now = Date.now();
    const due = state.workflows.filter((workflow) =>
      workflow.active &&
      workflow.intervalMinutes &&
      workflow.nextRunAt &&
      workflow.nextRunAt <= now
    );
    if (due.length === 0) return;

    for (const workflow of due) {
      workflow.runs += 1;
      workflow.updatedAt = 'Just now';
      workflow.nextRunAt = now + workflow.intervalMinutes * 60_000;
      addActivity(
        'Scheduled run',
        workflow.name,
        'Scheduled reminder completed by the DevFlow backend. This run was recorded even if the browser was closed.'
      );
      console.log('[scheduler] Completed scheduled run: ' + workflow.name);
    }
    await persist();
  } catch (error) {
    console.error('[scheduler] Could not save scheduled run:', error);
  } finally {
    schedulerBusy = false;
  }
}

await mkdir(DATA_DIR, { recursive: true });
try {
  const saved = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  state.workflows = Array.isArray(saved.workflows) ? saved.workflows : [];
  state.activity = Array.isArray(saved.activity) ? saved.activity : [];
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Could not read saved DevFlow data:', error);
    process.exit(1);
  }
  await persist();
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error('[api] Request failed:', error);
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, { error: error.message || 'Unexpected server error.' });
    } else {
      response.end();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log('DevFlow backend ready at http://' + HOST + ':' + PORT);
  console.log('Saved workflows: ' + state.workflows.length);
  console.log('Scheduled runs continue while this backend process is running.');
});
const schedulerTimer = setInterval(runDueWorkflows, 1000);

function shutdown() {
  clearInterval(schedulerTimer);
  server.close(() => {
    console.log('DevFlow backend stopped.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
