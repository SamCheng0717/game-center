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
