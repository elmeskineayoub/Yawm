/**
 * Vision-board rules shared by the browser (early, friendly checks) and the server (the checks
 * that count). The private Storage bucket enforces type and size again on upload.
 */

export const VISION_BUCKET = "vision-board";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Raster images only: SVG can carry scripts, so it is never accepted. */
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function imageProblem(file: { type: string; size: number }): string | null {
  if (!(file.type in IMAGE_TYPES)) return "Use a JPEG, PNG, WebP, or GIF image.";
  if (file.size > MAX_IMAGE_BYTES) return "Use an image of 5 MB or less.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** Where a card's image lives: `{workspace}/{card}/{random}.{ext}`. */
export function imagePath(workspaceId: string, cardId: string, fileId: string, type: string) {
  return `${workspaceId}/${cardId}/${fileId}.${IMAGE_TYPES[type] ?? "img"}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH = new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(jpg|png|webp|gif)$`);

/** True only for a path this app would have created for this workspace and card. */
export function isCardImagePath(path: string, workspaceId: string, cardId: string): boolean {
  const match = PATH.exec(path);
  return match !== null && match[1] === workspaceId && match[2] === cardId;
}

/** Moves `id` to position `to` (clamped) and returns the new order. */
export function reorder<T extends string>(ids: readonly T[], id: T, to: number): T[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const next = ids.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}
