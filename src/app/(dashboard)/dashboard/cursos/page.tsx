"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import type { Course, Cycle } from "@/types";
import { CYCLE_LABELS, CYCLE_ORDER } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Hint } from "@/components/ui/hint";
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

export default function CoursesPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCycle, setNewCycle] = useState<Cycle>("primaria");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<Cycle, boolean>>({
    infantil: false,
    primaria: false,
    secundaria: false,
    diversificacion: false,
  });

  function load() {
    if (!isLocalMode()) return;
    const ctx = localDb.getSchoolContext();
    if (!ctx) return;
    setSchoolId(ctx.schoolId);
    setIsAdmin(ctx.isAdmin);
    setCourses(localDb.getSchoolData(ctx.schoolId).courses);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function saveCourse(course: Course) {
    if (isLocalMode()) {
      localDb.updateCourse(course.id, { name: course.name, cycle: course.cycle });
      toast.success("Curso guardado");
    }
  }

  function addCourse() {
    if (!schoolId || !newName.trim()) return;
    if (isLocalMode()) {
      const c = localDb.addCourse(schoolId, newName, newCycle);
      setCourses((prev) => [...prev, c]);
      setNewName("");
      toast.success("Curso añadido");
    }
  }

  function deleteCourse(id: string) {
    if (isLocalMode()) {
      localDb.deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      toast.success("Curso eliminado");
    }
  }

  function restoreTemplate() {
    if (!schoolId) return;
    if (isLocalMode()) {
      localDb.seedDefaultCourses(schoolId, true);
      load();
      toast.success("Plantilla 3+6+4+1 restaurada");
    }
  }

  if (loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursos"
        description="3 Infantil + 6 Primaria + 4 Secundaria + 1 Diversificación por defecto. Puedes añadir, quitar y renombrar libremente."
      >
        {isAdmin && (
          <Hint label="Reemplaza todos los cursos por la plantilla estándar 3+6+4+1">
            <Button variant="outline" onClick={restoreTemplate}>
              Restaurar plantilla 3+6+4+1
            </Button>
          </Hint>
        )}
      </PageHeader>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Añadir curso</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              placeholder="Nombre del curso"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-xs"
            />
            <Select value={newCycle} onValueChange={(v: Cycle) => setNewCycle(v)}>
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
            <Button onClick={addCourse}>
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </CardContent>
        </Card>
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
                  <p className="text-sm text-muted-foreground">No hay cursos en esta etapa.</p>
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
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => saveCourse(course)}>
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            localDb.reorderCourse(course.id, "up") && load()
                          }
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            localDb.reorderCourse(course.id, "down") && load()
                          }
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
    </div>
  );
}
