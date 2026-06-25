"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Joyride, EVENTS, STATUS, type EventData, type Step } from "react-joyride";
import { useSchoolContext } from "@/hooks/use-school-context";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { SETUP_STEPS, isStepDone } from "@/lib/onboarding/steps";
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog";

export const TOUR_DONE_KEY = "horariosl-tour-v1-done";
export const TOUR_POSTPONED_KEY = "horariosl-tour-v1-postponed";

const TOUR_STEPS: Step[] = [
  {
    target: "#setup-progress",
    content: "Aquí ves el progreso de configuración del colegio.",
    skipBeacon: true,
  },
  {
    target: "#nav-config",
    content: "Sigue estos pasos en orden desde el menú de configuración.",
  },
  {
    target: '[data-tour="malla-save"]',
    content:
      "Guarda la malla horaria. Al guardar se regeneran las franjas y se resetea la disponibilidad de profesores.",
  },
  {
    target: '[data-tour="etapas-seed"]',
    content: "Define los subciclos de cada etapa (por ejemplo 1º+2º, 3º+4º).",
  },
  {
    target: '[data-tour="curriculum-template"]',
    content: "Carga las horas obligatorias por ley (Anexo IV) para cada subciclo.",
  },
  {
    target: '[data-tour="cursos-template"]',
    content: "Añade los cursos de tu centro y asígnalos a un subciclo.",
  },
  {
    target: '[data-tour="asignaturas-matrix"]',
    content:
      "Revisa las horas por curso en la matriz. El total no puede superar las franjas de la malla.",
  },
  {
    target: '[data-tour="profesores-add"]',
    content: "Añade profesores, asigna asignaturas y configura su disponibilidad.",
  },
  {
    target: '[data-tour="horarios-generate"]',
    content: "Cuando todo esté listo, genera el horario automático desde aquí.",
  },
];

type TourContextValue = {
  startTour: () => void;
};

const TourContext = createContext<TourContextValue>({ startTour: () => {} });

export function useTour() {
  return useContext(TourContext);
}

function isSetupComplete(status: ReturnType<typeof useSetupStatus>["status"]) {
  if (!status) return false;
  return SETUP_STEPS.every((step) => isStepDone(step, status));
}

export function OnboardingTourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { context } = useSchoolContext();
  const { status } = useSetupStatus();
  const [run, setRun] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const startTour = useCallback(() => {
    setWelcomeOpen(false);
    setRun(true);
  }, []);

  useEffect(() => {
    if (!mounted || !context?.isAdmin) return;
    if (typeof window === "undefined") return;

    const tourDone = localStorage.getItem(TOUR_DONE_KEY) === "1";
    const tourPostponed = localStorage.getItem(TOUR_POSTPONED_KEY) === "1";
    const forceTour = searchParams.get("tour") === "1";

    if (forceTour) {
      startTour();
      return;
    }

    if (tourDone || tourPostponed) return;
    if (pathname !== "/dashboard") return;
    if (isSetupComplete(status)) return;

    setWelcomeOpen(true);
  }, [mounted, context?.isAdmin, pathname, searchParams, status, startTour]);

  const joyrideSteps = useMemo(() => TOUR_STEPS, []);

  function handleJoyrideEvent(data: EventData) {
    if (
      data.type === EVENTS.TOUR_END ||
      data.status === STATUS.FINISHED ||
      data.status === STATUS.SKIPPED
    ) {
      setRun(false);
      if (typeof window !== "undefined") {
        localStorage.setItem(TOUR_DONE_KEY, "1");
      }
    }
  }

  function postponeTour() {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_POSTPONED_KEY, "1");
    }
    setWelcomeOpen(false);
  }

  if (!context?.isAdmin) {
    return <TourContext.Provider value={{ startTour: () => {} }}>{children}</TourContext.Provider>;
  }

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {mounted && (
        <>
          <WelcomeDialog
            open={welcomeOpen}
            onStart={startTour}
            onExplore={postponeTour}
          />
          <Joyride
            steps={joyrideSteps}
            run={run}
            continuous
            scrollToFirstStep
            onEvent={handleJoyrideEvent}
            locale={{
              back: "Atrás",
              close: "Cerrar",
              last: "Finalizar",
              next: "Siguiente",
              skip: "Saltar",
            }}
            options={{
              showProgress: true,
              buttons: ["back", "skip", "primary"],
              primaryColor: "#2563eb",
              zIndex: 10000,
            }}
          />
        </>
      )}
    </TourContext.Provider>
  );
}
