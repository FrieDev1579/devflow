# DevFlow

A lightweight workflow workspace with a local Node.js scheduler and HTTPS webhook actions.

> **Project status:** Early MVP. Scheduled jobs run while the local Node.js backend is running. Webhook actions send JSON HTTP POST requests to configured public HTTPS endpoints.

## Features

- Create, search, pause, resume, and delete workflows
- Schedule workflows every 1 or 5 minutes
- Persistent Node.js backend scheduler
- Local JSON storage at `data/devflow.json`
- Activity history for manual and scheduled workflow runs
- Optional desktop notifications while the app page is open
- HTTP POST webhook actions with delivery success/failure records

## Tech stack

- React 18 and TypeScript
- Vite
- Node.js built-in HTTP server and fetch (no backend framework required)

## Requirements

- Node.js 18 or newer
- npm

## Run locally

Open the project root folder (the one containing `package.json`) in VS Code, then run:

```bash
npm install
npm run dev
```

The `dev` command starts both services:

- Frontend: the local Vite URL printed in the terminal (usually http://localhost:5173)
- Backend API: http://127.0.0.1:3001

Use **Ctrl+C** in the terminal to stop both processes.

## Create a webhook workflow

1. Open DevFlow and choose **New workflow**.
2. Select a manual or scheduled trigger.
3. Under **What should it do?**, choose **Send a webhook (HTTP POST)**.
4. Paste a public HTTPS webhook endpoint you control.
5. Save the workflow and click **Run** to test it.

DevFlow posts a JSON body shaped like this:

```json
{
  "event": "devflow.workflow.run",
  "workflow": {
    "id": "workflow-id",
    "name": "Example workflow",
    "description": "Example description",
    "trigger": "Manual only"
  },
  "source": "manual",
  "executedAt": "2026-01-01T12:00:00.000Z"
}
```

For scheduled executions, `source` is `scheduled`. The Activity page shows whether the webhook was delivered or failed, along with the HTTP status or a short error.

### Webhook safety

- Only public HTTPS hostnames on the standard HTTPS port are accepted.
- Local/private IP addresses, localhost-style hostnames, and IP-literal URLs are rejected.
- HTTP redirects are not followed.
- Requests time out after 8 seconds.
- Use only webhook URLs you control or trust. Treat the endpoint URL as sensitive if it contains a token.

## Data storage

The backend creates `data/devflow.json` automatically. This file is ignored by Git so local workflow data is not published. Existing browser-local workflows are imported if the backend has no saved data yet.

Back up `data/devflow.json` before moving the project or switching computers.

## Scheduling behaviour and limitations

Scheduled jobs run in the Node.js backend, not the browser. They continue while Chrome is closed, provided the computer stays powered on and the DevFlow backend process remains running. If the computer or backend is stopped, scheduling pauses. On restart, an overdue schedule is run once and its next run is scheduled from the restart time.

Webhook actions send actual HTTP POST requests. Reminder actions only add activity entries. Desktop pop-up notifications require the app page to be open and connected; actions that run while the page is closed appear in Activity when you return.

This is a local development setup, not a public always-on cloud service. To run schedules 24/7, deploy the backend to an always-on server.

## Build the frontend

```bash
npm run build
npm run preview
```

## Roadmap

- [ ] Add more integration types and configurable payload templates
- [ ] Add workflow editor and more trigger types
- [ ] Add authentication and secure workspaces
- [ ] Add a hosted backend for always-on scheduling
- [ ] Add retries, secrets management, tests, and monitoring

## Contributing

Issues and pull requests are welcome. For significant changes, open an issue first to discuss the approach.

## License

No license has been selected yet. Until a license is added, standard copyright applies and reuse is not automatically permitted.
