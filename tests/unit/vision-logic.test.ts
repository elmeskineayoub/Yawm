import { describe, expect, it } from "vitest";
import { imagePath, imageProblem, isCardImagePath, reorder } from "@/features/vision/logic";

const ws = "11111111-1111-4111-8111-111111111111";
const card = "22222222-2222-4222-8222-222222222222";
const file = "33333333-3333-4333-8333-333333333333";

describe("vision-board images", () => {
  it("accepts small raster images only", () => {
    expect(imageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(imageProblem({ type: "image/svg+xml", size: 1000 })).toMatch(/JPEG, PNG/);
    expect(imageProblem({ type: "text/html", size: 10 })).toMatch(/JPEG, PNG/);
    expect(imageProblem({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
    expect(imageProblem({ type: "image/webp", size: 0 })).toMatch(/empty/);
  });

  it("builds and recognises paths under the card's own folder only", () => {
    const path = imagePath(ws, card, file, "image/webp");
    expect(path).toBe(`${ws}/${card}/${file}.webp`);
    expect(isCardImagePath(path, ws, card)).toBe(true);
    expect(isCardImagePath(path, ws, file)).toBe(false); // another card
    expect(isCardImagePath(path, card, card)).toBe(false); // another workspace
    expect(isCardImagePath(`${ws}/${card}/../x.png`, ws, card)).toBe(false);
    expect(isCardImagePath(`${ws}/${card}/${file}.svg`, ws, card)).toBe(false);
  });
});

describe("reordering cards", () => {
  it("moves a card to a position, clamping at the ends", () => {
    expect(reorder(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(reorder(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b", "c"], "b", 99)).toEqual(["a", "c", "b"]);
    expect(reorder(["a", "b"], "x", 0)).toEqual(["a", "b"]);
  });
});
