import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TypedClient = SupabaseClient<Database>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see tests/integration/global-setup.ts`);
  return value;
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS. Used only to arrange fixtures and to verify state independently. */
export function adminClient(): TypedClient {
  return createClient<Database>(
    env("SUPABASE_TEST_URL"),
    env("SUPABASE_TEST_SECRET_KEY"),
    clientOptions,
  );
}

/** Same credentials a browser has: the publishable key, subject to RLS. */
export function publicClient(): TypedClient {
  return createClient<Database>(
    env("SUPABASE_TEST_URL"),
    env("SUPABASE_TEST_PUBLISHABLE_KEY"),
    clientOptions,
  );
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: TypedClient;
};

export async function createConfirmedUser(
  label: string,
  metadata: Record<string, string> = {},
): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");

  const client = publicClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  return { id: data.user.id, email, password, client };
}

export async function deleteUsers(...users: (TestUser | undefined)[]) {
  const admin = adminClient();
  await Promise.all(
    users.filter((u): u is TestUser => Boolean(u)).map((u) => admin.auth.admin.deleteUser(u.id)),
  );
}

export async function personalWorkspaceId(userId: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();
  if (error) throw error;
  return data.id;
}
