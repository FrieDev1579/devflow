import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commands = [
  { label: 'backend', file: resolve(root, 'server', 'index.mjs') },
  { label: 'frontend', file: resolve(root, 'node_modules', 'vite', 'bin', 'vite.js') }
];

const children = [];
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 300).unref();
}

for (const command of commands) {
  const child = spawn(process.execPath, [command.file], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
  children.push(child);
  child.on('error', (error) => {
    console.error('Could not start ' + command.label + ':', error.message);
    stopAll(1);
  });
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(command.label + ' stopped unexpectedly.');
      stopAll(code || 1);
    }
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
