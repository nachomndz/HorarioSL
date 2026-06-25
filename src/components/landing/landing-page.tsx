import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Download,
  GraduationCap,
  Move,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: GraduationCap,
    title: "14 cursos configurables",
    description: "Plantilla 3+6+4+1: Infantil, Primaria, Secundaria y Diversificación.",
  },
  {
    icon: Users,
    title: "Profesores y restricciones",
    description: "Horas máximas, asignaturas, ámbito por ciclo y disponibilidad.",
  },
  {
    icon: Move,
    title: "Edición drag-and-drop",
    description: "Ajusta sesiones manualmente después de la generación automática.",
  },
  {
    icon: Download,
    title: "Exportación Excel",
    description: "Descarga horarios por profesor y por curso listos para imprimir.",
  },
];

export function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="font-serif text-xl font-semibold tracking-wide text-foreground">
            HorarioSL
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <section className="relative mx-auto w-full max-w-5xl px-6 pt-10 pb-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Horarios escolares sin complicaciones
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Configura la malla horaria, define horas por curso, asigna profesores y genera
              horarios respetando todas las restricciones. Edita con arrastrar y soltar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/registro">Crear colegio</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border card-elevated">
            <Image
              src="/images/colegio-fachada.png"
              alt="Colegio — vista exterior"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40 px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Todo lo que necesitas
          </h2>
          <p className="mt-2 text-muted-foreground">
            De la configuración inicial a la exportación final.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="card-elevated border-0">
                <CardContent className="flex gap-4 pt-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6 card-elevated">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">¿Listo para empezar?</p>
              <p className="text-sm text-muted-foreground">
                Crea tu colegio en menos de un minuto.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/registro">
              <BookOpen className="h-4 w-4" />
              Crear colegio gratis
            </Link>
          </Button>
        </div>
      </section>

      <footer className="mt-auto border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        <p>HorarioSL — Generador de horarios escolares</p>
      </footer>
    </main>
  );
}
