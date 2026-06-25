"use client";

import type { TimeSlot } from "@/types";
import { DAY_LABELS, formatTime } from "@/lib/utils";
import { getDaysFromSlots, getUniqueSlotTimes } from "@/lib/solver";

interface WeeklyGridPreviewProps {
  slots: Pick<TimeSlot, "day_of_week" | "start_time" | "end_time" | "slot_type">[];
  compact?: boolean;
}

export function WeeklyGridPreview({ slots, compact = false }: WeeklyGridPreviewProps) {
  const days = getDaysFromSlots(slots as TimeSlot[]);
  const sessionTimes = getUniqueSlotTimes(slots as TimeSlot[]);
  const recessSlots = slots.filter((s) => s.slot_type === "recess");
  const allTimes = Array.from(
    new Set([
      ...sessionTimes,
      ...recessSlots.map((s) => s.start_time),
    ])
  ).sort();

  if (!days.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura los días y horarios para ver la rejilla.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className={`w-full min-w-[520px] border-collapse ${compact ? "text-xs" : "text-sm"}`}>
        <thead>
          <tr>
            <th className="border-b bg-slate-800 px-2 py-2 text-left font-medium text-white">
              Hora
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="border-b bg-slate-800 px-2 py-2 text-center font-medium text-white"
              >
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allTimes.map((time) => (
            <tr key={time}>
              <td className="border-b bg-slate-50 px-2 py-2 font-medium whitespace-nowrap">
                {formatTime(time)}
              </td>
              {days.map((day) => {
                const session = slots.find(
                  (s) =>
                    s.day_of_week === day &&
                    s.start_time === time &&
                    s.slot_type === "session"
                );
                const recess = slots.find(
                  (s) =>
                    s.day_of_week === day &&
                    s.start_time === time &&
                    s.slot_type === "recess"
                );
                if (recess) {
                  return (
                    <td
                      key={day}
                      className="border-b bg-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-600"
                    >
                      RECREO
                    </td>
                  );
                }
                if (session) {
                  return (
                    <td
                      key={day}
                      className="border-b bg-blue-50 px-2 py-2 text-center text-xs font-medium text-blue-800"
                    >
                      Sesión
                    </td>
                  );
                }
                return (
                  <td key={day} className="border-b px-2 py-2 text-center text-muted-foreground">
                    —
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
