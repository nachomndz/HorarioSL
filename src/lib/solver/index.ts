import type {
  Course,
  CourseSubjectHours,
  PlacedSession,
  SessionDemand,
  SolverInput,
  SolverResult,
  Teacher,
  TeacherCourse,
  TeacherSubject,
  TeacherUnavailability,
  TimeSlot,
  UnplacedSession,
} from "@/types";

interface AssignmentCandidate {
  timeSlotId: string;
  teacherId: string;
}

function buildDemand(hours: CourseSubjectHours[]): SessionDemand[] {
  const demand: SessionDemand[] = [];
  for (const row of hours) {
    for (let i = 0; i < row.weekly_hours; i++) {
      demand.push({
        courseId: row.course_id,
        subjectId: row.subject_id,
        index: i,
      });
    }
  }
  return demand;
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

function orderSessionSlots(slots: TimeSlot[], randomize: boolean): TimeSlot[] {
  const sessions = slots.filter((s) => s.slot_type === "session");
  if (randomize) {
    return [...sessions].sort(() => Math.random() - 0.5);
  }
  return [...sessions].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
    return a.start_time.localeCompare(b.start_time);
  });
}

function isTeacherUnavailable(
  teacherId: string,
  timeSlotId: string,
  unavailability: TeacherUnavailability[]
): boolean {
  return unavailability.some(
    (u) => u.teacher_id === teacherId && u.time_slot_id === timeSlotId
  );
}

function sortDemand(demand: SessionDemand[], input: SolverInput): SessionDemand[] {
  return [...demand].sort((a, b) => {
    const teachersA = getEligibleTeachers(input, a.courseId, a.subjectId).length;
    const teachersB = getEligibleTeachers(input, b.courseId, b.subjectId).length;
    if (teachersA !== teachersB) return teachersA - teachersB;
    return a.courseId.localeCompare(b.courseId);
  });
}

export function solveSchedule(
  input: SolverInput,
  options?: {
    maxIterations?: number;
    randomizeSlots?: boolean;
    onProgress?: (placed: number, total: number) => void;
  }
): SolverResult {
  const start = Date.now();
  const sessionSlots = orderSessionSlots(
    input.timeSlots,
    options?.randomizeSlots ?? false
  );
  const demand = sortDemand(buildDemand(input.courseSubjectHours), input);

  const placed: PlacedSession[] = [];
  const teacherSlotUsed = new Set<string>();
  const courseSlotUsed = new Set<string>();
  const teacherHours = new Map<string, number>();
  const unplaced: UnplacedSession[] = [];

  const maxIterations = options?.maxIterations ?? 500_000;
  let iterations = 0;

  function backtrack(index: number): boolean {
    if (index >= demand.length) return true;
    if (++iterations > maxIterations) return false;

    const session = demand[index];
    options?.onProgress?.(index, demand.length);

    const eligibleTeachers = getEligibleTeachers(
      input,
      session.courseId,
      session.subjectId
    );

    if (eligibleTeachers.length === 0) {
      unplaced.push({
        courseId: session.courseId,
        subjectId: session.subjectId,
        reason: "No hay profesor habilitado para esta asignatura y curso",
      });
      return backtrack(index + 1);
    }

    const shuffledSlots =
      options?.randomizeSlots === false
        ? sessionSlots
        : [...sessionSlots].sort(() => Math.random() - 0.5);

    for (const slot of shuffledSlots) {
      if (courseSlotUsed.has(`${session.courseId}:${slot.id}`)) continue;

      for (const teacher of eligibleTeachers) {
        const teacherSlotKey = `${teacher.id}:${slot.id}`;
        if (teacherSlotUsed.has(teacherSlotKey)) continue;
        if (isTeacherUnavailable(teacher.id, slot.id, input.teacherUnavailability))
          continue;

        const currentHours = teacherHours.get(teacher.id) ?? 0;
        if (currentHours >= teacher.max_weekly_hours) continue;

        placed.push({
          courseId: session.courseId,
          subjectId: session.subjectId,
          teacherId: teacher.id,
          timeSlotId: slot.id,
        });
        teacherSlotUsed.add(teacherSlotKey);
        courseSlotUsed.add(`${session.courseId}:${slot.id}`);
        teacherHours.set(teacher.id, currentHours + 1);

        if (backtrack(index + 1)) return true;

        placed.pop();
        teacherSlotUsed.delete(teacherSlotKey);
        courseSlotUsed.delete(`${session.courseId}:${slot.id}`);
        teacherHours.set(teacher.id, currentHours);
      }
    }

    unplaced.push({
      courseId: session.courseId,
      subjectId: session.subjectId,
      reason: "No se encontró franja disponible con las restricciones actuales",
    });
    return backtrack(index + 1);
  }

  backtrack(0);

  const finalUnplaced = unplaced.filter((u, i, arr) => {
    const key = `${u.courseId}:${u.subjectId}:${u.reason}`;
  const firstIndex = arr.findIndex(
      (x) => `${x.courseId}:${x.subjectId}:${x.reason}` === key
    );
    if (firstIndex !== i) return false;
    const demandCount = demand.filter(
      (d) => d.courseId === u.courseId && d.subjectId === u.subjectId
    ).length;
    const placedCount = placed.filter(
      (p) => p.courseId === u.courseId && p.subjectId === u.subjectId
    ).length;
    return placedCount < demandCount;
  });

  return {
    entries: placed,
    unplaced: finalUnplaced,
    stats: {
      total_sessions: demand.length,
      placed_sessions: placed.length,
      unplaced_sessions: demand.length - placed.length,
      duration_ms: Date.now() - start,
    },
  };
}

export function solveScheduleBest(
  input: SolverInput,
  options?: {
    attempts?: number;
    maxIterations?: number;
    onProgress?: (placed: number, total: number) => void;
  }
): SolverResult {
  const attempts = options?.attempts ?? 15;
  let best: SolverResult | null = null;

  for (let i = 0; i < attempts; i++) {
    const result = solveSchedule(input, {
      maxIterations: options?.maxIterations,
      randomizeSlots: i > 0,
      onProgress: options?.onProgress,
    });

    if (
      !best ||
      result.stats.placed_sessions > best.stats.placed_sessions ||
      (result.stats.placed_sessions === best.stats.placed_sessions &&
        result.unplaced.length < best.unplaced.length)
    ) {
      best = result;
    }

    if (best.stats.unplaced_sessions === 0) break;
  }

  return best!;
}

export function getUniqueSlotTimes(slots: TimeSlot[]): string[] {
  const sessions = slots.filter((s) => s.slot_type === "session");
  const times = new Set(sessions.map((s) => s.start_time));
  return Array.from(times).sort();
}

export function getDaysFromSlots(slots: TimeSlot[]): number[] {
  return Array.from(new Set(slots.map((s) => s.day_of_week))).sort((a, b) => a - b);
}
