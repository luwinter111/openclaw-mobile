# 手机自动化能力设计(Android 无障碍优先 + 视觉兜底)

目标:让"小助手"能像 TalkBack/远程协助软件一样,先用无障碍服务读懂屏幕语义并执行点击/输入,读不懂时退化到截图 + 视觉模型理解。仅支持 Android(iOS 不开放同级别的第三方无障碍控制能力)。

## 0. 前置影响

- 现有项目是纯 Expo managed 工作流,能在 Expo Go 里跑。加入自定义原生模块(AccessibilityService、MediaProjection)后,**Expo Go 不再适用**,需要 `npx expo run:android` 或 EAS Dev Client 编译带原生代码的开发包。
- 该能力仅在 Android 生效;`modules/automation-bridge` 不提供 iOS 实现(或提供空实现直接抛 `UnavailableException`)。

## 1. 目录/文件结构

```
openclaw-mobile/
├── app.json                              # 新增 plugins 配置
├── plugins/
│   └── withAutomationAccessibility.js    # Expo Config Plugin:注入 Manifest/权限/xml
├── modules/
│   └── automation-bridge/                # 自定义 Expo Native Module
│       ├── expo-module.config.json
│       ├── index.ts                      # JS 对外 API(类型 + 导出函数)
│       └── android/
│           ├── build.gradle
│           └── src/main/
│               ├── AndroidManifest.xml
│               ├── res/xml/accessibility_service_config.xml
│               └── java/com/openclaw/automation/
│                   ├── AutomationBridgeModule.kt      # Expo Module 入口,暴露函数给 JS
│                   ├── AutomationAccessibilityService.kt  # 核心:无障碍服务
│                   ├── UiTreeSerializer.kt            # AccessibilityNodeInfo -> JSON
│                   ├── GestureDispatcher.kt           # dispatchGesture 封装(tap/swipe)
│                   ├── ScreenCaptureManager.kt         # MediaProjection + ImageReader
│                   └── ScreenCaptureConsentActivity.kt # 录屏授权用的透明 Activity
└── src/
    ├── api/
    │   ├── claude.ts                     # 已有:纯文本对话
    │   └── claudeVision.ts               # 新增:支持图片 content block 的调用(截图兜底用)
    ├── automation/                       # 新增:JS 侧编排层,不涉及原生代码
    │   ├── types.ts                      # UiNode / ScreenState / AutomationAction 类型
    │   ├── AutomationBridge.ts           # 包一层 modules/automation-bridge,做归一化/错误处理
    │   ├── perception/
    │   │   ├── buildScreenState.ts       # 决定用树还是截图,产出统一的 ScreenState
    │   │   └── isTreeUsable.ts           # 判断无障碍树是否够用的启发式
    │   ├── actions/
    │   │   └── executeAction.ts          # 把模型输出的动作 -> 调 AutomationBridge
    │   ├── promptTemplates.ts            # system prompt:动作 schema + 树的文本格式说明
    │   └── agentLoop.ts                  # 感知 -> 模型 -> 动作 的主循环
    └── screens/
        └── AutomationScreen.tsx          # 新增页面:权限状态、任务输入、执行日志、停止按钮
```

`src/navigation/RootNavigator.tsx` 和 `src/navigation/types.ts` 需要加一个 `Automation` 路由。

## 2. 原生层(Kotlin)职责划分

- **AutomationAccessibilityService**:继承 `AccessibilityService`。`onServiceConnected` 里设置 `serviceInfo`(`canRetrieveWindowContent = true`、`flagRetrieveInteractiveWindows`);持有当前 rootInActiveWindow 的引用,提供给 Module 层查询;负责真正执行 `performAction(ACTION_CLICK)` / `ACTION_SET_TEXT` / `ACTION_SCROLL_FORWARD` 等语义动作,以及调用 `dispatchGesture` 做坐标级点击/滑动。
- **UiTreeSerializer**:把 `AccessibilityNodeInfo` 树递归转成轻量 JSON(`text`/`contentDescription`/`className`/`viewIdResourceName`/`bounds`/`clickable`/`editable`/`children`),并给每个节点分配一个稳定的路径型 `id`(如 `"0.2.1"`)方便后续按 id 定位执行点击。
- **GestureDispatcher**:封装 `dispatchGesture`,提供 `tap(x, y)` / `swipe(x1,y1,x2,y2,durationMs)`,用于截图兜底路径(模型只给得出坐标,给不出 nodeId)。
- **ScreenCaptureManager**:封装 `MediaProjectionManager` + `VirtualDisplay` + `ImageReader`,`captureOnce()` 返回一帧 PNG(base64)。因为 Android 10+ 截屏需要前台服务通知,这里要在服务里启动一个 Foreground Service(`FOREGROUND_SERVICE_MEDIA_PROJECTION` type)。
- **ScreenCaptureConsentActivity**:透明 Activity,唤起系统录屏授权弹窗(`MediaProjectionManager.createScreenCaptureIntent()`),把结果(resultCode/data)传回 Module,用于换取 `MediaProjection` 实例。这个只在每次进程冷启动后需要弹一次。
- **AutomationBridgeModule**(Expo Module 入口):把上面这些包装成 JS 能调的 Promise/Event API。

## 3. Config Plugin(`plugins/withAutomationAccessibility.js`)

