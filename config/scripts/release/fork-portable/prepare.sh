#!/usr/bin/env bash
# Run in a disposable Linux checkout of fork-portable.
set -euo pipefail
: "${TAG:?}" "${PORTABLE_PUBLIC_KEY:?}" "${UPSTREAM_COMMIT:?}"
[[ "$TAG" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
base=b71747a6184c208432c120861d9a1353687307ac
recipe=$(git rev-parse HEAD)
git diff --binary "$base" "$recipe" -- config/electron-builder.config.cjs \
  config/scripts/desktop-distribution/windows config/scripts/native-build/windows \
  native/windows-cli-launcher package.json src/main config/scripts/release/fork-portable/smoke.mjs > "$RUNNER_TEMP/portable.patch"
git switch --detach "$UPSTREAM_COMMIT"
git apply --3way --index "$RUNNER_TEMP/portable.patch"
node --input-type=module <<'JS'
import { createPublicKey } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
const key = createPublicKey(process.env.PORTABLE_PUBLIC_KEY)
if (key.asymmetricKeyType !== 'ed25519') throw Error('Expected an Ed25519 public key')
if ('v' + JSON.parse(readFileSync('package.json')).version !== process.env.TAG) throw Error('Tag/version mismatch')
writeFileSync('src/main/updater/windows-portable/fork-portable-channel.json',
  JSON.stringify({ publicKey: key.export({ format: 'pem', type: 'spki' }) }) + '\n')
JS
git add src/main/updater/windows-portable/fork-portable-channel.json
export GIT_AUTHOR_DATE="$(git show -s --format=%cI HEAD)"
export GIT_COMMITTER_DATE="$GIT_AUTHOR_DATE"
git -c user.name=portable-release -c user.email=portable-release@users.noreply.github.com \
  commit -m "Build Windows portable $TAG from $UPSTREAM_COMMIT" -m "Portable recipe: $recipe"
