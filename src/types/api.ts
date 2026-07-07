export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type AgentStatus = "online" | "offline";
export type DatabaseStatus = "unknown" | "ok" | "failed";
export type CommandStatus = "pending" | "running" | "success" | "failed" | "cancelled";
