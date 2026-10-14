import { CuriosityNote } from '../core/i18nSchema';
import { globalEventBus, InventoryItem, Language } from '../core/types';
import { getDialogueText, getLanguage, getStuckHint, getUIText, setLanguage } from './i18n';
import './styles/victorian.css';

export class UIManager {
  private container: HTMLElement;
  private currentLanguage: Language = 'zh';

  // State
  private typewriterTimer: number | null = null;
  private stuckHintTimer: number | null = null;
  private idleTimeSeconds = 0;
  private currentGameState = 'S0';
  private skipHoldStartTime: number | null = null;
  private skipHoldDuration = 1000;
  private isSkipping = false;

  // DOM Elements
  private titleScreenEl!: HTMLElement;
  private chapterHeaderEl!: HTMLElement;
  private subtitleBoxEl!: HTMLElement;
  private inventoryBarEl!: HTMLElement;
  private itemInspectorEl!: HTMLElement;
  private interactPromptEl!: HTMLElement;
  private sizeIndicatorEl!: HTMLElement;

  public getSizeIndicatorElement(): HTMLElement {
    return this.sizeIndicatorEl;
  }
  private curiosityPopupEl!: HTMLElement;
  private stuckHintToastEl!: HTMLElement;
  private pauseMenuEl!: HTMLElement;
  private cutsceneSkipEl!: HTMLElement;
  private chapterCompleteEl!: HTMLElement;

  private activeInspectItem: InventoryItem | null = null;

  constructor(parentEl?: HTMLElement) {
    this.container = parentEl || document.getElementById('ui-root') || document.body;
    this.currentLanguage = getLanguage();
    this.initDOM();
    this.bindEvents();
    this.startIdleTimer();
    this.checkSaveData();
  }

