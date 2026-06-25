import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRelationName } from "@/lib/supabase/helpers";
import type { MemberRole } from "@/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("school_members")
    .select("school_id, role, schools(name)")
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const email = body.email as string;
  const role = (body.role as MemberRole) ?? "viewer";

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY no configurada. Configúrala en Vercel para invitar usuarios.",
      },
      { status: 500 }
    );
  }

  const service = await createServiceClient();
  const schoolName = getRelationName(member.schools as { name: string } | { name: string }[]);

  const { data: inviteData, error: inviteError } =
    await service.auth.admin.inviteUserByEmail(email, {
      data: {
        school_id: member.school_id,
        invited_role: role,
        school_name: schoolName,
      },
    });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  if (inviteData.user) {
    const { error: memberError } = await service.from("school_members").upsert(
      {
        school_id: member.school_id,
        user_id: inviteData.user.id,
        role,
      },
      { onConflict: "school_id,user_id" }
    );

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    message: `Invitación enviada a ${email}`,
  });
}
