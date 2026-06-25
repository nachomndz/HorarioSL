import type { Cycle } from "@/types";

export interface StageTemplate {
  name: string;
  sortOrder: number;
}

export type ElectiveGroup = "asturias" | "religion";

export type PrimariaElectiveKey =
  | "lengua_asturiana"
  | "cultura_asturiana"
  | "religion"
  | "atencion_educativa";

export interface PrimariaElectiveChoices {
  asturias: "lengua_asturiana" | "cultura_asturiana";
  religion: "religion" | "atencion_educativa";
}

export const DEFAULT_PRIMARIA_ELECTIVES: PrimariaElectiveChoices = {
  asturias: "lengua_asturiana",
  religion: "religion",
};

/** Stable IDs for elective_group_id (local + Supabase). */
export const ELECTIVE_GROUP_ASTURIAS = "a1000001-0000-4000-8000-000000000001";
export const ELECTIVE_GROUP_RELIGION = "a1000001-0000-4000-8000-000000000002";

export const ELECTIVE_GROUP_BY_KEY: Record<ElectiveGroup, string> = {
  asturias: ELECTIVE_GROUP_ASTURIAS,
  religion: ELECTIVE_GROUP_RELIGION,
};

export interface CurriculumCellTemplate {
  subjectName: string;
  shortName: string;
  color: string;
  applicableCycles: Cycle[];
  hoursByStageIndex: (number | null)[];
  sessionDurationMinutes?: number;
  electiveGroup?: ElectiveGroup;
  electiveKey?: PrimariaElectiveKey;
}

export const DEFAULT_STAGES_BY_CYCLE: Record<Cycle, StageTemplate[]> = {
  infantil: [{ name: "Ciclo de Educación Infantil", sortOrder: 1 }],
  primaria: [
    { name: "Primer ciclo (1º y 2º)", sortOrder: 1 },
    { name: "Segundo ciclo (3º y 4º)", sortOrder: 2 },
    { name: "Tercer ciclo (5º y 6º)", sortOrder: 3 },
  ],
  secundaria: [
    { name: "1º–3º ESO", sortOrder: 1 },
    { name: "4º ESO", sortOrder: 2 },
  ],
  diversificacion: [{ name: "Diversificación", sortOrder: 1 }],
};

export const PRIMARIA_ANEXO_IV_META = {
  recessHoursPerWeek: 5,
  targetLectiveHoursPerWeek: 45,
  footnote:
    "Los padres o tutores legales elegirán una de las áreas al inicio de cada curso.",
};

/** Anexo IV — Educación Primaria (horas lectivas semanales por subciclo) */
export const PRIMARIA_ANEXO_IV: CurriculumCellTemplate[] = [
  {
    subjectName: "Ciencias de la Naturaleza",
    shortName: "CN",
    color: "#14b8a6",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [3, 3, 3],
  },
  {
    subjectName: "Ciencias Sociales",
    shortName: "CS",
    color: "#f59e0b",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [3, 3, 3],
  },
  {
    subjectName: "Educación Artística",
    shortName: "Plástica",
    color: "#ec4899",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [4, 4, 3.5],
  },
  {
    subjectName: "Educación Física",
    shortName: "EF",
    color: "#8b5cf6",
    applicableCycles: ["primaria", "secundaria", "diversificacion"],
    hoursByStageIndex: [4, 4, 4.5],
  },
  {
    subjectName: "Educación en Valores Cívicos y Éticos",
    shortName: "Valores",
    color: "#84cc16",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [null, null, 1.5],
  },
  {
    subjectName: "Lengua Castellana y Literatura",
    shortName: "Lengua",
    color: "#ef4444",
    applicableCycles: ["primaria", "secundaria", "diversificacion"],
    hoursByStageIndex: [11, 9.5, 8.5],
  },
  {
    subjectName: "Lengua Extranjera",
    shortName: "Inglés",
    color: "#22c55e",
    applicableCycles: ["primaria", "secundaria", "infantil", "diversificacion"],
    hoursByStageIndex: [6, 8, 8],
  },
  {
    subjectName: "Matemáticas",
    shortName: "Mates",
    color: "#3b82f6",
    applicableCycles: ["primaria", "secundaria", "infantil", "diversificacion"],
    hoursByStageIndex: [9, 8.5, 8],
  },
  {
    subjectName: "Lengua Asturiana y Literatura",
    shortName: "LA",
    color: "#0d9488",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [3, 3, 3],
    electiveGroup: "asturias",
    electiveKey: "lengua_asturiana",
  },
  {
    subjectName: "Cultura Asturiana",
    shortName: "Cultura",
    color: "#0f766e",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [3, 3, 3],
    electiveGroup: "asturias",
    electiveKey: "cultura_asturiana",
  },
  {
    subjectName: "Religión",
    shortName: "Religión",
    color: "#64748b",
    applicableCycles: ["primaria", "secundaria"],
    hoursByStageIndex: [2, 2, 2],
    electiveGroup: "religion",
    electiveKey: "religion",
  },
  {
    subjectName: "Atención educativa",
    shortName: "At. educ.",
    color: "#78716c",
    applicableCycles: ["primaria"],
    hoursByStageIndex: [2, 2, 2],
    electiveGroup: "religion",
    electiveKey: "atencion_educativa",
  },
];

export const DEFAULT_SESSION_DURATION = 45;

export function isElectiveActive(
  template: CurriculumCellTemplate,
  choices: PrimariaElectiveChoices
): boolean {
  if (!template.electiveGroup || !template.electiveKey) return true;
  return choices[template.electiveGroup] === template.electiveKey;
}

export function hoursForTemplateCell(
  template: CurriculumCellTemplate,
  stageIndex: number,
  choices: PrimariaElectiveChoices
): number | null {
  const raw = template.hoursByStageIndex[stageIndex];
  if (raw == null) return null;
  if (template.electiveGroup && !isElectiveActive(template, choices)) return 0;
  return raw;
}

/** Maps course name patterns to stage index within cycle */
export function inferStageIndexForCourse(courseName: string, cycle: Cycle): number {
  const n = courseName.toLowerCase();
  if (cycle === "primaria") {
    if (n.includes("1.") || n.includes("1º") || n.includes("2.") || n.includes("2º")) return 0;
    if (n.includes("3.") || n.includes("3º") || n.includes("4.") || n.includes("4º")) return 1;
    if (n.includes("5.") || n.includes("5º") || n.includes("6.") || n.includes("6º")) return 2;
    return 0;
  }
  if (cycle === "secundaria") {
    if (n.includes("4.") || n.includes("4º")) return 1;
    return 0;
  }
  return 0;
}
