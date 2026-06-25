"use client";

const SUBJECT_STYLES: Record<string, { bg: string; text: string }> = {
  MAT: { bg: "rgba(59,130,246,0.14)", text: "#2563eb" },
  LEN: { bg: "rgba(239,68,68,0.12)", text: "#dc2626" },
  ING: { bg: "rgba(34,197,94,0.12)", text: "#16a34a" },
  NAT: { bg: "rgba(20,184,166,0.12)", text: "#0d9488" },
  SOC: { bg: "rgba(245,158,11,0.14)", text: "#d97706" },
  EF: { bg: "rgba(139,92,246,0.12)", text: "#7c3aed" },
};

type Row =
  | { time: string; type: "sessions"; cells: string[] }
  | { time: string; type: "recess" };

const ROWS: Row[] = [
  { time: "8:30", type: "sessions", cells: ["MAT", "LEN", "ING", "NAT", "MAT"] },
  { time: "9:25", type: "sessions", cells: ["LEN", "MAT", "SOC", "ING", "LEN"] },
  { time: "10:20", type: "sessions", cells: ["ING", "NAT", "MAT", "EF", "SOC"] },
  { time: "11:15", type: "recess" },
  { time: "11:40", type: "sessions", cells: ["NAT", "EF", "LEN", "MAT", "ING"] },
];

const DAYS = ["L", "M", "X", "J", "V"];

export function LandingSchedulePreview() {
  return (
    <div
      className="landing-preview-card landing-card-shadow relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(19,65,85,0.09)] bg-white"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-[rgba(19,65,85,0.08)] bg-[#faf9f7] px-4 py-3">
        <span className="text-sm font-semibold text-[#13202b]">Horario · 1.º ESO A</span>
        <span className="rounded-full bg-[rgba(47,138,91,0.1)] px-2.5 py-0.5 text-[11px] font-semibold text-[#2f8a5b]">
          Generado
        </span>
      </div>
      <div className="p-3.5">
        <div
          className="grid gap-1.5 text-[11px]"
          style={{ gridTemplateColumns: "34px repeat(5, 1fr)" }}
        >
          <div />
          {DAYS.map((d) => (
            <div key={d} className="pb-0.5 text-center font-bold text-[#9a948a]">
              {d}
            </div>
          ))}

          {ROWS.map((row) => {
            if (row.type === "recess") {
              return (
                <div key={row.time} className="contents">
                  <div className="flex items-center justify-end pr-1 text-[10px] font-semibold text-[#b3ada2]">
                    {row.time}
                  </div>
                  <div
                    className="col-span-5 rounded-md bg-slate-100 py-2 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500"
                    style={{ gridColumn: "2 / -1" }}
                  >
                    RECREO
                  </div>
                </div>
              );
            }

            return (
              <div key={row.time} className="contents">
                <div className="flex items-center justify-end pr-1 text-[10px] font-semibold text-[#b3ada2]">
                  {row.time}
                </div>
                {row.cells.map((cell, ci) => {
                  const style = SUBJECT_STYLES[cell] ?? SUBJECT_STYLES.MAT;
                  return (
                    <div
                      key={`${row.time}-${ci}`}
                      className="rounded-md py-2 text-center text-[10px] font-bold"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {cell}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