在 `expo prebuild` 阶段自动:
- 往 `AndroidManifest.xml` 注入:
  - `<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`
  - `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />`
  - `<service android:name="com.openclaw.automation.AutomationAccessibilityService" android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE" android:exported="false"> <intent-filter><action android:name="android.accessibilityservice.AccessibilityService"/></intent-filter> <meta-data android:name="android.accessibilityservice" android:resource="@xml/accessibility_service_config"/> </service>`
- 拷贝/合并 `accessibility_service_config.xml` 到 `android/app/src/main/res/xml/`。

`app.json` 里追加:
```json
"plugins": ["./plugins/withAutomationAccessibility"]
```

## 4. JS 对外 API(`modules/automation-bridge/index.ts`)

```ts
export interface UiNode {
  id: string;
  text?: string;
  contentDescription?: string;
  className?: string;
  viewId?: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  clickable: boolean;
  editable: boolean;
  children: UiNode[];
}

export function isAccessibilityServiceEnabled(): Promise<boolean>;
export function openAccessibilitySettings(): void;

export function getUiTree(): Promise<UiNode | null>;
export function performClick(nodeId: string): Promise<boolean>;
export function performSetText(nodeId: string, text: string): Promise<boolean>;
export function performScroll(nodeId: string, direction: 'forward' | 'backward'): Promise<boolean>;
export function performGesture(gesture:
  | { type: 'tap'; x: number; y: number }
  | { type: 'swipe'; x1: number; y1: number; x2: number; y2: number; durationMs?: number }
): Promise<boolean>;
export function performGlobalAction(action: 'back' | 'home' | 'recents'): Promise<boolean>;

export function hasScreenCapturePermission(): Promise<boolean>;
export function requestScreenCapturePermission(): Promise<boolean>;
export function captureScreenshot(): Promise<string>; // base64 PNG
```

## 5. JS 编排层

**`isTreeUsable.ts`**(决定要不要降级到截图):
```ts
function isTreeUsable(tree: UiNode): boolean {
  const nodes = flatten(tree);
  const interactive = nodes.filter(n => n.clickable || n.editable);
  const labeled = interactive.filter(n => n.text || n.contentDescription || n.viewId);
  return nodes.length > 3 && (interactive.length === 0 || labeled.length / interactive.length > 0.5);
}
```

**`buildScreenState.ts`**:
```ts
async function buildScreenState(): Promise<ScreenState> {
  const tree = await getUiTree();
  if (tree && isTreeUsable(tree)) {
    return { mode: 'tree', text: serializeTreeForPrompt(tree) };
  }
  const screenshotBase64 = await captureScreenshot();
  return { mode: 'vision', imageBase64: screenshotBase64 };
}
```

**`agentLoop.ts`**(主循环,伪代码):
```ts
async function runAutomationTask(instruction: string, onStep: (s: StepLog) => void) {
  const history: StepLog[] = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const screenState = await buildScreenState();
    const action = await decideNextAction(instruction, history, screenState); // -> claude.ts / claudeVision.ts
    if (action.type === 'done') break;
    const ok = await executeAction(action);
    const step = { screenState, action, ok };
    history.push(step);
    onStep(step);
  }
}
```

`decideNextAction` 根据 `screenState.mode` 选择走 `claude.ts`(纯文本树描述)还是 `claudeVision.ts`(带图片 block),system prompt 里定义统一的动作 JSON schema(click/type/scroll/tap/swipe/back/home/done),模型每轮只输出一个动作。

## 6. 新增页面 `AutomationScreen.tsx`

- 顶部:无障碍服务状态(已开启/未开启 + "去开启"按钮跳系统设置)、录屏权限状态(未授权 + "请求授权"按钮)。
- 中间:任务输入框(自然语言描述要做的操作)+ "执行"按钮。
- 下方:执行日志列表,每步展示:感知模式(树/视觉)、模型给出的动作、执行是否成功、耗时。
- "停止"按钮:中断 `agentLoop` 循环(用一个 `AbortController`/取消标志)。

## 7. 权限与合规现实

- `AccessibilityService` 必须用户手动去系统设置里开启,代码无法自动授权。
- `MediaProjection` 每次冷启动都要弹一次系统授权,且 Android 10+ 需要前台服务通知常驻(用户能看到"正在录屏"提示,无法隐藏,这是系统强制的隐私保护,设计上不要试图绕过)。
- 银行类/`FLAG_SECURE` 窗口:无障碍树可能拿不全,截图也会是黑屏,这种情况要让模型/日志明确报"当前屏幕不可读",而不是硬编造结果。

## 8. 分阶段实现建议

1. **Phase 1**:原生模块 + 无障碍树读取 + 语义动作执行(click/type/scroll),不做截图兜底,先跑通"树可用"的主流场景。
2. **Phase 2**:接入 `AutomationScreen.tsx` + `agentLoop.ts`,跑通"自然语言指令 -> 单步动作"的最小闭环。
3. **Phase 3**:加截图兜底(`ScreenCaptureManager` + `claudeVision.ts` + `dispatchGesture`),处理无障碍树不可用的场景。
4. **Phase 4**:多步任务的历史管理、失败重试、"停止/确认"这类安全阀(比如涉及支付/删除类操作前应该要求用户二次确认,不能让模型自主执行高风险操作)。
