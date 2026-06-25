import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Course,
  CourseSubjectHours,
  CurriculumRequirement,
  Cycle,
  FormativeStage,
  RecessConfig,
  Subject,
  TimeSlot,
  TimetableSettings,
} from "@/types";
import { courseHoursFromRequirement } from "@/lib/curriculum";
import {
  buildPrimariaAnexoSeed,
  hasPrimariaCurriculum,
} from "@/lib/curriculum/seed-primaria";
import {
  DEFAULT_STAGES_BY_CYCLE,
  DEFAULT_PRIMARIA_ELECTIVES,
  inferStageIndexForCourse,
  type PrimariaElectiveChoices,
} from "@/lib/curriculum/templates";
import { generateTimeSlots, countSessionSlots } from "@/lib/timetable";
import { DEFAULT_COURSES_TEMPLATE } from "@/lib/utils";

export type TimetableSettingsInput = {
  school_days: number[];
  day_start: string;
  day_end: string;
  session_duration_minutes: number;
  block_granularity_minutes: number;
  recesses: RecessConfig[];
};

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function toFormTime(t: string): string {
  return t.slice(0, 5);
}

async function getClient(): Promise<SupabaseClient> {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

export async function fetchCourses(schoolId: string): Promise<Course[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("school_id", schoolId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data as Course[]) ?? [];
}

export async function updateCourse(
  courseId: string,
  data: { name?: string; cycle?: Cycle; formative_stage_id?: string | null }
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("courses").update(data).eq("id", courseId);
  if (error) return { error: error.message };
  return {};
}

export async function addCourse(
  schoolId: string,
  name: string,
  cycle: Cycle,
  formativeStageId?: string | null
): Promise<{ course?: Course; error?: string }> {
  const supabase = await getClient();
  const courses = await fetchCourses(schoolId);
  const maxOrder = courses.reduce((m, c) => Math.max(m, c.sort_order), 0);
  const { data, error } = await supabase
    .from("courses")
    .insert({
      school_id: schoolId,
      name: name.trim(),
      cycle,
      formative_stage_id: formativeStageId ?? null,
      sort_order: maxOrder + 1,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { course: data as Course };
}

export async function deleteCourse(courseId: string): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return { error: error.message };
  return {};
}

export async function reorderCourse(
  courseId: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { data: course, error: fetchError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (fetchError || !course) return { error: fetchError?.message ?? "Curso no encontrado" };

  const siblings = await fetchCourses(course.school_id);
  const sameCycle = siblings
    .filter((c) => c.cycle === course.cycle)
    .sort((a, b) => a.sort_order - b.sort_order);
  const idx = sameCycle.findIndex((c) => c.id === courseId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sameCycle.length) return {};

  const other = sameCycle[swapIdx];
  const tmp = course.sort_order;
  await supabase.from("courses").update({ sort_order: other.sort_order }).eq("id", courseId);
  await supabase.from("courses").update({ sort_order: tmp }).eq("id", other.id);
  return {};
}

export async function seedDefaultCourses(
  schoolId: string,
  replace = false
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const existing = await fetchCourses(schoolId);

  if (replace && existing.length > 0) {
    const ids = existing.map((c) => c.id);
    await supabase.from("courses").delete().eq("school_id", schoolId);
    await supabase.from("course_subject_hours").delete().in("course_id", ids);
    await supabase.from("teacher_courses").delete().in("course_id", ids);
    await supabase.from("schedule_entries").delete().in("course_id", ids);
  } else if (existing.length > 0) {
    return {};
  }

  const rows = DEFAULT_COURSES_TEMPLATE.map((c, i) => ({
    school_id: schoolId,
    name: c.name,
    cycle: c.cycle,
    sort_order: i + 1,
  }));
  const { error } = await supabase.from("courses").insert(rows);
  if (error) return { error: error.message };
  await assignDefaultStagesToCourses(schoolId);
  return {};
}

export async function fetchTimetableSettings(
  schoolId: string
): Promise<TimetableSettingsInput | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("timetable_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as TimetableSettings;
  return {
    school_days: row.school_days,
    day_start: toFormTime(row.day_start),
    day_end: toFormTime(row.day_end),
    session_duration_minutes: row.session_duration_minutes,
    block_granularity_minutes: row.block_granularity_minutes ?? 15,
    recesses: row.recesses as RecessConfig[],
  };
}

export async function saveTimetableSettings(
  schoolId: string,
  settings: TimetableSettingsInput
): Promise<{ slotCount: number; error?: string }> {
  const supabase = await getClient();
  const payload = {
    school_days: settings.school_days,
    day_start: normalizeTime(settings.day_start),
    day_end: normalizeTime(settings.day_end),
    session_duration_minutes: settings.session_duration_minutes,
    block_granularity_minutes: settings.block_granularity_minutes,
    recesses: settings.recesses,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("timetable_settings")
    .select("id")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("timetable_settings")
      .update(payload)
      .eq("school_id", schoolId);
    if (error) return { slotCount: 0, error: error.message };
  } else {
    const { error } = await supabase.from("timetable_settings").insert({
      school_id: schoolId,
      ...payload,
    });
    if (error) return { slotCount: 0, error: error.message };
  }

  const generated = generateTimeSlots(schoolId, {
    school_days: settings.school_days,
    day_start: settings.day_start,
    day_end: settings.day_end,
    session_duration_minutes: settings.session_duration_minutes,
    block_granularity_minutes: settings.block_granularity_minutes,
    recesses: settings.recesses,
  });

  await supabase.from("time_slots").delete().eq("school_id", schoolId);

  if (generated.length > 0) {
    const { error: slotsError } = await supabase.from("time_slots").insert(
      generated.map((s) => ({
        school_id: s.school_id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        slot_type: s.slot_type,
        sort_order: s.sort_order,
        duration_minutes: s.duration_minutes,
      }))
    );
    if (slotsError) return { slotCount: 0, error: slotsError.message };
  }

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id")
    .eq("school_id", schoolId);
  const teacherIds = (teachers ?? []).map((t) => t.id);
  if (teacherIds.length > 0) {
    await supabase.from("teacher_unavailability").delete().in("teacher_id", teacherIds);
  }

  return { slotCount: countSessionSlots(generated) };
}

export async function fetchSubjectsData(schoolId: string) {
  const supabase = await getClient();
  const [{ data: subjects }, { data: courses }, { data: hours }, { data: slots }] =
    await Promise.all([
      supabase.from("subjects").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("courses").select("*").eq("school_id", schoolId).order("sort_order"),
      supabase.from("course_subject_hours").select("*"),
      supabase
        .from("time_slots")
        .select("*")
        .eq("school_id", schoolId)
        .eq("slot_type", "session"),
    ]);

  const courseIds = new Set((courses ?? []).map((c) => c.id));
  const filteredHours = ((hours as CourseSubjectHours[]) ?? []).filter((h) =>
    courseIds.has(h.course_id)
  );

  return {
    subjects: (subjects as Subject[]) ?? [],
    courses: (courses as Course[]) ?? [],
    hours: filteredHours,
    sessionSlotsPerWeek: countSessionSlots((slots as TimeSlot[]) ?? []),
  };
}

export async function addSubject(
  schoolId: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("subjects").insert({
    school_id: schoolId,
    name: name.trim(),
    short_name: name.trim().slice(0, 12),
    color: "#3b82f6",
  });
  if (error) return { error: error.message };
  return {};
}

export async function updateSubject(
  subjectId: string,
  data: { name?: string; short_name?: string; color?: string }
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("subjects").update(data).eq("id", subjectId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteSubject(subjectId: string): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) return { error: error.message };
  return {};
}

export async function upsertCourseSubjectHours(
  rows: {
    course_id: string;
    subject_id: string;
    weekly_hours: number;
    weekly_minutes?: number;
    session_duration_minutes?: number;
  }[]
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const payload = rows.map((r) => {
    const duration = r.session_duration_minutes ?? 45;
    const weeklyMinutes = r.weekly_minutes ?? r.weekly_hours * duration;
    return {
      course_id: r.course_id,
      subject_id: r.subject_id,
      weekly_hours: r.weekly_hours,
      weekly_minutes: weeklyMinutes,
      session_duration_minutes: duration,
    };
  });
  const { error } = await supabase.from("course_subject_hours").upsert(payload, {
    onConflict: "course_id,subject_id",
  });
  if (error) return { error: error.message };
  return {};
}

const DEFAULT_SUBJECTS = [
  ["Lengua Castellana", "Lengua", "#ef4444"],
  ["Matemáticas", "Mates", "#3b82f6"],
  ["Inglés", "Inglés", "#22c55e"],
  ["Ciencias Naturales", "CN", "#14b8a6"],
  ["Ciencias Sociales", "CS", "#f59e0b"],
  ["Educación Física", "EF", "#8b5cf6"],
  ["Plástica", "Plástica", "#ec4899"],
  ["Música", "Música", "#6366f1"],
  ["Religión", "Religión", "#64748b"],
  ["Valores", "Valores", "#84cc16"],
] as const;

export async function seedDefaultSubjects(
  schoolId: string
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { count } = await supabase
    .from("subjects")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);
  if ((count ?? 0) > 0) return { error: "Ya hay asignaturas configuradas" };

  const { error } = await supabase.from("subjects").insert(
    DEFAULT_SUBJECTS.map(([name, short_name, color]) => ({
      school_id: schoolId,
      name,
      short_name,
      color,
    }))
  );
  if (error) return { error: error.message };
  return {};
}

export async function seedDefaultHours(schoolId: string): Promise<{ error?: string }> {
  const result = await seedPrimariaInitialData(schoolId);
  if (result.error) return result;
  return {};
}

// --- Formative stages & curriculum ---

export async function fetchFormativeStages(schoolId: string): Promise<FormativeStage[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("formative_stages")
    .select("*")
    .eq("school_id", schoolId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data as FormativeStage[]) ?? [];
}

export async function fetchFormativeStagesByCycle(
  schoolId: string,
  cycle: Cycle
): Promise<FormativeStage[]> {
  const stages = await fetchFormativeStages(schoolId);
  return stages.filter((s) => s.cycle === cycle);
}

export async function addFormativeStage(
  schoolId: string,
  cycle: Cycle,
  name: string
): Promise<{ stage?: FormativeStage; error?: string }> {
  const supabase = await getClient();
  const existing = await fetchFormativeStagesByCycle(schoolId, cycle);
  const { data, error } = await supabase
    .from("formative_stages")
    .insert({
      school_id: schoolId,
      cycle,
      name: name.trim(),
      sort_order: existing.length + 1,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { stage: data as FormativeStage };
}

export async function updateFormativeStage(
  stageId: string,
  data: { name?: string; sort_order?: number }
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("formative_stages").update(data).eq("id", stageId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteFormativeStage(stageId: string): Promise<{ error?: string }> {
  const supabase = await getClient();
  await supabase.from("courses").update({ formative_stage_id: null }).eq("formative_stage_id", stageId);
  const { error } = await supabase.from("formative_stages").delete().eq("id", stageId);
  if (error) return { error: error.message };
  return {};
}

export async function seedDefaultFormativeStages(schoolId: string): Promise<{ error?: string }> {
  const supabase = await getClient();
  const existing = await fetchFormativeStages(schoolId);
  if (existing.length > 0) return {};

  const rows = (Object.entries(DEFAULT_STAGES_BY_CYCLE) as [Cycle, typeof DEFAULT_STAGES_BY_CYCLE[Cycle]][]).flatMap(
    ([cycle, templates]) =>
      templates.map((t) => ({
        school_id: schoolId,
        cycle,
        name: t.name,
        sort_order: t.sortOrder,
      }))
  );
  const { error } = await supabase.from("formative_stages").insert(rows);
  if (error) return { error: error.message };
  return {};
}

export async function assignDefaultStagesToCourses(schoolId: string): Promise<void> {
  const courses = await fetchCourses(schoolId);
  const stages = await fetchFormativeStages(schoolId);
  if (!stages.length) return;

  const supabase = await getClient();
  for (const course of courses) {
    if (course.formative_stage_id) continue;
    const cycleStages = stages
      .filter((s) => s.cycle === course.cycle)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = inferStageIndexForCourse(course.name, course.cycle);
    const stage = cycleStages[idx] ?? cycleStages[0];
    if (stage) {
      await supabase.from("courses").update({ formative_stage_id: stage.id }).eq("id", course.id);
    }
  }
}

export async function fetchCurriculumRequirements(
  formativeStageId: string
): Promise<CurriculumRequirement[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("curriculum_requirements")
    .select("*")
    .eq("formative_stage_id", formativeStageId);
  if (error) throw new Error(error.message);
  return (data as CurriculumRequirement[]) ?? [];
}

export async function fetchCurriculumMatrix(schoolId: string, cycle: Cycle) {
  const stages = await fetchFormativeStagesByCycle(schoolId, cycle);
  const supabase = await getClient();
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");

  const requirements: CurriculumRequirement[] = [];
  for (const stage of stages) {
    requirements.push(...(await fetchCurriculumRequirements(stage.id)));
  }

  return {
    stages,
    subjects: ((subjects as Subject[]) ?? []).filter(
      (s) => !s.applicable_cycles?.length || s.applicable_cycles.includes(cycle)
    ),
    requirements,
  };
}

export async function upsertCurriculumRequirement(
  formativeStageId: string,
  subjectId: string,
  data: {
    mandatory_weekly_hours: number;
    session_duration_minutes: number;
    elective_group_id?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("curriculum_requirements").upsert(
    {
      formative_stage_id: formativeStageId,
      subject_id: subjectId,
      mandatory_weekly_hours: data.mandatory_weekly_hours,
      session_duration_minutes: data.session_duration_minutes,
      elective_group_id: data.elective_group_id ?? null,
    },
    { onConflict: "formative_stage_id,subject_id" }
  );
  if (error) return { error: error.message };
  return {};
}

async function persistPrimariaAnexoSeed(
  schoolId: string,
  choices: PrimariaElectiveChoices = DEFAULT_PRIMARIA_ELECTIVES
): Promise<{ error?: string }> {
  await seedDefaultFormativeStages(schoolId);
  const stages = await fetchFormativeStages(schoolId);
  const supabase = await getClient();
  const { data: subjects } = await supabase.from("subjects").select("*").eq("school_id", schoolId);
  const subjectList = (subjects as Subject[]) ?? [];

  let seed;
  try {
    seed = buildPrimariaAnexoSeed(schoolId, stages, subjectList, choices);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al cargar Anexo IV" };
  }

  if (seed.subjects.length > 0) {
    const { error } = await supabase.from("subjects").insert(
      seed.subjects.map((s) => ({
        school_id: s.school_id,
        name: s.name,
        short_name: s.short_name,
        color: s.color,
        applicable_cycles: s.applicable_cycles,
      }))
    );
    if (error) return { error: error.message };
  }

  for (const req of seed.requirements) {
    const result = await upsertCurriculumRequirement(req.formative_stage_id, req.subject_id, {
      mandatory_weekly_hours: Number(req.mandatory_weekly_hours),
      session_duration_minutes: req.session_duration_minutes,
      elective_group_id: req.elective_group_id,
    });
    if (result.error) return result;
  }

  await assignDefaultStagesToCourses(schoolId);
  const primariaStages = stages
    .filter((s) => s.cycle === "primaria")
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const stage of primariaStages) {
    const result = await applyCurriculumToStage(stage.id);
    if (result.error) return result;
  }

  return {};
}

export async function seedPrimariaInitialData(
  schoolId: string
): Promise<{ error?: string; skipped?: boolean }> {
  await seedDefaultFormativeStages(schoolId);
  const stages = await fetchFormativeStages(schoolId);
  const supabase = await getClient();
  const { data: requirements } = await supabase.from("curriculum_requirements").select("*");
  const reqList = (requirements as CurriculumRequirement[]) ?? [];
  const schoolStageIds = new Set(stages.filter((s) => s.school_id === schoolId).map((s) => s.id));
  const schoolReqs = reqList.filter((r) => schoolStageIds.has(r.formative_stage_id));

  if (hasPrimariaCurriculum(stages, schoolReqs)) {
    return { skipped: true };
  }

  return persistPrimariaAnexoSeed(schoolId, DEFAULT_PRIMARIA_ELECTIVES);
}

export async function loadPrimariaAnexoTemplate(
  schoolId: string,
  choices: PrimariaElectiveChoices = DEFAULT_PRIMARIA_ELECTIVES
): Promise<{ error?: string }> {
  return persistPrimariaAnexoSeed(schoolId, choices);
}

export async function applyCurriculumToCourse(
  courseId: string
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (!course) return { error: "Curso no encontrado" };
  if (!course.formative_stage_id) return { error: "Asigna un subciclo al curso primero" };

  const requirements = await fetchCurriculumRequirements(course.formative_stage_id);
  const rows = requirements
    .filter((r) => Number(r.mandatory_weekly_hours) > 0)
    .map((r) => courseHoursFromRequirement(courseId, r));

  return upsertCourseSubjectHours(rows);
}

export async function applyCurriculumToStage(
  formativeStageId: string
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("formative_stage_id", formativeStageId);
  for (const course of courses ?? []) {
    const result = await applyCurriculumToCourse(course.id);
    if (result.error) return result;
  }
  return {};
}

export async function fetchSetupStatus(schoolId: string) {
  const supabase = await getClient();
  const schoolCourses = await fetchCourses(schoolId);
  const courseIds = schoolCourses.map((c) => c.id);

  const hoursQuery =
    courseIds.length > 0
      ? supabase
          .from("course_subject_hours")
          .select("*", { count: "exact", head: true })
          .in("course_id", courseIds)
          .gt("weekly_hours", 0)
      : Promise.resolve({ count: 0 });

  const [
    { count: sessionSlots },
    { count: hoursPositive },
    { count: teachers },
    { count: schedules },
    { count: courses },
    { count: subjects },
    { count: stages },
    { count: curriculum },
  ] = await Promise.all([
    supabase
      .from("time_slots")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("slot_type", "session"),
    hoursQuery,
    supabase
      .from("teachers")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("schedules")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("subjects")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("formative_stages")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("curriculum_requirements")
      .select("*", { count: "exact", head: true })
      .gt("mandatory_weekly_hours", 0),
  ]);

  return {
    hasTimetable: (sessionSlots ?? 0) > 0,
    sessionSlots: sessionSlots ?? 0,
    hasHours: (hoursPositive ?? 0) > 0,
    hasTeachers: (teachers ?? 0) > 0,
    hasSchedule: (schedules ?? 0) > 0,
    courseCount: courses ?? 0,
    subjectCount: subjects ?? 0,
    hasStages: (stages ?? 0) > 0,
    hasCurriculum: (curriculum ?? 0) > 0,
  };
}
