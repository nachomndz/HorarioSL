"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { isLocalMode } from "@/lib/data/mode";
import {
  resolveSupabaseEmail,
  SAN_LORENZO_PASSWORD,
  SAN_LORENZO_USERNAME,
} from "@/lib/auth/credentials";
import { localDb } from "@/lib/local-db/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function loginErrorMessage(errorMessage: string, enteredPassword: string): string {
    if (enteredPassword === "123456@SL") {
      return `Has escrito 123456@SL, pero la contraseña correcta es ${SAN_LORENZO_PASSWORD} (sin el 3 del medio).`;
    }
    if (errorMessage === "Invalid login credentials") {
      return `Usuario o contraseña incorrectos. Usuario: ${SAN_LORENZO_USERNAME}, contraseña: ${SAN_LORENZO_PASSWORD}`;
    }
    return errorMessage;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (isLocalMode()) {
      const { error } = await localDb.login(username, password);
      setLoading(false);
      if (error) {
        toast.error(error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: resolveSupabaseEmail(username),
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(loginErrorMessage(error.message, password));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full card-elevated">
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>
          {isLocalMode()
            ? "Acceso reservado al equipo del Colegio San Lorenzo."
            : "Accede a la plataforma de horarios del colegio."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <p className="font-medium">Acceso Colegio San Lorenzo</p>
          <p className="text-muted-foreground">
            Usuario: <span className="font-mono text-foreground">{SAN_LORENZO_USERNAME}</span>
          </p>
          <p className="text-muted-foreground">
            Contraseña: <span className="font-mono text-foreground">{SAN_LORENZO_PASSWORD}</span>
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder={SAN_LORENZO_USERNAME}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={SAN_LORENZO_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
