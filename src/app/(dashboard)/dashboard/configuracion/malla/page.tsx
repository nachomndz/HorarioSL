"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  fetchTimetableSettings,
  saveTimetableSettings,
} from "@/lib/data/school-repository";
import { generateTimeSlots, countSessionSlots } from "@/lib/timetable";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { RecessConfig } from "@/types";
import { WeeklyGridPreview } from "@/components/timetable/weekly-grid-preview";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { ConfigGuide } from "@/components/layout/config-guide";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export default function TimetableConfigPage() {
  const { context, loading: ctxLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    school_days: DEFAULT_DAYS,
    day_start: "09:00",
    day_end: "16:00",
    session_duration_minutes: 45,
    recesses: [{ start: "11:30", duration_minutes: 30 }] as RecessConfig[],
  });

  const schoolId = context?.schoolId ?? null;
  const isAdmin = context?.isAdmin ?? false;

  const computedPreview = useMemo(() => {
    if (!schoolId) return [];
    return generateTimeSlots(schoolId, settings);
  }, [schoolId, settings]);

  const sessionCount = countSessionSlots(computedPreview);

  useEffect(() => {
    if (!context) return;

    async function load() {
      if (isLocalMode()) {
        const data = localDb.getSchoolData(context!.schoolId);
        if (data.timetableSettings) {
          const s = data.timetableSettings;
          setSettings({
            school_days: s.school_days,
            day_start: s.day_start.slice(0, 5),
            day_end: s.day_end.slice(0, 5),
            session_duration_minutes: s.session_duration_minutes,
            recesses: s.recesses as RecessConfig[],
          });
        }
        setLoading(false);
        return;
      }

      try {
        const saved = await fetchTimetableSettings(context!.schoolId);
        if (saved) setSettings(saved);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al cargar la malla");
      }
      setLoading(false);
    }

    load();
  }, [context]);

  function toggleDay(day: number) {
    setSettings((prev) => ({
      ...prev,
      school_days: prev.school_days.includes(day)
        ? prev.school_days.filter((d) => d !== day)
        : [...prev.school_days, day].sort((a, b) => a - b),
    }));
  }

  function addRecess() {
    setSettings((prev) => ({
      ...prev,
      recesses: [...prev.recesses, { start: "14:00", duration_minutes: 30 }],
    }));
  }

  function removeRecess(index: number) {
    setSettings((prev) => ({
      ...prev,
      recesses: prev.recesses.filter((_, i) => i !== index),
    }));
  }

  function updateRecess(index: number, field: keyof RecessConfig, value: string | number) {
    setSettings((prev) => ({
      ...prev,
      recesses: prev.recesses.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
  }

  async function handleSave() {
    if (!schoolId || !isAdmin) return;
    setSaving(true);

    if (isLocalMode()) {
      const result = localDb.saveTimetableSettings(schoolId, settings);
      setSaving(false);
      toast.success(
        `Malla guardada: ${result.slotCount} sesiones lectivas. Se han reseteado las restricciones de disponibilidad de profesores.`
      );
      return;
    }

    const result = await saveTimetableSettings(schoolId, settings);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Malla guardada: ${result.slotCount} sesiones lectivas. Se han reseteado las restricciones de disponibilidad de profesores.`
    );
  }

  if (ctxLoading || loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <ConfigGuide />

      <PageHeader
        title="Malla horaria"
        description="Define la estructura de la jornada escolar. La rejilla de la derecha muestra cómo quedará el horario."
      >
        {isAdmin && (
          <Hint label="Regenera las franjas horarias; revisa después la disponibilidad de profesores">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar malla"}
            </Button>
          </Hint>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{settings.school_days.length} días lectivos</Badge>
        <Badge variant="secondary">{sessionCount} sesiones/semana</Badge>
        <Badge variant="secondary">{settings.recesses.length} recreo(s)</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                1. Días lectivos
                <Hint label="Marca los días en los que hay clase">
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </Hint>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              {[1, 2, 3, 4, 5].map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={settings.school_days.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                    disabled={!isAdmin}
                  />
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"][day - 1]}
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                2. Jornada escolar
                <Hint label="Hora de entrada, salida y duración de cada sesión lectiva">
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </Hint>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="time"
                  value={settings.day_start}
                  onChange={(e) => setSettings((p) => ({ ...p, day_start: e.target.value }))}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input
                  type="time"
                  value={settings.day_end}
                  onChange={(e) => setSettings((p) => ({ ...p, day_end: e.target.value }))}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Sesión (min)</Label>
                <Input
                  type="number"
                  min={30}
                  max={90}
                  value={settings.session_duration_minutes}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      session_duration_minutes: Number(e.target.value),
                    }))
                  }
                  disabled={!isAdmin}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  3. Recreos
                  <Hint label="Los recreos dividen la jornada; no cuentan como sesión lectiva">
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </Hint>
                </CardTitle>
                <CardDescription>Añade uno o varios recreos en la jornada.</CardDescription>
              </div>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={addRecess}>
                  <Plus className="h-4 w-4" />
                  Añadir
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {settings.recesses.map((recess, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Inicio</Label>
                    <Input
                      type="time"
                      value={recess.start}
                      onChange={(e) => updateRecess(i, "start", e.target.value)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Minutos</Label>
                    <Input
                      type="number"
                      min={10}
                      value={recess.duration_minutes}
                      onChange={(e) =>
                        updateRecess(i, "duration_minutes", Number(e.target.value))
                      }
                      disabled={!isAdmin}
                    />
                  </div>
                  {isAdmin && settings.recesses.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeRecess(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vista previa semanal</CardTitle>
            <CardDescription>
              Así se verán las franjas en los horarios de profesores y cursos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyGridPreview slots={computedPreview} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
