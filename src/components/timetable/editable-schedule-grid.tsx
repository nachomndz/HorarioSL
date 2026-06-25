"use client";

import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { Course, ScheduleEntry, Subject, Teacher, TimeSlot } from "@/types";
import { DAY_LABELS, formatTime } from "@/lib/utils";
import { getDaysFromSlots, getUniqueSlotTimes } from "@/lib/solver";
import { cn } from "@/lib/utils";

interface EditableScheduleGridProps {
  teacher: Teacher;
  timeSlots: TimeSlot[];
  entries: ScheduleEntry[];
  subjects: Subject[];
  courses: Course[];
  readOnly?: boolean;
  onMove: (entryId: string, newTimeSlotId: string) => void;
}

function DraggableCell({
  entry,
  subject,
  courseName,
  disabled,
}: {
  entry: ScheduleEntry;
  subject?: Subject;
  courseName: string;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `entry-${entry.id}`,
    data: { entryId: entry.id, timeSlotId: entry.time_slot_id },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: subject?.color ? `${subject.color}22` : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "min-h-[52px] rounded-md border px-1 py-1.5 text-center transition-shadow",
        !disabled && "cursor-grab active:cursor-grabbing hover:shadow-md",
        isDragging && "opacity-40"
      )}
    >
      <div className="text-xs font-semibold">{subject?.short_name || subject?.name}</div>
      <div className="text-[10px] text-muted-foreground">{courseName}</div>
    </div>
  );
}

function DroppableSlot({
  slotId,
  children,
  canDrop,
}: {
  slotId: string;
  children: React.ReactNode;
  canDrop: boolean;
}) {
  const { setNodeRef, isOver: over } = useDroppable({
    id: `slot-${slotId}`,
    data: { timeSlotId: slotId },
  });

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "border p-1 align-top",
        over && canDrop && "bg-primary/10 ring-2 ring-inset ring-primary",
        over && !canDrop && "bg-destructive/10"
      )}
    >
      {children}
    </td>
  );
}

export function EditableScheduleGrid({
  teacher,
  timeSlots,
  entries,
  subjects,
  courses,
  readOnly = false,
  onMove,
}: EditableScheduleGridProps) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const days = getDaysFromSlots(timeSlots);
  const times = getUniqueSlotTimes(timeSlots);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const teacherEntries = entries.filter((e) => e.teacher_id === teacher.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const entryId = event.active.data.current?.entryId as string | undefined;
    if (entryId) setActiveEntryId(entryId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveEntryId(null);
    if (readOnly) return;
    const entryId = event.active.data.current?.entryId as string | undefined;
    const fromSlotId = event.active.data.current?.timeSlotId as string | undefined;
    const toSlotId = event.over?.data.current?.timeSlotId as string | undefined;
    if (!entryId || !toSlotId || fromSlotId === toSlotId) return;
    onMove(entryId, toSlotId);
  }

  const activeEntry = activeEntryId
    ? teacherEntries.find((e) => e.id === activeEntryId)
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-primary px-3 py-2 text-left font-medium text-primary-foreground">
                Hora
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className="border bg-primary px-3 py-2 text-center font-medium text-primary-foreground"
                >
                  {DAY_LABELS[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <td className="border bg-muted px-3 py-2 font-medium whitespace-nowrap">
                  {formatTime(time)}
                </td>
                {days.map((day) => {
                  const slot = timeSlots.find(
                    (s) => s.day_of_week === day && s.start_time === time
                  );
                  if (!slot) {
                    return (
                      <td key={day} className="border px-2 py-2 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  if (slot.slot_type === "recess") {
                    return (
                      <td
                        key={day}
                        className="border bg-slate-100 px-2 py-2 text-center text-xs font-medium text-slate-500"
                      >
                        RECREO
                      </td>
                    );
                  }
                  const entry = teacherEntries.find((e) => e.time_slot_id === slot.id);
                  const occupiedByOther = entries.some(
                    (e) =>
                      e.time_slot_id === slot.id &&
                      e.teacher_id !== teacher.id &&
                      e.id !== entry?.id
                  );

                  return (
                    <DroppableSlot
                      key={day}
                      slotId={slot.id}
                      canDrop={!entry && !occupiedByOther}
                    >
                      {entry ? (
                        <DraggableCell
                          entry={entry}
                          subject={subjectMap.get(entry.subject_id)}
                          courseName={courseMap.get(entry.course_id)?.name ?? ""}
                          disabled={readOnly}
                        />
                      ) : (
                        <div className="flex min-h-[52px] items-center justify-center text-xs text-muted-foreground">
                          {readOnly ? "—" : "Soltar aquí"}
                        </div>
                      )}
                    </DroppableSlot>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeEntry && (
          <div
            className="rounded-md border bg-card px-3 py-2 text-center shadow-lg"
            style={{
              backgroundColor: subjectMap.get(activeEntry.subject_id)?.color
                ? `${subjectMap.get(activeEntry.subject_id)!.color}33`
                : undefined,
            }}
          >
            <div className="text-xs font-semibold">
              {subjectMap.get(activeEntry.subject_id)?.short_name ||
                subjectMap.get(activeEntry.subject_id)?.name}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {courseMap.get(activeEntry.course_id)?.name}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
