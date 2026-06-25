-- Primaria Anexo IV: elective group reference + updated school seed

COMMENT ON COLUMN curriculum_requirements.elective_group_id IS
  'Stable UUID per elective group (asturias / religion). Not FK-enforced.';

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
END;
$$;
