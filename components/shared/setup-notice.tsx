export function SetupNotice({ problems }: { problems: string[] }) {
  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-warning-foreground"
    >
      <p className="font-semibold">Supabase is not configured — nothing can be saved.</p>
      <ul className="mt-2 list-disc break-words pl-5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p className="mt-2">
        Copy <code>.env.example</code> to <code>.env.local</code>, add your project values, and
        restart the dev server. See the README for details.
      </p>
    </div>
  );
}
