import type {
  AcademicYear,
  Course,
  CourseSubjectHours,
  Feedback,
  Schedule,
  ScheduleEntry,
  School,
  SchoolMember,
  Subject,
  Teacher,
  TeacherCourse,
  TeacherSubject,
  TeacherUnavailability,
  TimetableSettings,
  TimeSlot,
} from "@/types";

export interface LocalSession {
  userId: string;
  email: string;
}

export interface LocalDatabase {
  /** password stores SHA-256 hex digest, not plaintext */
  users: { id: string; email: string; password: string }[];
  session: LocalSession | null;
  schools: School[];
  schoolMembers: SchoolMember[];
  academicYears: AcademicYear[];
  timetableSettings: TimetableSettings[];
  timeSlots: TimeSlot[];
  subjects: Subject[];
  courses: Course[];
  courseSubjectHours: CourseSubjectHours[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  teacherCourses: TeacherCourse[];
  teacherUnavailability: TeacherUnavailability[];
  schedules: Schedule[];
  scheduleEntries: ScheduleEntry[];
  feedback: Feedback[];
}

export function emptyDatabase(): LocalDatabase {
  return {
    users: [],
    session: null,
    schools: [],
    schoolMembers: [],
    academicYears: [],
    timetableSettings: [],
    timeSlots: [],
    subjects: [],
    courses: [],
    courseSubjectHours: [],
    teachers: [],
    teacherSubjects: [],
    teacherCourses: [],
    teacherUnavailability: [],
    schedules: [],
    scheduleEntries: [],
    feedback: [],
  };
}
