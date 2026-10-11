import { execFileSync } from "node:child_process";

type LocalStatus = { API_URL?: string; PUBLISHABLE_KEY?: string; SECRET_KEY?: string };

/**
 * Resolves the local Supabase URL and keys. Explicit SUPABASE_TEST_* variables win; otherwise
 * they are read from `supabase status`. Refuses to run against anything but a local stack,
 * because these tests create and delete users with an admin key.
 */
export default function setup() {
  let url = process.env.SUPABASE_TEST_URL;
  let publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  let secretKey = process.env.SUPABASE_TEST_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    let status: LocalStatus;
    try {
      const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      status = JSON.parse(output.slice(output.indexOf("{"))) as LocalStatus;
    } catch {
      throw new Error(
        "Local Supabase is not running. Start it with `npm run db:start`, then rerun the tests.",
      );
    }
    url = status.API_URL;
    publishableKey = status.PUBLISHABLE_KEY;
    secretKey = status.SECRET_KEY;
  }

  if (!url || !publishableKey || !secretKey) {
    throw new Error("Could not determine the local Supabase URL and keys.");
  }
  const { hostname } = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(hostname)) {
    throw new Error(`Refusing to run integration tests against non-local Supabase (${hostname}).`);
  }

  process.env.SUPABASE_TEST_URL = url;
  process.env.SUPABASE_TEST_PUBLISHABLE_KEY = publishableKey;
  process.env.SUPABASE_TEST_SECRET_KEY = secretKey;
}
