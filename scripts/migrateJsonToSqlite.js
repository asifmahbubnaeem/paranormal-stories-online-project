/**
 * One-time migration: data/data.json  →  data/stories.sqlite
 *                     data/reports.json  →  stories.sqlite reports table
 *
 * Safe to re-run: stories/reports that already exist in the DB are skipped.
 * The original JSON files are left untouched as backup snapshots.
 */

import fs from 'node:fs/promises'
import { db, insertStory, insertReport, getAllStories, getAllReports } from '../db/sqlite.js'

const DATA_JSON    = 'data/data.json'
const REPORTS_JSON = 'data/reports.json'

async function readJSON(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return []
  }
}

async function migrateStories() {
  const stories = await readJSON(DATA_JSON)
  const existing = new Set(getAllStories().map((s) => s.id))

  let inserted = 0
  let skipped  = 0

  db.exec('BEGIN')
  try {
    for (const story of stories) {
      const id = story.id || story.uuid
      if (!id) {
        console.warn('  [skip] story has no id – title:', story.title)
        skipped++
        continue
      }
      if (existing.has(id)) {
        skipped++
        continue
      }
      insertStory({ ...story, id })
      inserted++
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  console.log(`Stories  → inserted ${inserted}, skipped ${skipped}`)
}

async function migrateReports() {
  const reports     = await readJSON(REPORTS_JSON)
  const existingIds = new Set(getAllReports().map((r) => `${r.id}__${r.reportedAt}`))

  let inserted = 0
  let skipped  = 0

  db.exec('BEGIN')
  try {
    for (const report of reports) {
      const key = `${report.id}__${report.reportedAt}`
      if (existingIds.has(key)) {
        skipped++
        continue
      }
      insertReport(report.id, report.reason || 'No reason given')
      inserted++
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  console.log(`Reports  → inserted ${inserted}, skipped ${skipped}`)
}

console.log('Starting migration …')
await migrateStories()
await migrateReports()
console.log('Migration complete. Original JSON files are preserved as backups.')
