import type { Cycle, RecessConfig, Schedule } from "@/types";
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
import {
  INVITADO_PASSWORD_HASH,
  SAN_LORENZO_LOGIN_ID,
  SAN_LORENZO_PASSWORD_HASH,
  SAN_LORENZO_SCHOOL_NAME,
  isSanLorenzoUsername,
} from "@/lib/auth/credentials";
import { hashPassword, isPasswordHash, verifyPassword } from "@/lib/auth/password";
import { generateTimeSlots } from "@/lib/timetable";
import { DEFAULT_COURSES_TEMPLATE } from "@/lib/utils";
import { DB_KEY, SESSION_KEY, newId, nowIso } from "./utils";
import type { LocalDatabase, LocalSession } from "./types";
import { emptyDatabase } from "./types";

function readDb(): LocalDatabase {
  if (typeof window === "undefined") return emptyDatabase();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDatabase();
    return { ...emptyDatabase(), ...JSON.parse(raw) };
  } catch {
    return emptyDatabase();
  }
}

function writeDb(db: LocalDatabase) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function readSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LocalSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: LocalSession | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    document.cookie = `horario-sl-session=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } else {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = "horario-sl-session=; path=/; max-age=0; SameSite=Lax";
  }
}

function generateSlotsForSchool(db: LocalDatabase, schoolId: string) {
  const settings = db.timetableSettings.find((t) => t.school_id === schoolId);
  if (!settings) return;
  db.timeSlots = db.timeSlots.filter((t) => t.school_id !== schoolId);
  const generated = generateTimeSlots(schoolId, {
    school_days: settings.school_days,
    day_start: settings.day_start.slice(0, 5),
    day_end: settings.day_end.slice(0, 5),
    session_duration_minutes: settings.session_duration_minutes,
    block_granularity_minutes: settings.block_granularity_minutes ?? 15,
    recesses: settings.recesses as RecessConfig[],
  });
  for (const slot of generated) {
    db.timeSlots.push({ id: newId(), ...slot });
  }
}


async function migrateUserPasswords(db: LocalDatabase): Promise<void> {
  let changed = false;
  for (const user of db.users) {
    if (isPasswordHash(user.password)) continue;

    if (user.email === SAN_LORENZO_LOGIN_ID) {
      user.password = SAN_LORENZO_PASSWORD_HASH;
    } else if (user.password === "invitado") {
      user.password = INVITADO_PASSWORD_HASH;
    } else {
      user.password = await hashPassword(user.password);
    }
    changed = true;
  }
  if (changed) writeDb(db);
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

function seedCourses(db: LocalDatabase, schoolId: string) {
  seedDefaultFormativeStages(db, schoolId);
  DEFAULT_COURSES_TEMPLATE.forEach((c, i) => {
    const cycleStages = db.formativeStages
      .filter((s) => s.school_id === schoolId && s.cycle === c.cycle)
      .sort((a, b) => a.sort_order - b.sort_order);
    const stageIdx = inferStageIndexForCourse(c.name, c.cycle);
    db.courses.push({
      id: newId(),
      school_id: schoolId,
      name: c.name,
      cycle: c.cycle,
      formative_stage_id: cycleStages[stageIdx]?.id ?? cycleStages[0]?.id ?? null,
      sort_order: i + 1,
      created_at: nowIso(),
    });
  });
}

function seedDefaultFormativeStages(db: LocalDatabase, schoolId: string) {
  if (db.formativeStages.some((s) => s.school_id === schoolId)) return;
  for (const [cycle, templates] of Object.entries(DEFAULT_STAGES_BY_CYCLE) as [
    Cycle,
    (typeof DEFAULT_STAGES_BY_CYCLE)[Cycle],
  ][]) {
    for (const t of templates) {
      db.formativeStages.push({
        id: newId(),
        school_id: schoolId,
        cycle,
        name: t.name,
        sort_order: t.sortOrder,
        created_at: nowIso(),
      });
    }
  }
}

function seedSchoolCore(db: LocalDatabase, schoolId: string) {
  if (!db.academicYears.some((y) => y.school_id === schoolId)) {
    const yearStart = new Date().getFullYear();
    db.academicYears.push({
      id: newId(),
      school_id: schoolId,
      name: `${yearStart}/${yearStart + 1}`,
      is_active: true,
      created_at: nowIso(),
    });
  }

  if (!db.timetableSettings.some((t) => t.school_id === schoolId)) {
    db.timetableSettings.push({
      id: newId(),
      school_id: schoolId,
      school_days: [1, 2, 3, 4, 5],
      day_start: "09:00:00",
      day_end: "16:00:00",
      session_duration_minutes: 45,
      block_granularity_minutes: 15,
      recesses: [{ start: "11:30", duration_minutes: 30 }] as RecessConfig[],
      updated_at: nowIso(),
    });
  }

  if (!db.timeSlots.some((t) => t.school_id === schoolId)) {
    generateSlotsForSchool(db, schoolId);
  }
}

function seedDefaultSubjects(db: LocalDatabase, schoolId: string) {
  for (const [name, short_name, color] of DEFAULT_SUBJECTS) {
    db.subjects.push({
      id: newId(),
      school_id: schoolId,
      name,
      short_name,
      color,
      applicable_cycles: ["infantil", "primaria", "secundaria", "diversificacion"],
      created_at: nowIso(),
    });
  }
}

function applyCurriculumToCourseLocal(db: LocalDatabase, courseId: string) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course?.formative_stage_id) return;
  const requirements = db.curriculumRequirements.filter(
    (r) => r.formative_stage_id === course.formative_stage_id
  );
  for (const req of requirements) {
    if (Number(req.mandatory_weekly_hours) <= 0) continue;
    const row = courseHoursFromRequirement(courseId, req);
    const existing = db.courseSubjectHours.find(
      (h) => h.course_id === courseId && h.subject_id === req.subject_id
    );
    if (existing) {
      Object.assign(existing, row);
    } else {
      db.courseSubjectHours.push({ id: newId(), ...row });
    }
  }
}

function applyPrimariaAnexoSeedLocal(
  db: LocalDatabase,
  schoolId: string,
  choices: PrimariaElectiveChoices = DEFAULT_PRIMARIA_ELECTIVES
): { error?: string } {
  seedDefaultFormativeStages(db, schoolId);
  const stages = db.formativeStages.filter((s) => s.school_id === schoolId);
  const existingSubjects = db.subjects.filter((s) => s.school_id === schoolId);

  let seed;
  try {
    seed = buildPrimariaAnexoSeed(schoolId, stages, existingSubjects, choices, newId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al cargar Anexo IV" };
  }

  for (const subject of seed.subjects) {
    db.subjects.push({ ...subject, created_at: nowIso() });
  }

  for (const req of seed.requirements) {
    const existing = db.curriculumRequirements.find(
      (r) =>
        r.formative_stage_id === req.formative_stage_id && r.subject_id === req.subject_id
    );
    if (existing) {
      existing.mandatory_weekly_hours = req.mandatory_weekly_hours;
      existing.session_duration_minutes = req.session_duration_minutes;
      existing.elective_group_id = req.elective_group_id;
    } else {
      db.curriculumRequirements.push({
        id: newId(),
        formative_stage_id: req.formative_stage_id,
        subject_id: req.subject_id,
        mandatory_weekly_hours: req.mandatory_weekly_hours,
        session_duration_minutes: req.session_duration_minutes,
        elective_group_id: req.elective_group_id,
      });
    }
  }

  for (const course of db.courses.filter((c) => c.school_id === schoolId)) {
    if (course.formative_stage_id) continue;
    const cycleStages = db.formativeStages
      .filter((s) => s.school_id === schoolId && s.cycle === course.cycle)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = inferStageIndexForCourse(course.name, course.cycle);
    course.formative_stage_id = cycleStages[idx]?.id ?? cycleStages[0]?.id ?? null;
  }

  const primariaStages = stages
    .filter((s) => s.cycle === "primaria")
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const stage of primariaStages) {
    const courses = db.courses.filter((c) => c.formative_stage_id === stage.id);
    for (const course of courses) applyCurriculumToCourseLocal(db, course.id);
  }

  return {};
}

function seedPrimariaInitialDataLocal(db: LocalDatabase, schoolId: string): { skipped?: boolean } {
  seedDefaultFormativeStages(db, schoolId);
  const stages = db.formativeStages.filter((s) => s.school_id === schoolId);
  const requirements = db.curriculumRequirements.filter((r) =>
    stages.some((s) => s.id === r.formative_stage_id)
  );
  if (hasPrimariaCurriculum(stages, requirements)) {
    return { skipped: true };
  }
  applyPrimariaAnexoSeedLocal(db, schoolId, DEFAULT_PRIMARIA_ELECTIVES);
  return {};
}

function seedDefaultTeachers(db: LocalDatabase, schoolId: string) {
  const subjects = db.subjects.filter((s) => s.school_id === schoolId);
  if (!subjects.length) return;

  const existing = db.teachers.filter((t) => t.school_id === schoolId);
  if (existing.length > 0) {
    for (const teacher of existing) {
      if (teacher.max_weekly_hours < 45) {
        teacher.max_weekly_hours = 45;
      }
    }
    return;
  }

  for (const subject of subjects) {
    const teacher = {
      id: newId(),
      school_id: schoolId,
      name: `Prof. ${subject.short_name || subject.name}`,
      max_weekly_hours: 45,
      notes: null,
      scope_type: "all" as const,
      scope_cycle: null,
      created_at: nowIso(),
    };
    db.teachers.push(teacher);
    db.teacherSubjects.push({ teacher_id: teacher.id, subject_id: subject.id });
  }
}

function seedScheduleInput(db: LocalDatabase, schoolId: string) {
  if (!db.courses.some((c) => c.school_id === schoolId)) {
    seedCourses(db, schoolId);
  }
  seedPrimariaInitialDataLocal(db, schoolId);
  if (!db.teachers.some((t) => t.school_id === schoolId)) {
    seedDefaultTeachers(db, schoolId);
  }
}

function ensureSanLorenzoSchool(db: LocalDatabase): string {
  let school = db.schools.find((s) => s.name === SAN_LORENZO_SCHOOL_NAME);
  let schoolId: string;

  if (!school) {
    schoolId = newId();
    db.schools.push({
      id: schoolId,
      name: SAN_LORENZO_SCHOOL_NAME,
      created_at: nowIso(),
    });
    seedSchoolCore(db, schoolId);
    seedScheduleInput(db, schoolId);
  } else {
    schoolId = school.id;
    seedSchoolCore(db, schoolId);
    seedScheduleInput(db, schoolId);
  }

  let user = db.users.find((u) => u.email === SAN_LORENZO_LOGIN_ID);
  if (!user) {
    user = {
      id: newId(),
      email: SAN_LORENZO_LOGIN_ID,
      password: SAN_LORENZO_PASSWORD_HASH,
    };
    db.users.push(user);
  } else if (!isPasswordHash(user.password)) {
    user.password = SAN_LORENZO_PASSWORD_HASH;
  }

  if (
    !db.schoolMembers.some(
      (m) => m.school_id === schoolId && m.user_id === user!.id
    )
  ) {
    db.schoolMembers.push({
      id: newId(),
      school_id: schoolId,
      user_id: user.id,
      role: "admin",
      created_at: nowIso(),
    });
  }

  return user.id;
}

export const localDb = {
  getSession(): LocalSession | null {
    return readSession();
  },

  login: async (username: string, password: string): Promise<{ error?: string }> => {
    if (!isSanLorenzoUsername(username)) {
      return { error: "Usuario o contraseña incorrectos" };
    }

    const passwordOk = await verifyPassword(password, SAN_LORENZO_PASSWORD_HASH);
    if (!passwordOk) {
      return { error: "Usuario o contraseña incorrectos" };
    }

    const db = readDb();
    await migrateUserPasswords(db);
    const userId = ensureSanLorenzoSchool(db);
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return { error: "Error al inicializar el colegio" };
    }

    const session = { userId: user.id, email: user.email };
    writeSession(session);
    db.session = session;
    writeDb(db);
    return {};
  },

  logout() {
    const db = readDb();
    db.session = null;
    writeDb(db);
    writeSession(null);
  },

  getSchoolContext() {
    const session = readSession();
    if (!session) return null;

    const db = readDb();
    const member = db.schoolMembers.find((m) => m.user_id === session.userId);
    if (!member) return null;

    const school = db.schools.find((s) => s.id === member.school_id);
    if (!school) return null;

    return {
      school,
      member,
      isAdmin: member.role === "admin",
      schoolId: school.id,
    };
  },

  // --- Schools data accessors ---
  getSchoolData(schoolId: string) {
    const db = readDb();
    return {
      formativeStages: db.formativeStages
        .filter((s) => s.school_id === schoolId)
        .sort((a, b) => a.sort_order - b.sort_order),
      curriculumRequirements: db.curriculumRequirements.filter((r) =>
        db.formativeStages.some((s) => s.id === r.formative_stage_id && s.school_id === schoolId)
      ),
      courses: db.courses.filter((c) => c.school_id === schoolId).sort((a, b) => a.sort_order - b.sort_order),
      subjects: db.subjects.filter((s) => s.school_id === schoolId).sort((a, b) => a.name.localeCompare(b.name)),
      teachers: db.teachers.filter((t) => t.school_id === schoolId).sort((a, b) => a.name.localeCompare(b.name)),
      timeSlots: db.timeSlots.filter((t) => t.school_id === schoolId),
      timetableSettings: db.timetableSettings.find((t) => t.school_id === schoolId) ?? null,
      academicYears: db.academicYears.filter((y) => y.school_id === schoolId),
      schedules: db.schedules.filter((s) => s.school_id === schoolId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      feedback: db.feedback.filter((f) => f.school_id === schoolId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      schoolMembers: db.schoolMembers.filter((m) => m.school_id === schoolId),
      courseSubjectHours: db.courseSubjectHours.filter((h) =>
        db.courses.some((c) => c.id === h.course_id && c.school_id === schoolId)
      ),
      teacherSubjects: db.teacherSubjects.filter((ts) =>
        db.teachers.some((t) => t.id === ts.teacher_id && t.school_id === schoolId)
      ),
      teacherCourses: db.teacherCourses.filter((tc) =>
        db.teachers.some((t) => t.id === tc.teacher_id && t.school_id === schoolId)
      ),
      teacherUnavailability: db.teacherUnavailability.filter((tu) =>
        db.teachers.some((t) => t.id === tu.teacher_id && t.school_id === schoolId)
      ),
      scheduleEntries: db.scheduleEntries,
    };
  },

  updateCourse(courseId: string, data: { name?: string; cycle?: Cycle; formative_stage_id?: string | null }) {
    const db = readDb();
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) return { error: "Curso no encontrado" };
    if (data.name !== undefined) course.name = data.name;
    if (data.cycle !== undefined) course.cycle = data.cycle;
    if (data.formative_stage_id !== undefined) course.formative_stage_id = data.formative_stage_id;
    writeDb(db);
    return {};
  },

  addCourse(schoolId: string, name: string, cycle: Cycle, formativeStageId?: string | null) {
    const db = readDb();
    const maxOrder = db.courses
      .filter((c) => c.school_id === schoolId)
      .reduce((m, c) => Math.max(m, c.sort_order), 0);
    const course = {
      id: newId(),
      school_id: schoolId,
      name: name.trim(),
      cycle,
      formative_stage_id: formativeStageId ?? null,
      sort_order: maxOrder + 1,
      created_at: nowIso(),
    };
    db.courses.push(course);
    writeDb(db);
    return course;
  },

  deleteCourse(courseId: string) {
    const db = readDb();
    db.courses = db.courses.filter((c) => c.id !== courseId);
    db.courseSubjectHours = db.courseSubjectHours.filter((h) => h.course_id !== courseId);
    db.teacherCourses = db.teacherCourses.filter((tc) => tc.course_id !== courseId);
    db.scheduleEntries = db.scheduleEntries.filter((e) => e.course_id !== courseId);
    writeDb(db);
    return {};
  },

  reorderCourse(courseId: string, direction: "up" | "down") {
    const db = readDb();
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) return { error: "Curso no encontrado" };
    const siblings = db.courses
      .filter((c) => c.school_id === course.school_id && c.cycle === course.cycle)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((c) => c.id === courseId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return {};
    const other = siblings[swapIdx];
    const tmp = course.sort_order;
    course.sort_order = other.sort_order;
    other.sort_order = tmp;
    writeDb(db);
    return {};
  },

  seedDefaultCourses(schoolId: string, replace = false) {
    const db = readDb();
    if (replace) {
      const ids = db.courses.filter((c) => c.school_id === schoolId).map((c) => c.id);
      db.courses = db.courses.filter((c) => c.school_id !== schoolId);
      db.courseSubjectHours = db.courseSubjectHours.filter((h) => !ids.includes(h.course_id));
      db.teacherCourses = db.teacherCourses.filter((tc) => !ids.includes(tc.course_id));
      db.scheduleEntries = db.scheduleEntries.filter((e) => !ids.includes(e.course_id));
    }
    const existing = db.courses.filter((c) => c.school_id === schoolId).length;
    if (existing === 0 || replace) {
      if (replace || existing === 0) seedCourses(db, schoolId);
    }
    writeDb(db);
    return {};
  },

  seedDefaultSubjects(schoolId: string) {
    const db = readDb();
    const existing = db.subjects.filter((s) => s.school_id === schoolId).length;
    if (existing > 0) {
      return { error: "Ya hay asignaturas configuradas" };
    }
    seedDefaultSubjects(db, schoolId);
    writeDb(db);
    return {};
  },

  seedDefaultTeachers(schoolId: string) {
    const db = readDb();
    if (!db.subjects.some((s) => s.school_id === schoolId)) {
      return { error: "Añade asignaturas antes de cargar profesores de ejemplo" };
    }
    seedDefaultTeachers(db, schoolId);
    writeDb(db);
    return {};
  },

  seedDefaultHours(schoolId: string) {
    const db = readDb();
    const courses = db.courses.filter((c) => c.school_id === schoolId);
    if (!courses.length) {
      return { error: "Configura cursos antes de cargar horas de ejemplo" };
    }
    seedPrimariaInitialDataLocal(db, schoolId);
    writeDb(db);
    return {};
  },

  getFormativeStages(schoolId: string, cycle?: Cycle) {
    const db = readDb();
    let stages = db.formativeStages
      .filter((s) => s.school_id === schoolId)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (cycle) stages = stages.filter((s) => s.cycle === cycle);
    return stages;
  },

  seedDefaultFormativeStages(schoolId: string) {
    const db = readDb();
    seedDefaultFormativeStages(db, schoolId);
    writeDb(db);
    return {};
  },

  addFormativeStage(schoolId: string, cycle: Cycle, name: string) {
    const db = readDb();
    const maxOrder = db.formativeStages.filter((s) => s.school_id === schoolId && s.cycle === cycle).length;
    const stage = {
      id: newId(),
      school_id: schoolId,
      cycle,
      name: name.trim(),
      sort_order: maxOrder + 1,
      created_at: nowIso(),
    };
    db.formativeStages.push(stage);
    writeDb(db);
    return stage;
  },

  updateFormativeStage(stageId: string, data: { name?: string }) {
    const db = readDb();
    const stage = db.formativeStages.find((s) => s.id === stageId);
    if (!stage) return { error: "Subciclo no encontrado" };
    if (data.name !== undefined) stage.name = data.name;
    writeDb(db);
    return {};
  },

  deleteFormativeStage(stageId: string) {
    const db = readDb();
    db.courses.forEach((c) => {
      if (c.formative_stage_id === stageId) c.formative_stage_id = null;
    });
    db.formativeStages = db.formativeStages.filter((s) => s.id !== stageId);
    db.curriculumRequirements = db.curriculumRequirements.filter(
      (r) => r.formative_stage_id !== stageId
    );
    writeDb(db);
    return {};
  },

  upsertCurriculumRequirement(
    formativeStageId: string,
    subjectId: string,
    mandatoryWeeklyHours: number,
    sessionDurationMinutes: number,
    electiveGroupId: string | null = null
  ) {
    const db = readDb();
    const existing = db.curriculumRequirements.find(
      (r) => r.formative_stage_id === formativeStageId && r.subject_id === subjectId
    );
    if (existing) {
      existing.mandatory_weekly_hours = mandatoryWeeklyHours;
      existing.session_duration_minutes = sessionDurationMinutes;
      if (electiveGroupId !== undefined) existing.elective_group_id = electiveGroupId;
    } else {
      db.curriculumRequirements.push({
        id: newId(),
        formative_stage_id: formativeStageId,
        subject_id: subjectId,
        mandatory_weekly_hours: mandatoryWeeklyHours,
        session_duration_minutes: sessionDurationMinutes,
        elective_group_id: electiveGroupId,
      });
    }
    writeDb(db);
    return {};
  },

  seedPrimariaInitialData(schoolId: string) {
    const db = readDb();
    const result = seedPrimariaInitialDataLocal(db, schoolId);
    writeDb(db);
    return result;
  },

  loadPrimariaAnexoTemplate(
    schoolId: string,
    choices: PrimariaElectiveChoices = DEFAULT_PRIMARIA_ELECTIVES
  ) {
    const db = readDb();
    const result = applyPrimariaAnexoSeedLocal(db, schoolId, choices);
    writeDb(db);
    return result;
  },

  applyCurriculumToCourse(courseId: string) {
    const db = readDb();
    applyCurriculumToCourseLocal(db, courseId);
    writeDb(db);
    return {};
  },

  applyCurriculumToStage(formativeStageId: string) {
    const db = readDb();
    const courses = db.courses.filter((c) => c.formative_stage_id === formativeStageId);
    for (const course of courses) applyCurriculumToCourseLocal(db, course.id);
    writeDb(db);
    return {};
  },

  updateSubject(
    subjectId: string,
    data: { name?: string; short_name?: string; color?: string }
  ) {
    const db = readDb();
    const subject = db.subjects.find((s) => s.id === subjectId);
    if (!subject) return { error: "Asignatura no encontrada" };
    if (data.name !== undefined) subject.name = data.name;
    if (data.short_name !== undefined) subject.short_name = data.short_name;
    if (data.color !== undefined) subject.color = data.color;
    writeDb(db);
    return {};
  },

  getSetupStatus(schoolId: string) {
    const data = localDb.getSchoolData(schoolId);
    const sessionSlots = data.timeSlots.filter((s) => s.slot_type === "session").length;
    const hasHours = data.courseSubjectHours.some((h) => h.weekly_hours > 0);
    return {
      hasTimetable: sessionSlots > 0,
      sessionSlots,
      hasHours,
      hasTeachers: data.teachers.length > 0,
      hasSchedule: data.schedules.length > 0,
      courseCount: data.courses.length,
      subjectCount: data.subjects.length,
      hasStages: data.formativeStages.length > 0,
      hasCurriculum: data.curriculumRequirements.some((r) => Number(r.mandatory_weekly_hours) > 0),
    };
  },

  addSubject(schoolId: string, name: string) {
    const db = readDb();
    db.subjects.push({
      id: newId(),
      school_id: schoolId,
      name: name.trim(),
      short_name: name.trim().slice(0, 12),
      color: "#3b82f6",
      applicable_cycles: ["infantil", "primaria", "secundaria", "diversificacion"],
      created_at: nowIso(),
    });
    writeDb(db);
    return {};
  },

  deleteSubject(subjectId: string) {
    const db = readDb();
    db.subjects = db.subjects.filter((s) => s.id !== subjectId);
    db.courseSubjectHours = db.courseSubjectHours.filter((h) => h.subject_id !== subjectId);
    db.teacherSubjects = db.teacherSubjects.filter((ts) => ts.subject_id !== subjectId);
    db.scheduleEntries = db.scheduleEntries.filter((e) => e.subject_id !== subjectId);
    writeDb(db);
    return {};
  },

  upsertCourseSubjectHours(
    rows: {
      course_id: string;
      subject_id: string;
      weekly_hours: number;
      weekly_minutes?: number;
      session_duration_minutes?: number;
    }[]
  ) {
    const db = readDb();
    for (const row of rows) {
      const duration = row.session_duration_minutes ?? 45;
      const weeklyMinutes = row.weekly_minutes ?? row.weekly_hours * duration;
      const existing = db.courseSubjectHours.find(
        (h) => h.course_id === row.course_id && h.subject_id === row.subject_id
      );
      if (existing) {
        existing.weekly_hours = row.weekly_hours;
        existing.weekly_minutes = weeklyMinutes;
        existing.session_duration_minutes = duration;
      } else {
        db.courseSubjectHours.push({
          id: newId(),
          course_id: row.course_id,
          subject_id: row.subject_id,
          weekly_hours: row.weekly_hours,
          weekly_minutes: weeklyMinutes,
          session_duration_minutes: duration,
        });
      }
    }
    writeDb(db);
    return {};
  },

  saveTimetableSettings(
    schoolId: string,
    settings: {
      school_days: number[];
      day_start: string;
      day_end: string;
      session_duration_minutes: number;
      block_granularity_minutes: number;
      recesses: RecessConfig[];
    }
  ) {
    const db = readDb();
    let row = db.timetableSettings.find((t) => t.school_id === schoolId);
    if (!row) {
      row = {
        id: newId(),
        school_id: schoolId,
        ...settings,
        day_start: `${settings.day_start}:00`.replace(":00:00", ":00"),
        day_end: `${settings.day_end}:00`.replace(":00:00", ":00"),
        updated_at: nowIso(),
      };
      db.timetableSettings.push(row);
    } else {
      Object.assign(row, {
        ...settings,
        day_start: settings.day_start.length === 5 ? `${settings.day_start}:00` : settings.day_start,
        day_end: settings.day_end.length === 5 ? `${settings.day_end}:00` : settings.day_end,
        updated_at: nowIso(),
      });
    }

    db.timeSlots = db.timeSlots.filter((t) => t.school_id !== schoolId);
    const generated = generateTimeSlots(schoolId, {
      school_days: settings.school_days,
      day_start: settings.day_start,
      day_end: settings.day_end,
      session_duration_minutes: settings.session_duration_minutes,
      block_granularity_minutes: settings.block_granularity_minutes,
      recesses: settings.recesses,
    });
    for (const slot of generated) {
      db.timeSlots.push({ id: newId(), ...slot });
    }

    const teacherIds = db.teachers.filter((t) => t.school_id === schoolId).map((t) => t.id);
    db.teacherUnavailability = db.teacherUnavailability.filter(
      (u) => !teacherIds.includes(u.teacher_id)
    );

    writeDb(db);
    return { slotCount: generated.filter((s) => s.slot_type === "session").length };
  },

  addTeacher(schoolId: string, name: string) {
    const db = readDb();
    const teacher = {
      id: newId(),
      school_id: schoolId,
      name: name.trim(),
      max_weekly_hours: 25,
      notes: null,
      scope_type: "all" as const,
      scope_cycle: null,
      created_at: nowIso(),
    };
    db.teachers.push(teacher);
    writeDb(db);
    return teacher;
  },

  renameTeacher(teacherId: string, name: string) {
    const db = readDb();
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (!teacher) return { error: "Profesor no encontrado" };
    const trimmed = name.trim();
    if (!trimmed) return { error: "El nombre no puede estar vacío" };
    teacher.name = trimmed;
    writeDb(db);
    return {};
  },

  deleteTeacher(teacherId: string) {
    const db = readDb();
    db.teachers = db.teachers.filter((t) => t.id !== teacherId);
    db.teacherSubjects = db.teacherSubjects.filter((ts) => ts.teacher_id !== teacherId);
    db.teacherCourses = db.teacherCourses.filter((tc) => tc.teacher_id !== teacherId);
    db.teacherUnavailability = db.teacherUnavailability.filter((tu) => tu.teacher_id !== teacherId);
    db.scheduleEntries = db.scheduleEntries.filter((e) => e.teacher_id !== teacherId);
    writeDb(db);
    return {};
  },

  saveTeacher(
    teacherId: string,
    data: {
      name: string;
      max_weekly_hours: number;
      notes: string | null;
      scope_type: "all" | "cycle" | "courses";
      scope_cycle: Cycle | null;
      subjectIds: string[];
      courseIds: string[];
      blockedSlotIds: string[];
    }
  ) {
    const db = readDb();
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (!teacher) return { error: "Profesor no encontrado" };

    teacher.name = data.name;
    teacher.max_weekly_hours = data.max_weekly_hours;
    teacher.notes = data.notes;
    teacher.scope_type = data.scope_type;
    teacher.scope_cycle = data.scope_type === "cycle" ? data.scope_cycle : null;

    db.teacherSubjects = db.teacherSubjects.filter((ts) => ts.teacher_id !== teacherId);
    for (const subjectId of data.subjectIds) {
      db.teacherSubjects.push({ teacher_id: teacherId, subject_id: subjectId });
    }

    db.teacherCourses = db.teacherCourses.filter((tc) => tc.teacher_id !== teacherId);
    if (data.scope_type === "courses") {
      for (const courseId of data.courseIds) {
        db.teacherCourses.push({ teacher_id: teacherId, course_id: courseId });
      }
    }

    db.teacherUnavailability = db.teacherUnavailability.filter((tu) => tu.teacher_id !== teacherId);
    for (const timeSlotId of data.blockedSlotIds) {
      db.teacherUnavailability.push({
        id: newId(),
        teacher_id: teacherId,
        time_slot_id: timeSlotId,
      });
    }

    writeDb(db);
    return {};
  },

  getTeacher(teacherId: string) {
    const db = readDb();
    const teacher = db.teachers.find((t) => t.id === teacherId);
    if (!teacher) return null;
    return {
      teacher,
      subjects: db.teacherSubjects.filter((ts) => ts.teacher_id === teacherId),
      courses: db.teacherCourses.filter((tc) => tc.teacher_id === teacherId),
      unavailability: db.teacherUnavailability.filter((tu) => tu.teacher_id === teacherId),
    };
  },

  createSchedule(
    schoolId: string,
    academicYearId: string,
    name: string,
    entries: {
      teacherId: string;
      subjectId: string;
      courseId: string;
      timeSlotId: string;
      durationMinutes?: number;
    }[],
    stats: Schedule["generation_stats"]
  ) {
    const db = readDb();
    const schedule: Schedule = {
      id: newId(),
      school_id: schoolId,
      academic_year_id: academicYearId,
      name,
      status: "draft",
      generation_stats: stats,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.schedules.push(schedule);
    for (const e of entries) {
      db.scheduleEntries.push({
        id: newId(),
        schedule_id: schedule.id,
        teacher_id: e.teacherId,
        subject_id: e.subjectId,
        course_id: e.courseId,
        time_slot_id: e.timeSlotId,
        duration_minutes: e.durationMinutes ?? 45,
      });
    }
    writeDb(db);
    return schedule;
  },

  updateSchedule(
    scheduleId: string,
    data: {
      status?: Schedule["status"];
      generation_stats?: Schedule["generation_stats"];
      entries?: {
        teacherId: string;
        subjectId: string;
        courseId: string;
        timeSlotId: string;
        durationMinutes?: number;
      }[];
    }
  ) {
    const db = readDb();
    const schedule = db.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { error: "Horario no encontrado" };

    if (data.status) schedule.status = data.status;
    if (data.generation_stats) schedule.generation_stats = data.generation_stats;
    schedule.updated_at = nowIso();

    if (data.entries) {
      db.scheduleEntries = db.scheduleEntries.filter((e) => e.schedule_id !== scheduleId);
      for (const e of data.entries) {
        db.scheduleEntries.push({
          id: newId(),
          schedule_id: scheduleId,
          teacher_id: e.teacherId,
          subject_id: e.subjectId,
          course_id: e.courseId,
          time_slot_id: e.timeSlotId,
          duration_minutes: e.durationMinutes ?? 45,
        });
      }
    }

    writeDb(db);
    return { schedule };
  },

  deleteSchedule(scheduleId: string) {
    const db = readDb();
    db.schedules = db.schedules.filter((s) => s.id !== scheduleId);
    db.scheduleEntries = db.scheduleEntries.filter((e) => e.schedule_id !== scheduleId);
    writeDb(db);
    return {};
  },

  duplicateSchedule(scheduleId: string) {
    const db = readDb();
    const original = db.schedules.find((s) => s.id === scheduleId);
    if (!original) return { error: "Horario no encontrado" };
    const copy: Schedule = {
      ...original,
      id: newId(),
      name: `${original.name} (copia)`,
      status: "draft",
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.schedules.push(copy);
    for (const e of db.scheduleEntries.filter((x) => x.schedule_id === scheduleId)) {
      db.scheduleEntries.push({
        ...e,
        id: newId(),
        schedule_id: copy.id,
      });
    }
    writeDb(db);
    return { schedule: copy };
  },

  moveScheduleEntry(
    scheduleId: string,
    entryId: string,
    newTimeSlotId: string
  ): { error?: string } {
    const db = readDb();
    const entry = db.scheduleEntries.find(
      (e) => e.id === entryId && e.schedule_id === scheduleId
    );
    if (!entry) return { error: "Sesión no encontrada" };

    const conflictTeacher = db.scheduleEntries.find(
      (e) =>
        e.schedule_id === scheduleId &&
        e.id !== entryId &&
        e.teacher_id === entry.teacher_id &&
        e.time_slot_id === newTimeSlotId
    );
    if (conflictTeacher) return { error: "El profesor ya tiene clase en esa franja" };

    const conflictCourse = db.scheduleEntries.find(
      (e) =>
        e.schedule_id === scheduleId &&
        e.id !== entryId &&
        e.course_id === entry.course_id &&
        e.time_slot_id === newTimeSlotId
    );
    if (conflictCourse) return { error: "El curso ya tiene clase en esa franja" };

    entry.time_slot_id = newTimeSlotId;
    writeDb(db);
    return {};
  },

  getSchedule(scheduleId: string) {
    const db = readDb();
    const schedule = db.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;
    return {
      schedule,
      entries: db.scheduleEntries.filter((e) => e.schedule_id === scheduleId),
    };
  },

  addFeedback(schoolId: string, userId: string, title: string, description: string) {
    const db = readDb();
    db.feedback.push({
      id: newId(),
      school_id: schoolId,
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      status: "open",
      created_at: nowIso(),
    });
    writeDb(db);
    return {};
  },

  updateFeedbackStatus(feedbackId: string, status: "open" | "reviewed") {
    const db = readDb();
    const item = db.feedback.find((f) => f.id === feedbackId);
    if (!item) return { error: "Sugerencia no encontrada" };
    item.status = status;
    writeDb(db);
    return {};
  },

  inviteMember(schoolId: string, email: string, role: "admin" | "viewer") {
    const db = readDb();
    const normalizedEmail = email.trim().toLowerCase();
    let user = db.users.find((u) => u.email === normalizedEmail);
    if (!user) {
      user = { id: newId(), email: normalizedEmail, password: INVITADO_PASSWORD_HASH };
      db.users.push(user);
    }
    const exists = db.schoolMembers.some(
      (m) => m.school_id === schoolId && m.user_id === user!.id
    );
    if (!exists) {
      db.schoolMembers.push({
        id: newId(),
        school_id: schoolId,
        user_id: user.id,
        role,
        created_at: nowIso(),
      });
    }
    writeDb(db);
    return { message: `${email} añadido (modo local: contraseña temporal "invitado")` };
  },
};

export function getSolverInputFromLocal(schoolId: string) {
  const data = localDb.getSchoolData(schoolId);
  if (!data.courses.length || !data.subjects.length || !data.teachers.length) return null;
  if (!data.courseSubjectHours.filter((h) => h.weekly_hours > 0).length) return null;
  if (!data.timeSlots.length) return null;

  return {
    courses: data.courses,
    subjects: data.subjects,
    teachers: data.teachers,
    teacherSubjects: data.teacherSubjects,
    teacherCourses: data.teacherCourses,
    teacherUnavailability: data.teacherUnavailability,
    courseSubjectHours: data.courseSubjectHours.filter((h) => h.weekly_hours > 0),
    timeSlots: data.timeSlots.map((s) => ({ ...s, duration_minutes: s.duration_minutes ?? 15 })),
    blockGranularityMinutes: data.timetableSettings?.block_granularity_minutes ?? 15,
  };
}
