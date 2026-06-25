"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { SETUP_STEPS, isStepDone } from "@/lib/onboarding/steps";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupPreflightChecklist() {
  const { status, loading } = useSetupStatus();

  if (loading) return null;

  const incomplete = SETUP_STEPS.filter((step) => step.id !== "horario" && !isStepDone(step, status));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Comprobar antes de generar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {SETUP_STEPS.filter((s) => s.id !== "horario").map((step) => {
          const done = isStepDone(step, status);
          return (
            <div key={step.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={done ? "text-green-800" : ""}>{step.label}</span>
              </span>
              {!done && (
                <Link href={step.href} className="text-primary text-xs hover:underline">
                  Configurar
                </Link>
              )}
            </div>
          );
        })}
        {incomplete.length > 0 && (
          <p className="pt-2 text-xs text-muted-foreground">
            Te faltan {incomplete.length} paso{incomplete.length !== 1 ? "s" : ""} antes de generar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
