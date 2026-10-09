import { create } from "zustand";
import { ScheduledTask, TaskExecutionLog, TaskInterval } from "@/core/types/task";

const STORAGE_TASKS = "nora_scheduled_tasks";
const STORAGE_LOGS = "nora_task_execution_logs";

const INITIAL_TASKS: ScheduledTask[] = [
  {
    id: "task-1",
    title: "Scan & Verify Serial Hardware COM Ports",
    scheduledTime: "Hourly at :00",
    interval: "hourly",
    status: "pending",
    category: "hardware",
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-2",
    title: "Daily In-App Version & Manifest Probe",
    scheduledTime: "Daily at 00:00",
    interval: "daily",
    status: "pending",
    category: "system",
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-3",
    title: "Sync Local Offline Store & Vacuum SQLite",
    scheduledTime: "Daily at 03:00",
    interval: "daily",
    status: "pending",
    category: "database",
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_LOGS: TaskExecutionLog[] = [
  {
    id: "log-1",
    taskId: "task-1",
    taskTitle: "Scan & Verify Serial Hardware COM Ports",
    executedAt: new Date(Date.now() - 3600000).toLocaleTimeString(),
    date: new Date().toISOString().split("T")[0],
    durationMs: 145,
    status: "success",
    details: "Found active COM1 and USB serial bridge.",
  },
  {
    id: "log-2",
    taskId: "task-2",
    taskTitle: "Daily In-App Version & Manifest Probe",
    executedAt: new Date(Date.now() - 7200000).toLocaleTimeString(),
    date: new Date().toISOString().split("T")[0],
    durationMs: 82,
    status: "success",
    details: "Version v1.0.0 verified against local repository.",
  },
  {
    id: "log-3",
    taskId: "task-3",
    taskTitle: "Sync Local Offline Store & Vacuum SQLite",
    executedAt: "03:00:15 AM",
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    durationMs: 310,
    status: "success",
    details: "Database indexed and tables verified.",
  },
  {
    id: "log-4",
    taskId: "task-1",
    taskTitle: "Scan & Verify Serial Hardware COM Ports",
    executedAt: "10:00:02 AM",
    date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
    durationMs: 130,
    status: "success",
    details: "Hardware scan complete.",
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

interface TaskState {
  tasks: ScheduledTask[];
  logs: TaskExecutionLog[];
  selectedDateFilter: string;

  // Actions
  addTask: (title: string, interval: TaskInterval, category?: ScheduledTask["category"]) => void;
  runTaskNow: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => void;
  clearHistory: () => void;
  setSelectedDateFilter: (date: string) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: loadFromStorage<ScheduledTask[]>(STORAGE_TASKS, INITIAL_TASKS),
  logs: loadFromStorage<TaskExecutionLog[]>(STORAGE_LOGS, INITIAL_LOGS),
  selectedDateFilter: "all",

  addTask: (title, interval, category = "system") => {
    const newTask: ScheduledTask = {
      id: `task-${Date.now()}`,
      title,
      scheduledTime:
        interval === "hourly"
          ? "Hourly at :00"
          : interval === "daily"
          ? "Daily at 00:00"
          : "Scheduled once",
      interval,
      status: "pending",
      category,
      createdAt: new Date().toISOString(),
    };

    const updated = [newTask, ...get().tasks];
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(updated));
    set({ tasks: updated });
  },

  runTaskNow: async (taskId) => {
    // 1. Mark task as running
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: "running" } : t
      ),
    }));

    const task = get().tasks.find((t) => t.id === taskId);
    const start = performance.now();

    // Simulate work duration
    await new Promise((res) => setTimeout(res, 800));
    const durationMs = Math.round(performance.now() - start);

    // 2. Create log entry
    const newLog: TaskExecutionLog = {
      id: `log-${Date.now()}`,
      taskId,
      taskTitle: task?.title || "Manual Task",
      executedAt: new Date().toLocaleTimeString(),
      date: new Date().toISOString().split("T")[0],
      durationMs,
      status: "success",
      details: "Executed manually on demand by system runner.",
    };

    const updatedLogs = [newLog, ...get().logs];
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(updatedLogs));

    // 3. Mark task as completed or pending if it's recurring
    const updatedTasks = get().tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: t.interval === "once" ? ("completed" as const) : ("pending" as const) }
        : t
    );
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(updatedTasks));

    set({ tasks: updatedTasks, logs: updatedLogs });
  },

  deleteTask: (taskId) => {
    const updated = get().tasks.filter((t) => t.id !== taskId);
    localStorage.setItem(STORAGE_TASKS, JSON.stringify(updated));
    set({ tasks: updated });
  },

  clearHistory: () => {
    localStorage.removeItem(STORAGE_LOGS);
    set({ logs: [] });
  },

  setSelectedDateFilter: (date) => set({ selectedDateFilter: date }),
}));