  private initDOM(): void {
    this.container.classList.add('victorian-ui');
    this.container.innerHTML = `
      <!-- 1. Title / Start Screen (Book Cover) -->
      <div id="ui-title-screen" class="ui-title-screen">
        <div class="ui-title-book-cover parchment-card">
          <div class="ui-title-header">
            <h1 data-ui="title_h1">${getUIText('title_h1')}</h1>
            <h2 data-ui="title_h2">${getUIText('title_h2')}</h2>
          </div>
          <p class="ui-title-quote" data-ui="title_quote">${getUIText('title_quote')}</p>
          <div class="ui-title-actions">
            <button id="btn-start-journey" class="victorian-btn">
              <span>✦</span> <span data-ui="title_start">${getUIText('title_start')}</span>
            </button>
            <button id="btn-continue-journey" class="victorian-btn hidden">
              <span>§</span> <span data-ui="title_continue">${getUIText('title_continue')}</span>
            </button>
          </div>
          <div class="ui-lang-selector">
            <button class="ui-lang-btn ${this.currentLanguage === 'en' ? 'active' : ''}" data-lang="en">English</button>
            <button class="ui-lang-btn ${this.currentLanguage === 'zh' ? 'active' : ''}" data-lang="zh">中文</button>
            <button class="ui-lang-btn ${this.currentLanguage === 'ja' ? 'active' : ''}" data-lang="ja">日本語</button>
          </div>
        </div>
      </div>

      <!-- 2. Chapter Header Card -->
      <div id="ui-chapter-header" class="ui-chapter-header">
        <div class="parchment-card">
          <span class="drop-cap">A</span>
          <h2 style="color: var(--wine-red); margin-bottom: 0.3rem;" data-ui="ui_chapter_badge">${getUIText('ui_chapter_badge')}</h2>
          <h3 style="font-style: italic;" data-ui="title_h2">${getUIText('title_h2')}</h3>
        </div>
      </div>

      <!-- 3. Subtitle / Dialogue Box -->
      <div id="ui-subtitle-box" class="ui-subtitle-box hidden">
        <div class="parchment-card ui-subtitle-content">
          <div id="ui-speaker-avatar" class="ui-speaker-avatar">A</div>
          <div class="ui-subtitle-text-container">
            <div id="ui-speaker-name" class="ui-speaker-name" data-ui="speaker_alice">${getUIText('speaker_alice')}</div>
            <div id="ui-subtitle-text" class="ui-subtitle-text"></div>
          </div>
        </div>
      </div>

      <!-- 4. 6-slot Inventory Bar -->
      <div id="ui-inventory-bar" class="ui-inventory-bar">
        ${Array.from({ length: 6 }).map((_, i) => `
          <div class="ui-inventory-slot empty" data-slot="${i}">
            <span class="ui-inventory-slot-icon"></span>
          </div>
        `).join('')}
      </div>

      <!-- 5. 3D Item Inspector Modal Overlay -->
      <div id="ui-inspect-modal" class="ui-inspect-modal hidden">
        <div class="ui-inspect-container parchment-card">
          <h3 id="inspect-item-title" style="color: var(--wine-red); font-size: 1.4rem;">Item Name</h3>
          <div class="ui-inspect-canvas-wrapper" id="ui-inspector">
            <span id="inspect-item-icon" style="user-select:none;" class="hidden">✦</span>
          </div>
          <p class="ui-inspect-hint" data-ui="inspect_rotate_hint">${getUIText('inspect_rotate_hint')}</p>
          <div class="ui-inspect-checklist">
            <span id="inspect-check-front" class="ui-check-item">[ ] <span data-ui="inspect_front_label">${getUIText('inspect_front_label')}</span></span>
            <span id="inspect-check-back" class="ui-check-item">[ ] <span data-ui="inspect_back_label">${getUIText('inspect_back_label')}</span></span>
          </div>
          <p id="inspect-item-desc" style="font-size: 0.95rem; text-align: center;">Item description</p>
          <button id="btn-inspect-drink" class="victorian-btn hidden" disabled><span data-ui="inspect_btn_drink">${getUIText('inspect_btn_drink')}</span></button>
          <button id="btn-inspect-close" class="victorian-btn"><span data-ui="inspect_btn_close">${getUIText('inspect_btn_close')}</span></button>
        </div>
      </div>

      <!-- 6. Interaction Prompt HUD -->
      <div id="ui-interact-prompt" class="ui-interact-prompt hidden">
        <div class="ui-prompt-badge">
          <span id="ui-prompt-text">[E] Examine</span>
        </div>
      </div>

      <!-- 7. Size Indicator -->
      <div id="ui-size-indicator" class="ui-size-indicator">
        <div class="ui-size-ribbon">
          <span>✦ <span data-ui="hud_height">${getUIText('hud_height')}</span></span>
          <strong id="ui-size-text">1.20 m</strong>
        </div>
      </div>

      <!-- 8. Curiosity Note Popup -->
      <div id="ui-curiosity-popup" class="ui-curiosity-modal hidden">
        <div class="ui-curiosity-content parchment-card">
          <span class="drop-cap">§</span>
          <h3 id="curiosity-title" class="ui-curiosity-title">Curiosity Note</h3>
          <p id="curiosity-body" style="line-height: 1.5; margin: 0.5rem 0;"></p>
          <div id="curiosity-fact" class="ui-curiosity-fact"></div>
          <button id="btn-curiosity-close" class="victorian-btn" style="align-self: center;"><span data-ui="inspect_btn_close">${getUIText('inspect_btn_close')}</span></button>
        </div>
      </div>

      <!-- 9. Stuck Hint Toast -->
      <div id="ui-stuck-toast" class="ui-stuck-toast parchment-card hidden">
        <p id="stuck-hint-text" style="font-style: italic; font-size: 1rem; color: var(--wine-red);"></p>
      </div>

      <!-- 10. Pause Menu & Settings -->
      <div id="ui-pause-menu" class="ui-pause-modal hidden">
        <div class="ui-pause-card parchment-card">
          <h2 style="color: var(--wine-red); border-bottom: 2px solid var(--gold-accent); padding-bottom: 0.4rem; width: 100%; text-align: center;" data-ui="settings_title">
            ${getUIText('settings_title')}
          </h2>
          <div class="ui-slider-row">
            <span data-ui="settings_volume_master">${getUIText('settings_volume_master')}</span>
            <input type="range" id="slider-vol-master" min="0" max="100" value="80">
          </div>
          <div class="ui-slider-row">
            <span data-ui="settings_volume_music">${getUIText('settings_volume_music')}</span>
            <input type="range" id="slider-vol-music" min="0" max="100" value="70">
          </div>
          <div class="ui-slider-row">
            <span data-ui="settings_volume_sfx">${getUIText('settings_volume_sfx')}</span>
            <input type="range" id="slider-vol-sfx" min="0" max="100" value="85">
          </div>
          <div class="ui-slider-row">
            <span data-ui="settings_language">${getUIText('settings_language')}</span>
            <select id="select-language" style="padding: 0.3rem; font-family: inherit;">
              <option value="en">English (1865)</option>
              <option value="zh" selected>中文 (Victorian)</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button id="btn-pause-resume" class="victorian-btn"><span data-ui="btn_pause_resume">${getUIText('btn_pause_resume')}</span></button>
            <button id="btn-pause-title" class="victorian-btn"><span data-ui="btn_pause_title">${getUIText('btn_pause_title')}</span></button>
          </div>
        </div>
      </div>

      <!-- 11. Cutscene Skip Indicator -->
      <div id="ui-cutscene-skip" class="ui-cutscene-skip hidden">
        <span data-ui="skip_cutscene">${getUIText('skip_cutscene')}</span>
        <div class="ui-skip-progress-bar">
          <div id="ui-skip-fill" class="ui-skip-progress-fill"></div>
        </div>
      </div>

      <!-- 12. Chapter Complete / Transition Card -->
      <div id="ui-chapter-complete" class="ui-chapter-complete-modal hidden">
        <div class="ui-complete-card parchment-card">
          <span class="drop-cap">✦</span>
          <h2 style="color: var(--wine-red); font-size: 2rem;" data-ui="chapter_complete">${getUIText('chapter_complete')}</h2>
          <p style="font-style: italic;" data-ui="title_quote">${getUIText('title_quote')}</p>
          <div style="text-align: left; background: var(--paper-dark); padding: 1rem; border-radius: 4px; width: 100%;">
            <p><strong data-ui="curiosity_notes_modal">${getUIText('curiosity_notes_modal')}</strong>: <span id="stat-thoughts">5/5</span></p>
            <p><strong data-ui="stat_notes_collected">${getUIText('stat_notes_collected')}</strong>: <span id="stat-notes">5/5</span></p>
            <p><strong data-ui="stat_curtsey_egg">${getUIText('stat_curtsey_egg')}</strong>: <span id="stat-curtsey" data-ui="stat_unlocked">${getUIText('stat_unlocked')}</span></p>
          </div>
          <button id="btn-complete-title" class="victorian-btn"><span data-ui="btn_pause_title">${getUIText('btn_pause_title')}</span></button>
        </div>
      </div>
    `;

    // Cache elements
    this.titleScreenEl = document.getElementById('ui-title-screen')!;
    this.chapterHeaderEl = document.getElementById('ui-chapter-header')!;
    this.subtitleBoxEl = document.getElementById('ui-subtitle-box')!;
    this.inventoryBarEl = document.getElementById('ui-inventory-bar')!;
    this.itemInspectorEl = document.getElementById('ui-inspect-modal')!;
    this.interactPromptEl = document.getElementById('ui-interact-prompt')!;
    this.sizeIndicatorEl = document.getElementById('ui-size-indicator')!;
    this.curiosityPopupEl = document.getElementById('ui-curiosity-popup')!;
    this.stuckHintToastEl = document.getElementById('ui-stuck-toast')!;
    this.pauseMenuEl = document.getElementById('ui-pause-menu')!;
    this.cutsceneSkipEl = document.getElementById('ui-cutscene-skip')!;
    this.chapterCompleteEl = document.getElementById('ui-chapter-complete')!;
  }

