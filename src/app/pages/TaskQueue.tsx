import { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  Clock, 
  Archive, 
  Calendar, 
  Play, 
  Plus, 
  Trash2, 
  Activity, 
  RotateCcw,
  CheckCheck,
  Zap
} from "lucide-react";
import { useTaskStore } from "@/core/store/taskStore";
import { useSettingsStore } from "@/core/store/settingsStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TaskInterval } from "@/core/types/task";

export const TaskQueue = () => {
  const [activeTab, setActiveTab] = useState<"today" | "queue" | "history">("today");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInterval, setNewInterval] = useState<TaskInterval>("hourly");

  const {
    tasks,
    logs,
    selectedDateFilter,
    addTask,
    runTaskNow,
    deleteTask,
    clearHistory,
    setSelectedDateFilter,
  } = useTaskStore();
  const { t } = useSettingsStore();

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Today's logs
  const todayLogs = useMemo(() => {
    return logs.filter((l) => l.date === todayStr);
  }, [logs, todayStr]);

  // Tasks in queue (pending or running)
  const queueTasks = useMemo(() => {
    return tasks.filter((t) => t.status === "pending" || t.status === "running");
  }, [tasks]);

  // History logs (past days or filtered)
  const historyLogs = useMemo(() => {
    if (selectedDateFilter === "all") {
      return logs.filter((l) => l.date !== todayStr);
    }
    return logs.filter((l) => l.date === selectedDateFilter);
  }, [logs, todayStr, selectedDateFilter]);

  // Distinct dates for history filter dropdown
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(logs.map((l) => l.date)));
    return dates.sort().reverse();
  }, [logs]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask(newTitle.trim(), newInterval);
    setNewTitle("");
    setShowAddModal(false);
    setActiveTab("queue");
  };

  const successRate = useMemo(() => {
    if (logs.length === 0) return 100;
    const successes = logs.filter((l) => l.status === "success").length;
    return Math.round((successes / logs.length) * 100);
  }, [logs]);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{t("taskQueueTitle")}</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              CRON ACTIVE
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("taskQueueSubtitle")}
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(!showAddModal)}
          size="sm"
          className="gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("addNewTask")}</span>
        </Button>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("totalExecuted")}</p>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">
              {logs.length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Activity className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("activeInQueue")}</p>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">
              {queueTasks.length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("successRate")}</p>
            <p className="text-xl font-bold font-mono text-emerald-500 mt-0.5">
              {successRate}%
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCheck className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* Inline Add Task Form */}
      {showAddModal && (
        <Card className="border-primary/40 shadow-md animate-in fade-in-50 duration-150">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>{t("addNewTask")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <Input
                placeholder={t("taskTitlePlaceholder")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">{t("taskInterval")}:</span>
                  <select
                    value={newInterval}
                    onChange={(e) => setNewInterval(e.target.value as TaskInterval)}
                    className="bg-background border border-input rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="hourly">{t("intervalHourly")}</option>
                    <option value="daily">{t("intervalDaily")}</option>
                    <option value="once">{t("intervalOnce")}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Schedule
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("today")}
            className={`flex items-center gap-2 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "today"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t("todayCompleted")} ({todayLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-2 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "queue"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{t("inQueueUpcoming")} ({queueTasks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "history"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-blue-500" />
            <span>{t("historyArchive")} ({historyLogs.length})</span>
          </button>
        </div>

        {activeTab === "history" && logs.length > 0 && (
          <div className="flex items-center gap-2 pb-2">
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-background border border-input rounded-md px-2 py-0.5 text-[11px] text-muted-foreground focus:outline-none"
            >
              <option value="all">{t("allDates")}</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
              title={t("clearHistory")}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Content Panels */}
      <Card className="overflow-hidden">
        {/* TAB 1: Today's Executed Tasks */}
        {activeTab === "today" && (
          <div>
            {todayLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                {t("emptyToday")}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {todayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{log.taskTitle}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                          <span>{log.executedAt}</span>
                          <span>•</span>
                          <span>{log.durationMs}ms</span>
                          {log.details && (
                            <>
                              <span>•</span>
                              <span className="font-sans text-muted-foreground/80">{log.details}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">
                      {t("statusCompleted")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: In Queue & Upcoming */}
        {activeTab === "queue" && (
          <div>
            {queueTasks.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                {t("emptyQueue")}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {queueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className={`w-4 h-4 text-amber-500 shrink-0 ${task.status === "running" ? "animate-spin" : ""}`} />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <Badge variant="secondary" className="font-mono text-[9px] uppercase">
                            {task.interval}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {task.scheduledTime}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={task.status === "running"}
                        onClick={() => runTaskNow(task.id)}
                        className="gap-1.5 h-7 px-2.5 text-[11px]"
                      >
                        {task.status === "running" ? (
                          <>
                            <RotateCcw className="w-3 h-3 animate-spin" />
                            <span>{t("statusRunning")}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>{t("runNow")}</span>
                          </>
                        )}
                      </Button>

                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: History & Archives */}
        {activeTab === "history" && (
          <div>
            {historyLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                {t("emptyHistory")}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{log.taskTitle}</p>
                        <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                          <span>{log.date}</span>
                          <span>•</span>
                          <span>{log.executedAt}</span>
                          <span>•</span>
                          <span>{log.durationMs}ms</span>
                        </p>
                      </div>
                    </div>

                    <Badge variant="outline" className="font-mono text-[10px]">
                      {t("statusArchived")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
