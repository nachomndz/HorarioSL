/**
 * Ensures time_slots exist for a school from timetable_settings (bootstrap).
 */

const DEFAULT_SETTINGS = {
  school_days: [1, 2, 3, 4, 5],
  day_start: "09:00:00",
  day_end: "16:00:00",
  session_duration_minutes: 45,
  block_granularity_minutes: 15,
  recesses: [{ start: "11:30", duration_minutes: 30 }],
};

function parseTime(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function overlaps(start, end, recess) {
  const rStart = parseTime(recess.start);
  const rEnd = rStart + recess.duration_minutes;
  return start < rEnd && end > rStart;
}

function generateTimeSlots(schoolId, settings) {
  const blockMinutes = settings.block_granularity_minutes || 15;
  const slots = [];
  let sortOrder = 0;

  for (const day of [...settings.school_days].sort((a, b) => a - b)) {
    let cursor = parseTime(settings.day_start.slice(0, 5));
    const dayEnd = parseTime(settings.day_end.slice(0, 5));

    while (cursor < dayEnd) {
      const blockEnd = cursor + blockMinutes;
      if (blockEnd > dayEnd) break;

      if (settings.recesses.some((r) => overlaps(cursor, blockEnd, r))) {
        const recess = settings.recesses.find((r) => {
          const rStart = parseTime(r.start);
          return cursor >= rStart && cursor < rStart + r.duration_minutes;
        });
        if (recess) {
          const rStart = parseTime(recess.start);
          slots.push({
            school_id: schoolId,
            day_of_week: day,
            start_time: formatMinutes(rStart),
            end_time: formatMinutes(rStart + recess.duration_minutes),
            slot_type: "recess",
            sort_order: sortOrder++,
            duration_minutes: recess.duration_minutes,
          });
          cursor = rStart + recess.duration_minutes;
          continue;
        }
      }

      slots.push({
        school_id: schoolId,
        day_of_week: day,
        start_time: formatMinutes(cursor),
        end_time: formatMinutes(blockEnd),
        slot_type: "session",
        sort_order: sortOrder++,
        duration_minutes: blockMinutes,
      });
      cursor = blockEnd;
    }
  }
  return slots;
}

export async function ensureTimeSlots(admin, schoolId) {
  const { count } = await admin
    .from("time_slots")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if ((count ?? 0) > 0) return { created: false };

  const { data: settingsRow } = await admin
    .from("timetable_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  let settings = settingsRow;
  if (!settings) {
    const { error } = await admin.from("timetable_settings").insert({
      school_id: schoolId,
      ...DEFAULT_SETTINGS,
    });
    if (error) throw new Error(error.message);
    settings = { ...DEFAULT_SETTINGS, school_id: schoolId };
  }

  const generated = generateTimeSlots(schoolId, {
    school_days: settings.school_days,
    day_start: settings.day_start,
    day_end: settings.day_end,
    session_duration_minutes: settings.session_duration_minutes,
    block_granularity_minutes: settings.block_granularity_minutes ?? 15,
    recesses: settings.recesses ?? [],
  });

  if (generated.length > 0) {
    const { error } = await admin.from("time_slots").insert(generated);
    if (error) throw new Error(error.message);
  }

  return { created: true, count: generated.length };
}
