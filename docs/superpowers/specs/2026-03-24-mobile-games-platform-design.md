# 手机小游戏平台设计文档

**日期**：2026-03-24
**项目**：sao-lei（骚雷）
**目标平台**：iPhone 14（Safari PWA）
**技术栈**：纯原生 HTML / CSS / JavaScript，无构建工具，无框架依赖

---

## 1. 项目背景与目标

### 用户定位
面向蹲厕所无聊的人——需要快速上手、单手可玩、短时间内有完整体验的休闲游戏。

### 核心目标
- 在 iPhone 14 Safari 中流畅运行，支持"添加到主屏幕"作为 PWA 使用
- 完整离线可玩（Service Worker 缓存）
- SEO 友好，可被搜索引擎索引
- 多套视觉主题，用户自选
- 可扩展的游戏平台架构，后续轻松添加新游戏

### 首期游戏
扫雷（Minesweeper）— 完整实现后作为平台模板

### 规划中的游戏
蜘蛛纸牌、连连看等经典小游戏（本期不实现）

---

## 2. 项目结构

```
sao-lei/
├── index.html                  ← 主页 / 游戏启动器（SEO 落地页）
├── manifest.json               ← PWA Manifest
├── sw.js                       ← Service Worker（离线缓存）
├── icons/                      ← App 图标（各尺寸）
│   ├── icon-180.png            ← Apple Touch Icon
│   ├── icon-192.png
│   └── icon-512.png
├── shared/
│   ├── themes.css              ← 6 套主题 CSS 变量
│   ├── base.css                ← 全局基础样式、移动端重置
│   ├── components.css          ← 共享 UI 组件（工具栏、主题选择器等）
│   └── theme-switcher.js       ← 主题管理与 localStorage 持久化
└── games/
    └── minesweeper/
        ├── index.html          ← 扫雷游戏页（独立 SEO 页面）
        ├── style.css           ← 游戏专属样式
        └── game.js             ← 游戏逻辑
```

---

## 3. 扫雷游戏设计

### 3.1 难度配置

iPhone 14 可用宽度约 358px（390px 减去两侧 16px 内边距）：

| 难度 | 网格 | 地雷数 | 格子尺寸 | 布局验证 | 触控方案 |
|------|------|--------|---------|---------|---------|
| 入门 | 8×8 | 10 | 44px | 8×44=352px ✓ | 直接点击舒适 |
| 初级 | 16×16 | 40 | 22px | 16×22=352px ✓ | 放大镜辅助 |
| 中级 | 32×32 | 100 | 11px | 32×11=352px ✓ | 放大镜辅助 |
| 高级 | 64×64 | 400 | 5px | 64×5=320px ✓ | 放大镜辅助 |

> **格子尺寸取整规则**：格子尺寸 = `Math.floor(358 / 列数)`（向下取整），超出的余量（≤ 7px）由雷区容器居中对齐消化，不影响布局。
> 入门难度格子 44px 固定，不随屏幕宽度缩放。初级/中级/高级按公式动态计算。
> 16×16 及以上格子小于 Apple HIG 建议的 44pt，统一依赖放大镜机制解决精准点击问题。

### 3.2 游戏状态机

```
idle
 └─(首次点击)→ playing
                 ├─(揭开所有非雷格)→ won
                 └─(点到地雷)→ lost

won / lost
 └─(重置按钮)→ idle
```

### 3.3 底部工具栏（模式切换）

```
┌─────────────────────────────────┐
│           雷区网格               │
│                                 │
│   剩余雷数 🚩   😊   ⏱ 计时    │
├─────────────────────────────────┤
│   [翻开 ★]   [插旗]   [位置]   │
└─────────────────────────────────┘
```

三个模式按钮固定在底部，每个按钮最小触控区域 44×44pt（Apple HIG 标准）：

- **翻开**：点击格子 → 揭开（踩雷则游戏结束）
- **插旗**：点击格子 → 切换旗帜（□ ↔ 🚩）
- **位置**：点击/滑动 → 移动高亮光标（橙色边框），不触发任何操作；精准定位后切换模式执行

### 3.4 放大镜机制（精准触控关键交互）

**所有难度**（入门除外）均启用放大镜机制，解决手机小格子触控精度问题：

