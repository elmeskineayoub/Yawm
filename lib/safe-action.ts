import { fail, type ActionResult } from "./action-result";

/**
 * Calls a server action from the browser and turns a request that never reached the server (offline,
 * dropped connection, server restart) into an ordinary failed result.
 *
 * Without this, the rejected promise escapes the surrounding transition and React 19 hands it to the
 * nearest error boundary: one lost request would replace the whole page with "Something went
 * wrong". With it, the caller's normal error path runs: the change is rolled back and the user is
 * told it wasn't saved. Nothing here ever reports success it did not get from the server.
 */
export async function safeAction<T>(
  call: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return fail(
      offline
        ? "You're offline, so this wasn't saved. Try again when you're back online."
        : "Couldn't reach the server, so this wasn't saved. Please try again.",
    );
  }
}
