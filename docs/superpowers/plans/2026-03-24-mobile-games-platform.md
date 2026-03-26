# 手机小游戏平台实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个支持 PWA 离线安装的手机扫雷游戏平台，包含 6 套主题、放大镜触控交互和 SEO 支持。

**Architecture:** 纯原生 HTML/CSS/JS，无构建工具。游戏逻辑（game.js）与 UI（index.html + style.css）分离，共享 CSS 变量主题系统（themes.css）跨所有游戏生效，Service Worker 提供完整离线能力。

**Tech Stack:** HTML5、CSS Custom Properties、Vanilla JS ES6+、Service Worker、Web App Manifest

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `index.html` | 游戏启动器 + SEO 落地页 |
| `offline.html` | 离线降级页面 |
| `manifest.json` | PWA 配置 |
| `sw.js` | Service Worker（Cache First + 动态兜底）|
| `icons/generate.html` | 浏览器生成 PNG 图标用的工具页 |
| `shared/base.css` | 全局重置、安全区域、排版基础 |
| `shared/themes.css` | 6 套主题 CSS 变量 |
| `shared/components.css` | 工具栏、主题选择器 UI 组件 |
| `shared/theme-switcher.js` | 主题加载/保存/切换逻辑 |
| `games/minesweeper/index.html` | 扫雷游戏页（SEO 语义化）|
| `games/minesweeper/style.css` | 扫雷专属样式 + 放大镜 |
| `games/minesweeper/game.js` | 游戏逻辑（状态机、BFS、触控）|
| `tests/minesweeper/test.html` | 游戏逻辑浏览器测试页 |

---

## Chunk 1: PWA Shell & 项目骨架

### Task 1: 初始化项目目录结构

