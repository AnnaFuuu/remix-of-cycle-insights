import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// AES-256-GCM encryption for PII fields (name, id number, hospital, doctor).
// The key is the LAB_PII_ENCRYPTION_KEY secret; we hash it to 32 bytes so the
// user-supplied length (64 char hex/base64) does not matter.

function key(): Buffer {
  const raw = process.env.LAB_PII_ENCRYPTION_KEY;
  if (!raw) throw new Error("LAB_PII_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptPii(obj: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptPii<T = unknown>(stored: string): T | null {
  try {
    const buf = Buffer.from(stored, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}
