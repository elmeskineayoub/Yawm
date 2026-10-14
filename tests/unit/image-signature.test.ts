import { describe, expect, it } from "vitest";
import { isSupportedImage, sniffImage } from "@/lib/image-signature";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffImage", () => {
  it("detects JPEG, PNG, GIF, and WebP from magic bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    // RIFF....WEBP
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe(
      "webp",
    );
  });

  it("rejects non-images (incl. HTML and SVG) and short inputs", () => {
    // "<svg" / "<htm"
    expect(sniffImage(bytes(0x3c, 0x73, 0x76, 0x67))).toBeNull();
    expect(sniffImage(bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c))).toBeNull();
    expect(sniffImage(bytes(0xff, 0xd8))).toBeNull(); // too short for JPEG
    expect(sniffImage(bytes())).toBeNull();
    // RIFF without WEBP (e.g. a WAV) is not accepted
    expect(
      sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull();
  });

  it("isSupportedImage mirrors sniffImage", () => {
    expect(isSupportedImage(bytes(0xff, 0xd8, 0xff))).toBe(true);
    expect(isSupportedImage(bytes(0x00, 0x01, 0x02))).toBe(false);
  });
});
