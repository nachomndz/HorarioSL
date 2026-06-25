import type {
  Course,
  SolverInput,
  Teacher,
  TeacherCourse,
  TeacherSubject,
} from "@/types";
import { countSessionSlots } from "@/lib/timetable";

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

export function validateSolverInput(input: SolverInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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
  const slotsPerWeek = countSessionSlots(sessionSlots);
  if (!sessionSlots.length) {
    errors.push("La malla horaria no tiene franjas de sesión.");
  }

  const activeHours = input.courseSubjectHours.filter((h) => h.weekly_hours > 0);
  if (!activeHours.length) {
    errors.push("La matriz de horas no tiene ninguna hora asignada.");
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  let totalDemand = 0;
  const checkedCourses = new Set<string>();

  for (const row of activeHours) {
    totalDemand += row.weekly_hours;

    if (!checkedCourses.has(row.course_id)) {
      checkedCourses.add(row.course_id);
      const courseTotal = activeHours
        .filter((h) => h.course_id === row.course_id)
        .reduce((sum, h) => sum + h.weekly_hours, 0);

      if (slotsPerWeek > 0 && courseTotal > slotsPerWeek) {
        errors.push(
          `${courseName(input, row.course_id)}: ${courseTotal}h semanales pero solo hay ${slotsPerWeek} franjas disponibles.`
        );
      }
    }

    const eligible = getEligibleTeachers(input, row.course_id, row.subject_id);
    if (eligible.length === 0) {
      errors.push(
        `${courseName(input, row.course_id)} · ${subjectName(input, row.subject_id)}: ningún profesor puede impartir esta asignatura en este curso.`
      );
    }
  }

  const teacherDemand = new Map<string, number>();
  for (const row of activeHours) {
    const eligible = getEligibleTeachers(input, row.course_id, row.subject_id);
    if (eligible.length === 1) {
      const teacher = eligible[0];
      teacherDemand.set(
        teacher.id,
        (teacherDemand.get(teacher.id) ?? 0) + row.weekly_hours
      );
    }
  }

  for (const teacher of input.teachers) {
    const demand = teacherDemand.get(teacher.id) ?? 0;
    if (demand > teacher.max_weekly_hours) {
      errors.push(
        `${teacher.name}: la demanda mínima (${demand}h) supera su máximo semanal (${teacher.max_weekly_hours}h).`
      );
    }
  }

  const maxCapacity = slotsPerWeek * input.courses.length;
  if (totalDemand > maxCapacity) {
    warnings.push(
      `La demanda total (${totalDemand} sesiones) supera la capacidad teórica (${maxCapacity} franjas×cursos). Puede ser imposible colocar todo.`
    );
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