  private checkSaveData(): void {
    if (localStorage.getItem('alice.save.v1')) {
      document.getElementById('btn-continue-journey')?.classList.remove('hidden');
    }
  }

  private getIconForItem(item: InventoryItem | { id: string; icon?: string }): string {
    switch (item.id) {
      case 'daisy':
      case 'daisy_1':
      case 'daisy_2':
      case 'daisy_3':
        return '<svg class="item-svg-icon icon-daisy" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><circle cx="12" cy="12" r="3" fill="#e8b838"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>';
      case 'gold_key':
      case 'prop_key_gold':
        return '<svg class="item-svg-icon icon-key" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><circle cx="17" cy="7" r="3"/><path d="M14.5 9.5L2 22v-4h3v-3h4l2.5-2.5"/></svg>';
      case 'drink_me_bottle':
      case 'prop_bottle_drinkme':
        return '<svg class="item-svg-icon icon-bottle" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M10 2h4v4l3 5v11H7v-11l3-5z"/></svg>';
      case 'marmalade_jar':
      case 'prop_jar_marmalade':
        return '<svg class="item-svg-icon icon-jar" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><rect x="4" y="8" width="16" height="14" rx="2"/><path d="M7 8V4h10v4"/></svg>';
      case 'eat_me_cake':
      case 'prop_cake_eatme':
        return '<svg class="item-svg-icon icon-cake" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><path d="M4 12c0-4 4-6 8-6s8 2 8 6v8H4z"/></svg>';
      case 'pocket_watch':
      case 'prop_watch':
        return '<svg class="item-svg-icon icon-watch" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none"><circle cx="12" cy="12" r="7"/><path d="M12 2v2M12 5v2"/></svg>';
      default:
        return item.icon || '📦';
    }
  }

