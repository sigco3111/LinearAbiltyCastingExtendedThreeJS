import { App } from './core/App.js';
import { LoadingScreen } from './ui/HUD.js';

/**
 * 진입점.
 *
 * 흥미로운 모든 것은 `core/App.js` 에 있습니다. 이 파일은 앱을 페이지에
 * 연결하고, 치명적인 부팅 오류를 사용자가 볼 수 있는 곳에 보고할 뿐입니다.
 */
const canvas = document.getElementById('viewport');

async function boot() {
  try {
    const app = new App(canvas);
    await app.load();

    // Handy for poking at the scene from the console.
    window.app = app;
  } catch (error) {
    console.error('[boot] failed to start', error);
    new LoadingScreen().fail(
      error?.message ? `시작 실패: ${error.message}` : '시작 실패 — 콘솔을 확인하세요.'
    );
  }
}

boot();
