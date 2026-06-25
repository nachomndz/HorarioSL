/**
 * Seed Anexo IV Primaria via Supabase service client (bootstrap script).
 * Data mirrors src/lib/curriculum/templates.ts
 */

const DEFAULT_ELECTIVES = { asturias: "lengua_asturiana", religion: "religion" };
const ELECTIVE_GROUP_ASTURIAS = "a1000001-0000-4000-8000-000000000001";
const ELECTIVE_GROUP_RELIGION = "a1000001-0000-4000-8000-000000000002";

const STAGES_BY_CYCLE = {
  infantil: [{ name: "Ciclo de Educación Infantil", sortOrder: 1 }],
  primaria: [
    { name: "Primer ciclo (1º y 2º)", sortOrder: 1 },
    { name: "Segundo ciclo (3º y 4º)", sortOrder: 2 },
    { name: "Tercer ciclo (5º y 6º)", sortOrder: 3 },
  ],
  secundaria: [
    { name: "1º–3º ESO", sortOrder: 1 },
    { name: "4º ESO", sortOrder: 2 },
  ],
  diversificacion: [{ name: "Diversificación", sortOrder: 1 }],
};

const ANEXO_IV = [
  { subjectName: "Ciencias de la Naturaleza", shortName: "CN", color: "#14b8a6", applicableCycles: ["primaria"], hours: [3, 3, 3] },
  { subjectName: "Ciencias Sociales", shortName: "CS", color: "#f59e0b", applicableCycles: ["primaria"], hours: [3, 3, 3] },
  { subjectName: "Educación Artística", shortName: "Plástica", color: "#ec4899", applicableCycles: ["primaria"], hours: [4, 4, 3.5] },
  { subjectName: "Educación Física", shortName: "EF", color: "#8b5cf6", applicableCycles: ["primaria", "secundaria", "diversificacion"], hours: [4, 4, 4.5] },
  { subjectName: "Educación en Valores Cívicos y Éticos", shortName: "Valores", color: "#84cc16", applicableCycles: ["primaria"], hours: [null, null, 1.5] },
  { subjectName: "Lengua Castellana y Literatura", shortName: "Lengua", color: "#ef4444", applicableCycles: ["primaria", "secundaria", "diversificacion"], hours: [11, 9.5, 8.5] },
  { subjectName: "Lengua Extranjera", shortName: "Inglés", color: "#22c55e", applicableCycles: ["primaria", "secundaria", "infantil", "diversificacion"], hours: [6, 8, 8] },
  { subjectName: "Matemáticas", shortName: "Mates", color: "#3b82f6", applicableCycles: ["primaria", "secundaria", "infantil", "diversificacion"], hours: [9, 8.5, 8] },
  { subjectName: "Lengua Asturiana y Literatura", shortName: "LA", color: "#0d9488", applicableCycles: ["primaria"], hours: [3, 3, 3], electiveGroup: "asturias", electiveKey: "lengua_asturiana" },
  { subjectName: "Cultura Asturiana", shortName: "Cultura", color: "#0f766e", applicableCycles: ["primaria"], hours: [3, 3, 3], electiveGroup: "asturias", electiveKey: "cultura_asturiana" },
  { subjectName: "Religión", shortName: "Religión", color: "#64748b", applicableCycles: ["primaria", "secundaria"], hours: [2, 2, 2], electiveGroup: "religion", electiveKey: "religion" },
  { subjectName: "Atención educativa", shortName: "At. educ.", color: "#78716c", applicableCycles: ["primaria"], hours: [2, 2, 2], electiveGroup: "religion", electiveKey: "atencion_educativa" },
];

function inferStageIndex(courseName, cycle) {
  const n = courseName.toLowerCase();
  if (cycle === "primaria") {
    if (n.includes("1.") || n.includes("1º") || n.includes("2.") || n.includes("2º")) return 0;
    if (n.includes("3.") || n.includes("3º") || n.includes("4.") || n.includes("4º")) return 1;
    if (n.includes("5.") || n.includes("5º") || n.includes("6.") || n.includes("6º")) return 2;
    return 0;
  }
  return 0;
}

function isActive(template, choices) {
  if (!template.electiveGroup || !template.electiveKey) return true;
  return choices[template.electiveGroup] === template.electiveKey;
}

function hoursForCell(template, idx, choices) {
  const raw = template.hours[idx];
  if (raw == null) return null;
  if (template.electiveGroup && !isActive(template, choices)) return 0;
  return raw;
}

