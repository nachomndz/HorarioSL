"use client";

import type { TimeSlot } from "@/types";
import { DAY_LABELS, formatTime } from "@/lib/utils";
import { getDaysFromSlots, getUniqueSlotTimes } from "@/lib/solver";
import { SectionHint } from "@/components/ui/section-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type WeeklyGridSlot = Pick<
  TimeSlot,
  "day_of_week" | "start_time" | "end_time" | "slot_type"
>;

interface WeeklyGridTableProps {
  slots: WeeklyGridSlot[];
  compact?: boolean;
  showLegend?: boolean;
  className?: string;
}

function GridLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-8 rounded border border-blue-200 bg-blue-50" />
        Sesión lectiva
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-8 rounded border border-slate-300 bg-slate-200" />
        Recreo
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-8 rounded border border-dashed border-slate-300 bg-white" />
        Sin clase
      </span>
    </div>
  );
}

export function WeeklyGridTable({
  slots,
  compact = false,
  showLegend = true,
  className,
}: WeeklyGridTableProps) {
  const days = getDaysFromSlots(slots as TimeSlot[]);
  const sessionTimes = getUniqueSlotTimes(slots as TimeSlot[]);
  const recessSlots = slots.filter((s) => s.slot_type === "recess");
  const allTimes = Array.from(
    new Set([...sessionTimes, ...recessSlots.map((s) => s.start_time)])
  ).sort();

  if (!days.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura los días y horarios para ver la rejilla.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative overflow-x-auto rounded-lg border shadow-sm [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] md:[mask-image:none]">
        <table
          className={cn(
            "w-full min-w-[480px] border-collapse",
            compact ? "text-xs" : "text-sm"
          )}
        >
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b bg-slate-800 px-2 py-2 text-left font-medium text-white md:px-3">
                <span className="inline-flex items-center gap-1">
                  Hora
                  <SectionHint
                    label="Inicio de cada franja de la jornada"
                    className="text-slate-300 hover:text-white"
                  />
                </span>
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className="border-b bg-slate-800 px-1 py-2 text-center font-medium text-white md:px-2"
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
            {allTimes.map((time) => (
              <tr key={time}>
                <td className="sticky left-0 z-10 border-b bg-slate-50 px-2 py-2 font-medium whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] md:px-3">
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
                    const range = `${formatTime(recess.start_time)} – ${formatTime(recess.end_time)}`;
                    return (
                      <td
                        key={day}
                        className="border-b bg-slate-200 px-1 py-2 text-center md:px-2"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-xs font-medium text-slate-600">
                              Recreo
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{DAY_LABELS[day]} {range}</TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  }
                  if (session) {
                    const range = `${formatTime(session.start_time)} – ${formatTime(session.end_time)}`;
                    return (
                      <td
                        key={day}
                        className="border-b bg-blue-50 px-1 py-2 text-center md:px-2"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-xs font-medium text-blue-800">
                              Sesión
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{DAY_LABELS[day]} {range}</TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={day}
                      className="border-b px-1 py-2 text-center text-muted-foreground md:px-2"
                    >
                      —
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showLegend && <GridLegend />}
    </div>
  );
}

/** @deprecated Use WeeklyGridTable */
export function WeeklyGridPreview({
  slots,
  compact = false,
}: {
  slots: WeeklyGridSlot[];
  compact?: boolean;
}) {
  return <WeeklyGridTable slots={slots} compact={compact} />;
}
