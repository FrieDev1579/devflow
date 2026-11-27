# DevFlow

A lightweight, beginner-friendly workspace for creating and managing simple workflows.

> **Project status:** Early MVP / prototype. Workflow execution is simulated in the browser; no external services are contacted.

## Features

- Responsive workflow dashboard
- Create, search, pause, resume, and delete workflows
- Run workflows in demo mode and track demo run counts
- Browser-local persistence using `localStorage`
- Starter workflows to explore the interface

## Tech stack

- React 18
- TypeScript
- Vite
- CSS

## Run locally

Requires Node.js 18 or later.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

Create a production build:

```bash
npm run build
npm run preview
```

## Current limitations

This is a frontend MVP. It does not yet include user accounts, a server-side database, scheduled jobs, third-party integrations, or real background automation. Workflow data is stored in the current browser only. The Run button demonstrates the interaction and updates a local counter; it does not execute external actions.

## Roadmap

- [ ] Add a backend API and persistent database
- [ ] Add secure authentication and workspace accounts
- [ ] Build a visual workflow editor
- [ ] Add real triggers and action integrations
- [ ] Add execution logs, retries, and error handling
- [ ] Add automated tests and deployment workflow

## Contributing

Issues and pull requests are welcome. For significant changes, open an issue first to discuss the approach.

## License

No license has been selected yet. Until a license is added, standard copyright applies and reuse is not automatically permitted.
