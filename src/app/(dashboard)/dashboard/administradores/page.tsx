"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import type { MemberRole } from "@/types";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MemberRow {
  id: string;
  role: MemberRole;
  user_id: string;
}

export default function AdminsPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("admin");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    if (isLocalMode()) {
      const ctx = localDb.getSchoolContext();
      if (!ctx) return;
      setSchoolId(ctx.schoolId);
      setIsAdmin(ctx.isAdmin);
      setMembers(localDb.getSchoolData(ctx.schoolId).schoolMembers);
      setLoading(false);
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("school_members")
      .select("school_id, role")
      .eq("user_id", user.id)
      .single();
    if (!member) return;

    setSchoolId(member.school_id);
    setIsAdmin(member.role === "admin");

    const { data } = await supabase
      .from("school_members")
      .select("id, role, user_id")
      .eq("school_id", member.school_id);

    setMembers((data as MemberRow[]) ?? []);
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !inviteEmail.trim()) return;

    if (isLocalMode()) {
      const { message } = localDb.inviteMember(schoolId, inviteEmail, inviteRole);
      toast.success(message);
      setInviteEmail("");
      loadMembers();
      return;
    }

    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error ?? "Error al invitar");
    else {
      toast.success(data.message ?? "Invitación enviada");
      setInviteEmail("");
      loadMembers();
    }
  }

  if (loading) return <PageLoadingSkeleton />;

  if (!isAdmin) {
    return (
      <p className="text-muted-foreground">
        Solo los administradores pueden gestionar miembros del colegio.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administradores</h1>
        <p className="text-muted-foreground">
          {isLocalMode()
            ? "En modo local, los usuarios invitados pueden entrar con contraseña temporal «invitado»."
            : "Invita a otros administradores o usuarios con acceso de lectura al colegio."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={(v: MemberRole) => setInviteRole(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="viewer">Solo lectura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Invitar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros actuales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span className="text-sm font-mono text-muted-foreground">
                {member.user_id.slice(0, 8)}...
              </span>
              <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                {member.role === "admin" ? "Administrador" : "Lectura"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