- 手指按下时，在手指上方浮现一个放大气泡（避免手指遮挡）
- 气泡显示周围 5×5 格、放大 3 倍的视图
- 气泡内高亮当前精准指向的格子（实时跟随手指滑动）
- **松手** = 对高亮格子执行当前模式操作
- **位置模式 + 按住滑动** = 连续移动光标，松手锁定目标格；切换模式后点击确认操作

**位置模式与页面滚动的手势区分：**
- 雷区容器设置 `touch-action: none`，完全接管触摸事件，阻止 Safari 默认滚动
- 位置模式下，手指移动距离 < 5px 视为"点击"（移动光标至单格），≥ 5px 视为"拖动"（连续滑动移动光标）
- 入门模式（8×8）格子足够大，禁用放大镜，直接点击即执行，手感接近桌面版

**光标可见性保证：**
- 光标锁定后若超出当前视口，自动滚动使目标格进入视野中央

### 3.5 交互细节

- **首次点击保护**：地雷在第一次点击后生成，保证第一次点击永不踩雷，且一阶邻格也不生成地雷
- **自动展开**：揭开空白格（周围 0 个雷）时，使用**迭代 BFS**（队列循环，非递归）展开相邻空白区域，避免 64×64 时递归栈溢出
- **数字颜色**：由各主题 CSS 变量定义，确保在该主题背景色上的可读性（见第 4.2 节）

### 3.6 数据持久化

- `localStorage` 保存当前局游戏进度：格子状态、已揭开集合、已插旗集合、计时器已用秒数、难度
- **恢复行为**：重新打开时自动恢复进度，计时器处于暂停状态，用户点击雷区后继续计时
- **难度不一致**：若存储进度的难度与用户切换后的难度不同，丢弃旧进度，开始新局
- **PWA/Safari localStorage 隔离说明**：Safari 普通标签页与 PWA（添加到主屏幕）的 localStorage 相互隔离，属于 iOS 系统限制，存档不可互通；在以下时机显示提示：用户通过普通 Safari 打开时，页面底部展示横幅"添加到主屏幕后游戏进度可永久保存"（通过 `navigator.standalone === false` 检测）
- 保存三个难度各自的最佳成绩（最短用时）

---

## 4. 主题系统

### 4.1 实现机制

通过 `<html data-theme="xxx">` 属性切换主题，CSS 变量自动生效，无需刷新页面。

```css
[data-theme="dark-minimal"] {
  --bg-primary: #0d0d0d;
  --cell-unrevealed: #1a1a1a;
  --cell-revealed: #111;
  --cell-border: #333;
  --accent: #f0f0f0;
  --text-primary: #f0f0f0;
  --text-muted: #888;
  /* 数字 1-8 颜色，确保在该主题背景上可读 */
  --num-1: #4fc3f7;
  --num-2: #81c784;
  --num-3: #e57373;
  --num-4: #7986cb;
  --num-5: #ff8a65;
  --num-6: #4dd0e1;
  --num-7: #f0f0f0;
  --num-8: #aaaaaa;
}
```

每套主题必须定义全部变量，包括 `--num-1` 到 `--num-8`，以保证各主题背景下的数字可读性。

### 4.2 六套主题

| 主题 ID | 名称 | 风格描述 |
|---------|------|---------|
| `dark-minimal` | 暗黑极简 | 纯黑底、细线边框、无色彩干扰，护眼 |
| `cartoon` | 卡通手绘 | 粗线条、错位阴影、手绘感圆角，轻松有趣 |
| `paper` | 纸张质感 | 米色宣纸底、横线纹理、书页温暖感 |
| `neon` | 霓虹赛博 | 黑底荧光描边、发光效果，深夜街机感 |
| `chinese` | 国风水墨 | 米白底、朱红配色、书法感标题，雅致 |
| `candy` | 果冻糖豆 | 白色凸起卡片、底部阴影、暖色渐变，治愈 |

### 4.3 主题选择器 UI

- 入口：游戏内右上角调色板图标（🎨）
- 形式：底部滑出抽屉，高度固定为屏幕高度的 40%（不遮挡游戏区域）
- 关闭手势：下滑或点击遮罩层关闭；抽屉使用独立的 `touchstart/touchmove/touchend` 事件监听，不依赖浏览器默认手势，不受雷区 `touch-action: none` 影响（抽屉层级高于雷区，z-index 覆盖，事件不穿透）
- 抽屉底部留出 `env(safe-area-inset-bottom)` 安全距离，防止被 Home 条遮挡
- 点击主题缩略图即时切换，选择后 500ms 自动关闭

