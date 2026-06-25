-- Curriculum by formative sub-cycle + variable session duration

CREATE TABLE formative_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  cycle TEXT NOT NULL CHECK (cycle IN ('infantil', 'primaria', 'secundaria', 'diversificacion')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_formative_stages_school ON formative_stages(school_id);

CREATE TABLE curriculum_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formative_stage_id UUID NOT NULL REFERENCES formative_stages(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  mandatory_weekly_hours NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (mandatory_weekly_hours >= 0),
  session_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (session_duration_minutes > 0),
  elective_group_id UUID,
  UNIQUE (formative_stage_id, subject_id)
);

CREATE INDEX idx_curriculum_requirements_stage ON curriculum_requirements(formative_stage_id);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS formative_stage_id UUID REFERENCES formative_stages(id) ON DELETE SET NULL;

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS applicable_cycles TEXT[] DEFAULT ARRAY['infantil','primaria','secundaria','diversificacion']::TEXT[];

ALTER TABLE timetable_settings ADD COLUMN IF NOT EXISTS block_granularity_minutes INTEGER NOT NULL DEFAULT 15 CHECK (block_granularity_minutes > 0);

ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (duration_minutes > 0);

ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (duration_minutes > 0);

ALTER TABLE course_subject_hours ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER NOT NULL DEFAULT 45 CHECK (session_duration_minutes > 0);
ALTER TABLE course_subject_hours ADD COLUMN IF NOT EXISTS weekly_minutes INTEGER NOT NULL DEFAULT 0 CHECK (weekly_minutes >= 0);

-- Migrate existing weekly_hours (session count) assuming 45 min sessions
UPDATE course_subject_hours
SET weekly_minutes = weekly_hours * 45,
    session_duration_minutes = 45
WHERE weekly_minutes = 0 AND weekly_hours > 0;

-- Migrate existing time_slots to 45 min blocks (legacy uniform sessions)
UPDATE time_slots SET duration_minutes = 45 WHERE duration_minutes = 15 AND slot_type = 'session';

UPDATE schedule_entries SET duration_minutes = 45 WHERE duration_minutes = 45 OR duration_minutes IS NULL;

ALTER TABLE formative_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY formative_stages_all ON formative_stages FOR ALL
  USING (school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid()))
  WITH CHECK (school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid()));

CREATE POLICY curriculum_requirements_all ON curriculum_requirements FOR ALL
  USING (
    formative_stage_id IN (
      SELECT fs.id FROM formative_stages fs
      JOIN school_members sm ON sm.school_id = fs.school_id
      WHERE sm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    formative_stage_id IN (
      SELECT fs.id FROM formative_stages fs
      JOIN school_members sm ON sm.school_id = fs.school_id
      WHERE sm.user_id = auth.uid()
    )
  );
