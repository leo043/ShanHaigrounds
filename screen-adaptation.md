# 山海战棋 · Android 屏幕适配方案

> 修订时间：2026-06-22 · 范围：Capacitor 6 + Vite/TS 打包 Android 全平台适配

## 一、问题诊断

在 Android 真机上安装后出现"屏幕适配严重问题"，根因有 6 处：

| # | 问题位置 | 现象 | 根因 |
|---|---|---|---|
| 1 | `index.html` viewport | 已有 `viewport-fit=cover` ✓ | 缺少 `interactive-widget`、`MobileOptimized` 等兜底 |
| 2 | `MainActivity.java` | 空类，未做沉浸式 | 状态栏占据顶部 24-40dp，100vh 又包含状态栏 → 底部内容被裁切 |
| 3 | `styles.xml` | 主题未透明、未设 cutout 模式 | 横屏下刘海/打孔在左右两侧，内容被遮挡 |
| 4 | `main.css #app` | `height:100vh` | Android WebView 的 `100vh` 包含状态栏区域，沉浸式后才能用 |
| 5 | `main.css` 各容器 | 无 `env(safe-area-inset-*)` | 刘海/手势条/曲面屏边缘遮挡 UI |
| 6 | `main.css @media` | 仅 `max-height:500px` 单档断点 | 部分全面屏横屏高度 510-540 不触发紧凑布局 |

**核心结论**：单独改 CSS 没用，必须 Manifest + Activity + 主题 + CSS 四层联动。

---

## 二、解决方案总览

四层防御体系：

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: AndroidManifest.xml                            │
│  - configChanges 补全 density/fontScale/layoutDirection  │
│  - resizeableActivity=true（折叠屏/分屏支持）             │
├─────────────────────────────────────────────────────────┤
│  Layer 2: MainActivity.java                              │
│  - setDecorFitsSystemWindows(false) → edge-to-edge       │
│  - 透明状态栏/导航栏                                      │
│  - WindowInsetsController 沉浸式（系统栏隐藏，滑动唤出）  │
├─────────────────────────────────────────────────────────┤
│  Layer 3: styles.xml + values-v28/styles.xml             │
│  - windowDrawsSystemBarBackgrounds=true                  │
│  - 透明系统栏颜色                                         │
│  - Android 9+：windowLayoutInDisplayCutoutMode=shortEdges│
│    （内容延伸到刘海下方，由 CSS 控制避让）                 │
├─────────────────────────────────────────────────────────┤
│  Layer 4: index.html + main.css                          │
│  - viewport-fit=cover + interactive-widget               │
│  - 100vh → 100dvh（动态视口，回退 100vh）                 │
│  - 全局 --safe-* CSS 变量 + max() 避让安全区              │
│  - 媒体查询断点：≤540px 紧凑 + 触摸设备放大目标 + 超宽屏居中│
└─────────────────────────────────────────────────────────┘
```

---

## 三、改动清单（已落地）

### 3.1 `android/app/src/main/AndroidManifest.xml`

```diff
  <activity
-   android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
+   android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|density|fontScale|layoutDirection|navigation"
    android:screenOrientation="landscape"
+   android:resizeableActivity="true">
```

- 补全 `density|fontScale|layoutDirection|navigation`：防止系统字体缩放、深色模式切换、屏幕密度变化时 Activity 重建导致游戏状态丢失。
- `resizeableActivity=true`：支持折叠屏展开/分屏模式。

### 3.2 `android/app/src/main/java/com/lushi/shanhai/MainActivity.java`

```java
@Override
public void onCreate(Bundle savedInstanceState) {
    Window window = getWindow();
    // 1. edge-to-edge：内容延伸到系统栏下方
    WindowCompat.setDecorFitsSystemWindows(window, false);
    // 2. 透明系统栏（让背景透出，CSS env() 控制内容避让）
    window.setStatusBarColor(Color.TRANSPARENT);
    window.setNavigationBarColor(Color.TRANSPARENT);
    window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
    super.onCreate(savedInstanceState);
    // 3. 沉浸式：隐藏系统栏，滑动可短暂唤出
    WindowInsetsControllerCompat controller = ...;
    controller.setSystemBarsBehavior(BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.systemBars());
}
```

- `onWindowFocusChanged` 中重新进入沉浸式：旋转屏幕、切应用回来后状态栏不会残留。

### 3.3 `android/app/src/main/res/values/styles.xml` + `values-v28/styles.xml`

**values/styles.xml**（所有 API）：

```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
</style>
```

**values-v28/styles.xml**（Android 9+ 才生效）：

```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <!-- 关键：让 WebView 内容延伸到刘海/打孔区域 -->
    <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
