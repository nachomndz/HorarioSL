-- HorarioSL initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schools
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- School members
CREATE TABLE school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')) DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);

-- Academic years
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timetable settings
CREATE TABLE timetable_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  school_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  day_start TIME NOT NULL DEFAULT '09:00',
  day_end TIME NOT NULL DEFAULT '16:00',
  session_duration_minutes INTEGER NOT NULL DEFAULT 45,
  recesses JSONB NOT NULL DEFAULT '[{"start": "11:30", "duration_minutes": 30}]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time slots
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('session', 'recess')) DEFAULT 'session',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_time_slots_school ON time_slots(school_id);

-- Subjects
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cycle TEXT NOT NULL CHECK (cycle IN ('infantil', 'primaria', 'secundaria', 'diversificacion')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Course subject hours
CREATE TABLE course_subject_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  weekly_hours INTEGER NOT NULL DEFAULT 0 CHECK (weekly_hours >= 0),
  UNIQUE (course_id, subject_id)
);

-- Teachers
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_weekly_hours INTEGER NOT NULL DEFAULT 25 CHECK (max_weekly_hours > 0),
  notes TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('all', 'cycle', 'courses')) DEFAULT 'all',
  scope_cycle TEXT CHECK (scope_cycle IN ('infantil', 'primaria', 'secundaria', 'diversificacion')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teacher subjects
CREATE TABLE teacher_subjects (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

-- Teacher courses
CREATE TABLE teacher_courses (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, course_id)
);

-- Teacher unavailability
CREATE TABLE teacher_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  UNIQUE (teacher_id, time_slot_id)
);

-- Schedules
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  generation_stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schedule entries
CREATE TABLE schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  UNIQUE (schedule_id, teacher_id, time_slot_id),
  UNIQUE (schedule_id, course_id, time_slot_id)
);

CREATE INDEX idx_schedule_entries_schedule ON schedule_entries(schedule_id);

-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'reviewed')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper: get user's school ids
CREATE OR REPLACE FUNCTION get_user_school_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM school_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_school_admin(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_members
    WHERE school_id = p_school_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_school_member(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_members
    WHERE school_id = p_school_id AND user_id = auth.uid()
  );
$$;

-- RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_subject_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Schools policies
CREATE POLICY schools_select ON schools FOR SELECT
  USING (id IN (SELECT get_user_school_ids()));
CREATE POLICY schools_insert ON schools FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY schools_update ON schools FOR UPDATE
  USING (is_school_admin(id));

-- School members policies
CREATE POLICY school_members_select ON school_members FOR SELECT
  USING (school_id IN (SELECT get_user_school_ids()));
CREATE POLICY school_members_insert ON school_members FOR INSERT
  WITH CHECK (
    is_school_admin(school_id)
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM school_members sm WHERE sm.user_id = auth.uid())
    )
  );
CREATE POLICY school_members_update ON school_members FOR UPDATE
  USING (is_school_admin(school_id));

-- Generic school-scoped policies macro via individual tables
CREATE POLICY academic_years_all ON academic_years FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY timetable_settings_all ON timetable_settings FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY time_slots_all ON time_slots FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY subjects_all ON subjects FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY courses_all ON courses FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY course_subject_hours_all ON course_subject_hours FOR ALL
  USING (
    course_id IN (SELECT id FROM courses WHERE school_id IN (SELECT get_user_school_ids()))
  )
  WITH CHECK (
    course_id IN (SELECT id FROM courses WHERE school_id IN (SELECT get_user_school_ids()) AND is_school_admin(school_id))
  );

CREATE POLICY teachers_all ON teachers FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY teacher_subjects_all ON teacher_subjects FOR ALL
  USING (
    teacher_id IN (SELECT id FROM teachers WHERE school_id IN (SELECT get_user_school_ids()))
  )
  WITH CHECK (
    teacher_id IN (SELECT id FROM teachers t WHERE is_school_admin(t.school_id))
  );

