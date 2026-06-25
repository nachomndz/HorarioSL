"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  addFormativeStage,
  deleteFormativeStage,
  fetchFormativeStagesByCycle,
  seedDefaultFormativeStages,
  updateFormativeStage,
} from "@/lib/data/school-repository";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { Cycle, FormativeStage } from "@/types";
import { CYCLE_LABELS, CYCLE_ORDER } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfigGuide } from "@/components/layout/config-guide";
import { NextStepBanner } from "@/components/layout/next-step-banner";
import { EmptyState } from "@/components/layout/empty-state";
import { SectionHint } from "@/components/ui/section-hint";
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

export default function FormativeStagesPage() {
  const { context, loading: ctxLoading } = useSchoolContext();
  const [cycle, setCycle] = useState<Cycle>("primaria");
  const [stages, setStages] = useState<FormativeStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const schoolId = context?.schoolId ?? null;
  const isAdmin = context?.isAdmin ?? false;

  async function load() {
    if (!context) return;
    if (isLocalMode()) {
      setStages(localDb.getFormativeStages(context.schoolId, cycle));
      setLoading(false);
      return;
    }
    try {
      setStages(await fetchFormativeStagesByCycle(context.schoolId, cycle));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar subciclos");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!context) return;
    setLoading(true);
    load();
  }, [context, cycle]);

  async function seedDefaults() {
    if (!schoolId) return;
    if (isLocalMode()) {
      localDb.seedDefaultFormativeStages(schoolId);
    } else {
      const { error } = await seedDefaultFormativeStages(schoolId);
      if (error) {
        toast.error(error);
        return;
      }
    }
    toast.success("Subciclos por defecto creados");
    await load();
  }

  if (ctxLoading || loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <ConfigGuide />

      <PageHeader
        title="Subciclos formativos"
        description="Define los subciclos de cada etapa (ej. 1º+2º, 3º+4º, 5º+6º en primaria)."
      >
        {isAdmin && (
          <Button data-tour="etapas-seed" variant="outline" onClick={seedDefaults}>
            Cargar subciclos por defecto
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Etapa educativa
            <SectionHint label="Un subciclo agrupa varios cursos con el mismo currículo obligatorio (por ejemplo 1º y 2º de primaria)." />
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

      {isAdmin && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-6">
            <Input
              placeholder="Nombre del subciclo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-sm"
            />
            <Button
              onClick={async () => {
                if (!schoolId || !newName.trim()) return;
                if (isLocalMode()) {
                  localDb.addFormativeStage(schoolId, cycle, newName);
                } else {
                  const { error } = await addFormativeStage(schoolId, cycle, newName);
                  if (error) {
                    toast.error(error);
                    return;
                  }
                }
                setNewName("");
                toast.success("Subciclo añadido");
                await load();
              }}
            >
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {stages.length === 0 && (
          <EmptyState
            icon={Layers}
            title="Sin subciclos"
            description="Los subciclos definen qué cursos comparten el mismo currículo obligatorio."
            actionLabel={isAdmin ? "Cargar subciclos por defecto" : undefined}
            onAction={isAdmin ? seedDefaults : undefined}
          />
        )}
        {stages.map((stage) => (
          <Card key={stage.id}>
            <CardContent className="flex flex-wrap items-center gap-2 pt-6">
              <Input
                value={stage.name}
                onChange={(e) =>
                  setStages((prev) =>
                    prev.map((s) => (s.id === stage.id ? { ...s, name: e.target.value } : s))
                  )
                }
                disabled={!isAdmin}
                className="max-w-md"
              />
              {isAdmin && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const current = stages.find((s) => s.id === stage.id);
                      if (!current) return;
                      if (isLocalMode()) {
                        localDb.updateFormativeStage(stage.id, { name: current.name });
                      } else {
                        const { error } = await updateFormativeStage(stage.id, { name: current.name });
                        if (error) toast.error(error);
                      }
                      toast.success("Guardado");
                    }}
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (isLocalMode()) localDb.deleteFormativeStage(stage.id);
                      else {
                        const { error } = await deleteFormativeStage(stage.id);
                        if (error) {
                          toast.error(error);
                          return;
                        }
                      }
                      toast.success("Eliminado");
                      await load();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <NextStepBanner />
    </div>
  );
}
