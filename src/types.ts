import type { Credential } from "@opencode/plugin";

export type QuotaWindow = {
  label: string;
  // Remaining percentage in the range 0–100.
  remaining: number;
  // Unix timestamp in milliseconds.
  resetsAt?: number;
};

export type Balance = {
  // Monetary amount; zero and negative balances are valid.
  remaining: number;
  // Uppercase ISO 4217 currency code, such as USD or CNY.
  currency: string;
};

// Providers normalize upstream responses into one of these billing modes.
export type QuotaData =
  | { mode: "subscription"; windows: QuotaWindow[] }
  | { mode: "balance"; balances: Balance[] };

export type QuotaSnapshot = QuotaData & {
  // Time of the successful query, as a Unix timestamp in milliseconds.
  updatedAt: number;
};

export interface UsageRequest {
  url: string;
  headers: Record<string, string>;
  // Missing or invalid usage is not a zero balance.
  parse(body: unknown): QuotaData | undefined;
}

export interface Provider {
  id: string;
  // Integration that stores this provider's credentials when it differs from the model provider ID.
  integrationID?: string;
  // Use only the resolved OpenCode credential; return undefined when unsupported.
  request(credential: Credential.Value): UsageRequest | undefined;
}
