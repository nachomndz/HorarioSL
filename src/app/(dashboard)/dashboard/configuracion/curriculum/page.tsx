"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  applyCurriculumToStage,
  fetchCurriculumMatrix,
  loadPrimariaAnexoTemplate,
  upsertCurriculumRequirement,
} from "@/lib/data/school-repository";
import {
  PRIMARIA_ANEXO_IV_META,
  totalLectiveHoursByStage,
} from "@/lib/curriculum";
import {
  ELECTIVE_GROUP_BY_KEY,
  PRIMARIA_ANEXO_IV,
  type PrimariaElectiveChoices,
} from "@/lib/curriculum/templates";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { CurriculumRequirement, Cycle, Subject } from "@/types";
import { CYCLE_LABELS, CYCLE_ORDER } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfigGuide } from "@/components/layout/config-guide";
import { NextStepBanner } from "@/components/layout/next-step-banner";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHint } from "@/components/ui/section-hint";
import { LoadAnexoDialog } from "@/components/curriculum/load-anexo-dialog";
import { Table, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CellKey = `${string}:${string}`;

type TableRow =
  | { type: "header"; label: string }
  | { type: "subject"; subject: Subject };

function buildPrimariaRows(subjects: Subject[]): TableRow[] {
  const byName = new Map(subjects.map((s) => [s.name, s]));
  const used = new Set<string>();
  const rows: TableRow[] = [];
  let lastElectiveGroup: string | undefined;

  for (const template of PRIMARIA_ANEXO_IV) {
    const subject = byName.get(template.subjectName);
    if (!subject) continue;
    used.add(subject.id);

    if (template.electiveGroup && template.electiveGroup !== lastElectiveGroup) {
      rows.push({ type: "header", label: "Elegir una" });
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

function electiveGroupIdForSubject(subject: Subject): string | null {
  const template = PRIMARIA_ANEXO_IV.find((t) => t.subjectName === subject.name);
  if (!template?.electiveGroup) return null;
  return ELECTIVE_GROUP_BY_KEY[template.electiveGroup];
}

export default function CurriculumPage() {
  const { context, loading: ctxLoading } = useSchoolContext();
  const [cycle, setCycle] = useState<Cycle>("primaria");
  const [stages, setStages] = useState<Awaited<ReturnType<typeof fetchCurriculumMatrix>>["stages"]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [requirements, setRequirements] = useState<CurriculumRequirement[]>([]);
  const [cells, setCells] = useState<Record<CellKey, { hours: string; duration: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [addSubjectId, setAddSubjectId] = useState("");

  const schoolId = context?.schoolId ?? null;
  const isAdmin = context?.isAdmin ?? false;

  async function load() {
    if (!context) return;
    if (isLocalMode()) {
      const data = localDb.getSchoolData(context.schoolId);
      const stageList = localDb.getFormativeStages(context.schoolId, cycle);
      const subjectList = data.subjects.filter(
        (s) => !s.applicable_cycles?.length || s.applicable_cycles.includes(cycle)
      );
      const reqs = data.curriculumRequirements.filter((r) =>
        stageList.some((s) => s.id === r.formative_stage_id)
      );
      setStages(stageList);
      setSubjects(subjectList);
      setAllSubjects(data.subjects);
      setRequirements(reqs);
      const next: Record<CellKey, { hours: string; duration: string }> = {};
      for (const r of reqs) {
        const key = `${r.formative_stage_id}:${r.subject_id}` as CellKey;
        next[key] = {
          hours: String(r.mandatory_weekly_hours),
          duration: String(r.session_duration_minutes),
        };
      }
      setCells(next);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchCurriculumMatrix(context.schoolId, cycle);
      const supabase = await import("@/lib/supabase/client").then((m) => m.createClient());
      const { data: all } = await supabase
        .from("subjects")
        .select("*")
        .eq("school_id", context.schoolId)
        .order("name");
      setStages(data.stages);
      setSubjects(data.subjects);
      setAllSubjects((all as Subject[]) ?? data.subjects);
      setRequirements(data.requirements);
      const next: Record<CellKey, { hours: string; duration: string }> = {};
      for (const r of data.requirements) {
        const key = `${r.formative_stage_id}:${r.subject_id}` as CellKey;
        next[key] = {
          hours: String(r.mandatory_weekly_hours),
          duration: String(r.session_duration_minutes),
        };
      }
      setCells(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar currículo");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!context) return;
    setLoading(true);
    load();
  }, [context, cycle]);

  function getCell(stageId: string, subjectId: string) {
    const key = `${stageId}:${subjectId}` as CellKey;
    return cells[key] ?? { hours: "", duration: "45" };
  }

  function setCell(stageId: string, subjectId: string, field: "hours" | "duration", value: string) {
    const key = `${stageId}:${subjectId}` as CellKey;
    setCells((prev) => ({
      ...prev,
      [key]: { ...getCell(stageId, subjectId), [field]: value },
    }));
  }

  const tableRows = useMemo(
    () => (cycle === "primaria" ? buildPrimariaRows(subjects) : subjects.map((s) => ({ type: "subject" as const, subject: s }))),
    [cycle, subjects]
  );

  const computedRequirements = useMemo((): CurriculumRequirement[] => {
    const reqs: CurriculumRequirement[] = [];
    for (const stage of stages) {
      for (const subject of subjects) {
        const cell = getCell(stage.id, subject.id);
        const hours = Number(cell.hours);
        if (Number.isNaN(hours)) continue;
        reqs.push({
          id: "",
          formative_stage_id: stage.id,
          subject_id: subject.id,
          mandatory_weekly_hours: hours,
          session_duration_minutes: Number(cell.duration) || 45,
          elective_group_id: electiveGroupIdForSubject(subject),
        });
      }
    }
    return reqs;
  }, [stages, subjects, cells]);

  const totalsByStage = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const stage of stages) {
      totals[stage.id] = totalLectiveHoursByStage(computedRequirements, stage.id);
    }
    return totals;
  }, [stages, computedRequirements]);

  const subjectsNotInTable = useMemo(
    () =>
      allSubjects.filter(
        (s) =>
          (!s.applicable_cycles?.length || s.applicable_cycles.includes(cycle)) &&
          !subjects.some((x) => x.id === s.id)
      ),
    [allSubjects, subjects, cycle]
  );

  async function saveAll() {
    if (!schoolId) return;
    setSaving(true);
    for (const stage of stages) {
      for (const subject of subjects) {
        const cell = getCell(stage.id, subject.id);
        const hours = Number(cell.hours);
        const duration = Number(cell.duration) || 45;
        if (Number.isNaN(hours) || hours < 0) continue;
        const electiveGroupId = electiveGroupIdForSubject(subject);
        if (isLocalMode()) {
          localDb.upsertCurriculumRequirement(stage.id, subject.id, hours, duration, electiveGroupId);
        } else {
          const { error } = await upsertCurriculumRequirement(stage.id, subject.id, {
            mandatory_weekly_hours: hours,
            session_duration_minutes: duration,
            elective_group_id: electiveGroupId,
          });
          if (error) {
            toast.error(error);
            setSaving(false);
            return;
          }
        }
      }
    }
    setSaving(false);
    toast.success("Currículo guardado");
    await load();
  }

  async function handleRestore(choices: PrimariaElectiveChoices) {
    if (!schoolId) return;
    setRestoring(true);
    if (isLocalMode()) {
      const { error } = localDb.loadPrimariaAnexoTemplate(schoolId, choices);
      if (error) toast.error(error);
      else {
        toast.success("Plantilla Anexo IV restaurada");
        setRestoreOpen(false);
        await load();
      }
    } else {
      const { error } = await loadPrimariaAnexoTemplate(schoolId, choices);
      if (error) toast.error(error);
      else {
        toast.success("Plantilla Anexo IV restaurada");
        setRestoreOpen(false);
        await load();
      }
    }
    setRestoring(false);
  }

  function addSubjectToTable() {
    const subject = allSubjects.find((s) => s.id === addSubjectId);
    if (!subject) return;
    if (subjects.some((s) => s.id === subject.id)) return;
    setSubjects((prev) => [...prev, subject].sort((a, b) => a.name.localeCompare(b.name, "es")));
    setAddSubjectId("");
    toast.success(`${subject.name} añadida a la tabla`);
  }

  if (ctxLoading || loading) return <PageLoadingSkeleton />;

  const targetHours = cycle === "primaria" ? PRIMARIA_ANEXO_IV_META.targetLectiveHoursPerWeek : null;
  const recessHours = cycle === "primaria" ? PRIMARIA_ANEXO_IV_META.recessHoursPerWeek : null;

  return (
    <div className="space-y-6">
      <ConfigGuide />

      <PageHeader
        title="Currículo obligatorio"
        description="Horas lectivas semanales y duración de cada clase por asignatura y subciclo."
      >
        {isAdmin && cycle === "primaria" && (
          <Button
            data-tour="curriculum-template"
            variant="outline"
            onClick={() => setRestoreOpen(true)}
          >
            Restaurar Anexo IV
          </Button>
        )}
        {isAdmin && (
          <Button onClick={saveAll} disabled={saving}>
            {saving ? "Guardando..." : "Guardar currículo"}
          </Button>
        )}
      </PageHeader>

      {cycle === "primaria" && (
        <SectionHint label={PRIMARIA_ANEXO_IV_META.footnote} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Etapa
            <SectionHint label="Horas obligatorias por ley (Anexo IV) y duración de cada clase. La duración puede variar por asignatura." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={cycle} onValueChange={(v: Cycle) => setCycle(v)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CYCLE_ORDER.map((c) => (
                <SelectItem key={c} value={c}>
                  {CYCLE_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {stages.length === 0 ? (
        <EmptyState
          icon={Table}
          title="Sin subciclos"
          description="Primero define los subciclos de cada etapa para poder cargar el currículo obligatorio."
          actionHref="/dashboard/configuracion/etapas"
          actionLabel="Ir a Subciclos"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b bg-slate-800 px-3 py-2 text-left text-white">
                  Asignatura
                </th>
                {stages.map((stage) => (
                  <th key={stage.id} className="border-b bg-slate-100 px-2 py-2 text-center text-xs">
                    <div className="font-semibold">{stage.name}</div>
                    <div className="text-muted-foreground">h / duración</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                if (row.type === "header") {
                  return (
                    <tr key={`header-${i}`} className="bg-amber-50/80">
                      <td
                        colSpan={stages.length + 1}
                        className="border-b px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-amber-900"
                      >
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                const { subject } = row;
                return (
                  <tr key={subject.id} className="hover:bg-muted/50">
                    <td className="sticky left-0 z-10 border-b bg-card px-3 py-2 font-medium">
                      {subject.short_name || subject.name}
                    </td>
                    {stages.map((stage) => {
                      const cell = getCell(stage.id, subject.id);
                      return (
                        <td key={stage.id} className="border-b p-1">
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              min={0}
                              className="h-8 w-14 text-center"
                              value={cell.hours}
                              onChange={(e) =>
                                setCell(stage.id, subject.id, "hours", e.target.value)
                              }
                              disabled={!isAdmin}
                              placeholder="0"
                            />
                            <Input
                              type="number"
                              min={15}
                              step={15}
                              className="h-8 w-14 text-center"
                              value={cell.duration}
                              onChange={(e) =>
                                setCell(stage.id, subject.id, "duration", e.target.value)
                              }
                              disabled={!isAdmin}
                              title="Duración clase (min)"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="bg-muted/40 font-semibold">
                <td className="sticky left-0 border-b bg-muted/40 px-3 py-2">Total horas lectivas</td>
                {stages.map((stage) => {
                  const total = totalsByStage[stage.id] ?? 0;
                  const ok = targetHours == null || Math.abs(total - targetHours) < 0.01;
                  return (
                    <td
                      key={stage.id}
                      className={`border-b px-2 py-2 text-center ${targetHours != null ? (ok ? "text-green-700" : "text-amber-700") : ""}`}
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
                  <tr className="bg-muted/20 text-muted-foreground">
                    <td className="sticky left-0 border-b bg-muted/20 px-3 py-2">Recreo (referencia)</td>
                    {stages.map((stage) => (
                      <td key={stage.id} className="border-b px-2 py-2 text-center">
                        {recessHours}h
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/30 font-medium">
                    <td className="sticky left-0 border-b bg-muted/30 px-3 py-2">
                      Total jornada (referencia)
                    </td>
                    {stages.map((stage) => (
                      <td key={stage.id} className="border-b px-2 py-2 text-center">
                        {(totalsByStage[stage.id] ?? 0) + recessHours}h
                      </td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && stages.length > 0 && subjectsNotInTable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Añadir asignatura a la tabla
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Select value={addSubjectId} onValueChange={setAddSubjectId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Seleccionar asignatura..." />
              </SelectTrigger>
              <SelectContent>
                {subjectsNotInTable.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addSubjectToTable} disabled={!addSubjectId}>
              Añadir fila
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && stages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stages.map((stage) => (
            <Button
              key={stage.id}
              variant="outline"
              onClick={async () => {
                if (isLocalMode()) localDb.applyCurriculumToStage(stage.id);
                else {
                  const { error } = await applyCurriculumToStage(stage.id);
                  if (error) {
                    toast.error(error);
                    return;
                  }
                }
                toast.success(`Currículo aplicado a cursos de ${stage.name}`);
              }}
            >
              Aplicar a cursos: {stage.name}
            </Button>
          ))}
        </div>
      )}

      {requirements.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Celdas con datos guardados: {requirements.filter((r) => Number(r.mandatory_weekly_hours) > 0).length}
        </p>
      )}

      <LoadAnexoDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        onConfirm={handleRestore}
        loading={restoring}
      />

      <NextStepBanner />
    </div>
  );
}
