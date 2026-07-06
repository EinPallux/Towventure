/**
 * Rolling FNV-1a 32-bit hash over the numeric event stream. This is the sim's
 * cross-check (ARCHITECTURE.md §4.3): server hashes the fight it ran, the client
 * hashes the fight it replayed from the same seed, and any mismatch is a
 * determinism bug — our highest-severity class.
 *
 * We fold integers directly (never strings/JSON) so there is no serialization
 * ambiguity between platforms.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export class RollingHash {
  private h = FNV_OFFSET >>> 0;

  /** Fold one 32-bit integer (four bytes, little-endian) into the hash. */
  push(value: number): this {
    let v = value | 0; // coerce to 32-bit; negative values fold fine as bytes
    for (let i = 0; i < 4; i++) {
      this.h = (this.h ^ (v & 0xff)) >>> 0;
      this.h = Math.imul(this.h, FNV_PRIME) >>> 0;
      v >>>= 8;
    }
    return this;
  }

  /** Fold several integers in order. */
  pushAll(values: readonly number[]): this {
    for (const v of values) this.push(v);
    return this;
  }

  /** Current 32-bit digest. */
  digest(): number {
    return this.h >>> 0;
  }
}

/** One-shot convenience: hash an array of integers. */
export function hashInts(values: readonly number[]): number {
  return new RollingHash().pushAll(values).digest();
}