function sessionsNeeded(weeklyMinutes, sessionDuration) {
  if (weeklyMinutes <= 0 || sessionDuration <= 0) return 0;
  return Math.ceil(weeklyMinutes / sessionDuration);
}

export async function seedPrimariaAnexo(admin, schoolId, choices = DEFAULT_ELECTIVES) {
  const { data: existingStages } = await admin
    .from("formative_stages")
    .select("id, cycle, sort_order")
    .eq("school_id", schoolId);

  let stages = existingStages ?? [];
  if (!stages.length) {
    const rows = Object.entries(STAGES_BY_CYCLE).flatMap(([cycle, templates]) =>
      templates.map((t) => ({
        school_id: schoolId,
        cycle,
        name: t.name,
        sort_order: t.sortOrder,
      }))
    );
    const { data: inserted, error } = await admin.from("formative_stages").insert(rows).select();
    if (error) throw new Error(error.message);
    stages = inserted;
  }

  const primariaStages = stages
    .filter((s) => s.cycle === "primaria")
    .sort((a, b) => a.sort_order - b.sort_order);
  if (primariaStages.length < 3) throw new Error("Faltan subciclos de primaria");

  const stageIds = new Set(primariaStages.map((s) => s.id));
  const { data: existingReqs } = await admin.from("curriculum_requirements").select("formative_stage_id, mandatory_weekly_hours");
  const hasCurriculum = (existingReqs ?? []).some(
    (r) => stageIds.has(r.formative_stage_id) && Number(r.mandatory_weekly_hours) > 0
  );
  if (hasCurriculum) return { skipped: true };

  const { data: subjects } = await admin.from("subjects").select("*").eq("school_id", schoolId);
  const subjectByName = new Map((subjects ?? []).map((s) => [s.name, s]));

  for (const template of ANEXO_IV) {
    let subject = subjectByName.get(template.subjectName);
    if (!subject) {
      const { data: created, error } = await admin
        .from("subjects")
        .insert({
          school_id: schoolId,
          name: template.subjectName,
          short_name: template.shortName,
          color: template.color,
          applicable_cycles: template.applicableCycles,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      subject = created;
      subjectByName.set(template.subjectName, subject);
    }

    const electiveGroupId =
      template.electiveGroup === "asturias"
        ? ELECTIVE_GROUP_ASTURIAS
        : template.electiveGroup === "religion"
          ? ELECTIVE_GROUP_RELIGION
          : null;

    for (let idx = 0; idx < template.hours.length; idx++) {
      const stage = primariaStages[idx];
      if (!stage) continue;
      const hours = hoursForCell(template, idx, choices);
      if (hours == null) continue;

      const { error } = await admin.from("curriculum_requirements").upsert(
        {
          formative_stage_id: stage.id,
          subject_id: subject.id,
          mandatory_weekly_hours: hours,
          session_duration_minutes: 45,
          elective_group_id: electiveGroupId,
        },
        { onConflict: "formative_stage_id,subject_id" }
      );
      if (error) throw new Error(error.message);
    }
  }

  const { data: courses } = await admin.from("courses").select("*").eq("school_id", schoolId);
  const allStages = stages.length ? stages : primariaStages;
  for (const course of courses ?? []) {
    if (course.formative_stage_id) continue;
    const cycleStages = allStages
      .filter((s) => s.cycle === course.cycle)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = inferStageIndex(course.name, course.cycle);
    const stage = cycleStages[idx] ?? cycleStages[0];
    if (stage) {
      await admin.from("courses").update({ formative_stage_id: stage.id }).eq("id", course.id);
      course.formative_stage_id = stage.id;
    }
  }

  for (const stage of primariaStages) {
    const stageCourses = (courses ?? []).filter((c) => c.formative_stage_id === stage.id);
    const { data: reqs } = await admin
      .from("curriculum_requirements")
      .select("*")
      .eq("formative_stage_id", stage.id);

    for (const course of stageCourses) {
      for (const req of reqs ?? []) {
        if (Number(req.mandatory_weekly_hours) <= 0) continue;
        const weeklyMinutes = Math.round(Number(req.mandatory_weekly_hours) * 60);
        const duration = req.session_duration_minutes || 45;
        const weeklySessions = sessionsNeeded(weeklyMinutes, duration);
        await admin.from("course_subject_hours").upsert(
          {
            course_id: course.id,
            subject_id: req.subject_id,
            weekly_hours: weeklySessions,
            weekly_minutes: weeklyMinutes,
            session_duration_minutes: duration,
          },
          { onConflict: "course_id,subject_id" }
        );
      }
    }
  }

  return { skipped: false };
}
