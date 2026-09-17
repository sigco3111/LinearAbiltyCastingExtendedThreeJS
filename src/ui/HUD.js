import { ELEMENTS, ELEMENT_META } from '../config/settings.js';
import { ELEMENT_SIGILS } from './glyphs.js';

/**
 * 헤드업 디스플레이: 능력 바, 조작 안내, 실시간 통계, 토스트.
 *
 * 프레임워크 없이 그냥 DOM만 사용합니다. 바는 `ELEMENTS` 로부터 빌드되므로
 * 새 능력을 추가하면 자동으로 표시되고, 슬롯이 유일한 상호작용 영역이며
 * 키보드 단축키를 `onAbility` 로 그대로 미러링합니다.
 *
 * 쿨다운 차오름은 CSS 사용자 정의 속성으로 구동되는 `conic-gradient` 이므로,
 * 매 프레임 갱신은 `setProperty` 한 번 호출이고 레이아웃을 건드리지 않습니다.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.onAbility = null;
    this._toastTimer = 0;
    this._statsAccumulator = 0;
    this._frames = 0;
    this._fps = 0;
    /** Last sweep ratio pushed to the DOM, per element. */
    this._cooldownShown = new Map();
    this._armedShown = null;

    root.innerHTML = `
      <div class="hud__panel hud__title">
        원소 샌드박스
        <span data-blurb>Q, E, R, F, V, X, B, Z, N, K 중 하나를 누르고 조준한 뒤 클릭하여 시전하세요.</span>
      </div>

      <div class="hud__panel hud__stats">
        <div>FPS <b data-stat="fps">—</b></div>
        <div>파티클 <b data-stat="particles">0</b></div>
        <div>인스턴스 <b data-stat="spikes">0</b></div>
        <div>드로우 콜 <b data-stat="calls">0</b></div>
      </div>

      <div class="hud__panel hud__help">
        <div><strong>Q</strong> — 화산 공포 수호막 &nbsp; <strong>E</strong> — 부식 개화</div>
        <div><strong>R</strong> — 수목가의 성장 &nbsp; <strong>F</strong> — 사이버 서펜트</div>
        <div><strong>V</strong> — 결정화 맹독 쇄도</div>
        <div><strong>X</strong> — 브루탈 대지 폭발</div>
        <div><strong>B</strong> — 먹물 수역</div>
        <div><strong>Z</strong> — 성간 공허 폭발 &nbsp; <strong>N</strong> — 재앙의 연쇄 표식</div>
        <div><strong>K</strong> — 천열</div>
        <div class="hud__help-note">Q, E, R, B, Z, N, K는 원거리 시전 — 화살표가 아니라 원으로 조준합니다.</div>
        <div><strong>이동</strong> — 조준 &nbsp; <strong>왼쪽 클릭</strong> — 시전</div>
        <div><strong>Esc / 오른쪽 클릭</strong> — 시전 취소</div>
        <div><strong>오른쪽 드래그</strong> — 회전 &nbsp; <strong>스크롤</strong> — 줌</div>
        <div style="margin-top:6px">
          <kbd>G</kbd> 에디터 &nbsp; <kbd>P</kbd> 일시정지 &nbsp; <kbd>C</kbd> 지우기
        </div>
        <div><kbd>T</kbd> 표적 초기화 &nbsp; <kbd>H</kbd> 이 도움말 숨기기</div>
        <div class="hud__help-note">표적에 닿은 시전은 일격에 처치합니다.</div>
        <div class="hud__help-note">시간소환수는 스스로 고릅니다 — 반으로 가릅니다.</div>
        <div class="hud__help-note">수묵 조류도 스스로 고릅니다 — 물속으로 끌어들입니다.</div>
        <div class="hud__help-note">재앙의 연쇄도 마찬가지입니다 — 스스로 칼날을 던집니다.</div>
        <div class="hud__help-note">일시정지 중에도 에디터 변경은 바로 적용됩니다.</div>
      </div>

      <div class="hud__abilities">
        ${ELEMENTS.map((element) => {
          const meta = ELEMENT_META[element];
          return `
            <div class="ability-card" data-element="${element}" style="--accent:${meta.accent}">
              <div class="ability-card__sweep" data-sweep></div>
              <div class="ability-card__key">${meta.key}</div>
              <div class="ability-card__glyph">${ELEMENT_SIGILS[element] ?? ''}</div>
              <div class="ability-card__label">${meta.label}</div>
            </div>`;
        }).join('')}
      </div>

      <div class="hud__toast" data-toast></div>
      <div class="hud__paused" data-paused>일시정지됨</div>
    `;

    this.cards = new Map();
    for (const card of root.querySelectorAll('.ability-card')) {
      this.cards.set(card.dataset.element, card);
      card.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onAbility?.(card.dataset.element);
      });
    }

    this.stats = {
      fps: root.querySelector('[data-stat="fps"]'),
      particles: root.querySelector('[data-stat="particles"]'),
      spikes: root.querySelector('[data-stat="spikes"]'),
      calls: root.querySelector('[data-stat="calls"]')
    };
    this.help = root.querySelector('.hud__help');
    this.toast = root.querySelector('[data-toast]');
    this.pausedBadge = root.querySelector('[data-paused]');
    this.abilityBar = root.querySelector('.hud__abilities');
  }

  /** @param {{silent?: boolean}} [options] */
  setElement(element, options = {}) {
    for (const [key, card] of this.cards) {
      card.classList.toggle('is-active', key === element);
    }
    const meta = ELEMENT_META[element];
    if (meta && !options.silent) this.showToast(`${meta.hint} 선택됨`);
  }

  /** 시전 능력이 활성화되어 있는 동안 슬롯을 강조합니다. */
  setArmed(armed) {
    if (armed === this._armedShown) return;
    this._armedShown = armed;
    this.abilityBar.classList.toggle('is-armed', armed);
  }

  /**
   * 한 슬롯의 쿨다운 차오름을 구동합니다. 쿨다운은 능력별이므로
   * 능력마다 매 프레임 한 번씩 호출됩니다.
   *
   * @param {string} element
   * @param {number} remaining 남은 시간(초)
   * @param {number} total     전체 쿨다운(차오름 각도 기준)
   */
  setCooldown(element, remaining, total) {
    const card = this.cards.get(element);
    if (!card) return;

    const ratio = Math.max(0, Math.min(1, remaining / Math.max(total, 0.001)));
    // Only touch the DOM when the sweep visibly moves.
    if (Math.abs(ratio - (this._cooldownShown.get(element) ?? -1)) < 0.01) return;
    this._cooldownShown.set(element, ratio);
    card.style.setProperty('--cooldown', ratio);
    card.classList.toggle('is-cooling', ratio > 0.001);
  }

  setPaused(paused) {
    this.pausedBadge.classList.toggle('is-visible', paused);
  }

  toggleHelp() {
    this.help.classList.toggle('is-hidden');
  }

  showToast(message, duration = 1600) {
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), duration);
  }

  /**
   * @param {number} dt
   * @param {() => {particles:number, spikes:number, calls:number}} collect
   *   실제로 판독값이 갱신될 때만 호출되므로, 숫자 수집(파티클 풀 순회)이
   *   핫 패스에서 벗어나 있습니다.
   */
  update(dt, collect) {
    this._frames++;
    this._statsAccumulator += dt;
    if (this._statsAccumulator < 0.4) return;

    this._fps = Math.round(this._frames / this._statsAccumulator);
    this._frames = 0;
    this._statsAccumulator = 0;

    const info = collect();
    this.stats.fps.textContent = this._fps;
    this.stats.particles.textContent = info.particles;
    this.stats.spikes.textContent = info.spikes;
    this.stats.calls.textContent = info.calls;
  }
}

/** 부팅 화면 도우미. */
export class LoadingScreen {
  constructor() {
    this.element = document.getElementById('loader');
    this.fill = document.getElementById('loader-fill');
    this.status = document.getElementById('loader-status');
  }

  setProgress(ratio, message) {
    this.fill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    if (message) this.status.textContent = message;
  }

  hide() {
    this.setProgress(1);
    setTimeout(() => this.element.classList.add('is-hidden'), 220);
  }

  fail(message) {
    this.status.textContent = message;
    this.status.style.color = '#ff7a6a';
  }
}
