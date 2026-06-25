import type { SolverInput } from "@/types";
import { solveSchedule, solveScheduleBest } from "./index";

export type WorkerRequest = {
  type: "solve" | "solveBest";
  input: SolverInput;
  maxIterations?: number;
  attempts?: number;
};

export type WorkerResponse = {
  type: "progress" | "result" | "error";
  placed?: number;
  total?: number;
  result?: ReturnType<typeof solveSchedule>;
  message?: string;
};

export function solveInWorker(
  input: SolverInput,
  onProgress?: (placed: number, total: number) => void
): Promise<ReturnType<typeof solveSchedule>> {
  return runInWorker({ type: "solve", input }, onProgress);
}

export function solveBestInWorker(
  input: SolverInput,
  options?: { attempts?: number; onProgress?: (placed: number, total: number) => void }
): Promise<ReturnType<typeof solveScheduleBest>> {
  return runInWorker(
    { type: "solveBest", input, attempts: options?.attempts ?? 15 },
    options?.onProgress
  );
}

function runInWorker(
  request: WorkerRequest,
  onProgress?: (placed: number, total: number) => void
): Promise<ReturnType<typeof solveSchedule>> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      if (request.type === "solveBest") {
        resolve(
          solveScheduleBest(request.input, {
            attempts: request.attempts,
            onProgress,
          })
        );
      } else {
        resolve(solveSchedule(request.input, { onProgress }));
      }
      return;
    }

    const worker = new Worker(new URL("./worker.ts", import.meta.url));
    worker.postMessage(request);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.type === "progress" && data.placed != null && data.total != null) {
        onProgress?.(data.placed, data.total);
      }
      if (data.type === "result" && data.result) {
        worker.terminate();
        resolve(data.result);
      }
      if (data.type === "error") {
        worker.terminate();
        reject(new Error(data.message ?? "Error en el worker"));
      }
    };

    worker.onerror = () => {
      worker.terminate();
      if (request.type === "solveBest") {
        resolve(
          solveScheduleBest(request.input, {
            attempts: request.attempts,
            onProgress,
          })
        );
      } else {
        resolve(solveSchedule(request.input, { onProgress }));
      }
    };
  });
}
