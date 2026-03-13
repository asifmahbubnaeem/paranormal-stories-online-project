/**
 * Backup / export utility: reads all stories and reports from SQLite
 * and writes portable JSON snapshots to data/backup/.
 *
 * Usage:
 *   node scripts/exportSqliteToJson.js
 *
 * Output files:
 *   data/backup/stories-<ISO-timestamp>.json
 *   data/backup/reports-<ISO-timestamp>.json
 *
 * Tip: add this to a cron job for automatic daily backups, e.g.:
 *   0 3 * * * cd /your/app && node scripts/exportSqliteToJson.js >> logs/backup.log 2>&1
 */

import fs from 'node:fs/promises'
import { getAllStories, getAllReports } from '../db/sqlite.js'

const ts     = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = 'data/backup'

await fs.mkdir(outDir, { recursive: true })

const storiesPath = `${outDir}/stories-${ts}.json`
const reportsPath = `${outDir}/reports-${ts}.json`

const stories = getAllStories()
const reports = getAllReports()

await fs.writeFile(storiesPath, JSON.stringify(stories, null, 2), 'utf8')
await fs.writeFile(reportsPath, JSON.stringify(reports, null, 2), 'utf8')

console.log(`Exported ${stories.length} stories  → ${storiesPath}`)
console.log(`Exported ${reports.length} reports  → ${reportsPath}`)
