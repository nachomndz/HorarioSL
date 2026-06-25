import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Course,
  CourseSubjectHours,
  Cycle,
  RecessConfig,
  Subject,
  TimeSlot,
  TimetableSettings,
} from "@/types";

const HOURS_BY_CYCLE: Record<Cycle, Record<string, number>> = {
  infantil: {
    "Lengua Castellana": 4,
    Matemáticas: 3,
    Inglés: 2,
    "Educación Física": 2,
    Plástica: 2,
    Música: 2,
    Valores: 2,
  },
  primaria: {
    "Lengua Castellana": 5,
    Matemáticas: 4,
    Inglés: 3,
    "Ciencias Naturales": 2,
    "Ciencias Sociales": 2,
    "Educación Física": 2,
    Plástica: 1,
    Música: 1,
    Religión: 1,
    Valores: 1,
  },
  secundaria: {
    "Lengua Castellana": 4,
    Matemáticas: 4,
    Inglés: 3,
    "Ciencias Naturales": 3,
    "Ciencias Sociales": 3,
    "Educación Física": 2,
    Plástica: 1,
    Música: 1,
    Religión: 1,
    Valores: 1,
  },
  diversificacion: {
    "Lengua Castellana": 4,
    Matemáticas: 3,
    Inglés: 2,
    "Ciencias Naturales": 2,
    "Ciencias Sociales": 2,
    "Educación Física": 3,
    Plástica: 1,
    Música: 1,
    Religión: 1,
    Valores: 1,
  },
};
import { generateTimeSlots, countSessionSlots } from "@/lib/timetable";
import { DEFAULT_COURSES_TEMPLATE } from "@/lib/utils";

export type TimetableSettingsInput = {
  school_days: number[];
  day_start: string;
  day_end: string;
  session_duration_minutes: number;
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
  data: { name?: string; cycle?: Cycle }
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("courses").update(data).eq("id", courseId);
  if (error) return { error: error.message };
  return {};
}

export async function addCourse(
  schoolId: string,
  name: string,
  cycle: Cycle
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
  rows: { course_id: string; subject_id: string; weekly_hours: number }[]
): Promise<{ error?: string }> {
  const supabase = await getClient();
  const { error } = await supabase.from("course_subject_hours").upsert(rows, {
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
  const { courses, subjects } = await fetchSubjectsData(schoolId);
  if (!courses.length || !subjects.length) {
    return { error: "Configura cursos y asignaturas antes de cargar horas de ejemplo" };
  }

  const rows: { course_id: string; subject_id: string; weekly_hours: number }[] = [];
  for (const course of courses) {
    const template = HOURS_BY_CYCLE[course.cycle];
    for (const subject of subjects) {
      const weekly_hours = template[subject.name] ?? 0;
      if (weekly_hours > 0) {
        rows.push({ course_id: course.id, subject_id: subject.id, weekly_hours });
      }
    }
  }
  return upsertCourseSubjectHours(rows);
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
  ]);

  return {
    hasTimetable: (sessionSlots ?? 0) > 0,
    sessionSlots: sessionSlots ?? 0,
    hasHours: (hoursPositive ?? 0) > 0,
    hasTeachers: (teachers ?? 0) > 0,
    hasSchedule: (schedules ?? 0) > 0,
    courseCount: courses ?? 0,
    subjectCount: subjects ?? 0,
  };
}
