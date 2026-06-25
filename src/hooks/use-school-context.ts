"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import { getRelationObject } from "@/lib/supabase/helpers";
import type { School } from "@/types";

export interface SchoolContext {
  schoolId: string;
  school: School;
  isAdmin: boolean;
  userId: string;
}

export function useSchoolContext() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<SchoolContext | null>(null);

  useEffect(() => {
    async function load() {
      if (isLocalMode()) {
        const ctx = localDb.getSchoolContext();
        if (!ctx) {
          router.replace("/registro");
          return;
        }
        setContext({
          schoolId: ctx.schoolId,
          school: ctx.school,
          isAdmin: ctx.isAdmin,
          userId: ctx.member.user_id,
        });
        setLoading(false);
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/registro");
        return;
      }

      const { data: member } = await supabase
        .from("school_members")
        .select("school_id, role, schools(id, name, created_at)")
        .eq("user_id", user.id)
        .single();

      if (!member) {
        router.replace("/registro");
        return;
      }

      const schoolObj = getRelationObject(
        member.schools as School | School[] | null
      );

      setContext({
        schoolId: member.school_id,
        school: schoolObj ?? {
          id: member.school_id,
          name: "Colegio",
          created_at: "",
        },
        isAdmin: member.role === "admin",
        userId: user.id,
      });
      setLoading(false);
    }
    load();
  }, [router]);

  return { loading, context };
}
