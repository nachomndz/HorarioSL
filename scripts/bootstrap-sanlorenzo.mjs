/**
 * Crea el usuario admin de Colegio San Lorenzo en Supabase y siembra el colegio.
 * Uso: node scripts/bootstrap-sanlorenzo.mjs
 * Requiere .env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { seedPrimariaAnexo } from "./lib/seed-primaria-anexo.mjs";
import { ensureTimeSlots } from "./lib/ensure-time-slots.mjs";

const EMAIL = "sanlorenzo@horariosl.app";
const PASSWORD = "12456@SL";
const SCHOOL_NAME = "Colegio San Lorenzo";

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  } catch {
    /* use process.env */
  }
  return {
    url:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL ||
      "",
    serviceKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      "",
  };
}

async function main() {
  const { url, serviceKey } = loadEnv();
  if (!url || !serviceKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buscar o crear usuario
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === EMAIL);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error("Error creando usuario:", error.message);
      process.exit(1);
    }
    user = data.user;
    console.log("Usuario creado:", EMAIL);
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    console.log("Usuario ya existía, contraseña actualizada:", EMAIL);
  }

  // Buscar o crear colegio
  const { data: schools } = await admin.from("schools").select("id").eq("name", SCHOOL_NAME);
  let schoolId = schools?.[0]?.id;

  if (!schoolId) {
    const { data: school, error } = await admin
      .from("schools")
      .insert({ name: SCHOOL_NAME })
      .select("id")
      .single();
    if (error) {
      console.error("Error creando colegio:", error.message);
      process.exit(1);
    }
    schoolId = school.id;
    console.log("Colegio creado:", SCHOOL_NAME);
  } else {
    console.log("Colegio ya existía:", SCHOOL_NAME);
  }

  // Miembro admin
  const { error: memberError } = await admin.from("school_members").upsert(
    { school_id: schoolId, user_id: user.id, role: "admin" },
    { onConflict: "school_id,user_id" }
  );
  if (memberError) {
    console.error("Error en school_members:", memberError.message);
    process.exit(1);
  }

  // Seed datos por defecto (idempotente si ya hay cursos)
  const { count } = await admin
    .from("courses")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if (!count) {
    const { error: seedError } = await admin.rpc("seed_school_defaults", {
      p_school_id: schoolId,
    });
    if (seedError) {
      console.error("Error en seed_school_defaults:", seedError.message);
      process.exit(1);
    }
    console.log("Datos iniciales sembrados (cursos, malla...)");
  } else {
    console.log("El colegio ya tiene cursos, seed_school_defaults omitido");
  }

  try {
    const slots = await ensureTimeSlots(admin, schoolId);
    if (slots.created) {
      console.log(`Franjas horarias iniciales creadas (${slots.count} bloques)`);
    } else {
      console.log("Franjas horarias ya existían");
    }
  } catch (e) {
    console.error("Error en ensure time_slots:", e.message);
    process.exit(1);
  }

  try {
    const primaria = await seedPrimariaAnexo(admin, schoolId);
    if (primaria.skipped) {
      console.log("Currículo Anexo IV Primaria ya existía, seed omitido");
    } else {
      console.log("Currículo Anexo IV Primaria sembrado (asignaturas, horas, matriz)");
    }
  } catch (e) {
    console.error("Error en seed Primaria Anexo IV:", e.message);
    process.exit(1);
  }

  console.log("\nListo. Inicia sesión con:");
  console.log("  Usuario: SanLorenzo");
  console.log("  Contraseña: 12456@SL");
}

main();
