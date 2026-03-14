/**
 * Load .env from the project root (same directory as this file).
 * Must be imported first so process.env is set before any other code reads it.
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env'), override: true })
