"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, BookOpen, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  addSubject as addSubjectRepo,
  deleteSubject as deleteSubjectRepo,
  fetchSubjectsData,
  seedDefaultHours as seedDefaultHoursRepo,
  updateSubject as updateSubjectRepo,
  upsertCourseSubjectHours,
} from "@/lib/data/school-repository";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { Course, CourseSubjectHours, Cycle, Subject } from "@/types";
import { CYCLE_LABELS, CYCLE_ORDER } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfigGuide } from "@/components/layout/config-guide";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hint } from "@/components/ui/hint";

export default function SubjectsPage() {
  const { context, loading: ctxLoading } = useSchoolContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [hours, setHours] = useState<CourseSubjectHours[]>([]);
  const [sessionSlotsPerWeek, setSessionSlotsPerWeek] = useState(0);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [filterCycle, setFilterCycle] = useState<Cycle | "all">("all");
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = context?.schoolId ?? null;
  const isAdmin = context?.isAdmin ?? false;

  async function loadData() {
    if (!context) return;

    if (isLocalMode()) {
      const data = localDb.getSchoolData(context.schoolId);
      setSubjects(data.subjects);
      setCourses(data.courses);
      setHours(data.courseSubjectHours);
      setSessionSlotsPerWeek(
        data.timeSlots.filter((s) => s.slot_type === "session").length
      );
      setLoading(false);
      return;
    }

    try {
      const data = await fetchSubjectsData(context.schoolId);
      setSubjects(data.subjects);
      setCourses(data.courses);
      setHours(data.hours);
      setSessionSlotsPerWeek(data.sessionSlotsPerWeek);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar asignaturas");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!context) return;
    loadData();
  }, [context]);

  const filteredCourses =
    filterCycle === "all" ? courses : courses.filter((c) => c.cycle === filterCycle);

  function getHours(courseId: string, subjectId: string) {
    return hours.find((h) => h.course_id === courseId && h.subject_id === subjectId)?.weekly_hours ?? 0;
  }

  function setHourValue(courseId: string, subjectId: string, value: number) {
    setHours((prev) => {
      const existing = prev.find((h) => h.course_id === courseId && h.subject_id === subjectId);
      if (existing) {
        return prev.map((h) =>
          h.course_id === courseId && h.subject_id === subjectId
            ? { ...h, weekly_hours: value }
            : h
        );
      }
      return [
        ...prev,
        { id: `temp-${courseId}-${subjectId}`, course_id: courseId, subject_id: subjectId, weekly_hours: value },
      ];
    });
  }

  async function saveHours() {
    if (!schoolId) return;
    for (const course of courses) {
      const total = subjects.reduce((sum, s) => sum + getHours(course.id, s.id), 0);
      if (total > sessionSlotsPerWeek && sessionSlotsPerWeek > 0) {
        toast.error(`${course.name}: ${total}h pero solo hay ${sessionSlotsPerWeek} franjas`);
        return;
      }
    }
    const rows = courses.flatMap((course) =>
      subjects.map((subject) => ({
        course_id: course.id,
        subject_id: subject.id,
        weekly_hours: getHours(course.id, subject.id),
      }))
    );

    if (isLocalMode()) {
      localDb.upsertCourseSubjectHours(rows);
      toast.success("Matriz guardada");
      await loadData();
      return;
    }

    const { error } = await upsertCourseSubjectHours(rows);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Matriz guardada");
    await loadData();
  }

  if (ctxLoading || loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <ConfigGuide />

      <PageHeader
        title="Asignaturas"
        description={`Define las asignaturas y las horas semanales por curso. Franjas disponibles: ${sessionSlotsPerWeek}/semana.`}
      >
        {isAdmin && (
          <Hint label="Rellena la matriz con horas típicas por etapa (solo si aún no hay horas configuradas)">
            <Button
              variant="outline"
              onClick={async () => {
                if (!schoolId) return;
                if (isLocalMode()) {
                  const { error } = localDb.seedDefaultHours(schoolId);
                  if (error) toast.error(error);
                  else {
                    await loadData();
                    toast.success("Horas de ejemplo cargadas");
                  }
                  return;
                }
                const { error } = await seedDefaultHoursRepo(schoolId);
                if (error) toast.error(error);
                else {
                  await loadData();
                  toast.success("Horas de ejemplo cargadas");
                }
              }}
            >
              Cargar horas de ejemplo
            </Button>
          </Hint>
        )}
      </PageHeader>

      <Tabs defaultValue="subjects">
        <TabsList>
          <TabsTrigger value="subjects">Asignaturas</TabsTrigger>
          <TabsTrigger value="matrix">Horas por curso</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          {isAdmin && (
            <Card>
              <CardContent className="flex gap-2 pt-6">
                <Input
                  placeholder="Nueva asignatura"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    if (!schoolId || !newSubjectName.trim()) return;
                    if (isLocalMode()) {
                      localDb.addSubject(schoolId, newSubjectName);
                      setNewSubjectName("");
                      await loadData();
                      toast.success("Asignatura añadida");
                      return;
                    }
                    const { error } = await addSubjectRepo(schoolId, newSubjectName);
                    if (error) {
                      toast.error(error);
                      return;
                    }
                    setNewSubjectName("");
                    await loadData();
                    toast.success("Asignatura añadida");
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Añadir
                </Button>
              </CardContent>
            </Card>
          )}

          {subjects.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Sin asignaturas"
              description="Añade las asignaturas de tu colegio para definir las horas por curso."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <Card key={subject.id}>
                  <CardContent className="flex items-center gap-3 pt-6">
                    <div
                      className="h-10 w-10 shrink-0 rounded-lg border"
                      style={{ backgroundColor: subject.color ?? "#3b82f6" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{subject.name}</p>
                      <p className="text-xs text-muted-foreground">{subject.short_name}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditSubject(subject)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteSubjectId(subject.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {editSubject && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Editar asignatura</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input
                    value={editSubject.name}
                    onChange={(e) => setEditSubject({ ...editSubject, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Abreviatura</Label>
                  <Input
                    value={editSubject.short_name ?? ""}
                    onChange={(e) =>
                      setEditSubject({ ...editSubject, short_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={editSubject.color ?? "#3b82f6"}
                    onChange={(e) => setEditSubject({ ...editSubject, color: e.target.value })}
                    className="h-10"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (isLocalMode()) {
                      localDb.updateSubject(editSubject.id, {
                        name: editSubject.name,
                        short_name: editSubject.short_name ?? undefined,
                        color: editSubject.color ?? undefined,
                      });
                      setEditSubject(null);
                      await loadData();
                      toast.success("Asignatura actualizada");
                      return;
                    }
                    const { error } = await updateSubjectRepo(editSubject.id, {
                      name: editSubject.name,
                      short_name: editSubject.short_name ?? undefined,
                      color: editSubject.color ?? undefined,
                    });
                    if (error) {
                      toast.error(error);
                      return;
                    }
                    setEditSubject(null);
                    await loadData();
                    toast.success("Asignatura actualizada");
                  }}
                >
                  Guardar cambios
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label>Filtrar por etapa:</Label>
            <Select
              value={filterCycle}
              onValueChange={(v: Cycle | "all") => setFilterCycle(v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etapas</SelectItem>
                {CYCLE_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CYCLE_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Hint label="El total por fila no debe superar las franjas lectivas de la malla">
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4" />
              </button>
            </Hint>
            {isAdmin && <Button onClick={saveHours}>Guardar matriz</Button>}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b bg-slate-800 px-3 py-2 text-left text-white">
                    Curso
                  </th>
                  {subjects.map((s) => (
                    <th key={s.id} className="border-b bg-slate-100 px-2 py-2 text-center text-xs">
                      {s.short_name || s.name}
                    </th>
                  ))}
                  <th className="border-b bg-slate-100 px-2 py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => {
                  const total = subjects.reduce((sum, s) => sum + getHours(course.id, s.id), 0);
                  const over = sessionSlotsPerWeek > 0 && total > sessionSlotsPerWeek;
                  return (
                    <tr key={course.id} className="hover:bg-muted/50">
                      <td className="sticky left-0 z-10 border-b bg-card px-3 py-2 font-medium">
                        <div>{course.name}</div>
                        <div className="text-xs text-muted-foreground">{CYCLE_LABELS[course.cycle]}</div>
                      </td>
                      {subjects.map((subject) => (
                        <td key={subject.id} className="border-b p-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            className="mx-auto h-8 w-14 text-center"
                            value={getHours(course.id, subject.id)}
                            onChange={(e) =>
                              setHourValue(course.id, subject.id, Number(e.target.value))
                            }
                            disabled={!isAdmin}
                          />
                        </td>
                      ))}
                      <td
                        className={`border-b px-2 py-2 text-center font-semibold ${over ? "text-destructive" : "text-green-700"}`}
                      >
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteSubjectId}
        onOpenChange={(o) => !o && setDeleteSubjectId(null)}
        title="Eliminar asignatura"
        description="Se eliminarán las horas y referencias en horarios."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (!deleteSubjectId) return;
          if (isLocalMode()) {
            localDb.deleteSubject(deleteSubjectId);
            await loadData();
            toast.success("Asignatura eliminada");
            return;
          }
          const { error } = await deleteSubjectRepo(deleteSubjectId);
          if (error) {
            toast.error(error);
            return;
          }
          await loadData();
          toast.success("Asignatura eliminada");
        }}
      />
    </div>
  );
}
