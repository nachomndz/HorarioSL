"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { SETUP_STEPS, getCurrentStepIndex, isStepDone } from "@/lib/onboarding/steps";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfigGuide() {
  const pathname = usePathname();
  const { status } = useSetupStatus();
  const currentIdx = getCurrentStepIndex(pathname);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuración paso a paso</CardTitle>
        <CardDescription>
          Sigue estos pasos en orden. Puedes volver a cualquiera para ajustar datos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {SETUP_STEPS.map((step, i) => {
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
