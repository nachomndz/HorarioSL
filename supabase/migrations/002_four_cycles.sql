-- Incremental migration for existing databases (skip if using fresh 001_initial.sql)

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_cycle_check;
ALTER TABLE courses ADD CONSTRAINT courses_cycle_check
  CHECK (cycle IN ('infantil', 'primaria', 'secundaria', 'diversificacion'));

ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_scope_cycle_check;
ALTER TABLE teachers ADD CONSTRAINT teachers_scope_cycle_check
  CHECK (scope_cycle IS NULL OR scope_cycle IN ('infantil', 'primaria', 'secundaria', 'diversificacion'));

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
