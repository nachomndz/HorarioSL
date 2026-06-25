import { solveSchedule, solveScheduleBest } from "./index";
import type { WorkerRequest, WorkerResponse } from "./runner";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "solve" && event.data.type !== "solveBest") return;

  try {
    const onProgress = (placed: number, total: number) => {
      const progress: WorkerResponse = { type: "progress", placed, total };
      self.postMessage(progress);
    };

    const result =
      event.data.type === "solveBest"
        ? solveScheduleBest(event.data.input, {
            attempts: event.data.attempts ?? 15,
            maxIterations: event.data.maxIterations,
            onProgress,
          })
        : solveSchedule(event.data.input, {
            maxIterations: event.data.maxIterations,
            onProgress,
          });

    const response: WorkerResponse = { type: "result", result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "Error desconocido",
    };
    self.postMessage(response);
  }
};

export {};
