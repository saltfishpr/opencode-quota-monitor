# Quota Monitor

Quota Monitor 是 OpenCode Desktop 插件，在 Performance Meter 右侧显示当前选中 provider 的订阅剩余额度或余额。订阅额度显示为进度环和剩余比例（如 `5h 82%`），余额显示为钱包图标和按币种格式化的金额。

## 支持的 Provider

| Provider | 登录方式 | 显示 |
| --- | --- | --- |
| OpenAI | 旧版 Codex OAuth | 订阅剩余额度 |
| Anthropic | OAuth（现有连接需有 usage 接口权限） | 订阅剩余额度 |
| GitHub Copilot | OpenCode 现有连接 | 订阅剩余额度 |
| OpenCode Go | OpenCode Console 账号 OAuth | 订阅额度（不含 Extra Usage） |
| DeepSeek | API key | 账户余额（CNY/USD） |

## 安装

构建需要 [Bun](https://bun.sh)。在项目根目录执行：

```sh
bun install
bun run build
```

将本目录的绝对路径加入 `~/.config/opencode/opencode.json` 的 `plugins` 数组：

```json
{
  "plugins": ["/absolute/path/to/opencode-quota-monitor"]
}
```

## 使用

| 模式 | 点击 | 悬停 |
| --- | --- | --- |
| 订阅 | 循环切换额度窗口 | 剩余额度与重置时间 |
| 余额 | 多币种时循环切换 | 当前币种金额 |

插件每分钟自动刷新。订阅模式默认显示剩余比例最低的窗口，手动选择后保持；余额模式默认显示第一种币种，多币种时点击循环切换，切换后保持。

## 说明

- **显示条件**：provider 不受支持、登录方式不兼容、无有效额度或查询失败时，组件隐藏。
- **登录限制**：OpenAI 新版 token-sharing 登录无法读取额度；OpenAI/Anthropic 普通 API key 和 GitHub Enterprise 暂不支持。
- **DeepSeek**：余额包含赠金和充值余额，余额为零或负数时也会显示；同时有 CNY 和 USD 时点击按钮循环切换币种，不合并金额。
- **隐私**：插件只使用当前 OpenCode 会话的登录凭据，不读取其他应用的认证文件，不改变登录状态；认证信息不会传给界面。
