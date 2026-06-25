import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Cycle } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export const DAY_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

export const CYCLE_LABELS: Record<Cycle, string> = {
  infantil: "Educación Infantil",
  primaria: "Educación Primaria",
  secundaria: "Educación Secundaria",
  diversificacion: "Diversificación",
};

export const CYCLE_ORDER: Cycle[] = [
  "infantil",
  "primaria",
  "secundaria",
  "diversificacion",
];

export const DEFAULT_COURSES_TEMPLATE: { name: string; cycle: Cycle }[] = [
  { name: "Infantil 3 años", cycle: "infantil" },
  { name: "Infantil 4 años", cycle: "infantil" },
  { name: "Infantil 5 años", cycle: "infantil" },
  { name: "1.º Primaria", cycle: "primaria" },
  { name: "2.º Primaria", cycle: "primaria" },
  { name: "3.º Primaria", cycle: "primaria" },
  { name: "4.º Primaria", cycle: "primaria" },
  { name: "5.º Primaria", cycle: "primaria" },
  { name: "6.º Primaria", cycle: "primaria" },
  { name: "1.º Secundaria", cycle: "secundaria" },
  { name: "2.º Secundaria", cycle: "secundaria" },
  { name: "3.º Secundaria", cycle: "secundaria" },
  { name: "4.º Secundaria", cycle: "secundaria" },
  { name: "Clase de Diversificación", cycle: "diversificacion" },
];
