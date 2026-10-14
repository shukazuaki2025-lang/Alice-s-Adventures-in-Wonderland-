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
  private skipHoldDuration = 1000; // 1.0 second hold requirement
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

  // Inspector State
  private activeInspectItem: InventoryItem | null = null;
  private inspectRotatedFront = false;
  private inspectRotatedBack = false;
  private inspectRotationY = 0;

  constructor(parentEl?: HTMLElement) {
    this.container = parentEl || document.getElementById('ui-root') || document.body;
    this.currentLanguage = getLanguage();
    this.initDOM();
    this.bindEvents();
    this.startIdleTimer();
  }

  private initDOM(): void {
    this.container.classList.add('victorian-ui');
    this.container.innerHTML = `
      <!-- 1. Title / Start Screen (Book Cover) -->
      <div id="ui-title-screen" class="ui-title-screen">
        <div class="ui-title-book-cover parchment-card">
          <div class="ui-title-header">
            <h1>Alice's Adventures in Wonderland</h1>
            <h2>Chapter I: Down the Rabbit-Hole</h2>
          </div>
          <p class="ui-title-quote">${getUIText('title_quote')}</p>
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
          <h2 style="color: var(--wine-red); margin-bottom: 0.3rem;">Chapter I</h2>
          <h3 style="font-style: italic;">Down the Rabbit-Hole</h3>
        </div>
      </div>

      <!-- 3. Subtitle / Dialogue Box -->
      <div id="ui-subtitle-box" class="ui-subtitle-box hidden">
        <div class="parchment-card ui-subtitle-content">
          <div id="ui-speaker-avatar" class="ui-speaker-avatar">A</div>
          <div class="ui-subtitle-text-container">
            <div id="ui-speaker-name" class="ui-speaker-name">Alice</div>
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
          <div class="ui-inspect-canvas-wrapper" id="inspect-canvas-wrapper">
            <span id="inspect-item-icon" style="user-select:none;">✦</span>
          </div>
          <p class="ui-inspect-hint" data-ui="inspect_rotate_hint">${getUIText('inspect_rotate_hint')}</p>
          <div class="ui-inspect-checklist">
            <span id="inspect-check-front" class="ui-check-item">❌ Front Label</span>
            <span id="inspect-check-back" class="ui-check-item">❌ Back Label (No Poison)</span>
          </div>
          <p id="inspect-item-desc" style="font-size: 0.95rem; text-align: center;">Item description</p>
          <button id="btn-inspect-close" class="victorian-btn">Close Inspector</button>
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
          <span>✦ Height:</span>
          <strong id="ui-size-text">4 ft 0 in (1.20 m)</strong>
        </div>
      </div>

      <!-- 8. Curiosity Note Popup -->
      <div id="ui-curiosity-popup" class="ui-curiosity-modal hidden">
        <div class="ui-curiosity-content parchment-card">
          <span class="drop-cap">§</span>
          <h3 id="curiosity-title" class="ui-curiosity-title">Curiosity Note</h3>
          <p id="curiosity-body" style="line-height: 1.5; margin: 0.5rem 0;"></p>
          <div id="curiosity-fact" class="ui-curiosity-fact"></div>
          <button id="btn-curiosity-close" class="victorian-btn" style="align-self: center;">Close Note</button>
        </div>
      </div>

      <!-- 9. Stuck Hint Toast -->
      <div id="ui-stuck-toast" class="ui-stuck-toast parchment-card hidden">
        <p id="stuck-hint-text" style="font-style: italic; font-size: 1rem; color: var(--wine-red);"></p>
      </div>

      <!-- 10. Pause Menu & Settings -->
      <div id="ui-pause-menu" class="ui-pause-modal hidden">
        <div class="ui-pause-card parchment-card">
          <h2 style="color: var(--wine-red); border-bottom: 2px solid var(--gold-accent); padding-bottom: 0.4rem; width: 100%; text-align: center;">
            Settings & Options
          </h2>
          <div class="ui-slider-row">
            <span>Master Volume:</span>
            <input type="range" id="slider-vol-master" min="0" max="100" value="80">
          </div>
          <div class="ui-slider-row">
            <span>Music Volume:</span>
            <input type="range" id="slider-vol-music" min="0" max="100" value="70">
          </div>
          <div class="ui-slider-row">
            <span>SFX Volume:</span>
            <input type="range" id="slider-vol-sfx" min="0" max="100" value="85">
          </div>
          <div class="ui-slider-row">
            <span>Language:</span>
            <select id="select-language" style="padding: 0.3rem; font-family: inherit;">
              <option value="en">English (1865)</option>
              <option value="zh" selected>中文 (Victorian)</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button id="btn-pause-resume" class="victorian-btn">Resume</button>
            <button id="btn-pause-title" class="victorian-btn">Return to Title</button>
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
          <h2 style="color: var(--wine-red); font-size: 2rem;">Chapter I Complete</h2>
          <p style="font-style: italic;">"Curiouser and curiouser!"</p>
          <div style="text-align: left; background: var(--paper-dark); padding: 1rem; border-radius: 4px; width: 100%;">
            <p><strong>Thoughts Unlocked:</strong> <span id="stat-thoughts">5/5</span></p>
            <p><strong>Curiosity Notes Collected:</strong> <span id="stat-notes">5/5</span></p>
            <p><strong>Mid-air Curtsey Easter Egg:</strong> <span id="stat-curtsey">Unlocked</span></p>
          </div>
          <p style="font-size: 0.95rem; color: var(--gold-dark);">Next Chapter: The Pool of Tears</p>
          <button id="btn-complete-title" class="victorian-btn">Return to Title</button>
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

  private bindEvents(): void {
    // Start Journey button
    document.getElementById('btn-start-journey')?.addEventListener('click', () => {
      this.titleScreenEl.classList.add('hidden');
      globalEventBus.emit('startJourney');
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

    // Curiosity note close
    document.getElementById('btn-curiosity-close')?.addEventListener('click', () => {
      this.curiosityPopupEl.classList.add('hidden');
    });

    // Pause Resume & Title
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.pauseMenuEl.classList.add('hidden');
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
        } else {
          if (!this.pauseMenuEl.classList.contains('hidden')) {
            this.pauseMenuEl.classList.add('hidden');
          } else {
            this.pauseMenuEl.classList.remove('hidden');
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
      this.resetIdleTimer();
    });
    globalEventBus.on('scaleChanged', (scale) => this.updateSizeIndicator(scale));
    globalEventBus.on('inventoryUpdated', (items) => this.updateInventory(items));
    globalEventBus.on('inspectItem', (item) => this.openInspector(item));
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
        el.textContent = getUIText(key, lang);
      }
    });
  }

  public showChapterHeader(): void {
    this.chapterHeaderEl.classList.add('visible');
    setTimeout(() => {
      this.chapterHeaderEl.classList.remove('visible');
    }, 4000);
  }

  public showDialogue(data: { id: string; speaker?: string; text?: { en: string; zh: string; ja: string }; type?: 'say' | 'think' | 'narr' }): void {
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }

    const textToDisplay = data.text ? (data.text[this.currentLanguage] || data.text.en) : getDialogueText(data.id, this.currentLanguage);
    const speakerNameEl = document.getElementById('ui-speaker-name')!;
    const speakerAvatarEl = document.getElementById('ui-speaker-avatar')!;
    const subtitleTextEl = document.getElementById('ui-subtitle-text')!;

    // Set speaker avatar & name
    const speaker = data.speaker || 'alice';
    if (speaker === 'rabbit') {
      speakerNameEl.textContent = 'White Rabbit';
      speakerAvatarEl.textContent = 'R';
    } else if (speaker === 'narrator') {
      speakerNameEl.textContent = 'Narrator';
      speakerAvatarEl.textContent = '§';
    } else {
      speakerNameEl.textContent = 'Alice';
      speakerAvatarEl.textContent = 'A';
    }

    if (data.type === 'think') {
      subtitleTextEl.classList.add('think');
    } else {
      subtitleTextEl.classList.remove('think');
    }

    this.subtitleBoxEl.classList.remove('hidden');

    // Typewriter effect
    let charIndex = 0;
    subtitleTextEl.textContent = '';
    const speed = this.currentLanguage === 'en' ? 25 : 40;

    this.typewriterTimer = window.setInterval(() => {
      if (charIndex < textToDisplay.length) {
        subtitleTextEl.textContent += textToDisplay[charIndex];
        charIndex++;
      } else {
        if (this.typewriterTimer) clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
        // Auto hide after 3.5s
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
        iconSpan.textContent = item.icon || '🗝️';
        slot.setAttribute('title', item.name);
        el.onclick = () => this.openInspector(item);
      } else {
        slot.classList.add('empty');
        iconSpan.textContent = '';
        slot.removeAttribute('title');
        el.onclick = null;
      }
    });
  }

  public openInspector(item: InventoryItem): void {
    this.activeInspectItem = item;
    this.inspectRotatedFront = false;
    this.inspectRotatedBack = false;

    document.getElementById('inspect-item-title')!.textContent = item.name;
    document.getElementById('inspect-item-desc')!.textContent = item.description;
    document.getElementById('inspect-item-icon')!.textContent = item.icon || '📦';

    const checkFront = document.getElementById('inspect-check-front')!;
    const checkBack = document.getElementById('inspect-check-back')!;

    checkFront.textContent = '❌ Front Label';
    checkBack.textContent = '❌ Back Label (No Poison)';
    checkFront.className = 'ui-check-item';
    checkBack.className = 'ui-check-item';

    this.itemInspectorEl.classList.remove('hidden');

    // Simulate inspection rotation check
    const wrapper = document.getElementById('inspect-canvas-wrapper')!;
    wrapper.onmousemove = () => {
      if (!this.inspectRotatedFront) {
        this.inspectRotatedFront = true;
        checkFront.textContent = '✅ Front Label Inspected';
        checkFront.className = 'ui-check-item done';
      }
      this.inspectRotationY += 10;
      if (this.inspectRotationY > 180 && !this.inspectRotatedBack) {
        this.inspectRotatedBack = true;
        checkBack.textContent = '✅ Back Label (No Poison Verified)';
        checkBack.className = 'ui-check-item done';
        globalEventBus.emit('itemFullyInspected', item);
      }
    };
  }

  public closeInspector(): void {
    this.itemInspectorEl.classList.add('hidden');
    this.activeInspectItem = null;
  }

  public getActiveInspectItem(): InventoryItem | null {
    return this.activeInspectItem;
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
      // Small Alice: 10 inches / 0.254 m
      textEl.textContent = '10 in (0.254 m)';
    } else if (scale >= 2.0) {
      // Giant Alice: 9 ft 6 in / 2.90 m
      textEl.textContent = '9 ft 6 in (2.90 m)';
    } else {
      // Normal Alice: 4 ft 0 in / 1.20 m
      textEl.textContent = '4 ft 0 in (1.20 m)';
    }
  }

  public showCuriosityNote(note: CuriosityNote): void {
    document.getElementById('curiosity-title')!.textContent = note.title[this.currentLanguage] || note.title.en;
    document.getElementById('curiosity-body')!.textContent = note.content[this.currentLanguage] || note.content.en;
    document.getElementById('curiosity-fact')!.textContent = `Historical Note: ${note.historicalFact[this.currentLanguage] || note.historicalFact.en}`;
    this.curiosityPopupEl.classList.remove('hidden');
  }

  public showChapterComplete(stats: { thoughts: number; notes: number; curtseyUnlocked: boolean }): void {
    document.getElementById('stat-thoughts')!.textContent = `${stats.thoughts}/5`;
    document.getElementById('stat-notes')!.textContent = `${stats.notes}/5`;
    document.getElementById('stat-curtsey')!.textContent = stats.curtseyUnlocked ? 'Unlocked ✅' : 'Locked';
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
    document.getElementById('stuck-hint-text')!.textContent = `💡 Hint: ${hintText}`;
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
