export type TaskInterval = "once" | "hourly" | "daily";
export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface ScheduledTask {
  id: string;
  title: string;
  scheduledTime: string;
  interval: TaskInterval;
  status: TaskStatus;
  category: "hardware" | "database" | "system" | "network";
  createdAt: string;
}

export interface TaskExecutionLog {
  id: string;
  taskId: string;
  taskTitle: string;
  executedAt: string;
  date: string; // YYYY-MM-DD
  durationMs: number;
  status: "success" | "failed";
  details?: string;
}
