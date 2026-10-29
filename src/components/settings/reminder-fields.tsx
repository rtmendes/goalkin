import { Field, Input, Select } from "@/components/ui";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const CHANNEL_LABEL = { email: "Email", push: "Device notification", calendar: "Calendar only" } as const;

/** Channel, cadence, weekday and time inputs shared by the edit and add reminder forms. */
export function ReminderFields({ idPrefix, channel = "email", cadence = "daily", time = "08:00", weekday = 1 }: {
  idPrefix: string;
  channel?: string;
  cadence?: string;
  time?: string;
  weekday?: number | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="How" id={`${idPrefix}-channel`}>
        <Select id={`${idPrefix}-channel`} name="channel" defaultValue={channel}>
          {Object.entries(CHANNEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      <Field label="How often" id={`${idPrefix}-cadence`}>
        <Select id={`${idPrefix}-cadence`} name="cadence" defaultValue={cadence}>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">Once a week</option>
        </Select>
      </Field>
      <Field label="Day (for once a week)" id={`${idPrefix}-weekday`}>
        <Select id={`${idPrefix}-weekday`} name="weekday" defaultValue={String(weekday ?? 1)}>
          {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </Select>
      </Field>
      <Field label="Time" id={`${idPrefix}-time`} hint="Your local time. Never sent in quiet hours.">
        <Input id={`${idPrefix}-time`} name="time_of_day" type="time" required defaultValue={time.slice(0, 5)} />
      </Field>
    </div>
  );
}
