/**
 * Password hashing — argon2id (ARCHITECTURE §1, OPERATIONS §5). @node-rs/argon2
 * ships prebuilt native bindings (no node-gyp), argon2id by default.
 */

import { hash, verify } from '@node-rs/argon2';

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passHash, password);
  } catch {
    return false;
  }
}
