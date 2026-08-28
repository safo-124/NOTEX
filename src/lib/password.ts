import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * scrypt from Node's standard library: no native module to compile, no
 * dependency to trust, and deliberately slow to brute force.
 * Stored as `scrypt$<salt hex>$<key hex>`.
 */
export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const key = (await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
  )) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Deliberately mild: length beats character classes. */
export function passwordProblem(password: string) {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That is longer than 200 characters.";
  return null;
}
