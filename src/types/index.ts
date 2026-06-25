export type Cycle = "infantil" | "primaria" | "secundaria" | "diversificacion";
export type MemberRole = "admin" | "viewer";
export type SlotType = "session" | "recess";
export type ScheduleStatus = "draft" | "published";
export type FeedbackStatus = "open" | "reviewed";
export type TeacherScope = "all" | "cycle" | "courses";

export interface School {
  id: string;
  name: string;
  created_at: string;
}

export interface SchoolMember {
  id: string;
  school_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface TimetableSettings {
  id: string;
  school_id: string;
  school_days: number[];
  day_start: string;
  day_end: string;
  session_duration_minutes: number;
  recesses: RecessConfig[];
  updated_at: string;
}

export interface RecessConfig {
  start: string;
  duration_minutes: number;
}

export interface TimeSlot {
  id: string;
  school_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_type: SlotType;
  sort_order: number;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  short_name: string | null;
  color: string | null;
  created_at: string;
}

export interface Course {
  id: string;
  school_id: string;
  name: string;
  cycle: Cycle;
  sort_order: number;
  created_at: string;
}

export interface CourseSubjectHours {
  id: string;
  course_id: string;
  subject_id: string;
  weekly_hours: number;
}

export interface Teacher {
  id: string;
  school_id: string;
  name: string;
  max_weekly_hours: number;
  notes: string | null;
  scope_type: TeacherScope;
  scope_cycle: Cycle | null;
  created_at: string;
}

export interface TeacherSubject {
  teacher_id: string;
  subject_id: string;
}

export interface TeacherCourse {
  teacher_id: string;
  course_id: string;
}

export interface TeacherUnavailability {
  id: string;
  teacher_id: string;
  time_slot_id: string;
}

export interface Schedule {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  status: ScheduleStatus;
  generation_stats: GenerationStats | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationStats {
  total_sessions: number;
  placed_sessions: number;
  unplaced_sessions: number;
  duration_ms: number;
}

export interface ScheduleEntry {
  id: string;
  schedule_id: string;
  teacher_id: string;
  subject_id: string;
  course_id: string;
  time_slot_id: string;
}

export interface Feedback {
  id: string;
  school_id: string;
  user_id: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  created_at: string;
}

export interface SessionDemand {
  courseId: string;
  subjectId: string;
  index: number;
}

export interface PlacedSession {
  courseId: string;
  subjectId: string;
  teacherId: string;
  timeSlotId: string;
}

export interface UnplacedSession {
  courseId: string;
  subjectId: string;
  reason: string;
}

export interface SolverResult {
  entries: PlacedSession[];
  unplaced: UnplacedSession[];
  stats: GenerationStats;
}

export interface SolverInput {
  courses: Course[];
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  teacherCourses: TeacherCourse[];
  teacherUnavailability: TeacherUnavailability[];
  courseSubjectHours: CourseSubjectHours[];
  timeSlots: TimeSlot[];
}
