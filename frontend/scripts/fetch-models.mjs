// Downloads MediaPipe model files and copies the WASM runtime into
// public/models so everything is served from OUR server (no CDN in the
// loop) and cached by the browser after the first visit.
// Run: node scripts/fetch-models.mjs

import { mkdir, writeFile, copyFile, readdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, '..', 'public', 'models')
const wasmDir = join(outDir, 'wasm')

const MODELS = [
  {
    name: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    name: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
]

await mkdir(wasmDir, { recursive: true })

// WASM runtime ships inside the npm package — copy, don't download
const pkgWasm = join(root, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
for (const file of await readdir(pkgWasm)) {
  await copyFile(join(pkgWasm, file), join(wasmDir, file))
  console.log(`copied wasm/${file}`)
}

for (const model of MODELS) {
  const dest = join(outDir, model.name)
  try {
    await access(dest)
    console.log(`${model.name} already present, skipping`)
    continue
  } catch {
    /* not downloaded yet */
  }
  console.log(`downloading ${model.name}…`)
  const res = await fetch(model.url)
  if (!res.ok) throw new Error(`Failed to fetch ${model.url}: ${res.status}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  console.log(`saved ${model.name}`)
}

console.log('models ready in frontend/public/models')
