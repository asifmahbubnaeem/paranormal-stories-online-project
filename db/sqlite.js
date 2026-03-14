import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'

mkdirSync('data', { recursive: true })

const DB_PATH = 'data/stories.sqlite'

export const db = new DatabaseSync(DB_PATH)

// WAL mode: allows concurrent reads while a write is in progress
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id                   TEXT PRIMARY KEY,
    location             TEXT,
    time_stamp           TEXT,
    title                TEXT,
    text                 TEXT,
    display_name         TEXT,
    tags                 TEXT NOT NULL DEFAULT '[]',
    reactions_chilling   INTEGER NOT NULL DEFAULT 0,
    reactions_terrifying INTEGER NOT NULL DEFAULT 0,
    reactions_skeptical  INTEGER NOT NULL DEFAULT 0,
    hidden               INTEGER NOT NULL DEFAULT 0,
    approved             INTEGER NOT NULL DEFAULT 0
  )
`)
// Migration: add approved column if missing (existing DBs)
try {
  db.exec('ALTER TABLE stories ADD COLUMN approved INTEGER NOT NULL DEFAULT 1')
} catch (e) {
  if (!/duplicate column/i.test(e?.message ?? '')) throw e
}

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id    TEXT NOT NULL,
    reason      TEXT,
    reported_at TEXT NOT NULL
  )
`)

// ── Shape helpers ────────────────────────────────────────────────

function rowToStory(row) {
  if (!row) return null
  return {
    id: row.id,
    uuid: row.id,
    location: row.location,
    timeStamp: row.time_stamp,
    title: row.title,
    text: row.text,
    displayName: row.display_name,
    tags: JSON.parse(row.tags || '[]'),
    reactions: {
      chilling: row.reactions_chilling,
      terrifying: row.reactions_terrifying,
      skeptical: row.reactions_skeptical,
    },
    hidden: Boolean(row.hidden),
    approved: row.approved === undefined ? true : Boolean(row.approved),
  }
}

// ── Reads ────────────────────────────────────────────────────────

export function getAllStories(includeUnapproved = false) {
  const rows = db.prepare('SELECT * FROM stories ORDER BY rowid ASC').all()
  const stories = rows.map(rowToStory)
  if (includeUnapproved) return stories
  return stories.filter((s) => s.approved && !s.hidden)
}

/** Stories waiting for admin approval (approved=0, not hidden) */
export function getPendingStories() {
  return db
    .prepare('SELECT * FROM stories WHERE approved = 0 AND hidden = 0 ORDER BY rowid ASC')
    .all()
    .map(rowToStory)
}

export function getStoryById(id, includeUnapproved = false) {
  const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id)
  const story = rowToStory(row)
  if (!story) return null
  if (!includeUnapproved && (!story.approved || story.hidden)) return null
  return story
}

// ── Writes ───────────────────────────────────────────────────────

export function insertStory(story) {
  const r = story.reactions || {}
  const approved = story.approved !== undefined ? (story.approved ? 1 : 0) : 0
  db.prepare(`
    INSERT INTO stories
      (id, location, time_stamp, title, text, display_name, tags,
       reactions_chilling, reactions_terrifying, reactions_skeptical, hidden, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    story.id,
    story.location ?? null,
    story.timeStamp ?? null,
    story.title ?? null,
    story.text ?? null,
    story.displayName ?? null,
    JSON.stringify(story.tags ?? []),
    r.chilling ?? 0,
    r.terrifying ?? 0,
    r.skeptical ?? 0,
    story.hidden ? 1 : 0,
    approved,
  )
  return getStoryById(story.id, true)
}

export function incrementReaction(id, reaction) {
  const allowed = ['chilling', 'terrifying', 'skeptical']
  if (!allowed.includes(reaction)) throw new Error('Invalid reaction')
  const col = `reactions_${reaction}`
  const result = db.prepare(`UPDATE stories SET ${col} = ${col} + 1 WHERE id = ?`).run(id)
  if (result.changes === 0) return null
  return getStoryById(id)
}

export function setHidden(id, hidden) {
  const result = db.prepare('UPDATE stories SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, id)
  if (result.changes === 0) return null
  return getStoryById(id, true)
}

export function setApproved(id, approved) {
  const result = db.prepare('UPDATE stories SET approved = ? WHERE id = ?').run(approved ? 1 : 0, id)
  if (result.changes === 0) return null
  return getStoryById(id, true)
}

// ── Reports ──────────────────────────────────────────────────────

export function insertReport(storyId, reason) {
  db.prepare('INSERT INTO reports (story_id, reason, reported_at) VALUES (?, ?, ?)').run(
    storyId,
    reason,
    new Date().toISOString(),
  )
}

export function getAllReports() {
  return db.prepare('SELECT * FROM reports ORDER BY id ASC').all().map((r) => ({
    id: r.story_id,
    reason: r.reason,
    reportedAt: r.reported_at,
  }))
}
