import ExcelJS from "exceljs";
import type {
  Course,
  ScheduleEntry,
  Subject,
  Teacher,
  TimeSlot,
} from "@/types";
import { DAY_LABELS, formatTime } from "@/lib/utils";
import { getDaysFromSlots, getUniqueSlotTimes } from "@/lib/solver";

interface ExportContext {
  schoolName: string;
  academicYear: string;
  scheduleName: string;
  teachers: Teacher[];
  courses: Course[];
  subjects: Subject[];
  timeSlots: TimeSlot[];
  entries: ScheduleEntry[];
}

function styleHeader(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1D4ED8" },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function styleCell(cell: ExcelJS.Cell) {
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function buildGridSheet(
  sheet: ExcelJS.Worksheet,
  title: string,
  rowLabels: { id: string; name: string }[],
  getCellContent: (rowId: string, slot: TimeSlot) => string,
  timeSlots: TimeSlot[]
) {
  const days = getDaysFromSlots(timeSlots);
  const times = getUniqueSlotTimes(timeSlots);
  const recessSlots = timeSlots.filter((s) => s.slot_type === "recess");

  sheet.mergeCells(1, 1, 1, 1 + days.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  sheet.getCell(2, 1).value = "Hora";
  styleHeader(sheet.getCell(2, 1));

  days.forEach((day, i) => {
    const cell = sheet.getCell(2, i + 2);
    cell.value = DAY_LABELS[day];
    styleHeader(cell);
    sheet.getColumn(i + 2).width = 18;
  });

  let rowIndex = 3;
  for (const time of times) {
    const timeCell = sheet.getCell(rowIndex, 1);
    timeCell.value = formatTime(time);
    styleHeader(timeCell);

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const slot = timeSlots.find(
        (s) => s.day_of_week === day && s.start_time === time
      );
      const cell = sheet.getCell(rowIndex, dayIdx + 2);
      styleCell(cell);

      if (!slot) continue;
      if (slot.slot_type === "recess") {
        cell.value = "RECREO";
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        continue;
      }

      for (const row of rowLabels) {
        const content = getCellContent(row.id, slot);
        if (content) {
          cell.value = content;
          break;
        }
      }
    }
    rowIndex++;
  }

  for (const recess of recessSlots) {
    const dayIdx = days.indexOf(recess.day_of_week);
    if (dayIdx < 0) continue;
    const timeIdx = times.indexOf(recess.start_time);
    if (timeIdx < 0) continue;
    const cell = sheet.getCell(3 + timeIdx, dayIdx + 2);
    if (!cell.value) {
      cell.value = "RECREO";
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
    }
  }

  sheet.getColumn(1).width = 12;
}

export async function exportScheduleToExcel(ctx: ExportContext): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HorarioSL";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumen");
  summary.getCell("A1").value = "Horario escolar";
  summary.getCell("A1").font = { bold: true, size: 16 };
  summary.getCell("A3").value = "Colegio";
  summary.getCell("B3").value = ctx.schoolName;
  summary.getCell("A4").value = "Curso escolar";
  summary.getCell("B4").value = ctx.academicYear;
  summary.getCell("A5").value = "Horario";
  summary.getCell("B5").value = ctx.scheduleName;
  summary.getCell("A6").value = "Generado";
  summary.getCell("B6").value = new Date().toLocaleString("es-ES");
  summary.getColumn(1).width = 20;
  summary.getColumn(2).width = 40;

  const subjectMap = new Map(ctx.subjects.map((s) => [s.id, s]));
  const courseMap = new Map(ctx.courses.map((c) => [c.id, c]));

  for (const teacher of ctx.teachers) {
    const safeName = teacher.name.slice(0, 28).replace(/[\\/*?:[\]]/g, "");
    const sheet = workbook.addWorksheet(safeName || "Profesor");

    buildGridSheet(
      sheet,
      `Horario de ${teacher.name}`,
      [{ id: teacher.id, name: teacher.name }],
      (teacherId, slot) => {
        const entry = ctx.entries.find(
          (e) =>
            e.teacher_id === teacherId && e.time_slot_id === slot.id
        );
        if (!entry) return "";
        const subject = subjectMap.get(entry.subject_id);
        const course = courseMap.get(entry.course_id);
        return `${subject?.short_name || subject?.name || ""}\n${course?.name || ""}`;
      },
      ctx.timeSlots
    );
  }

  const coursesSheet = workbook.addWorksheet("Por curso");
  buildGridSheet(
    coursesSheet,
    "Horarios por curso",
    ctx.courses.map((c) => ({ id: c.id, name: c.name })),
    (courseId, slot) => {
      const entry = ctx.entries.find(
        (e) => e.course_id === courseId && e.time_slot_id === slot.id
      );
      if (!entry) return "";
      const subject = subjectMap.get(entry.subject_id);
      const teacher = ctx.teachers.find((t) => t.id === entry.teacher_id);
      return `${subject?.short_name || subject?.name || ""}\n${teacher?.name || ""}`;
    },
    ctx.timeSlots
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
