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
import {
  buildPrimariaTableRows,
  CurriculumMatrixTable,
} from "@/components/curriculum/curriculum-matrix-table";
import { Table, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CellKey = `${string}:${string}`;

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
    () =>
      cycle === "primaria"
        ? buildPrimariaTableRows(subjects)
        : subjects.map((s) => ({ type: "subject" as const, subject: s })),
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
        <CurriculumMatrixTable
          stages={stages}
          rows={tableRows}
          getCell={getCell}
          onCellChange={setCell}
          totalsByStage={totalsByStage}
          targetHours={targetHours}
          recessHours={recessHours}
          isAdmin={isAdmin}
          showPrimariaHints={cycle === "primaria"}
        />
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
