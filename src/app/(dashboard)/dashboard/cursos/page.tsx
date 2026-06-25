"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  addCourse as addCourseRepo,
  deleteCourse as deleteCourseRepo,
  fetchCourses,
  fetchFormativeStages,
  reorderCourse as reorderCourseRepo,
  seedDefaultCourses,
  seedDefaultSubjects,
  updateCourse as updateCourseRepo,
} from "@/lib/data/school-repository";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { Course, Cycle, FormativeStage } from "@/types";
import { CYCLE_LABELS, CYCLE_ORDER } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfigGuide } from "@/components/layout/config-guide";
import { NextStepBanner } from "@/components/layout/next-step-banner";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHint } from "@/components/ui/section-hint";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CoursesPage() {
  const { context, loading: ctxLoading } = useSchoolContext();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCycle, setNewCycle] = useState<Cycle>("primaria");
  const [newStageId, setNewStageId] = useState<string>("");
  const [stages, setStages] = useState<FormativeStage[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<Cycle, boolean>>({
    infantil: false,
    primaria: false,
    secundaria: false,
    diversificacion: false,
  });

  const schoolId = context?.schoolId ?? null;
  const isAdmin = context?.isAdmin ?? false;

  async function load() {
    if (!context) return;

    if (isLocalMode()) {
      setCourses(localDb.getSchoolData(context.schoolId).courses);
      setLoading(false);
      return;
    }

    try {
      setCourses(await fetchCourses(context.schoolId));
      if (isLocalMode()) {
        setStages(localDb.getFormativeStages(context.schoolId));
      } else {
        setStages(await fetchFormativeStages(context.schoolId));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar cursos");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!context) return;
    load();
  }, [context]);

  async function saveCourse(course: Course) {
    if (isLocalMode()) {
      localDb.updateCourse(course.id, { name: course.name, cycle: course.cycle });
      toast.success("Curso guardado");
      return;
    }

    const { error } = await updateCourseRepo(course.id, {
      name: course.name,
      cycle: course.cycle,
      formative_stage_id: course.formative_stage_id,
    });
    if (error) toast.error(error);
    else toast.success("Curso guardado");
  }

  async function addCourse() {
    if (!schoolId || !newName.trim()) return;

    if (isLocalMode()) {
      const c = localDb.addCourse(schoolId, newName, newCycle, newStageId || null);
      setCourses((prev) => [...prev, c]);
      setNewName("");
      toast.success("Curso añadido");
      return;
    }

    const { course, error } = await addCourseRepo(schoolId, newName, newCycle, newStageId || null);
    if (error) {
      toast.error(error);
      return;
    }
    if (course) setCourses((prev) => [...prev, course]);
    setNewName("");
    toast.success("Curso añadido");
  }

  async function deleteCourse(id: string) {
    if (isLocalMode()) {
      localDb.deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      toast.success("Curso eliminado");
      return;
    }

    const { error } = await deleteCourseRepo(id);
    if (error) {
      toast.error(error);
      return;
    }
    setCourses((prev) => prev.filter((c) => c.id !== id));
    toast.success("Curso eliminado");
  }

  async function restoreTemplate() {
    if (!schoolId) return;

    if (isLocalMode()) {
      localDb.seedDefaultCourses(schoolId, true);
      await load();
      toast.success("Plantilla de ejemplo cargada");
      return;
    }

    const { error } = await seedDefaultCourses(schoolId, true);
    if (error) {
      toast.error(error);
      return;
    }
    await load();
    toast.success("Plantilla de ejemplo cargada");
  }

  async function loadExampleSubjects() {
    if (!schoolId) return;

    if (isLocalMode()) {
      const { error } = localDb.seedDefaultSubjects(schoolId);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Asignaturas de ejemplo cargadas");
      return;
    }

    const { error } = await seedDefaultSubjects(schoolId);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Asignaturas de ejemplo cargadas");
  }

  async function handleReorder(courseId: string, direction: "up" | "down") {
    if (isLocalMode()) {
      localDb.reorderCourse(courseId, direction);
      await load();
      return;
    }

    const { error } = await reorderCourseRepo(courseId, direction);
    if (error) toast.error(error);
    else await load();
  }

  if (ctxLoading || loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <ConfigGuide />

      <PageHeader
        title="Cursos"
        description="Añade los cursos de tu centro; no hay límite de cantidad."
      >
        {isAdmin && (
          <>
            <Hint label="Reemplaza todos los cursos por una plantilla de ejemplo (Infantil, Primaria, Secundaria y Diversificación)">
              <Button data-tour="cursos-template" variant="outline" onClick={restoreTemplate}>
                Cargar plantilla de ejemplo
              </Button>
            </Hint>
            <Hint label="Añade asignaturas típicas si aún no tienes ninguna configurada">
              <Button variant="outline" onClick={loadExampleSubjects}>
                Cargar asignaturas de ejemplo
              </Button>
            </Hint>
          </>
        )}
      </PageHeader>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Añadir curso
              <SectionHint label="Cada curso debe pertenecer a un subciclo para heredar el currículo obligatorio correcto." />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              placeholder="Nombre del curso"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-xs"
            />
            <Select value={newCycle} onValueChange={(v: Cycle) => { setNewCycle(v); setNewStageId(""); }}>
              <SelectTrigger className="w-44">
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
            <Select value={newStageId} onValueChange={setNewStageId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Subciclo" />
              </SelectTrigger>
              <SelectContent>
                {stages.filter((s) => s.cycle === newCycle).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addCourse}>
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </CardContent>
        </Card>
      )}

      {courses.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="Sin cursos"
          description="Añade los grupos de tu centro o carga la plantilla de ejemplo para empezar."
          actionLabel={isAdmin ? "Cargar plantilla de ejemplo" : undefined}
          onAction={isAdmin ? restoreTemplate : undefined}
        />
      )}

      {CYCLE_ORDER.map((cycle) => {
        const items = courses.filter((c) => c.cycle === cycle);
        return (
          <Card key={cycle}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setCollapsed((p) => ({ ...p, [cycle]: !p[cycle] }))}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {CYCLE_LABELS[cycle]}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({items.length} curso{items.length !== 1 ? "s" : ""})
                  </span>
                </CardTitle>
                {collapsed[cycle] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
            {!collapsed[cycle] && (
              <CardContent className="space-y-2">
                {items.length === 0 && (
                  <CardDescription>
                    No hay cursos en esta etapa. Empieza cargando la plantilla de ejemplo o añade
                    cursos manualmente.
                  </CardDescription>
                )}
                {items.map((course) => (
                  <div key={course.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                    <Input
                      value={course.name}
                      onChange={(e) =>
                        setCourses((prev) =>
                          prev.map((c) =>
                            c.id === course.id ? { ...c, name: e.target.value } : c
                          )
                        )
                      }
                      disabled={!isAdmin}
                      className="max-w-xs"
                    />
                    <Select
                      value={course.formative_stage_id ?? ""}
                      onValueChange={(v) =>
                        setCourses((prev) =>
                          prev.map((c) =>
                            c.id === course.id ? { ...c, formative_stage_id: v || null } : c
                          )
                        )
                      }
                      disabled={!isAdmin}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Subciclo" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.filter((s) => s.cycle === course.cycle).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => saveCourse(course)}>
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorder(course.id, "up")}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReorder(course.id, "down")}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteId(course.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Eliminar curso"
        description="Se eliminarán también las horas asignadas y las entradas del horario de este curso."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => deleteId && deleteCourse(deleteId)}
      />

      <NextStepBanner />
    </div>
  );
}
