import { isLocalMode } from "@/lib/data/mode";
import { getSolverInputFromLocal } from "@/lib/local-db/store";
import { createClient } from "@/lib/supabase/client";
import type {
  Course,
  CourseSubjectHours,
  SolverInput,
  Subject,
  Teacher,
  TeacherCourse,
  TeacherSubject,
  TeacherUnavailability,
  TimeSlot,
} from "@/types";

export async function fetchSolverInput(schoolId: string): Promise<SolverInput | null> {
  if (isLocalMode()) {
    return getSolverInputFromLocal(schoolId);
  }

  const supabase = createClient();
  const [
    { data: courses },
    { data: subjects },
    { data: teachers },
    { data: timeSlots },
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("school_id", schoolId),
    supabase.from("subjects").select("*").eq("school_id", schoolId),
    supabase.from("teachers").select("*").eq("school_id", schoolId),
    supabase.from("time_slots").select("*").eq("school_id", schoolId),
  ]);

  if (!courses?.length || !subjects?.length || !teachers?.length || !timeSlots?.length) {
    return null;
  }

  const teacherIds = teachers.map((t) => t.id);
  const courseIds = courses.map((c) => c.id);

  const [
    { data: teacherSubjects },
    { data: teacherCourses },
    { data: teacherUnavailability },
    { data: courseSubjectHours },
  ] = await Promise.all([
    supabase.from("teacher_subjects").select("*").in("teacher_id", teacherIds),
    supabase.from("teacher_courses").select("*").in("teacher_id", teacherIds),
    supabase.from("teacher_unavailability").select("*").in("teacher_id", teacherIds),
    supabase
      .from("course_subject_hours")
      .select("*")
      .in("course_id", courseIds)
      .gt("weekly_hours", 0),
  ]);

  if (!courseSubjectHours?.length) return null;

  return {
    courses: courses as Course[],
    subjects: subjects as Subject[],
    teachers: teachers as Teacher[],
    teacherSubjects: (teacherSubjects as TeacherSubject[]) ?? [],
    teacherCourses: (teacherCourses as TeacherCourse[]) ?? [],
    teacherUnavailability: (teacherUnavailability as TeacherUnavailability[]) ?? [],
    courseSubjectHours: courseSubjectHours as CourseSubjectHours[],
    timeSlots: timeSlots as TimeSlot[],
  };
}
