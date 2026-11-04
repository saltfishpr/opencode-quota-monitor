# Quota Monitor

在 OpenCode Desktop 的 Performance Meter 右侧，以独立紧凑按钮显示当前选中 provider 的订阅剩余额度（例如 `5h 82%`）或 API key 余额（按币种格式化金额）。不显示 provider 名称。

- 当前接入 OpenAI legacy Codex OAuth、Anthropic OAuth、GitHub.com Copilot、OpenCode Go 的有限额度，以及 DeepSeek API key 余额。
- 不支持的 provider、登录方式不兼容、没有有效额度或查询失败时，隐藏整个组件。
- 每分钟查询一次。订阅模式点击按返回顺序循环切换额度窗口，悬停仅显示订阅剩余额度标题与当前窗口的重置时间（如有）；余额模式点击刷新，悬停显示余额标题与金额。
- 切换 provider 时清除旧数据和窗口选择；订阅模式默认显示剩余比例最低的一项，手动选择后自动刷新保留该窗口，进度环表示当前窗口的剩余额度；余额模式显示钱包图标和金额。
- 按钮与 OpenCode 2.2.5 内置 Context 用量组件对齐，源码路径与样式依据见[官方 UI 源码](#官方-ui-源码)。
- 只使用当前会话 server 的 OpenCode 登录，不读取其他应用的认证文件，不更换登录，也不向 GUI 传递 token。

**当前 OpenAI 新版 token-sharing 登录无法读取 Codex 额度，组件会隐藏。** OpenAI / Anthropic 普通 API key 和 GitHub Enterprise 暂不支持。Anthropic 需要 OpenCode 现有连接能解析 OAuth 凭据并具有 usage 接口权限。

## 官方 UI 源码

官方仓库为 [anomalyco/opencode](https://github.com/anomalyco/opencode)，Desktop 工程入口在 [`packages/desktop`](https://github.com/anomalyco/opencode/tree/dev/packages/desktop)，Context 用量组件位于独立的 `packages/gui-plugins` 包，共享 UI 组件位于 `packages/ui`。

以下路径已在 `dev` 的 commit [`ffe6fed58334d921f64a86a8d86128bff5a4b566`](https://github.com/anomalyco/opencode/commit/ffe6fed58334d921f64a86a8d86128bff5a4b566) 核验，链接固定到该 commit。这是源码参考快照，不是 OpenCode 2.2.5 的版本标签。

| 用途 | 官方源码 | 对齐依据 |
| --- | --- | --- |
| Context 用量按钮 | [`packages/gui-plugins/src/context/indicator.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/gui-plugins/src/context/indicator.tsx) | `SessionContextUsage`：`ghost-muted`、默认尺寸、左右 padding 6px、图文间距 8px、文字颜色 `--v2-text-text-faint`。 |
| Button 默认尺寸 | [`packages/ui/src/actions/button/button.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/actions/button/button.tsx) | 未指定 `size` 时使用 `normal`。 |
| Button 样式 | [`packages/ui/src/actions/button/button.css`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/actions/button/button.css) | `normal` 高度 28px，圆角 6px，字号 13px，行高 20px；`ghost-muted` 字重 440，并提供 hover/active 样式。 |
| 进度环结构 | [`packages/ui/src/feedback/progress-circle/progress-circle.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/feedback/progress-circle/progress-circle.tsx) | Context 使用 `compact` 外观、16px 尺寸；viewBox 为 14×14，描边宽度 1.5，半径 6.25。 |
| 进度环样式 | [`packages/ui/src/feedback/progress-circle/progress-circle.css`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/ui/src/feedback/progress-circle/progress-circle.css) | 从顶部开始绘制，使用官方背景色、前景色和进度过渡动画。 |
| 插件 UI 适配 | [`packages/app/src/runtime/plugin/ui.tsx`](https://github.com/anomalyco/opencode/blob/ffe6fed58334d921f64a86a8d86128bff5a4b566/packages/app/src/runtime/plugin/ui.tsx) | `ctx.ui.Button` 和 `ctx.ui.Tooltip` 映射到官方组件；Button 未透传 `style`，本插件通过 `Style` 和专用 class 覆盖 padding 与颜色。 |

## 构建

```sh
bun install
bun run typecheck
bun run build
```

全局 `~/.config/opencode/opencode.json` 的 `plugins` 加入本目录绝对路径即可加载。入口使用根目录 `index.ts` 和 `gui-experimental.cjs`；GUI Slot 为 `session.header`，排序值为 `5`。开发使用 `bun run dev`。

## Provider interface

`src/types.ts` 定义插件的核心数据结构和 provider interface，不依赖厂商接口或 RPC。`src/providers.ts` 中的所有实现都遵循这个 interface：

```ts
interface Provider {
  id: string
  integrationID?: string
  request(credential: Credential): UsageRequest | undefined
}
```

`request` 根据 OpenCode 解析的当前凭据选择接口和认证方式，不支持时返回 `undefined`。`integrationID` 用于凭据存放的 integration 与模型 provider ID 不一致的情况，例如 OpenCode Go 的模型 provider 是 `opencode-go`，凭据属于 `opencode`。同一个 provider 可以根据凭据支持两种计费模式；API key 认证不一定代表余额模式，例如 Copilot 的 key 仍查询订阅额度。

`UsageRequest` 包含 `url`、`headers` 和 `parse(body)`。Provider 负责把上游字段、百分比、金额和时间转换为插件统一的 `QuotaData`，RPC 和 GUI 不解析厂商响应。结果通过 `mode` 区分：

- `subscription`：返回 `{ mode: "subscription", windows: [{ label, remaining, resetsAt? }] }`，`remaining` 为 0–100 的剩余百分比。
- `balance`：使用 API key，返回 `{ mode: "balance", balance: { remaining, currency } }`，`remaining` 为有限数值金额，允许零和欠费负数；`currency` 为大写 ISO 4217 币种代码，例如 `USD`、`CNY`。

缺失或无效的数据由 `parse` 返回 `undefined`，不能当作 0。RPC 在成功解析后添加 `updatedAt`，不支持或查询失败时返回 `null`，GUI 隐藏组件。

增加 provider 时，实现该 interface 并加入 `src/providers.ts` 的 `providers` 数组即可，无需修改 RPC 或 GUI。这些 usage 接口可能随上游变更，需要适配。

DeepSeek 使用 API key 以 Bearer 认证调用 [`GET /user/balance`](https://api-docs.deepseek.com/zh-cn/api/get-user-balance)，显示 `balance_infos` 中第一条有效 CNY 或 USD 记录的 `total_balance`（包含赠金和充值余额），不合并不同币种。`is_available` 为 `false` 时仍显示有效余额，包括零和负数；缺失或无效金额不显示。

OpenCode Go（模型 provider `opencode-go`）使用 OpenCode Console 账号（integration `opencode`）的 OAuth access token，以 Bearer 认证调用 `https://opencode.ai/console/api/go/status`。根据 `access.meters` 中的 `fiveHour`、`week`、`month`，以 `1 - usedMicroCents / limitMicroCents` 计算剩余比例，并显示各窗口的 `resetsAt`。没有有效订阅额度或查询失败时隐藏组件，不把 Extra Usage 的充值余额当作订阅额度。该接口及字段来自当前 Console 前端，未列入[公开 API 文档](https://opencode.ai/v2/docs/console/api/)，可能随 Console 更新而变化。
