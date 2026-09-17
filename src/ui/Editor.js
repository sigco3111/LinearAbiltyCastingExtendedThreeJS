import GUI from 'lil-gui';
import { settings, CAST_ANIMATIONS } from '../config/settings.js';
import { PresetManager } from './PresetManager.js';

/**
 * Real-time VFX editor.
 *
 * Every control binds straight to a field in `config/settings.js`. Because all
 * shaders, particle systems, lights and post passes *read* those fields each
 * frame, no controller needs an onChange handler: moving a slider updates the
 * ward that is already standing, the serpent that is already in the air, the
 * next cast, the environment and the post stack simultaneously, with no rebuild
 * and no shader recompilation.
 *
 * That holds while the simulation is paused (`P`), which is the point — the
 * silhouette of a frozen eruption and the shape of a stopped serpent are the
 * things worth tuning, and both abilities re-resolve themselves from these
 * values on a zero-length frame.
 */
export class Editor {
  /**
   * @param {object} hooks { onClear, onToast }
   */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.presets = new PresetManager();

    this.gui = new GUI({ title: 'VFX 에디터', width: 330 });
    this.gui.domElement.style.setProperty('--title-height', '30px');

    this._presetState = { name: '내 프리셋', selected: this.presets.names[0] ?? '' };

    this._buildPresets();
    this._buildGlobal();
    this._buildAim();
    this._buildZone();
    this._buildWard();
    this._buildAcid();
    this._buildGrowth();
    this._buildCyber();
    this._buildVenom();
    this._buildQuake();
    this._buildInk();
    this._buildAstral();
    this._buildCascade();
    this._buildRend();
    this._buildEnvironment();
    this._buildPost();
    this._buildCamera();
    this._buildCharacter();
    this._buildDummies();

