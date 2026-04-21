import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './styles/tokens.scss';
import { deriveGuidanceAudioLevel } from './features/guidance/deriveGuidanceAudioLevel';
import { deriveGuidanceState } from './features/guidance/deriveGuidanceState';
import { deriveParticleField } from './features/guidance/deriveParticleField';
import { JOURNEY_ORDER, JOURNEY_SCREENS } from './features/journey/screens';
import { getNextScreen, type JourneyScreen } from './features/journey/getNextScreen';
import { getHoldState } from './features/journey/getHoldState';

const HOLD_TARGET_MS = 1500;
const DEMO_TARGET_BEARING = 18;
const DEFAULT_DEMO_DEVIATION = -28;
const LOST_SIGNAL_AGE_MS = 2400;
const MAX_AUDIO_GAIN = 0.08;
const PLAYER_ID = 'player-demo';
const STAGE_GAME_IDS: Partial<Record<JourneyScreen, string>> = {
  guiding: 'river-sound',
  approaching: 'island-light',
  resonance: 'memory-resonance',
};

type StageGameConfigPayload = {
  success: boolean;
  gameId: string;
  stageId: string;
  data: {
    title: string;
    objective: string;
    summary?: string;
    targetScore: number;
    checkpoints?: string[];
    submitEndpoints: {
      progress: string;
      result: string;
    };
    rewardPreview?: Array<{
      type: string;
      amount: number;
    }>;
  };
  meta: {
    version: string;
  };
};

type StageGameMutationPayload = {
  success: boolean;
  gameId?: string;
  stageId?: string;
  data: {
    accepted?: boolean;
    checkpoint?: string;
    completionRate?: number;
    sessionId?: string;
    passed?: boolean;
    nextStageUnlocked?: string | null;
    rewards?: Array<{
      type: string;
      amount: number;
    }>;
  };
};

function getStageGameId(screen: JourneyScreen) {
  return STAGE_GAME_IDS[screen] ?? null;
}

function getStageGameStatusCopy(status: 'idle' | 'loading' | 'ready' | 'syncing' | 'error') {
  if (status === 'loading') {
    return '配置加载中';
  }

  if (status === 'syncing') {
    return '联调同步中';
  }

  if (status === 'error') {
    return '接口异常';
  }

  if (status === 'ready') {
    return '接口已接通';
  }

  return '待进入节点';
}

function getStageSessionId(screen: JourneyScreen) {
  const gameId = getStageGameId(screen) ?? 'journey';
  return `session-${gameId}`;
}

function buildProgressPayload(screen: JourneyScreen, completionRate: number) {
  if (screen === 'guiding') {
    return {
      playerId: PLAYER_ID,
      sessionId: getStageSessionId(screen),
      stageId: 'guiding',
      progress: {
        checkpoint: 'sound-gate-a',
        score: 48,
        completionRate,
      },
    };
  }

  if (screen === 'approaching') {
    return {
      playerId: PLAYER_ID,
      sessionId: getStageSessionId(screen),
      stageId: 'approaching',
      progress: {
        checkpoint: 'lantern-ring-b',
        score: 72,
        completionRate,
      },
    };
  }

  return {
    playerId: PLAYER_ID,
    sessionId: getStageSessionId(screen),
    stageId: 'resonance',
    progress: {
      checkpoint: 'resonance-core',
      score: Math.round(80 + completionRate * 20),
      completionRate,
    },
  };
}

function buildResultPayload(screen: JourneyScreen, completionRate: number) {
  if (screen === 'guiding') {
    return {
      playerId: PLAYER_ID,
      sessionId: getStageSessionId(screen),
      stageId: 'guiding',
      result: {
        score: 76,
        durationMs: 12800,
        completedObjectives: ['guidance-lock', 'leave-core'],
      },
    };
  }

  if (screen === 'approaching') {
    return {
      playerId: PLAYER_ID,
      sessionId: getStageSessionId(screen),
      stageId: 'approaching',
      result: {
        score: 84,
        durationMs: 17600,
        completedObjectives: ['light-ring', 'node-confirm'],
      },
    };
  }

  return {
    playerId: PLAYER_ID,
    sessionId: getStageSessionId(screen),
    stageId: 'resonance',
    result: {
      score: Math.round(88 + completionRate * 8),
      durationMs: HOLD_TARGET_MS,
      completedObjectives: ['hold-tone', 'align-breath'],
    },
  };
}

