import type { CourseSubjectHours, CurriculumRequirement } from "@/types";
import { DEFAULT_SESSION_DURATION } from "./templates";

export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function sessionsNeeded(weeklyMinutes: number, sessionDurationMinutes: number): number {
  if (weeklyMinutes <= 0 || sessionDurationMinutes <= 0) return 0;
  return Math.ceil(weeklyMinutes / sessionDurationMinutes);
}

export function sessionsNeededFromHours(
  mandatoryWeeklyHours: number,
  sessionDurationMinutes: number
): number {
  return sessionsNeeded(hoursToMinutes(mandatoryWeeklyHours), sessionDurationMinutes);
}

export function weeklyMinutesFromRequirement(req: Pick<CurriculumRequirement, "mandatory_weekly_hours" | "session_duration_minutes">): number {
  return hoursToMinutes(Number(req.mandatory_weekly_hours));
}

export function courseHoursFromRequirement(
  courseId: string,
  req: CurriculumRequirement
): Omit<CourseSubjectHours, "id"> {
  const weeklyMinutes = weeklyMinutesFromRequirement(req);
  const duration = req.session_duration_minutes || DEFAULT_SESSION_DURATION;
  const weeklySessions = sessionsNeeded(weeklyMinutes, duration);
  return {
    course_id: courseId,
    subject_id: req.subject_id,
    weekly_hours: weeklySessions,
    weekly_minutes: weeklyMinutes,
    session_duration_minutes: duration,
  };
}

export function totalMandatoryHours(requirements: CurriculumRequirement[]): number {
  return requirements.reduce((sum, r) => sum + Number(r.mandatory_weekly_hours), 0);
}

const ELECTIVE_GROUP_ASTURIAS = "a1000001-0000-4000-8000-000000000001";
const ELECTIVE_GROUP_RELIGION = "a1000001-0000-4000-8000-000000000002";

/** Sum lective hours per stage, counting at most one elective per group. */
export function totalLectiveHoursByStage(
  requirements: CurriculumRequirement[],
  stageId: string
): number {
  const stageReqs = requirements.filter((r) => r.formative_stage_id === stageId);
  let sum = 0;
  const electiveMax = new Map<string, number>();

  for (const r of stageReqs) {
    const hours = Number(r.mandatory_weekly_hours);
    if (hours <= 0) continue;

    const groupId = r.elective_group_id;
    if (groupId === ELECTIVE_GROUP_ASTURIAS || groupId === ELECTIVE_GROUP_RELIGION) {
      electiveMax.set(groupId, Math.max(electiveMax.get(groupId) ?? 0, hours));
    } else {
      sum += hours;
    }
  }

  for (const h of electiveMax.values()) sum += h;
  return Math.round(sum * 10) / 10;
}

export { PRIMARIA_ANEXO_IV_META } from "./templates";

export function isDurationMultipleOfGranularity(
  sessionDurationMinutes: number,
  blockGranularityMinutes: number
): boolean {
  return sessionDurationMinutes % blockGranularityMinutes === 0;
}

export function blocksNeeded(sessionDurationMinutes: number, blockGranularityMinutes: number): number {
  return Math.ceil(sessionDurationMinutes / blockGranularityMinutes);
}
