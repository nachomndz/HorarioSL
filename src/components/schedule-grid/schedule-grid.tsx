"use client";

import type { ScheduleEntry, Subject, Teacher, TimeSlot } from "@/types";
import { DAY_LABELS, formatTime } from "@/lib/utils";
import { getDaysFromSlots, getUniqueSlotTimes } from "@/lib/solver";
import { cn } from "@/lib/utils";
import { SectionHint } from "@/components/ui/section-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function AvailabilityLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-6 rounded border border-green-200 bg-green-50" />
        Disponible
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-6 rounded border border-red-200 bg-red-100" />
        No disponible
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-6 rounded border bg-slate-100" />
        Fuera de sesión
      </span>
    </div>
  );
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <AvailabilityLegend />
        <SectionHint label="Marca en rojo las franjas en las que NO puede dar clase (reuniones, reducción, otro centro)." />
      </div>

      <div className="relative overflow-x-auto rounded-lg border shadow-sm">
        <table className="w-full min-w-[520px] border-collapse text-xs md:text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b bg-slate-800 px-2 py-2 text-left font-medium text-white md:px-3">
                <span className="inline-flex items-center gap-1">
                  Hora
                  <SectionHint label="Inicio de cada franja lectiva" className="text-slate-300 hover:text-white" />
                </span>
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className="border-b bg-slate-100 px-1 py-2 text-center font-medium md:px-2"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">{DAY_LABELS[day]?.slice(0, 3)}</span>
                    </TooltipTrigger>
                    <TooltipContent>{DAY_LABELS[day]}</TooltipContent>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <td className="sticky left-0 z-10 border-b bg-slate-50 px-2 py-2 font-medium whitespace-nowrap md:px-3">
                  {formatTime(time)}
                </td>
                {days.map((day) => {
                  const slot = timeSlots.find(
                    (s) =>
                      s.day_of_week === day &&
                      s.start_time === time &&
                      s.slot_type === "session"
                  );
                  if (!slot) {
                    return (
                      <td
                        key={day}
                        className="border-b bg-slate-50/80 px-1 py-1 text-center text-slate-400 md:px-2"
                      >
                        —
                      </td>
                    );
                  }
                  const blocked = blockedSlotIds.has(slot.id);
                  const range = `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`;
                  return (
                    <td key={day} className="border-b p-0.5 md:p-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => onToggle(slot.id)}
                            className={cn(
                              "flex min-h-11 w-full items-center justify-center rounded-md text-xs font-semibold transition-colors md:min-h-10",
                              blocked
                                ? "bg-red-100 text-red-800 hover:bg-red-200"
                                : "bg-green-50 text-green-800 hover:bg-green-100",
                              readOnly && "cursor-default opacity-80"
                            )}
                            aria-label={`${DAY_LABELS[day]} ${range}: ${blocked ? "no disponible" : "disponible"}`}
                          >
                            {blocked ? "No" : "Sí"}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {DAY_LABELS[day]} {range}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Basado en la malla del centro. Si cambias los horarios después, revisa estas marcas.
      </p>
    </div>
  );
}
