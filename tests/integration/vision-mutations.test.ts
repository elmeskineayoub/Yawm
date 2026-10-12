import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imagePath, VISION_BUCKET } from "@/features/vision/logic";
import {
  createCardInWorkspace,
  deleteCardInWorkspace,
  moveCardInWorkspace,
  removeCardImageInWorkspace,
  setCardImageInWorkspace,
} from "@/features/vision/mutations";
import { loadVisionCards } from "@/features/vision/queries";
import type { WorkspaceContext } from "@/lib/workspace-context";
import {
  adminClient,
  createConfirmedUser,
  deleteUsers,
  personalWorkspaceId,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let ws: string;
let bobWs: string;

beforeAll(async () => {
  alice = await createConfirmedUser("alice-vision");
  bob = await createConfirmedUser("bob-vision");
  [ws, bobWs] = await Promise.all([personalWorkspaceId(alice.id), personalWorkspaceId(bob.id)]);
});

afterAll(async () => {
  await deleteUsers(alice, bob);
});

const png = () =>
  new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
    type: "image/png",
  });

async function card(title: string | null = "Ocean", db = alice.client, workspace = ws) {
  const result = await createCardInWorkspace(db, workspace, {
    title,
    body: title ? null : "Just text",
  });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function upload(cardId: string, db = alice.client, workspace = ws) {
  const path = imagePath(workspace, cardId, randomUUID(), "image/png");
  const { error } = await db.storage.from(VISION_BUCKET).upload(path, png(), {
    contentType: "image/png",
  });
  if (error) throw error;
  return path;
}

async function files(cardId: string, workspace = ws) {
  const { data } = await adminClient().storage.from(VISION_BUCKET).list(`${workspace}/${cardId}`);
  return (data ?? []).map((f) => f.name);
}

const ctx = () =>
  ({
    supabase: alice.client,
    user: { id: alice.id, email: alice.email },
    workspace: { id: ws, name: "Personal", is_personal: true },
    timezone: "UTC",
    weekStart: 1,
    today: "2026-10-12",
  }) as WorkspaceContext;

describe("card images", () => {
  it("attaches an uploaded image and shows it through a signed URL", async () => {
    const id = await card();
    const path = await upload(id);
    expect(await setCardImageInWorkspace(alice.client, ws, id, path, "A calm sea")).toMatchObject({
      ok: true,
    });
    const shown = (await loadVisionCards(ctx())).find((c) => c.id === id)!;
    expect(shown.image_alt).toBe("A calm sea");
    expect(shown.image_url).toMatch(/token=/);
    expect((await fetch(shown.image_url!)).ok).toBe(true);
  });

  it("replacing an image deletes the old file", async () => {
    const id = await card();
    const first = await upload(id);
    await setCardImageInWorkspace(alice.client, ws, id, first, null);
    const second = await upload(id);
    await setCardImageInWorkspace(alice.client, ws, id, second, null);
    expect(await files(id)).toEqual([second.split("/")[2]]);
  });

  it("refuses paths that aren't this card's, and uploads that don't exist", async () => {
    const id = await card();
    const other = await card("Other");
    const otherPath = await upload(other);
    expect(await setCardImageInWorkspace(alice.client, ws, id, otherPath, null)).toEqual({
      ok: false,
      error: "That upload doesn't belong here.",
    });
    const missing = imagePath(ws, id, randomUUID(), "image/png");
    expect(await setCardImageInWorkspace(alice.client, ws, id, missing, null)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/didn't finish uploading/),
    });
    expect(
      await setCardImageInWorkspace(alice.client, ws, id, `${ws}/${id}/../../x.png`, null),
    ).toMatchObject({ ok: false });
  });

  it("can't attach to, or delete, another workspace's card", async () => {
    const bobCard = await card("Bob's", bob.client, bobWs);
    const bobPath = await upload(bobCard, bob.client, bobWs);
    expect(await setCardImageInWorkspace(alice.client, ws, bobCard, bobPath, null)).toMatchObject({
      ok: false,
    });
    expect(await deleteCardInWorkspace(alice.client, ws, bobCard)).toMatchObject({ ok: false });
    expect(await files(bobCard, bobWs)).toHaveLength(1);
  });

  it("an image-only card keeps its image until it has text", async () => {
    const id = await card();
    const path = await upload(id);
    await setCardImageInWorkspace(alice.client, ws, id, path, null);
    await alice.client.from("vision_board_items").update({ title: null }).eq("id", id);
    expect(await removeCardImageInWorkspace(alice.client, ws, id)).toEqual({
      ok: false,
      error: "Add a title or text before removing the image.",
    });
    await alice.client.from("vision_board_items").update({ title: "Back" }).eq("id", id);
    expect(await removeCardImageInWorkspace(alice.client, ws, id)).toMatchObject({ ok: true });
    expect(await files(id)).toEqual([]);
  });

  it("deleting a card deletes its files, including unattached uploads", async () => {
    const id = await card();
    await setCardImageInWorkspace(alice.client, ws, id, await upload(id), null);
    await upload(id); // uploaded but never attached
    expect(await files(id)).toHaveLength(2);
    expect(await deleteCardInWorkspace(alice.client, ws, id)).toMatchObject({ ok: true });
    expect(await files(id)).toEqual([]);
  });
});

describe("ordering", () => {
  it("moves a card before another one, or to the end", async () => {
    const db = alice.client;
    await adminClient().from("vision_board_items").delete().eq("workspace_id", ws);
    const [a, b, c] = [await card("A"), await card("B"), await card("C")];
    await moveCardInWorkspace(db, ws, c, a);
    const titles = (await loadVisionCards(ctx())).map((x) => x.title);
    expect(titles).toEqual(["C", "A", "B"]);
    await moveCardInWorkspace(db, ws, a, null);
    expect((await loadVisionCards(ctx())).map((x) => x.id)).toEqual([c, b, a]);
  });
});
