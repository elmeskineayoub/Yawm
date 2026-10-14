/**
 * Magic-byte detection for the raster image types the vision-board bucket accepts. Used to verify an
 * uploaded file's actual content server-side, not just its declared Content-Type (security audit
 * 8.1). SVG is intentionally unsupported (it can carry script).
 */
export type ImageKind = "jpeg" | "png" | "gif" | "webp";

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

/** Identifies an image from its leading bytes, or null if it isn't a supported raster image. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif"; // "GIF8"
  // WebP: "RIFF" .... "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    startsWith(bytes.subarray(8, 12), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "webp";
  }
  return null;
}

export function isSupportedImage(bytes: Uint8Array): boolean {
  return sniffImage(bytes) !== null;
}
