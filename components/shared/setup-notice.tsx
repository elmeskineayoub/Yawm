export function SetupNotice({ problems }: { problems: string[] }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-warning-foreground"
    >
      <p className="font-semibold">Supabase is not configured — nothing can be loaded or saved.</p>
      <ul className="mt-2 list-disc break-words pl-5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p className="mt-3 font-medium">Local development</p>
      <ol className="mt-1 list-decimal pl-5">
        <li>
          Run <code>npm run db:start</code> (needs Docker).
        </li>
        <li>
          Run <code>npm run db:env</code> to write <code>.env.local</code>.
        </li>
        <li>Restart the dev server, or rebuild for production.</li>
      </ol>
      <p className="mt-3">
        For a hosted Supabase project, follow &ldquo;Supabase setup&rdquo; in the README.
      </p>
    </div>
  );
}
