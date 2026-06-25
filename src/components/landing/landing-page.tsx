import Link from "next/link";
import { Calendar, Download, GraduationCap, Lock, Move, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingHeroVisual } from "@/components/landing/landing-hero-visual";

const steps = [
  {
    num: "01",
    icon: GraduationCap,
    title: "Cursos ilimitados",
    description: "Configura los cursos que necesites, por ciclo y con el nombre que quieras.",
  },
  {
    num: "02",
    icon: Users,
    title: "Profesores y restricciones",
    description: "Horas máximas, asignaturas, ámbito por ciclo y disponibilidad.",
  },
  {
    num: "03",
    icon: Move,
    title: "Edición drag-and-drop",
    description: "Ajusta sesiones manualmente después de la generación automática.",
  },
  {
    num: "04",
    icon: Download,
    title: "Exportación a Excel",
    description: "Descarga horarios por profesor y por curso, listos para imprimir.",
  },
];

export function LandingPage() {
  return (
    <main className="font-landing flex min-h-screen flex-col bg-[#fbfaf6] text-[#13202b]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(19,65,85,0.08)] bg-[#fbfaf6]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <p className="text-base font-semibold tracking-tight sm:text-lg">
            Colegio San Lorenzo
            <span className="ml-2 font-normal text-[#6a6459]">· Gijón</span>
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[rgba(19,65,85,0.15)] bg-white text-[#1b556e] hover:bg-[#eef4f7]"
          >
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <section className="landing-hero-bg relative overflow-hidden pt-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-12 lg:grid-cols-2 lg:items-center lg:gap-8 lg:pb-24 lg:pt-20">
          <div className="relative z-10">
            <span className="inline-block rounded-full border border-[rgba(27,85,110,0.15)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#1b556e]">
              Herramienta interna
            </span>
            <h1 className="mt-5 font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-[#13202b] sm:text-6xl lg:text-7xl">
              HorarioSL
            </h1>
            <p className="mt-5 max-w-[460px] text-lg leading-relaxed text-[#4a5560] sm:text-[19px]">
              Genera la malla horaria del centro de principio a fin. Configura cursos y
              profesores, resuelve restricciones y exporta horarios listos para el curso.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[#1b556e] px-7 text-white hover:bg-[#164558]"
              >
                <Link href="/login">Acceder a la plataforma</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="text-[#1b556e] hover:bg-[#eef4f7]"
              >
                <Link href="#como-funciona">
                  Ver cómo funciona <span className="ml-1 text-lg leading-none">↓</span>
                </Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-[13px] text-[#8a8478]">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Acceso con las credenciales del colegio
            </p>
          </div>

          <LandingHeroVisual />
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 border-t border-[rgba(19,65,85,0.08)] bg-white px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-3xl font-semibold text-[#13202b] sm:text-4xl">
              Todo lo que necesitas
            </h2>
            <p className="mt-3 text-[#6a6459]">
              De la configuración inicial a la exportación final, en cuatro pasos.
            </p>
          </div>
          <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.num}
                className="landing-step-card rounded-[14px] border border-[rgba(19,65,85,0.09)] bg-white p-6"
              >
                <span className="text-3xl font-bold text-[rgba(27,85,110,0.15)]">{step.num}</span>
                <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef4f7] text-[#1b556e]">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-[#13202b]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6a6459]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1b556e] px-6 py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4 text-white">
            <Calendar className="h-10 w-10 shrink-0 opacity-90" />
            <div>
              <p className="text-lg font-medium">¿Listo para empezar?</p>
              <p className="text-sm text-white/80">Accede con tus credenciales del colegio.</p>
            </div>
          </div>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="shrink-0 bg-white text-[#1b556e] hover:bg-white/90"
          >
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </section>

      <footer className="mt-auto border-t border-[rgba(19,65,85,0.08)] bg-[#fbfaf6] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-sm text-[#6a6459] sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-serif text-base font-medium text-[#13202b]">HorarioSL</p>
            <p className="mt-1">Colegio San Lorenzo · Gijón</p>
            <p className="mt-1">Tránsito de San Vicente de Paúl, s/n · 33201 Gijón</p>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <a
              href="https://colegiosanlorenzogijon.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1b556e] hover:underline"
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
