"use client";

import Link from "next/link";
import { AlertTriangle, XCircle } from "lucide-react";
import type { ValidationResult } from "@/lib/solver/validate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function suggestLink(message: string): { href: string; label: string } | null {
  const lower = message.toLowerCase();
  if (lower.includes("profesor") || lower.includes("teacher")) {
    return { href: "/dashboard/profesores", label: "Ir a Profesores" };
  }
  if (lower.includes("malla") || lower.includes("franja")) {
    return { href: "/dashboard/configuracion/malla", label: "Ir a Malla horaria" };
  }
  if (lower.includes("curso") && lower.includes("hora")) {
    return { href: "/dashboard/asignaturas", label: "Ir a Asignaturas" };
  }
  if (lower.includes("asignatura") || lower.includes("matriz") || lower.includes("hora")) {
    return { href: "/dashboard/asignaturas", label: "Ir a Asignaturas" };
  }
  if (lower.includes("curso")) {
    return { href: "/dashboard/cursos", label: "Ir a Cursos" };
  }
  return null;
}

export function ValidationReport({ result }: { result: ValidationResult }) {
  if (!result.errors.length && !result.warnings.length) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {result.errors.length > 0 ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
          Revisa antes de generar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.errors.map((msg, i) => {
          const link = suggestLink(msg);
          return (
            <div key={`e-${i}`} className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <p className="text-destructive">{msg}</p>
              {link && (
                <Button asChild size="sm" variant="outline">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              )}
            </div>
          );
        })}
        {result.warnings.map((msg, i) => (
          <p key={`w-${i}`} className="text-sm text-amber-800">
            {msg}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
