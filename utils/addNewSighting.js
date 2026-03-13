import { getData } from './getData.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export async function addNewSighting(newSighting) {
  try {
    const sightings = await getData()

    const id = newSighting.id || newSighting.uuid || randomUUID()
    const sightingToSave = { ...newSighting, id }

    sightings.push(sightingToSave)

    const pathJSON = path.join('data', 'data.json')

    await fs.writeFile(
      pathJSON,
      JSON.stringify(sightings, null, 2),
      'utf8'
    )

    return sightingToSave
  } catch (err) {
    throw new Error(err)
  }
}