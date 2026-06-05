import { createHash, createHmac, randomBytes } from 'crypto';

/**
 * Provably-fair RNG primitives.
 *
 * The server commits to a `serverSeed` by publishing its SHA-256 hash before a
 * round. After the round the seed can be revealed so players can recompute the
 * outcome: result = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`) folded
 * into the desired range. This makes the RNG auditable / certifiable.
 */

export interface SeedPair {
  serverSeed: string;
  serverSeedHash: string;
}

export function generateServerSeed(): SeedPair {
  const serverSeed = randomBytes(32).toString('hex');
  const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');
  return { serverSeed, serverSeedHash };
}

export function hashSeed(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex');
}

/** Deterministic float in [0, 1) from the seed material. */
export function seededFloat(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number {
  const hmac = createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');
  // Use the first 13 hex chars (52 bits) for a uniform float.
  const slice = hmac.slice(0, 13);
  const int = parseInt(slice, 16);
  return int / Math.pow(2, 52);
}

/** Deterministic integer in [0, max) (max exclusive). */
export function seededInt(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  max: number,
): number {
  return Math.floor(seededFloat(serverSeed, clientSeed, nonce) * max);
}

/** A throwaway RNG function backed by crypto for shuffles where audit isn't needed. */
export function cryptoRng(): () => number {
  return () => {
    const buf = randomBytes(6); // 48 bits
    let val = 0;
    for (const b of buf) val = val * 256 + b;
    return val / Math.pow(2, 48);
  };
}
