import { Plugin } from "@opencode/plugin";
import { providers } from "./providers";
import { Quota } from "./rpc";
import type { QuotaSnapshot } from "./types";

export default Plugin.define({
  id: "quota-monitor",
  async setup(ctx) {
    const registration = await ctx.rpc.register(Quota, {
      async read(input, { signal }): Promise<QuotaSnapshot | null> {
        const { providerID } = input as { providerID: string };
        const provider = providers.find((item) => item.id === providerID);
        if (!provider) return null;
        try {
          const connection = await ctx.integration.connection.active(provider.integrationID ?? providerID);
          const credential = connection && (await ctx.integration.connection.resolve(connection));
          const request = credential && provider.request(credential);
          if (!request) return null;
          const response = await fetch(request.url, {
            headers: { Accept: "application/json", "User-Agent": "opencode-quota-monitor/0.1.0", ...request.headers },
            redirect: "error",
            signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          });
          if (!response.ok) return null;
          const quota = request.parse(await response.json());
          if (!quota || (quota.mode === "balance" && credential.type !== "key")) return null;
          return { ...quota, updatedAt: Date.now() };
        } catch {
          return null;
        }
      },
    });
    return () => registration.dispose();
  },
});
