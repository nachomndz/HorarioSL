import type { SolverInput } from "@/types";
import { solveSchedule } from "./index";

export type WorkerRequest = {
  type: "solve";
  input: SolverInput;
  maxIterations?: number;
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
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      resolve(
        solveSchedule(input, {
          onProgress,
        })
      );
      return;
    }

    const worker = new Worker(new URL("./worker.ts", import.meta.url));
    worker.postMessage({ type: "solve", input } satisfies WorkerRequest);

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
      resolve(solveSchedule(input, { onProgress }));
    };
  });
}
