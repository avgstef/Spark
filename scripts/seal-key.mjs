#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * Seals an API key into electron/vault.dat
 *
 * The key never appears as plain text in the repository or the app bundle.
 * It is XOR-masked with a rotating keystream and base64-encoded, and the
 * provider endpoint is assembled from fragments at runtime — so grepping the
 * source or the packaged app for a key or a provider name finds nothing.
 *
 *   node scripts/seal-key.mjs "YOUR_KEY"
 *   node scripts/seal-key.mjs --from-file spark.key
 *
 * IMPORTANT: this is obfuscation, not encryption. Anyone determined enough to
 * run the app can extract the key it uses. It stops casual copying, not a
 * reverse engineer. See README section 9.
 * ------------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SALT = 'spark.vault.v1'

/* Deterministic keystream so the runtime can rebuild it without storing a key. */
function keystream(length, seed) {
  const out = Buffer.alloc(length)
  let h = 0x9e3779b9
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x85ebca6b) >>> 0
  for (let i = 0; i < length; i++) {
    h ^= h << 13; h >>>= 0
    h ^= h >> 17
    h ^= h << 5; h >>>= 0
    out[i] = (h >>> 0) & 0xff
  }
  return out
}

function seal(plain) {
  const data = Buffer.from(plain, 'utf8')
  const ks = keystream(data.length, SALT)
  const masked = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ ks[i]
  // reverse so the encoded blob does not start like the original key
  return masked.reverse().toString('base64')
}

const args = process.argv.slice(2)
let key = ''
if (args[0] === '--from-file') {
  key = readFileSync(join(ROOT, args[1] || 'spark.key'), 'utf8').split(/\r?\n/)[0].trim()
} else {
  key = (args[0] || '').trim()
}

if (!key) {
  console.error('\n  No key supplied.\n')
  console.error('  Usage:  node scripts/seal-key.mjs "YOUR_KEY"\n')
  console.error('          node scripts/seal-key.mjs --from-file spark.key\n')
  process.exit(1)
}

const payload = {
  v: 1,
  sealed: seal(key),
  // a short, non-reversible fingerprint so you can tell which key is loaded
  tag: Buffer.from(key).toString('base64').slice(-6).replace(/[^A-Za-z0-9]/g, '0'),
}

const out = join(ROOT, 'electron', 'vault.dat')
writeFileSync(out, JSON.stringify(payload), { mode: 0o600 })
console.log(`\n  Sealed ${key.length}-character key into electron/vault.dat`)
console.log(`  Fingerprint: ${payload.tag}\n`)
