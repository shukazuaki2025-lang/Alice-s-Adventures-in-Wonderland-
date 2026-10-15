import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CuriosityNote } from './core/i18nSchema';
import { globalEventBus, InventoryItem, Language, GameStateSnapshot } from './core/types';
import { getDialogueText, getLanguage, getStuckHint, getUIText, loadI18nData, setLanguage } from './ui/i18n';
import { GameManager } from './game/GameManager';
import { AudioManager } from './audio/AudioManager';
import { registerTestHarness } from './testing/testHarness';
import './ui/styles/victorian.css';

declare global {
  interface Window {
    __game?: {
      getState: () => GameStateSnapshot;
      getFlags: () => Record<string, unknown>;
      getFlag: (k: string) => unknown;
      getInventory: () => unknown[];
      getPlayerTransform: () => {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: number;
      };
      getInteractables: () => unknown[];
      getCameraState: () => {
        yaw: number;
        pitch: number;
        yawGoal: number;
        pitchGoal: number;
        zoom: number;
        distance: number;
        fov: number;
        cinematic: boolean;
        position: { x: number; y: number; z: number };
        forward: { x: number; y: number; z: number };
      };
      getPlayerMotion: () => {
        velocity: { x: number; y: number; z: number };
        speed: number;
        running: boolean;
        facing: number;
      };
      getRenderStats: () => { calls: number; triangles: number };
      getRenderBreakdown: () => Record<string, { meshes: number; hulls: number; shadowCasters: number; drawn: number }>;
      getNearbyInteractable: () => string | null;
      getAliceAnimation: () => unknown;
      getAliceBoneWorld: (name: string) => { x: number; y: number; z: number } | null;
      getSceneMetrics: () => unknown;
      setTimeScale: (n: number) => void;
      fastForward: (seconds: number) => void;
      movePlayerTo: (x: number, z: number) => void;
      lookAtBottleSide: (side: 'front' | 'back') => void;
    };
  }
}

interface DialogueState {
  visible: boolean;
  speakerKey: string;
  speakerAvatar: string;
  text: string;
  isThink: boolean;
}

interface CuriosityModalState {
  visible: boolean;
  title: string;
  body: string;
  fact: string;
}

interface ChapterCompleteStats {
  visible: boolean;
  thoughts: number;
  notes: number;
  curtseyUnlocked: boolean;
}

