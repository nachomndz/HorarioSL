"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isLocalMode } from "@/lib/data/mode";
import { getRelationName } from "@/lib/supabase/helpers";
import { localDb } from "@/lib/local-db/store";
import { BookOpen, Calendar, GraduationCap, Users } from "lucide-react";
import { SetupProgress } from "@/components/layout/setup-progress";
import { buildProgressSteps } from "@/lib/onboarding/steps";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    teachers: 0,
    subjects: 0,
    courses: 0,
    activeYear: "",
    schoolName: "",
    setup: {
      hasTimetable: false,
      sessionSlots: 0,
      hasHours: false,
      hasTeachers: false,
      hasSchedule: false,
    },
    latestSchedule: null as { id: string; name: string; status: string } | null,
  });

  const [loading, setLoading] = useState(true);
  const { status: setupStatus } = useSetupStatus();

  useEffect(() => {
    async function load() {
      if (isLocalMode()) {
        const ctx = localDb.getSchoolContext();
        if (!ctx) return;
        const data = localDb.getSchoolData(ctx.schoolId);
        const setup = localDb.getSetupStatus(ctx.schoolId);
        const activeYear = data.academicYears.find((y) => y.is_active);
        const latest = data.schedules[0];
        setStats({
          teachers: data.teachers.length,
          subjects: data.subjects.length,
          courses: data.courses.length,
          activeYear: activeYear?.name ?? "—",
          schoolName: ctx.school.name,
          setup,
          latestSchedule: latest
            ? { id: latest.id, name: latest.name, status: latest.status }
            : null,
        });
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
        .select("school_id, schools(name)")
        .eq("user_id", user.id)
        .single();
      if (!member) return;

      const schoolName =
        getRelationName(
          member.schools as { name: string } | { name: string }[] | null
        ) || "Tu colegio";

      const [
        { count: teachers },
        { count: subjects },
        { count: courses },
        { data: year },
        { data: schedules },
        { count: slots },
        { count: hours },
      ] = await Promise.all([
        supabase
          .from("teachers")
          .select("*", { count: "exact", head: true })
          .eq("school_id", member.school_id),
        supabase
          .from("subjects")
          .select("*", { count: "exact", head: true })
          .eq("school_id", member.school_id),
        supabase
          .from("courses")
          .select("*", { count: "exact", head: true })
          .eq("school_id", member.school_id),
        supabase
          .from("academic_years")
          .select("name")
          .eq("school_id", member.school_id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("schedules")
          .select("id, name, status")
          .eq("school_id", member.school_id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("time_slots")
          .select("*", { count: "exact", head: true })
          .eq("school_id", member.school_id)
          .eq("slot_type", "session"),
        supabase
          .from("course_subject_hours")
          .select("*", { count: "exact", head: true })
          .gt("weekly_hours", 0),
      ]);

      const latest = schedules?.[0];
      setStats({
        teachers: teachers ?? 0,
        subjects: subjects ?? 0,
        courses: courses ?? 0,
        activeYear: year?.name ?? "—",
        schoolName,
        setup: {
          hasTimetable: (slots ?? 0) > 0,
          sessionSlots: slots ?? 0,
          hasHours: (hours ?? 0) > 0,
          hasTeachers: (teachers ?? 0) > 0,
          hasSchedule: Boolean(latest),
        },
        latestSchedule: latest ?? null,
      });
      setLoading(false);
    }
    load();
  }, []);

  const setupSteps = buildProgressSteps(setupStatus);

  if (loading) return <PageLoadingSkeleton />;

  const statCards = [
    { label: "Profesores", value: stats.teachers, icon: Users, color: "text-blue-600" },
    { label: "Asignaturas", value: stats.subjects, icon: BookOpen, color: "text-green-600" },
    { label: "Cursos", value: stats.courses, icon: GraduationCap, color: "text-violet-600" },
    {
      label: "Franjas/semana",
      value: stats.setup.sessionSlots,
      icon: Calendar,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de control"
        description={`${stats.schoolName || "Tu colegio"} · Curso ${stats.activeYear}`}
      />

      <SetupProgress steps={setupSteps} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => (
          <Card key={item.label} className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{item.label}</CardDescription>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {setupSteps.map((step) => (
              <Button key={step.id} asChild variant="outline" className="justify-start">
                <Link href={step.href}>{step.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Último horario</CardTitle>
            <CardDescription>
              {stats.latestSchedule
                ? `${stats.latestSchedule.name} (${stats.latestSchedule.status === "published" ? "Publicado" : "Borrador"})`
                : "Aún no has generado ningún horario."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.latestSchedule ? (
              <Button asChild>
                <Link href={`/dashboard/horarios/${stats.latestSchedule.id}`}>Ver horario</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/dashboard/horarios">Generar horario</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
