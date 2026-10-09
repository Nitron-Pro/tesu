import { useState, useMemo } from "react";
import { 
  LayoutDashboard, 
  Cpu, 
  ListTodo, 
  Settings, 
  Radio, 
  Printer, 
  CheckCircle2, 
  Clock, 
  Archive,
  ChevronRight,
  Search,
  Wallet,
  Bot,
  Send,
  LineChart,
  BarChart2,
  LucideIcon
} from "lucide-react";
import { APP_CONFIG, MenuItemLevel1, MenuItemLevel2 } from "@/app/config";
import { cn } from "@/core/utils/cn";
import { useSettingsStore } from "@/core/store/settingsStore";
import { TranslationKey } from "@/core/i18n/translations";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Cpu,
  ListTodo,
  Settings,
  Radio,
  Printer,
  CheckCircle2,
  Clock,
  Archive,
  Wallet,
  Bot,
  Send,
  LineChart,
  BarChart2,
};

interface AppSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AppSidebar = ({ currentPath, onNavigate }: AppSidebarProps) => {
  const [selectedL1, setSelectedL1] = useState<MenuItemLevel1>(
    APP_CONFIG.menuItems[0]
  );
  const [expandedL2, setExpandedL2] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useSettingsStore();

  const handleL1Click = (item: MenuItemLevel1) => {
    setSelectedL1(item);
    setSearchQuery("");
    if (item.path) {
      onNavigate(item.path);
    } else if (item.children && item.children.length > 0) {
      const firstL2 = item.children[0];
      if (firstL2.path) {
        onNavigate(firstL2.path);
      } else if (firstL2.children && firstL2.children.length > 0) {
        onNavigate(firstL2.children[0].path);
      }
    }
  };

  const handleL2Click = (item: MenuItemLevel2) => {
    if (item.children && item.children.length > 0) {
      setExpandedL2(expandedL2 === item.id ? null : item.id);
    } else if (item.path) {
      onNavigate(item.path);
    }
  };

  const hasLevel2 = selectedL1.children && selectedL1.children.length > 0;

  // Filter level 2 & level 3 items by search
  const filteredL2 = useMemo(() => {
    if (!selectedL1.children) return [];
    if (!searchQuery.trim()) return selectedL1.children;
    const q = searchQuery.toLowerCase();

    return selectedL1.children.filter((l2) => {
      const matchL2 = l2.label.toLowerCase().includes(q);
      const matchL3 = l2.children?.some((l3) =>
        l3.label.toLowerCase().includes(q)
      );
      return matchL2 || matchL3;
    });
  }, [selectedL1, searchQuery]);

  // Translate label if available in i18n
  const getLabel = (label: string, id: string) => {
    const keyMap: Record<string, TranslationKey> = {
      dashboard: "dashboard",
      hardware: "hardware",
      tasks: "tasks",
      settings: "settings",
      "serial-ports": "serialPorts",
      printers: "printers",
      "thermal-printers": "thermalPrinters",
      "system-printers": "systemPrinters",
      "today-tasks": "todayCompleted",
      "queue-tasks": "inQueueUpcoming",
      "history-tasks": "historyArchive",
    };
    const key = keyMap[id];
    return key ? t(key) : label;
  };

  return (
    <aside className="h-full flex flex-row border-e border-border select-none bg-card/60">
      {/* LEVEL 1: Primary Thin Bar (Large Icons) */}
      <div className="w-16 h-full bg-background border-e border-border/80 flex flex-col items-center py-3 gap-2.5 z-10 shrink-0">
        {APP_CONFIG.menuItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const isActive = selectedL1.id === item.id;
          const label = getLabel(item.label, item.id);

          return (
            <button
              key={item.id}
              onClick={() => handleL1Click(item)}
              title={label}
              className={cn(
                "w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-all group relative cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5 transition-transform group-hover:scale-105" />
              <span className="text-[9px] font-medium mt-0.5 truncate max-w-[42px] scale-90">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* LEVEL 2 & 3: Secondary Panel (Adaptive: Only appears when selected L1 has children) */}
      {hasLevel2 && (
        <div className="w-56 h-full bg-card/40 flex flex-col py-3 px-2.5 border-e border-border/60 animate-in fade-in-50 duration-150">
          <div className="px-1.5 pb-2 mb-2 border-b border-border/60 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {getLabel(selectedL1.label, selectedL1.id)}
            </span>
          </div>

          {/* Quick Search inside sub-items */}
          {selectedL1.children && selectedL1.children.length > 2 && (
            <div className="relative mb-2 px-1">
              <Search className="w-3 h-3 absolute start-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background/70 border border-input rounded-md ps-7 pe-2 py-1 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1 pe-0.5">
            {filteredL2.map((l2) => {
              const L2Icon = l2.icon ? ICON_MAP[l2.icon] : null;
              const hasL3 = l2.children && l2.children.length > 0;
              const isL2Active = currentPath === l2.path;
              const isExpanded = expandedL2 === l2.id || hasL3;
              const l2Label = getLabel(l2.label, l2.id);

              return (
                <div key={l2.id} className="space-y-0.5">
                  {/* LEVEL 2: Small Icon + Label */}
                  <button
                    onClick={() => handleL2Click(l2)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                      isL2Active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {L2Icon && <L2Icon className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{l2Label}</span>
                    </div>
                    {hasL3 && (
                      <ChevronRight
                        className={cn(
                          "w-3 h-3 transition-transform text-muted-foreground rtl:rotate-180",
                          isExpanded && "rotate-90 rtl:rotate-90"
                        )}
                      />
                    )}
                  </button>

                  {/* LEVEL 3: Text Only (No Icons) */}
                  {hasL3 && isExpanded && (
                    <div className="ps-5 pe-1 py-0.5 space-y-0.5 border-s border-border/60 ms-3">
                      {l2.children?.map((l3) => {
                        const isL3Active = currentPath === l3.path;
                        const l3Label = getLabel(l3.label, l3.id);
                        return (
                          <button
                            key={l3.id}
                            onClick={() => onNavigate(l3.path)}
                            className={cn(
                              "w-full text-start py-1 px-2 rounded-md text-[11px] transition-colors truncate block cursor-pointer",
                              isL3Active
                                ? "font-medium text-foreground bg-accent/60"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            {l3Label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
