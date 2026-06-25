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

export type TimetableGenerationSettings = Pick<
  TimetableSettings,
  "school_days" | "day_start" | "day_end" | "session_duration_minutes" | "block_granularity_minutes" | "recesses"
>;

export function getBlockGranularity(settings: TimetableGenerationSettings): number {
  return settings.block_granularity_minutes || settings.session_duration_minutes || 15;
}

export function generateTimeSlots(
  schoolId: string,
  settings: TimetableGenerationSettings
): Omit<TimeSlot, "id">[] {
  const blockMinutes = getBlockGranularity(settings);
  const slots: Omit<TimeSlot, "id">[] = [];
  let sortOrder = 0;

  for (const day of settings.school_days.sort((a, b) => a - b)) {
    let cursor = parseTime(settings.day_start);
    const dayEnd = parseTime(settings.day_end);

    while (cursor < dayEnd) {
      const blockEnd = cursor + blockMinutes;
      if (blockEnd > dayEnd) break;

      const inRecess = settings.recesses.some((r) => overlaps(cursor, blockEnd, r));

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
            duration_minutes: recess.duration_minutes,
          });
          cursor = rStart + recess.duration_minutes;
          continue;
        }
      }

      slots.push({
        school_id: schoolId,
        day_of_week: day,
        start_time: formatMinutes(cursor),
        end_time: formatMinutes(blockEnd),
        slot_type: "session",
        sort_order: sortOrder++,
        duration_minutes: blockMinutes,
      });
      cursor = blockEnd;
    }
  }

  return slots;
}

export function countSessionSlots(slots: Pick<TimeSlot, "slot_type">[]): number {
  return slots.filter((s) => s.slot_type === "session").length;
}

export function countAvailableMinutes(slots: Pick<TimeSlot, "slot_type" | "duration_minutes">[]): number {
  return slots
    .filter((s) => s.slot_type === "session")
    .reduce((sum, s) => sum + (s.duration_minutes ?? 15), 0);
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

export function orderBlocksByDay(slots: TimeSlot[]): TimeSlot[] {
  return [...slots]
    .filter((s) => s.slot_type === "session")
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return a.sort_order - b.sort_order;
    });
}

export function findContiguousBlocks(
  slots: TimeSlot[],
  day: number,
  blocksNeeded: number
): TimeSlot[][] {
  const dayBlocks = orderBlocksByDay(slots).filter((s) => s.day_of_week === day);
  const sequences: TimeSlot[][] = [];

  for (let i = 0; i <= dayBlocks.length - blocksNeeded; i++) {
    const slice = dayBlocks.slice(i, i + blocksNeeded);
    const contiguous = slice.every((block, idx) => {
      if (idx === 0) return true;
      return block.sort_order === slice[idx - 1].sort_order + 1;
    });
    if (contiguous) sequences.push(slice);
  }

  return sequences;
}

export function blocksOverlap(slotIds: string[], occupied: Set<string>): boolean {
  return slotIds.some((id) => occupied.has(id));
}

export function slotIdsForDuration(
  slots: TimeSlot[],
  startSlotId: string,
  durationMinutes: number,
  blockGranularityMinutes: number
): string[] | null {
  const blocksNeeded = Math.ceil(durationMinutes / blockGranularityMinutes);
  const start = slots.find((s) => s.id === startSlotId);
  if (!start) return null;

  const dayBlocks = orderBlocksByDay(slots).filter((s) => s.day_of_week === start.day_of_week);
  const startIdx = dayBlocks.findIndex((s) => s.id === startSlotId);
  if (startIdx < 0) return null;

  const slice = dayBlocks.slice(startIdx, startIdx + blocksNeeded);
  if (slice.length < blocksNeeded) return null;

  const contiguous = slice.every((block, idx) => {
    if (idx === 0) return true;
    return block.sort_order === slice[idx - 1].sort_order + 1;
  });
  if (!contiguous) return null;

  const totalMinutes = slice.reduce((sum, s) => sum + s.duration_minutes, 0);
  if (totalMinutes < durationMinutes) return null;

  return slice.map((s) => s.id);
}