CREATE POLICY teacher_courses_all ON teacher_courses FOR ALL
  USING (
    teacher_id IN (SELECT id FROM teachers WHERE school_id IN (SELECT get_user_school_ids()))
  )
  WITH CHECK (
    teacher_id IN (SELECT id FROM teachers t WHERE is_school_admin(t.school_id))
  );

CREATE POLICY teacher_unavailability_all ON teacher_unavailability FOR ALL
  USING (
    teacher_id IN (SELECT id FROM teachers WHERE school_id IN (SELECT get_user_school_ids()))
  )
  WITH CHECK (
    teacher_id IN (SELECT id FROM teachers t WHERE is_school_admin(t.school_id))
  );

CREATE POLICY schedules_all ON schedules FOR ALL
  USING (school_id IN (SELECT get_user_school_ids()))
  WITH CHECK (is_school_admin(school_id));

CREATE POLICY schedule_entries_all ON schedule_entries FOR ALL
  USING (
    schedule_id IN (SELECT id FROM schedules WHERE school_id IN (SELECT get_user_school_ids()))
  )
  WITH CHECK (
    schedule_id IN (SELECT id FROM schedules s WHERE is_school_admin(s.school_id))
  );

CREATE POLICY feedback_select ON feedback FOR SELECT
  USING (school_id IN (SELECT get_user_school_ids()));
CREATE POLICY feedback_insert ON feedback FOR INSERT
  WITH CHECK (
    school_id IN (SELECT get_user_school_ids())
    AND user_id = auth.uid()
  );
CREATE POLICY feedback_update ON feedback FOR UPDATE
  USING (is_school_admin(school_id));

-- Seed function for new school
CREATE OR REPLACE FUNCTION seed_school_defaults(p_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO academic_years (school_id, name, is_active)
  VALUES (p_school_id, to_char(now(), 'YYYY') || '/' || to_char(now() + interval '1 year', 'YYYY'), true);

  INSERT INTO timetable_settings (school_id) VALUES (p_school_id);

  INSERT INTO courses (school_id, name, cycle, sort_order) VALUES
    (p_school_id, 'Infantil 3 años', 'infantil', 1),
    (p_school_id, 'Infantil 4 años', 'infantil', 2),
    (p_school_id, 'Infantil 5 años', 'infantil', 3),
    (p_school_id, '1.º Primaria', 'primaria', 4),
    (p_school_id, '2.º Primaria', 'primaria', 5),
    (p_school_id, '3.º Primaria', 'primaria', 6),
    (p_school_id, '4.º Primaria', 'primaria', 7),
    (p_school_id, '5.º Primaria', 'primaria', 8),
    (p_school_id, '6.º Primaria', 'primaria', 9),
    (p_school_id, '1.º Secundaria', 'secundaria', 10),
    (p_school_id, '2.º Secundaria', 'secundaria', 11),
    (p_school_id, '3.º Secundaria', 'secundaria', 12),
    (p_school_id, '4.º Secundaria', 'secundaria', 13),
    (p_school_id, 'Clase de Diversificación', 'diversificacion', 14);

  INSERT INTO subjects (school_id, name, short_name, color) VALUES
    (p_school_id, 'Lengua Castellana', 'Lengua', '#ef4444'),
    (p_school_id, 'Matemáticas', 'Mates', '#3b82f6'),
    (p_school_id, 'Inglés', 'Inglés', '#22c55e'),
    (p_school_id, 'Ciencias Naturales', 'CN', '#14b8a6'),
    (p_school_id, 'Ciencias Sociales', 'CS', '#f59e0b'),
    (p_school_id, 'Educación Física', 'EF', '#8b5cf6'),
    (p_school_id, 'Plástica', 'Plástica', '#ec4899'),
    (p_school_id, 'Música', 'Música', '#6366f1'),
    (p_school_id, 'Religión', 'Religión', '#64748b'),
    (p_school_id, 'Valores', 'Valores', '#84cc16');
END;
$$;
