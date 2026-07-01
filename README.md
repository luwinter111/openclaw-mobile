# OpenClaw Mobile

一个运行在手机上的个人 AI 助理客户端，灵感来自 [OpenClaw](https://github.com/openclaw/openclaw)
——一个本地优先的个人 AI 助理网关（多消息渠道、多 Agent 路由）。这个项目实现了它的核心理念的移动端精简版：

- **多 Agent**：为不同角色（工作助理、生活助理…）配置独立的名称、System Prompt、模型和"接入渠道"标签。
- **会话管理**：每个 Agent 可以开启多个会话，历史记录保存在设备本地（`AsyncStorage`）。
- **真实对话**：直接调用 Anthropic Messages API 与 Claude 对话。
- **设置页**：本机保存 API Key。

## 技术栈

- [Expo](https://expo.dev)（React Native + TypeScript），使用 Expo Go 即可在真机上直接扫码运行，无需安装 Android Studio / Xcode。
- `@react-navigation/native-stack` 做页面导航。
- `@react-native-async-storage/async-storage` 做本地持久化。
- 直接 `fetch` 调用 `https://api.anthropic.com/v1/messages`（未使用官方 Node SDK，因为它依赖 `node:fs` 等 Node 内置模块，无法被 Metro 打包进 React Native）。

## 目录结构

```
App.tsx                     # 应用入口，挂载导航
src/
  api/claude.ts              # 调用 Claude API
  navigation/                # 路由定义
  screens/
    ConversationsScreen.tsx  # 首页：会话列表
    ChatScreen.tsx           # 聊天界面
    AgentsScreen.tsx         # Agent 列表
    AgentEditScreen.tsx      # 新建/编辑 Agent
    SettingsScreen.tsx       # API Key 设置
  storage/                   # AsyncStorage 封装
  types/                     # 类型定义
  theme.ts                   # 配色
```

## 本地运行

```bash
cd openclaw-mobile
npm install
npm run start        # 启动 Expo，扫码用手机上的 Expo Go App 打开
```

首次打开 App 后，进入右上角「⚙️」设置页，填入你的 [Anthropic API Key](https://console.anthropic.com/)，
即可开始和默认 Agent 对话；也可以在「Agent」页新建/编辑多个具有不同人设的 Agent。

## 已知限制 / 后续可扩展方向

- API Key 直接存在设备本地并从客户端直连 Anthropic API，适合个人自用；如果要分发给别人使用，
  建议改为通过自建后端网关转发请求，避免把密钥打包进 App。
- 目前只有一个「直接对话」的真实渠道，Telegram / Webhook 渠道仅作为 Agent 的标签展示，
  尚未接入真实的消息平台（对应 OpenClaw 网关的多渠道路由能力）。
- 未实现语音唤醒、Live Canvas 等 OpenClaw 的高级特性。
