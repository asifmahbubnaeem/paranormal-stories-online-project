# From the Other Side

A platform for sharing ghostly encounters. Node.js server with a simple API for sightings, reactions, reports, newsletter signups, and analytics.

## Requirements

- Node.js 22+ (ES modules, built-in `node:sqlite`)

## Setup

```bash
npm install
```

## First-time database setup

Stories are stored in a SQLite database (`data/stories.sqlite`), created automatically when the server first starts. If you have existing data in `data/data.json`, migrate it once with:

```bash
npm run db:migrate
```

The original JSON files are left untouched as backup snapshots.

## Run

```bash
npm start
```

Server runs at **http://localhost:8000**.

## Project structure

```
server.js              HTTP server and routing
handlers/              API route handlers
utils/                 Static serving, response helpers, sanitization
db/
  sqlite.js            SQLite database layer (stories + reports)
scripts/
  migrateJsonToSqlite.js   One-time migration from JSON → SQLite
  exportSqliteToJson.js    Backup export: SQLite → timestamped JSON snapshots
public/                Frontend (HTML, CSS, JS)
data/
  stories.sqlite       SQLite database (git-ignored, production data)
  data.json            Legacy JSON snapshot / migration source
  newsletter.json      Newsletter subscriber emails
  analytics.json       Analytics event log (capped at 10 000 entries)
  backup/              Timestamped JSON exports (git-ignored)
```

## Database scripts

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Import `data/data.json` and `data/reports.json` into SQLite (safe to re-run) |
| `npm run db:backup` | Export all stories and reports to `data/backup/` as timestamped JSON files |

**Tip:** schedule `npm run db:backup` as a daily cron job for automatic backups:

```
0 3 * * * cd /your/app && npm run db:backup >> logs/backup.log 2>&1
```

## Admin key

Protected endpoints (`/api/:id/hide`, `GET /api/reports`, `GET /analytics`) require an admin key passed as a query parameter or header:

```
?key=<ADMIN_KEY>
# or
X-Admin-Key: <ADMIN_KEY>
```

Set the key via the `ADMIN_KEY` environment variable (defaults to `ghostadmin` — change this in production):

```bash
ADMIN_KEY=my-secret npm start
```

## API

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api` | GET | — | List visible sightings |
| `/api` | POST | — | Submit a new sighting |
| `/api/:id` | GET | — | Get sighting by ID |
| `/api/:id/react` | POST | — | Increment a reaction |
| `/api/:id/report` | POST | — | Report a sighting |
| `/api/:id/hide` | POST | Admin | Hide / unhide a sighting |
| `/api/reports` | GET | Admin | List all reports |
| `/newsletter` | POST | — | Newsletter signup |
| `/analytics` | POST | — | Record an analytics event |
| `/analytics` | GET | Admin | Retrieve analytics log |
| `/sitemap.xml` | GET | — | XML sitemap |

## License

ISC — Asif Naeem