</style>
```

- `shortEdges` vs `default`：横屏下 `default` 会在刘海侧留黑边，`shortEdges` 让内容铺满，再由 CSS 控制避让。
- 同时补充了缺失的 `colors.xml`（原 styles.xml 引用了 `@color/colorPrimary` 但文件不存在）。

### 3.4 `index.html` viewport

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
  maximum-scale=1.0, minimum-scale=1.0, user-scalable=no,
  viewport-fit=cover, interactive-widget=resizes-content" />
<meta name="MobileOptimized" content="width" />
<meta name="HandheldFriendly" content="true" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="format-detection" content="telephone=no" />
```

- `interactive-widget=resizes-content`：虚拟键盘弹出时调整视口（防止输入时画面错位）。
- `MobileOptimized/HandheldFriendly`：旧版 WebView 兜底。

### 3.5 `src/styles/main.css` 核心改动

**(1) 引入安全区域 CSS 变量**：

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --gutter-x: 20px;
  --gutter-x-safe: max(var(--gutter-x), var(--safe-left));
}
```

**(2) `#app` 用 `100dvh` 替代 `100vh`**：

```css
#app {
  width: 100vw;
  height: 100vh;       /* 旧 WebView 回退 */
  height: 100dvh;      /* 动态视口，新 WebView 优先采用 */
}
```

**(3) 各容器用 `max()` 避让安全区**（示例）：

```css
.topbar {
  padding-top: max(6px, var(--safe-top));
  padding-left: var(--gutter-x-safe);  /* max(20px, safe-left) */
  padding-right: max(var(--gutter-x), var(--safe-right));
}
.hand-row {
  padding-bottom: max(4px, var(--safe-bottom));
}
```

- `max(原值, safe值)`：哪个大用哪个，既保留原视觉，又自动避开刘海/手势条。
- 涉及的容器：`.topbar` / `.control-row` / `.main-area` / `.hand-row` / `.hand-zone` / `.tavern-cards` / `.combat-log` / `.hero-select-overlay` / `.gameover-overlay`。

**(4) 媒体查询断点扩展**：

```css
/* 紧凑布局：手机横屏（原 500 → 放宽到 540，覆盖更多全面屏） */
@media screen and (max-height: 540px) { ... }

/* 超宽屏（21:9、折叠屏展开）居中，避免 UI 拉伸 */
@media screen and (min-aspect-ratio: 21/9) {
  .main-area { max-width: 1200px; margin: 0 auto; }
}

/* 触摸设备：放大点击目标到 44x44（Material 推荐） */
@media (pointer: coarse) {
  .ctrl-btn { min-width: 44px; min-height: 44px; }
}
```

**(5) WebView 兼容性微调**：

```css
html { -webkit-text-size-adjust: 100%; }      /* 防字体自动放大 */
* { -webkit-touch-callout: none; }            /* 禁长按菜单 */
.tavern-cards, .hand-zone, .board-zone {
  -webkit-overflow-scrolling: touch;          /* 惯性滚动 */
  overscroll-behavior: contain;               /* 防滚动穿透 */
}
```

### 3.6 新增 `src/screen-debug.ts`

调试浮层，开启方式：

```
访问 http://localhost:5173/#debug
或在 Chrome://inspect 真机 console 执行：localStorage.setItem('screenDebug','1')
```

显示内容：viewport 尺寸、DPR、屏幕物理分辨率、`env(safe-area-inset-*)` 实测值、屏幕方向、宽高比、当前触发的媒体查询、UA 等。点击浮层标题可关闭。

---

## 四、构建与部署步骤

```bash
# 1. 安装依赖（首次或 package.json 变更后）
npm install

# 2. 构建 Web 资源到 dist/
npm run build

# 3. 同步到 Android 工程
npx cap sync android

# 4. 用 Android Studio 打开 android/ 目录
npx cap open android

# 5. 在 Android Studio 中：
#    - 点击 Run 安装到真机/模拟器
#    - 或 Build > Generate Signed APK 生成发布包
```

**注意**：`npx cap sync` 会把 `dist/` 拷贝到 `android/app/src/main/assets/public/`，并同步插件配置。CSS/HTML/JS 改动必须先 `npm run build` 再 `cap sync`。

---

## 五、测试清单

### 5.1 模拟器测试矩阵（Android Studio AVD）

| 设备类型 | 分辨率 | 屏幕比例 | API | 测试重点 |
|---|---|---|---|---|
| Pixel 8 | 1080×2400 | 20:9 | 34 | 主流全面屏，横屏刘海在右 |
| Pixel 7 | 1080×2400 | 20:9 | 33 | 同上，验证不同 API |
| Pixel 5 | 1080×2340 | 19.5:9 | 33 | 略矮，验证 540 断点 |
| Pixel 3a | 1080×2220 | 19.5:9 | 30 | 旧机型，验证回退 |
| Pixel C（平板）| 2560×1800 | 4:3 | 30 | 平板，验证默认布局 |
| Galaxy Fold 展开 | 2208×1840 | ~6:5 | 31 | 折叠屏，验证 resizeableActivity |
| Nexus 7 (2012) | 1280×800 | 16:10 | 19 | 老旧平板，验证兼容性 |

