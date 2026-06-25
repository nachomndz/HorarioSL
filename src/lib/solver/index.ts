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
import { orderBlocksByDay } from "@/lib/timetable";
import { blocksNeeded, sessionsNeeded } from "@/lib/curriculum";

function buildDemand(hours: CourseSubjectHours[], blockGranularity: number): SessionDemand[] {
  const demand: SessionDemand[] = [];
  for (const row of hours) {
    const duration = row.session_duration_minutes || 45;
    const weeklyMinutes = row.weekly_minutes || row.weekly_hours * duration;
    const count = sessionsNeeded(weeklyMinutes, duration);
    const blocks = blocksNeeded(duration, blockGranularity);
    for (let i = 0; i < count; i++) {
      demand.push({
        courseId: row.course_id,
        subjectId: row.subject_id,
        index: i,
        durationMinutes: duration,
        blocksNeeded: blocks,
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

function isTeacherUnavailableForBlocks(
  teacherId: string,
  blockIds: string[],
  unavailability: TeacherUnavailability[]
): boolean {
  return blockIds.some((slotId) =>
    unavailability.some((u) => u.teacher_id === teacherId && u.time_slot_id === slotId)
  );
}

function findBlockSequences(slots: TimeSlot[], blocksNeededCount: number): TimeSlot[][] {
  const sequences: TimeSlot[][] = [];
  const byDay = new Map<number, TimeSlot[]>();

  for (const slot of orderBlocksByDay(slots)) {
    const list = byDay.get(slot.day_of_week) ?? [];
    list.push(slot);
    byDay.set(slot.day_of_week, list);
  }

  for (const dayBlocks of byDay.values()) {
    for (let i = 0; i <= dayBlocks.length - blocksNeededCount; i++) {
      const slice = dayBlocks.slice(i, i + blocksNeededCount);
      const contiguous = slice.every((block, idx) => {
        if (idx === 0) return true;
        return block.sort_order === slice[idx - 1].sort_order + 1;
      });
      if (contiguous) sequences.push(slice);
    }
  }

  return sequences;
}

function sortDemand(demand: SessionDemand[], input: SolverInput): SessionDemand[] {
  return [...demand].sort((a, b) => {
    const teachersA = getEligibleTeachers(input, a.courseId, a.subjectId).length;
    const teachersB = getEligibleTeachers(input, b.courseId, b.subjectId).length;
    if (teachersA !== teachersB) return teachersA - teachersB;
    if (a.blocksNeeded !== b.blocksNeeded) return b.blocksNeeded - a.blocksNeeded;
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
  const blockGranularity = input.blockGranularityMinutes || 15;
  const sessionSlots = orderBlocksByDay(input.timeSlots);
  const demand = sortDemand(buildDemand(input.courseSubjectHours, blockGranularity), input);

  const placed: PlacedSession[] = [];
  const occupiedBlocks = new Set<string>();
  const teacherMinutes = new Map<string, number>();
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

    let sequences = findBlockSequences(sessionSlots, session.blocksNeeded);
    if (options?.randomizeSlots !== false) {
      sequences = [...sequences].sort(() => Math.random() - 0.5);
    }

    for (const sequence of sequences) {
      const blockIds = sequence.map((s) => s.id);
      if (blockIds.some((id) => occupiedBlocks.has(`${session.courseId}:${id}`))) continue;

      for (const teacher of eligibleTeachers) {
        if (isTeacherUnavailableForBlocks(teacher.id, blockIds, input.teacherUnavailability))
          continue;

        const currentMinutes = teacherMinutes.get(teacher.id) ?? 0;
        const nextMinutes = currentMinutes + session.durationMinutes;
        if (nextMinutes > teacher.max_weekly_hours * 60) continue;

        if (blockIds.some((id) => occupiedBlocks.has(`${teacher.id}:${id}`))) continue;

        placed.push({
          courseId: session.courseId,
          subjectId: session.subjectId,
          teacherId: teacher.id,
          timeSlotId: sequence[0].id,
          durationMinutes: session.durationMinutes,
          blockSlotIds: blockIds,
        });

        for (const id of blockIds) {
          occupiedBlocks.add(`${session.courseId}:${id}`);
          occupiedBlocks.add(`${teacher.id}:${id}`);
        }
        teacherMinutes.set(teacher.id, nextMinutes);

        if (backtrack(index + 1)) return true;

        placed.pop();
        for (const id of blockIds) {
          occupiedBlocks.delete(`${session.courseId}:${id}`);
          occupiedBlocks.delete(`${teacher.id}:${id}`);
        }
        teacherMinutes.set(teacher.id, currentMinutes);
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