    // Everything starts collapsed, top-level folders included. There are enough
    // controls here that any folder left open pushes the rest off the screen,
    // so the panel opens as a list of sections and the user picks one.
    this.gui.foldersRecursive().forEach((folder) => folder.close());
  }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  static range(folder, object, key, min, max, step, label) {
    return folder.add(object, key, min, max, step).name(label ?? key);
  }

  /**
   * Which clip the body throws when this ability fires.
   *
   * One per ability, because the gesture is part of how a spell reads — the
   * ward and the serpent should not be cast the same way. `App` reads the value
   * at the moment of the cast, so switching it applies to the very next click.
   */
  static castAnimation(folder, object) {
    return folder.add(object, 'castAnim', CAST_ANIMATIONS).name('시전 애니메이션');
  }

  /**
   * The four colour stops of a particle system's lifetime gradient.
   *
   * `ParticleSystem#setGradient` samples them across a particle's own life, so
   * they are labelled by *when* they are seen rather than by what they are —
   * `A` is the instant it is born, `D` is the moment it dies.
   *
   * @param {string} prefix settings key without the A/B/C/D suffix
   */
  static gradient(folder, object, prefix, title) {
    const group = folder.addFolder(title);
    group.addColor(object, `${prefix}A`).name('탄생');
    group.addColor(object, `${prefix}B`).name('초반');
    group.addColor(object, `${prefix}C`).name('후반');
    group.addColor(object, `${prefix}D`).name('소멸');
    return group;
  }

  refresh() {
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  toggle() {
    this._hidden = !this._hidden;
    this.gui.show(!this._hidden);
  }

  /* ------------------------------------------------------------------ */
  /* folders                                                             */
  /* ------------------------------------------------------------------ */

  _buildPresets() {
    const folder = this.gui.addFolder('프리셋');
    const state = this._presetState;

    let selector = folder
      .add(state, 'selected', this.presets.names.length ? this.presets.names : [''])
      .name('프리셋');

    // lil-gui rebuilds the controller when the option list changes, so the
    // reference has to be replaced rather than mutated.
    const refreshOptions = () => {
      const names = this.presets.names;
      selector = selector.options(names.length ? names : ['']).name('프리셋');
      selector.setValue(names.includes(state.selected) ? state.selected : (names[0] ?? ''));
    };

    folder.add(state, 'name').name('이름');

    folder
      .add(
        {
          save: () => {
            this.presets.save(state.name);
            state.selected = state.name;
            refreshOptions();
            this.hooks.onToast?.(`프리셋 저장됨: "${state.name}"`);
          }
        },
        'save'
      )
      .name('프리셋 저장');

    folder
      .add(
        {
          load: () => {
            if (this.presets.load(state.selected)) {
              this.refresh();
              this.hooks.onToast?.(`불러옴: "${state.selected}"`);
            }
          }
        },
        'load'
      )
      .name('프리셋 불러오기');

    folder
      .add(
        {
          duplicate: () => {
            const copy = this.presets.duplicate(state.selected);
            if (copy) {
              state.selected = copy;
              refreshOptions();
              this.hooks.onToast?.(`복제됨: "${copy}"`);
            }
          }
        },
        'duplicate'
      )
      .name('복제');

    folder
      .add(
        {
          remove: () => {
            if (this.presets.remove(state.selected)) {
              refreshOptions();
              this.hooks.onToast?.('프리셋 삭제됨');
            }
          }
        },
        'remove'
      )
      .name('삭제');

    folder.add({ exportOne: () => this.presets.exportJSON() }, 'exportOne').name('현재 설정 내보내기 (JSON)');
    folder.add({ exportAll: () => this.presets.exportAll() }, 'exportAll').name('모든 프리셋 내보내기');

    folder
      .add(
        {
          import: async () => {
            const result = await this.presets.importFromFile();
            refreshOptions();
            this.refresh();
            this.hooks.onToast?.(
              result.applied
                ? '설정을 가져왔습니다'
                : result.imported.length
                  ? `${result.imported.length}개 프리셋을 가져왔습니다`
                  : '가져온 항목 없음'
            );
          }
        },
        'import'
      )
      .name('JSON 가져오기…');

    folder
      .add(
        {
          reset: () => {
            this.presets.reset();
            this.refresh();
            this.hooks.onToast?.('기본값으로 재설정됨');
          }
        },
        'reset'
      )
      .name('기본값으로 재설정');

    this.presetFolder = folder;
  }

  _buildGlobal() {
    const folder = this.gui.addFolder('전역');
    const g = settings.global;
    const R = Editor.range;

    R(folder, g, 'timeScale', 0.02, 2, 0.01, '시간 스케일');
    R(folder, g, 'speed', 0.1, 4, 0.01, '시전 속도');
    R(folder, g, 'lifetime', 0.1, 4, 0.01, '수명');
    R(folder, g, 'glow', 0, 5, 0.01, '발광 강도');
    R(folder, g, 'shaderIntensity', 0, 2, 0.01, '셰이더 강도');
    R(folder, g, 'opacity', 0, 2, 0.01, '불투명도');
    R(folder, g, 'noiseFrequency', 0.1, 4, 0.01, '노이즈 주파수');
    R(folder, g, 'noiseSpeed', 0, 4, 0.01, '노이즈 속도');
    R(folder, g, 'turbulence', 0, 4, 0.01, '난류');
    R(folder, g, 'randomness', 0, 2, 0.01, '무작위성');
    R(folder, g, 'fresnel', 0, 3, 0.01, '프레넬 강도');
    R(folder, g, 'distortion', 0, 3, 0.01, '열 왜곡');

    const particles = folder.addFolder('입자');
    R(particles, g, 'particleCount', 0, 3, 0.01, '개수');
    R(particles, g, 'particleLifetime', 0.1, 3, 0.01, '수명');
    R(particles, g, 'particleSpeed', 0.1, 3, 0.01, '속도');
    R(particles, g, 'particleSize', 0.1, 3, 0.01, '크기');
    R(particles, g, 'emissionRate', 0, 3, 0.01, '방출율');

    const lighting = folder.addFolder('조명과 충돌');
    R(lighting, g, 'lightIntensity', 0, 4, 0.01, '빛 강도');
    R(lighting, g, 'lightRadius', 0.1, 4, 0.01, '빛 반경');
    R(lighting, g, 'explosionIntensity', 0, 3, 0.01, '착탄 강도');
    R(lighting, g, 'cameraShake', 0, 3, 0.01, '카메라 흔들림');
    R(lighting, g, 'animationSpeed', 0, 3, 0.01, '애니메이션 속도');

    this.globalFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  _buildAim() {
    const folder = this.gui.addFolder('➤  조준 표시');
    const a = settings.aim;
    const R = Editor.range;

    const shape = folder.addFolder('실루엣(미터)');
    R(shape, a, 'shaftWidth', 0.05, 2, 0.01, '축 절반 너비');
    R(shape, a, 'headLength', 0.2, 8, 0.05, '선단 길이');
    R(shape, a, 'headWidth', 0.1, 5, 0.01, '선단 절반 너비');
    R(shape, a, 'round', 0, 0.6, 0.01, '모서리 둥글기');
    R(shape, a, 'startOffset', 0, 5, 0.05, '시전자 간격');
    R(shape, a, 'height', 0.005, 0.4, 0.005, '호버 높이');

    const look = folder.addFolder('렌더링');
    R(look, a, 'edge', 0.01, 0.5, 0.005, '외곽선 두께');
    R(look, a, 'edgeGlow', 0, 8, 0.05, '외곽선 발광');
    R(look, a, 'softness', 0.005, 0.5, 0.005, '가장자리 부드러움');
    R(look, a, 'fill', 0, 1.5, 0.01, '내부 채움');
    R(look, a, 'fillFalloff', 0.1, 4, 0.05, '채움 감쇠');
    R(look, a, 'opacity', 0, 2, 0.01, '불투명도');
    look.addColor(a, 'colorCore').name('중심 색상');
    look.addColor(a, 'colorEdge').name('가장자리 색상');
    look.addColor(a, 'colorInvalid').name('근접 색상');

    const energy = folder.addFolder('에너지와 서리');
    R(energy, a, 'stripes', 0, 4, 0.01, '미터당 셰브론');
    R(energy, a, 'stripeSharp', 0, 1, 0.01, '셰브론 선명도');
    R(energy, a, 'stripeDepth', 0, 1, 0.01, '셰브론 깊이');
    R(energy, a, 'scrollSpeed', -10, 10, 0.05, '스크롤 속도');
    R(energy, a, 'pulse', 0, 1, 0.01, '맥동');
    R(energy, a, 'pulseSpeed', 0, 8, 0.05, '맥동 속도');
    R(energy, a, 'noise', 0, 1.5, 0.01, '서리 노이즈');
    R(energy, a, 'noiseScale', 0.1, 8, 0.05, '노이즈 스케일');
    R(energy, a, 'noiseSpeed', 0, 3, 0.01, '노이즈 속도');
    R(energy, a, 'crystals', 0, 2, 0.01, '서리 판');
    R(energy, a, 'crystalScale', 0.2, 10, 0.05, '판 스케일');

    const furniture = folder.addFolder('고리와 로제트');
    R(furniture, a, 'baseRing', 0, 3, 0.01, '바닥 고리 반경');
    R(furniture, a, 'baseRingWidth', 0.005, 0.4, 0.005, '바닥 고리 너비');
    R(furniture, a, 'tipGlyph', 0, 2, 0.01, '끝 로제트');
    R(furniture, a, 'tipGlyphSize', 0.1, 4, 0.05, '로제트 반경');
    R(furniture, a, 'tipSpin', -3, 3, 0.01, '로제트 회전');
    R(furniture, a, 'rangeArc', 0, 2, 0.01, '사거리 호');
    R(furniture, a, 'reveal', 0.01, 1, 0.005, '쓸어냄 시간');
  }

  /* ------------------------------------------------------------------ */

  /**
   * The far-cast indicator — the circle every zone ability is aimed with.
   *
   * Shared, like the arrow: it is a property of the *targeting*, not of any one
   * ability, so a second far cast inherits the whole thing and brings only its
   * own `zoneRadius`. The two controls worth reaching for first are `boundary`
   * (how thick the footprint edge reads) and `snap` (how hard it overshoots on
   * the way out), which between them decide whether the circle feels like a UI
   * overlay or like something the caster is doing.
   */
  _buildZone() {
    const folder = this.gui.addFolder('◎  원거리 시전 원');
    const z = settings.zone;
    const R = Editor.range;

    const edge = folder.addFolder('경계(미터)');
    R(edge, z, 'boundary', 0.02, 2, 0.01, '띠 두께');
    R(edge, z, 'boundaryBias', 0, 1, 0.01, '띠 편향 바깥/안');
    R(edge, z, 'boundaryGlow', 0, 8, 0.05, '띠 발광');
    R(edge, z, 'liner', 0.005, 0.4, 0.005, '안쪽 라이너');
    R(edge, z, 'softness', 0.005, 0.4, 0.005, '가장자리 부드러움');
    R(edge, z, 'height', 0.005, 0.4, 0.005, '호버 높이');

    const inside = folder.addFolder('내부');
    R(inside, z, 'fill', 0, 1.5, 0.01, '내부 채움');
    R(inside, z, 'fillFalloff', 0.1, 5, 0.05, '채움 감쇠');
    R(inside, z, 'rings', 0, 12, 0.1, '등고선 고리');
    R(inside, z, 'ringWidth', 0.005, 0.5, 0.005, '고리 너비');
    R(inside, z, 'ringSpeed', -4, 4, 0.01, '고리 속도');
    R(inside, z, 'crawl', 0, 3, 0.01, '필라멘트');
    R(inside, z, 'crawlScale', 0.1, 8, 0.05, '미터당 필라멘트');
    R(inside, z, 'crawlSpeed', -4, 4, 0.01, '필라멘트 기어오름');
    R(inside, z, 'noise', 0, 1.5, 0.01, '분해');
    R(inside, z, 'noiseScale', 0.1, 8, 0.05, '분해 규모');

    const furniture = folder.addFolder('눈금·소인·조준선');
    R(furniture, z, 'ticks', 0, 96, 1, '경계 눈금');
    R(furniture, z, 'tickLength', 0.05, 3, 0.01, '틱 길이');
    R(furniture, z, 'tickWidth', 0.02, 0.9, 0.01, '틱 듀티');
    R(furniture, z, 'tickSpin', -2, 2, 0.005, '틱 회전');
    R(furniture, z, 'sweep', 0, 3, 0.01, '레이더 스윕');
    R(furniture, z, 'sweepSpeed', -3, 3, 0.01, '쓸기 속도');
    R(furniture, z, 'core', 0, 3, 0.01, '중심 표시');
    R(furniture, z, 'coreSize', 0.05, 3, 0.01, '중심 크기');
    R(furniture, z, 'crosshair', 0, 3, 0.01, '조준선 가지');
    R(furniture, z, 'crosshairLength', 0.1, 6, 0.05, '팔 길이');
    R(furniture, z, 'pulse', 0, 1, 0.01, '맥동');
    R(furniture, z, 'pulseSpeed', 0, 8, 0.05, '맥동 속도');

    const reach = folder.addFolder('도달 고리');
    R(reach, z, 'reach', 0, 3, 0.01, '도달 밝기');
    R(reach, z, 'reachWidth', 0.005, 0.5, 0.005, '도달 너비');
    R(reach, z, 'reachDashes', 0, 200, 1, '대시');
    R(reach, z, 'reachDashGap', 0, 0.95, 0.01, '대시 간격');
    R(reach, z, 'reachSpin', -1, 1, 0.005, '대시 크리프');
    R(reach, z, 'reachLead', 0, 3, 0.01, '선행 마커');

    const look = folder.addFolder('렌더링');
    R(look, z, 'opacity', 0, 2, 0.01, '불투명도');
    R(look, z, 'reveal', 0.01, 1, 0.005, '스냅아웃 시간');
    R(look, z, 'snap', 1, 2, 0.01, '스냅 오버슈트');
    look.addColor(z, 'colorCore').name('중심 색상');
    look.addColor(z, 'colorEdge').name('충전 색상');
    look.addColor(z, 'colorInvalid').name('근접 색상');
  }

  /* ------------------------------------------------------------------ */

  /**
   * The Volcanic Horror Ward.
   *
   * Grouped the way the reference sheet is: one folder per pass, in the order
   * you see them — the floor shatters, the obsidian comes up, the membrane
   * closes, the runes light, the flare fires. `The heartbeat` sits at the top
   * with the cast, because it is the one group that reaches into all of them:
   * drop `beatDepth` to zero and the ward flatlines, every pass at once.
   */
  _buildWard() {
    const folder = this.gui.addFolder('☣  화산 수호막');
    const c = settings.ward;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 0.5, 14, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 300, 1, '서지 속도');
    R(cast, c, 'sealTime', 0.02, 2, 0.01, '봉인 시간');
    R(cast, c, 'lifetime', 0.2, 16, 0.05, '유지 시간');
    R(cast, c, 'fadeTime', 0.05, 5, 0.01, '붕괴 시간');
    R(cast, c, 'cooldown', 0, 8, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    const beat = folder.addFolder('고동');
    R(beat, c, 'bpm', 20, 200, 1, '박자 / minute');
    R(beat, c, 'beatDepth', 0, 2, 0.01, '변조 깊이');
    R(beat, c, 'beatEmbers', 0, 400, 1, '박자당 불씨');
    R(beat, c, 'beatGore', 0, 80, 1, '박자당 물방울');
    R(beat, c, 'beatRing', 0, 2, 0.01, '고리 밝기');
    R(beat, c, 'beatFlare', 0, 2, 0.01, '플레어 재점화');
    R(beat, c, 'beatShake', 0, 0.6, 0.005, '카메라 쿵');

    const barrier = folder.addFolder('방벽');
    R(barrier, c, 'height', 0.5, 16, 0.05, '벽 높이');
    R(barrier, c, 'riseCurve', 0.2, 4, 0.01, '상승 곡선');
    R(barrier, c, 'bulge', -0.5, 0.8, 0.005, '허리 팽창');
    R(barrier, c, 'flare', -0.3, 0.8, 0.005, '가장자리 플레어');
    R(barrier, c, 'throb', 0, 0.4, 0.005, '박자 고동');
    R(barrier, c, 'density', 0, 1.5, 0.01, '막 불투명도');
    R(barrier, c, 'innerDensity', 0, 2, 0.01, '먼 벽 불투명도');
    R(barrier, c, 'innerGain', 0, 3, 0.01, '먼 벽 게인');
    R(barrier, c, 'fresnel', 0.2, 6, 0.05, '가장자리 감쇠');
    R(barrier, c, 'fresnelGain', 0, 5, 0.01, '가장자리 게인');
    R(barrier, c, 'rimTop', 0, 0.5, 0.005, '가장자리 고리');
    R(barrier, c, 'rimBase', 0, 0.5, 0.005, '바닥 고리');
    R(barrier, c, 'rimGlow', 0, 8, 0.05, '고리 발광');
    R(barrier, c, 'swirl', -3, 3, 0.01, '높이에 따른 전단');
    R(barrier, c, 'spin', -2, 2, 0.005, '벽 회전');
    R(barrier, c, 'crest', 0, 6, 0.01, '닫힘 가장자리');
    R(barrier, c, 'dissolveEdge', 0.02, 1, 0.01, '찢김 너비');
    R(barrier, c, 'softFade', 0.02, 3, 0.01, '부드러운 교차');
    R(barrier, c, 'barrierGlow', 0, 6, 0.01, '발광');
    R(barrier, c, 'opacity', 0, 2, 0.01, '불투명도');

    const blood = folder.addFolder('벽의 혈흔');
    R(blood, c, 'flowScale', 0.05, 6, 0.01, '미터당 흐름');
    R(blood, c, 'flowStretch', 0.02, 2, 0.01, '수직 늘어남');
    R(blood, c, 'flowSpeed', -4, 4, 0.01, '이동 속도');
    R(blood, c, 'flowSharp', 0, 1, 0.01, '이동 선명도');
    R(blood, c, 'flowGain', 0, 4, 0.01, '이동 게인');
    R(blood, c, 'warp', 0, 2, 0.01, '도메인 뒤틀림');
    R(blood, c, 'cells', 0, 2, 0.01, '막 세포');
    R(blood, c, 'cellScale', 0.1, 8, 0.05, '미터당 셀');
    R(blood, c, 'bands', 0, 12, 0.05, '압력 고리');
    R(blood, c, 'bandSpeed', -4, 4, 0.01, '고리 속도');
    R(blood, c, 'bandWidth', 0.01, 1, 0.01, '고리 부드러움');
    blood.addColor(c, 'colorMembrane').name('막');
    blood.addColor(c, 'colorFlow').name('피');
    blood.addColor(c, 'colorRim').name('고리');
    blood.addColor(c, 'colorDeep').name('먼 벽');

    const runes = folder.addFolder('룬 띠');
    R(runes, c, 'runes', 1, 90, 1, '글리프');
    R(runes, c, 'runeSize', 0.05, 2, 0.01, '띠 높이');
    R(runes, c, 'runeInset', -0.3, 0.6, 0.005, '이격');
    R(runes, c, 'runeWeight', 0.005, 0.25, 0.001, '획 굵기');
    R(runes, c, 'runeStrokes', 0, 1, 0.01, '유지 획 수');
    R(runes, c, 'runeSpin', -1, 1, 0.005, '고리 회전');
    R(runes, c, 'runeSweep', 0, 3, 0.01, '읽기 헤드');
    R(runes, c, 'runeSweepSpeed', -2, 2, 0.005, '선단 속도');
    R(runes, c, 'runeSweepWidth', 0.01, 0.5, 0.005, '선단 너비');
    R(runes, c, 'runeFlicker', 0, 1, 0.01, '글리프 끊김');
    R(runes, c, 'runeHalo', 0, 2, 0.01, '후광');
    R(runes, c, 'runeGlow', 0, 8, 0.05, '발광');
    R(runes, c, 'runeBase', 0, 2, 0.01, '바닥 띠');
    R(runes, c, 'runeTop', 0, 2, 0.01, '가장자리 띠');
    runes.addColor(c, 'colorRune').name('룬');
    runes.addColor(c, 'colorRuneCore').name('룬 중심');

    const stones = folder.addFolder('모놀리스');
    R(stones, c, 'monoliths', 0, 24, 1, '슬래브');
    R(stones, c, 'monolithRing', 0, 1.2, 0.005, '위치, × 범위');
    R(stones, c, 'monolithJitter', 0, 0.8, 0.005, '방사 분산');
    R(stones, c, 'monolithSpread', 0, 2, 0.01, '방향 산란');
    R(stones, c, 'monolithHeight', 0.2, 8, 0.05, '높이');
    R(stones, c, 'monolithHeightJitter', 0, 1, 0.01, '높이 편차');
    R(stones, c, 'monolithWidth', 0.05, 3, 0.01, '너비');
    R(stones, c, 'monolithThin', 0.05, 1.5, 0.01, '슬래브 평탄도');
    R(stones, c, 'monolithLean', -0.8, 0.8, 0.005, '바깥 기울기');
    R(stones, c, 'monolithSweep', 0.02, 2, 0.01, '쓸기 시간');
    R(stones, c, 'rubble', 0, 32, 1, '잔해');
    R(stones, c, 'rubbleHeight', 0.05, 3, 0.01, '잔해 높이');
    R(stones, c, 'rubbleRing', 0, 1.4, 0.005, '잔해 위치');

    const glass = folder.addFolder('흑요석과 내부 광맥');
    R(glass, c, 'veinScale', 0.1, 8, 0.05, '맥 스케일');
    R(glass, c, 'veinWidth', 0.005, 0.4, 0.001, '맥 너비');
    R(glass, c, 'veinBranches', 0.05, 2, 0.01, '가지 세부');
    R(glass, c, 'veinDepth', 0, 1.2, 0.005, '표면하 깊이');
    R(glass, c, 'veinGlow', 0, 10, 0.05, '맥 발광');
    R(glass, c, 'veinFlow', 0, 1, 0.01, '용융 이동');
    R(glass, c, 'veinFlowSpeed', 0, 5, 0.01, '기어감 속도');
    R(glass, c, 'veinFlash', 0, 8, 0.05, '섬광 게인');
    R(glass, c, 'flashSpeed', 0, 20, 0.05, '섬광 상승, m/s');
    R(glass, c, 'flashWidth', 0.05, 5, 0.05, '섬광 너비');
    R(glass, c, 'glassRough', 0.02, 1, 0.01, '거칠기');
    R(glass, c, 'facetTint', 0, 1.5, 0.01, '패싯 분해');
    R(glass, c, 'cavity', 0, 1, 0.01, '공동');
    R(glass, c, 'rimLight', 0, 3, 0.01, '가장자리 열');
    R(glass, c, 'envIntensity', 0, 3, 0.01, '반사');
    R(glass, c, 'obsidianGlow', 0, 4, 0.01, '발광');
    glass.addColor(c, 'colorObsidian').name('유리');
    glass.addColor(c, 'colorObsidianChar').name('그을림');
    glass.addColor(c, 'colorVein').name('광맥');
    glass.addColor(c, 'colorVeinCore').name('광맥 중심');

    const floor = folder.addFolder('바닥');
    R(floor, c, 'fieldPlates', 0.1, 6, 0.01, '미터당 판');
    R(floor, c, 'fieldRadial', 0, 1, 0.01, '방사 파괴');
    R(floor, c, 'fieldWarp', 0, 2, 0.01, '도메인 뒤틀림');
    R(floor, c, 'fieldSeam', 0.005, 0.4, 0.001, '틈새 너비');
    R(floor, c, 'fieldSeamGlow', 0, 10, 0.05, '틈새 발광');
    R(floor, c, 'fieldCrust', 0, 1, 0.01, '크러스트 불투명도');
    R(floor, c, 'fieldRelief', 0, 3, 0.01, '판 부조');
    R(floor, c, 'fieldHeat', 0, 4, 0.01, '용융 열');
    R(floor, c, 'fieldHeatFalloff', 0.1, 5, 0.05, '열 감쇠');
    R(floor, c, 'fieldCool', 0, 1, 0.01, '수명 냉각');
    R(floor, c, 'fieldFlow', -3, 3, 0.01, '용융 이동');
    R(floor, c, 'fieldEmber', 0, 3, 0.01, '틈새 반점');
    R(floor, c, 'fieldEmberScale', 0.5, 14, 0.1, '반점 스케일');
    R(floor, c, 'fieldBoundary', 0.01, 1.5, 0.005, '경계 띠');
    R(floor, c, 'fieldBoundaryGlow', 0, 8, 0.05, '띠 발광');
    R(floor, c, 'fieldCore', 0, 5, 0.01, '중심 웅덩이');
    R(floor, c, 'fieldCoreSize', 0.02, 1, 0.005, '웅덩이 크기');
    R(floor, c, 'fieldRings', 0, 10, 0.05, '압력 고리');
    R(floor, c, 'fieldRingSpeed', -5, 5, 0.01, '고리 속도');
    R(floor, c, 'fieldOpacity', 0, 2, 0.01, '불투명도');
    R(floor, c, 'fieldHeight', 0.005, 0.3, 0.002, '호버 높이');
    floor.addColor(c, 'colorCrust').name('지각');
    floor.addColor(c, 'colorPlate').name('판');
    floor.addColor(c, 'colorMagma').name('마그마');
    floor.addColor(c, 'colorMagmaHot').name('마그마 중심');
    floor.addColor(c, 'colorFieldEdge').name('띠와 못');

    const flare = folder.addFolder('코어 플레어');
    R(flare, c, 'flareSize', 0.2, 14, 0.05, '크기');
    R(flare, c, 'flareHeight', 0, 8, 0.01, '바닥 위 높이');
    R(flare, c, 'flareBase', 0, 3, 0.01, '정립 밝기');
    R(flare, c, 'flareCore', 0, 6, 0.01, '코어');
    R(flare, c, 'flareStreak', 0, 5, 0.01, '줄무늬 길이');
    R(flare, c, 'flareStreakWidth', 0.005, 0.4, 0.001, '줄무늬 너비');
    R(flare, c, 'flareSpikes', 2, 16, 1, '별폭발 꼭짓점');
    R(flare, c, 'flareSpikeGain', 0, 3, 0.01, '별폭발 게인');
    R(flare, c, 'flareSpikeSharp', 2, 80, 0.5, '별폭발 선예도');
    R(flare, c, 'flareGhosts', 0, 2, 0.01, '잔상');
    R(flare, c, 'flareSpin', -1, 1, 0.005, '회전');
    R(flare, c, 'shockWidth', 0.005, 0.4, 0.001, '충격 고리 너비');
    R(flare, c, 'shockSpeed', 0.2, 10, 0.05, '충격 고리 속도');
    R(flare, c, 'flareOpacity', 0, 2, 0.01, '불투명도');
    flare.addColor(c, 'colorFlareCore').name('코어');
    flare.addColor(c, 'colorFlareStreak').name('줄무늬');
    flare.addColor(c, 'colorFlareGhost').name('잔상');

    const haze = folder.addFolder('열기 아지랑이');
    R(haze, c, 'hazeStrength', 0, 4, 0.01, '강도');
    R(haze, c, 'hazeScale', 0.1, 8, 0.05, '스케일');
    R(haze, c, 'hazeSpeed', 0, 6, 0.01, '상승 속도');
    R(haze, c, 'hazeHeight', 0.1, 3, 0.01, '높이, × 벽');
    R(haze, c, 'hazeWidth', 0.1, 3, 0.01, '너비(×범위)');
    R(haze, c, 'hazeFalloff', 0.1, 4, 0.01, '감쇠');

    const embers = folder.addFolder('불씨와 재');
    R(embers, c, 'emberRate', 0, 1200, 1, '불씨 비율');
    R(embers, c, 'emberSize', 0.005, 0.5, 0.005, '불씨 크기');
    R(embers, c, 'emberSpeed', 0, 25, 0.1, '불씨 속도');
    R(embers, c, 'emberLifetime', 0.1, 8, 0.05, '불씨 수명');
    R(embers, c, 'emberRise', -5, 20, 0.1, '상승');
    R(embers, c, 'emberTurbulence', 0, 4, 0.01, '소용돌이');
    R(embers, c, 'emberInset', 0, 0.95, 0.01, '픽업 인셋');
    Editor.gradient(embers, c, 'colorEmber', '불씨 색상');
    R(embers, c, 'fleckRate', 0, 300, 1, '반점 발생률');
    R(embers, c, 'fleckSize', 0.005, 0.4, 0.005, '반점 크기');
    R(embers, c, 'fleckSpeed', 0, 25, 0.1, '반점 속도');
    R(embers, c, 'fleckLifetime', 0.1, 6, 0.05, '반점 수명');
    R(embers, c, 'fleckGravity', -40, 5, 0.1, '반점 중력');
    Editor.gradient(embers, c, 'colorFleck', '반점 색상');

    const gore = folder.addFolder('혈흔과 연기');
    R(gore, c, 'goreRate', 0, 400, 1, '혈흔 발생률');
    R(gore, c, 'goreSize', 0.005, 0.6, 0.005, '물방울 크기');
    R(gore, c, 'goreSpeed', 0, 30, 0.1, '물방울 속도');
    R(gore, c, 'goreLifetime', 0.1, 5, 0.05, '물방울 수명');
    R(gore, c, 'goreGravity', -50, 0, 0.1, '중력');
    R(gore, c, 'goreOpacity', 0, 1.5, 0.01, '불투명도');
    Editor.gradient(gore, c, 'colorGore', '혈흔 색상');
    R(gore, c, 'smokeRate', 0, 500, 1, '연기 발생량');
    R(gore, c, 'smokeSize', 0.05, 4, 0.01, '연기 크기');
    R(gore, c, 'smokeSpeed', 0, 8, 0.05, '연기 속도');
    R(gore, c, 'smokeLifetime', 0.2, 8, 0.05, '연기 수명');
    R(gore, c, 'smokeOpacity', 0, 1, 0.005, '연기 불투명도');
    R(gore, c, 'smokeRise', -2, 4, 0.01, '연기 상승');
    Editor.gradient(gore, c, 'colorSmoke', '연기 색상');

    const ground = folder.addFolder('지면 표식');
    R(ground, c, 'scorchRadius', 0.05, 10, 0.05, '그을음 반경');
    R(ground, c, 'scorchLife', 0.5, 20, 0.1, '그을음 수명');
    R(ground, c, 'scorchIntensity', 0, 2, 0.01, '그을음 강도');
    R(ground, c, 'splatRate', 0, 30, 0.1, '초당 혈흔 자국');
    R(ground, c, 'splatRadius', 0.05, 4, 0.05, '자국 반경');
    R(ground, c, 'splatLife', 0.2, 15, 0.1, '자국 수명');
    R(ground, c, 'splatIntensity', 0, 2, 0.01, '자국 강도');
    R(ground, c, 'trailRate', 0.05, 8, 0.05, 'm당 서지 자국');
    R(ground, c, 'shockRadius', 0.5, 25, 0.1, '봉인 고리 반경');
    R(ground, c, 'ringRate', 0, 12, 0.1, '초당 먼지 고리');
    ground.addColor(c, 'colorScorch').name('그을음');
    ground.addColor(c, 'colorSplat').name('혈흔 표식');
    ground.addColor(c, 'colorSplatEdge').name('표식 가장자리');
    ground.addColor(c, 'colorShockA').name('충격파 고리');
    ground.addColor(c, 'colorShockB').name('충격파 마루');

    const impact = folder.addFolder('던지기·봉인·유지');
    R(impact, c, 'handHeight', 0, 3, 0.01, '손 높이');
    R(impact, c, 'handForward', -1, 3, 0.01, '손 전방');
    R(impact, c, 'handSide', -1.5, 1.5, 0.01, '손 측면');
    R(impact, c, 'muzzleSize', 0.05, 6, 0.05, '총구 크기');
    R(impact, c, 'muzzleIntensity', 0, 5, 0.01, '총구 강도');
    R(impact, c, 'castFlash', 0, 2, 0.01, '해제 시 섬광');
    R(impact, c, 'burstSize', 0.2, 14, 0.05, '봉인 외피 크기');
    R(impact, c, 'burstIntensity', 0, 5, 0.01, '봉인 외피 강도');
    R(impact, c, 'sealEmbers', 0, 900, 1, '봉인 불씨');
    R(impact, c, 'sealGore', 0, 600, 1, '봉인 혈흔');
    R(impact, c, 'sealFlecks', 0, 400, 1, '봉인 반점');
    R(impact, c, 'sealShake', 0, 3, 0.01, '봉인 흔들림');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, '흔들림 지속시간');
    R(impact, c, 'sealFlash', 0, 2, 0.01, '봉인 섬광');
    R(impact, c, 'holdShake', 0, 0.5, 0.005, '유지 진동');
    R(impact, c, 'rumble', 0, 0.5, 0.005, '서지 럼블');
    impact.addColor(c, 'colorBurstA').name('껍질 안쪽');
    impact.addColor(c, 'colorBurstB').name('껍질 중간');
    impact.addColor(c, 'colorBurstC').name('껍질 중심');
    impact.addColor(c, 'colorCastFlash').name('해제 섬광');
    impact.addColor(c, 'colorFlash').name('봉인 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 120, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 50, 0.1, '빛 반경');
    R(light, c, 'lightHeight', 0, 1, 0.01, '벽 상부 높이');
    R(light, c, 'lightBeat', 0, 1, 0.01, '박동 종속');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.wardFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * The Caustic Bloom.
   *
   * Grouped the way the reference sheet is: one folder per pass, in the order
   * you see them — the floor dissolves, the ring snaps out, the gas climbs, the
   * bubbles come off it, the air warps. `The boil` sits at the top with the
   * cast, because it is the one group that reaches into all of them: drop
   * `boilDepth` to zero and the aura goes inert, every pass at once.
   *
   * `mist steps` is the performance dial. It is a live slider on purpose — the
   * same build has to run on a laptop and on the machine driving the projector.
   */
  _buildAcid() {
    const folder = this.gui.addFolder('☣  부식 개화');
    const c = settings.acid;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 0.5, 14, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 300, 1, '부식 속도');
    R(cast, c, 'bloomTime', 0.02, 2, 0.01, '블룸 시간');
    R(cast, c, 'lifetime', 0.2, 16, 0.05, '유지 시간');
    R(cast, c, 'fadeTime', 0.05, 5, 0.01, '비활성 시간');
    R(cast, c, 'cooldown', 0, 8, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    const boil = folder.addFolder('끓음');
    R(boil, c, 'boilRate', 0.05, 8, 0.05, '엔벨로프 속도');
    R(boil, c, 'boilSharp', 0.2, 8, 0.05, '서지 선예도');
    R(boil, c, 'boilDepth', 0, 2, 0.01, '변조 깊이');
    R(boil, c, 'boilThreshold', 0.05, 0.98, 0.01, '배출 임계값');
    R(boil, c, 'goutBubbles', 0, 300, 1, '통풍구당 거품');
    R(boil, c, 'goutMotes', 0, 500, 1, '통풍구당 부유 입자');
    R(boil, c, 'goutLift', 0.2, 5, 0.05, '배출 상승');
    R(boil, c, 'goutRing', 0, 2, 0.01, '고리 밝기');
    R(boil, c, 'goutShake', 0, 0.6, 0.005, '카메라 충격');

    const pool = folder.addFolder('산성 웅덩이');
    R(pool, c, 'poolPlates', 0.1, 6, 0.01, '미터당 판');
    R(pool, c, 'poolCraze', 0, 1.5, 0.01, '미세 균열');
    R(pool, c, 'poolWarp', 0, 2, 0.01, '도메인 뒤틀림');
    R(pool, c, 'poolSeam', 0.005, 0.4, 0.001, '채널 너비');
    R(pool, c, 'poolSeamGlow', 0, 10, 0.05, '채널 발광');
    R(pool, c, 'poolCrust', 0, 1, 0.01, '크러스트 불투명도');
    R(pool, c, 'poolRelief', 0, 3, 0.01, '판 부조');
    R(pool, c, 'poolSheen', 0, 4, 0.01, '젖은 광택');
    R(pool, c, 'poolGloss', 0, 1, 0.01, '광택 밀집도');
    R(pool, c, 'poolEtch', 0, 2, 0.01, '가장자리 갉음');
    R(pool, c, 'poolEtchScale', 0.1, 8, 0.05, '갉음 규모');
    R(pool, c, 'poolPits', 0, 1, 0.01, '뚫린 판');
    R(pool, c, 'poolPitScale', 0.1, 8, 0.05, '미터당 구덩이');
    R(pool, c, 'poolBoilRate', 0, 4, 0.01, '표면 기포');
    R(pool, c, 'poolHeat', 0, 4, 0.01, '산성 밝기');
    R(pool, c, 'poolHeatFalloff', 0.1, 5, 0.05, '밝기 감쇠');
    R(pool, c, 'poolSpend', 0, 1, 0.01, '수명 소진');
    R(pool, c, 'poolFlow', -3, 3, 0.01, '채널 기어감');
    R(pool, c, 'poolCaustic', 0, 3, 0.01, '코스틱');
    R(pool, c, 'poolCausticScale', 0.1, 8, 0.05, '코스틱 규모');
    R(pool, c, 'poolBoundary', 0.01, 1.5, 0.005, '경계 띠');
    R(pool, c, 'poolBoundaryGlow', 0, 8, 0.05, '띠 발광');
    R(pool, c, 'poolCore', 0, 5, 0.01, '중심 웅덩이');
    R(pool, c, 'poolCoreSize', 0.02, 1, 0.005, '웅덩이 크기');
    R(pool, c, 'poolRings', 0, 10, 0.05, '압력 고리');
    R(pool, c, 'poolRingSpeed', -5, 5, 0.01, '고리 속도');
    R(pool, c, 'poolOpacity', 0, 2, 0.01, '불투명도');
    R(pool, c, 'poolHeight', 0.005, 0.3, 0.002, '호버 높이');
    pool.addColor(c, 'colorSludge').name('찌꺼기');
    pool.addColor(c, 'colorPlate').name('판');
    pool.addColor(c, 'colorAcid').name('산');
    pool.addColor(c, 'colorAcidHot').name('산 중심');
    pool.addColor(c, 'colorPoolEdge').name('띠와 못');

    const mist = folder.addFolder('독성 안개');
    R(mist, c, 'mistSteps', 6, 64, 1, '안개 단계 (cost)');
    R(mist, c, 'mistHeight', 0.5, 16, 0.05, '기둥 높이');
    R(mist, c, 'riseCurve', 0.2, 4, 0.01, '상승 곡선');
    R(mist, c, 'mistDensity', 0, 6, 0.01, '밀도');
    R(mist, c, 'mistAbsorb', 0.05, 6, 0.01, '흡수');
    R(mist, c, 'mistScale', 0.05, 2, 0.005, '미터당 형상');
    R(mist, c, 'mistDetail', 0.2, 6, 0.05, '필라멘트 스케일');
    R(mist, c, 'mistFilament', 0, 1, 0.01, '필라멘트 대 연기구름');
    R(mist, c, 'mistThreshold', 0, 0.9, 0.01, '조각 임계값');
    R(mist, c, 'mistRise', -3, 3, 0.01, '상승 속도');
    R(mist, c, 'mistStretch', 0.05, 1.5, 0.01, '수직 늘어남');
    R(mist, c, 'mistTwist', -6, 6, 0.05, '와류 비틀림');
    R(mist, c, 'mistSpin', -1, 1, 0.005, '기둥 회전');
    R(mist, c, 'mistEdge', 0, 1, 0.01, '벽 부드러움');
    R(mist, c, 'mistFlare', -0.4, 1.5, 0.01, '굴뚝 플레어');
    R(mist, c, 'mistFalloff', 0.1, 5, 0.01, '높이에 따른 가늘어짐');
    R(mist, c, 'mistSkirt', 0, 1, 0.01, '가장자리 초과 유출');
    R(mist, c, 'mistLobe', 0, 1, 0.01, '벽 방황');
    R(mist, c, 'mistTear', 0, 0.6, 0.005, '크라운 찢김');
    R(mist, c, 'mistGroundGlow', 0, 6, 0.01, '웅덩이 발광');
    R(mist, c, 'mistGroundFalloff', 0.05, 3, 0.01, '빛 감쇠');
    R(mist, c, 'mistShadow', 0, 8, 0.05, '셀프 섀도');
    R(mist, c, 'mistShadowStep', 0.05, 4, 0.05, '섀도 탭 (m)');
    R(mist, c, 'mistAmbient', 0, 1, 0.005, '주변광');
    R(mist, c, 'mistSaturate', 0, 5, 0.01, '밀도 깊어짐');
    R(mist, c, 'mistOpacity', 0, 2, 0.01, '불투명도');
    R(mist, c, 'mistGlow', 0, 4, 0.01, '발광');
    mist.addColor(c, 'colorMistDeep').name('짙은 기체');
    mist.addColor(c, 'colorMistBody').name('몸통');
    mist.addColor(c, 'colorMistEdge').name('옅은 기체');
    mist.addColor(c, 'colorMistLight').name('통과하는 햇빛');

    const ring = folder.addFolder('기저 고리');
    R(ring, c, 'ringInset', -1, 1.5, 0.005, '이격');
    R(ring, c, 'ringHeight', 0.005, 0.3, 0.002, '호버 높이');
    R(ring, c, 'ringWidth', 0.005, 0.5, 0.001, '코어 너비');
    R(ring, c, 'ringCore', 0, 8, 0.01, '코어 밝기');
    R(ring, c, 'ringHalo', 0, 4, 0.01, '후광');
    R(ring, c, 'ringHaloWidth', 0.02, 3, 0.01, '후광 너비');
    R(ring, c, 'ringSpill', 0, 1.5, 0.01, '내향 유출');
    R(ring, c, 'ringWobble', 0, 0.25, 0.001, '반경 배회');
    R(ring, c, 'ringWobbleScale', 0.2, 10, 0.05, '방황 스케일');
    R(ring, c, 'ringChevrons', 0, 120, 1, '셰브론');
    R(ring, c, 'ringChevronDepth', 0, 1, 0.01, '셰브론 깊이');
    R(ring, c, 'ringScroll', -1, 1, 0.005, '셰브론 스크롤');
    R(ring, c, 'ringSweep', 0, 4, 0.01, '읽기 헤드');
    R(ring, c, 'ringSweepSpeed', -2, 2, 0.005, '선단 속도');
    R(ring, c, 'ringSweepWidth', 0.01, 0.6, 0.005, '선단 너비');
    R(ring, c, 'ringTicks', 0, 24, 1, '나침반 눈금');
    R(ring, c, 'ringOpacity', 0, 2, 0.01, '불투명도');
    R(ring, c, 'ringGlow', 0, 6, 0.01, '발광');
    R(ring, c, 'collarHeight', 0, 3, 0.01, '칼라 높이');
    R(ring, c, 'collarGain', 0, 5, 0.01, '칼라 이득');
    R(ring, c, 'collarFalloff', 0.2, 6, 0.01, '칼라 감쇠');
    R(ring, c, 'collarFresnel', 0.2, 6, 0.05, '칼라 테두리');
    R(ring, c, 'collarStreaks', 2, 90, 1, '칼라 줄무늬');
    R(ring, c, 'collarStreakDepth', 0, 1, 0.01, '줄무늬 깊이');
    R(ring, c, 'collarStreakSpeed', -4, 4, 0.01, '줄무늬 속도');
    R(ring, c, 'collarSoftFade', 0.02, 3, 0.01, '부드러운 교차');
    R(ring, c, 'collarOpacity', 0, 2, 0.01, '칼라 불투명도');
    ring.addColor(c, 'colorRing').name('고리');
    ring.addColor(c, 'colorRingCore').name('고리 중심');

    const fume = folder.addFolder('부식성 아지랑이');
    R(fume, c, 'fumeStrength', 0, 4, 0.01, '강도');
    R(fume, c, 'fumeScale', 0.1, 8, 0.05, '스케일');
    R(fume, c, 'fumeSpeed', 0, 6, 0.01, '상승 속도');
    R(fume, c, 'fumeSwirl', -2, 2, 0.01, '높이에 따른 롤');
    R(fume, c, 'fumeHeight', 0.1, 3, 0.01, '높이, × 기둥');
    R(fume, c, 'fumeWidth', 0.1, 3, 0.01, '너비(×범위)');
    R(fume, c, 'fumeFalloff', 0.1, 4, 0.01, '감쇠');

    const bubbles = folder.addFolder('거품과 먼지');
    R(bubbles, c, 'bubbleRate', 0, 300, 1, '거품 비율');
    R(bubbles, c, 'bubbleSize', 0.01, 1.2, 0.005, '거품 크기');
    R(bubbles, c, 'bubbleSpeed', 0, 15, 0.05, '거품 속도');
    R(bubbles, c, 'bubbleLifetime', 0.1, 8, 0.05, '거품 수명');
    R(bubbles, c, 'bubbleRise', -5, 12, 0.05, '부력');
    R(bubbles, c, 'bubbleTurbulence', 0, 3, 0.01, '방황');
    R(bubbles, c, 'bubbleGrow', 0.5, 5, 0.05, '폭발 전 성장');
    R(bubbles, c, 'bubbleInset', 0, 0.95, 0.01, '픽업 인셋');
    R(bubbles, c, 'bubbleOpacity', 0, 1.5, 0.01, '거품 불투명도');
    Editor.gradient(bubbles, c, 'colorBubble', '거품 색상');
    R(bubbles, c, 'moteRate', 0, 900, 1, '부유 입자 비율');
    R(bubbles, c, 'moteSize', 0.005, 0.4, 0.005, '부유 입자 크기');
    R(bubbles, c, 'moteSpeed', 0, 20, 0.1, '부유 입자 속도');
    R(bubbles, c, 'moteLifetime', 0.1, 6, 0.05, '부유 입자 수명');
    R(bubbles, c, 'moteRise', -5, 15, 0.1, '상승');
    R(bubbles, c, 'moteTurbulence', 0, 4, 0.01, '소용돌이');
    Editor.gradient(bubbles, c, 'colorMote', '먼지 색상');

    const spill = folder.addFolder('안개와 튐');
    R(spill, c, 'fogRate', 0, 400, 1, '안개 발생률');
    R(spill, c, 'fogSize', 0.05, 4, 0.01, '안개 크기');
    R(spill, c, 'fogSpeed', 0, 8, 0.05, '안개 속도');
    R(spill, c, 'fogLifetime', 0.2, 8, 0.05, '안개 수명');
    R(spill, c, 'fogOpacity', 0, 1, 0.005, '안개 불투명도');
    R(spill, c, 'fogRise', -2, 4, 0.01, '안개 상승');
    R(spill, c, 'fogSpread', 0, 3, 0.01, '바깥쪽 밀기');
    Editor.gradient(spill, c, 'colorFog', '안개 색상');
    R(spill, c, 'splashRate', 0, 200, 1, '튀김 발생량');
    R(spill, c, 'splashSize', 0.005, 0.5, 0.005, '물방울 크기');
    R(spill, c, 'splashSpeed', 0, 25, 0.1, '물방울 속도');
    R(spill, c, 'splashLifetime', 0.1, 5, 0.05, '물방울 수명');
    R(spill, c, 'splashGravity', -50, 0, 0.1, '중력');
    R(spill, c, 'splashOpacity', 0, 1.5, 0.01, '불투명도');
    Editor.gradient(spill, c, 'colorSplash', '튐 색상');

    const ground = folder.addFolder('지면 표식');
    R(ground, c, 'etchRadius', 0.05, 10, 0.05, '에칭 반경');
    R(ground, c, 'etchLife', 0.5, 20, 0.1, '에칭 수명');
    R(ground, c, 'etchIntensity', 0, 2, 0.01, '에칭 강도');
    R(ground, c, 'stainRate', 0, 30, 0.1, '초당 얼룩');
    R(ground, c, 'stainRadius', 0.05, 4, 0.05, '얼룩 반경');
    R(ground, c, 'stainLife', 0.2, 15, 0.1, '얼룩 수명');
    R(ground, c, 'stainIntensity', 0, 2, 0.01, '얼룩 강도');
    R(ground, c, 'trailRate', 0.05, 8, 0.05, '미터당 크리프 자국');
    R(ground, c, 'shockRadius', 0.5, 25, 0.1, '블룸 고리 반경');
    R(ground, c, 'ringRate', 0, 12, 0.1, '초당 증기 고리');
    ground.addColor(c, 'colorEtch').name('식각');
    ground.addColor(c, 'colorStain').name('얼룩');
    ground.addColor(c, 'colorStainEdge').name('얼룩 가장자리');
    ground.addColor(c, 'colorShockA').name('충격파 고리');
    ground.addColor(c, 'colorShockB').name('충격파 마루');

    // The only ability that dissolves what it catches instead of throwing it.
    // The three blow sliders are at zero and are meant to stay there — they are
    // here so the difference can be heard by turning them up.
    const melt = folder.addFolder('용해 대상');
    const mc = c.melt;
    melt.add(mc, 'enabled').name('몸 용해');
    R(melt, mc, 'reach', 0.2, 3, 0.01, '섭식 범위, x 범위');
    R(melt, mc, 'onset', 0, 4, 0.01, '살 뒤따름');
    R(melt, mc, 'rate', 0.05, 6, 0.01, '초당 소모 몸통');
    R(melt, mc, 'boil', 0, 1, 0.01, '비등 종속');
    R(melt, mc, 'stain', 0.1, 8, 0.05, '초당 녹색 확산');
    R(melt, mc, 'impulse', 0, 20, 0.1, '바람, 바깥쪽');
    R(melt, mc, 'lift', 0, 12, 0.1, '바람, 위쪽');
    R(melt, mc, 'spin', 0, 4, 0.01, '바람, 토크');
    R(melt, mc.look, 'rimEmissive', 0, 8, 0.05, '부식 테두리 발광');
    R(melt, mc.look, 'edgeEmissive', 0, 16, 0.05, '부식 연소 발광');
    R(melt, mc.look, 'edgeWidth', 0.005, 0.4, 0.005, '부식 연소 너비');
    melt.addColor(mc.look, 'color').name('부식 살점');
    melt.addColor(mc.look, 'rimColor').name('부식 테두리');
    melt.addColor(mc.look, 'edgeColor').name('부식 화상');

    const impact = folder.addFolder('던지기·개화·유지');
    R(impact, c, 'handHeight', 0, 3, 0.01, '손 높이');
    R(impact, c, 'handForward', -1, 3, 0.01, '손 전방');
    R(impact, c, 'handSide', -1.5, 1.5, 0.01, '손 측면');
    R(impact, c, 'muzzleSize', 0.05, 6, 0.05, '총구 크기');
    R(impact, c, 'muzzleIntensity', 0, 5, 0.01, '총구 강도');
    R(impact, c, 'castFlash', 0, 2, 0.01, '해제 시 섬광');
    R(impact, c, 'burstSize', 0.2, 14, 0.05, '블룸 쉘 크기');
    R(impact, c, 'burstIntensity', 0, 5, 0.01, '블룸 쉘 강도');
    R(impact, c, 'bloomBubbles', 0, 600, 1, '블룸 거품');
    R(impact, c, 'bloomMotes', 0, 900, 1, '블룸 부유 입자');
    R(impact, c, 'bloomSplash', 0, 600, 1, '블룸 튐');
    R(impact, c, 'bloomShake', 0, 3, 0.01, '블룸 흔들림');
    R(impact, c, 'shakeDuration', 0.1, 4, 0.01, '흔들림 지속시간');
    R(impact, c, 'bloomFlash', 0, 2, 0.01, '개화 섬광');
    R(impact, c, 'holdShake', 0, 0.5, 0.005, '유지 진동');
    R(impact, c, 'rumble', 0, 0.5, 0.005, '크리프 진동');
    impact.addColor(c, 'colorBurstA').name('껍질 안쪽');
    impact.addColor(c, 'colorBurstB').name('껍질 중간');
    impact.addColor(c, 'colorBurstC').name('껍질 중심');
    impact.addColor(c, 'colorCastFlash').name('해제 섬광');
    impact.addColor(c, 'colorFlash').name('개화 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 120, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 50, 0.1, '빛 반경');
    R(light, c, 'lightHeight', 0, 1, 0.01, '기둥 상부 높이');
    R(light, c, 'lightBoil', 0, 1, 0.01, '비등 종속');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.acidFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * The Arborist's Growth Chrono-Summon.
   *
   * Grouped exactly the way the reference sheet is: one folder per layer, in
   * the order they appear on screen — the sigil opens, the tendrils climb, the
   * foliage unfurls, the bloom rises, and then it fires. `The sequence` sits at
   * the top with the cast because it is the one group that reaches into all of
   * them: it is where the summon's *timing* lives, and timing is the only thing
   * about this ability that cannot be judged from a still.
   *
   * `tendrils` and `leaves` are the performance dials, and both are live
   * sliders on purpose — the same build has to run on a laptop and on the
   * machine driving the projector.
   */
  _buildGrowth() {
    const folder = this.gui.addFolder('❦  수목가의 성장');
    const c = settings.growth;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 1, 12, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 300, 1, '씨앗 속도');
    R(cast, c, 'lifetime', 0.5, 20, 0.05, '유지 시간');
    R(cast, c, 'fadeTime', 0.1, 8, 0.01, '시듦 시간');
    R(cast, c, 'cooldown', 0, 10, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    const sequence = folder.addFolder('순서');
    R(sequence, c, 'sigilTime', 0.05, 2, 0.01, '인장 전개');
    R(sequence, c, 'vineDelay', 0, 2, 0.01, '덩굴손 시작점');
    R(sequence, c, 'vineTime', 0.1, 4, 0.01, '덩굴손 상승 시간');
    R(sequence, c, 'vineStagger', 0, 0.85, 0.01, '줄기 간 지연');
    R(sequence, c, 'bloomDelay', 0, 4, 0.01, '봉오리 상승 시점');
    R(sequence, c, 'bloomTime', 0.1, 4, 0.01, '블룸 개방');
    R(sequence, c, 'fireDelay', 0, 3, 0.01, '첫 번째 창 이후');
    R(sequence, c, 'pulseRate', 0.05, 6, 0.01, '호흡 속도');
    R(sequence, c, 'pulseDepth', 0, 2, 0.01, '호흡 깊이');

    /* ---- layer 1 ---- */
    const sigil = folder.addFolder('1 · 자연 인장');
    R(sigil, c, 'sigilRailWidth', 0.005, 0.2, 0.001, '레일 너비 (m)');
    R(sigil, c, 'sigilRailOuter', 0.4, 1.4, 0.005, '바깥쪽 레일');
    R(sigil, c, 'sigilRailInner', 0.2, 1.2, 0.005, '안쪽 레일');
    R(sigil, c, 'sigilRailHub', 0.02, 0.6, 0.005, '허브');
    R(sigil, c, 'sigilRailGlow', 0, 6, 0.01, '레일 발광');
    R(sigil, c, 'sigilSpin', -0.2, 0.2, 0.001, '고리 회전');
    R(sigil, c, 'sigilRunes', 6, 120, 1, '룬');
    R(sigil, c, 'sigilRuneBand', 0.05, 1.2, 0.005, '띠 높이 (m)');
    R(sigil, c, 'sigilRuneSeat', 0.3, 1.3, 0.005, '띠 위치');
    R(sigil, c, 'sigilRuneWeight', 0.01, 0.2, 0.001, '획 굵기');
    R(sigil, c, 'sigilRuneStrokes', 0, 1, 0.01, '유지 획 수');
    R(sigil, c, 'sigilRuneSweep', 0, 4, 0.01, '읽기 헤드');
    R(sigil, c, 'sigilRuneSweepSpeed', -1, 1, 0.005, '선단 속도');
    R(sigil, c, 'sigilRuneSweepWidth', 0.01, 0.5, 0.005, '선단 너비');
    R(sigil, c, 'sigilRuneFlicker', 0, 1, 0.01, '글리프 깜빡임');
    R(sigil, c, 'sigilRuneGlow', 0, 6, 0.01, '룬 발광');
    R(sigil, c, 'sigilTicks', 0, 3, 0.01, '눈금');
    R(sigil, c, 'sigilTickCount', 4, 240, 1, '틱 수');
    R(sigil, c, 'sigilTickWidth', 0.02, 1, 0.01, '틱 너비');
    R(sigil, c, 'sigilTickLength', 0.005, 0.3, 0.005, '틱 길이');
    R(sigil, c, 'sigilStar', 0, 4, 0.01, '내접 별');
    R(sigil, c, 'sigilStarRadius', 0.1, 1.2, 0.005, '별 반경');
    R(sigil, c, 'sigilStarWidth', 0.005, 0.15, 0.001, '별 너비(m)');
    R(sigil, c, 'sigilStarSpin', -0.2, 0.2, 0.001, '별 회전');
    R(sigil, c, 'sigilFiligree', 0, 3, 0.01, '덩굴 세공');
    R(sigil, c, 'sigilFiligreeSeat', 0.1, 1.1, 0.005, '필리그리 위치');
    R(sigil, c, 'sigilFiligreeAmp', 0, 0.4, 0.005, '배회 거리');
    R(sigil, c, 'sigilFiligreeLobes', 2, 24, 1, '엽');
    R(sigil, c, 'sigilFiligreeWidth', 0.004, 0.1, 0.001, '필리그리 너비 (m)');
    R(sigil, c, 'sigilFiligreeSpin', -0.2, 0.2, 0.001, '필리그리 회전');
    R(sigil, c, 'sigilPool', 0, 2, 0.01, '속살');
    R(sigil, c, 'sigilPoolFalloff', 0.2, 6, 0.05, '워시 감쇠');
    R(sigil, c, 'sigilGrain', 0, 2, 0.01, '워시 그레인');
    R(sigil, c, 'sigilGrainScale', 0.2, 10, 0.05, '결 스케일');
    R(sigil, c, 'sigilOpacity', 0, 2, 0.01, '불투명도');
    R(sigil, c, 'sigilGlow', 0, 3, 0.01, '발광');
    R(sigil, c, 'sigilHeight', 0.005, 0.2, 0.002, '호버 높이');
    sigil.addColor(c, 'colorSigil').name('줄기');
    sigil.addColor(c, 'colorSigilCore').name('속심');
    sigil.addColor(c, 'colorRune').name('룬');
    sigil.addColor(c, 'colorSigilPool').name('속살');
    sigil.addColor(c, 'colorFront').name('성장 전선');

    /* ---- layer 2 ---- */
    const vines = folder.addFolder('2 · 촉수');
    R(vines, c, 'vines', 1, 18, 1, '덩굴손(비용)');
    R(vines, c, 'vineSeat', 0.1, 1.3, 0.005, '식재점');
    R(vines, c, 'vineSpread', 0, 3, 0.01, '방향 산란');
    R(vines, c, 'vineHeight', 0.5, 10, 0.05, '높이 (m)');
    R(vines, c, 'vineHeightJitter', 0, 1.5, 0.01, '높이 산란');
    R(vines, c, 'vineRise', 0.2, 3, 0.01, '상승 곡선');
    R(vines, c, 'vineBelly', -0.5, 1.5, 0.01, '허리 휨');
    R(vines, c, 'vineLean', 0, 1.5, 0.01, '끝 기울기');
    R(vines, c, 'vineTwist', -2, 2, 0.01, '상승 회전수');
    R(vines, c, 'vineCurlAt', 0.1, 1, 0.01, '끝 말림 시작');
    R(vines, c, 'vineCurlTurns', 0, 3, 0.01, '컬 회전');
    R(vines, c, 'vineCurlPinch', 0.05, 1.5, 0.01, '컬 조임');
    R(vines, c, 'vineCurlLift', -0.3, 0.6, 0.005, '컬 상승');
    R(vines, c, 'vineWander', 0, 2, 0.01, '방황(m)');
    R(vines, c, 'vineWanderScale', 0.2, 8, 0.05, '방황 스케일');
    R(vines, c, 'vineSway', 0, 0.5, 0.005, '실시간 흔들림 (m)');
    R(vines, c, 'vineSwaySpeed', 0, 4, 0.01, '흔들 속도');
    R(vines, c, 'vineThick', 0.01, 0.4, 0.002, '줄기 반경(m)');
    R(vines, c, 'vineTaper', 0.02, 1, 0.01, '끝 테이퍼');
    R(vines, c, 'vineKnots', 0, 1, 0.01, '매듭');
    R(vines, c, 'vineKnotScale', 1, 30, 0.5, '매듭 스케일');

    const bark = vines.addFolder('나무껍질');
    R(bark, c, 'barkScale', 0.5, 20, 0.1, '미터당 결');
    R(bark, c, 'barkContrast', 0.2, 4, 0.01, '결 대비');
    R(bark, c, 'barkFibre', 0, 2, 0.01, '섬유');
    R(bark, c, 'barkFibreBands', 0.5, 12, 0.1, '둘레방향 섬유');
    R(bark, c, 'barkFibreScale', 2, 80, 0.5, '길이방향 섬유');
    R(bark, c, 'barkRoughness', 0.05, 1, 0.01, '거칠기');
    R(bark, c, 'barkEnv', 0, 2, 0.01, '환경 (IBL)');
    R(bark, c, 'seamWidth', 0.01, 0.4, 0.005, '틈새 너비');
    R(bark, c, 'seamBands', 0.5, 10, 0.05, '둘레 틈새');
    R(bark, c, 'seamScale', 0.5, 20, 0.1, '종방향 틈새');
    R(bark, c, 'seamFlow', -2, 2, 0.01, '틈새 이동');
    R(bark, c, 'seamGlow', 0, 8, 0.01, '틈새 발광');
    R(bark, c, 'sapPulse', 0, 6, 0.01, '수액 맥동');
    R(bark, c, 'sapSpeed', 0, 3, 0.01, '수액 속도');
    R(bark, c, 'sapWidth', 0.01, 0.6, 0.005, '수액 너비');
    R(bark, c, 'frontGlow', 0, 12, 0.05, '성장 선단');
    R(bark, c, 'frontWidth', 0.01, 0.4, 0.005, '끝 너비');
    R(bark, c, 'vineRim', 0, 3, 0.01, '림 라이트');
    R(bark, c, 'vineRimPower', 0.2, 8, 0.05, '가장자리 감쇠');
    R(bark, c, 'vineGlow', 0, 3, 0.01, '발광');
    R(bark, c, 'witherRise', 0, 1, 0.01, '높이에 따른 시듦');
    R(bark, c, 'witherScale', 0.2, 12, 0.05, '시듦 스케일');
    R(bark, c, 'witherEdge', 0.01, 0.6, 0.005, '시듦 가장자리');
    R(bark, c, 'witherEdgeGlow', 0, 12, 0.05, '시듦 가장자리 발광');
    bark.addColor(c, 'colorBark').name('나무껍질');
    bark.addColor(c, 'colorBarkLight').name('나무껍질 빛');
    bark.addColor(c, 'colorSeam').name('이음매');
    bark.addColor(c, 'colorSeamCore').name('이음 중심');
    bark.addColor(c, 'colorWither').name('시듦불');

    /* ---- layer 3 ---- */
    const leaves = folder.addFolder('3 · 잎무리');
    R(leaves, c, 'leaves', 0, 340, 1, '잎 (비용)');
    R(leaves, c, 'leafStart', 0, 1, 0.01, '첫 잎 위치');
    R(leaves, c, 'leafEnd', 0, 1, 0.01, '마지막 잎 위치');
    R(leaves, c, 'leafSize', 0.05, 1.5, 0.005, '길이 (m)');
    R(leaves, c, 'leafSizeJitter', 0, 1.5, 0.01, '크기 산포');
    R(leaves, c, 'leafAspect', 0.1, 1.2, 0.01, '너비/길이');
    R(leaves, c, 'leafBias', 0.2, 2, 0.01, '최대 너비점');
    R(leaves, c, 'leafPoint', 0.2, 2, 0.01, '뾰족함');
    R(leaves, c, 'leafPitch', -1.5, 1.5, 0.01, '줄기 간격');
    R(leaves, c, 'leafPitchJitter', 0, 3, 0.01, '피치 분산');
    R(leaves, c, 'leafDroop', 0, 1.5, 0.01, '처짐');
    R(leaves, c, 'leafCup', -0.6, 0.6, 0.01, '컵');
    R(leaves, c, 'leafOpen', 0.01, 0.5, 0.005, '전개 창');
    R(leaves, c, 'leafFlutter', 0, 0.6, 0.005, '펄럭임');
    R(leaves, c, 'leafFlutterSpeed', 0, 6, 0.01, '펄럭임 속도');
    R(leaves, c, 'leafVeins', 1, 20, 1, '측방');
    R(leaves, c, 'leafVeinWidth', 0.01, 0.4, 0.005, '측면 너비');
    R(leaves, c, 'leafVeinSkew', 0, 2, 0.01, '측면 기울임');
    R(leaves, c, 'leafRibWidth', 0.01, 0.4, 0.005, '중륵 너비');
    R(leaves, c, 'leafVeinGlow', 0, 6, 0.01, '맥 발광');
    R(leaves, c, 'leafTranslucency', 0, 4, 0.01, '투과 빛');
    R(leaves, c, 'leafSheen', 0, 2, 0.01, '큐티클 광택');
    R(leaves, c, 'leafMottle', 0, 1.5, 0.01, '얼룩무늬');
    R(leaves, c, 'leafRoughness', 0.05, 1, 0.01, '거칠기');
    R(leaves, c, 'leafEnv', 0, 2, 0.01, '환경 (IBL)');
    R(leaves, c, 'leafGlow', 0, 3, 0.01, '발광');
    leaves.addColor(c, 'colorLeaf').name('칼날');
    leaves.addColor(c, 'colorLeafTip').name('끝');
    leaves.addColor(c, 'colorLeafDeep').name('밑동');
    leaves.addColor(c, 'colorLeafVein').name('결');

    /* ---- layer 4 ---- */
    const bloom = folder.addFolder('4 · 비전 개화');
    R(bloom, c, 'bloomHeight', 0.5, 10, 0.05, '높이 (m)');
    R(bloom, c, 'bloomRise', 0, 4, 0.05, '열리며 상승');
    R(bloom, c, 'bloomScale', 0.2, 4, 0.01, '크기');
    R(bloom, c, 'bloomSpin', -0.1, 0.1, 0.001, '소용돌이 회전');
    R(bloom, c, 'bloomBob', 0, 0.4, 0.005, '호흡 (m)');
    R(bloom, c, 'bloomBobSpeed', 0, 3, 0.01, '호흡 속도');
    R(bloom, c, 'bloomStand', 0, 1, 0.01, '정립(0 평탄)');
    R(bloom, c, 'bloomAimPitch', 0, 1, 0.01, '표적 조준');
    R(bloom, c, 'bloomTurnRate', 0.5, 20, 0.1, '회전율(rad/s)');

    const whorls = bloom.addFolder('소용돌이');
    R(whorls, c, 'whorlOuter', 1, 16, 1, '바깥쪽 꽃잎');
    R(whorls, c, 'whorlMid', 1, 14, 1, '중간 꽃잎');
    R(whorls, c, 'whorlInner', 1, 12, 1, '안쪽 꽃잎');
    R(whorls, c, 'petalLengthOuter', 0.1, 2, 0.01, '바깥쪽 길이');
    R(whorls, c, 'petalLengthMid', 0.1, 2, 0.01, '중간 길이');
    R(whorls, c, 'petalLengthInner', 0.1, 2, 0.01, '안쪽 길이');
    R(whorls, c, 'petalPitchOuter', 0, 2.4, 0.01, '바깥쪽 피치');
    R(whorls, c, 'petalPitchMid', 0, 2.4, 0.01, '중간 피치');
    R(whorls, c, 'petalPitchInner', 0, 2.4, 0.01, '안쪽 피치');
    R(whorls, c, 'petalCurveOuter', -1.5, 1.5, 0.01, '바깥쪽 곡선');
    R(whorls, c, 'petalCurveMid', -1.5, 1.5, 0.01, '중간 곡선');
    R(whorls, c, 'petalCurveInner', -1.5, 1.5, 0.01, '안쪽 곡선');
    R(whorls, c, 'petalWidthOuter', 0.05, 1, 0.01, '바깥쪽 너비');
    R(whorls, c, 'petalWidthMid', 0.05, 1, 0.01, '중간 너비');
    R(whorls, c, 'petalWidthInner', 0.05, 1, 0.01, '안쪽 너비');
    R(whorls, c, 'petalLiftOuter', -0.5, 0.5, 0.005, '바깥쪽 위치');
    R(whorls, c, 'petalLiftMid', -0.5, 0.5, 0.005, '중간 위치');
    R(whorls, c, 'petalLiftInner', -0.5, 0.5, 0.005, '안쪽 자리');
    R(whorls, c, 'petalRoll', 0, 1.6, 0.01, '소용돌이 오프셋');
    R(whorls, c, 'petalPitchClosed', 0, 1, 0.01, '봉오리 각도');
    R(whorls, c, 'petalBudLength', 0.05, 1, 0.01, '봉오리 길이');
    R(whorls, c, 'petalOpenStagger', 0, 0.6, 0.01, '소용돌이 간 지연');
    R(whorls, c, 'petalWidthBias', 0.2, 2, 0.01, '최대 너비점');
    R(whorls, c, 'petalWidthPoint', 0.2, 2, 0.01, '뾰족함');
    R(whorls, c, 'petalCup', -0.6, 0.8, 0.01, '컵');
    R(whorls, c, 'petalTwist', -1, 1, 0.01, '중심축 비틀림');
    R(whorls, c, 'petalJitter', 0, 0.6, 0.01, '각도 산란');

    const petalLook = bloom.addFolder('꽃잎');
    R(petalLook, c, 'petalMargin', 0, 0.8, 0.01, '창백한 테두리');
    R(petalLook, c, 'petalMarginGlow', 0, 4, 0.01, '테두리 발광');
    R(petalLook, c, 'petalVeins', 1, 20, 1, '측방');
    R(petalLook, c, 'petalVeinWidth', 0.01, 0.4, 0.005, '측면 너비');
    R(petalLook, c, 'petalVeinSkew', 0, 2, 0.01, '측면 기울임');
    R(petalLook, c, 'petalRibWidth', 0.01, 0.3, 0.005, '중륵 너비');
    R(petalLook, c, 'petalVeinGlow', 0, 6, 0.01, '맥 발광');
    R(petalLook, c, 'petalTipGlow', 0, 4, 0.01, '끝 발광');
    R(petalLook, c, 'petalChargeGain', 0, 6, 0.01, '충전 끝');
    R(petalLook, c, 'petalTranslucency', 0, 4, 0.01, '투과 빛');
    R(petalLook, c, 'petalRim', 0, 3, 0.01, '림 라이트');
    R(petalLook, c, 'petalRimPower', 0.2, 8, 0.05, '가장자리 감쇠');
    R(petalLook, c, 'petalShimmer', 0, 3, 0.01, '시간 미광');
    R(petalLook, c, 'petalShimmerScale', 0.1, 6, 0.05, '반짝임 스케일');
    R(petalLook, c, 'petalShimmerSpeed', -3, 3, 0.01, '반짝임 속도');
    R(petalLook, c, 'petalRoughness', 0.05, 1, 0.01, '거칠기');
    R(petalLook, c, 'petalEnv', 0, 2, 0.01, '환경 (IBL)');
    R(petalLook, c, 'petalGlow', 0, 3, 0.01, '발광');
    petalLook.addColor(c, 'colorPetalOuter').name('바깥 소용돌이');
    petalLook.addColor(c, 'colorPetalMid').name('가운데 소용돌이');
    petalLook.addColor(c, 'colorPetalInner').name('안쪽 소용돌이');
    petalLook.addColor(c, 'colorPetalBase').name('꽃잎 밑동');
    petalLook.addColor(c, 'colorPetalMargin').name('여백');
    petalLook.addColor(c, 'colorPetalVein').name('결');

    const core = bloom.addFolder('중심과 후광');
    R(core, c, 'coreSize', 0.05, 1.5, 0.005, '코어 반경');
    R(core, c, 'coreSeat', -0.3, 1, 0.01, '축 상단 위치');
    R(core, c, 'coreIntensity', 0, 8, 0.01, '코어 강도');
    R(core, c, 'coreChargeGain', 0, 8, 0.01, '충전 시 게인');
    R(core, c, 'coreFill', 0.1, 6, 0.05, '축 가중치');
    R(core, c, 'coreRim', 0, 3, 0.01, '가장자리');
    R(core, c, 'coreRimPower', 0.2, 8, 0.05, '가장자리 감쇠');
    R(core, c, 'coreBoil', 0, 0.6, 0.005, '실루엣 끓음');
    R(core, c, 'coreBoilScale', 0.2, 8, 0.05, '끓음 규모');
    R(core, c, 'coreFilament', 0, 4, 0.01, '필라멘트');
    R(core, c, 'coreFilamentScale', 0.5, 12, 0.05, '필라멘트 스케일');
    R(core, c, 'coreFilamentSpeed', -3, 3, 0.01, '필라멘트 속도');
    R(core, c, 'coreBudDim', 0, 1, 0.01, '봉오리 감광');
    R(core, c, 'coreSoftFade', 0.05, 2, 0.01, '부드러운 페이드');
    R(core, c, 'haloSize', 0.2, 8, 0.05, '후광 반경');
    R(core, c, 'haloGlow', 0, 3, 0.01, '후광 발광');
    R(core, c, 'haloFalloff', 0.2, 8, 0.05, '후광 감쇠');
    R(core, c, 'haloRays', 0, 3, 0.01, '광선');
    R(core, c, 'haloRayCount', 2, 48, 1, '광선 수');
    R(core, c, 'haloRaySharp', 1, 24, 0.5, '광선 선명도');
    R(core, c, 'haloRaySpin', -0.3, 0.3, 0.002, '광선 회전');
    R(core, c, 'haloRingInner', 0.05, 1, 0.005, '안쪽 다이얼');
    R(core, c, 'haloRingOuter', 0.05, 1, 0.005, '바깥쪽 다이얼');
    R(core, c, 'haloRingWidth', 0.002, 0.08, 0.001, '다이얼 너비');
    R(core, c, 'haloRingSpin', -0.3, 0.3, 0.002, '다이얼 회전');
    R(core, c, 'haloTicks', 0, 1, 0.01, '다이얼 눈금');
    R(core, c, 'haloTickCount', 4, 180, 1, '틱 수');
    R(core, c, 'haloTickWidth', 0.05, 0.95, 0.01, '틱 너비');
    core.addColor(c, 'colorCore').name('코어');
    core.addColor(c, 'colorCoreMid').name('중심 중간');
    core.addColor(c, 'colorCoreEdge').name('중심 가장자리');
    core.addColor(c, 'colorHalo').name('후광');
    core.addColor(c, 'colorHaloRing').name('다이얼');

    /* ---- layer 5 ---- */
    const motes = folder.addFolder('5 · 먼지·꽃가루·안개');
    R(motes, c, 'moteRate', 0, 400, 1, '초당 부유 입자');
    R(motes, c, 'moteSize', 0.005, 0.3, 0.001, '부유 입자 크기');
    R(motes, c, 'moteLifetime', 0.2, 8, 0.05, '부유 입자 수명');
    R(motes, c, 'moteSpeed', 0, 6, 0.01, '부유 입자 속도');
    R(motes, c, 'moteRise', -3, 3, 0.01, '부유 입자 상승');
    R(motes, c, 'moteTurbulence', 0, 3, 0.01, '부유 입자 난류');
    Editor.gradient(motes, c, 'colorMote', '먼지 그라데이션');
    R(motes, c, 'pollenRate', 0, 200, 1, '초당 꽃가루');
    R(motes, c, 'pollenSize', 0.01, 0.5, 0.005, '꽃가루 크기');
    R(motes, c, 'pollenLifetime', 0.2, 12, 0.05, '꽃가루 수명');
    R(motes, c, 'pollenSpeed', 0, 4, 0.01, '꽃가루 속도');
    R(motes, c, 'pollenRise', -2, 2, 0.01, '꽃가루 상승');
    Editor.gradient(motes, c, 'colorPollen', '꽃가루 그라데이션');
    R(motes, c, 'mistRate', 0, 200, 1, '초당 안개');
    R(motes, c, 'mistSize', 0.1, 5, 0.05, '안개 크기');
    R(motes, c, 'mistLifetime', 0.2, 12, 0.05, '안개 수명');
    R(motes, c, 'mistSpeed', 0, 4, 0.01, '안개 속도');
    R(motes, c, 'mistRise', -2, 2, 0.01, '안개 상승');
    R(motes, c, 'mistSpread', 0, 2, 0.01, '안개 확산');
    R(motes, c, 'mistOpacity', 0, 2, 0.01, '안개 불투명도');
    Editor.gradient(motes, c, 'colorMist', '안개 그라데이션');
    R(motes, c, 'driftRate', 0, 60, 0.5, '초당 잎');
    R(motes, c, 'driftSize', 0.02, 0.6, 0.005, '잎 크기');
    R(motes, c, 'driftLifetime', 0.2, 12, 0.05, '잎 수명');
    R(motes, c, 'driftSpeed', 0, 6, 0.01, '잎 속도');
    R(motes, c, 'driftGravity', -8, 2, 0.01, '잎 중력');
    R(motes, c, 'driftSpin', 0, 10, 0.05, '잎 회전');
    Editor.gradient(motes, c, 'colorDrift', '잎 그라데이션');

    const bursts = folder.addFolder('단발 폭발');
    R(bursts, c, 'seedMotes', 0, 200, 1, '손 부유 입자');
    R(bursts, c, 'creepRate', 0, 200, 1, '씨앗 방출 부유 입자');
    R(bursts, c, 'trailRate', 0.2, 12, 0.05, '미터당 자국');
    R(bursts, c, 'rootMotes', 0, 600, 1, '뿌리내릴 때 부유 입자');
    R(bursts, c, 'rootLeaves', 0, 200, 1, '뿌리내림 잎');
    R(bursts, c, 'rootMist', 0, 200, 1, '뿌리내릴 때 안개');
    R(bursts, c, 'bloomMotes', 0, 600, 1, '열릴 때 부유 입자');
    R(bursts, c, 'bloomPollen', 0, 400, 1, '열릴 때 꽃가루');
    R(bursts, c, 'bloomLeaves', 0, 200, 1, '열림 잎');
    R(bursts, c, 'witherLeaves', 0, 400, 1, '시듦 잎');
    R(bursts, c, 'stainRadius', 0.1, 4, 0.01, '지면 자국 반경');
    R(bursts, c, 'stainLife', 0.2, 20, 0.05, '지면 자국 수명');
    R(bursts, c, 'stainIntensity', 0, 3, 0.01, '지면 자국 발광');
    bursts.addColor(c, 'colorStain').name('표식');
    bursts.addColor(c, 'colorStainEdge').name('표식 가장자리');

    /* ---- the lance ---- */
    const lance = folder.addFolder('창과 절단');
    lance.add(c, 'laserEnabled').name('표적 자동 공격');
    R(lance, c, 'laserRange', 1, 30, 0.1, '도달거리 (m)');
    R(lance, c, 'laserInterval', 0.05, 4, 0.01, '발사 간격 (초)');
    R(lance, c, 'laserWarmup', 0.02, 2, 0.01, '감기');
    R(lance, c, 'laserVolley', 1, 6, 1, '발사당 표적');
    R(lance, c, 'laserLife', 0.1, 2, 0.01, '창 수명');
    R(lance, c, 'laserWidth', 0.1, 4, 0.01, '창 너비');
    R(lance, c, 'laserAim', 0.1, 1, 0.01, '착지점');
    R(lance, c, 'laserShake', 0, 0.6, 0.005, '카메라 충격');
    R(lance, c, 'laserFlash', 0, 1, 0.01, '섬광');
    R(lance, c.laserHit, 'impulse', 0, 20, 0.1, '던짐 충격');
    R(lance, c.laserHit, 'lift', 0, 20, 0.1, '던짐 상승');
    R(lance, c.laserHit, 'spin', 0, 5, 0.05, '던짐 회전');
    R(lance, c, 'cutLeaves', 0, 200, 1, '상처 잎');
    R(lance, c, 'cutMotes', 0, 400, 1, '상처 부유 입자');
    R(lance, c, 'cutSpeed', 0, 20, 0.1, '감긴 스프레이 속도');
    R(lance, c, 'cutBurst', 0, 3, 0.01, '감긴 외층 크기');

    const lanceLook = lance.addFolder('그려지는 방식');
    R(lanceLook, c, 'lanceRadius', 0.005, 0.5, 0.001, '반경 (m)');
    R(lanceLook, c, 'lanceMuzzleRadius', 0.005, 0.6, 0.001, '총구 반경');
    R(lanceLook, c, 'lanceRadiusCurve', 0.05, 4, 0.01, '반경 곡선');
    R(lanceLook, c, 'lanceFlare', 0, 3, 0.01, '착탄 시 플레어');
    R(lanceLook, c, 'lanceFlareWidth', 0.01, 0.6, 0.005, '플레어 너비');
    R(lanceLook, c, 'lanceThrob', 0, 0.8, 0.005, '고동');
    R(lanceLook, c, 'lanceThrobBands', 0.5, 20, 0.1, '고동 띠');
    R(lanceLook, c, 'lanceThrobSpeed', 0, 10, 0.05, '고동 속도');
    R(lanceLook, c, 'lanceWander', 0, 0.4, 0.005, '방황(m)');
    R(lanceLook, c, 'lanceWanderScale', 0.5, 16, 0.1, '방황 스케일');
    R(lanceLook, c, 'lanceWanderSpeed', 0, 8, 0.05, '방황 속도');
    R(lanceLook, c, 'lanceStrike', 0.02, 0.6, 0.005, '도달 소요');
    R(lanceLook, c, 'lanceHold', 0.05, 0.95, 0.01, '발사 전 시간');
    R(lanceLook, c, 'lanceCoreFill', 0.2, 8, 0.05, '축 가중치');
    R(lanceLook, c, 'lanceEdgePower', 0.2, 8, 0.05, '외피 감쇠');
    R(lanceLook, c, 'lanceSheath', 0, 3, 0.01, '외피');
    R(lanceLook, c, 'lanceCoils', 1, 6, 1, '나선');
    R(lanceLook, c, 'lanceCoilTurns', 0, 24, 0.1, '나선 회전수');
    R(lanceLook, c, 'lanceCoilSpeed', -6, 6, 0.05, '나선 속도');
    R(lanceLook, c, 'lanceCoilWidth', 0.02, 1, 0.01, '나선 너비');
    R(lanceLook, c, 'lanceCoilGain', 0, 4, 0.01, '나선 발광');
    R(lanceLook, c, 'lanceMotes', 0, 4, 0.01, '내부 부유 입자');
    R(lanceLook, c, 'lanceMoteScale', 1, 40, 0.5, '부유 입자 스케일');
    R(lanceLook, c, 'lanceMoteSpeed', 0, 10, 0.05, '부유 입자 속도');
    R(lanceLook, c, 'lanceHeadGlow', 0, 8, 0.05, '선단 발광');
    R(lanceLook, c, 'lanceHeadWidth', 0.005, 0.4, 0.005, '선단 너비');
    R(lanceLook, c, 'lanceIntensity', 0, 8, 0.01, '강도');
    R(lanceLook, c, 'lanceOpacity', 0, 2, 0.01, '불투명도');
    R(lanceLook, c, 'lanceSoftFade', 0.05, 2, 0.01, '부드러운 페이드');
    lanceLook.addColor(c, 'colorLanceCore').name('코어');
    lanceLook.addColor(c, 'colorLanceInner').name('안쪽');
    lanceLook.addColor(c, 'colorLanceOuter').name('외피');
    lanceLook.addColor(c, 'colorLanceCoil').name('나선');

    const cut = lance.addFolder('관통하는 몸통');
    const s = settings.slice;
    cut.add(s, 'enabled').name('반으로 절단');
    R(cut, s, 'height', 0.1, 0.9, 0.01, '평면 높이');
    R(cut, s, 'tilt', -45, 45, 0.5, '평면 기울기 (deg)');
    R(cut, s, 'separation', 0, 0.5, 0.005, '갈라짐 간격 (m)');
    R(cut, s, 'split', 0, 8, 0.05, '분리 속도 (m/s)');
    R(cut, s.upper, 'impulse', 0, 2, 0.01, '상단: 충격');
    R(cut, s.upper, 'lift', 0, 2, 0.01, '상단: 상승');
    R(cut, s.upper, 'spin', 0, 2, 0.01, '상단: 회전');
    R(cut, s.lower, 'impulse', 0, 2, 0.01, '다리: 충격');
    R(cut, s.lower, 'lift', 0, 2, 0.01, '다리: 상승');
    R(cut, s.lower, 'spin', 0, 2, 0.01, '다리: 회전');
    cut.add(s.collide, 'enabled').name('절단면 실체 있음');
    R(cut, s.collide, 'radius', 0.01, 0.4, 0.005, '접촉 반경');
    R(cut, s.collide, 'bounce', 0, 1, 0.01, '반발');
    R(cut, s.collide, 'friction', 0, 1, 0.01, '마찰');
    R(cut, s.collide, 'maxPush', 0.005, 0.3, 0.005, '프레임당 최대 밀기');
    R(cut, s, 'interiorEmissive', 0, 3, 0.01, '내부 발광');
    R(cut, s, 'edgeEmissive', 0, 12, 0.05, '절단 가장자리 발광');
    R(cut, s, 'edgeWidth', 0.001, 0.1, 0.001, '절단 가장자리 너비');
    cut.addColor(s, 'interiorColor').name('내부');
    cut.addColor(s, 'edgeColor').name('절단면');

    /* ---- impact, camera & light ---- */
    const impact = folder.addFolder('충돌·카메라·조명');
    R(impact, c, 'muzzleSize', 0.05, 4, 0.01, '손 섬광 크기');
    R(impact, c, 'muzzleIntensity', 0, 5, 0.01, '손 섬광 발광');
    R(impact, c, 'castFlash', 0, 1, 0.01, '해제 섬광');
    R(impact, c, 'rootBurst', 0.1, 10, 0.05, '뿌리 외피 크기');
    R(impact, c, 'rootIntensity', 0, 5, 0.01, '뿌리 외피 발광');
    R(impact, c, 'rootShake', 0, 1, 0.005, '뿌리 흔들림');
    R(impact, c, 'shakeDuration', 0.05, 2, 0.01, '흔들림 감쇠');
    R(impact, c, 'bloomShake', 0, 1, 0.005, '블룸 흔들림');
    R(impact, c, 'bloomFlash', 0, 2, 0.01, '개화 섬광');
    R(impact, c, 'holdShake', 0, 0.3, 0.002, '유지 진동');
    R(impact, c, 'rumble', 0, 0.3, 0.002, '씨앗 진동');
    impact.addColor(c, 'colorBurstA').name('껍질 안쪽');
    impact.addColor(c, 'colorBurstB').name('껍질 중간');
    impact.addColor(c, 'colorBurstC').name('껍질 바깥');
    impact.addColor(c, 'colorCastFlash').name('해제 섬광');
    impact.addColor(c, 'colorFlash').name('개화 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 160, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightHeight', 0, 1, 0.01, '블룸 방향 높이');
    R(light, c, 'lightPulse', 0, 1, 0.01, '호흡 종속');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.growthFolder = folder;
  }

  /**
   * The Cyber Serpent, grouped by the five layers of its breakdown.
   *
   * Two units are in play and mixing them up is the only way to get lost here:
   * anything about the **body** is a fraction of its own length (so lengthening
   * the animal does not re-tune its swim), and anything about the **ribbons** or
   * the **board** is in metres, because those are laid out against the cast.
   *
   * `ghosts` and `trails` are the performance dials, and both are live sliders:
   * the same build has to run on a laptop and on the machine driving the
   * projector.
   */
  _buildCyber() {
    const folder = this.gui.addFolder('⛓  사이버 서펜트');
    const c = settings.cyber;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'range', 4, 60, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 12, 0.1, '최소 사거리');
    R(cast, c, 'speed', 4, 90, 0.5, '비행 속도 (m/s)');
    R(cast, c, 'shatterTime', 0.1, 3, 0.01, '파쇄 시간');
    R(cast, c, 'fadeTime', 0.1, 4, 0.01, '잔해 소멸');
    R(cast, c, 'cooldown', 0, 10, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    const flight = folder.addFolder('비행과 유영');
    R(flight, c, 'bodyLength', 1, 12, 0.05, '몸통 길이 (m)');
    R(flight, c, 'launchHeight', 0.2, 3, 0.01, '발사 높이 (m)');
    R(flight, c, 'flightHeight', 0.2, 6, 0.01, '순항 높이 (m)');
    R(flight, c, 'riseDistance', 0.5, 20, 0.1, '침전 거리 (m)');
    R(flight, c, 'bob', 0, 1, 0.005, '부양 높이 (m)');
    R(flight, c, 'bobSpeed', 0, 4, 0.01, '부양 속도');
    R(flight, c, 'formTime', 0.02, 2, 0.01, '몸통 조립');
    R(flight, c, 'sway', 0, 0.4, 0.001, '꼬리 던짐(× body)');
    R(flight, c, 'swayWaves', 0.2, 5, 0.01, '몸통 파도');
    R(flight, c, 'swaySpeed', 0, 6, 0.01, '초당 획');
    R(flight, c, 'swayRoot', 0, 1, 0.01, '노즈 이동량');
    R(flight, c, 'swayPitch', 0, 2, 0.01, '수직 파도');
    R(flight, c, 'swayPitchWaves', 0.2, 5, 0.01, '파장');
    R(flight, c, 'bank', 0, 1.4, 0.01, '스트로크 뱅크 (rad)');

    /* ---- layer 1 ---- */
    const wire = folder.addFolder('1 · 와이어프레임');
    R(wire, c, 'wireWidth', 0.1, 4, 0.05, '가장자리 너비 (px)');
    R(wire, c, 'wireFloor', 0.2, 12, 0.1, '최소 패싯(px)');
    R(wire, c, 'wireSolid', 0, 2, 0.01, '밀집 패싯 발광');
    R(wire, c, 'wireGain', 0, 6, 0.01, '가장자리 발광');
    R(wire, c, 'wireHalo', 0.2, 20, 0.1, '가장자리 번짐 (px)');
    R(wire, c, 'wireHaloGain', 0, 4, 0.01, '번짐 발광');
    R(wire, c, 'facetFill', 0, 0.6, 0.005, '내부 채움');
    R(wire, c, 'facetRim', 0, 3, 0.01, '실루엣 림');
    R(wire, c, 'facetPower', 0.5, 8, 0.05, '가장자리 조임');
    R(wire, c, 'scanDepth', 0, 1, 0.01, '스캔 라인');
    R(wire, c, 'scanFreq', 2, 120, 0.5, '몸통 띠');
    R(wire, c, 'scanSpeed', -10, 10, 0.05, '띠 속도');
    R(wire, c, 'pulse', 0, 5, 0.01, '메시 충전 진행');
    R(wire, c, 'pulseFreq', 0.2, 10, 0.05, '몸통 충전 통과');
    R(wire, c, 'pulseSpeed', -6, 6, 0.05, '충전 속도');
    R(wire, c, 'pulseSharp', 1, 20, 0.1, '충전 선명도');
    R(wire, c, 'glitch', 0, 0.3, 0.001, '패싯 오발');
    R(wire, c, 'glitchRate', 1, 60, 0.5, '초당 오발');
    R(wire, c, 'glitchGain', 0, 8, 0.05, '오발 발광');
    R(wire, c, 'headHeat', 0, 4, 0.01, '선단 열');
    R(wire, c, 'headLength', 0.01, 0.6, 0.005, '선단 길이');
    R(wire, c, 'formEdge', 0.005, 0.4, 0.005, '조립 가장자리');
    R(wire, c, 'formRough', 0, 0.5, 0.005, '조립 들쭉날쭉함');
    R(wire, c, 'formGlow', 0, 8, 0.05, '조립 발광');
    R(wire, c, 'wireIntensity', 0, 8, 0.01, '강도');
    R(wire, c, 'wireOpacity', 0, 2, 0.01, '불투명도');
    R(wire, c, 'softFade', 0.02, 3, 0.01, '부드러운 페이드(m)');
    wire.addColor(c, 'colorWire').name('철사');
    wire.addColor(c, 'colorHot').name('고열');
    wire.addColor(c, 'colorFacet').name('내부');

    /* ---- layer 2 ---- */
    const fill = folder.addFolder('2 · 에너지 충전');
    R(fill, c, 'fillInflate', 0, 0.08, 0.001, '팽창 (× body)');
    R(fill, c, 'fillCore', 0.2, 8, 0.05, '부피 가중');
    R(fill, c, 'cloudDepth', 0, 1, 0.01, '구름 깊이');
    R(fill, c, 'cloudScale', 0.5, 24, 0.1, '구름 규모');
    R(fill, c, 'cloudFlow', -6, 6, 0.05, '구름 흐름');
    R(fill, c, 'fillIntensity', 0, 6, 0.01, '강도');
    R(fill, c, 'fillOpacity', 0, 2, 0.01, '불투명도');
    fill.addColor(c, 'colorFillCore').name('코어');
    fill.addColor(c, 'colorFillEdge').name('가장자리');
    R(fill, c, 'auraInflate', 0, 0.2, 0.001, '아우라 팽창 (× body)');
    R(fill, c, 'auraRim', 0.5, 8, 0.05, '아우라 조임');
    R(fill, c, 'auraBreak', 0, 1, 0.01, '아우라 분해');
    R(fill, c, 'auraIntensity', 0, 6, 0.01, '아우라 강도');
    R(fill, c, 'auraOpacity', 0, 2, 0.01, '아우라 불투명도');
    fill.addColor(c, 'colorAura').name('오라');

    /* ---- layer 3 ---- */
    const trails = folder.addFolder('3 · 리본');
    R(trails, c, 'trails', 1, 8, 1, '가닥');
    R(trails, c, 'trailLength', 1, 30, 0.1, '후방 도달거리 (m)');
    R(trails, c, 'trailTurns', 0, 8, 0.05, '대상 전환');
    R(trails, c, 'trailSpin', -3, 3, 0.01, '롤 (turns/s)');
    R(trails, c, 'trailRadius', 0.05, 4, 0.01, '궤도 반경 (m)');
    R(trails, c, 'trailSwell', 0.1, 3, 0.01, '최대 두께 위치');
    R(trails, c, 'trailWidth', 0.005, 0.5, 0.001, '너비(m)');
    R(trails, c, 'trailWidthTip', 0, 4, 0.01, '꼬리 너비');
    R(trails, c, 'trailSharp', 0.2, 8, 0.05, '가장자리 감쇠');
    R(trails, c, 'trailCore', 1, 40, 0.5, '코어 실');
    R(trails, c, 'trailPulse', 0, 5, 0.01, '충전 진행');
    R(trails, c, 'trailPulseFreq', 0.2, 10, 0.05, '충전 통과');
    R(trails, c, 'trailPulseSpeed', -6, 6, 0.05, '충전 속도');
    R(trails, c, 'trailFlicker', 0, 1, 0.01, '끊김');
    R(trails, c, 'trailFlickerScale', 0.5, 20, 0.1, '끊김 스케일');
    R(trails, c, 'trailFlickerSpeed', 0, 8, 0.05, '끊김 속도');
    R(trails, c, 'trailWander', 0, 1.5, 0.01, '방황(m)');
    R(trails, c, 'trailWanderScale', 0.2, 8, 0.05, '방황 스케일');
    R(trails, c, 'trailWanderSpeed', 0, 4, 0.01, '방황 속도');
    R(trails, c, 'trailIntensity', 0, 8, 0.01, '강도');
    R(trails, c, 'trailOpacity', 0, 2, 0.01, '불투명도');
    R(trails, c, 'trailSoftFade', 0.02, 3, 0.01, '부드러운 페이드(m)');
    trails.addColor(c, 'colorTrailCore').name('코어');
    trails.addColor(c, 'colorTrail').name('몸통');
    trails.addColor(c, 'colorTrailTail').name('꼬리');

    /* ---- layer 4 ---- */
    const wake = folder.addFolder('4 · 항적');
    R(wake, c, 'ghosts', 1, 8, 1, '지연 복제');
    R(wake, c, 'ghostLag', 0, 0.8, 0.005, '간격(× body)');
    R(wake, c, 'ghostTimeLag', 0, 0.25, 0.001, '포즈 지연 (s)');
    R(wake, c, 'ghostInflate', 0, 0.1, 0.001, '개당 팽창(× body)');
    R(wake, c, 'ghostFade', 0.05, 0.98, 0.01, '개별 감광');
    R(wake, c, 'ghostErode', 0, 1, 0.01, '증기 소멸');
    R(wake, c, 'ghostErodeScale', 0.1, 6, 0.05, '증기 스케일');
    R(wake, c, 'ghostIntensity', 0, 6, 0.01, '강도');
    R(wake, c, 'ghostOpacity', 0, 2, 0.01, '불투명도');
    wake.addColor(c, 'colorGhost').name('잔상');
    R(wake, c, 'wakeRate', 0, 200, 1, '초당 증기');
    R(wake, c, 'wakeSize', 0.05, 4, 0.01, '증기 크기');
    R(wake, c, 'wakeLifetime', 0.1, 6, 0.05, '증기 수명');
    R(wake, c, 'wakeSpeed', 0, 8, 0.05, '증기 속도');
    R(wake, c, 'wakeRise', -2, 3, 0.01, '증기 상승');
    R(wake, c, 'wakeOpacity', 0, 1.5, 0.01, '증기 불투명도');
    R(wake, c, 'wakeTurbulence', 0, 3, 0.01, '증기 난류');
    Editor.gradient(wake, c, 'colorWake', '증기 그라데이션');

    /* ---- layer 5 ---- */
    const runes = folder.addFolder('5 · 룬 판');
    R(runes, c, 'runeWidth', 0.3, 12, 0.05, '절반 너비 (m)');
    R(runes, c, 'runeOverrun', 0, 10, 0.1, '착탄 초과 거리 (m)');
    R(runes, c, 'runeHeight', 0.002, 0.2, 0.002, '호버 (m)');
    R(runes, c, 'runeCell', 0.15, 3, 0.01, '경로 격자 (m)');
    R(runes, c, 'runeDensity', 0.05, 1, 0.01, '궤적 밀도');
    R(runes, c, 'runeJitter', 0, 0.9, 0.01, '경로 지터');
    R(runes, c, 'runeTrace', 0.004, 0.12, 0.001, '궤적 너비(m)');
    R(runes, c, 'runePad', 0.02, 0.4, 0.005, '패드 반경 (m)');
    R(runes, c, 'runeVia', 0.005, 0.2, 0.005, '경유 반경(m)');
    R(runes, c, 'runeLead', 0, 8, 0.05, '선행 충전 (m)');
    R(runes, c, 'runeDecay', 0.01, 1.5, 0.005, '후방 냉각 (1/m)');
    R(runes, c, 'runeBase', 0, 0.6, 0.005, '미발광 궤적');
    R(runes, c, 'runeGlow', 0, 6, 0.01, '발광');
    R(runes, c, 'runeBlip', 0, 8, 0.05, '데이터 블립');
    R(runes, c, 'runeBlipFreq', 0.05, 3, 0.01, '미터당 블립');
    R(runes, c, 'runeBlipSpeed', -12, 12, 0.1, '블립 속도');
    R(runes, c, 'runeUnder', 0, 3, 0.01, '빛못');
    R(runes, c, 'runeUnderLong', 0.2, 12, 0.05, '웅덩이 길이 (m)');
    R(runes, c, 'runeUnderWide', 0.2, 8, 0.05, '웅덩이 너비 (m)');
    R(runes, c, 'runeBlastSpeed', 1, 60, 0.5, '충격 고리(m/s)');
    R(runes, c, 'runeBlastLife', 0.1, 4, 0.05, '충격 고리 지속');
    R(runes, c, 'runeBlastWidth', 0.05, 2, 0.01, '충격 고리 너비(m)');
    R(runes, c, 'runeBlastGain', 0, 8, 0.05, '충격 고리 발광');
    R(runes, c, 'runeIntensity', 0, 8, 0.01, '강도');
    R(runes, c, 'runeOpacity', 0, 2, 0.01, '불투명도');
    runes.addColor(c, 'colorRune').name('미발광 궤적');
    runes.addColor(c, 'colorRuneLive').name('실시간 궤적');
    runes.addColor(c, 'colorRuneHot').name('점멸');
    runes.addColor(c, 'colorRuneUnder').name('빛못');

    /* ---- the spray ---- */
    const spray = folder.addFolder('먼지·불꽃·공기');
    R(spray, c, 'moteRate', 0, 400, 1, '초당 부유 입자');
    R(spray, c, 'moteSize', 0.005, 0.4, 0.005, '부유 입자 크기');
    R(spray, c, 'moteLifetime', 0.05, 4, 0.01, '부유 입자 수명');
    R(spray, c, 'moteSpeed', 0, 8, 0.05, '부유 입자 속도');
    R(spray, c, 'moteRise', -3, 3, 0.01, '부유 입자 상승');
    R(spray, c, 'moteDrift', 0, 3, 0.01, '잔류물');
    R(spray, c, 'moteTurbulence', 0, 3, 0.01, '부유 입자 난류');
    R(spray, c, 'moteGlow', 0, 4, 0.01, '부유 입자 발광');
    Editor.gradient(spray, c, 'colorMote', '먼지 그라데이션');
    R(spray, c, 'sparkRate', 0, 300, 1, '초당 불꽃');
    R(spray, c, 'sparkSize', 0.005, 0.4, 0.005, '불꽃 크기');
    R(spray, c, 'sparkLifetime', 0.05, 3, 0.01, '불꽃 수명');
    R(spray, c, 'sparkSpeed', 0, 20, 0.1, '불꽃 속도');
    R(spray, c, 'sparkGravity', -20, 5, 0.1, '불꽃 중력');
    R(spray, c, 'sparkStretch', 0, 2, 0.01, '불꽃 늘어남');
    R(spray, c, 'sparkGlow', 0, 4, 0.01, '불꽃 발광');
    R(spray, c, 'groundSparkRate', 0, 20, 0.1, '미터당 바닥 폭발');
    R(spray, c, 'groundSparks', 0, 40, 1, '개당 불꽃');
    Editor.gradient(spray, c, 'colorSpark', '불꽃 그라데이션');
    R(spray, c, 'warpStrength', 0, 3, 0.01, '공기 뒤틀림');
    R(spray, c, 'warpInflate', 0, 0.3, 0.005, '워프 외층(× body)');
    R(spray, c, 'warpScale', 0.1, 6, 0.05, '워프 스케일');
    R(spray, c, 'warpSpeed', 0, 6, 0.05, '워프 속도');

    /* ---- the strike ---- */
    const strike = folder.addFolder('일격·카메라·조명');
    R(strike, c, 'shatterSpread', 0, 1.5, 0.005, '투척 조각 (× body)');
    R(strike, c, 'shatterSpin', 0, 6, 0.05, '조각 회전');
    R(strike, c, 'shatterStagger', 0, 0.95, 0.01, '꼬리 해제 지연');
    R(strike, c, 'burstSize', 0.2, 12, 0.05, '외층 크기');
    R(strike, c, 'burstIntensity', 0, 5, 0.01, '외층 발광');
    R(strike, c, 'burstSparks', 0, 400, 1, '폭발 불꽃');
    R(strike, c, 'burstMotes', 0, 400, 1, '폭발 부유 입자');
    R(strike, c, 'shockRadius', 0.5, 16, 0.05, '충격 고리(m)');
    R(strike, c, 'arcRadius', 0.5, 16, 0.05, '호 화염 (m)');
    R(strike, c, 'arcIntensity', 0, 4, 0.01, '아크 발광');
    R(strike, c, 'arcLife', 0.1, 6, 0.05, '호 지속');
    R(strike, c, 'castBurst', 0.1, 6, 0.05, '발사층');
    R(strike, c, 'castBurstGlow', 0, 5, 0.01, '발사층 발광');
    R(strike, c, 'castSparks', 0, 300, 1, '발사 불꽃');
    R(strike, c, 'castFlash', 0, 1, 0.01, '발사 섬광');
    R(strike, c, 'impactFlash', 0, 1, 0.01, '착탄 섬광');
    R(strike, c, 'impactShake', 0, 1, 0.005, '착탄 흔들림');
    R(strike, c, 'shakeDuration', 0.05, 2, 0.01, '흔들림 감쇠');
    R(strike, c, 'rumble', 0, 0.3, 0.002, '비행 진동');
    R(strike, c, 'burnShake', 0, 0.3, 0.002, '파쇄 진동');
    strike.addColor(c, 'colorBurstA').name('껍질 안쪽');
    strike.addColor(c, 'colorBurstB').name('껍질 중간');
    strike.addColor(c, 'colorBurstC').name('껍질 바깥');
    strike.addColor(c, 'colorShockA').name('충격파 안쪽');
    strike.addColor(c, 'colorShockB').name('충격파 바깥쪽');
    strike.addColor(c, 'colorArcA').name('아크 화상');
    strike.addColor(c, 'colorArcB').name('아크 발광');
    strike.addColor(c, 'colorCastFlash').name('발사 섬광');
    strike.addColor(c, 'colorFlash').name('착탄 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 160, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightPulse', 0, 1, 0.01, '스텝 깊이');
    R(light, c, 'lightPulseSpeed', 1, 40, 0.5, '초당 스텝');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.cyberFolder = folder;
  }

  /**
   * The Venom Surge, grouped by the five panels of its breakdown sheet.
   *
   * The folder names are the panel names on purpose. Judging a stacked effect
   * means being able to look at one layer at a time, and the fastest way to do
   * that here is to walk down this folder zeroing `gasOpacity`, `dropSize`,
   * `seamGlow` and `coreOpacity` in turn — each one takes exactly one panel of
   * the reference out of the frame.
   *
   * Two units are in play. Anything about the **cast** is in metres; anything
   * named `slab*` is a fraction of the plate's own radius, because the Voronoi
   * is cut in unit space and scaled by one number. Mixing them up is the only
   * way to get lost in here.
   */
  _buildVenom() {
    const folder = this.gui.addFolder('☣  결정화 맹독 쇄도');
    const c = settings.venom;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'range', 4, 60, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 12, 0.1, '최소 사거리');
    R(cast, c, 'speed', 4, 90, 0.5, '틈새 속도 (m/s)');
    R(cast, c, 'lifetime', 0.2, 12, 0.05, '군집 지속');
    R(cast, c, 'cooldown', 0, 10, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    /* ---- panel 1 ---- */
    const gems = folder.addFolder('1 · 결정체');

    const seam = gems.addFolder('이음매');
    R(seam, c, 'widthNear', 0.05, 6, 0.01, '시전자 절반 너비 (m)');
    R(seam, c, 'width', 0.1, 10, 0.01, '끝단 절반 너비 (m)');
    R(seam, c, 'widthCurve', 0.2, 4, 0.01, '플레어 지연');
    R(seam, c, 'gemCount', 8, 336, 1, '시전당 보석');
    R(seam, c, 'density', 0.05, 1.5, 0.01, '밀도');
    R(seam, c, 'burstShare', 0, 0.9, 0.01, '스타버스트용 보류');
    R(seam, c, 'clumping', 0.3, 4, 0.01, '중심선 인력');
    R(seam, c, 'scatter', 0, 2, 0.01, '측면 지터');
    R(seam, c, 'frontBias', 0.2, 3, 0.01, '착탄 집중');
    R(seam, c, 'heightNear', 0.05, 4, 0.01, '시전자 높이 (m)');
    R(seam, c, 'height', 0.1, 10, 0.05, '끝단 높이 (m)');
    R(seam, c, 'heightCurve', 0.2, 5, 0.01, '상승 지연');
    R(seam, c, 'peak', 0.5, 3, 0.01, '착탄 팽창');
    R(seam, c, 'peakWidth', 0.02, 1, 0.01, '팽창 도달 거리');
    R(seam, c, 'rubble', 0, 1, 0.01, '파편 비율');
    R(seam, c, 'lean', 0, 1.4, 0.01, '시전자 반대 기울임 (rad)');

    const burst = gems.addFolder('성폭');
    R(burst, c, 'burstRadius', 0.2, 10, 0.05, '군집 반경 (m)');
    R(burst, c, 'burstHeight', 0.2, 12, 0.05, '중심 높이 (m)');
    R(burst, c, 'crown', 0, 1, 0.01, '스커트 단축량');
    R(burst, c, 'burstLean', 0, 1.6, 0.01, '가장자리 바깥 기울기 (rad)');
    R(burst, c, 'burstLeanCurve', 0.2, 3, 0.01, '기울임 시작 시점');
    R(burst, c, 'spearShare', 0, 0.6, 0.01, '창 비율');
    R(burst, c, 'spearScale', 1, 4, 0.05, '창 높이');
    R(burst, c, 'spearSlim', 0.2, 1.5, 0.01, '창 가늘기');
    R(burst, c, 'shardShare', 0, 0.8, 0.01, '스커트 파편 비율');
    R(burst, c, 'shardScale', 0.05, 1, 0.01, '파편 높이');
    R(burst, c, 'burstStagger', 0, 1, 0.01, '중간 대비 가장자리 지연');

    const shape = gems.addFolder('단일 보석');
    R(shape, c, 'radius', 0.02, 1.5, 0.005, '바닥 반경 (m)');
    R(shape, c, 'radiusJitter', 0, 2, 0.01, '반경 지터');
    R(shape, c, 'heightJitter', 0, 2, 0.01, '높이 지터');
    R(shape, c, 'leanJitter', 0, 3, 0.01, '기울임 지터');
    R(shape, c, 'taper', 0.01, 0.6, 0.005, '끝 반경(×base)');
    R(shape, c, 'facets', 3, 12, 1, '패싯');
    R(shape, c, 'gemRough', 0, 0.8, 0.005, '패싯 거칠기');
    R(shape, c, 'bend', 0, 1.2, 0.005, '끝단 휨');
    R(shape, c, 'twist', 0, 1, 0.01, '무작위 요');

    const rise = gems.addFolder('분출');
    R(rise, c, 'riseTime', 0.02, 1.2, 0.005, '상승 시간');
    R(rise, c, 'riseOvershoot', 0, 1, 0.005, '최대 높이 돌파');
    R(rise, c, 'riseStagger', 0, 1, 0.005, '이웃 간 시차');
    R(rise, c, 'settle', 0.05, 2, 0.01, '복귀 착석 (s)');
    R(rise, c, 'shatterDelay', 0, 3, 0.01, '해제 전 대기');
    R(rise, c, 'sinkTime', 0.1, 4, 0.01, '철수 시간');

    const stone = gems.addFolder('자수정');
    R(stone, c, 'gemOpacity', 0, 1, 0.01, '불투명도');
    R(stone, c, 'gemRoughness', 0, 1, 0.01, '표면 거칠기');
    R(stone, c, 'depthTint', 0, 4, 0.01, '두께 틴트');
    R(stone, c, 'fresnel', 0, 6, 0.01, '프레넬');
    R(stone, c, 'fresnelPower', 0.5, 8, 0.05, '프레넬 밀집도');
    R(stone, c, 'dispersion', 0, 2, 0.01, '가장자리 분산');
    R(stone, c, 'facetSharp', 0, 1.5, 0.01, '패싯 대비');
    R(stone, c, 'cleave', 0, 2, 0.01, '내부 파단');
    R(stone, c, 'cleaveScale', 0.5, 24, 0.1, '파단 스케일');
    R(stone, c, 'venomGlow', 0, 6, 0.01, '맹독 밝기');
    R(stone, c, 'venomScale', 0.2, 14, 0.05, '맹독 스케일');
    R(stone, c, 'venomFlow', -3, 3, 0.01, '맹독 표류');
    R(stone, c, 'venomBase', 0, 2, 0.01, '끝단 잔존량');
    R(stone, c, 'venomSharp', 0.5, 10, 0.05, '실-워시 비율');
    R(stone, c, 'tipFrost', 0, 1.5, 0.01, '서리 끝');
    R(stone, c, 'tipStart', 0, 1, 0.01, '서리 시작점');
    R(stone, c, 'glint', 0, 4, 0.01, '표면 반짝임');
    R(stone, c, 'glintScale', 4, 90, 0.5, '반짝임 스케일');
    R(stone, c, 'glintSpeed', 0, 4, 0.01, '반짝임 속도');
    R(stone, c, 'gemGlow', 0, 4, 0.01, '방출 이득');
    R(stone, c, 'edgeGlow', 0, 4, 0.01, '실루엣 림');
    R(stone, c, 'birthGlow', 0, 8, 0.05, '탄생 섬광');
    R(stone, c, 'birthFade', 0.02, 2, 0.01, '탄생 섬광 지속');
    R(stone, c, 'envIntensity', 0, 3, 0.01, '프로브 반사');
    stone.addColor(c, 'colorDeep').name('심층');
    stone.addColor(c, 'colorGem').name('몸통');
    stone.addColor(c, 'colorGemRim').name('가장자리');
    stone.addColor(c, 'colorGemTip').name('서리 끝');
    stone.addColor(c, 'colorVenom').name('맹독');

    /* ---- panel 2 ---- */
    const gas = folder.addFolder('2 · 기체');
    R(gas, c, 'gasRate', 0, 900, 5, '전방 초당 퍼프');
    R(gas, c, 'gasSize', 0.05, 4, 0.01, '퍼프 크기');
    R(gas, c, 'gasSpread', 0.2, 10, 0.05, '부풀음 거리');
    R(gas, c, 'gasSpeed', 0, 8, 0.05, '퍼프 속도');
    R(gas, c, 'gasLifetime', 0.1, 8, 0.05, '퍼프 수명');
    R(gas, c, 'gasOpacity', 0, 0.6, 0.002, '불투명도');
    R(gas, c, 'gasRise', -1, 3, 0.01, '상승 (m/s)');
    R(gas, c, 'gasTurbulence', 0, 3, 0.01, '난류');
    R(gas, c, 'standingGas', 0, 2, 0.01, '기립 후 비율');
    R(gas, c, 'breachGasChance', 0, 1, 0.01, '보석 분출 확률');
    R(gas, c, 'burstGas', 0, 400, 1, '착탄 퍼프');
    Editor.gradient(gas, c, 'colorGas', '기체 그라데이션');

    /* ---- panel 3 ---- */
    const drops = folder.addFolder('3 · 물방울');
    R(drops, c, 'dropSize', 0.005, 0.4, 0.005, '구슬 크기');
    R(drops, c, 'dropSpeed', 0, 20, 0.1, '구슬 속도');
    R(drops, c, 'dropLifetime', 0.05, 4, 0.01, '구슬 수명');
    R(drops, c, 'dropGravity', -30, 2, 0.1, '중력');
    R(drops, c, 'dropGlow', 0, 4, 0.01, '젖은 광택');
    R(drops, c, 'breachDrops', 0, 20, 1, '보석별 튐');
    R(drops, c, 'burstDrops', 0, 400, 1, '착탄 분수');
    R(drops, c, 'shatterDrops', 0, 20, 1, '보석당 투척');
    R(drops, c, 'dripRate', 0, 60, 0.5, '끝단 초당 물방울');
    Editor.gradient(drops, c, 'colorDrop', '물방울 그라데이션');

    const motes = drops.addFolder('공중 반짝임');
    R(motes, c, 'moteRate', 0, 500, 1, '초당 부유 입자');
    R(motes, c, 'moteSize', 0.005, 0.3, 0.005, '부유 입자 크기');
    R(motes, c, 'moteSpeed', 0, 16, 0.1, '부유 입자 속도');
    R(motes, c, 'moteLifetime', 0.1, 6, 0.05, '부유 입자 수명');
    R(motes, c, 'moteRise', -2, 6, 0.05, '상승 (m/s)');
    R(motes, c, 'moteTurbulence', 0, 3, 0.01, '난류');
    R(motes, c, 'moteGlow', 0, 4, 0.01, '발광');
    R(motes, c, 'burstMotes', 0, 500, 1, '착탄 부유 입자');
    R(motes, c, 'shatterMotes', 0, 20, 1, '보석 발사 부유 입자');
    Editor.gradient(motes, c, 'colorMote', '먼지 그라데이션');

    /* ---- panel 4 ---- */
    const cracks = folder.addFolder('4 · 균열');
    R(cracks, c, 'plateRadius', 0.3, 12, 0.05, '판 반경 (m)');
    R(cracks, c, 'slabCount', 6, 140, 1, '조각 (re-cuts)');
    R(cracks, c, 'slabDepth', 0.01, 0.4, 0.005, '두께(×반경, 재절단)');
    R(cracks, c, 'slabBias', 0.15, 1.2, 0.01, '중앙 미세화 (재절단)');
    R(cracks, c, 'slabRagged', 0, 0.6, 0.005, '들쭉날쭉 외곽선 (re-cuts)');
    R(cracks, c, 'slabGap', 0, 0.3, 0.002, '틈새 너비 (× 반경)');
    R(cracks, c, 'slabHeave', 0, 0.4, 0.002, '융기 (× radius)');
    R(cracks, c, 'slabTilt', 0, 1.2, 0.005, '기울임 (rad)');
    R(cracks, c, 'slabGrowth', 0.5, 40, 0.1, '파단 속도 (m/s)');
    R(cracks, c, 'seamGlow', 0, 8, 0.05, '틈새 빛');
    R(cracks, c, 'seamReach', 0, 0.5, 0.005, '가장자리 넘침');
    R(cracks, c, 'stoneGrain', 0, 2, 0.01, '결');
    R(cracks, c, 'stoneGrainScale', 0.5, 30, 0.1, '결 스케일');
    R(cracks, c, 'stoneSpeck', 0, 1.5, 0.01, '얼룩점');
    R(cracks, c, 'stoneLip', 0, 1.5, 0.01, '신규 파단면');
    cracks.addColor(c, 'colorStone').name('돌');
    cracks.addColor(c, 'colorStoneDark').name('돌 그림자');
    cracks.addColor(c, 'colorSeam').name('이음 빛');
    cracks.addColor(c, 'colorStain').name('맹독 얼룩');

    const marks = cracks.addFolder('선상 표식');
    R(marks, c, 'crackRate', 0, 12, 0.1, '미터당 자국');
    R(marks, c, 'crackSpread', 0.1, 5, 0.05, '자국 반경 (× 절반 너비)');
    R(marks, c, 'crackLife', 0.2, 20, 0.1, '자국 지속');
    R(marks, c, 'crackWidth', 0, 1, 0.01, '가지 너비');
    R(marks, c, 'crackIntensity', 0, 3, 0.01, '강도');
    marks.addColor(c, 'colorCrackA').name('탄 돌');
    marks.addColor(c, 'colorCrackB').name('표식 발광');

    /* ---- panel 5 ---- */
    const glow = folder.addFolder('5 · 발광');
    R(glow, c, 'coreHeight', 0, 6, 0.01, '바닥 위 높이 (m)');
    R(glow, c, 'coreSize', 0.05, 6, 0.01, '커널 반경 (m)');
    R(glow, c, 'coreSwell', 0.02, 1, 0.01, '초기 크기');
    R(glow, c, 'coreFalloff', 0.2, 8, 0.05, '농도');
    R(glow, c, 'coreIntensity', 0, 10, 0.05, '커널 강도');
    R(glow, c, 'coreOpacity', 0, 2, 0.01, '커널 불투명도');
    R(glow, c, 'coreBillow', 0, 0.8, 0.005, '부풀음');
    R(glow, c, 'coreBillowScale', 0.2, 10, 0.05, '부풀음 규모');
    R(glow, c, 'coreBreak', 0, 1, 0.01, '분해');
    R(glow, c, 'coreBreakScale', 0.2, 12, 0.05, '분해 규모');
    R(glow, c, 'coreBreakSpeed', -4, 4, 0.05, '분해 이동');
    R(glow, c, 'coreFlow', -3, 3, 0.01, '부풀음 이동');
    R(glow, c, 'coreFlicker', 0, 1, 0.005, '깜빡임');
    R(glow, c, 'coreFlickerSpeed', 0.5, 30, 0.1, '깜빡임 속도');
    R(glow, c, 'coreSoftFade', 0.05, 3, 0.01, '부드러운 페이드(m)');
    R(glow, c, 'coreFlare', 0.02, 2, 0.01, '도달 섬광 지속');
    R(glow, c, 'coreFlarePunch', 0, 6, 0.05, '도달 오버슈트');
    R(glow, c, 'coreHold', 0, 1.5, 0.01, '안정값');
    R(glow, c, 'coreBleed', 0, 5, 0.01, '보석 빛 강도');
    R(glow, c, 'coreBleedRadius', 0.2, 14, 0.05, '빛 도달(m)');
    glow.addColor(c, 'colorCore').name('낟알 중심');
    glow.addColor(c, 'colorCoreMid').name('낟알 몸통');
    glow.addColor(c, 'colorCoreEdge').name('낟알 가장자리');

    const halo = glow.addFolder('후광');
    R(halo, c, 'haloScale', 1, 8, 0.05, '반경 (× kernel)');
    R(halo, c, 'haloFalloff', 0.2, 6, 0.05, '농도');
    R(halo, c, 'haloIntensity', 0, 6, 0.01, '강도');
    R(halo, c, 'haloOpacity', 0, 2, 0.01, '불투명도');
    R(halo, c, 'haloBillow', 0, 0.8, 0.005, '부풀음');
    R(halo, c, 'haloBillowScale', 0.2, 10, 0.05, '부풀음 규모');
    R(halo, c, 'haloBreak', 0, 1, 0.01, '분해');
    halo.addColor(c, 'colorHaloCore').name('후광 중심');
    halo.addColor(c, 'colorHaloMid').name('후광 몸통');
    halo.addColor(c, 'colorHaloEdge').name('후광 가장자리');

    const strike = folder.addFolder('일격·카메라·조명');
    R(strike, c, 'burstSize', 0.2, 14, 0.05, '가스층 크기');
    R(strike, c, 'burstIntensity', 0, 4, 0.01, '가스층 발광');
    R(strike, c, 'shockRadius', 0.5, 16, 0.05, '충격 고리(m)');
    R(strike, c, 'impactShake', 0, 1, 0.005, '착탄 흔들림');
    R(strike, c, 'shakeDuration', 0.05, 2, 0.01, '흔들림 감쇠');
    R(strike, c, 'rumble', 0, 0.3, 0.002, '이동 럼블');
    R(strike, c, 'impactFlash', 0, 1, 0.01, '착탄 섬광');
    strike.addColor(c, 'colorBurstA').name('껍질 안쪽');
    strike.addColor(c, 'colorBurstB').name('껍질 중간');
    strike.addColor(c, 'colorBurstC').name('껍질 바깥');
    strike.addColor(c, 'colorShockA').name('충격파 안쪽');
    strike.addColor(c, 'colorShockB').name('충격파 바깥쪽');
    strike.addColor(c, 'colorFlash').name('착탄 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 160, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightWaver', 0, 1, 0.01, '떨림 깊이');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.venomFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  _buildQuake() {
    const folder = this.gui.addFolder('▲  브루탈 대지 폭발');
    const c = settings.quake;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'range', 4, 60, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 12, 0.1, '최소 사거리');
    R(cast, c, 'speed', 4, 90, 0.5, '파열 속도 (m/s)');
    R(cast, c, 'lifetime', 0.2, 14, 0.05, '군집 지속');
    R(cast, c, 'cooldown', 0, 10, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    /* ---- panel 1 ---- */
    const stone = folder.addFolder('1 · 모놀리스');

    const rift = stone.addFolder('리프트');
    R(rift, c, 'widthNear', 0.05, 6, 0.01, '시전자 절반 너비 (m)');
    R(rift, c, 'width', 0.1, 10, 0.01, '끝단 절반 너비 (m)');
    R(rift, c, 'widthCurve', 0.2, 4, 0.01, '플레어 지연');
    R(rift, c, 'stoneCount', 8, 280, 1, '시전당 돌');
    R(rift, c, 'density', 0.05, 1.5, 0.01, '밀도');
    R(rift, c, 'blastShare', 0, 0.9, 0.01, '클러스터용 보류');
    R(rift, c, 'clumping', 0.3, 4, 0.01, '중심선 인력');
    R(rift, c, 'scatter', 0, 2, 0.01, '측면 지터');
    R(rift, c, 'frontBias', 0.2, 3, 0.01, '착탄 집중');
    R(rift, c, 'heightNear', 0.05, 4, 0.01, '시전자 높이 (m)');
    R(rift, c, 'height', 0.1, 10, 0.05, '끝단 높이 (m)');
    R(rift, c, 'heightCurve', 0.2, 5, 0.01, '상승 지연');
    R(rift, c, 'peak', 0.5, 3, 0.01, '착탄 팽창');
    R(rift, c, 'peakWidth', 0.02, 1, 0.01, '팽창 도달 거리');
    R(rift, c, 'rubble', 0, 1, 0.01, '블록 비율');
    R(rift, c, 'lean', 0, 1.4, 0.01, '전면 후방 전단(rad)');

    const cluster = stone.addFolder('군집');
    R(cluster, c, 'blastRadius', 0.2, 12, 0.05, '군집 반경 (m)');
    R(cluster, c, 'blastHeight', 0.2, 14, 0.05, '중심 높이 (m)');
    R(cluster, c, 'crown', 0, 1, 0.01, '스커트 단축량');
    R(cluster, c, 'blastLean', 0, 1.6, 0.01, '가장자리 기울임 (rad)');
    R(cluster, c, 'blastLeanCurve', 0.2, 3, 0.01, '경사 시작 시점');
    R(cluster, c, 'blastLeanScatter', 0, 3.2, 0.01, '기울임 방향 산란 (rad)');
    R(cluster, c, 'blastStagger', 0, 1, 0.005, '가장자리 지연 (s)');
    R(cluster, c, 'monolithShare', 0, 0.6, 0.01, '모놀리스 비율');
    R(cluster, c, 'monolithScale', 1, 4, 0.05, '모놀리스 높이');
    R(cluster, c, 'monolithGirth', 0.4, 3, 0.05, '모놀리스 질량');
    R(cluster, c, 'blockShare', 0, 0.8, 0.01, '스커트 블록 비율');
    R(cluster, c, 'blockScale', 0.05, 1, 0.01, '블록 높이');

    const shape = stone.addFolder('단일 석판');
    R(shape, c, 'radius', 0.02, 2, 0.005, '범위 반경 (m)');
    R(shape, c, 'radiusJitter', 0, 1.5, 0.01, '반경 지터');
    R(shape, c, 'heightJitter', 0, 1.5, 0.01, '높이 지터');
    R(shape, c, 'leanJitter', 0, 2, 0.01, '기울임 지터');
    R(shape, c, 'twist', 0, 1, 0.01, '무작위 요');
    R(shape, c, 'sides', 4, 8, 1, '범위 정점');
    R(shape, c, 'taper', 0.2, 1, 0.01, '상단 너비');
    R(shape, c, 'flatten', 0.12, 1, 0.01, '벽↔기둥');
    R(shape, c, 'chip', 0, 0.8, 0.01, '범위 불규칙도');
    R(shape, c, 'shear', 0, 0.8, 0.01, '파괴면 기울기');
    R(shape, c, 'bevel', 0, 0.4, 0.005, '파괴 가장자리 모따기');
    R(shape, c, 'stoneBend', 0, 0.5, 0.01, '축 이동');

    const rise = stone.addFolder('분출');
    R(rise, c, 'riseTime', 0.02, 1.2, 0.005, '상승 시간 (s)');
    R(rise, c, 'riseOvershoot', 0, 1, 0.01, '펀치 오버슈트');
    R(rise, c, 'riseStagger', 0, 1, 0.005, '이웃 지연 (s)');
    R(rise, c, 'settle', 0.05, 2, 0.01, '복귀 착석 (s)');
    R(rise, c, 'sinkDelay', 0, 4, 0.02, '가라앉기 전 지연 (s)');
    R(rise, c, 'sinkTime', 0.05, 5, 0.02, '가라앉음 시간(s)');

    const surface = stone.addFolder('석재 표면');
    R(surface, c, 'texScale', 0.2, 12, 0.05, '타일당 미터');
    R(surface, c, 'texAmount', 0, 1, 0.01, '스캔 ↔ 프로시저럴');
    R(surface, c, 'normalScale', 0, 4, 0.01, '노멀 강도');
    R(surface, c, 'stoneRough', 0, 2, 0.01, '거칠기 게인');
    R(surface, c, 'stoneRoughFloor', 0, 1, 0.01, '최소 거칠기');
    R(surface, c, 'stoneAO', 0, 1, 0.01, '오클루전');
    R(surface, c, 'envIntensity', 0, 3, 0.01, '환경 (IBL)');
    R(surface, c, 'stoneDesat', 0, 1, 0.01, '스캔 채도 제거');
    R(surface, c, 'stoneGrade', 0, 1, 0.01, '콘크리트 색보정');
    surface.addColor(c, 'colorStoneGrade').name('콘크리트 색조');
    R(surface, c, 'breakPale', 0, 1.5, 0.01, '신규 파단 창백화');
    R(surface, c, 'grime', 0, 1.5, 0.01, '풍화 줄무늬');
    R(surface, c, 'damp', 0, 1.5, 0.01, '젖은 뿌리');
    R(surface, c, 'dampHeight', 0.01, 1, 0.01, '뿌리 도달 높이');
    R(surface, c, 'dustCoat', 0, 1.5, 0.01, '침전 먼지');
    R(surface, c, 'dustCoatSharp', 0.05, 6, 0.05, '상향 조건');
    R(surface, c, 'dustCoatScale', 0.1, 8, 0.05, '코팅 얼룩');
    R(surface, c, 'coatDelay', 0, 3, 0.01, '정착 전 지연 (s)');
    R(surface, c, 'coatTime', 0.05, 8, 0.05, '축적 소요(s)');
    surface.addColor(c, 'colorStone').name('예비 밝음');
    surface.addColor(c, 'colorStoneDeep').name('예비 어둠');
    surface.addColor(c, 'colorDustCoat').name('먼지 피막');
    surface.addColor(c, 'colorDamp').name('젖은 뿌리');

    /* ---- panel 2 ---- */
    const dust = folder.addFolder('2 · 시멘트 먼지');
    R(dust, c, 'dustRate', 0, 900, 1, '전방 비율');
    R(dust, c, 'dustSize', 0.05, 6, 0.01, '퍼프 크기');
    R(dust, c, 'dustSpread', 0.5, 12, 0.05, '수명 기간 성장');
    R(dust, c, 'dustSpeed', 0, 12, 0.05, '속도');
    R(dust, c, 'dustLifetime', 0.2, 12, 0.05, '수명');
    R(dust, c, 'dustOpacity', 0, 0.6, 0.002, '불투명도');
    R(dust, c, 'dustRise', -2, 2, 0.01, '상승 (음수면 하강)');
    R(dust, c, 'dustTurbulence', 0, 3, 0.01, '난류');
    R(dust, c, 'dustDrag', 0, 6, 0.01, '저항');
    R(dust, c, 'breachDust', 0, 30, 1, '관통석당');
    R(dust, c, 'settleDust', 0, 2, 0.01, '기립 후 비율');
    R(dust, c, 'plumeDust', 0, 400, 1, '연기 폭발');
    R(dust, c, 'plumeSpeed', 0, 20, 0.1, '연기 속도');
    Editor.gradient(dust, c, 'colorDust', '먼지 그라데이션');

    const ring = dust.addFolder('구르는 고리');
    R(ring, c, 'ringRate', 0, 3000, 10, '고리 전체 비율');
    R(ring, c, 'ringJets', 4, 48, 1, '방출점');
    R(ring, c, 'ringRadius', 0.5, 24, 0.1, '도달거리 (m)');
    R(ring, c, 'ringSpeed', 0, 24, 0.1, '바깥쪽 속도 (m/s)');
    R(ring, c, 'ringLift', 0, 1.5, 0.01, '상승 비중');
    R(ring, c, 'ringSize', 0.1, 8, 0.05, '퍼프 크기');
    R(ring, c, 'ringThickness', 0.05, 4, 0.05, '띠 깊이 (m)');
    R(ring, c, 'ringTime', 0.1, 3, 0.02, '구름 시간 (s)');

    /* ---- panel 3 ---- */
    const shrapnel = folder.addFolder('3 · 기하 파편');
    R(shrapnel, c, 'shrapnelCount', 0, 96, 1, '투척 덩어리');
    R(shrapnel, c, 'shrapnelSize', 0.02, 1.2, 0.005, '덩어리 반경 (m)');
    R(shrapnel, c, 'shrapnelSizeJitter', 0, 0.95, 0.01, '크기 지터');
    R(shrapnel, c, 'shrapnelSpeed', 0, 40, 0.1, '발사 속도 (m/s)');
    R(shrapnel, c, 'shrapnelSpread', 0, 3, 0.01, '바깥쪽 비율');
    R(shrapnel, c, 'shrapnelLift', 0, 3, 0.01, '상승 비중');
    R(shrapnel, c, 'shrapnelGravity', -60, 0, 0.5, '중력');
    R(shrapnel, c, 'shrapnelSpin', 0, 30, 0.1, '텀블(rad/s)');
    R(shrapnel, c, 'shrapnelBounce', 0, 0.9, 0.01, '반발');
    R(shrapnel, c, 'shrapnelFriction', 0, 1, 0.01, '바닥 마찰');
    R(shrapnel, c, 'shrapnelPuffSpeed', 0, 20, 0.1, '퍼프 임계값 (m/s)');
    R(shrapnel, c, 'shrapnelDarken', 0, 0.9, 0.01, '실루엣 어둡게');
    R(shrapnel, c, 'shrapnelTexScale', 0.05, 2, 0.01, '결 스케일 × stone');

    const grit = shrapnel.addFolder('모래 입자');
    R(grit, c, 'gritRate', 0, 400, 1, '전방 비율');
    R(grit, c, 'gritSize', 0.005, 0.4, 0.005, '파편 크기');
    R(grit, c, 'gritSpeed', 0, 24, 0.1, '속도');
    R(grit, c, 'gritGravity', -60, 0, 0.5, '중력');
    R(grit, c, 'gritLifetime', 0.1, 6, 0.05, '수명');
    R(grit, c, 'breachGrit', 0, 30, 1, '관통석당');
    R(grit, c, 'blastGrit', 0, 600, 1, '착탄 투척');
    R(grit, c, 'trickleRate', 0, 80, 0.5, '면 낙수');
    Editor.gradient(grit, c, 'colorGrit', '모래 그라데이션');

    const motes = shrapnel.addFolder('부유 분말');
    R(motes, c, 'moteRate', 0, 300, 1, '비율');
    R(motes, c, 'moteSize', 0.01, 0.8, 0.005, '크기');
    R(motes, c, 'moteLifetime', 0.2, 12, 0.05, '수명');
    R(motes, c, 'moteFall', -2, 2, 0.01, '낙하 (음수 = 정착)');
    R(motes, c, 'moteTurbulence', 0, 3, 0.01, '난류');
    R(motes, c, 'moteGlow', 0, 3, 0.01, '발광 — 낮게 유지');
    R(motes, c, 'moteOpacity', 0, 1, 0.01, '불투명도');
    R(motes, c, 'blastMotes', 0, 600, 1, '착탄 투척');
    Editor.gradient(motes, c, 'colorMote', '분말 그라데이션');

    /* ---- panel 4 ---- */
    const scars = folder.addFolder('4 · 갈라진 흉터');

    const crater = scars.addFolder('분화구');
    R(crater, c, 'craterRadius', 0.3, 14, 0.05, '분화구 반경 (m)');
    R(crater, c, 'plateCells', 8, 140, 1, '조각');
    R(crater, c, 'plateDepth', 0.01, 0.4, 0.005, '슬래브 두께×반경');
    R(crater, c, 'plateBias', 0.15, 1.2, 0.01, '중앙 미세도');
    R(crater, c, 'plateRagged', 0, 0.6, 0.01, '외곽선 거칠기');
    R(crater, c, 'plateGap', 0, 0.3, 0.005, '틈새 열림');
    R(crater, c, 'plateHeave', 0, 0.4, 0.005, '융기 × radius');
    R(crater, c, 'plateTilt', 0, 1.4, 0.01, '조각 기울임 (rad)');
    R(crater, c, 'plateGrowth', 0.5, 40, 0.1, '파단 속도 (m/s)');
    R(crater, c, 'plateWallDark', 0, 1, 0.01, '균열 음영 깊이');
    R(crater, c, 'plateSeamDust', 0, 1.5, 0.01, '틈새 가루');
    R(crater, c, 'plateCoat', 0, 1.5, 0.01, '가라앉은 먼지 몫');

    const cracks = scars.addFolder('균열');
    R(cracks, c, 'fissureRadius', 0.5, 24, 0.1, '도달거리 (m)');
    R(cracks, c, 'fissureLife', 0.5, 30, 0.1, '잔류 시간 (s)');
    R(cracks, c, 'fissureArms', 2, 14, 1, '주 팔다리');
    R(cracks, c, 'fissureWander', 0, 4, 0.01, '팔 휘어짐 강도');
    R(cracks, c, 'fissureWidth', 0.05, 3, 0.01, '리본 너비 (m)');
    R(cracks, c, 'fissureBranches', 0, 1, 0.01, '가지 밀도');
    R(cracks, c, 'fissureBranchLength', 0, 1, 0.01, '가지 길이');
    R(cracks, c, 'fissureOpen', 0.02, 0.9, 0.01, '열림 ÷ 리본');
    R(cracks, c, 'fissureLip', 0, 2, 0.01, '먼지 테두리');
    R(cracks, c, 'fissureDepth', 0, 1, 0.01, '개구부 어둠');
    R(cracks, c, 'fissureBreak', 0, 1, 0.01, '가장자리 분해');
    R(cracks, c, 'fissureBreakScale', 0.2, 8, 0.05, '분해 규모');
    R(cracks, c, 'fissureGrowth', 1, 60, 0.5, '성장 속도 (m/s)');
    cracks.addColor(c, 'colorFissure').name('어둠');
    cracks.addColor(c, 'colorFissureLip').name('먼지 테두리');

    const marks = scars.addFolder('선상 표식');
    R(marks, c, 'scarRate', 0.1, 12, 0.05, '미터당 자국');
    R(marks, c, 'scarSpread', 0.2, 5, 0.05, '자국 반경 × 절반 너비');
    R(marks, c, 'scarLife', 0.5, 30, 0.1, '잔류 시간 (s)');
    R(marks, c, 'scarWidth', 0.05, 2, 0.01, '가지 너비');
    R(marks, c, 'scarIntensity', 0, 2, 0.01, '강도');
    marks.addColor(c, 'colorScarA').name('깨진 돌');
    marks.addColor(c, 'colorScarB').name('표식 강조');

    /* ---- panel 5 ---- */
    const air = folder.addFolder('5 · 움직이는 공기');
    R(air, c, 'warpLife', 0.1, 5, 0.05, '지속 시간 (s)');
    R(air, c, 'warpRadius', 0.5, 30, 0.1, '고리 도달거리 (m)');
    R(air, c, 'warpThickness', 0.05, 4, 0.05, '파도 묶음 깊이(m)');
    R(air, c, 'warpRipples', 0.5, 30, 0.1, '내부 띠');
    R(air, c, 'warpChop', 0, 3, 0.01, '파면 분해(m)');
    R(air, c, 'warpChopScale', 0.2, 10, 0.05, '분해 규모');
    R(air, c, 'warpStrength', 0, 6, 0.01, '고리 강도');
    R(air, c, 'warpColumn', 0, 6, 0.01, '기둥 강도');
    R(air, c, 'warpColumnWidth', 0.5, 20, 0.1, '기둥 너비 (m)');
    R(air, c, 'warpColumnHeight', 0.5, 20, 0.1, '기둥 높이 (m)');
    R(air, c, 'warpScale', 0.1, 8, 0.05, '교반 규모');
    R(air, c, 'warpSpeed', 0, 10, 0.05, '교반 속도');

    /* ---- the strike ---- */
    const strike = folder.addFolder('일격·카메라·조명');
    R(strike, c, 'shockRadius', 0.5, 20, 0.05, '충격 고리(m)');
    R(strike, c, 'impactShake', 0, 1.5, 0.005, '착탄 흔들림');
    R(strike, c, 'shakeDuration', 0.05, 3, 0.01, '흔들림 감쇠');
    R(strike, c, 'rumble', 0, 0.3, 0.002, '이동 럼블');
    R(strike, c, 'impactFlash', 0, 1, 0.005, '착탄 섬광');
    strike.addColor(c, 'colorShockA').name('충격파 안쪽');
    strike.addColor(c, 'colorShockB').name('충격파 바깥쪽');
    strike.addColor(c, 'colorFlash').name('착탄 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 160, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightSettle', 0, 1, 0.01, '낙하 거리');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.quakeFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  _buildInk() {
    const folder = this.gui.addFolder('🖌  수묵 조류');
    const c = settings.ink;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 0.5, 14, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 300, 1, '획 속도');
    R(cast, c, 'floodTime', 0.05, 3, 0.01, '범람 시간');
    R(cast, c, 'drainTime', 0.05, 4, 0.01, '목 열림 지연');
    R(cast, c, 'lifetime', 0.2, 16, 0.05, '유지 시간');
    R(cast, c, 'fadeTime', 0.05, 6, 0.01, '배출 시간');
    R(cast, c, 'cooldown', 0, 8, 0.05, '재사용 대기시간');
    Editor.castAnimation(cast, c);

    const swell = folder.addFolder('팽창');
    R(swell, c, 'swellRate', 0.05, 6, 0.05, '엔벨로프 속도');
    R(swell, c, 'swellSharp', 0.2, 6, 0.05, '서지 선예도');
    R(swell, c, 'swellDepth', 0, 2, 0.01, '변조 깊이');
    R(swell, c, 'tideThreshold', 0.05, 0.98, 0.01, '서지 임계값');
    R(swell, c, 'tideRipple', 0, 3, 0.01, '잔물결 밝기');
    R(swell, c, 'tideSpray', 0, 200, 1, '서지당 스프레이');
    R(swell, c, 'tideShake', 0, 0.5, 0.002, '카메라 충격');

    const stroke = folder.addFolder('붓놀림');
    R(stroke, c, 'handHeight', 0, 2.5, 0.01, '손 높이');
    R(stroke, c, 'handForward', -1, 3, 0.01, '손 전방');
    R(stroke, c, 'handSide', -1.5, 1.5, 0.01, '손 쪽');
    R(stroke, c, 'trailInk', 0, 200, 1, '미터당 반점');
    R(stroke, c, 'trailSpray', 0, 200, 1, 'm당 스프레이');

    const paper = folder.addFolder('종이 번짐');
    R(paper, c, 'washRadius', 0.5, 3, 0.01, '시트 반경');
    R(paper, c, 'washOpacity', 0, 1.5, 0.01, '불투명도');
    R(paper, c, 'washBleed', 0.02, 3, 0.01, '가장자리 번짐');
    R(paper, c, 'washDeckle', 0, 1, 0.01, '찢긴 가장자리');
    R(paper, c, 'washDeckleScale', 0.2, 8, 0.05, '찢김 스케일');
    R(paper, c, 'washTooth', 0, 1.5, 0.01, '종이결');
    R(paper, c, 'washToothScale', 0.5, 20, 0.1, 'm당 이빨');
    R(paper, c, 'washFibre', 0, 1, 0.01, '섬유');
    R(paper, c, 'washFibreScale', 0.2, 8, 0.05, '섬유 스케일');
    R(paper, c, 'washDry', 0, 1, 0.01, '건조 잔존');
    paper.addColor(c, 'colorPaper').name('종이');
    paper.addColor(c, 'colorPaperShade').name('종이(음영)');

    const ink = folder.addFolder('먹');
    R(ink, c, 'inkRadius', 0.2, 2, 0.01, '웅덩이 반경');
    R(ink, c, 'inkOpacity', 0, 1.5, 0.01, '불투명도');
    R(ink, c, 'inkFeather', 0.01, 1.5, 0.005, '가장자리 페더');
    R(ink, c, 'inkTendril', 0, 1.5, 0.01, '스며든 가지');
    R(ink, c, 'inkTendrilScale', 0.2, 12, 0.05, '손가락 스케일');
    R(ink, c, 'inkEdge', 0, 2, 0.01, '가닥 림');
    R(ink, c, 'inkEdgeWidth', 0.02, 2, 0.01, '가장자리 너비');
    R(ink, c, 'granulation', 0, 1.5, 0.01, '과립');
    R(ink, c, 'granulationScale', 0.5, 20, 0.1, '과립 스케일');
    R(ink, c, 'inkSwirl', 0, 5, 0.01, '베일 감김');
    R(ink, c, 'inkVeil', 0, 2, 0.01, '수중 먹');
    R(ink, c, 'inkVeilScale', 0.05, 4, 0.01, '베일 스케일');
    R(ink, c, 'inkVeilSharp', 0.2, 8, 0.05, '가닥 선예도');
    ink.addColor(c, 'colorInk').name('안료');
    ink.addColor(c, 'colorInkWash').name('묽은 먹');

    const water = folder.addFolder('물');
    R(water, c, 'waterOpacity', 0, 1.5, 0.01, '불투명도');
    R(water, c, 'waterDepth', 0.1, 4, 0.01, '깊이 어두워짐');
    R(water, c, 'ripple', 0, 0.4, 0.001, '파도 진폭');
    R(water, c, 'rippleScale', 0.05, 6, 0.01, 'm당 파도');
    R(water, c, 'rippleSpeed', -4, 4, 0.01, '파도 속도');
    R(water, c, 'chop', 0, 2, 0.01, '다짐');
    R(water, c, 'chopScale', 0.5, 16, 0.05, '다짐 규모');
    R(water, c, 'sheen', 0, 4, 0.01, '스페큘러');
    R(water, c, 'gloss', 0, 1, 0.01, '광택 밀집도');
    R(water, c, 'caustic', 0, 3, 0.01, '코스틱');
    R(water, c, 'causticScale', 0.1, 8, 0.05, '코스틱 규모');
    R(water, c, 'causticSpeed', -3, 3, 0.01, '코스틱 속도');
    R(water, c, 'rimFoam', 0, 3, 0.01, '벽면 거품');
    R(water, c, 'rimFoamWidth', 0.02, 2, 0.01, '거품 너비');
    R(water, c, 'poolHeight', 0.005, 0.3, 0.002, '호버 높이');
    R(water, c, 'poolOpacity', 0, 2, 0.01, '바닥 불투명도');
    water.addColor(c, 'colorWater').name('물');
    water.addColor(c, 'colorWaterDeep').name('깊은 물');
    water.addColor(c, 'colorFoam').name('거품');
    water.addColor(c, 'colorRim').name('림 라이트');

    const throat = folder.addFolder('협착부');
    R(throat, c, 'throatSize', 0.02, 1, 0.005, '목 반경');
    R(throat, c, 'throatDepth', 0, 1.5, 0.01, '검은 정도');
    R(throat, c, 'throatLip', 0.01, 1, 0.005, '립 너비');
    R(throat, c, 'throatSpin', -6, 6, 0.01, '와류 속도');

    const ripples = folder.addFolder('붓결 물결');
    R(ripples, c, 'rings', 0, 8, 1, '비행 중 고리');
    R(ripples, c, 'ringSpeed', 0, 3, 0.01, '초당 반경');
    R(ripples, c, 'ringWidth', 0.01, 1, 0.005, '획 너비');
    R(ripples, c, 'ringTaper', 0, 1, 0.01, '테이퍼');
    R(ripples, c, 'ringInk', 0, 2, 0.01, '먹');
    R(ripples, c, 'ringFoam', 0, 2, 0.01, '선행 흰색');
    R(ripples, c, 'ringBristle', 0, 1, 0.01, '드라이브러시 건너뜀');
    R(ripples, c, 'ringBristleScale', 0.5, 30, 0.1, '건너뜀 스케일');
    R(ripples, c, 'ringWobble', 0, 0.5, 0.005, '반경 배회');
    R(ripples, c, 'ringWobbleScale', 0.2, 10, 0.05, '방황 스케일');
    R(ripples, c, 'ringReach', 0.2, 4, 0.01, '진행 거리');

    const splatter = folder.addFolder('튐');
    R(splatter, c, 'splatter', 0, 1, 0.01, '반점 밀도');
    R(splatter, c, 'splatterScale', 0.1, 6, 0.01, '미터당 셀');
    R(splatter, c, 'splatterSize', 0.05, 1.5, 0.01, '반점 크기');
    R(splatter, c, 'splatterTail', 0, 8, 0.05, '물방울 꼬리');
    R(splatter, c, 'splatterSpread', 0.5, 3, 0.01, '투척 거리');

    const crown = folder.addFolder('왕관');
    R(crown, c, 'crownHeight', 0.1, 8, 0.05, '벽 높이');
    R(crown, c, 'crownRise', 0.02, 2, 0.01, '상승 시간');
    R(crown, c, 'crownFall', 0.05, 6, 0.01, '후퇴 시간');
    R(crown, c, 'crownFingers', 3, 60, 1, '물결무늬');
    R(crown, c, 'crownFingerDepth', 0, 1, 0.01, '물결 깊이');
    R(crown, c, 'crownFlare', -0.5, 1.5, 0.01, '바깥 기울기');
    R(crown, c, 'crownCurl', -0.5, 1, 0.01, '파고 컬');
    R(crown, c, 'crownLean', 0, 2, 0.01, '낙하 기울임');
    R(crown, c, 'crownWobble', 0, 0.5, 0.005, '반경 배회');
    R(crown, c, 'crownWobbleScale', 0.2, 10, 0.05, '방황 스케일');
    R(crown, c, 'crownSpin', -2, 2, 0.005, '물결 이동');
    R(crown, c, 'crownTear', 0, 1.5, 0.01, '파고 찢김');
    R(crown, c, 'crownTearScale', 0.2, 12, 0.05, '찢김 스케일');
    R(crown, c, 'crownFoam', 0, 4, 0.01, '파고 거품');
    R(crown, c, 'crownFresnel', 0, 4, 0.01, '가장자리 빛 (scale)');
    R(crown, c, 'crownStreak', 0, 2, 0.01, '먹 줄무늬');
    R(crown, c, 'crownStreakScale', 0.5, 20, 0.1, '줄무늬 스케일');
    R(crown, c, 'crownInk', 0, 1.5, 0.01, '얼룩 정도');
    R(crown, c, 'crownOpacity', 0, 2, 0.01, '불투명도');
    R(crown, c, 'crownGlow', 0, 4, 0.01, '발광');
    R(crown, c, 'crownSoftFade', 0.02, 3, 0.01, '부드러운 페이드(m)');

    const column = folder.addFolder('기둥');
    R(column, c, 'columnHeight', 0.2, 12, 0.05, '제트 높이');
    R(column, c, 'columnRise', 0.02, 2, 0.01, '상승 시간');
    R(column, c, 'columnHold', 0, 4, 0.01, '유지 시간');
    R(column, c, 'columnFall', 0.05, 5, 0.01, '낙하 시간');
    R(column, c, 'columnFoot', 0.02, 1.5, 0.01, '하단 반경');
    R(column, c, 'columnNeck', 0.01, 1, 0.005, '목 반경');
    R(column, c, 'columnHead', 0.01, 1.5, 0.005, '상단 반경');
    R(column, c, 'columnWobble', 0, 1, 0.005, '수직 틀어짐');
    R(column, c, 'columnWobbleScale', 0.2, 10, 0.05, '방황 스케일');
    R(column, c, 'columnSpin', -3, 3, 0.01, '상승 비틀림');
    R(column, c, 'columnTear', 0, 1.5, 0.01, '선단 찢김');
    R(column, c, 'columnInk', 0, 1, 0.01, '검은 정도');
    R(column, c, 'columnFoam', 0, 3, 0.01, '거품');
    R(column, c, 'columnFresnel', 0, 4, 0.01, '가장자리 빛 (scale)');
    R(column, c, 'columnOpacity', 0, 2, 0.01, '불투명도');

    const wisps = folder.addFolder('부유 먹');
    R(wisps, c, 'wispSteps', 6, 64, 1, '행진 단계 (cost)');
    R(wisps, c, 'wispHeight', 0.2, 12, 0.05, '매달림 높이');
    R(wisps, c, 'wispDensity', 0, 6, 0.01, '밀도');
    R(wisps, c, 'wispAbsorb', 0.05, 6, 0.01, '흡수');
    R(wisps, c, 'wispScale', 0.05, 3, 0.005, '미터당 형상');
    R(wisps, c, 'wispDetail', 0.2, 6, 0.05, '필라멘트 스케일');
    R(wisps, c, 'wispFilament', 0, 1, 0.01, '가닥-구름 비율');
    R(wisps, c, 'wispThreshold', 0, 0.9, 0.01, '조각 임계값');
    R(wisps, c, 'wispRise', -3, 3, 0.01, '상승 속도');
    R(wisps, c, 'wispStretch', 0.05, 2, 0.01, '수직 늘어남');
    R(wisps, c, 'wispTwist', -8, 8, 0.05, '높이 비틀림');
    R(wisps, c, 'wispSpin', -1, 1, 0.005, '전체 부피 회전');
    R(wisps, c, 'wispWind', 0, 6, 0.05, '축 근처 와류');
    R(wisps, c, 'wispFunnel', 0, 1, 0.01, '중앙 공동');
    R(wisps, c, 'wispEdge', 0, 1, 0.01, '벽 부드러움');
    R(wisps, c, 'wispFlare', -0.4, 1.5, 0.01, '높이에 따른 열림');
    R(wisps, c, 'wispSkirt', 0, 1, 0.01, '가장자리 초과 유출');
    R(wisps, c, 'wispFalloff', 0.1, 5, 0.01, '위쪽 가늘어짐');
    R(wisps, c, 'wispLobe', 0, 1, 0.01, '벽 방황');
    R(wisps, c, 'wispTear', 0, 0.6, 0.005, '상단 찢김');
    R(wisps, c, 'wispLight', 0, 3, 0.01, '통과하는 햇빛');
    R(wisps, c, 'wispShadow', 0, 8, 0.05, '셀프 섀도');
    R(wisps, c, 'wispShadowStep', 0.05, 4, 0.05, '섀도 탭 (m)');
    R(wisps, c, 'wispAmbient', 0, 1, 0.005, '주변광');
    R(wisps, c, 'wispSaturate', 0, 5, 0.01, '밀도 깊어짐');
    R(wisps, c, 'wispOpacity', 0, 2, 0.01, '불투명도');
    R(wisps, c, 'wispClear', 0, 1, 0.01, '고정체 부품');
    R(wisps, c, 'wispClearSize', 0.2, 3, 0.01, '갈라짐 너비 (m)');
    R(wisps, c, 'wispClearFade', 0.1, 4, 0.05, '갈라짐 닫힘');
    wisps.addColor(c, 'colorWispDeep').name('짙은 먹');
    wisps.addColor(c, 'colorWispBody').name('몸통');
    wisps.addColor(c, 'colorWispEdge').name('옅은 먹');
    wisps.addColor(c, 'colorWispLight').name('통과하는 햇빛');

    const warp = folder.addFolder('표면 굴절');
    R(warp, c, 'warpStrength', 0, 4, 0.01, '강도');
    R(warp, c, 'warpRipple', 0, 3, 0.01, '고리부터');
    R(warp, c, 'warpScale', 0.1, 8, 0.05, '다짐 규모');
    R(warp, c, 'warpSpeed', -3, 3, 0.01, '다짐 속도');

    const grip = folder.addFolder('삼킴');
    const gc = c.grip;
    R(grip, gc, 'flow', 0, 20, 0.1, '내향 흐름, m/s');
    R(grip, gc, 'swirl', 0, 20, 0.1, '접선 흐름(m/s)');
    R(grip, gc, 'tumble', 0, 4, 0.01, '몸통 회전, rev/s');
    R(grip, gc, 'sink', 0, 20, 0.1, '하향 흐름, m/s');
    R(grip, gc, 'grab', 0.1, 12, 0.05, '고착 속도');
    R(grip, gc, 'winch', 0, 12, 0.05, '나선 고정 강도');
    R(grip, gc, 'windUp', 0.05, 3, 0.01, '장악 시간');
    R(grip, gc, 'wade', 0, 2, 0.01, '바닥 낙차');
    R(grip, gc, 'float', 0, 2, 0.01, '운반 높이');
    R(grip, gc, 'crest', 0, 2, 0.01, '축 중심 상승, x');
    R(grip, gc, 'buoy', 0, 12, 0.05, '고정 강도');
    R(grip, gc, 'rise', 0.1, 8, 0.05, '최대 상승 속도');
    R(grip, gc, 'hold', 0, 3, 0.01, '표면 회전 시간');
    R(grip, gc, 'spiral', 0.2, 8, 0.05, '감김 시간');
    R(grip, gc, 'depth', 0.5, 12, 0.1, '도달 깊이');
    R(grip, gc, 'impulse', 0, 20, 0.1, '바람, 안쪽');
    R(grip, gc, 'lift', 0, 12, 0.1, '바람, 위쪽');
    R(grip, gc, 'spin', 0, 4, 0.01, '바람, 토크');
    R(grip, gc, 'splashDroplets', 0, 200, 1, '튐 물방울');
    R(grip, gc, 'splashSpray', 0, 200, 1, '튐 스프레이');
    R(grip, gc, 'splashFoam', 0, 3, 0.01, '튐 고리');
    R(grip, gc, 'splashShake', 0, 0.5, 0.002, '튐 넉백');

    const particles = folder.addFolder('입자');
    R(particles, c, 'dropletRate', 0, 400, 1, '초당 물방울');
    R(particles, c, 'dropletSpeed', 0, 14, 0.05, '물방울 속도');
    R(particles, c, 'dropletLifetime', 0.05, 6, 0.05, '물방울 수명');
    R(particles, c, 'dropletSize', 0.01, 0.6, 0.005, '물방울 크기');
    R(particles, c, 'sprayRate', 0, 400, 1, '초당 스프레이');
    R(particles, c, 'spraySpeed', 0, 12, 0.05, '스프레이 속도');
    R(particles, c, 'sprayLifetime', 0.05, 6, 0.05, '스프레이 수명');
    R(particles, c, 'spraySize', 0.01, 0.8, 0.005, '스프레이 크기');
    R(particles, c, 'fleckRate', 0, 400, 1, '초당 반점');
    R(particles, c, 'fleckSpeed', 0, 12, 0.05, '반점 속도');
    R(particles, c, 'fleckLifetime', 0.05, 6, 0.05, '반점 수명');
    R(particles, c, 'fleckSize', 0.01, 0.6, 0.005, '반점 크기');
    R(particles, c, 'hazeRate', 0, 200, 1, '초당 헤이즈');
    R(particles, c, 'hazeSpeed', 0, 8, 0.05, '헤이즈 속도');
    R(particles, c, 'hazeLifetime', 0.05, 8, 0.05, '헤이즈 수명');
    R(particles, c, 'hazeSize', 0.05, 4, 0.01, '헤이즈 크기');
    Editor.gradient(particles, c, 'colorDroplet', '물방울 그라데이션');
    Editor.gradient(particles, c, 'colorSpray', '분무 그라데이션');
    Editor.gradient(particles, c, 'colorFleck', '반점 그라데이션');
    Editor.gradient(particles, c, 'colorHaze', '아지랑이 그라데이션');

    const impact = folder.addFolder('범람');
    R(impact, c, 'burstSize', 0.1, 12, 0.05, '스프레이 돔');
    R(impact, c, 'burstIntensity', 0, 4, 0.01, '돔 밝기');
    R(impact, c, 'shockRadius', 0.5, 25, 0.1, '충격 고리');
    R(impact, c, 'stainRadius', 0.5, 16, 0.1, '얼룩 반경');
    R(impact, c, 'stainLife', 0.5, 20, 0.1, '얼룩 수명');
    R(impact, c, 'stainIntensity', 0, 3, 0.01, '얼룩 강도');
    R(impact, c, 'floodShake', 0, 2, 0.005, '범람 흔들림');
    R(impact, c, 'shakeDuration', 0.05, 3, 0.01, '흔들림 감쇠');
    R(impact, c, 'floodFlash', 0, 1, 0.005, '범람 섬광');
    R(impact, c, 'rumble', 0, 0.3, 0.002, '이동 럼블');
    R(impact, c, 'holdShake', 0, 0.3, 0.002, '유지 진동');
    impact.addColor(c, 'colorShockA').name('충격파 안쪽');
    impact.addColor(c, 'colorShockB').name('충격파 바깥쪽');
    impact.addColor(c, 'colorStain').name('얼룩');
    impact.addColor(c, 'colorFlash').name('범람 섬광');
    impact.addColor(c, 'colorBurstA').name('돔 중심');
    impact.addColor(c, 'colorBurstB').name('돔 몸통');
    impact.addColor(c, 'colorBurstC').name('돔 가장자리');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 160, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightHeight', 0, 2, 0.01, '크라운 높이');
    R(light, c, 'lightSwell', 0, 2, 0.01, '팽창 비중');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.inkFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * The Astral Void Blast.
   *
   * Grouped by the five panels of its reference sheet, in the order they
   * happen. The two knobs worth reaching for first are `coreRadius` (in "The
   * singularity") and `zoneRadius` (in "The cast"): almost every other length
   * in this ability is expressed as a multiple of one of them, so those two
   * re-scale the whole thing in proportion — mid-cast, and while paused.
   */
  _buildAstral() {
    const folder = this.gui.addFolder('🕳  성간 공허 폭발');
    const c = settings.astral;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 0.5, 14, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 300, 1, '씨앗 속도');
    R(cast, c, 'lifetime', 0.2, 16, 0.05, '유지 시간');
    R(cast, c, 'fadeTime', 0.05, 6, 0.01, '붕괴 시간');
    R(cast, c, 'cooldown', 0, 8, 0.05, '재사용 대기시간');
    R(cast, c, 'handHeight', 0, 2.5, 0.01, '손 높이');
    R(cast, c, 'handForward', -1, 3, 0.01, '손 전방');
    R(cast, c, 'handSide', -2, 2, 0.01, '손 쪽');
    R(cast, c, 'trailStars', 0, 200, 1, 'm당 궤적 별');
    Editor.castAnimation(cast, c);

    const core = folder.addFolder('1 · 특이점');
    R(core, c, 'coreRadius', 0.05, 4, 0.01, '그림자 반경');
    R(core, c, 'coreHeight', 0, 8, 0.05, '바닥 위 높이');
    R(core, c, 'seedSize', 0.02, 1, 0.01, '씨앗 크기, x 반경');
    R(core, c, 'coreSwell', 0.02, 2, 0.01, '팽창 시간 (s)');
    R(core, c, 'coreBloom', 1, 5, 0.01, '팽창 목표, x radius');
    R(core, c, 'corePinch', 0.02, 1.5, 0.01, '붕괴 소요 (s)');
    R(core, c, 'burstTime', 0.05, 3, 0.01, '성운 열림 시간 (s)');
    R(core, c, 'haloReach', 1.5, 20, 0.1, '후광 도달, x horizon');
    R(core, c, 'ringWidth', 0.005, 0.4, 0.002, '광자 고리 너비');
    R(core, c, 'ringGlow', 0, 30, 0.1, '광자 고리 발광');
    R(core, c, 'ringBeam', 0, 1.5, 0.01, '광선 면');
    R(core, c, 'ringSpin', -3, 3, 0.01, '광선 이동, rev/s');
    R(core, c, 'haloGlow', 0, 6, 0.01, '후광 발광');
    R(core, c, 'haloFalloff', 0.2, 8, 0.05, '후광 감쇠');
    R(core, c, 'haloWind', 0, 10, 0.05, '후광 감김');
    R(core, c, 'haloSpin', -3, 3, 0.01, '후광 회전, rev/s');
    R(core, c, 'haloFilament', 0, 1, 0.01, '가닥 찢김');
    R(core, c, 'haloFilamentScale', 0.2, 10, 0.05, '가닥 스케일');
    core.addColor(c, 'colorPhoton').name('광자 고리');
    core.addColor(c, 'colorHalo').name('후광(가까운)');
    core.addColor(c, 'colorHaloCool').name('후광(먼)');

    const lens = folder.addFolder('2 · 렌즈');
    R(lens, c, 'lensReach', 2, 40, 0.1, '도달거리, x 지평선');
    R(lens, c, 'lensBend', 0, 2, 0.01, '편향, x 반경');
    R(lens, c, 'lensDrag', 0, 1.5, 0.01, '프레임 드래그');

    const nebula = folder.addFolder('3 · 성운');
    R(nebula, c, 'nebulaRadius', 0.5, 24, 0.1, '도달거리 (m)');
    R(nebula, c, 'nebulaCavity', 0.5, 5, 0.01, '눈, x 지평선');
    R(nebula, c, 'nebulaSteps', 6, 72, 1, '행진 단계');
    R(nebula, c, 'nebulaDensity', 0, 12, 0.05, '밀도');
    R(nebula, c, 'nebulaAbsorb', 0, 6, 0.01, '광선 불투명도');
    R(nebula, c, 'nebulaGlow', 0, 8, 0.01, '방출');
    R(nebula, c, 'nebulaScale', 0.05, 2, 0.01, '미터당 형상');
    R(nebula, c, 'nebulaDetail', 0.5, 8, 0.05, '필라멘트 스케일');
    R(nebula, c, 'nebulaFilament', 0, 1, 0.01, '가닥-구름 비율');
    R(nebula, c, 'nebulaThreshold', 0.05, 0.95, 0.01, '조각 임계값');
    R(nebula, c, 'nebulaEdge', 0.05, 1, 0.01, '바깥쪽 부드러움');
    R(nebula, c, 'nebulaFlatten', 0.1, 1.5, 0.01, '디스크 대 볼');
    R(nebula, c, 'nebulaArms', 1, 9, 1, '나선 팔');
    R(nebula, c, 'nebulaArmSharp', 0.2, 6, 0.05, '팔 선명도');
    R(nebula, c, 'nebulaArmWeight', 0, 1, 0.01, '팔 가중치');
    R(nebula, c, 'nebulaWind', 0, 10, 0.05, '차동 권선');
    R(nebula, c, 'nebulaTwist', -6, 6, 0.05, '높이에 따른 비틀림');
    R(nebula, c, 'nebulaSpin', -3, 3, 0.01, '필드 회전, rev/s');
    R(nebula, c, 'nebulaRise', -3, 3, 0.01, '필드 상승');
    R(nebula, c, 'nebulaSpikes', 0, 24, 1, '황금 창');
    R(nebula, c, 'nebulaSpikeSharp', 1, 24, 0.5, '창 선예도');
    R(nebula, c, 'nebulaSpikeReach', 0.1, 2, 0.01, '창 도달');
    R(nebula, c, 'nebulaSpikeGlow', 0, 3, 0.01, '창 발광');
    R(nebula, c, 'nebulaHeatFalloff', 0.2, 8, 0.05, '금→보라');
    R(nebula, c, 'nebulaBeam', 0, 2, 0.01, '도플러 비밍');
    R(nebula, c, 'nebulaOpacity', 0, 2, 0.01, '불투명도');
    nebula.addColor(c, 'colorNebulaEdge').name('옅은 기체');
    nebula.addColor(c, 'colorNebulaBody').name('몸통');
    nebula.addColor(c, 'colorNebulaHot').name('고열');
    nebula.addColor(c, 'colorNebulaCore').name('협착부');

    const shards = folder.addFolder('4 · 공허 파편');
    R(shards, c, 'shardSize', 0.05, 2, 0.01, '크기(m)');
    R(shards, c, 'shardSpread', 0.2, 4, 0.01, '투척 도달(x 범위)');
    R(shards, c, 'shardStagger', 0, 8, 0.05, '도달 분산 (s)');
    R(shards, c, 'shardLife', 0.2, 8, 0.05, '낙하 시간 (s)');
    R(shards, c, 'shardOrbit', 0, 4, 0.01, '낙하 감김');
    R(shards, c, 'shardLoft', 0, 2, 0.01, '평면 이탈');
    R(shards, c, 'shardTumble', 0, 8, 0.05, '텀블(rev/s)');
    R(shards, c, 'shardCrush', 0.2, 0.99, 0.01, '압착 후');
    R(shards, c, 'shardFresnel', 0, 6, 0.01, '가장자리');
    R(shards, c, 'shardFresnelPower', 0.5, 8, 0.05, '가장자리 조임');
    R(shards, c, 'shardVein', 0, 6, 0.01, '결');
    R(shards, c, 'shardVeinScale', 0.5, 20, 0.1, '맥 스케일');
    R(shards, c, 'shardVeinSharp', 0.5, 8, 0.05, '맥 선예도');
    R(shards, c, 'shardGlint', 0, 4, 0.01, '패싯 반짝임');
    R(shards, c, 'shardGlintScale', 2, 80, 0.5, '반짝임 스케일');
    R(shards, c, 'shardHeatGlow', 0, 16, 0.1, '백화');
    R(shards, c, 'shardCoreBleed', 0, 6, 0.01, '구멍 발광');
    R(shards, c, 'shardCoreRadius', 0.5, 20, 0.1, '... 거리, 미터');
    R(shards, c, 'shardRoughness', 0, 1, 0.01, '거칠기');
    R(shards, c, 'shardMetalness', 0, 1, 0.01, '금속성');
    R(shards, c, 'shardEnvIntensity', 0, 3, 0.01, '반사');
    shards.addColor(c, 'colorShardBody').name('몸통');
    shards.addColor(c, 'colorShardFacet').name('발광 면');
    shards.addColor(c, 'colorShardRim').name('가장자리');
    shards.addColor(c, 'colorShardVein').name('결');
    shards.addColor(c, 'colorShardHot').name('백화');

    const shock = folder.addFolder('5 · 충격파');
    R(shock, c, 'shockRadius', 1, 40, 0.1, '도달거리 (m)');
    R(shock, c, 'shockSpeed', 1, 60, 0.5, '속도(m/s)');
    R(shock, c, 'shockHeight', 0, 0.3, 0.002, '호버, metres');
    R(shock, c, 'shockWidth', 0.05, 5, 0.01, '패킷 깊이 (m)');
    R(shock, c, 'shockLift', 0, 3, 0.01, '파고 상승, 미터');
    R(shock, c, 'shockWobble', 0, 3, 0.01, '전방 배회, metres');
    R(shock, c, 'shockWobbleScale', 0.2, 10, 0.05, '방황 스케일');
    R(shock, c, 'shockSpokes', 0, 80, 1, '필라멘트');
    R(shock, c, 'shockSpokeSharp', 0.2, 8, 0.05, '필라멘트 선명도');
    R(shock, c, 'shockSpokeDrift', -4, 4, 0.01, '필라멘트 드리프트');
    R(shock, c, 'shockEdge', 0, 4, 0.01, '선행 라인');
    R(shock, c, 'shockTrail', 0, 2, 0.01, '후방 워시');
    R(shock, c, 'shockGrain', 0, 2, 0.01, '결');
    R(shock, c, 'shockGrainScale', 0.1, 8, 0.05, '결 스케일');
    R(shock, c, 'shockGlow', 0, 8, 0.01, '발광');
    R(shock, c, 'shockOpacity', 0, 2, 0.01, '불투명도');
    shock.addColor(c, 'colorShockHot').name('마루');
    shock.addColor(c, 'colorShockBody').name('몸통');
    shock.addColor(c, 'colorShockCool').name('번짐');
    R(shock, c, 'warpStrength', 0, 6, 0.01, '공기 변위');
    R(shock, c, 'warpWidth', 0.05, 5, 0.01, '압력 깊이');
    R(shock, c, 'warpRipples', 0.5, 20, 0.1, '압력 띠');
    R(shock, c, 'warpChop', 0, 2, 0.01, '압력 분해');
    R(shock, c, 'warpChopScale', 0.2, 10, 0.05, '분해 규모');

    const churn = folder.addFolder('플레어');
    R(churn, c, 'churnRate', 0.05, 8, 0.05, '엔벨로프 속도');
    R(churn, c, 'churnSharp', 0.2, 8, 0.05, '플레어 선명도');
    R(churn, c, 'churnDepth', 0, 2, 0.01, '변조 깊이');
    R(churn, c, 'flareThreshold', 0.05, 0.98, 0.01, '플레어 임계값');
    R(churn, c, 'flareEmbers', 0, 300, 1, '플레어당 금');
    R(churn, c, 'flareStars', 0, 300, 1, '플레어당 별');
    R(churn, c, 'flareShake', 0, 0.5, 0.002, '카메라 충격');

    const grip = folder.addFolder('삼킴');
    const gc = c.grip;
    R(grip, gc, 'reach', 0.5, 5, 0.01, '범위 내 물고기, x footprint');
    R(grip, gc, 'well', 0.1, 3, 0.01, '절반 강도 지점, x footprint');
    R(grip, gc, 'pull', 0, 30, 0.1, '내향 당김, m/s');
    R(grip, gc, 'swirl', 0, 30, 0.1, '접선(m/s)');
    R(grip, gc, 'tumble', 0, 4, 0.01, '몸통 회전, rev/s');
    R(grip, gc, 'cartwheel', 0, 2, 0.01, '공중제비');
    R(grip, gc, 'windUp', 0.05, 3, 0.01, '장악 시간');
    R(grip, gc, 'buoy', 0, 2, 0.01, '운반 무게');
    R(grip, gc, 'grab', 0.1, 12, 0.05, '고착 속도');
    R(grip, gc, 'spiral', 0, 8, 0.05, '감기용 할당');
    R(grip, gc, 'swallow', 0.5, 8, 0.05, '입(x 수평선)');
    R(grip, gc, 'devour', 0.1, 8, 0.05, '소모율, bodies/s');
    R(grip, gc, 'impulse', 0, 20, 0.1, '바람, 안쪽');
    R(grip, gc, 'lift', 0, 12, 0.1, '바람, 위쪽');
    R(grip, gc, 'spin', 0, 4, 0.01, '바람, 토크');
    R(grip, gc, 'swallowEmbers', 0, 300, 1, '본체당 금');
    R(grip, gc, 'swallowStars', 0, 300, 1, 'body당 별');
    R(grip, gc, 'swallowShake', 0, 0.5, 0.002, '삼킴 넉백');

    const particles = folder.addFolder('입자');
    R(particles, c, 'starRate', 0, 900, 5, '초당 별');
    R(particles, c, 'starSize', 0.01, 0.5, 0.005, '별 크기');
    R(particles, c, 'starLifetime', 0.1, 6, 0.05, '별 수명');
    R(particles, c, 'starShell', 0.2, 3, 0.01, '탄생 위치, x 범위');
    R(particles, c, 'starLoft', 0, 2, 0.01, '평면 이탈');
    R(particles, c, 'starSwirl', -12, 12, 0.05, '궤도 (rad/s)');
    R(particles, c, 'starInfall', 0, 1, 0.01, '궤도 붕괴 거리');
    R(particles, c, 'emberRate', 0, 400, 1, '초당 금');
    R(particles, c, 'emberSpeed', 0, 20, 0.05, '금 속도');
    R(particles, c, 'emberLifetime', 0.05, 6, 0.05, '금 수명');
    R(particles, c, 'emberSize', 0.01, 0.6, 0.005, '금 크기');
    R(particles, c, 'chipRate', 0, 200, 1, '초당 돌');
    R(particles, c, 'chipSpeed', 0, 20, 0.05, '돌 속도');
    R(particles, c, 'chipLifetime', 0.05, 6, 0.05, '돌 수명');
    R(particles, c, 'chipSize', 0.01, 0.6, 0.005, '돌 크기');
    R(particles, c, 'dustRate', 0, 200, 1, '초당 먼지');
    R(particles, c, 'dustSpeed', 0, 12, 0.05, '먼지 속도');
    R(particles, c, 'dustLifetime', 0.05, 8, 0.05, '먼지 수명');
    R(particles, c, 'dustSize', 0.05, 5, 0.01, '먼지 크기');
    Editor.gradient(particles, c, 'colorStar', '별 그라데이션');
    Editor.gradient(particles, c, 'colorEmber', '금 그라데이션');
    Editor.gradient(particles, c, 'colorChip', '돌 그라데이션');
    Editor.gradient(particles, c, 'colorDust', '먼지 그라데이션');

    const blast = folder.addFolder('붕괴');
    R(blast, c, 'implodeStars', 0, 800, 5, '쇄도 별');
    R(blast, c, 'implodeShake', 0, 1, 0.005, '도달 충격');
    R(blast, c, 'blastEmbers', 0, 800, 5, '폭발 금빛');
    R(blast, c, 'blastChips', 0, 600, 5, '폭발 돌');
    R(blast, c, 'blastDust', 0, 400, 5, '폭발 먼지');
    R(blast, c, 'blastStars', 0, 1500, 10, '폭발 별');
    R(blast, c, 'blastShake', 0, 3, 0.005, '폭발 흔들림');
    R(blast, c, 'shakeDuration', 0.05, 3, 0.01, '흔들림 감쇠');
    R(blast, c, 'blastFlash', 0, 1, 0.005, '폭발 섬광');
    R(blast, c, 'scorchRadius', 0.5, 16, 0.1, '그을음 반경');
    R(blast, c, 'scorchLife', 0.5, 20, 0.1, '그을음 수명');
    R(blast, c, 'scorchIntensity', 0, 3, 0.01, '그을음 강도');
    R(blast, c, 'rumble', 0, 0.3, 0.002, '이동 럼블');
    R(blast, c, 'holdShake', 0, 0.3, 0.002, '유지 진동');
    R(blast, c, 'collapseFlash', 0, 2, 0.01, '닫힘 섬광');
    R(blast, c, 'collapseShake', 0, 2, 0.005, '닫힘 흔들림');
    blast.addColor(c, 'colorScorch').name('그을음');
    blast.addColor(c, 'colorScorchEmber').name('그을린 불씨');
    blast.addColor(c, 'colorFlash').name('폭발 섬광');
    blast.addColor(c, 'colorCollapseFlash').name('닫힘 섬광');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 160, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightPulse', 0, 2, 0.01, '플레어 점유');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.astralFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  /**
   * The Baleful Cascade Mark.
   *
   * Grouped by the four panels of its reference sheet, in the order they are
   * drawn — ground glow, decal mark, wisps, core mesh burst — and then by what
   * the burst does with itself. The two knobs worth reaching for first are
   * `zoneRadius` (in "The cast") and `crownScale` (in "3 · The core mesh
   * burst"): nearly every other length in this ability is a multiple of one of
   * them, so those two re-scale the whole thing in proportion, mid-cast and
   * while paused.
   */
  _buildCascade() {
    const folder = this.gui.addFolder('✦  재앙의 연쇄');
    const c = settings.cascade;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 0.5, 12, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 200, 1, '파편 속도');
    R(cast, c, 'lifetime', 0.5, 20, 0.05, '유지 시간(s)');
    R(cast, c, 'fadeTime', 0.05, 6, 0.01, '닫힘 (s)');
    R(cast, c, 'cooldown', 0, 8, 0.05, '재사용 대기시간');
    R(cast, c, 'handHeight', 0, 2.5, 0.01, '손 높이');
    R(cast, c, 'handForward', -1, 3, 0.01, '손 전방');
    R(cast, c, 'handSide', -2, 2, 0.01, '손 쪽');
    Editor.castAnimation(cast, c);

    const order = folder.addFolder('진행 순서');
    R(order, c, 'glowTime', 0.02, 2, 0.01, '발광 전개 (s)');
    R(order, c, 'markTime', 0.02, 3, 0.01, '자국 켜짐 시간 (s)');
    R(order, c, 'wispDelay', 0, 3, 0.01, '연기 시작(s)');
    R(order, c, 'wispTime', 0.05, 4, 0.01, '연기 상승(s)');
    R(order, c, 'crownDelay', 0, 4, 0.01, '폭발 시작 (s)');
    R(order, c, 'crownTime', 0.05, 4, 0.01, '폭발 형성 (s)');
    R(order, c, 'fireDelay', 0, 3, 0.01, '대기(s)');
    R(order, c, 'pulseRate', 0, 6, 0.01, '뱅크 비율');
    R(order, c, 'pulseDepth', 0, 1.5, 0.01, '뱅크 깊이');

    const glow = folder.addFolder('4 · 지면 발광');
    R(glow, c, 'glowPool', 0, 3, 0.01, '못');
    R(glow, c, 'glowPoolFalloff', 0.1, 6, 0.01, '웅덩이 감쇠');
    R(glow, c, 'glowLip', 0, 4, 0.01, '입술');
    R(glow, c, 'glowLipSeat', 0.2, 1.2, 0.01, '립 위치, x 범위');
    R(glow, c, 'glowLipWidth', 0.01, 1, 0.005, '립 너비 (m)');
    R(glow, c, 'glowSpill', 0, 2, 0.01, '초과 유출');
    R(glow, c, 'glowSpillReach', 1, 3, 0.01, '넘침 도달(x 범위)');
    R(glow, c, 'glowSpillFalloff', 0.2, 8, 0.05, '넘침 감쇠');
    R(glow, c, 'glowWobble', 0, 0.2, 0.002, '경계 흔들림');
    R(glow, c, 'glowWobbleLobes', 1, 16, 1, '방황 엽');
    R(glow, c, 'glowWobbleSpeed', 0, 4, 0.01, '방황 속도');
    R(glow, c, 'glowSweep', 0, 3, 0.01, '읽기 헤드');
    R(glow, c, 'glowSweepSpeed', -1, 1, 0.005, '선단 속도, rev/s');
    R(glow, c, 'glowSweepWidth', 0.01, 0.6, 0.005, '선단 너비');
    R(glow, c, 'glowGrain', 0, 2, 0.01, '결');
    R(glow, c, 'glowGrainScale', 0.1, 8, 0.05, '결 스케일');
    R(glow, c, 'glowHeight', 0, 0.2, 0.001, '바닥 위 높이');
    R(glow, c, 'glowOpacity', 0, 2, 0.01, '불투명도');
    R(glow, c, 'glowGlow', 0, 4, 0.01, '발광');
    glow.addColor(c, 'colorGlowCore').name('코어');
    glow.addColor(c, 'colorGlowPool').name('못');
    glow.addColor(c, 'colorGlowRim').name('입술');

    const mark = folder.addFolder('1 · 데칼 표식');
    R(mark, c, 'markLineWidth', 0.004, 0.2, 0.002, '획 너비(m)');
    R(mark, c, 'markLineGlow', 0, 6, 0.01, '획 발광');
    R(mark, c, 'markPoints', 3, 10, 1, '별 꼭짓점');
    R(mark, c, 'markStarSharp', 2, 8, 0.01, '가시 선명도 (2 = polygon)');
    R(mark, c, 'markStarOuter', 0.4, 1.4, 0.01, '별 도달(x 범위)');
    R(mark, c, 'markStarSpin', -0.2, 0.2, 0.001, '별 회전(rev/s)');
    R(mark, c, 'markInnerScale', 0.1, 1, 0.01, '안쪽 별, x outer');
    R(mark, c, 'markInnerGain', 0, 2, 0.01, '안쪽 별 가중치');
    R(mark, c, 'markDiamond', 0, 3, 0.01, '다이아몬드');
    R(mark, c, 'markDiamondSeat', 0.2, 1.2, 0.01, '다이아몬드, x 범위');
    R(mark, c, 'markDiamondAspect', 0.3, 2, 0.01, '다이아몬드 종횡비');
    R(mark, c, 'markDiamondSpin', -0.2, 0.2, 0.001, '다이아몬드 회전, rev/s');
    R(mark, c, 'markSpear', 0, 3, 0.01, '창촉');
    R(mark, c, 'markSpearFrom', 0.1, 1.2, 0.01, '창 뿌리(x 범위)');
    R(mark, c, 'markSpearTo', 0.2, 1.4, 0.01, '창 끝(x 범위)');
    R(mark, c, 'markSpearWidth', 0.005, 0.3, 0.005, '창 너비');
    R(mark, c, 'markHooks', 0, 3, 0.01, '갈고리');
    R(mark, c, 'markHookCount', 1, 12, 1, '갈고리 수');
    R(mark, c, 'markHookSeat', 0.05, 0.8, 0.01, '갈고리 반경, x footprint');
    R(mark, c, 'markHookSweep', 0.1, 3, 0.01, '갈고리 스위프 (rad)');
    R(mark, c, 'markHookWidth', 0.005, 0.2, 0.002, '갈고리 너비');
    R(mark, c, 'markHookSpin', -0.2, 0.2, 0.001, '갈고리 회전, rev/s');
    R(mark, c, 'markRibs', 0, 2, 0.01, '가장자리 빗');
    R(mark, c, 'markRibCount', 1, 30, 1, '가장자리당 빗');
    R(mark, c, 'markRibLength', 0.02, 0.6, 0.01, '빗 길이');
    R(mark, c, 'markRibWidth', 0.02, 0.8, 0.01, '빗 너비');
    R(mark, c, 'markTicks', 0, 2, 0.01, '가장자리 눈금');
    R(mark, c, 'markTickCount', 4, 120, 1, '틱 수');
    R(mark, c, 'markTickSeat', 0.3, 1.2, 0.01, '틱 자리(x 범위)');
    R(mark, c, 'markTickLength', 0.01, 0.3, 0.005, '틱 길이');
    R(mark, c, 'markHub', 0, 3, 0.01, '허브');
    R(mark, c, 'markHubRing', 0.02, 0.5, 0.005, '허브 고리, x footprint');
    R(mark, c, 'markHubDot', 0.005, 0.3, 0.005, '허브 점, x footprint');
    R(mark, c, 'markWash', 0, 2, 0.01, '별 내부 채움');
    R(mark, c, 'markWashFalloff', 0.1, 6, 0.05, '채움 감쇠');
    R(mark, c, 'markGrain', 0, 2, 0.01, '결');
    R(mark, c, 'markGrainScale', 0.1, 8, 0.05, '결 스케일');
    R(mark, c, 'markHeight', 0, 0.2, 0.001, '바닥 위 높이');
    R(mark, c, 'markOpacity', 0, 2, 0.01, '불투명도');
    R(mark, c, 'markGlow', 0, 4, 0.01, '발광');
    mark.addColor(c, 'colorMarkLine').name('선');
    mark.addColor(c, 'colorMarkCore').name('속심');
    mark.addColor(c, 'colorMarkDeep').name('심층 충전');
    mark.addColor(c, 'colorMarkWash').name('번짐');
    mark.addColor(c, 'colorFront').name('날');

    const wisp = folder.addFolder('2 · 상승 연기줄기');
    R(wisp, c, 'wisps', 0, 28, 1, '가닥 연기');
    R(wisp, c, 'wispSeat', 0.05, 1.4, 0.01, '하단, x footprint');
    R(wisp, c, 'wispSeatJitter', 0, 1, 0.01, '하단 산란');
    R(wisp, c, 'wispSpread', 0, 3, 0.01, '방향 산란');
    R(wisp, c, 'wispHeight', 0.5, 14, 0.05, '상승 (m)');
    R(wisp, c, 'wispHeightJitter', 0, 1, 0.01, '상승 산란');
    R(wisp, c, 'wispRise', 0.01, 1.5, 0.005, '초당 상승');
    R(wisp, c, 'wispLength', 0.05, 1.5, 0.01, '리본 길이');
    R(wisp, c, 'wispWander', 0, 3, 0.01, '방황(m)');
    R(wisp, c, 'wispWanderScale', 0.1, 8, 0.05, '방황 스케일');
    R(wisp, c, 'wispWanderSpeed', 0, 3, 0.01, '방황 속도');
    R(wisp, c, 'wispSwirl', -4, 4, 0.01, '상승 회전');
    R(wisp, c, 'wispDraw', 0, 1.5, 0.01, '폭발 흡입');
    R(wisp, c, 'wispDrawAt', 0, 0.98, 0.01, '... 시작 위치');
    R(wisp, c, 'wispWidth', 0.005, 0.4, 0.005, '너비(x 상승)');
    R(wisp, c, 'wispWidthBias', 0.05, 3, 0.01, '얇아짐 속도');
    R(wisp, c, 'wispIntensity', 0, 4, 0.01, '강도');
    R(wisp, c, 'wispSoftEdge', 0.1, 5, 0.05, '가장자리 부드러움');
    R(wisp, c, 'wispErode', 0, 1, 0.01, '분해');
    R(wisp, c, 'wispErodeScale', 0.2, 10, 0.05, '분해 규모');
    R(wisp, c, 'wispErodeSpeed', 0, 4, 0.01, '분해 속도');
    R(wisp, c, 'wispTailFade', 0.01, 0.6, 0.01, '페이드 인');
    R(wisp, c, 'wispHeadFade', 0.01, 0.9, 0.01, '페이드 아웃');
    R(wisp, c, 'wispSoftFade', 0, 3, 0.01, '부드러운 페이드(m)');
    R(wisp, c, 'wispOpacity', 0, 2, 0.01, '불투명도');
    R(wisp, c, 'wispGlow', 0, 4, 0.01, '발광');
    wisp.addColor(c, 'colorWispRoot').name('뿌리');
    wisp.addColor(c, 'colorWispBody').name('몸통');
    wisp.addColor(c, 'colorWispTip').name('끝');

    const burst = folder.addFolder('3 · 중심 메시 폭발');
    R(burst, c, 'crownScale', 0.2, 5, 0.01, '폭발 크기');
    R(burst, c, 'crownHeight', 0.5, 10, 0.05, '매달림 높이 (m)');
    R(burst, c, 'crownRise', 0, 4, 0.01, '형성 중 상승 (m)');
    R(burst, c, 'crownBob', 0, 0.5, 0.005, '호흡 (m)');
    R(burst, c, 'crownBobSpeed', 0, 3, 0.01, '호흡 속도');
    R(burst, c, 'crownSpin', -1, 1, 0.005, '회전(rev/s)');
    R(burst, c, 'crownTilt', 0, 1.5, 0.01, '끄덕임 (rad)');
    R(burst, c, 'crownTiltSpeed', 0, 1, 0.005, '끄덕임 속도 (rev/s)');
    R(burst, c, 'crownSpears', 0, 24, 1, '긴 창');
    R(burst, c, 'crownBlades', 0, 32, 1, '칼날');
    R(burst, c, 'crownShards', 0, 32, 1, '짧은 파편');
    R(burst, c, 'spearLength', 0.1, 4, 0.01, '창 길이(x 크기)');
    R(burst, c, 'bladeLength', 0.1, 3, 0.01, '칼날 길이, x 크기');
    R(burst, c, 'shardLength', 0.05, 2, 0.01, '파편 길이, x 크기');
    R(burst, c, 'crownLengthJitter', 0, 1, 0.01, '길이 산란');
    R(burst, c, 'crownFlatten', 0.05, 1.5, 0.01, '평면 압착');
    R(burst, c, 'crownJitter', 0, 1, 0.01, '진행 산란');
    R(burst, c, 'crownInner', 0, 1, 0.005, '뿌리 위치, x 크기');
    R(burst, c, 'crownStagger', 0, 0.95, 0.01, '조립 시차');
    R(burst, c, 'crownSwell', 0, 1, 0.01, '크라운 개방 뱅크');
    R(burst, c, 'crownViolet', 0, 1, 0.01, '보라 비중');
    R(burst, c, 'crownRegrow', 0.05, 6, 0.05, '칼날 재생 (s)');
    R(burst, c, 'crownRegrowDelay', 0, 4, 0.01, '... 대기 후 (s)');

    const blade = burst.addFolder('칼날 자체');
    R(blade, c, 'bladeWaist', 0.02, 0.95, 0.01, '최대 너비점');
    R(blade, c, 'bladeRootPower', 0.05, 3, 0.01, '뿌리 팽창');
    R(blade, c, 'bladeTipPower', 0.05, 4, 0.01, '정점 흡입');
    R(blade, c, 'bladeWidth', 0.01, 0.5, 0.005, '절반 너비, x length');
    R(blade, c, 'bladeThick', 0.02, 2, 0.01, '두께(x 너비)');
    R(blade, c, 'bladeEdge', 0.05, 3, 0.01, '가장자리 조임');
    R(blade, c, 'bladeBow', 0, 0.4, 0.005, '휨, x 길이');
    R(blade, c, 'bladeTwist', -3, 3, 0.01, '비틀림(rad)');
    R(blade, c, 'bladeEdgeGlow', 0, 8, 0.01, '가장자리 발광');
    R(blade, c, 'bladeEdgePower', 0.5, 16, 0.1, '가장자리 조임');
    R(blade, c, 'bladeRim', 0, 4, 0.01, '가장자리');
    R(blade, c, 'bladeRimPower', 0.1, 8, 0.05, '가장자리 파워');
    R(blade, c, 'bladeTipGlow', 0, 6, 0.01, '점 발광');
    R(blade, c, 'bladeTipStart', 0, 0.98, 0.01, '점 시작점');
    R(blade, c, 'bladeVein', 0, 4, 0.01, '결함');
    R(blade, c, 'bladeVeinScale', 0.2, 20, 0.1, '결함 스케일');
    R(blade, c, 'bladeVeinBands', 0.2, 12, 0.1, '주변 결함');
    R(blade, c, 'bladeVeinSharp', 0.2, 8, 0.05, '결함 선명도');
    R(blade, c, 'bladeHeartBleed', 0, 6, 0.01, '심장 발광');
    R(blade, c, 'bladeHeartReach', 0.1, 8, 0.05, '... 이내 (m)');
    R(blade, c, 'bladeChargeGain', 0, 6, 0.01, '충전 이득');
    R(blade, c, 'bladeBurnGlow', 0, 12, 0.05, '탄 가장자리');
    R(blade, c, 'bladeRoughness', 0.02, 1, 0.01, '거칠기');
    R(blade, c, 'bladeMetalness', 0, 1, 0.01, '금속성');
    R(blade, c, 'bladeEnv', 0, 3, 0.01, '환경 (IBL)');
    R(blade, c, 'bladeGlow', 0, 4, 0.01, '발광');
    blade.addColor(c, 'colorBladeBody').name('청록 몸통');
    blade.addColor(c, 'colorBladeFacet').name('청록 면');
    blade.addColor(c, 'colorBladeBodyDeep').name('보라 몸통');
    blade.addColor(c, 'colorBladeFacetDeep').name('보라 면');
    blade.addColor(c, 'colorBladeEdge').name('가장자리');
    blade.addColor(c, 'colorBladeVein').name('결함');
    blade.addColor(c, 'colorBladeHot').name('점');

    const heart = burst.addFolder('심장과 후광');
    R(heart, c, 'heartSize', 0.02, 1.5, 0.01, '반경, x 크기');
    R(heart, c, 'heartSwell', 0, 2, 0.01, '완충 시 팽창');
    R(heart, c, 'heartBoil', 0, 1, 0.005, '실루엣 요동');
    R(heart, c, 'heartBoilScale', 0.2, 8, 0.05, '교반 규모');
    R(heart, c, 'heartFill', 0.05, 6, 0.01, '축 가중');
    R(heart, c, 'heartRim', 0, 4, 0.01, '가장자리');
    R(heart, c, 'heartRimPower', 0.1, 8, 0.05, '가장자리 파워');
    R(heart, c, 'heartFilament', 0, 4, 0.01, '실');
    R(heart, c, 'heartFilamentScale', 0.2, 12, 0.05, '실 스케일');
    R(heart, c, 'heartFilamentSpeed', 0, 4, 0.01, '실 속도');
    R(heart, c, 'heartIntensity', 0, 6, 0.01, '강도');
    R(heart, c, 'heartChargeGain', 0, 8, 0.01, '충전 이득');
    R(heart, c, 'heartSoftFade', 0, 3, 0.01, '부드러운 페이드(m)');
    R(heart, c, 'haloSize', 0.1, 8, 0.05, '후광 반경, x size');
    R(heart, c, 'haloGlow', 0, 4, 0.01, '후광 발광');
    R(heart, c, 'haloFalloff', 0.2, 8, 0.05, '후광 감쇠');
    R(heart, c, 'haloRays', 0, 3, 0.01, '스포크');
    R(heart, c, 'haloRayCount', 1, 48, 1, '스포크 수');
    R(heart, c, 'haloRaySharp', 0.5, 24, 0.5, '스포크 선예도');
    R(heart, c, 'haloRaySpin', -1, 1, 0.005, '스포크 회전(rev/s)');
    R(heart, c, 'haloRingSeat', 0.05, 0.98, 0.01, '고리 위치');
    R(heart, c, 'haloRingWidth', 0.005, 0.4, 0.005, '고리 너비');
    heart.addColor(c, 'colorHeartCore').name('심장 중심');
    heart.addColor(c, 'colorHeart').name('심장');
    heart.addColor(c, 'colorHeartEdge').name('심장 가장자리');
    heart.addColor(c, 'colorHaloInner').name('후광 안쪽');
    heart.addColor(c, 'colorHaloOuter').name('후광 바깥');

    const throwFolder = folder.addFolder('투척물');
    throwFolder.add(c, 'throwEnabled').name('칼날 투척');
    R(throwFolder, c, 'throwRange', 1, 40, 0.1, '도달거리 (m)');
    R(throwFolder, c, 'throwInterval', 0.05, 5, 0.01, '플러리 간격 (s)');
    R(throwFolder, c, 'throwWarmup', 0.01, 3, 0.01, '감기(s)');
    R(throwFolder, c, 'throwTargets', 1, 6, 1, '플러리당 몸통');
    R(throwFolder, c, 'throwBlades', 1, 6, 1, '몸통당 칼날');
    R(throwFolder, c, 'throwStagger', 0, 0.6, 0.005, '칼날 간격 (s)');
    R(throwFolder, c, 'throwAim', 0, 1, 0.01, '몸통 상부 위치');
    R(throwFolder, c, 'throwLife', 0.05, 3, 0.01, '화면 표시 시간 (s)');
    R(throwFolder, c, 'throwStrike', 0.02, 0.95, 0.01, '도달 시점');
    R(throwFolder, c, 'throwHold', 0.05, 1, 0.01, '발동 시점');
    R(throwFolder, c, 'throwLength', 0.1, 4, 0.01, '칼날 길이 (m)');
    R(throwFolder, c, 'throwSmear', 0, 3, 0.01, '속도 번짐');
    R(throwFolder, c, 'throwSpin', 0, 8, 0.05, '회전(rev/수명)');
    R(throwFolder, c, 'throwCurve', 0, 1, 0.01, '선 휨');
    R(throwFolder, c, 'throwLoft', -0.5, 0.5, 0.005, '라인 이탈 상승');
    R(throwFolder, c, 'throwOverrun', 0, 8, 0.05, '초과 진행 (m)');
    R(throwFolder, c, 'throwHeat', 0, 4, 0.01, '추가 발열');
    R(throwFolder, c, 'throwFlare', 0, 8, 0.05, '착지 시 플레어');
    R(throwFolder, c, 'throwShake', 0, 1, 0.005, '던짐 흔들림');
    R(throwFolder, c, 'throwFlash', 0, 1, 0.005, '던짐 섬광');

    const cut = throwFolder.addFolder('절단');
    R(cut, c.cutHit, 'impulse', 0, 20, 0.1, '충격');
    R(cut, c.cutHit, 'lift', 0, 20, 0.1, '상승');
    R(cut, c.cutHit, 'spin', 0, 10, 0.05, '회전');
    R(cut, c, 'cutSparks', 0, 400, 1, '불꽃');
    R(cut, c, 'cutMotes', 0, 300, 1, '부유 입자');
    R(cut, c, 'cutChips', 0, 150, 1, '파편');
    R(cut, c, 'cutSpeed', 0, 20, 0.1, '스프레이 속도');
    R(cut, c, 'cutShake', 0, 1, 0.005, '흔들림');
    R(cut, c, 'cutFlash', 0, 1, 0.005, '섬광');
    R(cut, c, 'grazeSparks', 0, 200, 1, '스침 불꽃');
    R(cut, c, 'launchSparks', 0, 200, 1, '발사 불꽃');
    R(cut, c, 'launchChips', 0, 60, 1, '발사 파편');
    R(cut, c, 'trailRate', 0, 600, 5, 's당 궤적 불꽃');

    const particles = folder.addFolder('5 · 먼지·불꽃·파편·안개');
    R(particles, c, 'moteRate', 0, 400, 1, '초당 부유 입자');
    R(particles, c, 'moteSize', 0.005, 0.4, 0.005, '부유 입자 크기');
    R(particles, c, 'moteLifetime', 0.1, 8, 0.05, '부유 입자 수명');
    R(particles, c, 'moteSpeed', 0, 8, 0.05, '부유 입자 속도');
    R(particles, c, 'moteRise', -4, 4, 0.05, '부유 입자 상승');
    R(particles, c, 'moteTurbulence', 0, 3, 0.01, '부유 입자 난류');
    R(particles, c, 'moteSeat', 0, 1.5, 0.01, '들어올림 목표');
    Editor.gradient(particles, c, 'colorMote', '먼지 그라데이션');
    R(particles, c, 'sparkSize', 0.005, 0.4, 0.005, '불꽃 크기');
    R(particles, c, 'sparkLifetime', 0.05, 4, 0.05, '불꽃 수명');
    R(particles, c, 'sparkSpeed', 0, 30, 0.1, '불꽃 속도');
    R(particles, c, 'sparkGravity', -20, 5, 0.1, '불꽃 중력');
    Editor.gradient(particles, c, 'colorSpark', '불꽃 그라데이션');
    R(particles, c, 'chipSize', 0.005, 0.4, 0.005, '파편 크기');
    R(particles, c, 'chipLifetime', 0.1, 8, 0.05, '파편 수명');
    R(particles, c, 'chipSpeed', 0, 20, 0.1, '파편 속도');
    R(particles, c, 'chipGravity', -30, 5, 0.1, '파편 중력');
    R(particles, c, 'chipSpin', 0, 20, 0.1, '파편 회전');
    Editor.gradient(particles, c, 'colorChip', '파편 그라데이션');
    R(particles, c, 'mistRate', 0, 60, 0.5, '초당 안개');
    R(particles, c, 'mistSize', 0.05, 4, 0.05, '안개 크기');
    R(particles, c, 'mistLifetime', 0.2, 10, 0.05, '안개 수명');
    R(particles, c, 'mistSpeed', 0, 6, 0.05, '안개 속도');
    R(particles, c, 'mistRise', -2, 3, 0.01, '안개 상승');
    R(particles, c, 'mistSeat', 0, 1.5, 0.01, '안개 위치');
    R(particles, c, 'mistOpacity', 0, 1, 0.01, '안개 불투명도');
    Editor.gradient(particles, c, 'colorMist', '안개 그라데이션');

    const impact = folder.addFolder('충돌·카메라·조명');
    R(impact, c, 'castMotes', 0, 200, 1, '손 방출 부유 입자');
    R(impact, c, 'creepRate', 0, 200, 1, '초당 파편 방출 부유 입자');
    R(impact, c, 'stainRate', 0.1, 10, 0.1, 'm당 지면 자국');
    R(impact, c, 'landMotes', 0, 600, 1, '착지 부유 입자');
    R(impact, c, 'landSparks', 0, 400, 1, '착지 불꽃');
    R(impact, c, 'landMist', 0, 120, 1, '착지 안개');
    R(impact, c, 'landShake', 0, 2, 0.005, '착지 흔들림');
    R(impact, c, 'landFlash', 0, 1, 0.005, '착지 섬광');
    R(impact, c, 'shakeDuration', 0.05, 3, 0.01, '흔들림 감쇠 (s)');
    R(impact, c, 'crownMotes', 0, 600, 1, '형성 시 부유 입자');
    R(impact, c, 'crownSparks', 0, 600, 1, '형성 중 불꽃');
    R(impact, c, 'crownChips', 0, 200, 1, '형성 중 파편');
    R(impact, c, 'crownShake', 0, 1, 0.005, '형성 흔들림');
    R(impact, c, 'crownFlash', 0, 1, 0.005, '형성 섬광');
    R(impact, c, 'castFlash', 0, 1, 0.005, '시전 섬광');
    R(impact, c, 'holdShake', 0, 0.4, 0.001, '정립 럼블');
    R(impact, c, 'rumble', 0, 0.4, 0.001, '이동 럼블');
    R(impact, c, 'stainRadius', 0.05, 4, 0.05, '얼룩 반경');
    R(impact, c, 'stainLife', 0.1, 20, 0.1, '얼룩 수명');
    R(impact, c, 'stainIntensity', 0, 3, 0.01, '얼룩 강도');
    impact.addColor(c, 'colorStain').name('얼룩');
    impact.addColor(c, 'colorStainEdge').name('얼룩 가장자리');
    impact.addColor(c, 'colorCastFlash').name('시전 섬광 색상');
    impact.addColor(c, 'colorFlash').name('섬광 색상');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 80, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 40, 0.1, '빛 반경');
    R(light, c, 'lightHeight', 0, 1, 0.01, '폭발 내 높이');
    R(light, c, 'lightPulse', 0, 2, 0.01, '뱅크 담당');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.cascadeFolder = folder;
  }

  /**
   * The Celestial Rend.
   *
   * Grouped by the four panels of its reference sheet, in the order they
   * happen — mark, tendrils, shards, then the divine impact split into the
   * column, the star and the halos — and then by what the rend does to a body.
   *
   * Three sliders re-scale the whole thing in proportion and are the ones worth
   * reaching for first: `zoneRadius` in "The cast" (nearly every horizontal
   * length is a multiple of it), `pillarHeight` in "4 · The column" (the star,
   * the halos and the shard ceiling all seat off it), and `chargeTime` in "The
   * order it happens in", which is the entire pacing of the piece.
   */
  _buildRend() {
    const folder = this.gui.addFolder('✧  천열');
    const c = settings.rend;
    const R = Editor.range;

    const cast = folder.addFolder('시전');
    R(cast, c, 'zoneRadius', 0.5, 14, 0.05, '범위 반경');
    R(cast, c, 'range', 2, 50, 0.1, '최대 사거리');
    R(cast, c, 'minRange', 0, 10, 0.1, '최소 사거리');
    R(cast, c, 'speed', 5, 200, 1, '부유 입자 속도');
    R(cast, c, 'lifetime', 0.5, 20, 0.05, '유지 시간(s)');
    R(cast, c, 'fadeTime', 0.05, 6, 0.01, '닫힘 (s)');
    R(cast, c, 'cooldown', 0, 12, 0.05, '재사용 대기시간');
    R(cast, c, 'handHeight', 0, 2.5, 0.01, '손 높이');
    R(cast, c, 'handForward', -1, 3, 0.01, '손 전방');
    R(cast, c, 'handSide', -2, 2, 0.01, '손 쪽');
    R(cast, c, 'trailMotes', 0, 200, 1, 'm당 궤적 부유 입자');
    R(cast, c, 'seedStarSize', 0, 1.5, 0.01, '씨앗 별, x 범위');
    R(cast, c, 'seedHeight', 0.2, 8, 0.05, '씨앗 높이 (m)');
    Editor.castAnimation(cast, c);

    const order = folder.addFolder('진행 순서');
    R(order, c, 'sigilTime', 0.02, 3, 0.01, '자국 기록 시간 (s)');
    R(order, c, 'tendrilDelay', 0, 3, 0.01, '덩굴손 시작(s)');
    R(order, c, 'tendrilTime', 0.05, 4, 0.01, '덩굴손 상승(s)');
    R(order, c, 'chargeTime', 0.1, 6, 0.01, '파편 진입 시간 (s)');
    R(order, c, 'rendTime', 0.05, 3, 0.01, '찢김 소요(s)');
    R(order, c, 'pillarRise', 0.02, 3, 0.01, '광선 상승 (s)');
    R(order, c, 'pulseRate', 0, 6, 0.01, '타종 발생량');
    R(order, c, 'pulseDepth', 0, 1.5, 0.01, '타종 깊이');

    /* ---- 1 ---- */
    const sigil = folder.addFolder('1 · 천체 표식');
    R(sigil, c, 'sigilHeight', 0.001, 0.2, 0.001, '호버 (m)');
    R(sigil, c, 'sigilLineWidth', 0.004, 0.2, 0.002, '획 너비(m)');
    R(sigil, c, 'sigilLineGlow', 0, 6, 0.05, '획 발광');
    R(sigil, c, 'sigilOpacity', 0, 2, 0.01, '불투명도');
    R(sigil, c, 'sigilGlow', 0, 4, 0.01, '발광');

    const sigilStar = sigil.addFolder('별');
    R(sigilStar, c, 'sigilStar', 0, 3, 0.01, '별');
    R(sigilStar, c, 'sigilStarPoints', 2, 12, 1, '점');
    R(sigilStar, c, 'sigilStarOuter', 0.2, 2, 0.01, '도달거리, x 범위');
    R(sigilStar, c, 'sigilStarSharp', 0.2, 8, 0.05, '점 선명도');
    R(sigilStar, c, 'sigilStarSpin', -0.2, 0.2, 0.001, '회전(rev/s)');
    R(sigilStar, c, 'sigilStarFill', 0, 2, 0.01, '채움');
    R(sigilStar, c, 'sigilStarInner', 0, 3, 0.01, '안쪽 별');
    R(sigilStar, c, 'sigilStarInnerScale', 0.05, 1, 0.01, '안쪽 스케일');

    const sigilRings = sigil.addFolder('고리 둥지');
    R(sigilRings, c, 'sigilRings', 0, 3, 0.01, '고리');
    R(sigilRings, c, 'sigilRingCount', 1, 8, 1, '개수');
    R(sigilRings, c, 'sigilRingInner', 0.02, 1.5, 0.01, '가장 안쪽, x footprint');
    R(sigilRings, c, 'sigilRingSpread', 0, 1.5, 0.01, '초과 확산');
    R(sigilRings, c, 'sigilRingWobble', 0, 0.12, 0.002, '경계 흔들림');
    R(sigilRings, c, 'sigilRingWobbleLobes', 1, 16, 1, '방황 엽');

    const sigilMarks = sigil.addFolder('글리프·눈금·균열');
    R(sigilMarks, c, 'sigilGlyphs', 0, 3, 0.01, '글리프');
    R(sigilMarks, c, 'sigilGlyphCount', 1, 16, 1, '개수');
    R(sigilMarks, c, 'sigilGlyphSeat', 0.05, 1.5, 0.01, '위치, x 범위');
    R(sigilMarks, c, 'sigilGlyphSize', 0.01, 0.5, 0.005, '크기(x 범위)');
    R(sigilMarks, c, 'sigilGlyphSpin', -0.2, 0.2, 0.001, '회전(rev/s)');
    R(sigilMarks, c, 'sigilTicks', 0, 3, 0.01, '틱');
    R(sigilMarks, c, 'sigilTickCount', 4, 120, 1, '개수');
    R(sigilMarks, c, 'sigilTickSeat', 0.2, 2, 0.01, '위치, x 범위');
    R(sigilMarks, c, 'sigilTickLength', 0.01, 0.5, 0.005, '길이, x footprint');
    R(sigilMarks, c, 'sigilTickSpin', -0.2, 0.2, 0.001, '회전(rev/s)');
    R(sigilMarks, c, 'sigilCracks', 0, 3, 0.01, '균열 (찢김 후)');
    R(sigilMarks, c, 'sigilCrackCount', 1, 24, 1, '개수');
    R(sigilMarks, c, 'sigilCrackSeat', 0.2, 2.5, 0.01, '도달거리, x 범위');
    R(sigilMarks, c, 'sigilCrackWander', 0, 1.5, 0.01, '분기 반경');
    R(sigilMarks, c, 'sigilCrackWidth', 0.005, 0.4, 0.005, '너비(x 범위)');

    const sigilWash = sigil.addFolder('번짐과 색상');
    R(sigilWash, c, 'sigilWash', 0, 2, 0.01, '번짐');
    R(sigilWash, c, 'sigilWashFalloff', 0.05, 6, 0.05, '워시 감쇠');
    R(sigilWash, c, 'sigilGrain', 0, 2, 0.01, '결');
    R(sigilWash, c, 'sigilGrainScale', 0.1, 8, 0.05, '결 스케일');
    sigilWash.addColor(c, 'colorSigilLine').name('선');
    sigilWash.addColor(c, 'colorSigilCore').name('코어');
    sigilWash.addColor(c, 'colorSigilDeep').name('심층');
    sigilWash.addColor(c, 'colorSigilWash').name('번짐');
    sigilWash.addColor(c, 'colorFront').name('필기 가장자리');

    /* ---- 2 ---- */
    const tendril = folder.addFolder('2 · 아스트랄 촉수');
    R(tendril, c, 'tendrils', 1, 40, 1, '개수');
    R(tendril, c, 'tendrilSeat', 0.05, 2, 0.01, '위치, x 범위');
    R(tendril, c, 'tendrilSeatJitter', 0, 1, 0.01, '위치 지터');
    R(tendril, c, 'tendrilSpread', 0, 3, 0.01, '방향 지터');
    R(tendril, c, 'tendrilReach', 0.1, 1.5, 0.01, '상승, x 기둥 높이');
    R(tendril, c, 'tendrilCharge', 0.02, 1.5, 0.01, '... 찢김 전');
    R(tendril, c, 'tendrilHeightJitter', 0, 1, 0.01, '높이 지터');
    R(tendril, c, 'tendrilRise', 0, 1.5, 0.005, '초당 반복');
    R(tendril, c, 'tendrilLength', 0.05, 2, 0.01, '리본 한 개 폭');
    R(tendril, c, 'tendrilWind', 0, 6, 0.05, '상승 전환');
    R(tendril, c, 'tendrilShear', 0, 4, 0.01, '차동 권선');
    R(tendril, c, 'tendrilCounter', 0, 1, 0.01, '되감김 비율');
    R(tendril, c, 'tendrilFlare', 0.02, 2, 0.01, '닫힘 위치');
    R(tendril, c, 'tendrilDraw', 0, 1, 0.01, '축 흡입');
    R(tendril, c, 'tendrilDrawAt', 0, 0.98, 0.01, '... 시작 위치');
    R(tendril, c, 'tendrilWander', 0, 3, 0.01, '방황(m)');
    R(tendril, c, 'tendrilWanderScale', 0.1, 6, 0.05, '방황 스케일');
    R(tendril, c, 'tendrilWanderSpeed', 0, 3, 0.01, '방황 속도');
    R(tendril, c, 'tendrilWidth', 0.002, 0.2, 0.001, '너비(x 높이)');
    R(tendril, c, 'tendrilWidthBias', 0.05, 3, 0.01, '상승 가늘어짐');
    R(tendril, c, 'tendrilHead', 0, 3, 0.01, '머리 띠');
    R(tendril, c, 'tendrilHeadWidth', 0.01, 0.5, 0.005, '선단 너비');
    R(tendril, c, 'tendrilHeadRate', 0, 3, 0.01, '선단 속도');
    R(tendril, c, 'tendrilIntensity', 0, 6, 0.05, '강도');
    R(tendril, c, 'tendrilSoftEdge', 0.05, 5, 0.05, '가장자리 부드러움');
    R(tendril, c, 'tendrilErode', 0, 1, 0.01, '침식');
    R(tendril, c, 'tendrilErodeScale', 0.1, 10, 0.05, '침식 규모');
    R(tendril, c, 'tendrilErodeSpeed', 0, 4, 0.01, '침식 속도');
    R(tendril, c, 'tendrilHeadFade', 0, 0.9, 0.01, '상단 페이드');
    R(tendril, c, 'tendrilTailFade', 0, 0.9, 0.01, '뿌리 페이드');
    R(tendril, c, 'tendrilSoftFade', 0, 3, 0.01, '소프트 파티클 페이드');
    R(tendril, c, 'tendrilOpacity', 0, 2, 0.01, '불투명도');
    R(tendril, c, 'tendrilGlow', 0, 4, 0.01, '발광');
    tendril.addColor(c, 'colorTendrilRoot').name('뿌리');
    tendril.addColor(c, 'colorTendrilWarm').name('온기 가닥');
    tendril.addColor(c, 'colorTendrilCold').name('냉기 가닥');
    tendril.addColor(c, 'colorTendrilTip').name('필라멘트/머리');

    /* ---- 3 ---- */
    const shard = folder.addFolder('3 · 빛나는 파편');
    R(shard, c, 'shardDensity', 0, 1, 0.01, '밀도');
    R(shard, c, 'shardSize', 0.1, 6, 0.05, '길이 (m)');
    R(shard, c, 'shardGirth', 0.2, 4, 0.05, '두께(x 대상)');

    const inbound = shard.addFolder('접근');
    R(inbound, c, 'shardReach', 0.5, 8, 0.05, '유입 위치, x 범위');
    R(inbound, c, 'shardFlight', 0.1, 3, 0.01, '통과 시간 (초)');
    R(inbound, c, 'shardLoft', 0, 3, 0.01, '시작 높이(x 기둥)');
    R(inbound, c, 'shardCurve', 0, 3, 0.01, '반경 휨');
    R(inbound, c, 'shardRoll', 0, 3, 0.01, '롤 (rev/s)');
    R(inbound, c, 'trailRate', 0, 300, 1, '초당 줄무늬');

    const thrown = shard.addFolder('투척 비산');
    R(thrown, c, 'shardScatter', 0, 4, 0.01, '던짐 확산(s)');
    R(thrown, c, 'shardSettle', 0.05, 5, 0.01, '침전 시간 (s)');
    R(thrown, c, 'shardOrbit', 0.1, 4, 0.01, '궤도, x 범위');
    R(thrown, c, 'shardCeiling', 0.02, 1.5, 0.01, '천장, x 기둥');
    R(thrown, c, 'shardDrift', 0, 4, 0.01, '계속 상승, m/s');
    R(thrown, c, 'shardSpin', 0, 3, 0.01, '궤도 속도 (rad/s)');
    R(thrown, c, 'shardTumble', 0, 2, 0.01, '텀블(rev/s)');
    R(thrown, c, 'shardDebris', 0.1, 2, 0.01, '크기(x 길이)');

    const crystal = shard.addFolder('결정');
    R(crystal, c, 'shardFresnel', 0, 6, 0.05, '가장자리');
    R(crystal, c, 'shardFresnelPower', 0.2, 8, 0.05, '가장자리 파워');
    R(crystal, c, 'shardVein', 0, 6, 0.05, '결함');
    R(crystal, c, 'shardVeinScale', 0.5, 20, 0.1, '결함 스케일');
    R(crystal, c, 'shardVeinSharp', 0.5, 8, 0.05, '결함 선명도');
    R(crystal, c, 'shardSpine', 0, 6, 0.05, '발광 척추');
    R(crystal, c, 'shardSpinePower', 0.2, 8, 0.05, '중심축 강도');
    R(crystal, c, 'shardGlint', 0, 4, 0.05, '반짝임');
    R(crystal, c, 'shardGlintScale', 2, 80, 1, '반짝임 스케일');
    R(crystal, c, 'shardHeatGlow', 0, 20, 0.1, '도달 백화');
    R(crystal, c, 'shardBeamBleed', 0, 6, 0.05, '기둥 발광');
    R(crystal, c, 'shardBeamRadius', 0.5, 30, 0.1, '... 바깥쪽 (m)');
    R(crystal, c, 'shardRoughness', 0, 1, 0.01, '거칠기');
    R(crystal, c, 'shardMetalness', 0, 1, 0.01, '금속성');
    R(crystal, c, 'shardEnvIntensity', 0, 3, 0.01, '환경 강도');
    crystal.addColor(c, 'colorShardBody').name('몸통');
    crystal.addColor(c, 'colorShardFacet').name('면');
    crystal.addColor(c, 'colorShardWarm').name('온기 테두리');
    crystal.addColor(c, 'colorShardCold').name('냉기 테두리');
    crystal.addColor(c, 'colorShardVein').name('결함');
    crystal.addColor(c, 'colorShardHot').name('백열');

    /* ---- 4 ---- */
    const pillar = folder.addFolder('4 · 기둥');
    R(pillar, c, 'pillarHeight', 2, 80, 0.5, '높이 (m)');
    R(pillar, c, 'pillarRadius', 0.02, 2, 0.01, '반경, x 범위');
    R(pillar, c, 'pillarSkirt', 0, 4, 0.01, '바닥 스커트');
    R(pillar, c, 'pillarSkirtPower', 0.5, 12, 0.05, '스커트 감쇠');
    R(pillar, c, 'pillarTopFlare', 0.2, 3, 0.01, '상단 플레어');
    R(pillar, c, 'pillarFlarePower', 0.1, 6, 0.05, '플레어 감쇠');
    R(pillar, c, 'pillarWobble', 0, 0.6, 0.005, '배럴 흔들림');
    R(pillar, c, 'pillarWobbleScale', 0.1, 6, 0.05, '워블 스케일');
    R(pillar, c, 'pillarWobbleSpeed', 0, 6, 0.05, '워블 속도');
    R(pillar, c, 'pillarSpin', -1, 1, 0.005, '배럴 회전 (rev/s)');
    R(pillar, c, 'pillarBodyPower', 0.05, 4, 0.01, '현 감쇠');
    R(pillar, c, 'pillarCorePower', 0.5, 24, 0.1, '필라멘트 감쇠');
    R(pillar, c, 'pillarCore', 0, 6, 0.05, '필라멘트');
    R(pillar, c, 'pillarRim', 0, 4, 0.01, '부식 가장자리');
    R(pillar, c, 'pillarRimPower', 0.1, 8, 0.05, '가장자리 파워');
    R(pillar, c, 'pillarFlutes', 1, 80, 1, '홈');
    R(pillar, c, 'pillarFluteSharp', 0.05, 4, 0.01, '홈 선명도');
    R(pillar, c, 'pillarFluteDepth', 0, 1, 0.01, '홈 깊이');
    R(pillar, c, 'pillarFluteDrift', -0.5, 0.5, 0.005, '홈 드리프트');
    R(pillar, c, 'pillarStreamScale', 0.05, 5, 0.01, '흐름 스케일');
    R(pillar, c, 'pillarStreamSpeed', 0, 8, 0.05, '흐름 속도');
    R(pillar, c, 'pillarHeadFade', 0, 0.95, 0.01, '상단 페이드');
    R(pillar, c, 'pillarFootGlow', 0, 6, 0.05, '하단 발광');
    R(pillar, c, 'pillarFootReach', 0.01, 1, 0.005, '하단 도달거리');
    R(pillar, c, 'pillarSoftFade', 0, 3, 0.01, '소프트 파티클 페이드');
    R(pillar, c, 'pillarIntensity', 0, 8, 0.05, '강도');
    R(pillar, c, 'pillarOpacity', 0, 2, 0.01, '불투명도');
    R(pillar, c, 'pillarGlow', 0, 4, 0.01, '발광');
    R(pillar, c, 'pillarSparks', 0, 600, 5, '기둥 상승 불꽃');
    pillar.addColor(c, 'colorPillarCore').name('필라멘트');
    pillar.addColor(c, 'colorPillarBody').name('몸통');
    pillar.addColor(c, 'colorPillarEdge').name('위쪽');
    pillar.addColor(c, 'colorPillarCool').name('부식 가장자리');

    const star = folder.addFolder('4 · 별');
    R(star, c, 'starSeat', 0, 1.2, 0.01, '위치, x 기둥 높이');
    R(star, c, 'starSize', 0.1, 4, 0.01, '크기(x 범위)');
    R(star, c, 'starDelay', 0, 2, 0.01, '열림 시점 (찢김 후 s)');
    R(star, c, 'starTime', 0.05, 3, 0.01, '열림 시간 (s)');
    R(star, c, 'starBob', 0, 3, 0.01, '이동 (m)');
    R(star, c, 'starBobSpeed', 0, 2, 0.01, '이동 속도');
    R(star, c, 'starVertical', 0, 3, 0.01, '수직 꼭짓점');
    R(star, c, 'starVerticalSharp', 0.5, 24, 0.1, '... 선명도');
    R(star, c, 'starHorizontal', 0, 3, 0.01, '수평 점');
    R(star, c, 'starHorizontalSharp', 0.5, 24, 0.1, '... 선명도');
    R(star, c, 'starDiagonal', 0, 3, 0.01, '대각 점');
    R(star, c, 'starDiagonalSharp', 0.5, 24, 0.1, '... 선명도');
    R(star, c, 'starReach', 0.02, 1.5, 0.005, '점 도달거리');
    R(star, c, 'starFalloff', 0.2, 8, 0.05, '점 셰이딩');
    R(star, c, 'starHalo', 0, 3, 0.01, '주변 블룸');
    R(star, c, 'starCore', 0.005, 0.5, 0.005, '코어 크기');
    R(star, c, 'starCoreGain', 0, 6, 0.05, '코어 이득');
    R(star, c, 'starNeedles', 0, 2, 0.01, '바늘 분사');
    R(star, c, 'starNeedleCount', 4, 120, 1, '바늘');
    R(star, c, 'starNeedleSharp', 0.5, 30, 0.1, '바늘 선명도');
    R(star, c, 'starNeedleReach', 0, 2, 0.01, '바늘 도달거리');
    R(star, c, 'starNeedleSpin', -0.2, 0.2, 0.001, '바늘 회전');
    R(star, c, 'starRing', 0, 3, 0.01, '타격 원');
    R(star, c, 'starRingSeat', 0.02, 1.2, 0.01, '원 위치');
    R(star, c, 'starRingWidth', 0.002, 0.2, 0.002, '원 너비');
    R(star, c, 'starFlicker', 0, 1, 0.01, '깜빡임');
    R(star, c, 'starFlickerRate', 0, 12, 0.1, '깜빡임 빈도');
    R(star, c, 'starIntensity', 0, 8, 0.05, '강도');
    R(star, c, 'starOpacity', 0, 2, 0.01, '불투명도');
    R(star, c, 'starGlow', 0, 4, 0.01, '발광');
    star.addColor(c, 'colorStarCore').name('코어');
    star.addColor(c, 'colorStarBody').name('몸통');
    star.addColor(c, 'colorStarEdge').name('가장자리');
    star.addColor(c, 'colorStarCool').name('냉기 끝');

    const halo = folder.addFolder('4 · 후광 고리');
    R(halo, c, 'haloRadius', 0.2, 4, 0.01, '바깥쪽, x 범위');
    R(halo, c, 'haloSeat', 0.72, 1, 0.005, '띠 위치');
    R(halo, c, 'haloBand', 0.01, 0.28, 0.005, '띠 깊이');
    R(halo, c, 'haloSecond', 0.2, 1.5, 0.01, '두 번째 고리, × 첫 번째');
    R(halo, c, 'haloDelay', 0, 2, 0.01, '열림 시점 (찢김 후 s)');
    R(halo, c, 'haloStagger', 0, 1, 0.01, '둘 간격(s)');
    R(halo, c, 'haloTime', 0.05, 3, 0.01, '회전 기록(s)');
    R(halo, c, 'haloTilt', 0, 1.4, 0.01, '기울임 (rad)');
    R(halo, c, 'haloSpin', -1, 1, 0.005, '회전(rev/s)');
    R(halo, c, 'haloLift', 0, 1.5, 0.01, '간격, x 범위');
    R(halo, c, 'haloRails', 0, 4, 0.01, '레일');
    R(halo, c, 'haloRailWidth', 0.002, 0.3, 0.002, '레일 너비');
    R(halo, c, 'haloDashes', 0, 1, 0.01, '대시');
    R(halo, c, 'haloDashCount', 4, 160, 1, '개수');
    R(halo, c, 'haloDashDuty', 0.05, 0.95, 0.01, '대시 듀티');
    R(halo, c, 'haloDashDrift', -0.4, 0.4, 0.005, '대시 이동');
    R(halo, c, 'haloGlyphs', 0, 3, 0.01, '구슬');
    R(halo, c, 'haloGlyphCount', 2, 40, 1, '개수');
    R(halo, c, 'haloGlyphSize', 0.002, 0.2, 0.002, '구슬 크기');
    R(halo, c, 'haloSweep', 0, 4, 0.01, '발광 팔다리');
    R(halo, c, 'haloSweepSharp', 0.1, 12, 0.05, '팔다리 선명도');
    R(halo, c, 'haloSweepRate', -1, 1, 0.005, '팔다리 이동 (rev/s)');
    R(halo, c, 'haloGrain', 0, 2, 0.01, '결');
    R(halo, c, 'haloGrainScale', 0.1, 10, 0.05, '결 스케일');
    R(halo, c, 'haloIntensity', 0, 8, 0.05, '강도');
    R(halo, c, 'haloOpacity', 0, 2, 0.01, '불투명도');
    R(halo, c, 'haloGlow', 0, 4, 0.01, '발광');
    halo.addColor(c, 'colorHaloCore').name('레일/구슬');
    halo.addColor(c, 'colorHaloBody').name('띠');
    halo.addColor(c, 'colorHaloCool').name('냉기 가장자리');

    const warp = folder.addFolder('밀어내는 공기');
    R(warp, c, 'warpReach', 0.5, 4, 0.01, '도달거리, x 축');
    R(warp, c, 'warpStrength', 0, 6, 0.05, '강도');
    R(warp, c, 'warpRipples', 0, 20, 0.1, '높이 방향 띠');
    R(warp, c, 'warpSpeed', 0, 20, 0.1, '띠 속도');
    R(warp, c, 'warpChop', 0, 3, 0.01, '분해');
    R(warp, c, 'warpChopScale', 0.1, 8, 0.05, '분해 규모');

    /* ---- particles ---- */
    const particles = folder.addFolder('입자');
    R(particles, c, 'moteRate', 0, 900, 5, '초당 부유 입자');
    R(particles, c, 'moteSeat', 0, 2, 0.01, '부유 입자 위치, x 범위');
    R(particles, c, 'moteSize', 0.005, 0.5, 0.005, '부유 입자 크기');
    R(particles, c, 'moteSpeed', 0, 12, 0.05, '부유 입자 속도');
    R(particles, c, 'moteLifetime', 0.1, 6, 0.05, '부유 입자 수명');
    R(particles, c, 'moteRise', -6, 8, 0.05, '부유 입자 상승');
    R(particles, c, 'moteTurbulence', 0, 3, 0.01, '부유 입자 난류');
    Editor.gradient(particles, c, 'colorMote', '먼지 그라데이션');

    R(particles, c, 'sparkSize', 0.005, 0.5, 0.005, '불꽃 크기');
    R(particles, c, 'sparkSpeed', 0, 30, 0.1, '불꽃 속도');
    R(particles, c, 'sparkLifetime', 0.05, 5, 0.05, '불꽃 수명');
    R(particles, c, 'sparkGravity', -30, 10, 0.1, '불꽃 중력');
    Editor.gradient(particles, c, 'colorSpark', '불꽃 그라데이션');

    R(particles, c, 'chipSize', 0.01, 0.6, 0.005, '파편 크기');
    R(particles, c, 'chipSpeed', 0, 30, 0.1, '파편 속도');
    R(particles, c, 'chipLifetime', 0.1, 6, 0.05, '파편 수명');
    R(particles, c, 'chipGravity', -40, 0, 0.5, '파편 중력');
    R(particles, c, 'chipSpin', 0, 3, 0.01, '파편 회전');
    Editor.gradient(particles, c, 'colorChip', '파편 그라데이션');

    R(particles, c, 'dustRate', 0, 400, 1, '초당 먼지');
    R(particles, c, 'dustSeat', 0, 2, 0.01, '먼지 위치, x 범위');
    R(particles, c, 'dustSize', 0.05, 4, 0.05, '먼지 크기');
    R(particles, c, 'dustSpeed', 0, 12, 0.05, '먼지 속도');
    R(particles, c, 'dustLifetime', 0.2, 8, 0.05, '먼지 수명');
    R(particles, c, 'dustRise', -4, 6, 0.05, '먼지 상승');
    R(particles, c, 'dustOpacity', 0, 2, 0.01, '먼지 불투명도');
    Editor.gradient(particles, c, 'colorDust', '먼지 그라데이션');

    /* ---- the beats ---- */
    const impact = folder.addFolder('시전·표식·강타·참격');
    R(impact, c, 'castMotes', 0, 400, 1, '시전 부유 입자');
    R(impact, c, 'castFlash', 0, 1, 0.01, '시전 섬광');
    R(impact, c, 'markMotes', 0, 600, 5, '자국 부유 입자');
    R(impact, c, 'markShake', 0, 2, 0.01, '자국 흔들림');
    R(impact, c, 'markFlash', 0, 1, 0.01, '자국 섬광');
    R(impact, c, 'gildLife', 0.5, 30, 0.5, '도금 수명');
    R(impact, c, 'gildIntensity', 0, 3, 0.01, '도금 강도');
    R(impact, c, 'strikeSparks', 0, 120, 1, '파편당 불꽃');
    R(impact, c, 'strikeChips', 0, 60, 1, '샤드당 파편');
    R(impact, c, 'strikeShake', 0, 0.5, 0.005, '파편당 흔들림');
    R(impact, c, 'shockRadius', 1, 50, 0.5, '충격 고리(m)');
    R(impact, c, 'rendSparks', 0, 2000, 10, '찢김 불꽃');
    R(impact, c, 'rendMotes', 0, 1500, 10, '찢김 부유 입자');
    R(impact, c, 'rendChips', 0, 800, 5, '찢김 조각');
    R(impact, c, 'rendDust', 0, 500, 5, '찢김 먼지');
    R(impact, c, 'rendShake', 0, 4, 0.01, '찢김 흔들림');
    R(impact, c, 'shakeDuration', 0.05, 3, 0.01, '흔들림 감쇠 (s)');
    R(impact, c, 'rendFlash', 0, 1.5, 0.01, '찢김 섬광');
    R(impact, c, 'rumble', 0, 0.5, 0.005, '이동 럼블');
    R(impact, c, 'holdShake', 0, 0.5, 0.005, '정립 럼블');
    impact.addColor(c, 'colorCastFlash').name('시전 섬광 색상');
    impact.addColor(c, 'colorFlash').name('참격 섬광 색상');
    impact.addColor(c, 'colorGild').name('금박');
    impact.addColor(c, 'colorGildEdge').name('금박 가장자리');

    /* ---- the judgment ---- */
    const judge = folder.addFolder('심판(몸에 가하는 것)');
    const j = c.judge;
    R(judge, j, 'reach', 0.2, 3, 0.01, '도달거리, x 범위');
    R(judge, j, 'impulse', 0, 12, 0.05, '넉백 (0 = 없음)');
    R(judge, j, 'lift', 0, 8, 0.05, '상승');
    R(judge, j, 'spin', 0, 4, 0.05, '토크');
    R(judge, j, 'press', 0, 8, 0.05, '하향 압력 (m/s)');
    R(judge, j, 'grab', 0, 30, 0.1, '초당 좌우 스크럽');
    R(judge, j, 'grabY', 0, 30, 0.1, '초당 수직 스크럽');
    R(judge, j, 'stagger', 0, 3, 0.01, '연소 분산 (s)');
    R(judge, j, 'devour', 0.05, 4, 0.01, '연소율 (bodies/s)');
    R(judge, j, 'markMotes', 0, 200, 1, '표시된 부유 입자 / s');
    R(judge, j, 'burnMotes', 0, 400, 1, '초당 연소 부유 입자');
    R(judge, j, 'condemnSparks', 0, 200, 1, '낙하 중 불꽃');
    R(judge, j, 'condemnRing', 0, 4, 0.05, '발밑 고리 (m)');
    R(judge, j, 'takenMotes', 0, 400, 1, '이동 시 부유 입자');
    R(judge, j, 'takenShake', 0, 1, 0.005, '이동 시 흔들림');

    const light = folder.addFolder('동적 조명');
    R(light, c, 'lightIntensity', 0, 90, 0.5, '빛 강도');
    R(light, c, 'lightRadius', 0.5, 60, 0.1, '빛 반경');
    R(light, c, 'lightHeight', 0, 1, 0.005, '샤프트 상부 높이');
    R(light, c, 'lightPulse', 0, 2, 0.01, '타종 비중');
    light.addColor(c, 'lightColor').name('조명 색상');

    this.rendFolder = folder;
  }


  /* ------------------------------------------------------------------ */

  _buildEnvironment() {
    const folder = this.gui.addFolder('환경');
    const e = settings.environment;
    const R = Editor.range;

    R(folder, e, 'sunIntensity', 0, 8, 0.01, '키 강도');
    folder.addColor(e, 'sunColor').name('키 라이트 색상');
    R(folder, e, 'sunAzimuth', 0, Math.PI * 2, 0.01, '키 방위각');
    R(folder, e, 'sunElevation', 0.05, 1.5, 0.01, '키 고도각');
    R(folder, e, 'ambientIntensity', 0, 3, 0.01, '주변광');
    folder.addColor(e, 'ambientColor').name('앰비언트 색상');
    R(folder, e, 'hemiIntensity', 0, 3, 0.01, '반구');
    R(folder, e, 'envIntensity', 0, 3, 0.01, '환경 (IBL)');
    R(folder, e, 'shadowRadius', 0, 8, 0.05, '그림자 부드러움');
    R(folder, e, 'shadowBias', -0.01, 0.001, 0.0001, '섀도 바이어스');
    R(folder, e, 'contactShadow', 0, 1.5, 0.01, '접촉 그림자');

    const rim = folder.addFolder('림 라이트');
    R(rim, e, 'rimIntensity', 0, 4, 0.01, '가장자리 강도');
    rim.addColor(e, 'rimColor').name('테두리 색상');
    R(rim, e, 'rimAzimuth', 0, Math.PI * 2, 0.01, '가장자리 방위각');
    R(rim, e, 'rimElevation', 0.05, 1.5, 0.01, '가장자리 고도');
    rim.addColor(e, 'hemiSkyColor').name('반구광 하늘');
    rim.addColor(e, 'hemiGroundColor').name('반구광 반사');

    const fog = folder.addFolder('배경·안개·먼지');
    fog.addColor(e, 'backgroundColor').name('배경');
    fog.add(e, 'fogEnabled').name('안개 사용');
    fog.addColor(e, 'fogColor').name('안개 색상');
    // near = where the fog starts, far = where it is total; widening the gap or
    // pushing both out thins the fog, closing it thickens it.
    R(fog, e, 'fogNear', 1, 200, 1, '안개 근거리');
    R(fog, e, 'fogFar', 10, 400, 1, '안개 원거리');
    R(fog, e, 'dustAmount', 0, 3, 0.01, '부유 먼지');

    const floor = folder.addFolder('무대 바닥');
    floor.add(e, 'floorTexture').name('석재 타일');
    R(floor, e, 'floorTextureScale', 0.5, 24, 0.1, '타일 크기(m)');
    R(floor, e, 'floorNormalScale', 0, 3, 0.01, '부조 강도');
    R(floor, e, 'floorTexTint', 0, 1, 0.01, '바닥 틴트');
    floor.addColor(e, 'floorColor').name('바닥 색상');
    floor.addColor(e, 'floorTint').name('바닥 색조');
    R(floor, e, 'floorRoughness', 0.05, 1, 0.01, '거칠기');
    R(floor, e, 'floorSheen', 0, 1, 0.01, '광택');
    R(floor, e, 'floorPool', 0, 1, 0.01, '빛못');
  }

  _buildPost() {
    const folder = this.gui.addFolder('후처리');
    const p = settings.post;
    const R = Editor.range;

    folder.add(p, 'enabled').name('사용');
    R(folder, p, 'exposure', 0.1, 3, 0.01, '노출');
    R(folder, p, 'bloomStrength', 0, 3, 0.01, '블룸 강도');
    R(folder, p, 'bloomRadius', 0, 1.5, 0.01, '블룸 반경');
    R(folder, p, 'bloomThreshold', 0, 2, 0.01, '블룸 임계값');
    R(folder, p, 'contrast', 0.5, 2, 0.01, '대비');
    R(folder, p, 'saturation', 0, 2.5, 0.01, '채도');
    R(folder, p, 'temperature', -0.5, 0.5, 0.01, '온도');
    R(folder, p, 'lift', -0.2, 0.2, 0.005, '상승');
    R(folder, p, 'gain', 0.5, 2, 0.01, '게인');
    R(folder, p, 'vignette', 0, 1.5, 0.01, '비네트');
    R(folder, p, 'chromaticAberration', 0, 3, 0.01, '색수차');
    R(folder, p, 'grain', 0, 0.2, 0.001, '필름 그레인');
    R(folder, p, 'distortion', 0, 0.2, 0.001, '화면 왜곡');
    R(folder, p, 'flashStrength', 0, 2, 0.01, '착탄 섬광');
  }

  _buildCamera() {
    const folder = this.gui.addFolder('카메라');
    const c = settings.camera;
    const R = Editor.range;

    // The wheel writes `distance` straight into settings, so the slider listens.
    R(folder, c, 'distance', 1, 40, 0.1, '거리').listen();
    R(folder, c, 'minDistance', 1, 20, 0.1, '최소 거리');
    R(folder, c, 'maxDistance', 4, 40, 0.1, '최대 거리');
    R(folder, c, 'zoomSpeed', 0.1, 3, 0.01, '줌 속도');
    R(folder, c, 'fov', 20, 90, 0.5, '시야각');
    R(folder, c, 'targetHeight', 0, 4, 0.01, '표적 높이');
    R(folder, c, 'minPolar', 0.05, 1.5, 0.01, '최소 피치');
    R(folder, c, 'maxPolar', 0.2, 1.55, 0.01, '최대 피치');
    R(folder, c, 'damping', 0.001, 0.5, 0.001, '추적 감쇠');
    R(folder, c, 'autoFrame', 0, 1, 0.01, '자동 프레이밍');

    folder.add({ clear: () => this.hooks.onClear?.() }, 'clear').name('효과 지우기(C)');
  }

  _buildCharacter() {
    const folder = this.gui.addFolder('캐릭터');
    const c = settings.character;
    const R = Editor.range;

    // The mixer's own rate, so it scales the idle and the cast clips together.
    // The same value as Global → animation speed, mirrored here where it is
    // actually reached for; `listen` keeps the two readouts honest.
    R(folder, settings.global, 'animationSpeed', 0.1, 3, 0.01, '재생 속도').listen();

    // Which clip each ability throws lives in that ability's own folder, under
    // "The cast"; these are the edges of the blend that lays it over the idle.
    const cast = folder.addFolder('시전 동작');
    R(cast, c, 'castBlendIn', 0.01, 1, 0.01, '시전 블렌드');
    R(cast, c, 'castBlendOut', 0.01, 1.5, 0.01, '대기 상태 복귀 블렌드');
    cast.add(c, 'turnToAim').name('조준 방향으로 회전');
    R(cast, c, 'turnRate', 0.000001, 0.02, 0.000001, '회전 추종');

    // The procedural accent that rides on top of the clip. Zero both leans to
    // let the animation carry the cast on its own.
    const lunge = folder.addFolder('돌진');
    R(lunge, c, 'castLean', 0, 1.2, 0.01, '돌진 기울기');
    R(lunge, c, 'castRecoil', 0, 0.8, 0.005, '돌진 반동');
    R(lunge, c, 'castSettle', 0.2, 8, 0.05, '돌진 안정');
  }

  /**
   * The target dummies and how they fall.
   *
   * Everything here is live: the ring re-populates while you watch, the fall's
   * gravity and stiffness apply to bodies already on the floor, and the blow's
   * numbers apply to the next thing that gets hit. The one exception is
   * `height`, which sizes the model when it is loaded.
   */
  _buildDummies() {
    const folder = this.gui.addFolder('허수아비 표적');
    const d = settings.dummies;
    const R = Editor.range;

    folder.add(d, 'enabled').name('사용');
    R(folder, d, 'count', 0, 16, 1, '개수');

    const ring = folder.addFolder('서 있는 위치');
    R(ring, d, 'radius', 4, 40, 0.5, '고리 반경');
    R(ring, d, 'minRadius', 1, 20, 0.5, '최근접 거리');
    R(ring, d, 'separation', 0.5, 6, 0.1, '간격, 미터');
    ring.add(d, 'watch').name('주시 방향으로 회전');
    R(ring, d, 'turnRate', 0.000001, 0.5, 0.000001, '회전 추종');

    // What a cast has to cover to knock one down, and how hard it throws it.
    const hit = folder.addFolder('타격');
    hit.add(d.hit, 'enabled').name('스킬에 처치됨');
    R(hit, d.hit, 'radius', 0.2, 6, 0.05, '선 도달거리 (m)');
    R(hit, d.hit, 'zoneScale', 0.2, 2.5, 0.05, '원거리 시전 범위');
    R(hit, d, 'bodyRadius', 0.1, 1.5, 0.02, '몸통 반경');
    R(hit, d.hit, 'impulse', 0, 30, 0.1, '충격');
    R(hit, d.hit, 'lift', 0, 16, 0.1, '상승');
    R(hit, d.hit, 'spin', -3, 4, 0.05, '회전(토크)');

    const fall = folder.addFolder('쓰러짐');
    R(fall, d.ragdoll, 'gravity', -60, -2, 0.5, '중력');
    R(fall, d.ragdoll, 'damping', 0, 0.6, 0.005, '공기 저항');
    R(fall, d.ragdoll, 'iterations', 1, 16, 1, '솔버 패스');
    R(fall, d.ragdoll, 'brace', 0, 1, 0.01, '몸통 강성');
    R(fall, d.ragdoll, 'radius', 0.01, 0.4, 0.005, '관절 반경');
    R(fall, d.ragdoll, 'friction', 0, 1, 0.01, '지면 마찰');
    R(fall, d.ragdoll, 'bounce', 0, 0.8, 0.01, '지면 반발');
    R(fall, d.ragdoll, 'sleep', 0.001, 0.5, 0.001, '슬립 임계값');

    const corpse = folder.addFolder('시체와 리스폰');
    R(corpse, d, 'corpseTime', 0, 20, 0.1, '체류, seconds');
    R(corpse, d, 'dissolveTime', 0.1, 6, 0.05, '연소 소멸, 초');
    R(corpse, d, 'respawnDelay', 0, 15, 0.1, '리스폰 지연');

    const look = folder.addFolder('외형');
    look.addColor(d.look, 'color').name('몸통');
    R(look, d.look, 'roughness', 0, 1, 0.01, '거칠기');
    R(look, d.look, 'metalness', 0, 1, 0.01, '금속성');
    look.addColor(d.look, 'rimColor').name('가장자리');
    R(look, d.look, 'rimPower', 0.5, 8, 0.05, '가장자리 조임');
    R(look, d.look, 'rimEmissive', 0, 6, 0.05, '가장자리 강도');
    look.addColor(d.look, 'edgeColor').name('탄 가장자리');
    R(look, d.look, 'edgeEmissive', 0, 20, 0.1, '연소 발광');
    R(look, d.look, 'edgeWidth', 0.01, 0.5, 0.005, '연소 너비');
    R(look, d.look, 'dissolveDetail', 1, 30, 0.5, '연소 세부');
  }

  dispose() {
    this.gui.destroy();
  }
}
