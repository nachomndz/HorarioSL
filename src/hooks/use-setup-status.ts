"use client";

import { useEffect, useState } from "react";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import { fetchSetupStatus } from "@/lib/data/school-repository";
import type { SetupStatus } from "@/lib/onboarding/steps";
import { useSchoolContext } from "@/hooks/use-school-context";

export function useSetupStatus() {
  const { context } = useSchoolContext();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!context) return;

    async function load() {
      setLoading(true);
      if (isLocalMode()) {
        setStatus(localDb.getSetupStatus(context!.schoolId) as SetupStatus);
        setLoading(false);
        return;
      }
      try {
        setStatus(await fetchSetupStatus(context!.schoolId));
      } catch {
        setStatus(null);
      }
      setLoading(false);
    }

    load();
  }, [context]);

  return { status, loading, schoolId: context?.schoolId ?? null };
}