function getGuidanceCopy(
  phase: 'seeking' | 'aligning' | 'locked' | 'lost',
  direction: 'left' | 'right' | 'center'
) {
  if (phase === 'lost') {
    return '方位数据暂时中断';
  }

  if (phase === 'locked') {
    return '目标已锁定';
  }

  if (phase === 'aligning') {
    return direction === 'left' ? '请向左微调' : '请向右微调';
  }

  return direction === 'left' ? '请向左转动' : '请向右转动';
}

function getGuidanceHint(
  phase: 'seeking' | 'aligning' | 'locked' | 'lost',
  direction: 'left' | 'right' | 'center'
) {
  if (phase === 'lost') {
    return '尝试重新对准环境，等待位置数据恢复。';
  }

  if (phase === 'locked') {
    return '粒子已经开始向中心汇聚，继续向前即可进入目标区域。';
  }

  if (phase === 'aligning') {
    return direction === 'left'
      ? '已经接近目标，向左轻微修正即可锁定。'
      : '已经接近目标，向右轻微修正即可锁定。';
  }

  return direction === 'left'
    ? '目标位于当前视野左侧，粒子会从左边缘引导你转向。'
    : '目标位于当前视野右侧，粒子会从右边缘引导你转向。';
}

function getScannerStatusCopy(
  cameraStatus: 'idle' | 'loading' | 'ready' | 'error' | 'demo',
  guidanceHint: string
) {
  if (cameraStatus === 'loading') {
    return '正在接入摄像头，准备校准实景画面。';
  }

  if (cameraStatus === 'demo') {
    return 'Demo mode: camera unavailable, using simulated guidance.';
  }

  if (cameraStatus === 'error') {
    return '摄像头暂不可用，请确认浏览器已获得访问权限。';
  }

  return guidanceHint;
}

