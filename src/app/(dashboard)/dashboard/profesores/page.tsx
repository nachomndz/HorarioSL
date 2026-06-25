"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import type { Teacher } from "@/types";
import { CYCLE_LABELS } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ConfigGuide } from "@/components/layout/config-guide";
import { NextStepBanner } from "@/components/layout/next-step-banner";
import { PageLoadingSkeleton, TableLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/hint";

export default function TeachersPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeachers();
  }, []);

  async function loadTeachers() {
    if (isLocalMode()) {
      const ctx = localDb.getSchoolContext();
      if (!ctx) return;
      setSchoolId(ctx.schoolId);
      setIsAdmin(ctx.isAdmin);
      setTeachers(localDb.getSchoolData(ctx.schoolId).teachers);
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

    const { data } = await supabase
      .from("teachers")
      .select("*")
      .eq("school_id", member.school_id)
      .order("name");

    setTeachers((data as Teacher[]) ?? []);
    setLoading(false);
  }

  async function addTeacher() {
    if (!schoolId || !newName.trim()) return;

    if (isLocalMode()) {
      const teacher = localDb.addTeacher(schoolId, newName);
      setNewName("");
      toast.success("Profesor añadido");
      setTeachers((prev) => [...prev, teacher]);
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("teachers")
      .insert({
        school_id: schoolId,
        name: newName.trim(),
        max_weekly_hours: 25,
        scope_type: "all",
      })
      .select()
      .single();

    if (error) toast.error(error.message);
    else if (data) {
      setNewName("");
      toast.success("Profesor añadido");
      setTeachers((prev) => [...prev, data as Teacher]);
    }
  }

  async function saveTeacherName(teacher: Teacher) {
    const name = teacher.name.trim();
    if (!name) {
      toast.error("El nombre no puede estar vacío");
      return;
    }

    if (isLocalMode()) {
      const { error } = localDb.renameTeacher(teacher.id, name);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Nombre guardado");
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("teachers")
      .update({ name })
      .eq("id", teacher.id);

    if (error) toast.error(error.message);
    else toast.success("Nombre guardado");
  }

  async function deleteTeacher(id: string) {
    if (isLocalMode()) {
      localDb.deleteTeacher(id);
      toast.success("Profesor eliminado");
      setTeachers((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profesor eliminado");
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, search]);

  function scopeLabel(teacher: Teacher) {
    if (teacher.scope_type === "all") return "Todo el colegio";
    if (teacher.scope_type === "cycle")
      return teacher.scope_cycle ? CYCLE_LABELS[teacher.scope_cycle] : "Ciclo";
    return "Cursos concretos";
  }

  if (loading) return <TableLoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <ConfigGuide />

      <PageHeader
        title="Profesores"
        description="Configura horas máximas, asignaturas, cursos y disponibilidad de cada profesor."
      >
        {isAdmin && isLocalMode() && (
          <Hint label="Crea un profesor por asignatura con alcance en todo el colegio (solo si aún no hay profesores)">
            <Button
              variant="outline"
              onClick={() => {
                if (!schoolId) return;
                const { error } = localDb.seedDefaultTeachers(schoolId);
                if (error) toast.error(error);
                else {
                  loadTeachers();
                  toast.success("Profesores de ejemplo cargados");
                }
              }}
            >
              Cargar profesores de ejemplo
            </Button>
          </Hint>
        )}
      </PageHeader>

      {isAdmin && (
        <Card data-tour="profesores-add">
          <CardHeader>
            <CardTitle className="text-base">Nuevo profesor</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input
              placeholder="Nombre del profesor"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={addTeacher}>Añadir</Button>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar profesor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "Sin resultados" : "Sin profesores"}
          description={
            search
              ? "Prueba con otro nombre."
              : "Añade los profesores del colegio para generar horarios."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Horas máx.</th>
                <th className="px-4 py-3 text-left font-medium">Ámbito</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((teacher) => (
                <tr key={teacher.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={teacher.name}
                          onChange={(e) =>
                            setTeachers((prev) =>
                              prev.map((t) =>
                                t.id === teacher.id ? { ...t, name: e.target.value } : t
                              )
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveTeacherName(teacher);
                            }
                          }}
                          className="max-w-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveTeacherName(teacher)}
                        >
                          Guardar
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{teacher.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{teacher.max_weekly_hours}h/sem</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{scopeLabel(teacher)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/profesores/${teacher.id}`}>
                          {isAdmin ? "Editar" : "Ver"}
                        </Link>
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(teacher.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Eliminar profesor"
        description="Se eliminarán sus asignaturas, cursos y restricciones. Las sesiones en horarios quedarán huérfanas."
        variant="destructive"
        confirmLabel="Eliminar"
        onConfirm={() => deleteId && deleteTeacher(deleteId)}
      />

      <NextStepBanner />
    </div>
  );
}
