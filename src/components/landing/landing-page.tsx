import Image from "next/image";
import Link from "next/link";
import { Calendar, Download, GraduationCap, Move, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LandingScene } from "@/components/landing/landing-scene";

const features = [
  {
    icon: GraduationCap,
    title: "Cursos ilimitados",
    description: "Configura los cursos que necesites, por ciclo y con el nombre que quieras.",
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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-primary/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="font-serif text-lg font-semibold tracking-wide text-primary-foreground sm:text-xl">
            Colegio San Lorenzo
            <span className="ml-2 font-normal text-primary-foreground/80">· Gijón</span>
          </p>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="border-0 bg-white/15 text-primary-foreground hover:bg-white/25"
          >
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <section className="relative flex min-h-[70vh] items-end overflow-hidden pt-16">
        <Image
          src="/images/colegio-fachada.png"
          alt="Fachada del Colegio San Lorenzo, Gijón"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <LandingScene />
        <div className="landing-hero-overlay absolute inset-0 z-[2]" />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-12 pt-24 sm:pb-16">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
            Herramienta interna
          </p>
          <h1 className="mt-3 max-w-2xl font-serif text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            HorarioSL
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/90">
            Generador de horarios escolares para el equipo del colegio. Configura, genera y
            exporta con todas las restricciones de profesores y cursos.
          </p>
          <Button asChild size="lg" className="mt-8 bg-white text-primary hover:bg-white/90">
            <Link href="/login">Acceder a la plataforma</Link>
          </Button>
        </div>
      </section>

      <section className="border-b border-border bg-muted/30 px-6 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <blockquote className="font-serif text-2xl font-medium leading-snug text-foreground sm:text-3xl">
            «Un lugar para aprender, crecer y quedarse.»
          </blockquote>
          <p className="mt-4 text-muted-foreground">
            HorarioSL apoya la organización diaria del centro: malla horaria, asignaturas,
            profesores y horarios listos para el curso.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
              Todo lo que necesitas
            </h2>
            <p className="mt-2 text-muted-foreground">
              De la configuración inicial a la exportación final.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/80 card-elevated">
                <CardContent className="flex gap-4 pt-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary px-6 py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4 text-primary-foreground">
            <Calendar className="h-10 w-10 shrink-0 opacity-90" />
            <div>
              <p className="text-lg font-medium">¿Listo para empezar?</p>
              <p className="text-sm text-primary-foreground/80">
                Accede con tus credenciales del colegio.
              </p>
            </div>
          </div>
          <Button asChild size="lg" variant="secondary" className="shrink-0">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </section>

      <footer className="mt-auto border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-serif text-base font-medium text-foreground">HorarioSL</p>
            <p className="mt-1">Colegio San Lorenzo · Gijón</p>
            <p className="mt-1">Tránsito de San Vicente de Paúl, s/n · 33201 Gijón</p>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <a
              href="https://colegiosanlorenzogijon.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              colegiosanlorenzogijon.net
            </a>
            <p className="text-xs">© {new Date().getFullYear()} Colegio San Lorenzo</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
