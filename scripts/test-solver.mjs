import { solveScheduleBest } from "../src/lib/solver/index.ts";
import { generateTimeSlots } from "../src/lib/timetable.ts";

const schoolId = "test-school";
const slots = generateTimeSlots(schoolId, {
  school_days: [1, 2, 3, 4, 5],
  day_start: "09:00",
  day_end: "16:00",
  session_duration_minutes: 45,
  recesses: [{ start: "11:30", duration_minutes: 30 }],
}).map((s, i) => ({ id: `slot-${i}`, ...s }));

const subjects = [
  { id: "s1", school_id: schoolId, name: "Lengua Castellana", short_name: "Lengua", color: "#ef4444", created_at: "" },
  { id: "s2", school_id: schoolId, name: "Matemáticas", short_name: "Mates", color: "#3b82f6", created_at: "" },
  { id: "s3", school_id: schoolId, name: "Inglés", short_name: "Inglés", color: "#22c55e", created_at: "" },
];

const courses = [
  { id: "c1", school_id: schoolId, name: "3.º Primaria", cycle: "primaria", sort_order: 1, created_at: "" },
  { id: "c2", school_id: schoolId, name: "4.º Primaria", cycle: "primaria", sort_order: 2, created_at: "" },
];

const teachers = subjects.map((s, i) => ({
  id: `t${i + 1}`,
  school_id: schoolId,
  name: `Prof. ${s.short_name}`,
  max_weekly_hours: 25,
  notes: null,
  scope_type: "all",
  scope_cycle: null,
  created_at: "",
}));

const teacherSubjects = subjects.map((s, i) => ({
  teacher_id: `t${i + 1}`,
  subject_id: s.id,
}));

const courseSubjectHours = [
  { id: "h1", course_id: "c1", subject_id: "s1", weekly_hours: 5 },
  { id: "h2", course_id: "c1", subject_id: "s2", weekly_hours: 4 },
  { id: "h3", course_id: "c1", subject_id: "s3", weekly_hours: 3 },
  { id: "h4", course_id: "c2", subject_id: "s1", weekly_hours: 5 },
  { id: "h5", course_id: "c2", subject_id: "s2", weekly_hours: 4 },
  { id: "h6", course_id: "c2", subject_id: "s3", weekly_hours: 3 },
];

const input = {
  courses,
  subjects,
  teachers,
  teacherSubjects,
  teacherCourses: [],
  teacherUnavailability: [],
  courseSubjectHours,
  timeSlots: slots,
};

const result = solveScheduleBest(input, { attempts: 10 });
const total = result.stats.total_sessions;
const placed = result.stats.placed_sessions;
const pct = Math.round((placed / total) * 100);

console.log(`Solver test: ${placed}/${total} sesiones (${pct}%)`);
console.log(`Unplaced: ${result.unplaced.length}`);

if (placed < total) {
  console.error("FAIL: not all sessions placed");
  process.exit(1);
}

console.log("PASS");
