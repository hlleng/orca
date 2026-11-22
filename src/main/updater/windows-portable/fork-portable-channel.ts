import { verify } from 'node:crypto'
import { isWindowsPortablePackage } from '../linux-package/linux-update-package-type'
import channel from './fork-portable-channel.json'

export function isForkPortable(): boolean {
  return Boolean(channel.publicKey) && isWindowsPortablePackage()
}

export function releaseRepository(): string {
  return isForkPortable() ? 'hlleng/orca' : 'stablyai/orca'
}

export function verifyPortableChecksum(tag: string, checksum: string, signature: string): void {
  if (
    !verify(
      null,
      Buffer.from(`${tag}\n${checksum}`),
      channel.publicKey,
      Buffer.from(signature, 'base64')
    )
  ) {
    throw new Error('Invalid signature on the portable release checksum')
  }
}