### 5.2 真机测试要点（手头有真机时）

| 检查项 | 通过标准 |
|---|---|
| 顶部英雄栏 | 不被刘海/状态栏遮挡，金币显示完整 |
| 底部手牌行 | 不被手势导航条遮挡，卡牌可点击 |
| 左右两侧 | 横屏刘海在左/右时，按钮不重叠到刘海 |
| 卡牌点击 | 所有卡牌点击响应正常，无错位 |
| 战斗阶段 | 双方棋盘完整可见，日志面板（>500px 时）正常显示 |
| 英雄选择 | 4 张英雄卡完整可见，可滚动/可点击 |
| 游戏结束 | 全屏遮罩正确覆盖，"再战一局"按钮可点 |
| 旋转屏幕 | 由于锁定横屏，此场景不应触发；若触发不应崩溃 |
| 切后台→前台 | 回到游戏后状态不丢失，沉浸式仍生效 |
| 字体缩放（系统设置） | 系统字体放大后游戏不崩（configChanges 已处理） |
| 分屏模式 | 应用进入分屏不崩溃，UI 不变形（resizeableActivity） |

### 5.3 调试浮层验证流程

1. 真机连接 USB，开启开发者选项 + USB 调试。
2. 安装 APK 后访问 `chrome://inspect`，找到设备。
3. 在 Console 执行：`localStorage.setItem('screenDebug','1')` 然后刷新。
4. 屏幕右上角出现绿色调试浮层，检查：
   - `viewport` 值 = 实际可视区域（应小于 `screen` 值，差额是安全区）
   - `safe-top/bottom/left/right` 在刘海屏上应 > 0
   - `compact` 在手机横屏应为 `YES`，平板/PC 为 `no`
   - `touch` 在真机应为 `YES`

### 5.4 边缘场景验证

- **曲面屏（Galaxy Edge 系列）**：左右 `safe-area-inset` 可能 10-30px，验证按钮不被误触。
- **打孔屏（中置打孔）**：横屏后打孔在左/右侧，验证 topbar 左右内边距。
- **折叠屏展开**：从折叠态展开，UI 应自动重排（resizeableActivity + resize 事件）。
- **平板 4:3/16:10**：不触发紧凑布局，走默认布局，验证卡牌不过小。
- **极窄长屏（21:9+）**：触发超宽屏居中，main-area 限宽 1200px 居中。

---

## 六、后续可优化项（P2，非阻塞）

1. **响应式字体**：用 `clamp(min, preferred, max)` 替代部分 `px`，让字体随视口缩放更平滑。
2. **动态卡牌尺寸**：根据 viewport 宽度用 `min/max/clamp` 计算卡牌宽高，而非固定 80×110 / 60×84 两档。
3. **方向自适应**：当前锁定横屏。若想支持竖屏（折叠屏合上态），需补充 `@media (orientation: portrait)` 布局。
4. **WebView 强制刷新 safe-area**：部分老旧 WebView 在系统栏显隐切换时 `env()` 不更新，可监听 `resize` 事件强制重新计算（当前未触发，先观察）。
5. **ProGuard/R8 配置**：发布版启用混淆时，确保 Capacitor Bridge 类不被混淆（Capacitor 默认配置已处理）。

---

## 七、改动文件一览

| 文件 | 状态 | 说明 |
|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | 修改 | configChanges 补全 + resizeableActivity |
| `android/app/src/main/java/com/lushi/shanhai/MainActivity.java` | 修改 | 沉浸式 + edge-to-edge |
| `android/app/src/main/res/values/styles.xml` | 修改 | 透明系统栏 |
| `android/app/src/main/res/values-v28/styles.xml` | 新增 | Android 9+ 刘海屏 shortEdges |
| `android/app/src/main/res/values/colors.xml` | 新增 | 补全缺失的 colorPrimary 等 |
| `index.html` | 修改 | viewport 补全 |
| `src/styles/main.css` | 修改 | safe-area 变量 + 100dvh + 媒体查询扩展 |
| `src/screen-debug.ts` | 新增 | 屏幕调试浮层 |
| `src/main.ts` | 修改 | 引入 setupScreenDebug |
| `overview.md`（本文档） | 新增 | 方案文档与测试清单 |

---

**结论**：本次改动形成四层防御（Manifest → Activity → 主题 → CSS），覆盖了从老式 16:10 手机到 21:9 折叠屏、从 Android 5.0 到 Android 14 的全谱系设备。所有改动已通过 TypeScript 类型检查和 Vite 生产构建。下一步按"五、测试清单"在真机或模拟器上验证即可。