function App() {
  const [screen, setScreen] = useState<JourneyScreen>('entry');
  const [holdMs, setHoldMs] = useState(0);
  const [apiStatus, setApiStatus] = useState('API 检查中');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'demo'>('idle');
  const [demoDeviation, setDemoDeviation] = useState(DEFAULT_DEMO_DEVIATION);
  const [guidanceSignalActive, setGuidanceSignalActive] = useState(true);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [stageGameConfig, setStageGameConfig] = useState<StageGameConfigPayload | null>(null);
  const [stageGameStatus, setStageGameStatus] = useState<'idle' | 'loading' | 'ready' | 'syncing' | 'error'>('idle');
  const [stageGameFeedback, setStageGameFeedback] = useState('');
  const [stageGameReward, setStageGameReward] = useState('');
  const holdTimer = useRef<number | null>(null);
  const stageGameSyncingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const currentIndex = JOURNEY_ORDER.indexOf(screen);
  const config = JOURNEY_SCREENS[screen];
  const holdState = getHoldState(holdMs, HOLD_TARGET_MS);
  const activeStageGameId = getStageGameId(screen);

  const guidanceState = useMemo(() => {
    const now = Date.now();
    const currentBearing = DEMO_TARGET_BEARING - demoDeviation;

    return deriveGuidanceState({
      currentBearing,
      targetBearing: DEMO_TARGET_BEARING,
      lastUpdateAt: guidanceSignalActive ? now : now - LOST_SIGNAL_AGE_MS,
      now,
    });
  }, [demoDeviation, guidanceSignalActive]);

  const particleField = useMemo(() => deriveParticleField(guidanceState), [guidanceState]);
  const guidanceCopy = useMemo(
    () => getGuidanceCopy(guidanceState.phase, guidanceState.direction),
    [guidanceState.direction, guidanceState.phase]
  );
  const guidanceHint = useMemo(
    () => getGuidanceHint(guidanceState.phase, guidanceState.direction),
    [guidanceState.direction, guidanceState.phase]
  );
  const scannerStatusCopy = useMemo(
    () => getScannerStatusCopy(cameraStatus, guidanceHint),
    [cameraStatus, guidanceHint]
  );
  const guidanceAudioLevel = useMemo(
    () => (cameraStatus === 'ready' ? deriveGuidanceAudioLevel(guidanceState) : 0),
    [cameraStatus, guidanceState]
  );
  const indicator = useMemo(
    () =>
      JOURNEY_ORDER.map((item, index) => ({
        item,
        active: index <= currentIndex,
      })),
    [currentIndex]
  );

  function stopHold() {
    if (holdTimer.current !== null) {
      window.clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function stopScannerStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function ensureGuidanceAudio() {
    if (typeof window === 'undefined') {
      return;
    }

    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor = globalThis.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    if (!audioContextRef.current) {
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(262, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();

      audioContextRef.current = context;
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gain;
    }

    if (audioContextRef.current?.state === 'suspended') {
      void audioContextRef.current.resume().catch(() => undefined);
    }
  }

  function teardownGuidanceAudio() {
    const oscillator = oscillatorRef.current;
    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillatorRef.current = null;
    }

    const gainNode = gainNodeRef.current;
    if (gainNode) {
      gainNode.disconnect();
      gainNodeRef.current = null;
    }

    const audioContext = audioContextRef.current;
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }

  function closeScanner() {
    stopScannerStream();
    teardownGuidanceAudio();
    setIsScannerOpen(false);
    setCameraStatus('idle');
    setDemoDeviation(DEFAULT_DEMO_DEVIATION);
    setGuidanceSignalActive(true);
    setIsDebugPanelOpen(false);
  }

  async function loadStageGameConfig(activeScreen: JourneyScreen) {
    const gameId = getStageGameId(activeScreen);
    if (!gameId) {
      setStageGameConfig(null);
      setStageGameStatus('idle');
      setStageGameFeedback('');
      setStageGameReward('');
      return;
    }

    setStageGameStatus('loading');
    setStageGameFeedback('');
    setStageGameReward('');

    const response = await fetch(`/api/games/${gameId}/config`);
    if (!response.ok) {
      throw new Error('stage game config request failed');
    }

    const payload = (await response.json()) as StageGameConfigPayload;
    setStageGameConfig(payload);
    setStageGameStatus('ready');
    setStageGameFeedback(`已载入 ${payload.gameId} 合同 ${payload.meta.version}`);
  }

  async function syncStageGame(activeScreen: JourneyScreen, completionRate: number) {
    const gameId = getStageGameId(activeScreen);
    if (!gameId) {
      return true;
    }

    const progressEndpoint =
      stageGameConfig?.data.submitEndpoints.progress ?? `/api/games/${gameId}/progress`;
    const resultEndpoint =
      stageGameConfig?.data.submitEndpoints.result ?? `/api/games/${gameId}/result`;

    stageGameSyncingRef.current = true;
    setStageGameStatus('syncing');

    try {
      const progressResponse = await fetch(progressEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildProgressPayload(activeScreen, completionRate)),
      });

      if (!progressResponse.ok) {
        throw new Error('stage game progress request failed');
      }

      const progressPayload = (await progressResponse.json()) as StageGameMutationPayload;

      const resultResponse = await fetch(resultEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildResultPayload(activeScreen, completionRate)),
      });

      if (!resultResponse.ok) {
        throw new Error('stage game result request failed');
      }

      const resultPayload = (await resultResponse.json()) as StageGameMutationPayload;
      const reward = resultPayload.data.rewards?.[0];

      setStageGameStatus('ready');
      setStageGameFeedback(
        resultPayload.data.passed
          ? `已同步 ${gameId}，解锁 ${resultPayload.data.nextStageUnlocked ?? '下一阶段'}`
          : `已提交 ${gameId}，等待下一次尝试`
      );
      setStageGameReward(
        reward ? `已获得 ${reward.type} x${reward.amount}` : '本次未返回奖励'
      );

      return Boolean(resultPayload.data.passed ?? progressPayload.data.accepted);
    } catch {
      setStageGameStatus('error');
      setStageGameFeedback('节点联调提交失败，请稍后重试。');
      setStageGameReward('');
      return true;
    } finally {
      stageGameSyncingRef.current = false;
    }
  }

  useEffect(() => {
    let active = true;

    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('health request failed');
        }

        const payload = await response.json();
        if (active) {
          setApiStatus(payload.status === 'ok' ? 'API 在线' : 'API 未就绪');
        }
      })
      .catch(() => {
        if (active) {
          setApiStatus('API 离线');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      stopHold();
      stopScannerStream();
      teardownGuidanceAudio();
    },
    []
  );

  useEffect(() => {
    let active = true;

    if (!activeStageGameId) {
      setStageGameConfig(null);
      setStageGameStatus('idle');
      setStageGameFeedback('');
      setStageGameReward('');
      return () => {
        active = false;
      };
    }

    loadStageGameConfig(screen).catch(() => {
      if (active) {
        setStageGameConfig(null);
        setStageGameStatus('error');
        setStageGameFeedback('节点接口暂不可用，当前仅保留本地演示。');
      }
    });

    return () => {
      active = false;
    };
  }, [activeStageGameId, screen]);

  useEffect(() => {
    if (!isScannerOpen) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let disposed = false;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
        audio: false,
      })
      .then((stream) => {
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('ready');
      })
      .catch(() => {
        if (!disposed) {
          setCameraStatus('demo');
        }
      });

    return () => {
      disposed = true;
      stopScannerStream();
    };
  }, [isScannerOpen]);

  useEffect(() => {
    const audioContext = audioContextRef.current;
    const gainNode = gainNodeRef.current;

    if (!isScannerOpen || cameraStatus !== 'ready') {
      if (audioContext && gainNode) {
        gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
      }
      return;
    }

    ensureGuidanceAudio();

    if (!audioContextRef.current || !gainNodeRef.current || !oscillatorRef.current) {
      return;
    }

    const currentContext = audioContextRef.current;
    gainNodeRef.current.gain.setTargetAtTime(
      guidanceAudioLevel * MAX_AUDIO_GAIN,
      currentContext.currentTime,
      0.12
    );
    oscillatorRef.current.frequency.setTargetAtTime(
      220 + guidanceAudioLevel * 120,
      currentContext.currentTime,
      0.18
    );
  }, [cameraStatus, guidanceAudioLevel, isScannerOpen]);

  const startHold = () => {
    if (screen !== 'resonance' || holdTimer.current !== null || stageGameSyncingRef.current) {
      return;
    }

    holdTimer.current = window.setInterval(() => {
      setHoldMs((current) => {
        const next = current + 100;
        const nextState = getHoldState(next, HOLD_TARGET_MS);

        if (nextState.done) {
          stopHold();
          void (async () => {
            const canAdvance = await syncStageGame('resonance', 1);
            if (canAdvance) {
              setScreen(getNextScreen('resonance', 'complete'));
            }
          })();
          return HOLD_TARGET_MS;
        }

        return next;
      });
    }, 100);
  };

  const handlePrimaryAction = async () => {
    const nextScreen = getNextScreen(screen, 'primary');
    stopHold();
    setHoldMs(0);

    if (getStageGameId(screen)) {
      const canAdvance = await syncStageGame(screen, screen === 'guiding' ? 0.5 : 1);
      if (!canAdvance) {
        return;
      }
    }

    setScreen(nextScreen);
  };

  const handleSecondaryAction = () => {
    if (screen === 'guiding') {
      setDemoDeviation(DEFAULT_DEMO_DEVIATION);
      setGuidanceSignalActive(true);
      setIsDebugPanelOpen(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('demo');
        setIsScannerOpen(true);
        return;
      }

      setCameraStatus('loading');
      ensureGuidanceAudio();
      setIsScannerOpen(true);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-card journey-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h1>{config.title}</h1>
          </div>
          <span className="status-pill">{config.statusTag}</span>
        </div>

        <p className="description">{config.description}</p>

        <div className="stage-strip" aria-hidden="true">
          {indicator.map(({ item, active }) => (
            <span key={item} className={active ? 'active' : ''} />
          ))}
        </div>

        <div className="visual-orbit" aria-hidden="true" data-screen={screen}>
          <span />
          <span />
          <span />
        </div>

        <div className="meta-grid">
          <div>
            <p className="meta-label">当前进度</p>
            <strong>{config.progress}</strong>
          </div>
          <div>
            <p className="meta-label">服务状态</p>
            <strong>{apiStatus}</strong>
          </div>
        </div>

        {activeStageGameId ? (
          <section className="stage-game-panel" aria-label="阶段联调面板">
            <div className="stage-game-header">
              <p className="meta-label">节点联调</p>
              <span className="stage-game-status">{getStageGameStatusCopy(stageGameStatus)}</span>
            </div>

            {stageGameConfig ? (
              <>
                <h2>{stageGameConfig.data.title}</h2>
                <p className="stage-game-objective">{stageGameConfig.data.objective}</p>
                <div className="stage-game-grid">
                  <div>
                    <p className="meta-label">Game ID</p>
                    <strong>{stageGameConfig.gameId}</strong>
                  </div>
                  <div>
                    <p className="meta-label">目标分</p>
                    <strong>{stageGameConfig.data.targetScore}</strong>
                  </div>
                </div>
              </>
            ) : (
              <p className="stage-game-objective">正在准备当前节点的统一接口合同。</p>
            )}

            {stageGameFeedback ? (
              <p className="stage-game-feedback" data-testid="stage-game-feedback">
                {stageGameFeedback}
              </p>
            ) : null}

            {stageGameReward ? (
              <p className="stage-game-reward" data-testid="stage-game-reward">
                {stageGameReward}
              </p>
            ) : null}
          </section>
        ) : null}

        {screen === 'resonance' ? (
          <div className="hold-panel">
            <button
              type="button"
              className="hold-button"
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
            >
              按住共鸣
            </button>
            <div className="hold-meter" aria-hidden="true">
              <span style={{ transform: `scaleX(${holdState.progress})` }} />
            </div>
            <p className="hold-copy">
              {holdState.done
                ? '此地回应了你'
                : `共鸣进度 ${(holdState.progress * 100).toFixed(0)}%`}
            </p>
          </div>
        ) : null}

        <p className="journey-note">{config.note}</p>

        <div className="actions journey-actions">
          {screen !== 'resonance' ? (
            <button
              type="button"
              onClick={() => {
                void handlePrimaryAction();
              }}
            >
              {config.primaryLabel}
            </button>
          ) : null}
          {config.secondaryLabel ? (
            <button type="button" className="secondary" onClick={handleSecondaryAction}>
              {config.secondaryLabel}
            </button>
          ) : null}
        </div>
      </section>

      {isScannerOpen ? (
        <section className="scanner-sheet" aria-label="AR 引导层">
          <div
            className="scanner-stage"
            data-phase={guidanceState.phase}
            data-direction={guidanceState.direction}
          >
            <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />

            <div className="scanner-topbar">
              <div className="scanner-topstack">
                <div className="scanner-mode-chip">
                  <span className={`phase-dot ${guidanceState.phase}`} />
                  <span>AR 引导</span>
                </div>
                <div className="direction-chip" data-phase={guidanceState.phase} data-testid="guidance-direction-copy">
                  {guidanceCopy}
                </div>
              </div>

              <div className="scanner-topstack scanner-topstack--right">
                <div className="scanner-metrics">
                  <span className="metric-pill">偏角 {Math.round(Math.abs(guidanceState.deviation))}°</span>
                  <span className="metric-pill" data-testid="guidance-audio-level">
                    声强 {Math.round(guidanceAudioLevel * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button micro-close"
                  aria-label="关闭 AR 引导"
                  onClick={closeScanner}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="scanner-center">
              <div
                className="particle-layer"
                aria-hidden="true"
                data-phase={guidanceState.phase}
                data-direction={guidanceState.direction}
              >
                {particleField.map((particle) => (
                  <span
                    key={particle.id}
                    className="particle"
                    style={
                      {
                        '--delay': `${particle.delayMs}ms`,
                        '--duration': `${particle.durationMs}ms`,
                        '--origin-x': `${particle.originX}px`,
                        '--origin-y': `${particle.originY}px`,
                        '--target-x': `${particle.targetX}px`,
                        '--target-y': `${particle.targetY}px`,
                        '--scale': particle.scale,
                        '--intensity': particle.intensity,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>

              <div className="scanner-frame" aria-hidden="true">
                <span className="corner top-left" />
                <span className="corner top-right" />
                <span className="corner bottom-left" />
                <span className="corner bottom-right" />
              </div>
            </div>

            <button
              type="button"
              className="debug-toggle"
              aria-label={isDebugPanelOpen ? '收起调试面板' : '展开调试面板'}
              onClick={() => {
                setIsDebugPanelOpen((current) => !current);
              }}
            >
              {isDebugPanelOpen ? '收起调试' : '调试'}
            </button>

            {isDebugPanelOpen ? (
              <div className="guidance-demo-panel" aria-label="引导调试面板">
                <div className="guidance-demo-copy">
                  <label htmlFor="guidance-deviation">模拟偏角</label>
                  <strong>{Math.round(demoDeviation)}°</strong>
                </div>
                <input
                  id="guidance-deviation"
                  type="range"
                  min="-60"
                  max="60"
                  step="1"
                  value={demoDeviation}
                  onChange={(event) => {
                    setDemoDeviation(Number(event.target.value));
                    setGuidanceSignalActive(true);
                  }}
                />
                <div className="guidance-demo-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setDemoDeviation(DEFAULT_DEMO_DEVIATION);
                      setGuidanceSignalActive(true);
                    }}
                  >
                    模拟左偏
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setDemoDeviation(14);
                      setGuidanceSignalActive(true);
                    }}
                  >
                    模拟右转
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setDemoDeviation(2);
                      setGuidanceSignalActive(true);
                    }}
                  >
                    模拟锁定
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setGuidanceSignalActive(false);
                    }}
                  >
                    模拟丢失
                  </button>
                </div>
              </div>
            ) : null}

            <div className="scanner-status">{scannerStatusCopy}</div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default App;
