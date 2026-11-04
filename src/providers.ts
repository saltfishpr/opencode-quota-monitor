import type { Balance, Provider, QuotaWindow } from "./types";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function window(label: string, remaining: unknown, reset: unknown): QuotaWindow[] {
  if (typeof remaining !== "number" || !Number.isFinite(remaining)) return [];
  const resetsAt = typeof reset === "number" ? reset * 1000 : typeof reset === "string" ? Date.parse(reset) : NaN;
  return [
    {
      label,
      remaining: Math.max(0, Math.min(100, remaining)),
      ...(Number.isFinite(resetsAt) ? { resetsAt } : {}),
    },
  ];
}

const openai: Provider = {
  id: "openai",
  request(credential) {
    // Token-sharing grants target api.openai.com and cannot read the Codex usage API.
    if (
      credential.type !== "oauth" ||
      !credential.access ||
      !["chatgpt-browser", "chatgpt-headless"].includes(credential.methodID ?? "")
    )
      return;
    const accountID = credential.metadata?.accountID;
    return {
      url: "https://chatgpt.com/backend-api/wham/usage",
      headers: {
        Authorization: `Bearer ${credential.access}`,
        ...(typeof accountID === "string" ? { "ChatGPT-Account-Id": accountID } : {}),
      },
      parse(body) {
        const limits = record(record(body).rate_limit);
        const windows = [limits.primary_window, limits.secondary_window].flatMap((value) => {
          const item = record(value);
          const seconds = item.limit_window_seconds;
          if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return [];
          // Some plans put the weekly limit in primary_window; classify by duration, not position.
          const label =
            seconds === 604800 ? "week" : seconds % 86400 === 0 ? `${seconds / 86400}d` : `${seconds / 3600}h`;
          return window(
            label,
            typeof item.used_percent === "number" ? 100 - item.used_percent : undefined,
            item.reset_at,
          );
        });
        return { mode: "subscription", windows };
      },
    };
  },
};

const anthropic: Provider = {
  id: "anthropic",
  request(credential) {
    if (credential.type !== "oauth" || !credential.access) return;
    return {
      url: "https://api.anthropic.com/api/oauth/usage",
      headers: { Authorization: `Bearer ${credential.access}`, "anthropic-beta": "oauth-2025-04-20" },
      parse(body) {
        const limits = record(body);
        const windows = [
          ["five_hour", "5h"],
          ["seven_day", "week"],
        ].flatMap(([key, label]) => {
          const item = record(limits[key]);
          return window(
            label,
            typeof item.utilization === "number" ? 100 - item.utilization : undefined,
            item.resets_at,
          );
        });
        return { mode: "subscription", windows };
      },
    };
  },
};

const copilot: Provider = {
  id: "github-copilot",
  request(credential) {
    // Enterprise hosts need their own API routing; never send those credentials to github.com.
    if (credential.metadata?.enterpriseUrl || credential.metadata?.enterpriseURL) return;
    const token =
      credential.type === "oauth" ? credential.access : credential.type === "key" ? credential.key : undefined;
    if (!token) return;
    return {
      url: "https://api.github.com/copilot_internal/user",
      headers: {
        Authorization: `token ${token}`,
        "Editor-Version": "vscode/1.96.2",
        "Editor-Plugin-Version": "copilot-chat/0.26.7",
        "X-GitHub-Api-Version": "2025-04-01",
      },
      parse(body) {
        const usage = record(body);
        if (usage.access_type_sku === "subscription_ended") return;
        const quotas = record(usage.quota_snapshots);
        const windows = [
          ["premium_interactions", "premium"],
          ["chat", "chat"],
        ].flatMap(([key, label]) => {
          const item = record(quotas[key]);
          // Unlimited and placeholder entries do not establish a metered percentage.
          if (item.unlimited !== false || typeof item.entitlement !== "number" || item.entitlement <= 0) return [];
          return window(label, item.percent_remaining, usage.quota_reset_date);
        });
        return { mode: "subscription", windows };
      },
    };
  },
};

const deepseek: Provider = {
  id: "deepseek",
  request(credential) {
    if (credential.type !== "key" || !credential.key) return;
    return {
      url: "https://api.deepseek.com/user/balance",
      headers: { Authorization: `Bearer ${credential.key}` },
      parse(body) {
        const entries = record(body).balance_infos;
        if (!Array.isArray(entries)) return;
        const balances: Balance[] = [];
        for (const value of entries) {
          const item = record(value);
          const currency = item.currency;
          if (currency !== "CNY" && currency !== "USD") continue;
          if (typeof item.total_balance !== "string" || !item.total_balance.trim()) continue;
          const remaining = Number(item.total_balance);
          if (!Number.isFinite(remaining)) continue;
          balances.push({ remaining, currency });
        }
        if (!balances.length) return;
        return { mode: "balance", balances };
      },
    };
  },
};

const opencodeGo: Provider = {
  id: "opencode-go",
  // The Go plan is part of the OpenCode Console account, not a separate integration.
  integrationID: "opencode",
  request(credential) {
    const token =
      credential.type === "oauth" ? credential.access : credential.type === "key" ? credential.key : undefined;
    if (!token) return;
    return {
      url: "https://opencode.ai/console/api/go/status",
      headers: { Authorization: `Bearer ${token}` },
      parse(body) {
        const meters = record(record(record(body).access).meters);
        const windows = [
          ["fiveHour", "5h"],
          ["week", "week"],
          ["month", "month"],
        ].flatMap(([key, label]) => {
          const item = record(meters[key]);
          // Console encodes microcent amounts as decimal strings.
          if (
            typeof item.limitMicroCents !== "string" ||
            !item.limitMicroCents.trim() ||
            typeof item.usedMicroCents !== "string" ||
            !item.usedMicroCents.trim()
          )
            return [];
          const limit = Number(item.limitMicroCents);
          const used = Number(item.usedMicroCents);
          if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(used) || used < 0) return [];
          return window(label, (1 - used / limit) * 100, item.resetsAt);
        });
        if (!windows.length) return;
        return { mode: "subscription", windows };
      },
    };
  },
};

export const providers: readonly Provider[] = [openai, anthropic, copilot, deepseek, opencodeGo];