**Files:**
- Create: `index.html`
- Create: `offline.html`
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/generate.html`
- Create: `shared/.gitkeep`
- Create: `games/minesweeper/.gitkeep`
- Create: `tests/minesweeper/.gitkeep`

- [ ] **Step 1: 创建目录结构**

```bash
cd /Users/chengsen/Projects/sao-lei
mkdir -p icons shared games/minesweeper tests/minesweeper
```

- [ ] **Step 2: 创建 manifest.json**

```json
{
  "name": "骚雷小游戏",
  "short_name": "小游戏",
  "description": "在手机上玩经典扫雷，支持离线，六套主题随心切换",
  "display": "standalone",
  "background_color": "#0d0d0d",
  "theme_color": "#0d0d0d",
  "start_url": "/",
  "scope": "/",
  "lang": "zh-CN",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: 创建 offline.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>离线 - 骚雷小游戏</title>
  <style>
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0d0d0d;
      color: #f0f0f0;
      font-family: -apple-system, sans-serif;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      box-sizing: border-box;
    }
    h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
    p { color: #888; font-size: 0.9rem; margin: 0 0 1.5rem; text-align: center; }
    a { color: #4fc3f7; text-decoration: none; }
  </style>
</head>
<body>
  <h1>📡 网络连接已断开</h1>
  <p>请检查网络后重试<br>已下载的游戏仍可正常游玩</p>
  <a href="/">返回主页</a>
</body>
</html>
```

- [ ] **Step 4: 创建 sw.js**

```js
const CACHE_NAME = 'sao-lei-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/shared/base.css',
  '/shared/themes.css',
  '/shared/components.css',
  '/shared/theme-switcher.js',
  '/games/minesweeper/',
  '/games/minesweeper/index.html',
  '/games/minesweeper/style.css',
  '/games/minesweeper/game.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});
```

- [ ] **Step 5: 用 Python 脚本生成占位图标**

```bash
python3 << 'EOF'
import struct, zlib, math, os

def make_png(size, bg=(13,13,13), dot=(26,26,46)):
    """生成纯色 PNG，中心绘制简单炸弹图形"""
    pixels = []
    cx, cy, r = size//2, size//2, size*3//8
    for y in range(size):
        row = []
        for x in range(size):
            dist = math.sqrt((x-cx)**2 + (y-cy)**2)
            row.extend(dot if dist < r else bg)
        pixels.append(bytes([0]) + bytes(row))
    
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    raw = b''.join(zlib.compress(p) for p in pixels)
    # 简化：直接压缩所有行
    raw_data = b''.join(pixels)
    compressed = zlib.compress(raw_data)
    
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

os.makedirs('icons', exist_ok=True)
for size in [180, 192, 512]:
    with open(f'icons/icon-{size}.png', 'wb') as f:
        f.write(make_png(size))
    print(f'Generated icons/icon-{size}.png')
EOF
```

- [ ] **Step 6: 验证图标文件生成**

```bash
ls -la icons/
```

预期：看到 `icon-180.png icon-192.png icon-512.png`，每个文件大小 > 100 bytes。

注：这是功能性占位图标，用于 PWA 安装和测试。正式上线前需替换为设计师制作的正式图标。

- [ ] **Step 7: 创建最小可用 index.html（测试 SW 注册）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>骚雷 - 手机扫雷游戏 | 离线可玩 PWA</title>
  <meta name="description" content="在手机上玩经典扫雷，支持离线，可添加到主屏幕，六套主题随心切换">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="小游戏">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
  <link rel="manifest" href="/manifest.json">
  <!-- Open Graph -->
  <meta property="og:title" content="骚雷 - 手机扫雷游戏">
  <meta property="og:description" content="在手机上玩经典扫雷，支持离线，六套主题">
  <meta property="og:type" content="website">
  <meta property="og:image" content="/icons/icon-512.png">
  <link rel="canonical" href="/">
</head>
<body>
  <p>骨架搭建中...</p>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch(e => console.error('SW failed:', e));
    }
  </script>
</body>
</html>
```

- [ ] **Step 8: 在本地验证 SW 注册**

用 `python3 -m http.server 8080` 在项目根目录启动本地服务器，用 Safari（或 Chrome）打开 `http://localhost:8080`，打开开发者工具 → Application → Service Workers，确认 SW 已注册且状态为 activated。

- [ ] **Step 9: 提交**

```bash
git init
git add .
git commit -m "feat: init PWA shell with SW, manifest, offline fallback"
```

---

## Chunk 2: 共享 CSS 基础（base + themes + components）

### Task 2: shared/base.css — 全局重置与安全区域

**Files:**
- Create: `shared/base.css`

- [ ] **Step 1: 创建 shared/base.css**

```css
/* shared/base.css */
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
}

html, body {
  margin: 0;
  padding: 0;
  min-height: 100dvh;
  overflow: hidden;
  font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  /* 全局安全区域内边距（black-translucent 状态栏需要） */
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  transition: background 0.2s, color 0.2s;
}

/* 禁用双击缩放 */
button, a, [role="button"] {
  touch-action: manipulation;
  cursor: pointer;
}

/* 横屏锁定提示遮罩 */
@media (orientation: landscape) {
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background: #0d0d0d;
    z-index: 9999;
  }
  body::before {
    content: '请旋转至竖屏模式 📱';
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #f0f0f0;
    font-size: 1.1rem;
    z-index: 10000;
    white-space: nowrap;
  }
}
```

- [ ] **Step 2: 在浏览器验证安全区域**

用 Safari 开发者工具模拟 iPhone 14，打开 index.html（先引入 base.css），确认顶部有状态栏安全距离（约 47px），底部有 Home 条安全距离（约 34px）。

---

### Task 3: shared/themes.css — 6 套主题变量

**Files:**
- Create: `shared/themes.css`

- [ ] **Step 1: 创建 shared/themes.css**

```css
/* shared/themes.css
   每套主题定义完整的 CSS 变量集。
   切换方式：<html data-theme="xxx"> */

/* ===== 暗黑极简（默认）===== */
:root,
[data-theme="dark-minimal"] {
  --bg-primary: #0d0d0d;
  --bg-secondary: #1a1a1a;
  --cell-unrevealed: #1e1e1e;
  --cell-unrevealed-border-light: #333;
  --cell-unrevealed-border-dark: #000;
  --cell-revealed: #111;
  --cell-revealed-border: #222;
  --cell-mine: #3a0000;
  --accent: #f0f0f0;
  --accent-dim: #888;
  --text-primary: #f0f0f0;
  --text-muted: #555;
  --toolbar-bg: #111;
  --toolbar-border: #2a2a2a;
  --btn-active-bg: #2a2a2a;
  --btn-active-color: #f0f0f0;
  --info-bar-bg: #0a0a0a;
  --counter-bg: #000;
  --counter-color: #ff4444;
  --magnifier-border: rgba(255,255,255,0.3);
  --cursor-color: #ff8c00;
  --num-1: #4fc3f7; --num-2: #81c784; --num-3: #e57373;
  --num-4: #7986cb; --num-5: #ff8a65; --num-6: #4dd0e1;
  --num-7: #f0f0f0; --num-8: #888;
}

/* ===== 卡通手绘 ===== */
[data-theme="cartoon"] {
  --bg-primary: #fffbf0;
  --bg-secondary: #fff8e0;
  --cell-unrevealed: #fff;
  --cell-unrevealed-border-light: #333;
  --cell-unrevealed-border-dark: #333;
  --cell-revealed: #f0ece0;
  --cell-revealed-border: #ccc;
  --cell-mine: #ffe0e0;
  --accent: #333;
  --accent-dim: #666;
  --text-primary: #333;
  --text-muted: #999;
  --toolbar-bg: #fff8e0;
  --toolbar-border: #333;
  --btn-active-bg: #333;
  --btn-active-color: #fff;
  --info-bar-bg: #fff8e0;
  --counter-bg: #1a1a1a;
  --counter-color: #ff6b6b;
  --magnifier-border: #333;
  --cursor-color: #ff6b00;
  --num-1: #1565c0; --num-2: #2e7d32; --num-3: #c62828;
  --num-4: #283593; --num-5: #bf360c; --num-6: #00695c;
  --num-7: #212121; --num-8: #616161;
}

/* ===== 纸张质感 ===== */
[data-theme="paper"] {
  --bg-primary: #e8e0d5;
  --bg-secondary: #f5ede0;
  --cell-unrevealed: #f5ede0;
  --cell-unrevealed-border-light: #d4b896;
  --cell-unrevealed-border-dark: #a08060;
  --cell-revealed: #ddd5c5;
  --cell-revealed-border: #c4a882;
  --cell-mine: #f0d0c0;
  --accent: #5c4a3a;
  --accent-dim: #8b7355;
  --text-primary: #5c4a3a;
  --text-muted: #a08060;
  --toolbar-bg: #ddd5c5;
  --toolbar-border: #c4a882;
  --btn-active-bg: #5c4a3a;
  --btn-active-color: #f5ede0;
  --info-bar-bg: #d4c9b8;
  --counter-bg: #2a1a0a;
  --counter-color: #cc6644;
  --magnifier-border: rgba(92,74,58,0.4);
  --cursor-color: #cc4400;
  --num-1: #1a5276; --num-2: #1e8449; --num-3: #922b21;
  --num-4: #154360; --num-5: #7b241c; --num-6: #117864;
  --num-7: #212121; --num-8: #7f8c8d;
}

/* ===== 霓虹赛博 ===== */
[data-theme="neon"] {
  --bg-primary: #050510;
  --bg-secondary: #0a0a20;
  --cell-unrevealed: #0d0d2b;
  --cell-unrevealed-border-light: #00ffff44;
  --cell-unrevealed-border-dark: #00000088;
  --cell-revealed: #060620;
  --cell-revealed-border: #00ffff22;
  --cell-mine: #2b000d;
  --accent: #00ffff;
  --accent-dim: #00888888;
  --text-primary: #00ffff;
  --text-muted: #006666;
  --toolbar-bg: #080820;
  --toolbar-border: #ff00ff44;
  --btn-active-bg: #ff00ff22;
  --btn-active-color: #ff00ff;
  --info-bar-bg: #040418;
  --counter-bg: #000;
  --counter-color: #ff00ff;
  --magnifier-border: rgba(0,255,255,0.5);
  --cursor-color: #ffff00;
  --num-1: #00bfff; --num-2: #00ff88; --num-3: #ff4466;
  --num-4: #aa44ff; --num-5: #ff8800; --num-6: #00ffee;
  --num-7: #ffffff; --num-8: #8888aa;
}

/* ===== 国风水墨 ===== */
[data-theme="chinese"] {
  --bg-primary: #f9f5ef;
  --bg-secondary: #f0e8dc;
  --cell-unrevealed: #f5f0e8;
  --cell-unrevealed-border-light: #d4b896;
  --cell-unrevealed-border-dark: #c4a882;
  --cell-revealed: #e8e0d0;
  --cell-revealed-border: #c9a87c;
  --cell-mine: #ffe8e0;
  --accent: #8b3a3a;
  --accent-dim: #c4a882;
  --text-primary: #3a2a1a;
  --text-muted: #c9a87c;
  --toolbar-bg: #ede4d4;
  --toolbar-border: #c9a87c;
  --btn-active-bg: #8b3a3a;
  --btn-active-color: #f9f5ef;
  --info-bar-bg: #e8e0d0;
  --counter-bg: #1a0a0a;
  --counter-color: #cc3333;
  --magnifier-border: rgba(139,58,58,0.4);
  --cursor-color: #cc3333;
  --num-1: #1a4a8b; --num-2: #1a6e3a; --num-3: #8b1a1a;
  --num-4: #0a2a6e; --num-5: #6e1a0a; --num-6: #0a6e6e;
  --num-7: #1a0a0a; --num-8: #6e6458;
}

/* ===== 果冻糖豆 ===== */
[data-theme="candy"] {
  --bg-primary: #ffecd2;
  --bg-secondary: #ffd8b0;
  --cell-unrevealed: #ffffff;
  --cell-unrevealed-border-light: #fff;
  --cell-unrevealed-border-dark: #e88a6a;
  --cell-revealed: #ffeedd;
  --cell-revealed-border: #f0c0a0;
  --cell-mine: #ffe0f0;
  --accent: #e88a6a;
  --accent-dim: #f0b090;
  --text-primary: #5a3020;
  --text-muted: #c08060;
  --toolbar-bg: #ffd8b0;
  --toolbar-border: #e88a6a;
  --btn-active-bg: #e88a6a;
  --btn-active-color: #fff;
  --info-bar-bg: #ffc890;
  --counter-bg: #3a1808;
  --counter-color: #ff6644;
  --magnifier-border: rgba(232,138,106,0.5);
  --cursor-color: #ff4400;
  --num-1: #2196f3; --num-2: #4caf50; --num-3: #f44336;
  --num-4: #3f51b5; --num-5: #ff5722; --num-6: #009688;
  --num-7: #212121; --num-8: #9e9e9e;
}
```

- [ ] **Step 2: 验证主题变量**

在浏览器控制台执行：
```js
document.documentElement.setAttribute('data-theme', 'neon');
// 页面背景应变为深蓝黑色
document.documentElement.setAttribute('data-theme', 'candy');
// 页面背景应变为温暖橙色渐变
document.documentElement.removeAttribute('data-theme');
// 恢复默认（暗黑极简）
```

---

### Task 4: shared/components.css — 共享 UI 组件

**Files:**
- Create: `shared/components.css`

- [ ] **Step 1: 创建 shared/components.css**

```css
/* shared/components.css
   提供底部工具栏、信息栏、主题选择器等通用组件 */

/* ===== 游戏容器布局 ===== */
.game-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: hidden;
}

/* ===== 顶部信息栏（剩余雷数、笑脸、计时）===== */
.info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--info-bar-bg);
  border-bottom: 1px solid var(--toolbar-border);
  flex-shrink: 0;
  height: 52px;
}

.info-counter {
  background: var(--counter-bg);
  color: var(--counter-color);
  font-family: 'Courier New', monospace;
  font-size: 1.4rem;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  min-width: 60px;
  text-align: center;
  letter-spacing: 2px;
}

.info-reset-btn {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  font-size: 1.4rem;
  line-height: 1;
  border-radius: 8px;
  transition: transform 0.1s;
}
.info-reset-btn:active { transform: scale(0.9); }

/* ===== 底部工具栏（三模式按钮）===== */
.toolbar {
  display: flex;
  background: var(--toolbar-bg);
  border-top: 1px solid var(--toolbar-border);
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  gap: 8px;
  flex-shrink: 0;
}

.toolbar-btn {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--toolbar-border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.toolbar-btn.active {
  background: var(--btn-active-bg);
  color: var(--btn-active-color);
  border-color: var(--btn-active-color);
}

/* ===== 主题选择器抽屉 ===== */
.theme-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  align-items: flex-end;
}
.theme-overlay.open { display: flex; }

.theme-drawer {
  width: 100%;
  max-height: 40vh;
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  overflow-y: auto;
  /* 独立触摸监听，不影响雷区 */
}

.theme-drawer h3 {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
  letter-spacing: 0.05em;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.theme-item {
  border: 2px solid transparent;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}
.theme-item:active { transform: scale(0.95); }
.theme-item.selected { border-color: var(--accent); }

.theme-preview {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}
.theme-item span {
  display: block;
  text-align: center;
  font-size: 0.72rem;
  padding: 4px;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

/* ===== 调色板按钮（右上角）===== */
.theme-toggle-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  font-size: 1.2rem;
  border-radius: 8px;
  color: var(--text-muted);
}

/* ===== PWA 安装提示横幅 ===== */
.pwa-banner {
  display: none;
  position: fixed;
  bottom: calc(64px + env(safe-area-inset-bottom));
  left: 16px;
  right: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--toolbar-border);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.8rem;
  color: var(--text-muted);
  z-index: 50;
  align-items: center;
  gap: 10px;
}
.pwa-banner.show { display: flex; }
.pwa-banner button {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 1rem;
  padding: 0 4px;
}
```

- [ ] **Step 2: 验证组件样式**

在 index.html 引入三个 CSS 文件，打开浏览器，用 Safari 开发者工具切换到 iPhone 14 尺寸，确认布局无超出、安全区域正确。

- [ ] **Step 3: 提交**

```bash
git add shared/
git commit -m "feat: add shared CSS foundation (base, themes, components)"
```

---

## Chunk 3: 主题切换器

### Task 5: shared/theme-switcher.js

**Files:**
- Create: `shared/theme-switcher.js`

- [ ] **Step 1: 创建 shared/theme-switcher.js**

```js
// shared/theme-switcher.js
// 负责主题的加载、保存、切换，以及主题选择器抽屉的交互

const THEMES = [
  { id: 'dark-minimal', name: '暗黑极简', bg: '#0d0d0d', preview: '⬛' },
  { id: 'cartoon',      name: '卡通手绘', bg: '#fffbf0', preview: '🖍️' },
  { id: 'paper',        name: '纸张质感', bg: '#e8e0d5', preview: '📄' },
  { id: 'neon',         name: '霓虹赛博', bg: '#050510', preview: '💜' },
  { id: 'chinese',      name: '国风水墨', bg: '#f9f5ef', preview: '🎋' },
  { id: 'candy',        name: '果冻糖豆', bg: '#ffecd2', preview: '🍬' },
];

const STORAGE_KEY = 'sao-lei-theme';

/** 应用主题到 <html> 元素 */
function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
}

/** 从 localStorage 读取并应用保存的主题 */
function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark-minimal';
  applyTheme(saved);
  return saved;
}

/** 切换主题并保存 */
function setTheme(themeId) {
  applyTheme(themeId);
  localStorage.setItem(STORAGE_KEY, themeId);
  updateThemeUI(themeId);
}

/** 更新选择器 UI 的选中状态 */
function updateThemeUI(activeId) {
  document.querySelectorAll('.theme-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.theme === activeId);
  });
}

/** 初始化主题选择器抽屉
 *  @param {string} toggleBtnSelector - 触发按钮选择器
 *  @param {string} overlaySelector   - 遮罩层选择器
 *  @param {string} drawerSelector    - 抽屉选择器
 *  @param {string} gridSelector      - 主题格子容器选择器
 */
function initThemeSwitcher(toggleBtnSelector, overlaySelector, drawerSelector, gridSelector) {
  const toggleBtn = document.querySelector(toggleBtnSelector);
  const overlay   = document.querySelector(overlaySelector);
  const drawer    = document.querySelector(drawerSelector);
  const grid      = document.querySelector(gridSelector);

  if (!toggleBtn || !overlay || !drawer || !grid) return;

  // 渲染主题选项
  const current = localStorage.getItem(STORAGE_KEY) || 'dark-minimal';
  grid.innerHTML = THEMES.map(t => `
    <div class="theme-item${t.id === current ? ' selected' : ''}" data-theme="${t.id}">
      <div class="theme-preview" style="background:${t.bg}">${t.preview}</div>
      <span>${t.name}</span>
    </div>
  `).join('');

  // 点击主题选项
  grid.addEventListener('click', e => {
    const item = e.target.closest('.theme-item');
    if (!item) return;
    setTheme(item.dataset.theme);
    setTimeout(() => closeDrawer(), 500);
  });

  // 打开/关闭抽屉
  toggleBtn.addEventListener('click', () => overlay.classList.add('open'));

  function closeDrawer() {
    overlay.classList.remove('open');
  }

  // 点击遮罩关闭
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDrawer();
  });

  // 抽屉内下滑关闭（独立触摸监听，不依赖浏览器手势）
  let startY = 0;
  drawer.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  drawer.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 60) closeDrawer(); // 下滑 60px 关闭
  }, { passive: true });
}

/** 检测是否在 Safari 普通标签页（非 PWA）*/
function showPWABanner() {
  const isStandalone = window.navigator.standalone === true;
  if (!isStandalone) {
    const banner = document.querySelector('.pwa-banner');
    if (banner) banner.classList.add('show');
  }
}

// 自动加载主题
loadTheme();

export { THEMES, loadTheme, setTheme, initThemeSwitcher, showPWABanner };
```

- [ ] **Step 2: 为 theme-switcher.js 编写手动验证清单**

在浏览器控制台（页面引入 theme-switcher.js 后）验证：
```js
// 验证 1：切换主题
import { setTheme } from '/shared/theme-switcher.js';
setTheme('neon');
// 预期：<html data-theme="neon"> ，页面变为深蓝黑色
localStorage.getItem('sao-lei-theme'); // 预期：'neon'

// 验证 2：刷新后恢复
location.reload();
// 预期：页面保持 neon 主题

// 验证 3：切回默认
setTheme('dark-minimal');
```

- [ ] **Step 3: 提交**

```bash
git add shared/theme-switcher.js
git commit -m "feat: add theme switcher with localStorage persistence"
```

---

## Chunk 4: 扫雷游戏逻辑 + 测试

### Task 6: games/minesweeper/game.js — 游戏状态与逻辑

**Files:**
- Create: `games/minesweeper/game.js`
- Create: `tests/minesweeper/test.html`

- [ ] **Step 1: 先写测试文件 tests/minesweeper/test.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>扫雷逻辑测试</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #111; color: #eee; }
    .pass { color: #81c784; } .fail { color: #e57373; }
    h2 { color: #4fc3f7; }
    pre { background: #1e1e1e; padding: 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h2>扫雷逻辑测试</h2>
  <div id="results"></div>
  <script type="module">
    import { MinesweeperGame, MODES } from '/games/minesweeper/game.js';

    const results = [];
    function test(name, fn) {
      try {
        fn();
        results.push({ name, pass: true });
      } catch(e) {
        results.push({ name, pass: false, error: e.message });
      }
    }
    function assert(condition, msg) {
      if (!condition) throw new Error(msg || 'Assertion failed');
    }
    function assertEqual(a, b, msg) {
      if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
    }

    // ===== 测试：网格初始化 =====
    test('8x8 网格初始化，64 个格子全未揭开', () => {
      const g = new MinesweeperGame(8, 8, 10);
      assertEqual(g.cells.length, 64);
      assert(g.cells.every(c => !c.revealed && !c.flagged && !c.mine), '所有格子应为初始状态');
    });

    test('状态初始为 idle', () => {
      const g = new MinesweeperGame(8, 8, 10);
      assertEqual(g.state, 'idle');
    });

    // ===== 测试：首次点击保护 =====
    test('首次点击后生成地雷，点击位置无雷', () => {
      const g = new MinesweeperGame(8, 8, 10);
      g.reveal(0); // 点击索引 0
      const cell0 = g.cells[0];
      assert(!cell0.mine, '首次点击位置不应有雷');
      const mineCount = g.cells.filter(c => c.mine).length;
      assertEqual(mineCount, 10, '应生成 10 个地雷');
    });

    test('首次点击后状态变为 playing', () => {
      const g = new MinesweeperGame(8, 8, 10);
      g.reveal(0);
      assertEqual(g.state, 'playing');
    });

    // ===== 测试：邻居计算 =====
    test('角落格子（索引0）邻居数为 3', () => {
      const g = new MinesweeperGame(8, 8, 10);
      const neighbors = g.getNeighborIndices(0);
      assertEqual(neighbors.length, 3);
    });

    test('中间格子（索引 9，即 row=1,col=1）邻居数为 8', () => {
      const g = new MinesweeperGame(8, 8, 10);
      const neighbors = g.getNeighborIndices(9); // row=1,col=1
      assertEqual(neighbors.length, 8);
    });

    // ===== 测试：地雷生成 =====
    test('生成的地雷数量正确', () => {
      const g = new MinesweeperGame(16, 16, 40);
      g.reveal(0);
      const mineCount = g.cells.filter(c => c.mine).length;
      assertEqual(mineCount, 40);
    });

    test('首次点击及其邻格无雷（多次随机验证）', () => {
      // 运行 50 次：只要 _placeMines 逻辑正确，此测试必定通过
      for (let i = 0; i < 50; i++) {
        const g = new MinesweeperGame(8, 8, 10);
        const clickIdx = 27; // row=3, col=3，有完整 8 个邻格
        g.reveal(clickIdx);
        const safeZone = new Set([clickIdx, ...g.getNeighborIndices(clickIdx)]);
        const violated = [...safeZone].filter(idx => g.cells[idx].mine);
        assert(violated.length === 0,
          `第 ${i+1} 次：安全区域格子 ${violated} 有雷`);
      }
    });

    // ===== 测试：BFS 自动展开 =====
    test('揭开空白格时 BFS 自动展开（确定性测试）', () => {
      // 构造确定性场景：4x4 grid，雷在最后一格[15]
      // 点击[0]：邻格数全为0，BFS 应展开所有非雷格
      const g = new MinesweeperGame(4, 4, 1);
      g._placeMinesManual([15]); // 雷在右下角
      g.reveal(0); // 点左上角
      // [0-14] 均无雷，[0]邻格[1,4,5]均为0周边数，BFS 展开所有非雷格
      const revealedCount = g.cells.filter(c => c.revealed).length;
      const nonMineCount = g.cells.filter(c => !c.mine).length;
      assertEqual(revealedCount, nonMineCount, `BFS 应揭开全部 ${nonMineCount} 个非雷格，实际揭开 ${revealedCount}`);
    });

    // ===== 测试：旗帜切换 =====
    test('插旗/取旗切换正确', () => {
      const g = new MinesweeperGame(8, 8, 10);
      g.reveal(5); // 触发 playing 状态
      g.toggleFlag(10);
      assert(g.cells[10].flagged, '应已插旗');
      g.toggleFlag(10);
      assert(!g.cells[10].flagged, '应已取旗');
    });

    test('已揭开的格子不能插旗', () => {
      const g = new MinesweeperGame(8, 8, 10);
      g.reveal(0);
      if (g.cells[0].revealed) {
        g.toggleFlag(0);
        assert(!g.cells[0].flagged, '已揭开的格子不能插旗');
      }
    });

    // ===== 测试：胜利条件 =====
    test('揭开所有非雷格后状态为 won', () => {
      const g = new MinesweeperGame(4, 4, 1);
      // _placeMinesManual 设置 state=PLAYING, _minesReady=true, _firstClick=true
      // 第一次 reveal 会进入 _firstClick 分支但因 _minesReady=true 不会重新布雷
      g._placeMinesManual([15]); // 雷在最后一格（索引15）
      // 逐格揭开 0-14（均非雷），BFS 可能批量揭开
      g.reveal(0); // 触发首次点击流程，_firstClick=false
      // 若 BFS 已全部揭开则直接检查，否则继续揭开
      for (let i = 1; i < 15; i++) {
        if (!g.cells[i].revealed) g.reveal(i);
      }
      assertEqual(g.state, 'won', `揭开所有非雷格后应为 won，实际状态：${g.state}`);
    });

    // ===== 测试：失败条件 =====
    test('点击地雷后状态为 lost', () => {
      const g = new MinesweeperGame(4, 4, 1);
      g._placeMinesManual([5]);
      g.reveal(0); // 先触发 playing
      g.reveal(5); // 踩雷
      assertEqual(g.state, 'lost');
    });

    // ===== 测试：模式 =====
    test('默认模式为 reveal', () => {
      const g = new MinesweeperGame(8, 8, 10);
      assertEqual(g.mode, MODES.REVEAL);
    });

    test('切换模式', () => {
      const g = new MinesweeperGame(8, 8, 10);
      g.setMode(MODES.FLAG);
      assertEqual(g.mode, MODES.FLAG);
      g.setMode(MODES.POSITION);
      assertEqual(g.mode, MODES.POSITION);
    });

    // ===== 测试：重置 =====
    test('reset 后状态回到 idle，格子全清空', () => {
      const g = new MinesweeperGame(8, 8, 10);
      g.reveal(0); // playing
      g.reset();
      assertEqual(g.state, 'idle');
      assert(g._firstClick, 'reset 后 _firstClick 应为 true');
      assert(g.cells.every(c => !c.mine && !c.revealed && !c.flagged), '所有格子应清空');
      assertEqual(g.elapsed, 0, 'elapsed 应重置为 0');
    });

    // 渲染结果
    const div = document.getElementById('results');
    const passed = results.filter(r => r.pass).length;
    div.innerHTML = `<p>${passed}/${results.length} 测试通过</p>` +
      results.map(r => `<div class="${r.pass ? 'pass' : 'fail'}">
        ${r.pass ? '✓' : '✗'} ${r.name}
        ${r.pass ? '' : `<pre>${r.error}</pre>`}
      </div>`).join('');
  </script>
</body>
</html>
```

- [ ] **Step 2: 在浏览器打开测试页**

```bash
# 项目根目录启动服务器
python3 -m http.server 8080
```

打开 `http://localhost:8080/tests/minesweeper/test.html`

预期：所有测试失败（`MinesweeperGame` 未定义）。确认测试正确报错再实现。

- [ ] **Step 3: 创建 games/minesweeper/game.js**

```js
// games/minesweeper/game.js

export const MODES = Object.freeze({ REVEAL: 'reveal', FLAG: 'flag', POSITION: 'position' });
export const STATES = Object.freeze({ IDLE: 'idle', PLAYING: 'playing', WON: 'won', LOST: 'lost' });

export class MinesweeperGame {
  constructor(rows, cols, mineCount) {
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mineCount;
    this.state = STATES.IDLE;
    this.mode  = MODES.REVEAL;
    this.cursor = -1; // 位置模式光标索引，-1 = 无
    this.elapsed = 0; // 已用秒数
    this._timerInterval = null;
    this._firstClick = true;
    this._minesReady = false;
    this.cells = Array.from({ length: rows * cols }, () => ({
      mine: false, revealed: false, flagged: false, neighborCount: 0
    }));
  }

  // === 索引/坐标转换 ===
  idx(r, c) { return r * this.cols + c; }
  row(i) { return Math.floor(i / this.cols); }
  col(i) { return i % this.cols; }

  getNeighborIndices(i) {
    const r = this.row(i), c = this.col(i);
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          result.push(this.idx(nr, nc));
        }
      }
    }
    return result;
  }

  // === 地雷生成 ===
  _placeMines(safeIdx) {
    const safeSet = new Set([safeIdx, ...this.getNeighborIndices(safeIdx)]);
    const candidates = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (!safeSet.has(i)) candidates.push(i);
    }
    // Fisher-Yates shuffle 取前 mineCount 个
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    candidates.slice(0, this.mineCount).forEach(i => { this.cells[i].mine = true; });
    this._calcNeighbors();
    this._minesReady = true;
  }

  /** 测试专用：手动指定地雷位置
   *  ⚠️ 仅在 /tests/ 路径下调用，生产游戏 UI 中严禁使用
   */
  _placeMinesManual(mineIndices) {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/tests/')) {
      throw new Error('_placeMinesManual is for testing only');
    }
    mineIndices.forEach(i => { this.cells[i].mine = true; });
    this._calcNeighbors();
    this._minesReady = true;
    if (this.state === STATES.IDLE) this.state = STATES.PLAYING;
  }

  _calcNeighbors() {
    this.cells.forEach((cell, i) => {
      if (cell.mine) return;
      cell.neighborCount = this.getNeighborIndices(i).filter(j => this.cells[j].mine).length;
    });
  }

  // === 游戏动作 ===
  reveal(i) {
    if (this.state === STATES.WON || this.state === STATES.LOST) return;
    if (this.cells[i].flagged) return;

    if (this._firstClick) {
      this._firstClick = false;
      this.state = STATES.PLAYING;
      if (!this._minesReady) this._placeMines(i);
      this._startTimer();
    }

    if (this.cells[i].revealed) {
      // 已揭开格子：若周围旗帜数等于 neighborCount，自动揭开周围未旗格（和弦操作）
      const neighbors = this.getNeighborIndices(i);
      const flagCount = neighbors.filter(j => this.cells[j].flagged).length;
      if (flagCount === this.cells[i].neighborCount) {
        neighbors.forEach(j => { if (!this.cells[j].flagged) this._revealOne(j); });
      }
      return;
    }

    this._revealOne(i);
  }

  _revealOne(i) {
    if (this.cells[i].revealed || this.cells[i].flagged) return;
    this.cells[i].revealed = true;

    if (this.cells[i].mine) {
      this.state = STATES.LOST;
      this._stopTimer();
      this._revealAllMines();
      return;
    }

    if (this.cells[i].neighborCount === 0) {
      this._bfsReveal(i);
    }

    this._checkWin();
  }

  /** 迭代 BFS 展开（避免 64x64 时栈溢出）*/
  _bfsReveal(startIdx) {
    const queue = [startIdx];
    const visited = new Set([startIdx]);
    while (queue.length > 0) {
      const curr = queue.shift();
      this.getNeighborIndices(curr).forEach(j => {
        if (visited.has(j) || this.cells[j].revealed || this.cells[j].flagged || this.cells[j].mine) return;
        visited.add(j);
        this.cells[j].revealed = true;
        if (this.cells[j].neighborCount === 0) queue.push(j);
      });
    }
  }

  _revealAllMines() {
    this.cells.forEach(cell => { if (cell.mine) cell.revealed = true; });
  }

  _checkWin() {
    const allNonMinesRevealed = this.cells.every(c => c.mine || c.revealed);
    if (allNonMinesRevealed) {
      this.state = STATES.WON;
      this._stopTimer();
      // 胜利时自动标记所有地雷
      this.cells.forEach(c => { if (c.mine) c.flagged = true; });
    }
  }

  toggleFlag(i) {
    if (this.state !== STATES.PLAYING) return;
    if (this.cells[i].revealed) return;
    this.cells[i].flagged = !this.cells[i].flagged;
  }

  setMode(mode) { this.mode = mode; }
  setCursor(i) { this.cursor = i; }

  // === 计时器 ===
  _startTimer() {
    this._timerInterval = setInterval(() => { this.elapsed++; }, 1000);
  }
  _stopTimer() { clearInterval(this._timerInterval); }
  resumeTimer() { if (this.state === STATES.PLAYING) this._startTimer(); }

  // === 计算属性 ===
  get remainingMines() {
    return this.mineCount - this.cells.filter(c => c.flagged).length;
  }

  // === 持久化 ===
  toJSON() {
    return JSON.stringify({
      rows: this.rows, cols: this.cols, mineCount: this.mineCount,
      state: this.state, mode: this.mode, cursor: this.cursor,
      elapsed: this.elapsed, firstClick: this._firstClick,
      minesReady: this._minesReady,
      cells: this.cells
    });
  }

  static fromJSON(json) {
    const d = JSON.parse(json);
    const g = new MinesweeperGame(d.rows, d.cols, d.mineCount);
    g.state = d.state; g.mode = d.mode; g.cursor = d.cursor;
    g.elapsed = d.elapsed; g._firstClick = d.firstClick;
    g._minesReady = d.minesReady; g.cells = d.cells;
    return g;
  }

  reset() {
    this._stopTimer();
    this.cells = Array.from({ length: this.rows * this.cols }, () => ({
      mine: false, revealed: false, flagged: false, neighborCount: 0
    }));
    this.state = STATES.IDLE; this.mode = MODES.REVEAL;
    this.cursor = -1; this.elapsed = 0;
    this._firstClick = true; this._minesReady = false;
  }
}
```

- [ ] **Step 4: 刷新测试页，确认所有测试通过**

打开 `http://localhost:8080/tests/minesweeper/test.html`

预期输出：`14/14 测试通过`（所有行显示绿色 ✓）

如有失败，先修复 game.js 再继续。

- [ ] **Step 5: 提交**

```bash
git add games/minesweeper/game.js tests/minesweeper/test.html
git commit -m "feat: add minesweeper game logic with BFS and tests"
```

---

## Chunk 5: 扫雷 UI + 放大镜 + 主页集成

### Task 7: games/minesweeper/style.css

**Files:**
- Create: `games/minesweeper/style.css`

- [ ] **Step 1: 创建 games/minesweeper/style.css**

```css
/* games/minesweeper/style.css */

/* ===== 雷区容器 ===== */
.mine-grid-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  /* 完全接管触摸事件，阻止页面滚动 */
  touch-action: none;
  position: relative;
}

.mine-grid {
  display: grid;
  /* grid-template-columns 由 JS 动态设置 */
  gap: 0;
  border: 1px solid var(--cell-unrevealed-border-dark);
}

/* ===== 格子基础样式 ===== */
.cell {
  width: var(--cell-size);
  height: var(--cell-size);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--cell-size) * 0.55);
  font-weight: bold;
  font-family: 'Courier New', monospace;
  border: 1px solid;
  border-color: var(--cell-unrevealed-border-light) var(--cell-unrevealed-border-dark) var(--cell-unrevealed-border-dark) var(--cell-unrevealed-border-light);
  background: var(--cell-unrevealed);
  box-sizing: border-box;
  position: relative;
  transition: background 0.08s;
  -webkit-user-select: none;
  user-select: none;
}

/* 已揭开的格子 */
.cell.revealed {
  background: var(--cell-revealed);
  border-color: var(--cell-revealed-border);
}

/* 地雷格 */
.cell.mine-cell {
  background: var(--cell-mine);
}

/* 旗帜 */
.cell.flagged::after {
  content: '🚩';
  font-size: calc(var(--cell-size) * 0.5);
}

/* 数字颜色 */
.cell[data-num="1"] { color: var(--num-1); }
.cell[data-num="2"] { color: var(--num-2); }
.cell[data-num="3"] { color: var(--num-3); }
.cell[data-num="4"] { color: var(--num-4); }
.cell[data-num="5"] { color: var(--num-5); }
.cell[data-num="6"] { color: var(--num-6); }
.cell[data-num="7"] { color: var(--num-7); }
.cell[data-num="8"] { color: var(--num-8); }

/* 位置模式光标 */
.cell.cursor {
  outline: 2px solid var(--cursor-color);
  outline-offset: -2px;
  z-index: 1;
}

/* ===== 放大镜气泡 ===== */
.magnifier {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 2px solid var(--magnifier-border);
  overflow: hidden;
  pointer-events: none;
  z-index: 20;
  display: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  background: var(--bg-secondary);
}
.magnifier.visible { display: block; }

/* 放大镜内容（小格子放大后的视图）*/
.magnifier-content {
  position: absolute;
  display: grid;
  /* grid-template-columns 由 JS 动态设置为 5 列 */
  transform-origin: center center;
}

/* 放大镜中心十字准星 */
.magnifier::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 12px; height: 12px;
  border: 1.5px solid var(--cursor-color);
  border-radius: 50%;
  z-index: 21;
  pointer-events: none;
}

/* ===== 难度选择器 ===== */
.difficulty-bar {
  display: flex;
  gap: 6px;
  padding: 6px 16px;
  background: var(--info-bar-bg);
  border-bottom: 1px solid var(--toolbar-border);
  flex-shrink: 0;
}

.diff-btn {
  flex: 1;
  padding: 4px 0;
  border: 1px solid var(--toolbar-border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.diff-btn.active {
  background: var(--btn-active-bg);
  color: var(--btn-active-color);
  border-color: var(--btn-active-color);
}

/* ===== 胜负覆盖层 ===== */
.result-overlay {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  align-items: center;
  justify-content: center;
  z-index: 15;
  flex-direction: column;
  gap: 12px;
}
.result-overlay.show { display: flex; }
.result-overlay h2 { color: #fff; margin: 0; font-size: 1.5rem; }
.result-overlay button {
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 1rem;
  font-weight: 600;
}
```

---

### Task 8: games/minesweeper/index.html — 完整游戏页

**Files:**
- Create: `games/minesweeper/index.html`

- [ ] **Step 1: 创建 games/minesweeper/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>扫雷 - 骚雷小游戏</title>
  <meta name="description" content="手机扫雷游戏，支持离线，四档难度，放大镜精准操作">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
  <link rel="manifest" href="/manifest.json">
  <link rel="canonical" href="/games/minesweeper/">
  <link rel="stylesheet" href="/shared/base.css">
  <link rel="stylesheet" href="/shared/themes.css">
  <link rel="stylesheet" href="/shared/components.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="game-layout">

    <!-- 顶部信息栏 -->
    <div class="info-bar">
      <div class="info-counter" id="mine-count">010</div>
      <button class="info-reset-btn" id="reset-btn" aria-label="重置游戏">🙂</button>
      <div class="info-counter" id="timer">000</div>
      <button class="theme-toggle-btn" id="theme-btn" aria-label="切换主题">🎨</button>
    </div>

    <!-- 难度选择 -->
    <div class="difficulty-bar">
      <button class="diff-btn active" data-diff="8">入门 8×8</button>
      <button class="diff-btn" data-diff="16">初级 16×16</button>
      <button class="diff-btn" data-diff="32">中级 32×32</button>
      <button class="diff-btn" data-diff="64">高级 64×64</button>
    </div>

    <!-- 雷区 -->
    <div class="mine-grid-wrapper" id="grid-wrapper">
      <div class="mine-grid" id="mine-grid"></div>
      <!-- 放大镜 -->
      <div class="magnifier" id="magnifier">
        <div class="magnifier-content" id="magnifier-content"></div>
      </div>
      <!-- 结果覆盖层 -->
      <div class="result-overlay" id="result-overlay">
        <h2 id="result-text"></h2>
        <button id="result-reset-btn">再来一局</button>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="toolbar">
      <button class="toolbar-btn active" data-mode="reveal" id="btn-reveal">翻开</button>
      <button class="toolbar-btn" data-mode="flag"   id="btn-flag">插旗</button>
      <button class="toolbar-btn" data-mode="position" id="btn-pos">位置</button>
    </div>

  </div>

  <!-- 主题选择器抽屉 -->
  <div class="theme-overlay" id="theme-overlay">
    <div class="theme-drawer" id="theme-drawer">
      <h3>选择主题</h3>
      <div class="theme-grid" id="theme-grid"></div>
    </div>
  </div>

  <!-- PWA 提示横幅 -->
  <div class="pwa-banner" id="pwa-banner">
    <span>📱 添加到主屏幕后进度永久保存</span>
    <button onclick="document.getElementById('pwa-banner').classList.remove('show')">×</button>
  </div>

  <script type="module">
    import { MinesweeperGame, MODES, STATES } from '/games/minesweeper/game.js';
    import { initThemeSwitcher, showPWABanner } from '/shared/theme-switcher.js';

    // ===== 常量 =====
    const DIFFICULTIES = {
      8:  { rows: 8,  cols: 8,  mines: 10 },
      16: { rows: 16, cols: 16, mines: 40 },
      32: { rows: 32, cols: 32, mines: 100 },
      64: { rows: 64, cols: 64, mines: 400 },
    };
    const STORAGE_GAME_KEY = 'sao-lei-game';
    const STORAGE_DIFF_KEY = 'sao-lei-difficulty';
    const STORAGE_BEST_KEY = 'sao-lei-best';

    // ===== 状态 =====
    let game;
    let currentDiff = parseInt(localStorage.getItem(STORAGE_DIFF_KEY) || '8');
    let timerInterval = null;

    // ===== DOM 引用 =====
    const gridEl      = document.getElementById('mine-grid');
    const mineCountEl = document.getElementById('mine-count');
    const timerEl     = document.getElementById('timer');
    const resetBtn    = document.getElementById('reset-btn');
    const resultOverlay = document.getElementById('result-overlay');
    const resultText  = document.getElementById('result-text');
    const magnifier   = document.getElementById('magnifier');
    const magnifierContent = document.getElementById('magnifier-content');

    // ===== 初始化 =====
    initThemeSwitcher('#theme-btn', '#theme-overlay', '#theme-drawer', '#theme-grid');
    showPWABanner();
    initDifficultyButtons();
    loadOrNewGame();
    initTouchHandlers();

    // ===== 难度按钮 =====
    function initDifficultyButtons() {
      document.querySelectorAll('.diff-btn').forEach(btn => {
        const d = parseInt(btn.dataset.diff);
        if (d === currentDiff) btn.classList.add('active');
        else btn.classList.remove('active');
        btn.addEventListener('click', () => {
          if (d === currentDiff) return;
          currentDiff = d;
          localStorage.setItem(STORAGE_DIFF_KEY, d);
          document.querySelectorAll('.diff-btn').forEach(b =>
            b.classList.toggle('active', parseInt(b.dataset.diff) === d)
          );
          newGame();
        });
      });
    }

    // ===== 游戏初始化 =====
    function newGame() {
      clearInterval(timerInterval);
      localStorage.removeItem(STORAGE_GAME_KEY);
      const { rows, cols, mines } = DIFFICULTIES[currentDiff];
      game = new MinesweeperGame(rows, cols, mines);
      renderGrid();
      updateInfoBar();
      resultOverlay.classList.remove('show');
      resetBtn.textContent = '🙂';
    }

    function loadOrNewGame() {
      const saved = localStorage.getItem(STORAGE_GAME_KEY);
      if (saved) {
        try {
          game = MinesweeperGame.fromJSON(saved);
          // 验证难度一致
          if (game.cols !== currentDiff) { newGame(); return; }
          renderGrid();
          updateInfoBar();
          if (game.state === STATES.PLAYING) {
            // 计时器暂停，等用户点击雷区继续
            // (game.resumeTimer 将在首次触摸时调用)
          }
          return;
        } catch(e) { /* 存档损坏，新游戏 */ }
      }
      newGame();
    }

    // ===== 渲染网格 =====
    function renderGrid() {
      const cellSize = currentDiff === 8 ? 44 : Math.floor(358 / currentDiff);
      document.documentElement.style.setProperty('--cell-size', cellSize + 'px');
      gridEl.style.gridTemplateColumns = `repeat(${game.cols}, ${cellSize}px)`;
      gridEl.innerHTML = '';
      game.cells.forEach((cell, i) => {
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.idx = i;
        updateCellEl(el, cell);
        gridEl.appendChild(el);
      });
    }

    function updateCellEl(el, cell) {
      el.className = 'cell';
      if (cell.revealed) {
        el.classList.add('revealed');
        if (cell.mine) {
          el.classList.add('mine-cell');
          el.textContent = '💣';
        } else if (cell.neighborCount > 0) {
          el.textContent = cell.neighborCount;
          el.dataset.num = cell.neighborCount;
        } else {
          el.textContent = '';
        }
      } else if (cell.flagged) {
        el.classList.add('flagged');
        el.textContent = '';
      } else {
        el.textContent = '';
      }
      // 位置光标
      const cellIdx = parseInt(el.dataset.idx);
      if (cellIdx === game.cursor) el.classList.add('cursor');
    }

    function refreshAllCells() {
      const cells = gridEl.querySelectorAll('.cell');
      game.cells.forEach((cell, i) => updateCellEl(cells[i], cell));
    }

    // ===== 信息栏 =====
    function updateInfoBar() {
      mineCountEl.textContent = String(Math.max(0, game.remainingMines)).padStart(3, '0');
      timerEl.textContent = String(Math.min(999, game.elapsed)).padStart(3, '0');
    }

    function startUITimer() {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timerEl.textContent = String(Math.min(999, game.elapsed)).padStart(3, '0');
      }, 500);
    }

    // ===== 重置 =====
    resetBtn.addEventListener('click', newGame);
    document.getElementById('result-reset-btn').addEventListener('click', newGame);

    // ===== 模式切换 =====
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        game.setMode(MODES[mode.toUpperCase()]);
        document.querySelectorAll('.toolbar-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === mode)
        );
      });
    });

    // ===== 处理游戏动作 =====
    function handleCellAction(idx) {
      if (game.state === STATES.WON || game.state === STATES.LOST) return;

      const wasIdle = game.state === STATES.IDLE;

      if (game.mode === MODES.REVEAL) {
        game.reveal(idx);
      } else if (game.mode === MODES.FLAG) {
        game.toggleFlag(idx);
      } else if (game.mode === MODES.POSITION) {
        game.setCursor(idx);
        refreshAllCells();
        updateInfoBar();
        return; // 位置模式不保存进度也不检查胜负
      }

      // 首次点击后启动 UI 计时器
      if (wasIdle && game.state === STATES.PLAYING) {
        startUITimer();
        game.resumeTimer();
      }

      refreshAllCells();
      updateInfoBar();
      saveGame();
      checkGameEnd();
    }

    function checkGameEnd() {
      if (game.state === STATES.WON) {
        clearInterval(timerInterval);
        resetBtn.textContent = '😎';
        resultText.textContent = '🎉 成功排雷！';
        resultOverlay.classList.add('show');
        saveBestTime();
        localStorage.removeItem(STORAGE_GAME_KEY);
      } else if (game.state === STATES.LOST) {
        clearInterval(timerInterval);
        resetBtn.textContent = '😵';
        resultText.textContent = '💥 踩到地雷！';
        resultOverlay.classList.add('show');
        localStorage.removeItem(STORAGE_GAME_KEY);
      }
    }

    function saveBestTime() {
      const key = STORAGE_BEST_KEY + '-' + currentDiff;
      const best = parseInt(localStorage.getItem(key) || '9999');
      if (game.elapsed < best) localStorage.setItem(key, game.elapsed);
    }

    function saveGame() {
      if (game.state === STATES.PLAYING) {
        localStorage.setItem(STORAGE_GAME_KEY, game.toJSON());
      }
    }

    // ===== 触摸事件处理（含放大镜）=====
    function initTouchHandlers() {
      const wrapper = document.getElementById('grid-wrapper');
      const MAGNIFIER_ENABLED_DIFFS = [16, 32, 64];
      const useMagnifier = () => MAGNIFIER_ENABLED_DIFFS.includes(currentDiff);
      const DRAG_THRESHOLD = 5; // px

      let touchStartX = 0, touchStartY = 0;
      let isDragging = false;
      let lastCellIdx = -1;

      function getCellIdxFromPoint(x, y) {
        const gridRect = gridEl.getBoundingClientRect();
        const relX = x - gridRect.left;
        const relY = y - gridRect.top;
        const cellSize = currentDiff === 8 ? 44 : Math.floor(358 / currentDiff);
        const col = Math.floor(relX / cellSize);
        const row = Math.floor(relY / cellSize);
        if (col < 0 || col >= game.cols || row < 0 || row >= game.rows) return -1;
        return row * game.cols + col;
      }

      function showMagnifier(touchX, touchY, targetIdx) {
        if (!useMagnifier() || targetIdx < 0) {
          magnifier.classList.remove('visible');
          return;
        }
        const cellSize = Math.floor(358 / currentDiff);
        const ZOOM_CELLS = 5; // 显示 5x5 区域
        const ZOOM_SCALE = 3;
        const targetRow = game.row(targetIdx);
        const targetCol = game.col(targetIdx);

        // 构建 5x5 格子视图
        magnifierContent.style.gridTemplateColumns = `repeat(5, ${cellSize}px)`;
        magnifierContent.innerHTML = '';
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const r = targetRow + dr, c = targetCol + dc;
            const div = document.createElement('div');
            div.className = 'cell';
            div.style.width = cellSize + 'px';
            div.style.height = cellSize + 'px';
            div.style.fontSize = (cellSize * 0.55) + 'px';
            if (r < 0 || r >= game.rows || c < 0 || c >= game.cols) {
              div.style.background = 'var(--bg-primary)';
            } else {
              const idx = game.idx(r, c);
              updateCellEl(div, game.cells[idx]);
              div.dataset.idx = idx;
              if (dr === 0 && dc === 0) div.classList.add('cursor');
            }
            magnifierContent.appendChild(div);
          }
        }

        // 缩放
        const contentSize = cellSize * ZOOM_CELLS;
        const scale = 120 / contentSize * ZOOM_SCALE;
        const offset = -(contentSize / 2) + (120 / (2 * scale));
        magnifierContent.style.transform = `scale(${scale})`;
        magnifierContent.style.left = offset + 'px';
        magnifierContent.style.top  = offset + 'px';

        // 定位放大镜（在手指上方 80px，自动翻转到下方处理边缘情况）
        const wrapperRect = wrapper.getBoundingClientRect();
        let mx = touchX - wrapperRect.left - 60;
        let my = touchY - wrapperRect.top - 80 - 60;
        // 左右边界夹紧
        mx = Math.max(0, Math.min(wrapperRect.width - 120, mx));
        // 上边界不足时翻转到手指下方显示
        if (my < 0) {
          my = touchY - wrapperRect.top + 20; // 显示在手指下方 20px
        }
        // 下边界夹紧
        my = Math.min(wrapperRect.height - 120, my);
        my = Math.max(0, my);
        magnifier.style.left = mx + 'px';
        magnifier.style.top  = my + 'px';
        magnifier.classList.add('visible');
      }

      wrapper.addEventListener('touchstart', e => {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isDragging = false;
        lastCellIdx = getCellIdxFromPoint(touch.clientX, touch.clientY);

        // 恢复暂停的计时器（从存档加载后首次有效触摸）
        // 位置模式不启动计时器，避免用户仅定位光标就意外开始计时
        if (game.state === STATES.PLAYING && !timerInterval && game.mode !== MODES.POSITION) {
          game.resumeTimer();
          startUITimer();
        }

        if (useMagnifier() && lastCellIdx >= 0) {
          showMagnifier(touch.clientX, touch.clientY, lastCellIdx);
        }
      }, { passive: false });

      wrapper.addEventListener('touchmove', e => {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (!isDragging && Math.sqrt(dx*dx + dy*dy) >= DRAG_THRESHOLD) {
          isDragging = true;
        }
        const cellIdx = getCellIdxFromPoint(touch.clientX, touch.clientY);
        if (cellIdx >= 0 && cellIdx !== lastCellIdx) {
          lastCellIdx = cellIdx;
          if (game.mode === MODES.POSITION) {
            game.setCursor(cellIdx);
            refreshAllCells();
          }
        }
        if (useMagnifier() && lastCellIdx >= 0) {
          showMagnifier(touch.clientX, touch.clientY, lastCellIdx);
        }
      }, { passive: false });

      wrapper.addEventListener('touchend', e => {
        e.preventDefault();
        magnifier.classList.remove('visible');
        if (lastCellIdx >= 0) {
          handleCellAction(lastCellIdx);
        }
        lastCellIdx = -1;
      }, { passive: false });
    }

    // ===== 注册 Service Worker =====
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: 在浏览器中手动测试游戏**

