#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * PromptForge AI — Windows build runner
 *
 * Why this exists: a .bat file is fragile (line endings, errorlevel quirks,
 * output that vanishes when the window closes). This runner streams every
 * line of output to both the console and build-log.txt, timestamps each step,
 * and always leaves the window open so a failure can actually be read.
 *
 *   node scripts/build-win.mjs
 * ------------------------------------------------------------------------- */

import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOG = join(ROOT, 'build-log.txt')
const isWin = process.platform === 'win32'

const log = createWriteStream(LOG, { flags: 'w' })
const t0 = Date.now()

function out(line = '') {
  process.stdout.write(line + '\n')
  log.write(line + '\n')
}
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

function header(title) {
  out('')
  out('─'.repeat(66))
  out(`  ${title}`)
  out('─'.repeat(66))
}

function fail(message, hint) {
  out('')
  out('  ✗ BUILD FAILED: ' + message)
  if (hint) out('  → ' + hint)
  out('')
  out('  Full log saved to: ' + LOG)
  out('')
  return finish(1)
}

async function holdOpen() {
  // Keep the window alive so the error is readable when launched by double-click.
  if (!process.stdin.isTTY) return
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise((res) => rl.question('\n  Press Enter to close…', res))
  rl.close()
}

async function finish(code) {
  // Wait for the log stream to flush before exiting, otherwise the file can be
  // truncated (or never created) because process.exit() kills pending writes.
  await new Promise((res) => log.end(res))
  await holdOpen()
  process.exit(code)
}

/* Run a command, streaming output to console and log simultaneously. */
function run(command, args, label) {
  return new Promise((resolveRun) => {
    out('')
    out(`  $ ${command} ${args.join(' ')}`)
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: true, // resolves npm / npx on Windows
      env: { ...process.env, FORCE_COLOR: '0' },
      windowsHide: false,
    })

    const pipe = (stream, mirror) => {
      stream.setEncoding('utf8')
      let buffer = ''
      stream.on('data', (chunk) => {
        buffer += chunk
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          mirror.write(line + '\n')
          log.write(line + '\n')
        }
      })
      stream.on('end', () => {
        if (buffer) {
          mirror.write(buffer + '\n')
          log.write(buffer + '\n')
        }
      })
    }

    pipe(child.stdout, process.stdout)
    pipe(child.stderr, process.stderr)

    child.on('error', (err) => {
      out(`  ! could not start ${label}: ${err.message}`)
      resolveRun({ ok: false, code: -1 })
    })
    child.on('close', (code) => {
      out(`  ${code === 0 ? '✓' : '✗'} ${label} finished with code ${code} (${elapsed()})`)
      resolveRun({ ok: code === 0, code })
    })
  })
}

/* --------------------------------- main ---------------------------------- */

async function main() {
  header('PromptForge AI — Windows build')
  out(`  Folder:   ${ROOT}`)
  out(`  Log:      ${LOG}`)
  out(`  Node:     ${process.version}`)
  out(`  Platform: ${process.platform} ${process.arch}`)

  /* 1. Preflight ---------------------------------------------------------- */
  header('1/5  Checking environment')

  const major = Number(process.version.replace('v', '').split('.')[0])
  const minor = Number(process.version.split('.')[1])
  const allowOld = process.env.PF_ALLOW_OLD_NODE === '1'
  if ((major < 22 || (major === 22 && minor < 12)) && !allowOld) {
    return fail(
      `Node ${process.version} is too old for Electron 45.`,
      'Install the current LTS from https://nodejs.org (needs 22.12 or newer), then run again.'
    )
  }
  out('  ✓ Node version is supported')
  if (allowOld) out('  ! PF_ALLOW_OLD_NODE=1 — version check bypassed, packaging may fail')

  if (!isWin) {
    out('')
    out('  ! You are not on Windows. The .exe cannot be produced from here.')
    out('    This will still validate the bundle, then stop before packaging.')
  }

  /* 2. Dependencies ------------------------------------------------------- */
  header('2/5  Dependencies')
  if (existsSync(join(ROOT, 'node_modules', 'electron')) && existsSync(join(ROOT, 'node_modules', 'electron-builder'))) {
    out('  ✓ node_modules is present — skipping install')
    out('    (delete the node_modules folder to force a clean install)')
  } else {
    out('  Installing packages. The first run downloads ~300 MB and can take a few minutes.')
    const r = await run('npm', ['install', '--no-fund', '--no-audit'], 'npm install')
    if (!r.ok) {
      return fail(
        'npm install failed.',
        'Delete the node_modules folder and try again. If Electron itself fails to download, run:  set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/'
      )
    }
  }

  /* 3. Typecheck + bundle ------------------------------------------------ */
  header('3/5  Type-check')
  {
    const r = await run('npx', ['tsc', '--noEmit'], 'tsc')
    if (!r.ok) return fail('TypeScript reported errors.', 'Fix the errors listed above, then re-run.')
  }

  header('4/5  Building the app bundle')
  {
    const r = await run('npx', ['vite', 'build'], 'vite build')
    if (!r.ok) return fail('The Vite build failed.', 'Check the first error above.')
  }
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    return fail('dist/index.html was not produced.', 'The build output folder is missing.')
  }
  out('  ✓ dist/ created')

  if (!isWin) {
    header('Summary')
    out('  ✓ Bundle validates. Run this on Windows to get the .exe:')
    out('      npm run dist:win')
    return finish(0)
  }

  /* 5. Package ----------------------------------------------------------- */
  header('5/5  Packaging for Windows')
  out('  Downloading the Electron runtime and assembling the installer.')
  out('  This can take several minutes the first time — do not close the window.')
  {
    const r = await run('npx', ['electron-builder', '--win'], 'electron-builder')
    if (!r.ok) {
      return fail(
        'electron-builder failed.',
        [
          'Common causes, in order:',
          '   1. A file in release\\ is open in Explorer or antivirus is scanning it — close it and retry.',
          '   2. Network blocked while downloading Electron — retry, or set ELECTRON_MIRROR.',
          '   3. Corrupt cache — delete %LOCALAPPDATA%\\electron-builder\\Cache and retry.',
          '   4. Missing resources\\icon.png — it must be a real PNG of at least 256x256.',
        ].join('\n     ')
      )
    }
  }

  /* Success -------------------------------------------------------------- */
  header('BUILD SUCCESSFUL')
  const releaseDir = join(ROOT, 'release')
  if (existsSync(releaseDir)) {
    const items = readdirSync(releaseDir)
      .filter((f) => f.endsWith('.exe'))
      .map((f) => ({ name: f, mb: (statSync(join(releaseDir, f)).size / 1048576).toFixed(1) }))
    if (items.length) {
      out('  Installed files:')
      for (const i of items) out(`    • ${i.name}  (${i.mb} MB)`)
      out('')
      out('  The file with "Setup" in the name is the installer.')
      out('  Any "portable" file runs without installing.')
    } else {
      out('  No .exe found in release\\ — check the log above.')
    }
    out('')
    out('  Output folder: ' + releaseDir)
  }
  out('')
  out('  Keep gemini-key.txt next to the .exe, or paste your key in Settings.')
  out(`  Total build time: ${elapsed()}`)
  return finish(0)
}

main().catch(async (err) => {
  out('')
  out('  ✗ Unexpected error: ' + (err?.stack || err))
  await finish(1)
})
