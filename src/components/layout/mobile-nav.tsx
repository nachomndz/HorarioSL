"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNav({
  schoolName,
  isAdmin,
}: {
  schoolName: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Menú">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{schoolName}</p>
          <p className="text-xs text-muted-foreground">HorarioSL</p>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl",
              "animate-in slide-in-from-left duration-200"
            )}
          >
            <div className="relative h-full">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
              <Sidebar schoolName={schoolName} isAdmin={isAdmin} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
