import type { WorkspaceContext } from "@/lib/workspace-context";
import { VISION_BUCKET } from "./logic";

export type VisionCard = {
  id: string;
  title: string | null;
  body: string | null;
  area_id: string | null;
  goal_id: string | null;
  image_path: string | null;
  image_alt: string | null;
  archived_at: string | null;
  sort_order: number;
  /** Short-lived signed URL for the private image; null if there is none or signing failed. */
  image_url: string | null;
};

/** How long a signed image URL stays valid. Pages are rendered per request, so this is ample. */
const URL_SECONDS = 60 * 60;

export type CardFilter = {
  /** An area ID, or "none" for cards without one. */
  area?: string;
  goal?: string;
  archived?: boolean;
};

export async function loadVisionCards(
  ctx: WorkspaceContext,
  filter: CardFilter = {},
): Promise<VisionCard[]> {
  let query = ctx.supabase
    .from("vision_board_items")
    .select("id, title, body, area_id, goal_id, image_path, image_alt, archived_at, sort_order")
    .eq("workspace_id", ctx.workspace.id);
  query = filter.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (filter.area === "none") query = query.is("area_id", null);
  else if (filter.area) query = query.eq("area_id", filter.area);
  if (filter.goal) query = query.eq("goal_id", filter.goal);
  const { data, error } = await query.order("sort_order").order("created_at").limit(500);
  if (error) throw new Error("Could not load the vision board.");

  const paths = data.flatMap((c) => (c.image_path ? [c.image_path] : []));
  const urls = new Map<string, string>();
  if (paths.length) {
    const signed = await ctx.supabase.storage
      .from(VISION_BUCKET)
      .createSignedUrls(paths, URL_SECONDS);
    for (const s of signed.data ?? []) {
      if (s.path && s.signedUrl && !s.error) urls.set(s.path, s.signedUrl);
    }
  }
  return data.map((c) => ({
    ...c,
    image_url: c.image_path ? (urls.get(c.image_path) ?? null) : null,
  }));
}
