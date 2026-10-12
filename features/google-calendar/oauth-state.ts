import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * CSRF protection for the OAuth round trip. The `state` sent to Google and the PKCE verifier are
 * kept in an encrypted, httpOnly cookie bound to the signed-in user and workspace. The callback
 * is accepted only if Google returns the same state, in the same browser, for the same user and
 * workspace, within ten minutes, and the cookie is cleared after one use.
 */
export const STATE_COOKIE = "yawm_google_oauth";
export const STATE_MAX_AGE_SECONDS = 10 * 60;
const CONTEXT = "google-oauth-state";

type StatePayload = {
  state: string;
  verifier: string;
  userId: string;
  workspaceId: string;
  expiresAt: number;
};

export function createOAuthState(
  owner: { userId: string; workspaceId: string },
  key: Buffer,
  now: number = Date.now(),
) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const payload: StatePayload = {
    state,
    verifier,
    ...owner,
    expiresAt: now + STATE_MAX_AGE_SECONDS * 1000,
  };
  return {
    state,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    cookieValue: encryptSecret(JSON.stringify(payload), key, CONTEXT),
  };
}

export type StateCheck =
  | { ok: true; verifier: string }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "mismatch" };

function sameString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyOAuthState(
  cookieValue: string | undefined,
  returnedState: string | null,
  owner: { userId: string; workspaceId: string },
  key: Buffer,
  now: number = Date.now(),
): StateCheck {
  if (!cookieValue || !returnedState) return { ok: false, reason: "missing" };
  const json = decryptSecret(cookieValue, key, CONTEXT);
  if (!json) return { ok: false, reason: "invalid" };
  let payload: StatePayload;
  try {
    payload = JSON.parse(json) as StatePayload;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof payload.expiresAt !== "number" || payload.expiresAt < now) {
    return { ok: false, reason: "expired" };
  }
  if (
    !sameString(payload.state, returnedState) ||
    payload.userId !== owner.userId ||
    payload.workspaceId !== owner.workspaceId
  ) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true, verifier: payload.verifier };
}