打开 `http://localhost:8080/games/minesweeper/`，Safari 开发者工具切换到 iPhone 14 尺寸，逐项验证：

| 测试项 | 预期结果 |
|--------|---------|
| 入门难度（8×8）直接点击 | 格子正常翻开，首次不踩雷 |
| 切换到初级（16×16），按住格子 | 放大镜气泡在手指上方出现 |
| 切换插旗模式，点格子 | 格子显示 🚩 |
| 切换位置模式，滑动 | 光标橙色边框随手指移动 |
| 点击 🎨 图标 | 主题抽屉从底部滑出 |
| 选择"霓虹赛博"主题 | 页面瞬间变为深色发光风格 |
| 刷新页面 | 主题保持，游戏进度恢复 |
| 切换到高级（64×64）| 格子缩小，放大镜辅助可操作 |
| 胜利/失败 | 覆盖层显示，重置按钮变表情 |

- [ ] **Step 3: 分两次提交（style.css 与 index.html 分开）**

```bash
# 先提交样式
git add games/minesweeper/style.css
git commit -m "feat: add minesweeper CSS with magnifier and theme variables"

# 再提交完整游戏页
git add games/minesweeper/index.html
git commit -m "feat: add minesweeper game page with touch handlers and magnifier"
```

---

### Task 9: index.html — 完整主页与 SEO

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 完善 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>骚雷 - 手机扫雷游戏 | 离线可玩 PWA</title>
  <meta name="description" content="在手机上玩经典扫雷，支持离线，可添加到主屏幕，六套主题随心切换">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="小游戏">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">
  <link rel="manifest" href="/manifest.json">
  <meta property="og:title" content="骚雷 - 手机扫雷游戏">
  <meta property="og:description" content="在手机上玩经典扫雷，支持离线，六套主题">
  <meta property="og:type" content="website">
  <link rel="canonical" href="/">
  <link rel="stylesheet" href="/shared/base.css">
  <link rel="stylesheet" href="/shared/themes.css">
  <link rel="stylesheet" href="/shared/components.css">
  <style>
    .launcher {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      padding: 0 16px 16px;
    }
    .launcher-header {
      padding: 20px 0 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .launcher-header h1 {
      margin: 0;
      font-size: 1.3rem;
      color: var(--text-primary);
      font-weight: 700;
    }
    .game-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--toolbar-border);
      border-radius: 12px;
      margin-bottom: 10px;
      text-decoration: none;
      color: var(--text-primary);
      transition: transform 0.1s, opacity 0.1s;
    }
    .game-card:active { transform: scale(0.98); opacity: 0.8; }
    .game-card .icon { font-size: 2.2rem; width: 48px; text-align: center; }
    .game-card h2 { margin: 0 0 4px; font-size: 1rem; }
    .game-card p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
    .game-card.coming-soon { opacity: 0.4; }
    .soon-badge {
      margin-left: auto;
      font-size: 0.65rem;
      padding: 2px 8px;
      background: var(--toolbar-border);
      color: var(--text-muted);
      border-radius: 99px;
      white-space: nowrap;
    }
    .launcher-desc {
      margin: 0 0 20px;
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <main class="launcher">
    <div class="launcher-header">
      <h1>🎮 小游戏</h1>
      <button class="theme-toggle-btn" id="theme-btn" aria-label="切换主题">🎨</button>
    </div>

    <p class="launcher-desc">
      经典小游戏合集，专为手机优化。支持离线游玩，添加到主屏幕体验更佳。
    </p>

    <section aria-label="游戏列表">
      <a href="/games/minesweeper/" class="game-card">
        <span class="icon">💣</span>
        <div>
          <h2>扫雷</h2>
          <p>四档难度 · 放大镜精准操作 · 六套主题</p>
        </div>
      </a>

      <div class="game-card coming-soon" aria-label="即将推出">
        <span class="icon">🕷️</span>
        <div>
          <h2>蜘蛛纸牌</h2>
          <p>经典接龙游戏</p>
        </div>
        <span class="soon-badge">即将推出</span>
      </div>

      <div class="game-card coming-soon" aria-label="即将推出">
        <span class="icon">🀄</span>
        <div>
          <h2>连连看</h2>
          <p>消除类益智游戏</p>
        </div>
        <span class="soon-badge">即将推出</span>
      </div>
    </section>
  </main>

  <!-- 主题选择器抽屉 -->
  <div class="theme-overlay" id="theme-overlay">
    <div class="theme-drawer" id="theme-drawer">
      <h3>选择主题</h3>
      <div class="theme-grid" id="theme-grid"></div>
    </div>
  </div>

  <!-- PWA 提示横幅 -->
  <div class="pwa-banner" id="pwa-banner">
    <span>📱 添加到主屏幕后进度永久保存</span>
    <button onclick="document.getElementById('pwa-banner').classList.remove('show')">×</button>
  </div>

  <script type="module">
    import { initThemeSwitcher, showPWABanner } from '/shared/theme-switcher.js';
    initThemeSwitcher('#theme-btn', '#theme-overlay', '#theme-drawer', '#theme-grid');
    showPWABanner();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: 验证 SEO 元信息**

在浏览器开发者工具 → Elements 中确认：
- `<title>` 内容正确
- `<meta description>` 存在
- `<link rel="canonical">` 指向 `/`
- `<meta property="og:title">` 存在
- `<meta property="og:image">` 指向 `/icons/icon-512.png`

- [ ] **Step 3: 最终集成测试**

用 `python3 -m http.server 8080` 启动服务器，Safari iPhone 14 尺寸下验证：

| 测试项 | 预期 |
|--------|------|
| 主页显示游戏列表 | 扫雷可点击，其他显示"即将推出" |
| 点击扫雷进入游戏 | 正常进入游戏页 |
| 游戏内主题切换 | 6 套主题均可切换 |
| 刷新页面 | 主题和进度保持 |
| 开发者工具 Application → SW | 状态 activated |
| 断开网络后刷新 | 页面仍可访问（离线可用）|
| 断网后访问未缓存 URL | 显示 offline.html |

- [ ] **Step 4: 最终提交**

```bash
git add index.html
git commit -m "feat: complete launcher with SEO, PWA install banner, theme switcher"
```

---

## 完成 ✓

所有任务完成后，项目包含：
- ✅ PWA 离线支持（Service Worker + manifest）
- ✅ Safari "添加到主屏幕"完整支持
- ✅ 6 套主题，localStorage 持久化
- ✅ 扫雷游戏（4 档难度，BFS 展开，首次点击保护）
- ✅ 放大镜精准触控（16×16 及以上）
- ✅ 三模式工具栏（翻开/插旗/位置）
- ✅ 游戏进度自动保存/恢复
- ✅ SEO 友好的语义化 HTML
- ✅ 横屏提示
- ✅ 安全区域适配（刘海 + Home 条）
