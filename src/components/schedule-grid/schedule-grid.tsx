"use client";

import type { ScheduleEntry, Subject, Teacher, TimeSlot } from "@/types";
import { DAY_LABELS, formatTime } from "@/lib/utils";
import { getDaysFromSlots, getUniqueSlotTimes } from "@/lib/solver";
import { cn } from "@/lib/utils";

interface ScheduleGridProps {
  timeSlots: TimeSlot[];
  entries: ScheduleEntry[];
  subjects: Subject[];
  rowLabel: (entry: ScheduleEntry) => string;
  cellLabel: (entry: ScheduleEntry) => string;
  title?: string;
  emptyLabel?: string;
}

export function ScheduleGrid({
  timeSlots,
  entries,
  subjects,
  rowLabel,
  cellLabel,
  title,
  emptyLabel = "—",
}: ScheduleGridProps) {
  const days = getDaysFromSlots(timeSlots);
  const times = getUniqueSlotTimes(timeSlots);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="overflow-x-auto">
      {title && <h3 className="mb-3 text-sm font-semibold">{title}</h3>}
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border bg-primary px-3 py-2 text-left font-medium text-primary-foreground">
              Hora
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="border bg-primary px-3 py-2 text-center font-medium text-primary-foreground"
              >
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time}>
              <td className="border bg-muted px-3 py-2 font-medium whitespace-nowrap">
                {formatTime(time)}
              </td>
              {days.map((day) => {
                const slot = timeSlots.find(
                  (s) => s.day_of_week === day && s.start_time === time
                );
                if (!slot) {
                  return (
                    <td key={day} className="border px-2 py-2 text-center text-muted-foreground">
                      {emptyLabel}
                    </td>
                  );
                }
                if (slot.slot_type === "recess") {
                  return (
                    <td
                      key={day}
                      className="border bg-slate-100 px-2 py-2 text-center text-xs font-medium text-slate-500"
                    >
                      RECREO
                    </td>
                  );
                }
                const entry = entries.find((e) => e.time_slot_id === slot.id);
                if (!entry) {
                  return (
                    <td key={day} className="border px-2 py-2 text-center text-muted-foreground">
                      {emptyLabel}
                    </td>
                  );
                }
                const subject = subjectMap.get(entry.subject_id);
                return (
                  <td
                    key={day}
                    className="border px-2 py-2 text-center"
                    style={{
                      backgroundColor: subject?.color ? `${subject.color}18` : undefined,
                    }}
                  >
                    <div className="font-medium">{cellLabel(entry)}</div>
                    <div className="text-xs text-muted-foreground">{rowLabel(entry)}</div>
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

interface TeacherScheduleGridProps {
  teacher: Teacher;
  timeSlots: TimeSlot[];
  entries: ScheduleEntry[];
  subjects: Subject[];
  courses: { id: string; name: string }[];
}

export function TeacherScheduleGrid({
  teacher,
  timeSlots,
  entries,
  subjects,
  courses,
}: TeacherScheduleGridProps) {
  const teacherEntries = entries.filter((e) => e.teacher_id === teacher.id);
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return (
    <ScheduleGrid
      title={teacher.name}
      timeSlots={timeSlots}
      entries={teacherEntries}
      subjects={subjects}
      rowLabel={(e) => courseMap.get(e.course_id)?.name ?? ""}
      cellLabel={(e) => {
        const subject = subjects.find((s) => s.id === e.subject_id);
        return subject?.short_name || subject?.name || "";
      }}
    />
  );
}

interface AvailabilityGridProps {
  timeSlots: TimeSlot[];
  blockedSlotIds: Set<string>;
  onToggle: (slotId: string) => void;
  readOnly?: boolean;
}

export function AvailabilityGrid({
  timeSlots,
  blockedSlotIds,
  onToggle,
  readOnly = false,
}: AvailabilityGridProps) {
  const days = getDaysFromSlots(timeSlots);
  const times = getUniqueSlotTimes(timeSlots);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border bg-muted px-3 py-2 text-left">Hora</th>
            {days.map((day) => (
              <th key={day} className="border bg-muted px-3 py-2 text-center">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time) => (
            <tr key={time}>
              <td className="border px-3 py-2 font-medium">{formatTime(time)}</td>
              {days.map((day) => {
                const slot = timeSlots.find(
                  (s) =>
                    s.day_of_week === day &&
                    s.start_time === time &&
                    s.slot_type === "session"
                );
                if (!slot) {
                  return (
                    <td key={day} className="border bg-slate-50 px-2 py-2 text-center text-xs text-slate-400">
                      —
                    </td>
                  );
                }
                const blocked = blockedSlotIds.has(slot.id);
                return (
                  <td key={day} className="border p-1 text-center">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onToggle(slot.id)}
                      className={cn(
                        "h-10 w-full rounded-md text-xs font-medium transition-colors",
                        blocked
                          ? "bg-red-100 text-red-700"
                          : "bg-green-50 text-green-700 hover:bg-green-100",
                        readOnly && "cursor-default opacity-80"
                      )}
                    >
                      {blocked ? "No disp." : "Disp."}
                    </button>
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
