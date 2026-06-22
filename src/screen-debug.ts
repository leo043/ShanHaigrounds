// 屏幕适配调试浮层
// 在真机调试时显示当前 viewport 尺寸、DPR、安全区域、屏幕方向等关键信息。
// 开启方式：URL 加 #debug 或在 console 执行 localStorage.setItem('screenDebug','1') 后刷新。
// 关闭方式：再次点击浮层或 localStorage.removeItem('screenDebug')

export function setupScreenDebug(): void {
  const enabled =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('debug') ||
      localStorage.getItem('screenDebug') === '1');
  if (!enabled) return;

  // 创建浮层
  const panel = document.createElement('div');
  panel.id = 'screen-debug-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:env(safe-area-inset-top,0px)',
    'right:env(safe-area-inset-right,0px)',
    'z-index:99999',
    'background:rgba(0,0,0,0.85)',
    'color:#0f0',
    'font-family:Menlo,Consolas,monospace',
    'font-size:11px',
    'line-height:1.5',
    'padding:8px 10px',
    'border-radius:0 0 0 6px',
    'pointer-events:auto',
    'max-width:60vw',
    'overflow:hidden',
    'white-space:pre',
    'border:1px solid #0f0',
    'backdrop-filter:blur(2px)',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = '📺 Screen Debug (点击关闭)';
  title.style.cssText = 'color:#ff0;font-weight:bold;margin-bottom:4px;cursor:pointer;text-align:center;';
  title.addEventListener('click', () => {
    localStorage.removeItem('screenDebug');
    panel.remove();
  });
  panel.appendChild(title);

  const body = document.createElement('div');
  panel.appendChild(body);

  document.body.appendChild(panel);

  // 兼容性：env() 在 style 属性里可能不生效，用 JS 测量更可靠
  function getEnv(name: string): string {
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;top:0;left:0;width:0;height:0;padding:${name};visibility:hidden;`;
    document.body.appendChild(div);
    const rect = div.getBoundingClientRect();
    const computed = getComputedStyle(div).padding;
    document.body.removeChild(div);
    // 取宽高作为 inset 值（top/left 时 width/height 等于 inset）
    return `${computed} (rect: ${rect.top.toFixed(1)},${rect.left.toFixed(1)})`;
  }

  function update(): void {
    const de = document.documentElement;
    const win = window;
    const screen = win.screen;
    const orientation =
      win.screen?.orientation?.type ??
      (win.innerHeight > win.innerWidth ? 'portrait' : 'landscape');
    const compact = win.matchMedia('(max-height: 540px)').matches;
    const coarse = win.matchMedia('(pointer: coarse)').matches;
    const wideScreen = win.matchMedia('(min-aspect-ratio: 21/9)').matches;

    body.textContent = [
      `viewport:  ${win.innerWidth} x ${win.innerHeight}`,
      `doc:       ${de.clientWidth} x ${de.clientHeight}`,
      `DPR:       ${win.devicePixelRatio}`,
      `screen:    ${screen.width} x ${screen.height}`,
      `avail:     ${screen.availWidth} x ${screen.availHeight}`,
      `orient:    ${orientation}`,
      `ratio:     ${(win.innerWidth / win.innerHeight).toFixed(3)}`,
      ``,
      `safe-top:    ${getEnv('env(safe-area-inset-top)')}`,
      `safe-bottom: ${getEnv('env(safe-area-inset-bottom)')}`,
      `safe-left:   ${getEnv('env(safe-area-inset-left)')}`,
      `safe-right:  ${getEnv('env(safe-area-inset-right)')}`,
      ``,
      `compact:   ${compact ? 'YES' : 'no'}`,
      `touch:     ${coarse ? 'YES' : 'no'}`,
      `ultrawide: ${wideScreen ? 'YES' : 'no'}`,
      ``,
      `body Zoom: ${document.body.style.zoom || '1'}`,
      `UA: ${navigator.userAgent.slice(0, 60)}`,
    ].join('\n');
  }

  update();
  // 每秒刷新一次，捕获系统栏显隐导致的视口变化
  setInterval(update, 1000);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 200));
}
