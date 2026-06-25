"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import type {
  Course,
  Subject,
  Teacher,
  TeacherCourse,
  TeacherSubject,
  TeacherUnavailability,
  TimeSlot,
} from "@/types";
import { CYCLE_LABELS, CYCLE_ORDER } from "@/lib/utils";
import { AvailabilityGrid } from "@/components/schedule-grid/schedule-grid";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeacherEditPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;

  const [isAdmin, setIsAdmin] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [teacherId]);

  async function loadData() {
    if (isLocalMode()) {
      const ctx = localDb.getSchoolContext();
      if (!ctx) return;
      setIsAdmin(ctx.isAdmin);
      const schoolData = localDb.getSchoolData(ctx.schoolId);
      const teacherData = localDb.getTeacher(teacherId);
      if (!teacherData) {
        router.push("/dashboard/profesores");
        return;
      }
      setTeacher(teacherData.teacher);
      setSubjects(schoolData.subjects);
      setCourses(schoolData.courses);
      setTimeSlots(schoolData.timeSlots);
      setSelectedSubjects(new Set(teacherData.subjects.map((ts) => ts.subject_id)));
      setSelectedCourses(new Set(teacherData.courses.map((tc) => tc.course_id)));
      setBlockedSlots(new Set(teacherData.unavailability.map((u) => u.time_slot_id)));
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
    setIsAdmin(member.role === "admin");

    const [
      { data: teacherData },
      { data: subjectsData },
      { data: coursesData },
      { data: slotsData },
      { data: teacherSubjects },
      { data: teacherCourses },
      { data: unavailability },
    ] = await Promise.all([
      supabase.from("teachers").select("*").eq("id", teacherId).single(),
      supabase.from("subjects").select("*").eq("school_id", member.school_id),
      supabase.from("courses").select("*").eq("school_id", member.school_id).order("sort_order"),
      supabase.from("time_slots").select("*").eq("school_id", member.school_id),
      supabase.from("teacher_subjects").select("*").eq("teacher_id", teacherId),
      supabase.from("teacher_courses").select("*").eq("teacher_id", teacherId),
      supabase.from("teacher_unavailability").select("*").eq("teacher_id", teacherId),
    ]);

    if (!teacherData) {
      router.push("/dashboard/profesores");
      return;
    }

    setTeacher(teacherData as Teacher);
    setSubjects((subjectsData as Subject[]) ?? []);
    setCourses((coursesData as Course[]) ?? []);
    setTimeSlots((slotsData as TimeSlot[]) ?? []);
    setSelectedSubjects(
      new Set((teacherSubjects as TeacherSubject[])?.map((ts) => ts.subject_id) ?? [])
    );
    setSelectedCourses(
      new Set((teacherCourses as TeacherCourse[])?.map((tc) => tc.course_id) ?? [])
    );
    setBlockedSlots(
      new Set((unavailability as TeacherUnavailability[])?.map((u) => u.time_slot_id) ?? [])
    );
    setLoading(false);
  }

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCourse(id: string) {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBlocked(slotId: string) {
    if (!isAdmin) return;
    setBlockedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  async function handleSave() {
    if (!teacher || !isAdmin) return;
    setSaving(true);

    const payload = {
      name: teacher.name,
      max_weekly_hours: teacher.max_weekly_hours,
      notes: teacher.notes,
      scope_type: teacher.scope_type,
      scope_cycle: teacher.scope_cycle,
      subjectIds: Array.from(selectedSubjects),
      courseIds: Array.from(selectedCourses),
      blockedSlotIds: Array.from(blockedSlots),
    };

    if (isLocalMode()) {
      localDb.saveTeacher(teacher.id, payload);
      setSaving(false);
      toast.success("Profesor guardado");
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    const { error: teacherError } = await supabase
      .from("teachers")
      .update({
        name: teacher.name,
        max_weekly_hours: teacher.max_weekly_hours,
        notes: teacher.notes,
        scope_type: teacher.scope_type,
        scope_cycle: teacher.scope_type === "cycle" ? teacher.scope_cycle : null,
      })
      .eq("id", teacher.id);

    if (teacherError) {
      setSaving(false);
      toast.error(teacherError.message);
      return;
    }

    await supabase.from("teacher_subjects").delete().eq("teacher_id", teacher.id);
    if (selectedSubjects.size > 0) {
      await supabase.from("teacher_subjects").insert(
        Array.from(selectedSubjects).map((subject_id) => ({
          teacher_id: teacher.id,
          subject_id,
        }))
      );
    }

    await supabase.from("teacher_courses").delete().eq("teacher_id", teacher.id);
    if (teacher.scope_type === "courses" && selectedCourses.size > 0) {
      await supabase.from("teacher_courses").insert(
        Array.from(selectedCourses).map((course_id) => ({
          teacher_id: teacher.id,
          course_id,
        }))
      );
    }

    await supabase.from("teacher_unavailability").delete().eq("teacher_id", teacher.id);
    if (blockedSlots.size > 0) {
      await supabase.from("teacher_unavailability").insert(
        Array.from(blockedSlots).map((time_slot_id) => ({
          teacher_id: teacher.id,
          time_slot_id,
        }))
      );
    }

    setSaving(false);
    toast.success("Profesor guardado");
  }

  if (loading || !teacher) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={teacher.name}
        description="Configuración y restricciones del profesor."
      >
        <Button variant="outline" onClick={() => router.push("/dashboard/profesores")}>
          Volver
        </Button>
      </PageHeader>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Datos generales</TabsTrigger>
          <TabsTrigger value="subjects">Asignaturas</TabsTrigger>
          {teacher.scope_type === "courses" && (
            <TabsTrigger value="courses">Cursos</TabsTrigger>
          )}
          <TabsTrigger value="availability">Disponibilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={teacher.name}
                onChange={(e) => setTeacher({ ...teacher, name: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>Horas lectivas máximas / semana</Label>
              <Input
                type="number"
                min={1}
                max={40}
                value={teacher.max_weekly_hours}
                onChange={(e) =>
                  setTeacher({ ...teacher, max_weekly_hours: Number(e.target.value) })
                }
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={teacher.notes ?? ""}
                onChange={(e) => setTeacher({ ...teacher, notes: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>Ámbito de cursos</Label>
              <Select
                value={teacher.scope_type}
                onValueChange={(v: Teacher["scope_type"]) =>
                  setTeacher({ ...teacher, scope_type: v })
                }
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el colegio</SelectItem>
                  <SelectItem value="cycle">Solo un ciclo</SelectItem>
                  <SelectItem value="courses">Cursos concretos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {teacher.scope_type === "cycle" && (
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select
                  value={teacher.scope_cycle ?? "infantil"}
                  onValueChange={(v) =>
                    setTeacher({ ...teacher, scope_cycle: v as Teacher["scope_cycle"] })
                  }
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CYCLE_ORDER.map((cycle) => (
                      <SelectItem key={cycle} value={cycle}>
                        {CYCLE_LABELS[cycle]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Asignaturas</CardTitle>
            <CardDescription>Asignaturas que puede impartir.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {subjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedSubjects.has(subject.id)}
                  onCheckedChange={() => toggleSubject(subject.id)}
                  disabled={!isAdmin}
                />
                <span
                  className="inline-block h-3 w-3 rounded-full border"
                  style={{ backgroundColor: subject.color ?? "#94a3b8" }}
                />
                {subject.name}
              </label>
            ))}
          </CardContent>
        </Card>
        </TabsContent>

        {teacher.scope_type === "courses" && (
        <TabsContent value="courses" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Cursos permitidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {courses.map((course) => (
              <label key={course.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedCourses.has(course.id)}
                  onCheckedChange={() => toggleCourse(course.id)}
                  disabled={!isAdmin}
                />
                <span>
                  {course.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({CYCLE_LABELS[course.cycle]})
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
        </TabsContent>
        )}

        <TabsContent value="availability" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Disponibilidad</CardTitle>
          <CardDescription>
            Marca las franjas en las que el profesor NO está disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeSlots.length === 0 ? (
            <p className="text-muted-foreground">
              Primero configura la malla horaria en Configuración.
            </p>
          ) : (
            <AvailabilityGrid
              timeSlots={timeSlots}
              blockedSlotIds={blockedSlots}
              onToggle={toggleBlocked}
              readOnly={!isAdmin}
            />
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar profesor"}
        </Button>
      )}
    </div>
  );
}
