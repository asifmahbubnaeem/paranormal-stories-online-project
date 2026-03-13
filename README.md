# From the Other Side

A platform for sharing ghostly encounters. Node.js server with a simple API for sightings, reactions, reports, newsletter signups, and analytics.

## Requirements

- Node.js (ES modules)

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Server runs at **http://localhost:8000**.

## Project structure

- **`server.js`** — HTTP server and routing
- **`handlers/`** — API route handlers
- **`utils/`** — Static serving, response helpers, sanitization
- **`public/`** — Frontend (HTML, CSS, JS)
- **`data/`** — JSON storage (sightings, newsletter, analytics, reports)

## API

| Path | Method | Description |
|------|--------|-------------|
| `/api` | GET | List sightings |
| `/api` | POST | Create sighting |
| `/api/:id` | GET | Get sighting by ID |
| `/api/:id/react` | POST | React to sighting |
| `/api/:id/report` | POST | Report sighting |
| `/api/:id/hide` | POST | Hide sighting |
| `/api/reports` | GET | Get reports |
| `/newsletter` | POST | Newsletter signup |
| `/analytics` | POST / GET | Analytics |
| `/sitemap.xml` | GET | Sitemap |

## License

ISC — Asif Naeem
