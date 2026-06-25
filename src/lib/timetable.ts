import type { RecessConfig, TimeSlot, TimetableSettings } from "@/types";

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function overlaps(start: number, end: number, recess: RecessConfig): boolean {
  const rStart = parseTime(recess.start);
  const rEnd = rStart + recess.duration_minutes;
  return start < rEnd && end > rStart;
}

export function generateTimeSlots(
  schoolId: string,
  settings: Pick<
    TimetableSettings,
    "school_days" | "day_start" | "day_end" | "session_duration_minutes" | "recesses"
  >
): Omit<TimeSlot, "id">[] {
  const slots: Omit<TimeSlot, "id">[] = [];
  let sortOrder = 0;

  for (const day of settings.school_days.sort((a, b) => a - b)) {
    let cursor = parseTime(settings.day_start);
    const dayEnd = parseTime(settings.day_end);

    while (cursor < dayEnd) {
      const sessionEnd = cursor + settings.session_duration_minutes;
      if (sessionEnd > dayEnd) break;

      const inRecess = settings.recesses.some((r) =>
        overlaps(cursor, sessionEnd, r)
      );

      if (inRecess) {
        const recess = settings.recesses.find((r) => {
          const rStart = parseTime(r.start);
          return cursor >= rStart && cursor < rStart + r.duration_minutes;
        });
        if (recess) {
          const rStart = parseTime(recess.start);
          slots.push({
            school_id: schoolId,
            day_of_week: day,
            start_time: formatMinutes(rStart),
            end_time: formatMinutes(rStart + recess.duration_minutes),
            slot_type: "recess",
            sort_order: sortOrder++,
          });
          cursor = rStart + recess.duration_minutes;
          continue;
        }
      }

      slots.push({
        school_id: schoolId,
        day_of_week: day,
        start_time: formatMinutes(cursor),
        end_time: formatMinutes(sessionEnd),
        slot_type: "session",
        sort_order: sortOrder++,
      });
      cursor = sessionEnd;
    }
  }

  return slots;
}

export function countSessionSlots(slots: Pick<TimeSlot, "slot_type">[]): number {
  return slots.filter((s) => s.slot_type === "session").length;
}

export function countSessionsPerDay(
  slots: Pick<TimeSlot, "day_of_week" | "slot_type">[]
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const slot of slots) {
    if (slot.slot_type !== "session") continue;
    counts[slot.day_of_week] = (counts[slot.day_of_week] ?? 0) + 1;
  }
  return counts;
}
