"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  HelpCircle,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Table,
  Users,
  UserCog,
} from "lucide-react";
import { SETUP_STEPS, isStepDone } from "@/lib/onboarding/steps";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useTour } from "@/components/onboarding/onboarding-tour";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const configNav = [
  { href: "/dashboard/configuracion/malla", label: "Malla horaria", icon: Settings, stepId: "malla" },
  { href: "/dashboard/configuracion/etapas", label: "Subciclos", icon: Layers, stepId: "etapas" },
  {
    href: "/dashboard/configuracion/curriculum",
    label: "Currículo",
    icon: Table,
    stepId: "curriculum",
  },
  { href: "/dashboard/cursos", label: "Cursos", icon: GraduationCap, stepId: "cursos" },
  { href: "/dashboard/asignaturas", label: "Asignaturas", icon: BookOpen, stepId: "asignaturas" },
  { href: "/dashboard/profesores", label: "Profesores", icon: Users, stepId: "profesores" },
];

const mainNav = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/dashboard/horarios", label: "Horarios", icon: Calendar, stepId: "horario" },
  { href: "/dashboard/sugerencias", label: "Sugerencias", icon: MessageSquare },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  incomplete,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  incomplete?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {incomplete && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Pendiente" />
      )}
    </Link>
  );
}

export function Sidebar({ schoolName, isAdmin }: { schoolName: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSetupStatus();
  const { startTour } = useTour();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  function stepIncomplete(stepId: string) {
    const step = SETUP_STEPS.find((s) => s.id === stepId);
    if (!step || !status) return false;
    return !isStepDone(step, status);
  }

  async function handleLogout() {
    if (isLocalMode()) localDb.logout();
    else {
      const { createClient } = await import("@/lib/supabase/client");
      await (await createClient()).auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full min-h-screen w-64 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">HorarioSL</p>
        <h1 className="mt-1 text-base font-semibold leading-snug">{schoolName}</h1>
        <div className="mt-2 flex flex-wrap gap-1">
          {isAdmin && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Admin
            </span>
          )}
          {isLocalMode() && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              Local
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1">
          {mainNav.slice(0, 1).map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>

        <div id="nav-config">
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Configuración
          </p>
          <div className="space-y-1">
            {configNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={isActive(item.href)}
                incomplete={isAdmin && stepIncomplete(item.stepId)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Horarios
          </p>
          <div className="space-y-1">
            {mainNav.slice(1).map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={isActive(item.href)}
                incomplete={
                  isAdmin && item.stepId ? stepIncomplete(item.stepId) : false
                }
              />
            ))}
          </div>
        </div>

        {isAdmin && (
          <NavLink
            href="/dashboard/administradores"
            label="Administradores"
            icon={UserCog}
            active={isActive("/dashboard/administradores")}
          />
        )}
      </nav>

      <div className="space-y-1 border-t p-4">
        {isAdmin && (
          <Button variant="ghost" className="w-full justify-start" onClick={startTour}>
            <HelpCircle className="h-4 w-4" />
            Ver guía
          </Button>
        )}
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
