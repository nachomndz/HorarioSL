"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (isLocalMode()) {
      const { error } = localDb.register(schoolName, email, password);
      setLoading(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Colegio creado (datos guardados en este navegador)");
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setLoading(false);
      toast.error(authError?.message ?? "Error al registrar usuario");
      return;
    }

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .insert({ name: schoolName })
      .select()
      .single();

    if (schoolError || !school) {
      setLoading(false);
      toast.error(schoolError?.message ?? "Error al crear colegio");
      return;
    }

    const { error: memberError } = await supabase.from("school_members").insert({
      school_id: school.id,
      user_id: authData.user.id,
      role: "admin",
    });

    if (memberError) {
      setLoading(false);
      toast.error(memberError.message);
      return;
    }

    const { error: seedError } = await supabase.rpc("seed_school_defaults", {
      p_school_id: school.id,
    });

    setLoading(false);

    if (seedError) {
      toast.error(`Colegio creado pero error al inicializar datos: ${seedError.message}`);
    } else {
      toast.success("Colegio creado correctamente");
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full card-elevated">
        <CardHeader>
          <CardTitle>Crear colegio</CardTitle>
          <CardDescription>
            {isLocalMode()
              ? "Los datos se guardarán en este navegador. No hace falta Supabase."
              : "Registra tu colegio y conviértete en el primer administrador."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">Nombre del colegio</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Tu email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando..." : "Crear colegio"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </CardContent>
      </Card>
  );
}
