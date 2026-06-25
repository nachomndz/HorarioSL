/**
 * Migra colegios existentes: subciclos, currículo Anexo IV primaria, asignación de cursos.
 * Uso: node scripts/migrate-curriculum-stages.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const SCHOOL_NAME = "Colegio San Lorenzo";

const DEFAULT_STAGES = {
  infantil: [{ name: "Ciclo de Educación Infantil", sort_order: 1 }],
  primaria: [
    { name: "Primer ciclo (1º y 2º)", sort_order: 1 },
    { name: "Segundo ciclo (3º y 4º)", sort_order: 2 },
    { name: "Tercer ciclo (5º y 6º)", sort_order: 3 },
  ],
  secundaria: [
    { name: "1º–3º ESO", sort_order: 1 },
    { name: "4º ESO", sort_order: 2 },
  ],
  diversificacion: [{ name: "Diversificación", sort_order: 1 }],
};

const PRIMARIA_TEMPLATE = [
  ["Ciencias de la Naturaleza", "CN", "#14b8a6", [3, 3, 3]],
  ["Ciencias Sociales", "CS", "#f59e0b", [3, 3, 3]],
  ["Educación Artística", "Plástica", "#ec4899", [4, 4, 3.5]],
  ["Educación Física", "EF", "#8b5cf6", [4, 4, 4.5]],
  ["Educación en Valores Cívicos y Éticos", "Valores", "#84cc16", [null, null, 1.5]],
  ["Lengua Castellana y Literatura", "Lengua", "#ef4444", [11, 9.5, 8.5]],
  ["Lengua Extranjera", "Inglés", "#22c55e", [6, 8, 8]],
  ["Matemáticas", "Mates", "#3b82f6", [9, 8.5, 8]],
];

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  } catch {
    /* */
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function inferStageIndex(courseName, cycle) {
  const n = courseName.toLowerCase();
  if (cycle === "primaria") {
    if (n.includes("1") || n.includes("2")) return 0;
    if (n.includes("3") || n.includes("4")) return 1;
    if (n.includes("5") || n.includes("6")) return 2;
    return 0;
  }
  if (cycle === "secundaria") {
    if (n.includes("4")) return 1;
    return 0;
  }
  return 0;
}

async function main() {
  const { url, serviceKey } = loadEnv();
  if (!url || !serviceKey) {
    console.error("Faltan credenciales Supabase");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  const { data: school } = await supabase
    .from("schools")
    .select("id")
    .eq("name", SCHOOL_NAME)
    .maybeSingle();
  if (!school) {
    console.error("Colegio no encontrado");
    process.exit(1);
  }
  const schoolId = school.id;

  const { count: stageCount } = await supabase
    .from("formative_stages")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if ((stageCount ?? 0) === 0) {
    const rows = Object.entries(DEFAULT_STAGES).flatMap(([cycle, templates]) =>
      templates.map((t) => ({ school_id: schoolId, cycle, name: t.name, sort_order: t.sort_order }))
    );
    await supabase.from("formative_stages").insert(rows);
    console.log("Subciclos creados");
  }

  const { data: stages } = await supabase
    .from("formative_stages")
    .select("*")
    .eq("school_id", schoolId)
    .order("sort_order");

  const { data: courses } = await supabase.from("courses").select("*").eq("school_id", schoolId);
  for (const course of courses ?? []) {
    const cycleStages = (stages ?? [])
      .filter((s) => s.cycle === course.cycle)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = inferStageIndex(course.name, course.cycle);
    const stage = cycleStages[idx] ?? cycleStages[0];
    if (stage && !course.formative_stage_id) {
      await supabase
        .from("courses")
        .update({ formative_stage_id: stage.id })
        .eq("id", course.id);
    }
  }
  console.log("Cursos asignados a subciclos");

  const primariaStages = (stages ?? [])
    .filter((s) => s.cycle === "primaria")
    .sort((a, b) => a.sort_order - b.sort_order);

  const { data: subjects } = await supabase.from("subjects").select("*").eq("school_id", schoolId);
  const subjectMap = new Map((subjects ?? []).map((s) => [s.name, s]));

  for (const [name, short, color, hours] of PRIMARIA_TEMPLATE) {
    let subject = subjectMap.get(name);
    if (!subject) {
      const { data: created } = await supabase
        .from("subjects")
        .insert({
          school_id: schoolId,
          name,
          short_name: short,
          color,
          applicable_cycles: ["primaria"],
        })
        .select()
        .single();
      subject = created;
      if (subject) subjectMap.set(name, subject);
    }
    if (!subject) continue;

    for (let idx = 0; idx < hours.length; idx++) {
      const h = hours[idx];
      if (h == null || !primariaStages[idx]) continue;
      await supabase.from("curriculum_requirements").upsert(
        {
          formative_stage_id: primariaStages[idx].id,
          subject_id: subject.id,
          mandatory_weekly_hours: h,
          session_duration_minutes: 45,
        },
        { onConflict: "formative_stage_id,subject_id" }
      );
    }
  }
  console.log("Currículo Anexo IV primaria cargado");

  await supabase
    .from("timetable_settings")
    .update({ block_granularity_minutes: 15 })
    .eq("school_id", schoolId);

  console.log("Migración completada para", SCHOOL_NAME);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