  private bindEvents(): void {
    // Start Journey button
    document.getElementById('btn-start-journey')?.addEventListener('click', () => {
      this.titleScreenEl.classList.add('hidden');
      globalEventBus.emit('startJourney');
      this.showChapterHeader();
    });

    document.getElementById('btn-continue-journey')?.addEventListener('click', () => {
      this.titleScreenEl.classList.add('hidden');
      globalEventBus.emit('continueJourney');
      this.showChapterHeader();
    });

    // Clickable Interaction Prompt Badge (same as pressing E)
    this.interactPromptEl?.addEventListener('click', () => {
      globalEventBus.emit('interactionTriggered', 'E');
    });

    // Language selector buttons
    document.querySelectorAll('.ui-lang-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const lang = (e.currentTarget as HTMLElement).getAttribute('data-lang') as Language;
        if (lang) {
          this.changeLanguage(lang);
        }
      });
    });

    // Inspector close button
    document.getElementById('btn-inspect-close')?.addEventListener('click', () => {
      this.closeInspector();
    });

    // Inspector drink button
    document.getElementById('btn-inspect-drink')?.addEventListener('click', () => {
      globalEventBus.emit('drinkBottle');
      globalEventBus.emit('interactionTriggered', 'F');
      this.closeInspector();
    });

    // Curiosity note close
    document.getElementById('btn-curiosity-close')?.addEventListener('click', () => {
      this.curiosityPopupEl.classList.add('hidden');
    });

    // Pause Resume & Title
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.pauseMenuEl.classList.add('hidden');
      globalEventBus.emit('resumeGame');
    });
    document.getElementById('btn-pause-title')?.addEventListener('click', () => {
      this.pauseMenuEl.classList.add('hidden');
      this.titleScreenEl.classList.remove('hidden');
    });

    // Language Select in Pause menu
    const langSelect = document.getElementById('select-language') as HTMLSelectElement;
    langSelect?.addEventListener('change', (e) => {
      this.changeLanguage((e.target as HTMLSelectElement).value as Language);
    });

    // Volume Sliders
    const volMaster = document.getElementById('slider-vol-master') as HTMLInputElement;
    const volMusic = document.getElementById('slider-vol-music') as HTMLInputElement;
    const volSfx = document.getElementById('slider-vol-sfx') as HTMLInputElement;

    volMaster?.addEventListener('input', (e) => {
      globalEventBus.emit('setMasterVolume', parseFloat((e.target as HTMLInputElement).value) / 100);
    });
    volMusic?.addEventListener('input', (e) => {
      globalEventBus.emit('setMusicVolume', parseFloat((e.target as HTMLInputElement).value) / 100);
    });
    volSfx?.addEventListener('input', (e) => {
      globalEventBus.emit('setSfxVolume', parseFloat((e.target as HTMLInputElement).value) / 100);
    });

    // Complete Title Button
    document.getElementById('btn-complete-title')?.addEventListener('click', () => {
      this.chapterCompleteEl.classList.add('hidden');
      this.titleScreenEl.classList.remove('hidden');
    });

    // Keydown listeners for ESC hold (Cutscene Skip) & ESC press (Pause)
    window.addEventListener('keydown', (e) => {
      this.resetIdleTimer();
      if (e.key === 'Escape') {
        if (!this.cutsceneSkipEl.classList.contains('hidden')) {
          this.handleSkipHoldStart();
        } else if (this.titleScreenEl.classList.contains('hidden')) {
          if (!this.pauseMenuEl.classList.contains('hidden')) {
            this.pauseMenuEl.classList.add('hidden');
            globalEventBus.emit('resumeGame');
          } else {
            this.pauseMenuEl.classList.remove('hidden');
            globalEventBus.emit('pauseGame');
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        this.handleSkipHoldEnd();
      }
    });

    window.addEventListener('mousemove', () => this.resetIdleTimer());
    window.addEventListener('click', () => this.resetIdleTimer());

    // Event Bus subscriptions
    globalEventBus.on('dialogueTrigger', (data) => this.showDialogue(data));
    globalEventBus.on('showPrompt', (text) => this.showInteractPrompt(text));
    globalEventBus.on('hidePrompt', () => this.hideInteractPrompt());
    globalEventBus.on('stateChanged', ({ to }) => {
      this.currentGameState = to;
      if (to !== 'S1_BANK' && to !== 'S0_TITLE') {
        this.chapterHeaderEl.classList.remove('visible');
      }
      this.resetIdleTimer();
      this.checkSaveData();
    });
    globalEventBus.on('scaleChanged', (scale) => this.updateSizeIndicator(scale));
    globalEventBus.on('inventoryUpdated', (items) => this.updateInventory(items));
    
    globalEventBus.on('inspectItem', (payload: any) => {
      const item: InventoryItem = payload?.item || payload;
      if (!item || !item.id) return;
      this.activeInspectItem = item;
      document.getElementById('inspect-item-title')!.textContent = getUIText(item.name, this.currentLanguage);
      document.getElementById('inspect-item-desc')!.textContent = getUIText(item.description, this.currentLanguage);
      const checkFront = document.getElementById('inspect-check-front')!;
      const checkBack = document.getElementById('inspect-check-back')!;
      checkFront.className = item.inspectedFront ? 'ui-check-item done' : 'ui-check-item';
      checkBack.className = item.inspectedBack ? 'ui-check-item done' : 'ui-check-item';
      checkFront.innerHTML = `${item.inspectedFront ? '[✦]' : '[ ]'} <span data-ui="inspect_front_label">${getUIText('inspect_front_label')}</span>`;
      checkBack.innerHTML = `${item.inspectedBack ? '[✦]' : '[ ]'} <span data-ui="inspect_back_label">${getUIText('inspect_back_label')}</span>`;

      const drinkBtn = document.getElementById('btn-inspect-drink') as HTMLButtonElement;
      if (item.id === 'prop_bottle_drinkme' || item.id === 'drink_me_bottle') {
        drinkBtn.classList.remove('hidden');
        drinkBtn.disabled = !(item.inspectedFront && item.inspectedBack);
      } else {
        drinkBtn.classList.add('hidden');
      }
      
      this.itemInspectorEl.classList.remove('hidden');
    });

    globalEventBus.on('bottleSideInspected', (side: 'front' | 'back') => {
      if (this.activeInspectItem) {
        if (side === 'front') this.activeInspectItem.inspectedFront = true;
        if (side === 'back') this.activeInspectItem.inspectedBack = true;
      }
      if (side === 'front') {
        const checkFront = document.getElementById('inspect-check-front');
        if (checkFront) {
          checkFront.className = 'ui-check-item done';
          checkFront.innerHTML = `[✦] <span data-ui="inspect_front_label">${getUIText('inspect_front_label')}</span>`;
        }
      } else if (side === 'back') {
        const checkBack = document.getElementById('inspect-check-back');
        if (checkBack) {
          checkBack.className = 'ui-check-item done';
          checkBack.innerHTML = `[✦] <span data-ui="inspect_back_label">${getUIText('inspect_back_label')}</span>`;
        }
      }
    });

    globalEventBus.on('itemFullyInspected', (item: InventoryItem) => {
      const drinkBtn = document.getElementById('btn-inspect-drink') as HTMLButtonElement;
      if (!item || item.id === 'prop_bottle_drinkme' || item.id === 'drink_me_bottle') {
        drinkBtn.disabled = false;
      }
    });

    globalEventBus.on('showCuriosityNote', (note) => this.showCuriosityNote(note));
    globalEventBus.on('chapterComplete', (stats) => this.showChapterComplete(stats));
    globalEventBus.on('cutsceneStart', () => this.cutsceneSkipEl.classList.remove('hidden'));
    globalEventBus.on('cutsceneEnd', () => {
      this.cutsceneSkipEl.classList.add('hidden');
      this.handleSkipHoldEnd();
    });
  }

  private handleSkipHoldStart(): void {
    if (this.isSkipping) return;
    this.skipHoldStartTime = Date.now();
    const fillEl = document.getElementById('ui-skip-fill');
    if (fillEl) fillEl.style.width = '100%';

    setTimeout(() => {
      if (this.skipHoldStartTime && Date.now() - this.skipHoldStartTime >= this.skipHoldDuration) {
        this.isSkipping = true;
        globalEventBus.emit('skipCutscene');
      }
    }, this.skipHoldDuration);
  }

  private handleSkipHoldEnd(): void {
    this.skipHoldStartTime = null;
    this.isSkipping = false;
    const fillEl = document.getElementById('ui-skip-fill');
    if (fillEl) fillEl.style.width = '0%';
  }

  public changeLanguage(lang: Language): void {
    this.currentLanguage = lang;
    setLanguage(lang);

    // Update lang button active styles
    document.querySelectorAll('.ui-lang-btn').forEach((btn) => {
      if (btn.getAttribute('data-lang') === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update static UI elements
    document.querySelectorAll('[data-ui]').forEach((el) => {
      const key = el.getAttribute('data-ui');
      if (key) {
        el.innerHTML = getUIText(key, lang);
      }
    });
  }

  public showChapterHeader(): void {
    this.chapterHeaderEl.classList.add('visible');
    setTimeout(() => {
      this.chapterHeaderEl.classList.remove('visible');
    }, 3200);
  }

  public showDialogue(data: { id?: string; lineId?: string; speaker?: string; text?: { en: string; zh: string; ja: string }; type?: 'say' | 'think' | 'narr' }): void {
    const resolvedId = data?.id || data?.lineId;
    if (!resolvedId && !data?.text) return;

    const textToDisplay = data.text ? (data.text[this.currentLanguage] || data.text.en) : getDialogueText(resolvedId!, this.currentLanguage);
    if (!textToDisplay || textToDisplay === 'undefined') return;

    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }

    const speakerNameEl = document.getElementById('ui-speaker-name')!;
    const speakerAvatarEl = document.getElementById('ui-speaker-avatar')!;
    const subtitleTextEl = document.getElementById('ui-subtitle-text')!;

    const speaker = data.speaker || 'alice';
    if (speaker === 'rabbit' || speaker === 'chr_rabbit') {
      speakerNameEl.textContent = getUIText('speaker_rabbit', this.currentLanguage);
      speakerAvatarEl.textContent = 'R';
    } else if (speaker === 'narrator') {
      speakerNameEl.textContent = getUIText('speaker_narrator', this.currentLanguage);
      speakerAvatarEl.textContent = '§';
    } else {
      speakerNameEl.textContent = getUIText('speaker_alice', this.currentLanguage);
      speakerAvatarEl.textContent = 'A';
    }

    if (data.type === 'think') {
      subtitleTextEl.classList.add('think');
    } else {
      subtitleTextEl.classList.remove('think');
    }

    this.subtitleBoxEl.classList.remove('hidden');

    let charIndex = 0;
    subtitleTextEl.textContent = '';
    const speed = this.currentLanguage === 'en' ? 18 : 28;

    this.typewriterTimer = window.setInterval(() => {
      if (charIndex < textToDisplay.length) {
        subtitleTextEl.textContent += textToDisplay[charIndex];
        charIndex++;
      } else {
        if (this.typewriterTimer) clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
        setTimeout(() => {
          this.subtitleBoxEl.classList.add('hidden');
        }, 3500);
      }
    }, speed);
  }

  public updateInventory(items: InventoryItem[]): void {
    const slots = this.inventoryBarEl.querySelectorAll('.ui-inventory-slot');
    slots.forEach((slot, idx) => {
      const el = slot as HTMLElement;
      const item = items[idx];
      const iconSpan = slot.querySelector('.ui-inventory-slot-icon')!;
      if (item) {
        slot.classList.remove('empty');
        iconSpan.innerHTML = this.getIconForItem(item);
        slot.setAttribute('title', getUIText(item.name, this.currentLanguage));
        el.onclick = () => {
          // Tell GameManager to trigger item inspection
          globalEventBus.emit('inspectItem', { item });
        };
      } else {
        slot.classList.add('empty');
        iconSpan.innerHTML = '';
        slot.removeAttribute('title');
        el.onclick = null;
      }
    });
  }

  public closeInspector(): void {
    this.itemInspectorEl.classList.add('hidden');
    this.activeInspectItem = null;
    globalEventBus.emit('closeInspector');
  }

  public showInteractPrompt(text: string): void {
    document.getElementById('ui-prompt-text')!.textContent = text;
    this.interactPromptEl.classList.remove('hidden');
  }

  public hideInteractPrompt(): void {
    this.interactPromptEl.classList.add('hidden');
  }

  public updateSizeIndicator(scale: number): void {
    const textEl = document.getElementById('ui-size-text')!;
    if (scale <= 0.3) {
      textEl.textContent = '0.254 m (10 in)';
    } else if (scale >= 2.0) {
      textEl.textContent = '2.90 m (9 ft 6 in)';
    } else {
      textEl.textContent = '1.20 m (4 ft)';
    }
  }

  public showCuriosityNote(note: CuriosityNote | string): void {
    if (typeof note === 'string') {
      document.getElementById('curiosity-title')!.textContent = note;
      document.getElementById('curiosity-body')!.textContent = getDialogueText(note, this.currentLanguage);
      document.getElementById('curiosity-fact')!.textContent = '';
      return;
    }
    if (!note || !note.title) return;
    document.getElementById('curiosity-title')!.textContent = note.title[this.currentLanguage] || note.title.en;
    document.getElementById('curiosity-body')!.textContent = note.content[this.currentLanguage] || note.content.en;
    document.getElementById('curiosity-fact')!.textContent = `${note.historicalFact[this.currentLanguage] || note.historicalFact.en}`;
    this.curiosityPopupEl.classList.remove('hidden');
  }

  public showChapterComplete(stats: { thoughts: number; notes: number; curtseyUnlocked: boolean }): void {
    document.getElementById('stat-thoughts')!.textContent = `${stats.thoughts}/5`;
    document.getElementById('stat-notes')!.textContent = `${stats.notes}/5`;
    const curtseyEl = document.getElementById('stat-curtsey')!;
    curtseyEl.setAttribute('data-ui', stats.curtseyUnlocked ? 'stat_unlocked' : 'stat_locked');
    curtseyEl.textContent = getUIText(stats.curtseyUnlocked ? 'stat_unlocked' : 'stat_locked', this.currentLanguage);
    this.chapterCompleteEl.classList.remove('hidden');
  }

  private startIdleTimer(): void {
    this.stuckHintTimer = window.setInterval(() => {
      this.idleTimeSeconds++;
      if (this.idleTimeSeconds === 60) {
        const hint = getStuckHint(this.currentGameState, 1, this.currentLanguage);
        if (hint) this.showStuckToast(hint);
      } else if (this.idleTimeSeconds === 120) {
        const hint = getStuckHint(this.currentGameState, 2, this.currentLanguage);
        if (hint) this.showStuckToast(hint);
      }
    }, 1000);
  }

  private resetIdleTimer(): void {
    this.idleTimeSeconds = 0;
    if (!this.stuckHintToastEl.classList.contains('hidden')) {
      this.stuckHintToastEl.classList.add('hidden');
    }
  }

  private showStuckToast(hintText: string): void {
    document.getElementById('stuck-hint-text')!.innerHTML = `<span data-ui="hud_hint">${getUIText('hud_hint')}</span> ${hintText}`;
    this.stuckHintToastEl.classList.remove('hidden');
    setTimeout(() => {
      this.stuckHintToastEl.classList.add('hidden');
    }, 6000);
  }

  public destroy(): void {
    if (this.typewriterTimer) clearInterval(this.typewriterTimer);
    if (this.stuckHintTimer) clearInterval(this.stuckHintTimer);
  }
}
