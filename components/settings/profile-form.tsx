"use client";

import { useActionState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateProfile } from "@/features/profile/actions";
import { idleSaveState, type SaveState } from "@/lib/action-result";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ProfileForm({
  email,
  profile,
}: {
  email: string | null;
  profile: { display_name: string | null; timezone: string; week_start: number };
}) {
  // A save that never reaches the server is reported in the form, not sent to the error page.
  const [state, action, pending] = useActionState(
    async (previous: SaveState, formData: FormData): Promise<SaveState> => {
      try {
        return await updateProfile(previous, formData);
      } catch {
        return {
          status: "error",
          message: "Couldn't reach the server, so this wasn't saved. Please try again.",
        };
      }
    },
    idleSaveState,
  );
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const timezones = useMemo(() => {
    // Recent ICU versions list only canonical zones and leave out plain "UTC", which is still a
    // valid choice (and the default for new accounts), so it is always offered first.
    const zones = Intl.supportedValuesOf("timeZone").filter((z) => z !== "UTC");
    const withUtc = ["UTC", ...zones];
    return withUtc.includes(profile.timezone) ? withUtc : [profile.timezone, ...withUtc];
  }, [profile.timezone]);

  return (
    <form action={action} className="mt-3 space-y-4" noValidate>
      <p className="text-sm">
        <span className="text-muted-foreground">Email</span> {email ?? "—"}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <InputField
          label="Name"
          name="display_name"
          maxLength={100}
          defaultValue={profile.display_name ?? ""}
          errors={errors?.display_name}
        />
        <SelectField
          label="Timezone"
          name="timezone"
          defaultValue={profile.timezone}
          options={timezones.map((z) => ({ value: z, label: z.replaceAll("_", " ") }))}
          hint="Dates, “today”, and calendar times use this zone."
          errors={errors?.timezone}
        />
        <SelectField
          label="Week starts on"
          name="week_start"
          defaultValue={String(profile.week_start)}
          options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
          errors={errors?.week_start}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save profile
        </Button>
        <SaveStatus pending={pending} state={state} />
      </div>
    </form>
  );
}
