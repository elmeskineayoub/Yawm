import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets at rest. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url).
 *
 * `context` is authenticated but not stored: a ciphertext only decrypts with the same context
 * (for tokens, the workspace and user it belongs to), so a row's ciphertext copied into another
 * row is useless.
 */
const VERSION = "v1";

export function encryptSecret(plaintext: string, key: Buffer, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** Returns null if the value was tampered with, uses another key, or belongs to another context. */
export function decryptSecret(value: string, key: Buffer, context: string): string | null {
  const [version, iv, tag, body, ...rest] = value.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined || rest.length) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export const tokenContext = (workspaceId: string, userId: string, kind: "refresh" | "access") =>
  `google-${kind}-token:${workspaceId}:${userId}`;