---

## 5. PWA 与 Safari 支持

### 5.1 manifest.json 关键配置

```json
{
  "name": "骚雷小游戏",
  "short_name": "小游戏",
  "display": "standalone",
  "background_color": "#0d0d0d",
  "theme_color": "#0d0d0d",
  "start_url": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

> **注**：manifest 的 `orientation` 字段在 iOS Safari PWA 中不生效（已知系统限制），竖屏锁定通过 CSS 媒体查询处理（见第 7 节）。

### 5.2 Apple 专属 Meta 标签

```html
<!-- 兼容 iOS 旧版本；iOS 17.4+ 优先读取 manifest -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="小游戏">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
```

### 5.3 Service Worker 缓存策略

- 策略：**Cache First**（优先读缓存，无缓存才请求网络）
- 安装时预缓存全部已知资源列表
- **动态兜底**：使用 `fetch` 事件监听，对未在预缓存列表中的请求也尝试缓存（防止手动维护遗漏）
- 更新机制：版本号变更时清除旧缓存，激活新 SW

```js
// sw.js 动态缓存兜底示例
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // 网络请求失败且无缓存时：返回离线提示页（仅对导航请求）
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        // 其他资源（图片、CSS等）静默失败
      });
    })
  );
});
```

> **离线降级**：网络不可用且无缓存时，导航请求返回 `/offline.html`（一个简单的"请检查网络连接"页面，该页面本身在安装时预缓存）。其他资源（JS/CSS/图片）静默失败，不中断用户交互。

---

## 6. SEO 设计

### 6.1 主页（index.html）

- 真实文字内容：平台介绍、扫雷游戏说明、玩法简介（本期仅描述已上线游戏）
- `<title>`：骚雷 - 手机扫雷游戏 | 离线可玩 PWA
- `<meta description>`：在手机上玩经典扫雷，支持离线，可添加到主屏幕，六套主题随心切换
- Open Graph 标签：分享到微信/微博时显示预览图和标题
- 游戏列表只展示已上线游戏，"即将推出"标注规划中的游戏（不写入 title/description）

### 6.2 游戏页（games/minesweeper/index.html）

- 独立 `<title>` 和 `<meta description>`
- 语义化 HTML：`<main>`、`<header>`、`<nav>`、`<section>`
- `<link rel="canonical">` 防止重复索引

---

## 7. 移动端适配

- **目标设备**：iPhone 14（390×844pt，@3x）
- **视口**：`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- **顶部安全区域**：使用 `black-translucent` 状态栏时，顶部内容须加 `padding-top: env(safe-area-inset-top)` 防止被状态栏遮挡
- **底部安全区域**：工具栏底部加 `padding-bottom: env(safe-area-inset-bottom)` 防止被 Home 条遮挡
- **触摸优化**：
  - 底部工具栏按钮最小 44×44pt
  - `touch-action: manipulation` 禁用双击缩放
  - 雷区容器设置 `touch-action: none` 接管触摸事件
  - 禁用长按选中文字（`user-select: none`）
- **横屏处理**：iOS Safari PWA 不支持 manifest orientation 锁定，改用 CSS 媒体查询：

```css
@media (orientation: landscape) {
  body::before {
    content: '请旋转至竖屏模式';
    /* 全屏遮罩提示 */
  }
}
```

---

## 8. 扩展性设计

新游戏加入步骤：
1. 在 `games/` 下新建目录，包含 `index.html`、`style.css`、`game.js`
2. 引入 `shared/` 的 CSS 和主题变量，自动获得所有主题支持
3. 在 `index.html` 主页添加游戏入口卡片
4. `sw.js` 动态缓存兜底会自动缓存新文件（无需手动维护列表，但建议同步更新预缓存列表以确保首次离线可用）

共享组件（`shared/components.css`）提供：底部工具栏、主题选择器、顶部信息栏、通用按钮样式。实现时保持简单，等第二个游戏上线时再根据实际需求抽象共用部分。

---

## 9. 不在范围内（本期）

- 蜘蛛纸牌、连连看等其他游戏实现
- 多人联机 / 排行榜
- 自定义网格大小（超出四档难度）
- 音效与震动反馈
- 动画过渡效果
