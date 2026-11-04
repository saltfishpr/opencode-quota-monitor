import { Schema } from "effect";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { createKeyed, Plugin, Slot, Store, Style } from "@opencode/plugin/gui";
import { Quota } from "./rpc";
import type { Balance, QuotaSnapshot } from "./types";

const Selection = Schema.Struct({
  window: Schema.optionalKey(Schema.String),
  currency: Schema.optionalKey(Schema.String),
});

export default Plugin.define({
  stores: {
    selection: Store.global(Selection, {}),
  },
  i18n: {
    en: {
      week: "week",
      month: "month",
      premium: "Premium",
      chat: "Chat",
      remaining: "Subscription remaining",
      balance: "API key balance",
      resets: "Resets",
    },
    "zh-CN": {
      week: "周",
      month: "月",
      premium: "高级",
      chat: "聊天",
      remaining: "订阅剩余额度",
      balance: "API key 余额",
      resets: "重置时间",
    },
  },
  setup(ctx) {
    // Match gui-plugins/src/context/indicator.tsx in OpenCode 2.2.5; the SDK Button has no style prop.
    ctx.add(Style, `
      [data-component="button-v2"].quota-monitor-button {
        flex-shrink: 0;
        padding: 0 6px;
        color: var(--v2-text-text-faint);
      }
      .quota-monitor-button:active > span {
        color: var(--v2-text-text-muted);
      }
    `);
    ctx.add(Slot, {
      at: "session.header",
      order: 5,
      render(input) {
        const [snapshot, setSnapshot] = createSignal<QuotaSnapshot | null>(null);
        const [busy, setBusy] = createSignal(false);
        let refresh = () => {};
        createKeyed(
          () => {
            if (!input.active) return;
            const providerID = input.screen.composer.model()?.providerID;
            if (!providerID) return;
            return { client: input.session.server.client, location: input.session.location, providerID };
          },
          (target) => {
            const controller = new AbortController();
            refresh = async () => {
              if (busy()) return;
              setBusy(true);
              try {
                const value = (await target.client
                  .rpc(Quota)
                  .read(
                    { providerID: target.providerID },
                    { location: target.location, signal: controller.signal },
                  )) as QuotaSnapshot | null;
                if (!controller.signal.aborted) setSnapshot(value);
              } catch {
                if (!controller.signal.aborted) setSnapshot(null);
              } finally {
                if (!controller.signal.aborted) setBusy(false);
              }
            };
            void refresh();
            const timer = setInterval(() => void refresh(), 60000);
            onCleanup(() => {
              controller.abort();
              clearInterval(timer);
              setSnapshot(null);
              setBusy(false);
              refresh = () => {};
            });
          },
          { equals: (a, b) => a.client === b.client && a.location === b.location && a.providerID === b.providerID },
        );

        const label = (value: string) => (["week", "month", "premium", "chat"].includes(value) ? ctx.t(value) : value);
        const formatBalance = (value: Balance) =>
          new Intl.NumberFormat(ctx.locale.locale(), {
            style: "currency",
            currency: value.currency,
          }).format(value.remaining);
        const visibleWindow = createMemo(() => {
          const quota = snapshot();
          if (quota?.mode !== "subscription" || !quota.windows.length) return;
          return (
            quota.windows.find((item) => item.label === ctx.stores.selection.value.window) ??
            quota.windows.reduce((a, b) => (a.remaining <= b.remaining ? a : b))
          );
        });
        const visibleBalance = createMemo(() => {
          const quota = snapshot();
          if (quota?.mode !== "balance" || !quota.balances.length) return;
          return (
            quota.balances.find((item) => item.currency === ctx.stores.selection.value.currency) ??
            quota.balances[0]
          );
        });
        const display = () => {
          const quota = snapshot();
          if (!quota) return "";
          if (quota.mode === "balance") {
            const balance = visibleBalance();
            return balance ? formatBalance(balance) : "";
          }
          const item = visibleWindow();
          return item ? `${label(item.label)} ${Math.floor(item.remaining)}%` : "";
        };
        const title = () => {
          const quota = snapshot();
          if (!quota) return "";
          if (quota.mode === "balance") {
            const balance = visibleBalance();
            return balance ? `${ctx.t("balance")}\n${formatBalance(balance)}` : "";
          }
          const resetsAt = visibleWindow()?.resetsAt;
          return [
            ctx.t("remaining"),
            resetsAt ? `${ctx.t("resets")} ${new Date(resetsAt).toLocaleString(ctx.locale.locale())}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        };

        return (
          <Show when={display()}>
            <ctx.ui.Tooltip
              placement="bottom"
              value={<span style={{ "white-space": "pre-line" }}>{title()}</span>}
            >
              <ctx.ui.Button
                variant="ghost-muted"
                class="quota-monitor-button"
                onClick={() => {
                  const quota = snapshot();
                  if (quota?.mode === "balance") {
                    if (quota.balances.length > 1) {
                      const current = visibleBalance();
                      const index = quota.balances.findIndex((item) => item.currency === current?.currency);
                      const next = quota.balances[(index + 1) % quota.balances.length];
                      ctx.stores.selection.update((draft) => {
                        draft.currency = next.currency;
                      });
                    }
                    return;
                  }
                  if (quota?.mode !== "subscription" || !quota.windows.length) return;
                  const index = quota.windows.findIndex((item) => item.label === visibleWindow()?.label);
                  const next = quota.windows[(index + 1) % quota.windows.length];
                  ctx.stores.selection.update((draft) => {
                    draft.window = next.label;
                  });
                }}
              >
                <span
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    "white-space": "nowrap",
                  }}
                >
                  <Show
                    when={visibleWindow()}
                    keyed
                    fallback={
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        aria-hidden="true"
                      >
                        <rect x="2" y="4" width="12" height="10" rx="2" />
                        <path d="M2 6V4a2 2 0 0 1 2-2h7M14 8h-4v3h4" />
                      </svg>
                    }
                  >
                    {(item) => (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 14 14"
                        fill="none"
                        data-component="progress-circle"
                        data-appearance="compact"
                        aria-hidden="true"
                      >
                        <circle cx="7" cy="7" r="6.25" stroke-width="1.5" data-slot="progress-circle-background" />
                        <circle
                          cx="7"
                          cy="7"
                          r="6.25"
                          stroke-width="1.5"
                          data-slot="progress-circle-progress"
                          stroke-dasharray={`${2 * Math.PI * 6.25}`}
                          stroke-dashoffset={2 * Math.PI * 6.25 * (1 - item.remaining / 100)}
                        />
                      </svg>
                    )}
                  </Show>
                  {display()}
                </span>
              </ctx.ui.Button>
            </ctx.ui.Tooltip>
          </Show>
        );
      },
    });
  },
});
