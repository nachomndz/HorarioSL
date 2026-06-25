"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import type { Feedback, FeedbackStatus } from "@/types";
import { PageLoadingSkeleton } from "@/components/layout/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function FeedbackPage() {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    if (isLocalMode()) {
      const ctx = localDb.getSchoolContext();
      const session = localDb.getSession();
      if (!ctx || !session) return;
      setSchoolId(ctx.schoolId);
      setUserId(session.userId);
      setIsAdmin(ctx.isAdmin);
      setFeedback(localDb.getSchoolData(ctx.schoolId).feedback);
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
    setUserId(user.id);
    setIsAdmin(member.role === "admin");

    const { data } = await supabase
      .from("feedback")
      .select("*")
      .eq("school_id", member.school_id)
      .order("created_at", { ascending: false });

    setFeedback((data as Feedback[]) ?? []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !userId || !title.trim() || !description.trim()) return;

    setSubmitting(true);

    if (isLocalMode()) {
      localDb.addFeedback(schoolId, userId, title, description);
      setSubmitting(false);
      setTitle("");
      setDescription("");
      toast.success("Sugerencia enviada. ¡Gracias!");
      loadFeedback();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.from("feedback").insert({
      school_id: schoolId,
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
    });

    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      setTitle("");
      setDescription("");
      toast.success("Sugerencia enviada. ¡Gracias!");
      loadFeedback();
    }
  }

  async function updateStatus(id: string, status: FeedbackStatus) {
    if (isLocalMode()) {
      localDb.updateFeedbackStatus(id, status);
      toast.success("Estado actualizado");
      loadFeedback();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Estado actualizado");
      loadFeedback();
    }
  }

  if (loading) return <PageLoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sugerencias de mejora</h1>
        <p className="text-muted-foreground">
          Comparte ideas para mejorar la plataforma. Las sugerencias quedan guardadas para seguir desarrollando.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva sugerencia</CardTitle>
          <CardDescription>Describe qué te gustaría mejorar o añadir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Exportar también en PDF"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explica con detalle tu sugerencia..."
                rows={4}
                required
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar sugerencia"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sugerencias registradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("es-ES")}
                  </p>
                </div>
                <Badge variant={item.status === "reviewed" ? "success" : "warning"}>
                  {item.status === "reviewed" ? "Revisada" : "Pendiente"}
                </Badge>
              </div>
              {isAdmin && item.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => updateStatus(item.id, "reviewed")}
                >
                  Marcar como revisada
                </Button>
              )}
            </div>
          ))}
          {feedback.length === 0 && (
            <p className="text-muted-foreground">Aún no hay sugerencias.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
