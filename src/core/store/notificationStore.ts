import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "default" | "destructive" | "outline" | "secondary";
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  timestamp: string; // ISO
  duration?: number; // ms, default 5000, 0 for sticky
  confirmAction?: ToastAction;
  cancelAction?: ToastAction;
  read?: boolean;
}

interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  confirmAction?: ToastAction;
  cancelAction?: ToastAction;
}

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive" | "secondary";
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface NotificationState {
  activeToasts: ToastItem[];
  history: ToastItem[]; // Keeps latest 10 notifications for the bell menu
  
  // Actions
  toast: (options: ToastOptions) => string;
  confirm: (options: ConfirmDialogOptions) => string;
  dismissToast: (id: string) => void;
  clearHistory: () => void;
  markAllAsRead: () => void;
}

const STORAGE_NOTIFS_HISTORY = "nora_notifications_history";

function loadHistory(): ToastItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_NOTIFS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: ToastItem[]) {
  try {
    // Keep max 10 latest items
    const trimmed = items.slice(0, 10);
    localStorage.setItem(STORAGE_NOTIFS_HISTORY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  activeToasts: [],
  history: loadHistory(),

  toast: (options) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = {
      id,
      type: options.type || "info",
      title: options.title,
      message: options.message,
      timestamp: new Date().toISOString(),
      duration: options.duration !== undefined ? options.duration : 5000,
      confirmAction: options.confirmAction,
      cancelAction: options.cancelAction,
      read: false,
    };

    // Update active toasts
    set((state) => ({
      activeToasts: [...state.activeToasts, newItem],
      history: [newItem, ...state.history].slice(0, 10),
    }));

    saveHistory([newItem, ...get().history]);

    // Auto-dismiss if duration > 0
    if (newItem.duration && newItem.duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, newItem.duration);
    }

    return id;
  },

  confirm: (options) => {
    const id = `confirm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: ToastItem = {
      id,
      type: "warning",
      title: options.title,
      message: options.message,
      timestamp: new Date().toISOString(),
      duration: 0, // sticky until user responds
      confirmAction: {
        label: options.confirmLabel || "Confirm",
        variant: options.confirmVariant || "default",
        onClick: async () => {
          get().dismissToast(id);
          await options.onConfirm();
        },
      },
      cancelAction: {
        label: options.cancelLabel || "Cancel",
        variant: "outline",
        onClick: () => {
          get().dismissToast(id);
          if (options.onCancel) options.onCancel();
        },
      },
      read: false,
    };

    set((state) => ({
      activeToasts: [...state.activeToasts, newItem],
      history: [newItem, ...state.history].slice(0, 10),
    }));

    saveHistory([newItem, ...get().history]);
    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      activeToasts: state.activeToasts.filter((t) => t.id !== id),
    }));
  },

  clearHistory: () => {
    localStorage.removeItem(STORAGE_NOTIFS_HISTORY);
    set({ history: [] });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.history.map((h) => ({ ...h, read: true }));
      saveHistory(updated);
      return { history: updated };
    });
  },
}));
