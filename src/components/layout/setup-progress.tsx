"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SetupStep {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  href: string;
}

export function SetupProgress({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card id="setup-progress">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuración del colegio</CardTitle>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {doneCount} de {steps.length} pasos completados
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.href}
            title={step.description}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted",
              step.done && "border-green-200 bg-green-50/50"
            )}
          >
            <span className="flex items-center gap-2">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={step.done ? "text-green-800" : ""}>{step.label}</span>
            </span>
            {step.description && (
              <span className="pl-6 text-xs text-muted-foreground">{step.description}</span>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
