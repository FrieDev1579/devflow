# DevFlow

A lightweight workflow workspace with a local Node.js scheduler.

> **Project status:** Early MVP. The backend can keep scheduled reminder records running while the browser is closed, as long as the computer and backend process remain on. The current action records a reminder; it does not send email or contact external services.

## Features

- Create, search, pause, resume, and delete workflows
- Schedule workflows every 1 or 5 minutes
- Node.js backend runs scheduled jobs independently of the browser tab
- Workflow and activity data saved to `data/devflow.json`
- Activity history for manual and scheduled runs
- Optional desktop notifications while the page is open and connected

## Tech stack

- React 18 and TypeScript
- Vite
- Node.js built-in HTTP server (no backend framework required)

## Requirements

- Node.js 18 or newer
- npm

## Run locally

Download/clone the repository, open its root folder (the one containing `package.json`) in VS Code, then run:

```bash
npm install
npm run dev
```

The `dev` command starts both services:

- Frontend: the local Vite URL printed in the terminal (usually http://localhost:5173)
- Backend API: http://127.0.0.1:3001

Use **Ctrl+C** in the terminal to stop both processes.

## Data storage

The backend creates `data/devflow.json` automatically the first time it runs. This file is ignored by Git so your local workflow data is not published to the public repository. On first connection, DevFlow attempts to import existing workflows and activity from this browser's local storage if the backend has no saved data.

Back up `data/devflow.json` if you want to keep your local workflow data when moving to another computer.

## Scheduling behaviour and limitations

The scheduler runs in the Node.js backend process, not in the browser. Scheduled jobs continue while Chrome is closed, provided the computer stays powered on and the DevFlow backend process is running. If the computer is shut down or the backend process is stopped, jobs pause; on restart, an overdue schedule is run once and its next run is scheduled from the restart time.

The current scheduled action records a reminder in the server-side activity log. It does not yet send emails, call external APIs, or run arbitrary user-defined actions. Desktop notifications are delivered only while the app page is open and connected; runs recorded while the page is closed appear in Activity when you return.

This is a local development setup, not a public always-on cloud service. To run schedules 24/7, the backend would later need deployment to an always-on server.

## Build the frontend

```bash
npm run build
npm run preview
```

## Roadmap

- [ ] Add real action integrations (email, webhook, task creation)
- [ ] Add workflow editor and more trigger types
- [ ] Add user accounts and secure workspaces
- [ ] Add a hosted backend for always-on scheduling
- [ ] Add automated tests, execution retries, and monitoring

## Contributing

Issues and pull requests are welcome. For significant changes, open an issue first to discuss the approach.

## License

No license has been selected yet. Until a license is added, standard copyright applies and reuse is not automatically permitted.
