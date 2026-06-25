"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import { fetchSetupStatus } from "@/lib/data/school-repository";
import { useSchoolContext } from "@/hooks/use-school-context";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    id: "malla",
    href: "/dashboard/configuracion/malla",
    label: "Malla horaria",
    description: "Días, horarios y recreos",
    doneKey: "hasTimetable" as const,
  },
  {
    id: "cursos",
    href: "/dashboard/cursos",
    label: "Cursos",
    description: "Grupos del centro",
    doneKey: "courseCount" as const,
  },
  {
    id: "asignaturas",
    href: "/dashboard/asignaturas",
    label: "Asignaturas",
    description: "Horas por curso",
    doneKey: "hasHours" as const,
  },
  {
    id: "profesores",
    href: "/dashboard/profesores",
    label: "Profesores",
    description: "Restricciones",
    doneKey: "hasTeachers" as const,
  },
  {
    id: "horario",
    href: "/dashboard/horarios",
    label: "Horarios",
    description: "Generar horario",
    doneKey: "hasSchedule" as const,
  },
];

type SetupStatus = Awaited<ReturnType<typeof fetchSetupStatus>>;

function isStepDone(step: (typeof STEPS)[number], status: SetupStatus | null): boolean {
  if (!status) return false;
  if (step.doneKey === "courseCount") return status.courseCount > 0;
  return Boolean(status[step.doneKey]);
}

export function ConfigGuide() {
  const pathname = usePathname();
  const { context } = useSchoolContext();
  const [status, setStatus] = useState<SetupStatus | null>(null);

  useEffect(() => {
    if (!context) return;
    async function load() {
      if (isLocalMode()) {
        setStatus(localDb.getSetupStatus(context!.schoolId));
        return;
      }
      try {
        setStatus(await fetchSetupStatus(context!.schoolId));
      } catch {
        setStatus(null);
      }
    }
    load();
  }, [context]);

  const currentIdx = STEPS.findIndex(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`)
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuración paso a paso</CardTitle>
        <CardDescription>
          Sigue estos pasos en orden. Puedes volver a cualquiera para ajustar datos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((step, i) => {
            const done = isStepDone(step, status);
            const current = i === currentIdx;
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-background",
                    current && "border-primary bg-background shadow-sm",
                    done && !current && "border-green-200 bg-green-50/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          current ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    )}
                    <span className="font-medium leading-tight">
                      {i + 1}. {step.label}
                    </span>
                  </div>
                  <span className="pl-6 text-xs text-muted-foreground">{step.description}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
