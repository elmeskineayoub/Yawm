"use client";

import { useActionState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { InputField, SelectField } from "@/components/ui/field";
import { SaveStatus } from "@/components/ui/save-status";
import { updateProfile } from "@/features/profile/actions";
import { idleSaveState } from "@/lib/action-result";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ProfileForm({
  email,
  profile,
}: {
  email: string | null;
  profile: { display_name: string | null; timezone: string; week_start: number };
}) {
  const [state, action, pending] = useActionState(updateProfile, idleSaveState);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const timezones = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    return zones.includes(profile.timezone) ? zones : [profile.timezone, ...zones];
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
