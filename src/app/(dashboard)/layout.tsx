"use client";

import { Suspense } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayoutSkeleton } from "@/components/layout/loading-skeletons";
import { LocalModeBanner } from "@/components/layout/local-mode-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OnboardingTourProvider } from "@/components/onboarding/onboarding-tour";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, context } = useSchoolContext();

  if (loading || !context) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <TooltipProvider>
      <Suspense fallback={null}>
        <OnboardingTourProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <div className="hidden md:block">
              <Sidebar schoolName={context.school.name} isAdmin={context.isAdmin} />
            </div>
            <div className="flex min-h-screen flex-1 flex-col">
              <MobileNav schoolName={context.school.name} isAdmin={context.isAdmin} />
              <main className="flex-1 overflow-auto">
                <div className="mx-auto max-w-6xl p-4 md:p-6">
                  <LocalModeBanner />
                  {children}
                </div>
              </main>
            </div>
          </div>
        </OnboardingTourProvider>
      </Suspense>
    </TooltipProvider>
  );
}
