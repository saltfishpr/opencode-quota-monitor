# AGENTS.md

本文件记录 Quota Monitor 的开发命令、代码结构、接口约定和实现细节。`README.md` 面向使用者，只保留功能、支持范围、显示交互和安装配置；修改文档时按此分工放置内容。

## 构建与开发

```sh
bun install
bun run typecheck
bun run build
bun run dev
```

- `bun run dev` 监听变更并重新构建。
- 服务端入口为根目录 `index.ts`，它转发到 `src/index.ts`。
- GUI 源文件为 `src/gui.tsx`，构建产物为根目录 `gui-experimental.cjs`；不要直接编辑产物。
- GUI Slot 为 `session.header`，排序值为 `5`。

## 代码结构

- `src/index.ts`：注册 `quota-monitor` RPC；读取当前 integration connection 和 credential；请求 provider usage；解析后附加 `updatedAt`，失败返回 `null`。
- `src/rpc.ts`：RPC `read` 的输入/输出 schema。
- `src/types.ts`：核心数据类型和 `Provider` 接口。
- `src/providers.ts`：各 provider 实现和 `providers` 数组。
- `src/gui.tsx`：GUI Slot、按钮、Tooltip、60 秒刷新和窗口选择。
- `vite.config.ts`：通过 `@opencode/plugin/gui/vite` 构建 GUI，输出 `gui-experimental.cjs`。

## Provider 接口

[`src/types.ts`](src/types.ts) 定义核心数据结构和 `Provider` 接口，与厂商接口、RPC 解耦。[`src/providers.ts`](src/providers.ts) 中的所有 provider 均实现该接口：

```ts
interface Provider {
  id: string;
  integrationID?: string;
  request(credential: Credential.Value): UsageRequest | undefined;
}
```

- `id` 为模型 provider ID。
- `integrationID` 指定存放凭据的 integration；仅当该 integration 与模型 provider ID 不同时设置。例如，OpenCode Go 的模型 provider 为 `opencode-go`，凭据属于 `opencode`。
- `request` 根据 OpenCode 解析的当前凭据选择接口和认证方式，不支持该凭据时返回 `undefined`。

`UsageRequest` 包含 `url`、`headers` 和 `parse(body)`。Provider 将厂商响应中的百分比、金额和时间转换为统一的 `QuotaData`，RPC 和 GUI 只处理该结果。

## 数据约定

- `subscription`：返回 `{ mode: "subscription", windows: [{ label, remaining, resetsAt? }] }`，`remaining` 为 0–100 的剩余百分比。
- `balance`：返回 `{ mode: "balance", balance: { remaining, currency } }`，`remaining` 为有限数值金额，允许零和欠费负数；`currency` 为大写 ISO 4217 币种代码，例如 `USD`、`CNY`。

同一个 provider 可以根据凭据支持不同计费模式。认证方式与计费模式相互独立，例如 Copilot 的 key 查询订阅额度。

缺失或无效的数据由 `parse` 返回 `undefined`；该值表示无数据，与 0 区分。RPC 在成功解析后添加 `updatedAt`，不支持或查询失败时返回 `null`。`resetsAt` 和 `updatedAt` 均为毫秒级 Unix 时间戳。

新增 provider 时，实现 `Provider` 并加入 `src/providers.ts` 的 `providers` 数组，RPC 和 GUI 自动适配。上游 usage 接口变更时，更新对应实现。

## DeepSeek

DeepSeek 使用 API key，以 Bearer 认证调用 [`GET /user/balance`](https://api-docs.deepseek.com/zh-cn/api/get-user-balance)。

解析 `balance_infos`，按数组顺序取第一条 `currency` 为 `CNY` 或 `USD` 且 `total_balance` 可解析为有限数值的记录。`total_balance` 包含赠金和充值余额；不同币种不合并。`is_available` 不参与判断：即使为 `false`，有效余额仍会显示，包括零和负数。缺失或无效金额视为无数据。

## OpenCode Go

OpenCode Go 的模型 provider 为 `opencode-go`，凭据存放在 integration `opencode`。使用 OAuth access token（代码也接受 API key），以 Bearer 认证调用 `https://opencode.ai/console/api/go/status`。

解析 `access.meters` 中的 `fiveHour`、`week`、`month`，按 `1 - usedMicroCents / limitMicroCents` 计算剩余比例，并显示各窗口的 `resetsAt`。金额字段缺失或无效时跳过对应窗口；没有有效窗口时返回 `undefined`。

该接口及字段来自当前 Console 前端，未列入[公开 API 文档](https://opencode.ai/v2/docs/console/api/)，可能随 Console 更新而变化。

## 官方 UI 源码

按钮样式与 OpenCode 2.2.5 内置 Context 用量组件对齐。官方仓库为 [anomalyco/opencode](https://github.com/anomalyco/opencode)。Desktop 工程入口位于 [`packages/desktop`](https://github.com/anomalyco/opencode/tree/dev/packages/desktop)，Context 用量组件位于 `packages/gui-plugins`，共享 UI 组件位于 `packages/ui`。下表链接固定到已核验的 `dev` commit [`ffe6fed58334d921f64a86a8d86128bff5a4b566`](https://github.com/anomalyco/opencode/commit/ffe6fed58334d921f64a86a8d86128bff5a4b566)；该快照用于源码参考，不是 OpenCode 2.2.5 的版本标签。

| 用途 | 官方源码 | 对齐依据 |
| --- | --- | --- |
| Context 用量按钮 | [`packages/gui-plugins/src/context/indicator.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/gui-plugins/src/context/indicator.tsx) | `SessionContextUsage` 使用 `ghost-muted`、默认尺寸、左右 padding 6px、图文间距 8px，文字颜色为 `--v2-text-text-faint`。 |
| Button 默认尺寸 | [`packages/ui/src/actions/button/button.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/actions/button/button.tsx) | 未指定 `size` 时使用 `normal`。 |
| Button 样式 | [`packages/ui/src/actions/button/button.css`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/actions/button/button.css) | `normal` 高度 28px，圆角 6px，字号 13px，行高 20px；`ghost-muted` 字重 440，并提供 hover/active 样式。 |
| 进度环结构 | [`packages/ui/src/feedback/progress-circle/progress-circle.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/feedback/progress-circle/progress-circle.tsx) | Context 使用 `compact` 外观、16px 尺寸；viewBox 为 14×14，描边宽度 1.5，半径 6.25。 |
| 进度环样式 | [`packages/ui/src/feedback/progress-circle/progress-circle.css`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/feedback/progress-circle/progress-circle.css) | 从顶部开始绘制，使用官方背景色、前景色和进度过渡动画。 |
| 插件 UI 适配 | [`packages/app/src/runtime/plugin/ui.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/app/src/runtime/plugin/ui.tsx) | `ctx.ui.Button` 和 `ctx.ui.Tooltip` 映射到官方组件。Button 未透传 `style`，插件通过 `Style` 和专用 class 覆盖 padding 与颜色。 |
