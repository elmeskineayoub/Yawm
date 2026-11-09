/**
 * Design previews render screens from synthetic fixtures (tests/fixtures) so layouts can be
 * reviewed and screenshotted without a database or real data. They exist only in development and
 * only when explicitly switched on: `YAWM_DESIGN_PREVIEW=1 npm run dev`. Anywhere else the preview
 * routes answer 404, so fixture data can never appear in a deployed app.
 */
export function designPreviewEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV !== "production" && env.YAWM_DESIGN_PREVIEW === "1";
}
