import { expect } from "@playwright/test";

// Mailpit is the local Supabase stack's fake SMTP inbox.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MessageSummary = { ID: string; Subject: string };

/** Waits for the newest email to `address` whose subject contains `subject`; returns its link. */
export async function waitForAuthLink(address: string, subject: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
        );
        const { messages } = (await search.json()) as { messages: MessageSummary[] };
        const message = messages.find((m) => m.Subject.includes(subject));
        if (!message) return undefined;
        const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
        const { HTML } = (await detail.json()) as { HTML: string };
        link = HTML.match(/href="([^"]*\/auth\/callback[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
        return link;
      },
      { timeout: 15_000, message: `email "${subject}" to ${address}` },
    )
    .toBeTruthy();
  return link!;
}
