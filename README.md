# DevFlow

A lightweight, beginner-friendly workspace for creating and managing simple workflows.

> **Project status:** Early MVP / prototype. Scheduled reminders run in the browser while the app tab is open; workflows do not execute external actions.

## Features

- Responsive workflow dashboard
- Create, search, pause, resume, and delete workflows
- Manually run workflows and track run counts
- Schedule in-app reminders every 1 or 5 minutes
- Optional desktop notifications for scheduled reminders (browser permission required)
- Activity history for workflow creation, manual/scheduled runs, pauses, resumes, and deletions
- Browser-local persistence using `localStorage`

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

## Scheduled workflow limitations

The current scheduler is browser-side. It checks active scheduled workflows while the DevFlow page is open and displays an in-app reminder when a workflow is due. When the user enables desktop notification permission, the browser also sends a desktop notification. The browser tab must remain open. Closing the tab or browser stops scheduling until the app is opened again. It does not send emails, contact third-party services, or run server-side jobs. Workflow and activity data are stored only in the current browser.

## Roadmap

- [ ] Add a backend API and persistent database
- [ ] Add secure authentication and workspace accounts
- [ ] Build a visual workflow editor
- [ ] Add real triggers and third-party action integrations
- [ ] Add server-side scheduling, execution logs, retries, and error handling
- [ ] Add automated tests and deployment workflow

## Contributing

Issues and pull requests are welcome. For significant changes, open an issue first to discuss the approach.

## License

No license has been selected yet. Until a license is added, standard copyright applies and reuse is not automatically permitted.
