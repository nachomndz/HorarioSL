import type {
  Course,
  SolverInput,
  Teacher,
  TeacherCourse,
  TeacherSubject,
} from "@/types";
import { sessionsNeeded } from "@/lib/curriculum";
import { countAvailableMinutes } from "@/lib/timetable";
import { isDurationMultipleOfGranularity } from "@/lib/curriculum";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function teacherCanTeach(
  teacher: Teacher,
  teacherSubjects: TeacherSubject[],
  teacherCourses: TeacherCourse[],
  courses: Course[],
  courseId: string,
  subjectId: string
): boolean {
  const hasSubject = teacherSubjects.some(
    (ts) => ts.teacher_id === teacher.id && ts.subject_id === subjectId
  );
  if (!hasSubject) return false;

  const course = courses.find((c) => c.id === courseId);
  if (!course) return false;

  if (teacher.scope_type === "all") return true;
  if (teacher.scope_type === "cycle") {
    return teacher.scope_cycle === course.cycle;
  }
  return teacherCourses.some(
    (tc) => tc.teacher_id === teacher.id && tc.course_id === courseId
  );
}

function getEligibleTeachers(
  input: SolverInput,
  courseId: string,
  subjectId: string
): Teacher[] {
  return input.teachers.filter((t) =>
    teacherCanTeach(
      t,
      input.teacherSubjects,
      input.teacherCourses,
      input.courses,
      courseId,
      subjectId
    )
  );
}

function courseName(input: SolverInput, courseId: string): string {
  return input.courses.find((c) => c.id === courseId)?.name ?? courseId;
}

function subjectName(input: SolverInput, subjectId: string): string {
  const s = input.subjects.find((x) => x.id === subjectId);
  return s?.short_name || s?.name || subjectId;
}

function rowWeeklyMinutes(row: { weekly_minutes?: number; weekly_hours: number; session_duration_minutes?: number }): number {
  if (row.weekly_minutes && row.weekly_minutes > 0) return row.weekly_minutes;
  const duration = row.session_duration_minutes || 45;
  return row.weekly_hours * duration;
}

export function validateSolverInput(input: SolverInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockGranularity = input.blockGranularityMinutes || 15;

  if (!input.courses.length) {
    errors.push("No hay cursos configurados.");
  }
  if (!input.subjects.length) {
    errors.push("No hay asignaturas configuradas.");
  }
  if (!input.teachers.length) {
    errors.push("No hay profesores configurados.");
  }

  const sessionSlots = input.timeSlots.filter((s) => s.slot_type === "session");
  const availableMinutes = countAvailableMinutes(sessionSlots);
  if (!sessionSlots.length) {
    errors.push("La malla horaria no tiene franjas de sesión.");
  }

  const activeHours = input.courseSubjectHours.filter(
    (h) => rowWeeklyMinutes(h) > 0 || h.weekly_hours > 0
  );
  if (!activeHours.length) {
    errors.push("La matriz de horas no tiene ninguna hora asignada.");
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  let totalDemandMinutes = 0;
  const checkedCourses = new Set<string>();

  for (const row of activeHours) {
    const duration = row.session_duration_minutes || 45;
    const weeklyMinutes = rowWeeklyMinutes(row);
    const sessionCount = sessionsNeeded(weeklyMinutes, duration);
    totalDemandMinutes += weeklyMinutes;

    if (
      !isDurationMultipleOfGranularity(duration, blockGranularity)
    ) {
      warnings.push(
        `${subjectName(input, row.subject_id)}: duración ${duration} min no es múltiplo de la granularidad (${blockGranularity} min).`
      );
    }

    if (!checkedCourses.has(row.course_id)) {
      checkedCourses.add(row.course_id);
      const courseTotalMinutes = activeHours
        .filter((h) => h.course_id === row.course_id)
        .reduce((sum, h) => sum + rowWeeklyMinutes(h), 0);

      if (availableMinutes > 0 && courseTotalMinutes > availableMinutes) {
        errors.push(
          `${courseName(input, row.course_id)}: ${Math.round(courseTotalMinutes / 60)}h semanales pero solo hay ${Math.round(availableMinutes / 60)}h de franjas disponibles.`
        );
      }

      const courseTotalSessions = activeHours
        .filter((h) => h.course_id === row.course_id)
        .reduce(
          (sum, h) =>
            sum + sessionsNeeded(rowWeeklyMinutes(h), h.session_duration_minutes || 45),
          0
        );
      if (sessionSlots.length > 0 && courseTotalSessions > sessionSlots.length) {
        warnings.push(
          `${courseName(input, row.course_id)}: ${courseTotalSessions} sesiones pero solo ${sessionSlots.length} bloques base.`
        );
      }
    }

    const eligible = getEligibleTeachers(input, row.course_id, row.subject_id);
    if (eligible.length === 0) {
      errors.push(
        `${courseName(input, row.course_id)} · ${subjectName(input, row.subject_id)}: ningún profesor puede impartir esta asignatura en este curso.`
      );
    }

    void sessionCount;
  }

  const teacherDemandMinutes = new Map<string, number>();
  for (const row of activeHours) {
    const eligible = getEligibleTeachers(input, row.course_id, row.subject_id);
    if (eligible.length === 1) {
      const teacher = eligible[0];
      teacherDemandMinutes.set(
        teacher.id,
        (teacherDemandMinutes.get(teacher.id) ?? 0) + rowWeeklyMinutes(row)
      );
    }
  }

  for (const teacher of input.teachers) {
    const demandMinutes = teacherDemandMinutes.get(teacher.id) ?? 0;
    const demandHours = demandMinutes / 60;
    if (demandHours > teacher.max_weekly_hours) {
      errors.push(
        `${teacher.name}: la demanda mínima (${demandHours.toFixed(1)}h) supera su máximo semanal (${teacher.max_weekly_hours}h).`
      );
    }
  }

  const maxCapacityMinutes = availableMinutes * input.courses.length;
  if (totalDemandMinutes > maxCapacityMinutes) {
    warnings.push(
      `La demanda total (${Math.round(totalDemandMinutes / 60)}h) supera la capacidad teórica (${Math.round(maxCapacityMinutes / 60)}h). Puede ser imposible colocar todo.`
    );
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
