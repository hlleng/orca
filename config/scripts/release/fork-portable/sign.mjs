// Run on the publish runner, separately from the Windows build.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const { TAG, PORTABLE_PRIVATE_KEY, PORTABLE_PUBLIC_KEY } = process.env
if (!/^v\d+\.\d+\.\d+$/.test(TAG)) throw Error('Expected a stable release tag')
const archive = 'orca-windows-x64-portable.zip'
const path = join(process.argv[2], archive)
const sha256 = createHash('sha256')
const sha512 = createHash('sha512')
for await (const chunk of createReadStream(path)) {
  sha256.update(chunk)
  sha512.update(chunk)
}
const checksum = await readFile(path + '.sha256', 'utf8')
if (checksum !== sha256.digest('hex') + '  ' + archive + '\n')
  throw Error('Archive digest mismatch')
const payload = Buffer.from(TAG + '\n' + checksum)
const key = createPrivateKey(PORTABLE_PRIVATE_KEY)
const publicKey = createPublicKey(PORTABLE_PUBLIC_KEY)
if (key.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519')
  throw Error('Expected Ed25519 keys')
const signature = sign(null, payload, key)
if (!verify(null, payload, publicKey, signature))
  throw Error('Signing key differs from the embedded public key')
await writeFile(path + '.sha256.sig', signature.toString('base64') + '\n')
const digest = sha512.digest('base64')
const size = (await stat(path)).size
// JSON is valid YAML and accepted by electron-updater's generic provider.
await writeFile(
  join(process.argv[2], 'latest.yml'),
  JSON.stringify({
    version: TAG.slice(1),
    files: [{ url: archive, sha512: digest, size }],
    path: archive,
    sha512: digest,
    releaseDate: new Date().toISOString()
  }) + '\n'
)
