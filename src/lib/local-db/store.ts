import type { Cycle, RecessConfig, Schedule } from "@/types";
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
    recesses: settings.recesses as RecessConfig[],
  });
  for (const slot of generated) {
    db.timeSlots.push({ id: newId(), ...slot });
  }
}

function seedCourses(db: LocalDatabase, schoolId: string) {
  DEFAULT_COURSES_TEMPLATE.forEach((c, i) => {
    db.courses.push({
      id: newId(),
      school_id: schoolId,
      name: c.name,
      cycle: c.cycle,
      sort_order: i + 1,
      created_at: nowIso(),
    });
  });
}

function seedSchool(db: LocalDatabase, schoolId: string) {
  const yearStart = new Date().getFullYear();
  db.academicYears.push({
    id: newId(),
    school_id: schoolId,
    name: `${yearStart}/${yearStart + 1}`,
    is_active: true,
    created_at: nowIso(),
  });

  db.timetableSettings.push({
    id: newId(),
    school_id: schoolId,
    school_days: [1, 2, 3, 4, 5],
    day_start: "09:00:00",
    day_end: "16:00:00",
    session_duration_minutes: 45,
    recesses: [{ start: "11:30", duration_minutes: 30 }] as RecessConfig[],
    updated_at: nowIso(),
  });

  seedCourses(db, schoolId);
  generateSlotsForSchool(db, schoolId);

  const subjects = [
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

  for (const [name, short_name, color] of subjects) {
    db.subjects.push({
      id: newId(),
      school_id: schoolId,
      name,
      short_name,
      color,
      created_at: nowIso(),
    });
  }
}

export const localDb = {
  getSession(): LocalSession | null {
    return readSession();
  },

  login(email: string, password: string): { error?: string } {
    const db = readDb();
    const user = db.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.password !== password) {
      return { error: "Email o contraseña incorrectos" };
    }
    const session = { userId: user.id, email: user.email };
    writeSession(session);
    db.session = session;
    writeDb(db);
    return {};
  },

  register(schoolName: string, email: string, password: string): { error?: string } {
    const db = readDb();
    const normalizedEmail = email.trim().toLowerCase();
    if (db.users.some((u) => u.email === normalizedEmail)) {
      return { error: "Ya existe una cuenta con ese email" };
    }

    const userId = newId();
    const schoolId = newId();

    db.users.push({ id: userId, email: normalizedEmail, password });
    db.schools.push({ id: schoolId, name: schoolName.trim(), created_at: nowIso() });
    db.schoolMembers.push({
      id: newId(),
      school_id: schoolId,
      user_id: userId,
      role: "admin",
      created_at: nowIso(),
    });

    seedSchool(db, schoolId);

    const session = { userId, email: normalizedEmail };
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

  updateCourse(courseId: string, data: { name?: string; cycle?: Cycle }) {
    const db = readDb();
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) return { error: "Curso no encontrado" };
    if (data.name !== undefined) course.name = data.name;
    if (data.cycle !== undefined) course.cycle = data.cycle;
    writeDb(db);
    return {};
  },

  addCourse(schoolId: string, name: string, cycle: Cycle) {
    const db = readDb();
    const maxOrder = db.courses
      .filter((c) => c.school_id === schoolId)
      .reduce((m, c) => Math.max(m, c.sort_order), 0);
    const course = {
      id: newId(),
      school_id: schoolId,
      name: name.trim(),
      cycle,
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
      if (replace) seedCourses(db, schoolId);
    }
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

  upsertCourseSubjectHours(rows: { course_id: string; subject_id: string; weekly_hours: number }[]) {
    const db = readDb();
    for (const row of rows) {
      const existing = db.courseSubjectHours.find(
        (h) => h.course_id === row.course_id && h.subject_id === row.subject_id
      );
      if (existing) {
        existing.weekly_hours = row.weekly_hours;
      } else {
        db.courseSubjectHours.push({ id: newId(), ...row });
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
      user = { id: newId(), email: normalizedEmail, password: "invitado" };
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
    timeSlots: data.timeSlots,
  };
}
