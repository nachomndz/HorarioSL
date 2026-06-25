"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import { fetchSolverInput } from "@/lib/solver/fetch-input";
import { solveBestInWorker } from "@/lib/solver/runner";
import { validateSolverInput } from "@/lib/solver/validate";
import { downloadBlob, exportScheduleToExcel } from "@/lib/excel/export";
import type {
  Course,
  CourseSubjectHours,
  Schedule,
  ScheduleEntry,
  Subject,
  Teacher,
  TimeSlot,
} from "@/types";
import { getRelationName } from "@/lib/supabase/helpers";
import { TeacherScheduleGrid, ScheduleGrid } from "@/components/schedule-grid/schedule-grid";
import { EditableScheduleGrid } from "@/components/timetable/editable-schedule-grid";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params.id as string;

  const [isAdmin, setIsAdmin] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [courseSubjectHours, setCourseSubjectHours] = useState<CourseSubjectHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [scheduleId]);

  async function loadData() {
    if (isLocalMode()) {
      const ctx = localDb.getSchoolContext();
      if (!ctx) return;
      setIsAdmin(ctx.isAdmin);
      setSchoolName(ctx.school.name);

      const result = localDb.getSchedule(scheduleId);
      if (!result) {
        router.push("/dashboard/horarios");
        return;
      }

      const schoolData = localDb.getSchoolData(ctx.schoolId);
      const year = schoolData.academicYears.find(
        (y) => y.id === result.schedule.academic_year_id
      );

      setSchedule(result.schedule);
      setAcademicYear(year?.name ?? "");
      setEntries(result.entries);
      setTeachers(schoolData.teachers);
      setCourses(schoolData.courses);
      setSubjects(schoolData.subjects);
      setTimeSlots(schoolData.timeSlots);
      setCourseSubjectHours(schoolData.courseSubjectHours);
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
      .select("school_id, role, schools(name)")
      .eq("user_id", user.id)
      .single();
    if (!member) return;

    setIsAdmin(member.role === "admin");
    setSchoolName(getRelationName(member.schools as { name: string } | { name: string }[]));

    const { data: scheduleData } = await supabase
      .from("schedules")
      .select("*, academic_years(name)")
      .eq("id", scheduleId)
      .single();

    if (!scheduleData) {
      router.push("/dashboard/horarios");
      return;
    }

    setSchedule(scheduleData as Schedule);
    setAcademicYear(getRelationName(scheduleData.academic_years as { name: string } | { name: string }[]));

    const [
      { data: entriesData },
      { data: teachersData },
      { data: coursesData },
      { data: subjectsData },
      { data: slotsData },
    ] = await Promise.all([
      supabase.from("schedule_entries").select("*").eq("schedule_id", scheduleId),
      supabase.from("teachers").select("*").eq("school_id", member.school_id).order("name"),
      supabase.from("courses").select("*").eq("school_id", member.school_id).order("sort_order"),
      supabase.from("subjects").select("*").eq("school_id", member.school_id),
      supabase.from("time_slots").select("*").eq("school_id", member.school_id),
    ]);

    setEntries((entriesData as ScheduleEntry[]) ?? []);
    setTeachers((teachersData as Teacher[]) ?? []);
    setCourses((coursesData as Course[]) ?? []);
    setSubjects((subjectsData as Subject[]) ?? []);
    setTimeSlots((slotsData as TimeSlot[]) ?? []);
    setLoading(false);
  }

  async function handlePublish() {
    if (!schedule || !isAdmin) return;

    if (isLocalMode()) {
      localDb.updateSchedule(schedule.id, { status: "published" });
      toast.success("Horario publicado");
      loadData();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("schedules")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", schedule.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Horario publicado");
      loadData();
    }
  }

  async function handleRegenerate() {
    if (!schedule || !isAdmin) return;

    const input = await fetchSolverInput(schedule.school_id);
    if (!input) {
      toast.error("No se pudo cargar la configuración para regenerar");
      return;
    }

    const validation = validateSolverInput(input);
    if (validation.errors.length > 0) {
      toast.error(validation.errors.slice(0, 3).join(" · "));
      return;
    }

    const result = await solveBestInWorker(input);

    if (isLocalMode()) {
      localDb.updateSchedule(schedule.id, {
        generation_stats: result.stats,
        entries: result.entries,
      });
      if (result.stats.unplaced_sessions > 0) {
        toast.warning(
          `Regenerado con ${result.stats.unplaced_sessions} sesión(es) sin colocar`
        );
      } else {
        toast.success("Horario regenerado");
      }
      loadData();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("schedule_entries").delete().eq("schedule_id", schedule.id);

    if (result.entries.length > 0) {
      await supabase.from("schedule_entries").insert(
        result.entries.map((e) => ({
          schedule_id: schedule.id,
          teacher_id: e.teacherId,
          subject_id: e.subjectId,
          course_id: e.courseId,
          time_slot_id: e.timeSlotId,
        }))
      );
    }

    await supabase
      .from("schedules")
      .update({
        generation_stats: result.stats,
        updated_at: new Date().toISOString(),
      })
      .eq("id", schedule.id);

    if (result.stats.unplaced_sessions > 0) {
      toast.warning(
        `Regenerado con ${result.stats.unplaced_sessions} sesión(es) sin colocar`
      );
    } else {
      toast.success("Horario regenerado");
    }
    loadData();
  }

  async function handleExport() {
    if (!schedule) return;
    setExporting(true);
    try {
      const blob = await exportScheduleToExcel({
        schoolName,
        academicYear,
        scheduleName: schedule.name,
        teachers,
        courses,
        subjects,
        timeSlots,
        entries,
      });
      downloadBlob(blob, `horario-${schedule.name.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
      toast.success("Excel descargado");
    } catch {
      toast.error("Error al exportar");
    }
    setExporting(false);
  }

  async function handleMoveEntry(entryId: string, newTimeSlotId: string) {
    if (!schedule) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    if (isLocalMode()) {
      const result = localDb.moveScheduleEntry(schedule.id, entryId, newTimeSlotId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sesión movida");
      loadData();
      return;
    }

    const conflictTeacher = entries.some(
      (e) =>
        e.id !== entryId &&
        e.teacher_id === entry.teacher_id &&
        e.time_slot_id === newTimeSlotId
    );
    const conflictCourse = entries.some(
      (e) =>
        e.id !== entryId &&
        e.course_id === entry.course_id &&
        e.time_slot_id === newTimeSlotId
    );
    if (conflictTeacher) {
      toast.error("El profesor ya tiene clase en esa franja");
      return;
    }
    if (conflictCourse) {
      toast.error("El curso ya tiene clase en esa franja");
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("schedule_entries")
      .update({ time_slot_id: newTimeSlotId })
      .eq("id", entryId);
    if (error) toast.error(error.message);
    else {
      toast.success("Sesión movida");
      loadData();
    }
  }

  async function handleDuplicate() {
    if (!schedule) return;

    if (isLocalMode()) {
      const result = localDb.duplicateSchedule(schedule.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Horario duplicado");
      if (result.schedule) router.push(`/dashboard/horarios/${result.schedule.id}`);
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: copy, error } = await supabase
      .from("schedules")
      .insert({
        school_id: schedule.school_id,
        academic_year_id: schedule.academic_year_id,
        name: `${schedule.name} (copia)`,
        status: "draft",
        generation_stats: schedule.generation_stats,
      })
      .select()
      .single();
    if (error || !copy) {
      toast.error(error?.message ?? "Error al duplicar");
      return;
    }
    if (entries.length > 0) {
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
    router.push(`/dashboard/horarios/${copy.id}`);
  }

  async function handleDelete() {
    if (!schedule) return;

    if (isLocalMode()) {
      localDb.deleteSchedule(schedule.id);
      toast.success("Horario eliminado");
      router.push("/dashboard/horarios");
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.from("schedule_entries").delete().eq("schedule_id", schedule.id);
    const { error } = await supabase.from("schedules").delete().eq("id", schedule.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Horario eliminado");
      router.push("/dashboard/horarios");
    }
  }

  const unplacedSessions = (() => {
    const placed = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.course_id}:${e.subject_id}`;
      placed.set(key, (placed.get(key) ?? 0) + 1);
    }
    const missing: { course: Course; subject: Subject; count: number }[] = [];
    for (const h of courseSubjectHours) {
      if (h.weekly_hours <= 0) continue;
      const key = `${h.course_id}:${h.subject_id}`;
      const have = placed.get(key) ?? 0;
      const need = h.weekly_hours - have;
      if (need > 0) {
        const course = courses.find((c) => c.id === h.course_id);
        const subject = subjects.find((s) => s.id === h.subject_id);
        if (course && subject) missing.push({ course, subject, count: need });
      }
    }
    return missing;
  })();

  if (loading || !schedule) return <PageLoadingSkeleton />;

  const stats = schedule.generation_stats;
  const placedTeachers = new Set(entries.map((e) => e.teacher_id));

  return (
    <div className="space-y-6">
      <PageHeader title={schedule.name} description={`${academicYear} · ${new Date(schedule.created_at).toLocaleString("es-ES")}`}>
        <Badge variant={schedule.status === "published" ? "success" : "warning"}>
          {schedule.status === "published" ? "Publicado" : "Borrador"}
        </Badge>
        <Button variant="outline" onClick={() => router.push("/dashboard/horarios")}>
          Volver
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exportando..." : "Excel"}
        </Button>
        {isAdmin && (
          <>
            <Hint label="Arrastra sesiones entre franjas horarias">
              <Button variant="outline" onClick={() => setEditMode((v) => !v)}>
                {editMode ? "Ver solo" : "Editar"}
              </Button>
            </Hint>
            <Hint label="Crea una copia en borrador">
              <Button variant="outline" onClick={handleDuplicate}>
                Duplicar
              </Button>
            </Hint>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Eliminar
            </Button>
          </>
        )}
        {isAdmin && schedule.status !== "published" && (
          <Button onClick={handlePublish}>Publicar</Button>
        )}
        {isAdmin && (
          <Hint label="Vuelve a ejecutar el motor automático">
            <Button variant="secondary" onClick={handleRegenerate}>
              Regenerar
            </Button>
          </Hint>
        )}
      </PageHeader>

      {stats && stats.unplaced_sessions > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Horario incompleto
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              Faltan {stats.unplaced_sessions} de {stats.total_sessions} sesiones por colocar.
              Revisa profesores, disponibilidad y la matriz de horas, o ajusta manualmente.
            </p>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardContent className="flex flex-wrap gap-6 pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Sesiones colocadas</p>
              <p className="text-2xl font-bold">
                {stats.placed_sessions}/{stats.total_sessions}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sin colocar</p>
              <p className="text-2xl font-bold">{stats.unplaced_sessions}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profesores con horario</p>
              <p className="text-2xl font-bold">{placedTeachers.size}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tiempo generación</p>
              <p className="text-2xl font-bold">{stats.duration_ms}ms</p>
            </div>
          </CardContent>
        </Card>
      )}

      {unplacedSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sesiones sin colocar</CardTitle>
            <CardDescription>
              Diferencia entre horas configuradas en la matriz y sesiones en este horario.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unplacedSessions.map(({ course, subject, count }) => (
              <Badge key={`${course.id}-${subject.id}`} variant="outline">
                {count}× {subject.short_name || subject.name} · {course.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="teachers">
        <TabsList>
          <TabsTrigger value="teachers">Por profesor</TabsTrigger>
          <TabsTrigger value="courses">Por curso</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="space-y-6">
          {teachers.map((teacher) => (
            <Card key={teacher.id}>
              <CardHeader>
                <CardTitle className="text-base">{teacher.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode && isAdmin ? (
                  <EditableScheduleGrid
                    teacher={teacher}
                    timeSlots={timeSlots}
                    entries={entries}
                    subjects={subjects}
                    courses={courses}
                    onMove={handleMoveEntry}
                  />
                ) : (
                  <TeacherScheduleGrid
                    teacher={teacher}
                    timeSlots={timeSlots}
                    entries={entries}
                    subjects={subjects}
                    courses={courses}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <CardTitle className="text-base">{course.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleGrid
                  timeSlots={timeSlots}
                  entries={entries.filter((e) => e.course_id === course.id)}
                  subjects={subjects}
                  rowLabel={(e) =>
                    teachers.find((t) => t.id === e.teacher_id)?.name ?? ""
                  }
                  cellLabel={(e) => {
                    const subject = subjects.find((s) => s.id === e.subject_id);
                    return subject?.short_name || subject?.name || "";
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar horario"
        description="Esta acción no se puede deshacer."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  );
}
