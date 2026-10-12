"use client";

import { useState } from "react";
import { attachCardImage, uploadTarget } from "@/features/vision/actions";
import { imagePath, imageProblem, VISION_BUCKET } from "@/features/vision/logic";
import { createClient } from "@/lib/supabase/browser";

/**
 * Uploads an image for a card straight to the private bucket with the user's own session (the
 * Storage policies decide), then asks the server to attach it. If attaching fails, the upload
 * is removed again so nothing is left behind.
 */
export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (cardId: string, file: File, alt: string | null): Promise<string | null> => {
    const problem = imageProblem(file);
    if (problem) return problem;
    setUploading(true);
    try {
      const target = await uploadTarget();
      if (!target.ok) return target.error;
      const path = imagePath(target.data.workspaceId, cardId, crypto.randomUUID(), file.type);
      const bucket = createClient().storage.from(VISION_BUCKET);
      const { error } = await bucket.upload(path, file, { contentType: file.type });
      if (error) return "The image couldn't be uploaded. Check your connection and try again.";
      const attached = await attachCardImage(cardId, path, alt);
      if (!attached.ok) {
        await bucket.remove([path]);
        return attached.error;
      }
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
