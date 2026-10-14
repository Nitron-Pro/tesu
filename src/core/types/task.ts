export type TaskInterval = "once" | "hourly" | "daily";
export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface ScheduledTask {
  id: string;
  appId?: string; // Optional namespace tag to guarantee app-level isolation
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
  appId?: string;
  executedAt: string;
  date: string; // YYYY-MM-DD
  durationMs: number;
  status: "success" | "failed";
  details?: string;
}
