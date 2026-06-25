"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import { fetchSolverInput } from "@/lib/solver/fetch-input";
import { solveInWorker } from "@/lib/solver/runner";
import type { AcademicYear, Schedule } from "@/types";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

export default function SchedulesPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [scheduleName, setScheduleName] = useState("Horario principal");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (isLocalMode()) {
      const ctx = localDb.getSchoolContext();
      if (!ctx) return;
      setSchoolId(ctx.schoolId);
      setIsAdmin(ctx.isAdmin);
      const data = localDb.getSchoolData(ctx.schoolId);
      setSchedules(data.schedules);
      setActiveYear(data.academicYears.find((y) => y.is_active) ?? null);
      setLoading(false);
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("school_members")
      .select("school_id, role")
      .eq("user_id", user.id)
      .single();
    if (!member) return;

    setSchoolId(member.school_id);
    setIsAdmin(member.role === "admin");

    const [{ data: schedulesData }, { data: year }] = await Promise.all([
      supabase
        .from("schedules")
        .select("*")
        .eq("school_id", member.school_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("academic_years")
        .select("*")
        .eq("school_id", member.school_id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    setSchedules((schedulesData as Schedule[]) ?? []);
    setActiveYear(year as AcademicYear | null);
    setLoading(false);
  }

  async function handleGenerate() {
    if (!schoolId || !activeYear || !isAdmin) return;
    setGenerating(true);
    setProgress(0);

    const input = await fetchSolverInput(schoolId);
    if (!input) {
      setGenerating(false);
      toast.error("Revisa cursos, asignaturas, profesores, horas y malla horaria");
      return;
    }

    const result = await solveInWorker(input, (placed, total) =>
      setProgress(Math.round((placed / total) * 100))
    );

    if (isLocalMode()) {
      const schedule = localDb.createSchedule(
        schoolId,
        activeYear.id,
        scheduleName,
        result.entries,
        result.stats
      );
      setGenerating(false);
      const pct = Math.round(
        (result.stats.placed_sessions / result.stats.total_sessions) * 100
      );
      toast.success(
        `Horario generado: ${result.stats.placed_sessions}/${result.stats.total_sessions} sesiones (${pct}%)`
      );
      router.push(`/dashboard/horarios/${schedule.id}`);
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .insert({
        school_id: schoolId,
        academic_year_id: activeYear.id,
        name: scheduleName,
        status: "draft",
        generation_stats: result.stats,
      })
      .select()
      .single();

    if (scheduleError || !schedule) {
      setGenerating(false);
      toast.error(scheduleError?.message ?? "Error al guardar horario");
      return;
    }

    if (result.entries.length > 0) {
      const { error: entriesError } = await supabase.from("schedule_entries").insert(
        result.entries.map((e) => ({
          schedule_id: schedule.id,
          teacher_id: e.teacherId,
          subject_id: e.subjectId,
          course_id: e.courseId,
          time_slot_id: e.timeSlotId,
        }))
      );
      if (entriesError) {
        setGenerating(false);
        toast.error(entriesError.message);
        return;
      }
    }

    setGenerating(false);
    const pct = Math.round(
      (result.stats.placed_sessions / result.stats.total_sessions) * 100
    );
    toast.success(
      `Horario generado: ${result.stats.placed_sessions}/${result.stats.total_sessions} sesiones (${pct}%)`
    );
    router.push(`/dashboard/horarios/${schedule.id}`);
  }

  async function duplicateSchedule(id: string) {
    if (isLocalMode()) {
      const result = localDb.duplicateSchedule(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Horario duplicado");
        loadData();
      }
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const original = schedules.find((s) => s.id === id);
    if (!original) return;
    const { data: entries } = await supabase
      .from("schedule_entries")
      .select("*")
      .eq("schedule_id", id);
    const { data: copy, error } = await supabase
      .from("schedules")
      .insert({
        school_id: original.school_id,
        academic_year_id: original.academic_year_id,
        name: `${original.name} (copia)`,
        status: "draft",
        generation_stats: original.generation_stats,
      })
      .select()
      .single();
    if (error || !copy) {
      toast.error(error?.message ?? "Error al duplicar");
      return;
    }
    if (entries?.length) {
      await supabase.from("schedule_entries").insert(
        entries.map((e) => ({
          schedule_id: copy.id,
          teacher_id: e.teacher_id,
          subject_id: e.subject_id,
          course_id: e.course_id,
          time_slot_id: e.time_slot_id,
        }))
      );
    }
    toast.success("Horario duplicado");
    loadData();
  }

  async function deleteSchedule(id: string) {
    if (isLocalMode()) {
      localDb.deleteSchedule(id);
      toast.success("Horario eliminado");
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("schedule_entries").delete().eq("schedule_id", id);
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Horario eliminado");
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    }
  }

  if (loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horarios"
        description={`Genera y gestiona los horarios del curso ${activeYear?.name ?? "—"}.`}
      />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Generar nuevo horario</CardTitle>
            <CardDescription>
              El motor intentará colocar todas las sesiones respetando las restricciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder="Nombre del horario"
            />
            <Button onClick={handleGenerate} disabled={generating || !activeYear}>
              {generating ? `Generando... ${progress}%` : "Generar horario"}
            </Button>
            {generating && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Horarios guardados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {schedules.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin horarios"
              description="Genera el primer horario cuando tengas cursos, asignaturas y profesores configurados."
            />
          ) : (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{schedule.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(schedule.created_at).toLocaleString("es-ES")}
                    {schedule.generation_stats && (
                      <>
                        {" "}
                        · {schedule.generation_stats.placed_sessions}/
                        {schedule.generation_stats.total_sessions} sesiones
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={schedule.status === "published" ? "success" : "warning"}>
                    {schedule.status === "published" ? "Publicado" : "Borrador"}
                  </Badge>
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateSchedule(schedule.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  <Button asChild size="sm">
                    <Link href={`/dashboard/horarios/${schedule.id}`}>Ver</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Eliminar horario"
        description="Esta acción no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => deleteId && deleteSchedule(deleteId)}
      />
    </div>
  );
}
