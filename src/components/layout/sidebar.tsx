"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isLocalMode } from "@/lib/data/mode";
import { localDb } from "@/lib/local-db/store";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const configNav = [
  { href: "/dashboard/configuracion/malla", label: "Malla horaria", icon: Settings },
  { href: "/dashboard/cursos", label: "Cursos", icon: GraduationCap },
  { href: "/dashboard/asignaturas", label: "Asignaturas", icon: BookOpen },
  { href: "/dashboard/profesores", label: "Profesores", icon: Users },
];

const mainNav = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/dashboard/horarios", label: "Horarios", icon: Calendar },
  { href: "/dashboard/sugerencias", label: "Sugerencias", icon: MessageSquare },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
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
      {label}
    </Link>
  );
}

export function Sidebar({ schoolName, isAdmin }: { schoolName: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

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

        <div>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Configuración
          </p>
          <div className="space-y-1">
            {configNav.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Horarios
          </p>
          <div className="space-y-1">
            {mainNav.slice(1).map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
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

      <div className="border-t p-4">
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
