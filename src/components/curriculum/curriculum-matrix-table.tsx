"use client";

import type { FormativeStage, Subject } from "@/types";
import { PRIMARIA_ANEXO_IV } from "@/lib/curriculum/templates";
import { SectionHint } from "@/components/ui/section-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CurriculumTableRow =
  | { type: "header"; label: string; hint?: string }
  | { type: "subject"; subject: Subject };

type CellValue = { hours: string; duration: string };

interface CurriculumMatrixTableProps {
  stages: FormativeStage[];
  rows: CurriculumTableRow[];
  getCell: (stageId: string, subjectId: string) => CellValue;
  onCellChange: (
    stageId: string,
    subjectId: string,
    field: "hours" | "duration",
    value: string
  ) => void;
  totalsByStage: Record<string, number>;
  targetHours?: number | null;
  recessHours?: number | null;
  isAdmin?: boolean;
  showPrimariaHints?: boolean;
}

function subjectFullName(subject: Subject): string {
  const template = PRIMARIA_ANEXO_IV.find((t) => t.subjectName === subject.name);
  return template?.subjectName ?? subject.name;
}

export function CurriculumMatrixTable({
  stages,
  rows,
  getCell,
  onCellChange,
  totalsByStage,
  targetHours = null,
  recessHours = null,
  isAdmin = false,
  showPrimariaHints = false,
}: CurriculumMatrixTableProps) {
  return (
    <div className="space-y-2">
      {showPrimariaHints && (
        <p className="text-xs text-muted-foreground md:text-sm">
          Horas lectivas semanales por subciclo. En grupos «Elegir una», solo cuenta una opción
          activa por grupo al calcular el total.
          <SectionHint
            label="Las horas obligatorias vienen del Anexo IV de Primaria. La duración (min) es la longitud de cada sesión de esa asignatura."
            className="ml-1 inline-flex align-middle"
          />
        </p>
      )}

      <div className="relative overflow-x-auto rounded-lg border shadow-sm [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] md:[mask-image:none]">
        <table className="w-full min-w-[640px] border-collapse text-xs md:min-w-[900px] md:text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b bg-slate-800 px-2 py-2 text-left text-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] md:px-3">
                Asignatura
              </th>
              {stages.map((stage) => (
                <th
                  key={stage.id}
                  className="border-b bg-slate-100 px-1 py-2 text-center md:px-2"
                >
                  <div className="font-semibold leading-tight">{stage.name}</div>
                  <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground md:text-xs">
                    Horas / min
                    {showPrimariaHints && (
                      <SectionHint label="Horas semanales obligatorias y duración de cada clase en minutos" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.type === "header") {
                return (
                  <tr key={`header-${i}`} className="bg-amber-50/90">
                    <td
                      colSpan={stages.length + 1}
                      className="border-b px-2 py-2 text-center md:px-3"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                        {row.label}
                      </span>
                      {row.hint && (
                        <span className="ml-1 inline-flex align-middle">
                          <SectionHint label={row.hint} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }

              const { subject } = row;
              const label = subject.short_name || subject.name;
              const fullName = subjectFullName(subject);

              return (
                <tr key={subject.id} className="hover:bg-muted/40">
                  <td className="sticky left-0 z-10 border-b bg-card px-2 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] md:px-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{label}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{fullName}</TooltipContent>
                    </Tooltip>
                  </td>
                  {stages.map((stage) => {
                    const cell = getCell(stage.id, subject.id);
                    return (
                      <td key={stage.id} className="border-b p-0.5 md:p-1">
                        <div className="flex items-center justify-center gap-0.5 md:gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            className="h-8 w-12 text-center md:w-14"
                            value={cell.hours}
                            onChange={(e) =>
                              onCellChange(stage.id, subject.id, "hours", e.target.value)
                            }
                            disabled={!isAdmin}
                            placeholder="0"
                            aria-label={`Horas ${fullName} ${stage.name}`}
                          />
                          <span className="text-muted-foreground">|</span>
                          <Input
                            type="number"
                            min={15}
                            step={15}
                            className="h-8 w-12 text-center md:w-14"
                            value={cell.duration}
                            onChange={(e) =>
                              onCellChange(stage.id, subject.id, "duration", e.target.value)
                            }
                            disabled={!isAdmin}
                            aria-label={`Duración minutos ${fullName} ${stage.name}`}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            <tr className="bg-muted/50 font-semibold">
              <td className="sticky left-0 border-b bg-muted/50 px-2 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] md:px-3">
                <span className="inline-flex items-center gap-1">
                  Total horas lectivas
                  {targetHours != null && (
                    <SectionHint label="Suma de horas obligatorias. En electivos solo se cuenta una opción por grupo." />
                  )}
                </span>
              </td>
              {stages.map((stage) => {
                const total = totalsByStage[stage.id] ?? 0;
                const ok = targetHours == null || Math.abs(total - targetHours) < 0.01;
                return (
                  <td
                    key={stage.id}
                    className={cn(
                      "border-b px-1 py-2 text-center md:px-2",
                      targetHours != null && (ok ? "text-green-700" : "text-amber-700")
                    )}
                  >
                    {total}h
                    {targetHours != null && (
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        obj. {targetHours}h
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            {recessHours != null && (
              <>
                <tr className="bg-muted/25 text-muted-foreground">
                  <td className="sticky left-0 border-b bg-muted/25 px-2 py-2 md:px-3">
                    Recreo (referencia)
                  </td>
                  {stages.map((stage) => (
                    <td key={stage.id} className="border-b px-1 py-2 text-center md:px-2">
                      {recessHours}h
                    </td>
                  ))}
                </tr>
                <tr className="bg-muted/35 font-medium">
                  <td className="sticky left-0 border-b bg-muted/35 px-2 py-2 md:px-3">
                    Total jornada (referencia)
                  </td>
                  {stages.map((stage) => (
                    <td key={stage.id} className="border-b px-1 py-2 text-center md:px-2">
                      {(totalsByStage[stage.id] ?? 0) + recessHours}h
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function buildPrimariaTableRows(subjects: Subject[]): CurriculumTableRow[] {
  const byName = new Map(subjects.map((s) => [s.name, s]));
  const used = new Set<string>();
  const rows: CurriculumTableRow[] = [];
  let lastElectiveGroup: string | undefined;

  for (const template of PRIMARIA_ANEXO_IV) {
    const subject = byName.get(template.subjectName);
    if (!subject) continue;
    used.add(subject.id);

    if (template.electiveGroup && template.electiveGroup !== lastElectiveGroup) {
      rows.push({
        type: "header",
        label: "Elegir una",
        hint: "Solo una asignatura de este grupo debe tener horas > 0. Los padres eligen al inicio de curso.",
      });
      lastElectiveGroup = template.electiveGroup;
    }
    rows.push({ type: "subject", subject });
  }

  const extras = subjects
    .filter((s) => !used.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  for (const subject of extras) {
    rows.push({ type: "subject", subject });
  }

  return rows;
}
