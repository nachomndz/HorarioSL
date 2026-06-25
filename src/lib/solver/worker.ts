import { solveSchedule } from "./index";
import type { WorkerRequest, WorkerResponse } from "./runner";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== "solve") return;

  try {
    const result = solveSchedule(event.data.input, {
      maxIterations: event.data.maxIterations,
      onProgress: (placed, total) => {
        const progress: WorkerResponse = { type: "progress", placed, total };
        self.postMessage(progress);
      },
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
