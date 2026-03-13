import { getData } from './getData.js'
import path from 'node:path'
import fs from 'node:fs/promises'

export async function updateSighting(id, updateFn) {
  try {
    const sightings = await getData()
    const index = sightings.findIndex(
      (item) => item.id === id || item.uuid === id
    )
    if (index === -1) return null

    sightings[index] = updateFn({ ...sightings[index] })

    const pathJSON = path.join('data', 'data.json')
    await fs.writeFile(pathJSON, JSON.stringify(sightings, null, 2), 'utf8')

    return sightings[index]
  } catch (err) {
    throw new Error(err)
  }
}
