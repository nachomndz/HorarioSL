import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { MemberRole, School, SchoolMember } from "@/types";
import { getRelationObject } from "@/lib/supabase/helpers";

export interface SchoolContext {
  school: School;
  member: SchoolMember;
  isAdmin: boolean;
}

export async function getSchoolContext(): Promise<SchoolContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member } = await supabase
    .from("school_members")
    .select("*, schools(*)")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;

  const school = getRelationObject(member.schools as School | School[]);
  if (!school) return null;

  return {
    school,
    member: {
      id: member.id,
      school_id: member.school_id,
      user_id: member.user_id,
      role: member.role as MemberRole,
      created_at: member.created_at,
    },
    isAdmin: member.role === "admin",
  };
}

export async function requireSchoolContext(): Promise<SchoolContext> {
  const ctx = await getSchoolContext();
  if (!ctx) {
    throw new Error("No school context");
  }
  return ctx;
}

export async function requireAdminContext(): Promise<SchoolContext> {
  const ctx = await requireSchoolContext();
  if (!ctx.isAdmin) {
    throw new Error("Admin required");
  }
  return ctx;
}
