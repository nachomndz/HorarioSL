"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getNextIncompleteStep } from "@/lib/onboarding/steps";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { Button } from "@/components/ui/button";

export function NextStepBanner() {
  const pathname = usePathname();
  const { status } = useSetupStatus();
  const next = getNextIncompleteStep(pathname, status);

  if (!next) return null;

  return (
    <div className="sticky bottom-4 z-20 mt-6 rounded-lg border bg-card p-4 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Siguiente paso</p>
          <p className="text-sm text-muted-foreground">
            {next.label} — {next.description}
          </p>
        </div>
        <Button asChild>
          <Link href={next.href}>
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