function renderItemSvgIcon(item: InventoryItem | { id: string; icon?: string }): React.ReactNode {
  switch (item.id) {
    case 'daisy':
    case 'daisy_1':
    case 'daisy_2':
    case 'daisy_3':
      return (
        <svg className="item-svg-icon icon-daisy" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none">
          <circle cx="12" cy="12" r="3" fill="#e8b838" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
        </svg>
      );
    case 'gold_key':
    case 'prop_key_gold':
      return (
        <svg className="item-svg-icon icon-key" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none">
          <circle cx="17" cy="7" r="3" />
          <path d="M14.5 9.5L2 22v-4h3v-3h4l2.5-2.5" />
        </svg>
      );
    case 'drink_me_bottle':
    case 'prop_bottle_drinkme':
      return (
        <svg className="item-svg-icon icon-bottle" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none">
          <path d="M10 2h4v4l3 5v11H7v-11l3-5z" />
        </svg>
      );
    case 'marmalade_jar':
    case 'prop_jar_marmalade':
      return (
        <svg className="item-svg-icon icon-jar" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none">
          <rect x="4" y="8" width="16" height="14" rx="2" />
          <path d="M7 8V4h10v4" />
        </svg>
      );
    case 'eat_me_cake':
    case 'prop_cake_eatme':
      return (
        <svg className="item-svg-icon icon-cake" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none">
          <path d="M4 12c0-4 4-6 8-6s8 2 8 6v8H4z" />
        </svg>
      );
    case 'pocket_watch':
    case 'prop_watch':
      return (
        <svg className="item-svg-icon icon-watch" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 2v2M12 5v2" />
        </svg>
      );
    default:
      return <span>{item.icon || '📦'}</span>;
  }
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);

  const [lang, setLangState] = useState<Language>(() => getLanguage());
  const [loadingFading, setLoadingFading] = useState(false);
  const [loadingRemoved, setLoadingRemoved] = useState(false);

  const [titleVisible, setTitleVisible] = useState(true);
  const [hasSaveData, setHasSaveData] = useState(() => Boolean(localStorage.getItem('alice.save.v1')));
  const [chapterHeaderVisible, setChapterHeaderVisible] = useState(false);

  const [dialogue, setDialogue] = useState<DialogueState>({
    visible: false,
    speakerKey: 'speaker_alice',
    speakerAvatar: 'A',
    text: '',
    isThink: false,
  });

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inspectItem, setInspectItem] = useState<InventoryItem | null>(null);
  const [inspectedFront, setInspectedFront] = useState(false);
  const [inspectedBack, setInspectedBack] = useState(false);
  const [drinkUnlocked, setDrinkUnlocked] = useState(false);

  const [interactPrompt, setInteractPrompt] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: '[E] Examine',
  });

  const [sizeText, setSizeText] = useState('1.20 m');

  const [curiosityModal, setCuriosityModal] = useState<CuriosityModalState>({
    visible: false,
    title: 'Curiosity Note',
    body: '',
    fact: '',
  });

  const [stuckHint, setStuckHint] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: '',
  });

  const [pauseMenuVisible, setPauseMenuVisible] = useState(false);
  const [volMaster, setVolMaster] = useState(80);
  const [volMusic, setVolMusic] = useState(70);
  const [volSfx, setVolSfx] = useState(85);

  const [cutscenePlaying, setCutscenePlaying] = useState(false);
  const [skipFillWidth, setSkipFillWidth] = useState('0%');

  const [chapterComplete, setChapterComplete] = useState<ChapterCompleteStats>({
    visible: false,
    thoughts: 5,
    notes: 5,
    curtseyUnlocked: true,
  });

  // Mutable refs for timers and event callbacks
  const langRef = useRef<Language>(lang);
  langRef.current = lang;

  const currentGameStateRef = useRef<string>('S0');
  const idleTimeSecondsRef = useRef<number>(0);
  const typewriterTimerRef = useRef<number | null>(null);
  const skipHoldStartTimeRef = useRef<number | null>(null);
  const isSkippingRef = useRef<boolean>(false);
  const cutscenePlayingRef = useRef<boolean>(false);
  cutscenePlayingRef.current = cutscenePlaying;
  const titleVisibleRef = useRef<boolean>(true);
  titleVisibleRef.current = titleVisible;
  const pauseMenuVisibleRef = useRef<boolean>(false);
  pauseMenuVisibleRef.current = pauseMenuVisible;

  const resetIdleTimer = useCallback(() => {
    idleTimeSecondsRef.current = 0;
    setStuckHint((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const changeLanguage = useCallback((newLang: Language) => {
    setLanguage(newLang);
    setLangState(newLang);
  }, []);

  const showChapterHeader = useCallback(() => {
    setChapterHeaderVisible(true);
    window.setTimeout(() => {
      setChapterHeaderVisible(false);
    }, 3200);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectItem(null);
    globalEventBus.emit('closeInspector');
  }, []);

  const handleDrinkBottleClick = useCallback(() => {
    globalEventBus.emit('drinkBottle');
    globalEventBus.emit('interactionTriggered', 'F');
    handleCloseInspector();
  }, [handleCloseInspector]);

  const handleStartJourney = useCallback(() => {
    setTitleVisible(false);
    globalEventBus.emit('startJourney');
    showChapterHeader();
  }, [showChapterHeader]);

  const handleContinueJourney = useCallback(() => {
    setTitleVisible(false);
    globalEventBus.emit('continueJourney');
    showChapterHeader();
  }, [showChapterHeader]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await loadI18nData('/assets/i18n/ch1.json');
      } catch (e) {
        console.warn('[Bootstrap] Using embedded i18n data due to fetch error:', e);
      }
      if (!mounted) return;
      // Trigger re-render once i18n JSON finishes loading
      setLangState(getLanguage());

      const audioMgr = new AudioManager();
      audioManagerRef.current = audioMgr;

      if (canvasRef.current) {
        const gameMgr = new GameManager(canvasRef.current);
        gameManagerRef.current = gameMgr;
        await gameMgr.init();
        if (!mounted) return;
        registerTestHarness(gameMgr);
        audioMgr.playMusic('M1');

        window.setTimeout(() => {
          if (!mounted) return;
          setLoadingFading(true);
          window.setTimeout(() => {
            if (!mounted) return;
            setLoadingRemoved(true);
          }, 800);
        }, 500);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
      }
    };
  }, []);

  // Event Bus & Global Input Subscriptions
  useEffect(() => {
    const onDialogueTrigger = (data: {
      id?: string;
      lineId?: string;
      speaker?: string;
      text?: { en: string; zh: string; ja: string };
      type?: 'say' | 'think' | 'narr';
    }) => {
      const resolvedId = data?.id || data?.lineId;
      if (!resolvedId && !data?.text) return;

      const currentLang = langRef.current;
      const textToDisplay = data.text
        ? data.text[currentLang] || data.text.en
        : getDialogueText(resolvedId!, currentLang);
      if (!textToDisplay || textToDisplay === 'undefined') return;

      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }

      const speaker = data.speaker || 'alice';
      let speakerKey = 'speaker_alice';
      let speakerAvatar = 'A';
      if (speaker === 'rabbit' || speaker === 'chr_rabbit') {
        speakerKey = 'speaker_rabbit';
        speakerAvatar = 'R';
      } else if (speaker === 'narrator') {
        speakerKey = 'speaker_narrator';
        speakerAvatar = '§';
      }

      setDialogue({
        visible: true,
        speakerKey,
        speakerAvatar,
        text: '',
        isThink: data.type === 'think',
      });

      let charIndex = 0;
      const speed = currentLang === 'en' ? 18 : 28;

      typewriterTimerRef.current = window.setInterval(() => {
        if (charIndex < textToDisplay.length) {
          const nextChar = textToDisplay[charIndex];
          charIndex++;
          setDialogue((prev) => ({
            ...prev,
            text: prev.text + nextChar,
          }));
        } else {
          if (typewriterTimerRef.current) {
            clearInterval(typewriterTimerRef.current);
            typewriterTimerRef.current = null;
          }
          window.setTimeout(() => {
            setDialogue((prev) => ({ ...prev, visible: false }));
          }, 3500);
        }
      }, speed);
    };

    const onShowPrompt = (text: string) => {
      setInteractPrompt({ visible: true, text });
    };

    const onHidePrompt = () => {
      setInteractPrompt((prev) => ({ ...prev, visible: false }));
    };

    const onStateChanged = ({ to }: { from: string; to: string }) => {
      currentGameStateRef.current = to;
      if (to !== 'S1_BANK' && to !== 'S0_TITLE') {
        setChapterHeaderVisible(false);
      }
      resetIdleTimer();
      setHasSaveData(Boolean(localStorage.getItem('alice.save.v1')));
    };

    const onScaleChanged = (scale: number) => {
      if (scale <= 0.3) {
        setSizeText('0.254 m (10 in)');
      } else if (scale >= 2.0) {
        setSizeText('2.90 m (9 ft 6 in)');
      } else {
        setSizeText('1.20 m (4 ft)');
      }
    };

    const onInventoryUpdated = (items: InventoryItem[]) => {
      setInventory([...items]);
    };

    const onInspectItem = (payload: any) => {
      const item: InventoryItem = payload?.item || payload;
      if (!item || !item.id) return;
      setInspectItem({ ...item });
      const front = Boolean(item.inspectedFront);
      const back = Boolean(item.inspectedBack);
      setInspectedFront(front);
      setInspectedBack(back);
      setDrinkUnlocked(front && back);
    };

    const onBottleSideInspected = (side: 'front' | 'back') => {
      if (side === 'front') {
        setInspectedFront((_prevFront) => {
          setInspectedBack((prevBack) => {
            if (prevBack) setDrinkUnlocked(true);
            return prevBack;
          });
          return true;
        });
      } else if (side === 'back') {
        setInspectedBack((_prevBack) => {
          setInspectedFront((prevFront) => {
            if (prevFront) setDrinkUnlocked(true);
            return prevFront;
          });
          return true;
        });
      }
    };

    const onItemFullyInspected = (item: InventoryItem) => {
      if (!item || item.id === 'prop_bottle_drinkme' || item.id === 'drink_me_bottle') {
        setDrinkUnlocked(true);
      }
    };

    const onShowCuriosityNote = (note: CuriosityNote | string) => {
      const currentLang = langRef.current;
      if (typeof note === 'string') {
        setCuriosityModal((prev) => ({
          ...prev,
          title: note,
          body: getDialogueText(note, currentLang),
          fact: '',
        }));
        return;
      }
      if (!note || !note.title) return;
      setCuriosityModal({
        visible: true,
        title: note.title[currentLang] || note.title.en,
        body: note.content[currentLang] || note.content.en,
        fact: note.historicalFact[currentLang] || note.historicalFact.en,
      });
    };

    const onChapterComplete = (stats: { thoughts: number; notes: number; curtseyUnlocked: boolean }) => {
      setChapterComplete({
        visible: true,
        thoughts: stats.thoughts,
        notes: stats.notes,
        curtseyUnlocked: stats.curtseyUnlocked,
      });
    };

    const onCutsceneStart = () => {
      setCutscenePlaying(true);
    };

    const onCutsceneEnd = () => {
      setCutscenePlaying(false);
      skipHoldStartTimeRef.current = null;
      isSkippingRef.current = false;
      setSkipFillWidth('0%');
    };

    globalEventBus.on('dialogueTrigger', onDialogueTrigger);
    globalEventBus.on('showPrompt', onShowPrompt);
    globalEventBus.on('hidePrompt', onHidePrompt);
    globalEventBus.on('stateChanged', onStateChanged);
    globalEventBus.on('scaleChanged', onScaleChanged);
    globalEventBus.on('inventoryUpdated', onInventoryUpdated);
    globalEventBus.on('inspectItem', onInspectItem);
    globalEventBus.on('bottleSideInspected', onBottleSideInspected);
    globalEventBus.on('itemFullyInspected', onItemFullyInspected);
    globalEventBus.on('showCuriosityNote', onShowCuriosityNote);
    globalEventBus.on('chapterComplete', onChapterComplete);
    globalEventBus.on('cutsceneStart', onCutsceneStart);
    globalEventBus.on('cutsceneEnd', onCutsceneEnd);

    const handleKeyDown = (e: KeyboardEvent) => {
      resetIdleTimer();
      if (e.key === 'Escape') {
        if (cutscenePlayingRef.current) {
          if (!isSkippingRef.current) {
            skipHoldStartTimeRef.current = Date.now();
            setSkipFillWidth('100%');
            window.setTimeout(() => {
              if (skipHoldStartTimeRef.current && Date.now() - skipHoldStartTimeRef.current >= 1000) {
                isSkippingRef.current = true;
                globalEventBus.emit('skipCutscene');
              }
            }, 1000);
          }
        } else if (!titleVisibleRef.current) {
          if (pauseMenuVisibleRef.current) {
            setPauseMenuVisible(false);
            globalEventBus.emit('resumeGame');
          } else {
            setPauseMenuVisible(true);
            globalEventBus.emit('pauseGame');
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipHoldStartTimeRef.current = null;
        isSkippingRef.current = false;
        setSkipFillWidth('0%');
      }
    };

    const handleMouseMove = () => resetIdleTimer();
    const handleClick = () => resetIdleTimer();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    const idleInterval = window.setInterval(() => {
      idleTimeSecondsRef.current += 1;
      const idleSec = idleTimeSecondsRef.current;
      if (idleSec === 60) {
        const hint = getStuckHint(currentGameStateRef.current, 1, langRef.current);
        if (hint) {
          setStuckHint({ visible: true, text: hint });
          window.setTimeout(() => setStuckHint((p) => ({ ...p, visible: false })), 6000);
        }
      } else if (idleSec === 120) {
        const hint = getStuckHint(currentGameStateRef.current, 2, langRef.current);
        if (hint) {
          setStuckHint({ visible: true, text: hint });
          window.setTimeout(() => setStuckHint((p) => ({ ...p, visible: false })), 6000);
        }
      }
    }, 1000);

    return () => {
      globalEventBus.off('dialogueTrigger', onDialogueTrigger);
      globalEventBus.off('showPrompt', onShowPrompt);
      globalEventBus.off('hidePrompt', onHidePrompt);
      globalEventBus.off('stateChanged', onStateChanged);
      globalEventBus.off('scaleChanged', onScaleChanged);
      globalEventBus.off('inventoryUpdated', onInventoryUpdated);
      globalEventBus.off('inspectItem', onInspectItem);
      globalEventBus.off('bottleSideInspected', onBottleSideInspected);
      globalEventBus.off('itemFullyInspected', onItemFullyInspected);
      globalEventBus.off('showCuriosityNote', onShowCuriosityNote);
      globalEventBus.off('chapterComplete', onChapterComplete);
      globalEventBus.off('cutsceneStart', onCutsceneStart);
      globalEventBus.off('cutsceneEnd', onCutsceneEnd);

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      clearInterval(idleInterval);
    };
  }, [resetIdleTimer]);

  const showDrinkBtn =
    inspectItem && (inspectItem.id === 'prop_bottle_drinkme' || inspectItem.id === 'drink_me_bottle');

  return (
    <div id="game-container">
      <canvas id="render-canvas" ref={canvasRef}></canvas>
      <div id="ui-root" className="victorian-ui">
        {!loadingRemoved && (
          <div
            id="loading-screen"
            className="loading-screen"
            style={{ opacity: loadingFading ? 0 : 1 }}
          >
            <h1 className="loading-title">Alice&apos;s Adventures in Wonderland</h1>
            <p className="loading-subtitle">Chapter I. Down the Rabbit-Hole</p>
          </div>
        )}

        {/* 1. Title / Start Screen (Book Cover) */}
        <div id="ui-title-screen" className={`ui-title-screen ${!titleVisible ? 'hidden' : ''}`}>
          <div className="ui-title-book-cover parchment-card">
            <div className="ui-title-header">
              <h1 data-ui="title_h1">{getUIText('title_h1', lang)}</h1>
              <h2 data-ui="title_h2">{getUIText('title_h2', lang)}</h2>
            </div>
            <p className="ui-title-quote" data-ui="title_quote">
              {getUIText('title_quote', lang)}
            </p>
            <div className="ui-title-actions">
              <button id="btn-start-journey" className="victorian-btn" onClick={handleStartJourney}>
                <span>✦</span> <span data-ui="title_start">{getUIText('title_start', lang)}</span>
              </button>
              <button
                id="btn-continue-journey"
                className={`victorian-btn ${!hasSaveData ? 'hidden' : ''}`}
                onClick={handleContinueJourney}
              >
                <span>§</span> <span data-ui="title_continue">{getUIText('title_continue', lang)}</span>
              </button>
            </div>
            <div className="ui-lang-selector">
              <button
                className={`ui-lang-btn ${lang === 'en' ? 'active' : ''}`}
                data-lang="en"
                onClick={() => changeLanguage('en')}
              >
                English
              </button>
              <button
                className={`ui-lang-btn ${lang === 'zh' ? 'active' : ''}`}
                data-lang="zh"
                onClick={() => changeLanguage('zh')}
              >
                中文
              </button>
              <button
                className={`ui-lang-btn ${lang === 'ja' ? 'active' : ''}`}
                data-lang="ja"
                onClick={() => changeLanguage('ja')}
              >
                日本語
              </button>
            </div>
          </div>
        </div>

        {/* 2. Chapter Header Card */}
        <div id="ui-chapter-header" className={`ui-chapter-header ${chapterHeaderVisible ? 'visible' : ''}`}>
          <div className="parchment-card">
            <span className="drop-cap">A</span>
            <h2 style={{ color: 'var(--wine-red)', marginBottom: '0.3rem' }} data-ui="ui_chapter_badge">
              {getUIText('ui_chapter_badge', lang)}
            </h2>
            <h3 style={{ fontStyle: 'italic' }} data-ui="title_h2">
              {getUIText('title_h2', lang)}
            </h3>
          </div>
        </div>

        {/* 3. Subtitle / Dialogue Box */}
        <div id="ui-subtitle-box" className={`ui-subtitle-box ${!dialogue.visible ? 'hidden' : ''}`}>
          <div className="parchment-card ui-subtitle-content">
            <div id="ui-speaker-avatar" className="ui-speaker-avatar">
              {dialogue.speakerAvatar}
            </div>
            <div className="ui-subtitle-text-container">
              <div id="ui-speaker-name" className="ui-speaker-name" data-ui={dialogue.speakerKey}>
                {getUIText(dialogue.speakerKey, lang)}
              </div>
              <div id="ui-subtitle-text" className={`ui-subtitle-text ${dialogue.isThink ? 'think' : ''}`}>
                {dialogue.text}
              </div>
            </div>
          </div>
        </div>

        {/* 4. 6-slot Inventory Bar */}
        <div id="ui-inventory-bar" className="ui-inventory-bar">
          {Array.from({ length: 6 }).map((_, idx) => {
            const item = inventory[idx];
            return (
              <div
                key={idx}
                className={`ui-inventory-slot ${item ? '' : 'empty'}`}
                data-slot={idx}
                title={item ? getUIText(item.name, lang) : undefined}
                onClick={() => {
                  if (item) {
                    globalEventBus.emit('inspectItem', { item });
                  }
                }}
              >
                <span className="ui-inventory-slot-icon">{item ? renderItemSvgIcon(item) : null}</span>
              </div>
            );
          })}
        </div>

        {/* 5. 3D Item Inspector Modal Overlay */}
        <div id="ui-inspect-modal" className={`ui-inspect-modal ${!inspectItem ? 'hidden' : ''}`}>
          <div className="ui-inspect-container parchment-card">
            <h3 id="inspect-item-title" style={{ color: 'var(--wine-red)', fontSize: '1.4rem' }}>
              {inspectItem ? getUIText(inspectItem.name, lang) : 'Item Name'}
            </h3>
            <div className="ui-inspect-canvas-wrapper" id="ui-inspector">
              <span id="inspect-item-icon" style={{ userSelect: 'none' }} className="hidden">
                ✦
              </span>
            </div>
            <p className="ui-inspect-hint" data-ui="inspect_rotate_hint">
              {getUIText('inspect_rotate_hint', lang)}
            </p>
            <div className="ui-inspect-checklist">
              <span id="inspect-check-front" className={`ui-check-item ${inspectedFront ? 'done' : ''}`}>
                {inspectedFront ? '[✦]' : '[ ]'}{' '}
                <span data-ui="inspect_front_label">{getUIText('inspect_front_label', lang)}</span>
              </span>
              <span id="inspect-check-back" className={`ui-check-item ${inspectedBack ? 'done' : ''}`}>
                {inspectedBack ? '[✦]' : '[ ]'}{' '}
                <span data-ui="inspect_back_label">{getUIText('inspect_back_label', lang)}</span>
              </span>
            </div>
            <p id="inspect-item-desc" style={{ fontSize: '0.95rem', textAlign: 'center' }}>
              {inspectItem ? getUIText(inspectItem.description, lang) : 'Item description'}
            </p>
            <button
              id="btn-inspect-drink"
              className={`victorian-btn ${!showDrinkBtn ? 'hidden' : ''}`}
              disabled={!drinkUnlocked}
              onClick={handleDrinkBottleClick}
            >
              <span data-ui="inspect_btn_drink">{getUIText('inspect_btn_drink', lang)}</span>
            </button>
            <button id="btn-inspect-close" className="victorian-btn" onClick={handleCloseInspector}>
              <span data-ui="inspect_btn_close">{getUIText('inspect_btn_close', lang)}</span>
            </button>
          </div>
        </div>

        {/* 6. Interaction Prompt HUD */}
        <div
          id="ui-interact-prompt"
          className={`ui-interact-prompt ${!interactPrompt.visible ? 'hidden' : ''}`}
          onClick={() => globalEventBus.emit('interactionTriggered', 'E')}
        >
          <div className="ui-prompt-badge">
            <span id="ui-prompt-text">{interactPrompt.text}</span>
          </div>
        </div>

        {/* 7. Size Indicator */}
        <div id="ui-size-indicator" className="ui-size-indicator">
          <div className="ui-size-ribbon">
            <span>
              ✦ <span data-ui="hud_height">{getUIText('hud_height', lang)}</span>
            </span>
            <strong id="ui-size-text">{sizeText}</strong>
          </div>
        </div>

        {/* 8. Curiosity Note Popup */}
        <div id="ui-curiosity-popup" className={`ui-curiosity-modal ${!curiosityModal.visible ? 'hidden' : ''}`}>
          <div className="ui-curiosity-content parchment-card">
            <span className="drop-cap">§</span>
            <h3 id="curiosity-title" className="ui-curiosity-title">
              {curiosityModal.title}
            </h3>
            <p id="curiosity-body" style={{ lineHeight: 1.5, margin: '0.5rem 0' }}>
              {curiosityModal.body}
            </p>
            <div id="curiosity-fact" className="ui-curiosity-fact">
              {curiosityModal.fact}
            </div>
            <button
              id="btn-curiosity-close"
              className="victorian-btn"
              style={{ alignSelf: 'center' }}
              onClick={() => setCuriosityModal((prev) => ({ ...prev, visible: false }))}
            >
              <span data-ui="inspect_btn_close">{getUIText('inspect_btn_close', lang)}</span>
            </button>
          </div>
        </div>

        {/* 9. Stuck Hint Toast */}
        <div id="ui-stuck-toast" className={`ui-stuck-toast parchment-card ${!stuckHint.visible ? 'hidden' : ''}`}>
          <p id="stuck-hint-text" style={{ fontStyle: 'italic', fontSize: '1rem', color: 'var(--wine-red)' }}>
            <span data-ui="hud_hint">{getUIText('hud_hint', lang)}</span> {stuckHint.text}
          </p>
        </div>

        {/* 10. Pause Menu & Settings */}
        <div id="ui-pause-menu" className={`ui-pause-modal ${!pauseMenuVisible ? 'hidden' : ''}`}>
          <div className="ui-pause-card parchment-card">
            <h2
              style={{
                color: 'var(--wine-red)',
                borderBottom: '2px solid var(--gold-accent)',
                paddingBottom: '0.4rem',
                width: '100%',
                textAlign: 'center',
              }}
              data-ui="settings_title"
            >
              {getUIText('settings_title', lang)}
            </h2>
            <div className="ui-slider-row">
              <span data-ui="settings_volume_master">{getUIText('settings_volume_master', lang)}</span>
              <input
                type="range"
                id="slider-vol-master"
                min="0"
                max="100"
                value={volMaster}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolMaster(val);
                  globalEventBus.emit('setMasterVolume', val / 100);
                }}
              />
            </div>
            <div className="ui-slider-row">
              <span data-ui="settings_volume_music">{getUIText('settings_volume_music', lang)}</span>
              <input
                type="range"
                id="slider-vol-music"
                min="0"
                max="100"
                value={volMusic}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolMusic(val);
                  globalEventBus.emit('setMusicVolume', val / 100);
                }}
              />
            </div>
            <div className="ui-slider-row">
              <span data-ui="settings_volume_sfx">{getUIText('settings_volume_sfx', lang)}</span>
              <input
                type="range"
                id="slider-vol-sfx"
                min="0"
                max="100"
                value={volSfx}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolSfx(val);
                  globalEventBus.emit('setSfxVolume', val / 100);
                }}
              />
            </div>
            <div className="ui-slider-row">
              <span data-ui="settings_language">{getUIText('settings_language', lang)}</span>
              <select
                id="select-language"
                style={{ padding: '0.3rem', fontFamily: 'inherit' }}
                value={lang}
                onChange={(e) => changeLanguage(e.target.value as Language)}
              >
                <option value="en">English (1865)</option>
                <option value="zh">中文 (Victorian)</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                id="btn-pause-resume"
                className="victorian-btn"
                onClick={() => {
                  setPauseMenuVisible(false);
                  globalEventBus.emit('resumeGame');
                }}
              >
                <span data-ui="btn_pause_resume">{getUIText('btn_pause_resume', lang)}</span>
              </button>
              <button
                id="btn-pause-title"
                className="victorian-btn"
                onClick={() => {
                  setPauseMenuVisible(false);
                  setTitleVisible(true);
                }}
              >
                <span data-ui="btn_pause_title">{getUIText('btn_pause_title', lang)}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 11. Cutscene Skip Indicator */}
        <div id="ui-cutscene-skip" className={`ui-cutscene-skip ${!cutscenePlaying ? 'hidden' : ''}`}>
          <span data-ui="skip_cutscene">{getUIText('skip_cutscene', lang)}</span>
          <div className="ui-skip-progress-bar">
            <div id="ui-skip-fill" className="ui-skip-progress-fill" style={{ width: skipFillWidth }}></div>
          </div>
        </div>

        {/* 12. Chapter Complete / Transition Card */}
        <div
          id="ui-chapter-complete"
          className={`ui-chapter-complete-modal ${!chapterComplete.visible ? 'hidden' : ''}`}
        >
          <div className="ui-complete-card parchment-card">
            <span className="drop-cap">✦</span>
            <h2 style={{ color: 'var(--wine-red)', fontSize: '2rem' }} data-ui="chapter_complete">
              {getUIText('chapter_complete', lang)}
            </h2>
            <p style={{ fontStyle: 'italic' }} data-ui="title_quote">
              {getUIText('title_quote', lang)}
            </p>
            <div
              style={{
                textAlign: 'left',
                background: 'var(--paper-dark)',
                padding: '1rem',
                borderRadius: '4px',
                width: '100%',
              }}
            >
              <p>
                <strong data-ui="curiosity_notes_modal">{getUIText('curiosity_notes_modal', lang)}</strong>:{' '}
                <span id="stat-thoughts">{chapterComplete.thoughts}/5</span>
              </p>
              <p>
                <strong data-ui="stat_notes_collected">{getUIText('stat_notes_collected', lang)}</strong>:{' '}
                <span id="stat-notes">{chapterComplete.notes}/5</span>
              </p>
              <p>
                <strong data-ui="stat_curtsey_egg">{getUIText('stat_curtsey_egg', lang)}</strong>:{' '}
                <span
                  id="stat-curtsey"
                  data-ui={chapterComplete.curtseyUnlocked ? 'stat_unlocked' : 'stat_locked'}
                >
                  {getUIText(chapterComplete.curtseyUnlocked ? 'stat_unlocked' : 'stat_locked', lang)}
                </span>
              </p>
            </div>
            <button
              id="btn-complete-title"
              className="victorian-btn"
              onClick={() => {
                setChapterComplete((prev) => ({ ...prev, visible: false }));
                setTitleVisible(true);
              }}
            >
              <span data-ui="btn_pause_title">{getUIText('btn_pause_title', lang)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
