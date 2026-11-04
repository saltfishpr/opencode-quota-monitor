import { Rpc } from "@opencode/plugin/rpc";

export const Quota = Rpc.define({
  id: "quota-monitor",
  events: {},
  methods: {
    read: {
      input: {
        type: "object",
        properties: {
          providerID: { type: "string" },
        },
        required: ["providerID"],
        additionalProperties: false,
      },
      output: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            properties: {
              mode: { const: "subscription" },
              updatedAt: { type: "number" },
              windows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    remaining: { type: "number", minimum: 0, maximum: 100 },
                    resetsAt: { type: "number" },
                  },
                  required: ["label", "remaining"],
                  additionalProperties: false,
                },
              },
            },
            required: ["mode", "windows", "updatedAt"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              mode: { const: "balance" },
              updatedAt: { type: "number" },
              balances: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    remaining: { type: "number" },
                    currency: { type: "string" },
                  },
                  required: ["remaining", "currency"],
                  additionalProperties: false,
                },
              },
            },
            required: ["mode", "balances", "updatedAt"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
});
