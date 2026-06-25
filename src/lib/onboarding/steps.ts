export type SetupDoneKey =
  | "hasTimetable"
  | "hasStages"
  | "hasCurriculum"
  | "courseCount"
  | "hasHours"
  | "hasTeachers"
  | "hasSchedule";

export interface SetupStepDefinition {
  id: string;
  href: string;
  label: string;
  description: string;
  doneKey: SetupDoneKey;
  /** Label for dashboard SetupProgress (slightly longer) */
  progressLabel: string;
  tourTarget?: string;
}

export const SETUP_STEPS: SetupStepDefinition[] = [
  {
    id: "malla",
    href: "/dashboard/configuracion/malla",
    label: "Malla horaria",
    progressLabel: "Malla horaria configurada",
    description: "Días, horarios y recreos",
    doneKey: "hasTimetable",
    tourTarget: "malla-save",
  },
  {
    id: "etapas",
    href: "/dashboard/configuracion/etapas",
    label: "Subciclos",
    progressLabel: "Subciclos definidos",
    description: "Ciclos dentro de cada etapa",
    doneKey: "hasStages",
    tourTarget: "etapas-seed",
  },
  {
    id: "curriculum",
    href: "/dashboard/configuracion/curriculum",
    label: "Currículo",
    progressLabel: "Currículo obligatorio",
    description: "Horas obligatorias por ley",
    doneKey: "hasCurriculum",
    tourTarget: "curriculum-template",
  },
  {
    id: "cursos",
    href: "/dashboard/cursos",
    label: "Cursos",
    progressLabel: "Cursos añadidos",
    description: "Grupos del centro",
    doneKey: "courseCount",
    tourTarget: "cursos-template",
  },
  {
    id: "asignaturas",
    href: "/dashboard/asignaturas",
    label: "Asignaturas",
    progressLabel: "Horas por curso definidas",
    description: "Matriz de horas semanales",
    doneKey: "hasHours",
    tourTarget: "asignaturas-matrix",
  },
  {
    id: "profesores",
    href: "/dashboard/profesores",
    label: "Profesores",
    progressLabel: "Profesores añadidos",
    description: "Restricciones y disponibilidad",
    doneKey: "hasTeachers",
    tourTarget: "profesores-add",
  },
  {
    id: "horario",
    href: "/dashboard/horarios",
    label: "Horarios",
    progressLabel: "Horario generado",
    description: "Generar horario automático",
    doneKey: "hasSchedule",
    tourTarget: "horarios-generate",
  },
];

export type SetupStatus = {
  hasTimetable: boolean;
  sessionSlots: number;
  hasHours: boolean;
  hasTeachers: boolean;
  hasSchedule: boolean;
  courseCount: number;
  subjectCount: number;
  hasStages: boolean;
  hasCurriculum: boolean;
};

export function isStepDone(step: SetupStepDefinition, status: SetupStatus | null): boolean {
  if (!status) return false;
  if (step.doneKey === "courseCount") return status.courseCount > 0;
  return Boolean(status[step.doneKey]);
}

export function buildProgressSteps(status: SetupStatus | null) {
  return SETUP_STEPS.map((step) => ({
    id: step.id,
    label: step.progressLabel,
    description: step.description,
    done: isStepDone(step, status),
    href: step.href,
  }));
}

export function getCurrentStepIndex(pathname: string): number {
  return SETUP_STEPS.findIndex(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`)
  );
}

export function getNextIncompleteStep(
  pathname: string,
  status: SetupStatus | null
): SetupStepDefinition | null {
  const currentIdx = getCurrentStepIndex(pathname);
  const startFrom = currentIdx >= 0 ? currentIdx + 1 : 0;
  for (let i = startFrom; i < SETUP_STEPS.length; i++) {
    if (!isStepDone(SETUP_STEPS[i], status)) return SETUP_STEPS[i];
  }
  return null;
}
