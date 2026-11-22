import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative } from 'node:path'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'

const temp = await mkdtemp(join(tmpdir(), 'portable-release-'))
try {
  const module = join(temp, 'archive.mjs')
  await build({
    entryPoints: ['src/main/updater/windows-portable/windows-portable-archive.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: module
  })
  const { extractWindowsPortableArchive } = await import(pathToFileURL(module).href)
  const target = join(temp, 'installed')
  const work = join(target, 'data', '.portable-update')
  const staged = join(work, 'staged')
  await mkdir(work, { recursive: true })
  await writeFile(join(target, 'Orca.exe'), 'previous version')
  const sentinel = join(target, 'data', 'profile')
  await writeFile(sentinel, 'keep this profile')
  await extractWindowsPortableArchive(resolve('dist/orca-windows-x64-portable.zip'), staged)
  const manifest = join(work, 'staged-manifest.txt')
  const entries = []
  for (const entry of await readdir(staged, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }
    const file = join(entry.parentPath, entry.name)
    entries.push(
      `${(await stat(file)).size}\t${relative(staged, file).replaceAll('\\', '/').toLowerCase()}`
    )
  }
  await writeFile(manifest, `${entries.join('\n')}\n`)
  const helper = resolve('dist/win-unpacked/resources/bin/orca-portable-updater.exe')
  execFileSync(helper, ['recover', '--target', target, '--work', work])
  execFileSync(helper, [
    'apply',
    '--target',
    target,
    '--work',
    work,
    '--staged',
    staged,
    '--manifest',
    manifest
  ])
  if (
    (await readFile(sentinel, 'utf8')) !== 'keep this profile' ||
    (await stat(join(target, 'Orca.exe'))).size !== (await stat('dist/win-unpacked/Orca.exe')).size
  ) {
    throw new Error('Portable update did not preserve the profile or install the new executable')
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}
