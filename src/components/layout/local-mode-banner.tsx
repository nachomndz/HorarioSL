"use client";

import { isLocalMode } from "@/lib/data/mode";
import { AlertTriangle } from "lucide-react";

export function LocalModeBanner() {
  if (!isLocalMode()) return null;

  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong>Modo local activo:</strong> los datos se guardan solo en este navegador. Para
        compartir entre administradores, configura Supabase y{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_DATA_SOURCE=supabase</code>.
      </p>
    </div>
  );
}
