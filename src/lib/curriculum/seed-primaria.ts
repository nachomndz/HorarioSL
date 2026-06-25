import type { CurriculumRequirement, FormativeStage, Subject } from "@/types";
import {
  DEFAULT_PRIMARIA_ELECTIVES,
  DEFAULT_SESSION_DURATION,
  ELECTIVE_GROUP_BY_KEY,
  PRIMARIA_ANEXO_IV,
  hoursForTemplateCell,
  type PrimariaElectiveChoices,
} from "./templates";

export type PrimariaSeedSubject = Pick<
  Subject,
  "id" | "school_id" | "name" | "short_name" | "color" | "applicable_cycles"
>;

export type PrimariaSeedRequirement = Omit<CurriculumRequirement, "id"> & { id?: string };

export interface PrimariaSeedResult {
  subjects: PrimariaSeedSubject[];
  requirements: PrimariaSeedRequirement[];
}

export function hasPrimariaCurriculum(
  stages: FormativeStage[],
  requirements: CurriculumRequirement[]
): boolean {
  const primariaStageIds = new Set(
    stages.filter((s) => s.cycle === "primaria").map((s) => s.id)
  );
  return requirements.some(
    (r) =>
      primariaStageIds.has(r.formative_stage_id) && Number(r.mandatory_weekly_hours) > 0
  );
}

export function buildPrimariaAnexoSeed(
  schoolId: string,
  stages: FormativeStage[],
  existingSubjects: Subject[],
  choices: PrimariaElectiveChoices = DEFAULT_PRIMARIA_ELECTIVES,
  createId: () => string = () => crypto.randomUUID()
): PrimariaSeedResult {
  const primariaStages = stages
    .filter((s) => s.cycle === "primaria")
    .sort((a, b) => a.sort_order - b.sort_order);

  if (primariaStages.length < 3) {
    throw new Error("Configura los subciclos de primaria primero");
  }

  const subjects: PrimariaSeedSubject[] = [];
  const subjectByName = new Map<string, PrimariaSeedSubject>();
  for (const s of existingSubjects) {
    subjectByName.set(s.name, s);
  }

  const requirements: PrimariaSeedRequirement[] = [];

  for (const template of PRIMARIA_ANEXO_IV) {
    let subject = subjectByName.get(template.subjectName);
    if (!subject) {
      subject = {
        id: createId(),
        school_id: schoolId,
        name: template.subjectName,
        short_name: template.shortName,
        color: template.color,
        applicable_cycles: template.applicableCycles,
      };
      subjectByName.set(template.subjectName, subject);
      subjects.push(subject);
    }

    const electiveGroupId = template.electiveGroup
      ? ELECTIVE_GROUP_BY_KEY[template.electiveGroup]
      : null;

    template.hoursByStageIndex.forEach((_, idx) => {
      const stage = primariaStages[idx];
      if (!stage) return;
      const hours = hoursForTemplateCell(template, idx, choices);
      if (hours == null) return;

      requirements.push({
        formative_stage_id: stage.id,
        subject_id: subject!.id,
        mandatory_weekly_hours: hours,
        session_duration_minutes: template.sessionDurationMinutes ?? DEFAULT_SESSION_DURATION,
        elective_group_id: electiveGroupId,
      });
    });
  }

  return { subjects, requirements };
}
