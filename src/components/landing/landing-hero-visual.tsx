"use client";

import dynamic from "next/dynamic";
import { LandingSchedulePreview } from "@/components/landing/landing-schedule-preview";

const LandingTimetableScene = dynamic(
  () =>
    import("@/components/landing/landing-timetable-scene").then((m) => ({
      default: m.LandingTimetableScene,
    })),
  { ssr: false }
);

export function LandingHeroVisual() {
  return (
    <div className="relative flex min-h-[320px] items-center justify-center lg:min-h-[420px] lg:justify-end">
      <LandingTimetableScene />
      <LandingSchedulePreview />
    </div>
  );
}
