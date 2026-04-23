import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './styles/tokens.scss';
import { deriveGuidanceAudioLevel } from './features/guidance/deriveGuidanceAudioLevel';
import { deriveGuidanceState } from './features/guidance/deriveGuidanceState';
import { deriveParticleField } from './features/guidance/deriveParticleField';
import { HomeMenu } from './features/home/HomeMenu';
import { JOURNEY_ORDER, JOURNEY_SCREENS } from './features/journey/screens';
import { getNextScreen, type JourneyScreen } from './features/journey/getNextScreen';
import { getHoldState } from './features/journey/getHoldState';
import {
  createInitialNodeTaskState,
  createPostcardReward,
  getMapNodesWithDistance,
  recordPhotoCapture,
  skipNodeTask,
} from './features/map-nodes/mapNodes';
import type { GeoPoint, MapNode, NodeTaskState, PostcardReward } from './features/map-nodes/types';
import { ACHIEVEMENT_DEFINITIONS, applyAchievementEvent, getAchievementProgress } from './features/player/achievements';
import {
  PLAYER_STORAGE_KEY,
  createDefaultPlayerState,
  deserializePlayerState,
  serializePlayerState,
  updatePlayerAvatar,
  updatePlayerNickname,
} from './features/player/playerState';
import type { PlayerState } from './features/player/types';

const HOLD_TARGET_MS = 1500;
const DEMO_TARGET_BEARING = 18;
const DEFAULT_DEMO_DEVIATION = -28;
const LOST_SIGNAL_AGE_MS = 2400;
const MAX_AUDIO_GAIN = 0.08;
const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const PLAYER_ID = 'player-demo';
const DEMO_PLAYER_LOCATION: GeoPoint = {
  latitude: 28.2282,
  longitude: 112.9388,
};
const MAP_NODES: MapNode[] = [
  {
    id: 'shore-gate',
    title: '洲头渡口',
    summary: '在渡口确认江风、旧码头与水面入口线索。',
    coordinate: {
      latitude: 28.22821,
      longitude: 112.93882,
    },
    marker: {
      x: 24,
      y: 66,
    },
    radiusMeters: 35,
    photoTargets: ['老码头', '水纹', '树影'],
    postcard: {
      id: 'shore-postcard',
      title: '洲头渡口明信片',
      caption: '你把渡口的三处景物留在了回声里。',
      imageTone: 'warm-river',
    },
  },
  {
    id: 'bell-platform',
    title: '远钟台',
    summary: '沿江岸向北，寻找仍在水面回荡的钟声。',
    coordinate: {
      latitude: 28.231,
      longitude: 112.941,
    },
    marker: {
      x: 72,
      y: 22,
    },
    radiusMeters: 30,
    photoTargets: ['石阶', '铃影', '树冠'],
    postcard: {
      id: 'bell-postcard',
      title: '远钟台明信片',
      caption: '钟声替你保管了这一段路线。',
      imageTone: 'mist-blue',
    },
  },
  {
    id: 'leaf-cove',
    title: '树湾回声',
    summary: '在树影尽头标记一处安静的回声湾。',
    coordinate: {
      latitude: 28.2269,
      longitude: 112.9369,
    },
    marker: {
      x: 48,
      y: 42,
    },
    radiusMeters: 28,
    photoTargets: ['叶面', '石凳', '江光'],
    postcard: {
      id: 'leaf-postcard',
      title: '树湾回声明信片',
      caption: '这一湾树影把你的脚步收进了风里。',
      imageTone: 'leaf-gold',
    },
  },
];
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

type ExperienceView = 'entry' | 'map' | 'node-detail' | 'photo-task' | 'journey' | 'terminal';

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
  const [activeView, setActiveView] = useState<ExperienceView>('entry');
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
  const [playerLocation, setPlayerLocation] = useState<GeoPoint>(DEMO_PLAYER_LOCATION);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'demo' | 'error'>('idle');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeTask, setNodeTask] = useState<NodeTaskState | null>(null);
  const [postcardReward, setPostcardReward] = useState<PostcardReward | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [terminalFeedback, setTerminalFeedback] = useState('');
  const [player, setPlayer] = useState<PlayerState>(() => {
    if (typeof window === 'undefined') {
      return createDefaultPlayerState();
    }

    return deserializePlayerState(window.localStorage.getItem(PLAYER_STORAGE_KEY));
  });
  const [lastNonTerminalView, setLastNonTerminalView] = useState<ExperienceView>('entry');
  const holdTimer = useRef<number | null>(null);
  const stageGameSyncingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const config = JOURNEY_SCREENS[screen];
  const holdState = getHoldState(holdMs, HOLD_TARGET_MS);
  const activeStageGameId = getStageGameId(screen);
  const mapNodes = useMemo(
    () => getMapNodesWithDistance(MAP_NODES, playerLocation),
    [playerLocation]
  );
  const selectedNode = useMemo(
    () => mapNodes.find((node) => node.id === selectedNodeId) ?? null,
    [mapNodes, selectedNodeId]
  );
  const achievementProgress = useMemo(() => getAchievementProgress(player), [player]);
  const unlockedAchievements = useMemo(
    () => ACHIEVEMENT_DEFINITIONS.filter((achievement) => player.achievementIds.includes(achievement.id)),
    [player.achievementIds]
  );
  const collectedPostcards = useMemo(
    () => MAP_NODES.map((node) => node.postcard).filter((postcard) => player.postcardIds.includes(postcard.id)),
    [player.postcardIds]
  );

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
  const legacyViewConfig = useMemo(() => {
    if (activeView === 'map') {
      return {
        ...config,
        eyebrow: '区域地图',
        title: '橘洲节点地图',
        description: '先定位当前位置，再选择可进入的文化节点；不强制做任务，也可以直接继续主线。',
        progress: '地图选点',
        note: '地图页只负责定位与选点，主线推进放在底部按钮里。',
        statusTag:
          locationStatus === 'ready'
            ? '真实定位'
            : locationStatus === 'loading'
              ? '定位中'
              : locationStatus === 'error'
                ? '演示点'
                : locationStatus === 'demo'
                  ? '演示定位'
                  : '待定位',
      };
    }

    if (activeView === 'node-detail') {
      return {
        ...config,
        eyebrow: '节点详情',
        title: selectedNode?.title ?? '节点详情',
        description: selectedNode?.summary ?? '查看节点任务说明，并选择是否进入任务。',
        progress: '任务可选',
        note: '节点任务不是强制流程，跳过后仍可继续主线。',
        statusTag: '可跳过',
      };
    }

    if (activeView === 'photo-task') {
      return {
        ...config,
        eyebrow: '拍照任务',
        title: '拍摄三处景物',
        description: selectedNode
          ? `在${selectedNode.title}收集三处景物，完成后获得一张明信片。`
          : '收集三处景物，完成后获得一张明信片。',
        progress: nodeTask ? `${nodeTask.capturedTargets.length} / ${nodeTask.requiredTargets.length}` : '0 / 3',
        note: '这里用清单状态表达任务进度，不再使用全局进度条。',
        statusTag: nodeTask?.status === 'completed' ? '已完成' : '收集中',
      };
    }

    return config;
  }, [activeView, config, locationStatus, nodeTask, selectedNode]);

  void legacyViewConfig;

  const viewConfig = useMemo(() => {
    if (activeView === 'map') {
      return {
        ...config,
        eyebrow: '区域地图',
        title: '橘洲节点地图',
        description: '先定位当前区域，再选择可进入的文化节点。节点任务可以参与，也可以跳过后继续主线。',
        progress: '地图选点',
        note: '地图页只负责定位与进点，主线推进和终端系统从底部导航切换。',
        statusTag:
          locationStatus === 'ready'
            ? '真实定位'
            : locationStatus === 'loading'
              ? '定位中'
              : locationStatus === 'error'
                ? '演示点位'
                : locationStatus === 'demo'
                  ? '演示定位'
                  : '待定位',
      };
    }

    if (activeView === 'node-detail') {
      return {
        ...config,
        eyebrow: '节点详情',
        title: selectedNode?.title ?? '节点详情',
        description: selectedNode?.summary ?? '查看节点任务说明，并选择是否进入任务。',
        progress: '任务可选',
        note: '节点任务不是强制流程，跳过后依然可以继续主线。',
        statusTag: '可跳过',
      };
    }

    if (activeView === 'photo-task') {
      return {
        ...config,
        eyebrow: '拍照任务',
        title: '拍摄三处景物',
        description: selectedNode
          ? `在${selectedNode.title}收集三处景物，完成后可获得一张明信片。`
          : '收集三处景物，完成后可获得一张明信片。',
        progress: nodeTask ? `${nodeTask.capturedTargets.length} / ${nodeTask.requiredTargets.length}` : '0 / 3',
        note: '任务页只展示当前拍照进度，不再叠加全局进度条。',
        statusTag: nodeTask?.status === 'completed' ? '已完成' : '收集中',
      };
    }

    if (activeView === 'terminal') {
      return {
        ...config,
        eyebrow: '游戏终端',
        title: '玩家终端',
        description: '在这里管理头像、昵称、成就、文旅收藏和本地系统设置。',
        progress: `${achievementProgress.unlocked} / ${achievementProgress.total}`,
        note: '终端是独立页面，返回后会回到你刚才停留的流程位置。',
        statusTag: player.title,
      };
    }

    return config;
  }, [activeView, achievementProgress, config, locationStatus, nodeTask, player.title, selectedNode]);

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
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(player));
    } catch {
      setTerminalFeedback('本地存档空间不足，请更换更小的头像图片。');
    }
  }, [player]);

  useEffect(() => {
    if (screen === 'finale' && activeView === 'journey') {
      setPlayer((current) => applyAchievementEvent(current, { type: 'journey-completed' }));
    }
  }, [activeView, screen]);

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

  const refreshMapLocation = () => {
    setLocationStatus('loading');

    if (!navigator.geolocation?.getCurrentPosition) {
      setPlayerLocation(DEMO_PLAYER_LOCATION);
      setLocationStatus('demo');
      setPlayer((current) => applyAchievementEvent(current, { type: 'map-refreshed' }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPlayerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('ready');
        setPlayer((current) => applyAchievementEvent(current, { type: 'map-refreshed' }));
      },
      () => {
        setPlayerLocation(DEMO_PLAYER_LOCATION);
        setLocationStatus('error');
        setPlayer((current) => applyAchievementEvent(current, { type: 'map-refreshed' }));
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
      }
    );
  };

  const enterMapNode = (node: MapNode) => {
    setSelectedNodeId(node.id);
    setNodeTask(createInitialNodeTaskState(node));
    setShareFeedback('');
    setPlayer((current) => applyAchievementEvent(current, { type: 'node-entered', nodeId: node.id }));
    setActiveView('node-detail');
  };

  const startNodeTask = () => {
    if (selectedNode && !nodeTask) {
      setNodeTask(createInitialNodeTaskState(selectedNode));
    }

    setActiveView('photo-task');
  };

  const returnToMap = () => {
    setActiveView('map');
  };

  const openTerminal = () => {
    setLastNonTerminalView((current) => (activeView === 'terminal' ? current : activeView));
    setActiveView('terminal');
  };

  const returnFromTerminal = () => {
    setActiveView(lastNonTerminalView === 'terminal' ? (screen === 'entry' ? 'entry' : 'journey') : lastNonTerminalView);
  };

  const navigateHome = () => {
    setScreen('entry');
    setActiveView('entry');
  };

  const navigateMap = () => {
    setActiveView('map');
  };

  const continueMainlineFromMap = () => {
    setScreen((current) => (current === 'entry' ? 'guiding' : current));
    setActiveView('journey');
  };

  const handleSkipNodeTask = () => {
    if (!nodeTask || !selectedNode) {
      return;
    }

    setNodeTask(skipNodeTask(nodeTask));
    setPlayer((current) => applyAchievementEvent(current, { type: 'node-skipped', nodeId: selectedNode.id }));
    setActiveView('map');
  };

  const handleCapturePhoto = (target: string) => {
    if (!nodeTask || !selectedNode) {
      return;
    }

    const nextTask = recordPhotoCapture(nodeTask, target);
    setNodeTask(nextTask);

    const nextReward = createPostcardReward(selectedNode, nextTask);
    if (nextReward) {
      setPostcardReward(nextReward);
      setPlayer((current) => {
        const completedPlayer = applyAchievementEvent(current, {
          type: 'photo-task-completed',
          nodeId: selectedNode.id,
        });

        return applyAchievementEvent(completedPlayer, {
          type: 'postcard-earned',
          nodeId: selectedNode.id,
          postcardId: nextReward.id,
        });
      });
    }
  };

  const handleNicknameChange = (nickname: string) => {
    setPlayer((current) => updatePlayerNickname(current, nickname));
  };

  const handleAvatarUpload = (file: File | null) => {
    if (!file) {
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setTerminalFeedback('头像图片过大，请选择 2MB 以内的图片。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const avatarDataUrl = typeof reader.result === 'string' ? reader.result : null;
      setTerminalFeedback('');
      setPlayer((current) => updatePlayerAvatar(current, avatarDataUrl));
    };
    reader.onerror = () => {
      setTerminalFeedback('头像读取失败，请重新选择一张图片。');
    };
    reader.readAsDataURL(file);
  };

  const handleSharePostcard = () => {
    if (!postcardReward) {
      return;
    }

    if (navigator.share) {
      void navigator
        .share({
          title: postcardReward.title,
          text: postcardReward.shareText,
        })
        .catch(() => undefined);
      return;
    }

    setShareFeedback('分享文案已准备，可复制到社交平台。');
  };

  const handlePrimaryAction = async () => {
    if (activeView === 'entry' || screen === 'entry') {
      setActiveView('map');
      return;
    }

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
    setActiveView(nextScreen === 'entry' ? 'entry' : 'journey');
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

  if (screen === 'entry' && activeView === 'entry') {
    return (
      <main className="app-shell app-shell--home">
        <HomeMenu
          onStart={() => {
            void handlePrimaryAction();
          }}
          onOpenAchievements={openTerminal}
          onOpenSettings={openTerminal}
          onExit={openTerminal}
        />
      </main>
    );
  }

  return (
    <main className="app-shell app-shell--journey">
      <div className="journey-background" aria-hidden="true" />
      <section className="hero-card journey-panel journey-panel--fixed">
        <div className="panel-header">
          <div>
            <p className="eyebrow">{viewConfig.eyebrow}</p>
            <h1>{viewConfig.title}</h1>
          </div>
          <span className="status-pill">{viewConfig.statusTag}</span>
        </div>

        <p className="description">{viewConfig.description}</p>

        {activeView === 'entry' || activeView === 'journey' ? (
          <div className="visual-orbit" aria-hidden="true" data-screen={screen}>
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {activeView === 'entry' || activeView === 'journey' ? (
        <div className="meta-grid">
          <div>
            <p className="meta-label">当前进度</p>
            <strong>{viewConfig.progress}</strong>
          </div>
          <div>
            <p className="meta-label">服务状态</p>
            <strong>{apiStatus}</strong>
          </div>
        </div>
        ) : null}

        {activeView === 'map' ? (
        <section className="map-node-panel" aria-label="区域地图节点系统">
          <div className="stage-game-header">
            <div>
              <p className="meta-label">区域地图</p>
              <h2>橘洲节点标记</h2>
            </div>
            <span className="stage-game-status">
              {locationStatus === 'ready'
                ? '真实定位已连接'
                : locationStatus === 'loading'
                  ? '定位中'
                  : locationStatus === 'error'
                    ? '定位失败，使用演示点'
                    : locationStatus === 'demo'
                      ? '演示定位'
                      : '等待定位'}
            </span>
          </div>

          <p className="stage-game-objective">
            到达指定区域后可进入节点任务；任务非强制，可以跳过继续主线。
          </p>

          <div className="map-location-actions">
            <button type="button" className="secondary" onClick={refreshMapLocation}>
              定位并刷新地图
            </button>
            <span>
              {playerLocation.latitude.toFixed(5)}, {playerLocation.longitude.toFixed(5)}
            </span>
          </div>

          <div className="map-route" aria-label="节点地图">
            {mapNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className="map-marker"
                style={
                  {
                    '--marker-x': `${node.marker.x}%`,
                    '--marker-y': `${node.marker.y}%`,
                  } as CSSProperties
                }
                data-reachable={node.isReachable}
                data-testid={`map-node-${node.id}`}
                onClick={() => {
                  if (node.isReachable) {
                    enterMapNode(node);
                  }
                }}
              >
                <span>{node.title}</span>
                <small>{node.isReachable ? '可进入' : `${node.distanceMeters}m`}</small>
              </button>
            ))}
          </div>

          <div className="map-node-list">
            {mapNodes.map((node) => (
              <article key={node.id} className="map-node-card" data-reachable={node.isReachable}>
                <div>
                  <strong>{node.title}</strong>
                  <p>{node.summary}</p>
                </div>
                <button
                  type="button"
                  className="secondary"
                  disabled={!node.isReachable}
                  onClick={() => enterMapNode(node)}
                >
                  进入{node.title}节点
                </button>
              </article>
            ))}
          </div>

          {nodeTask?.status === 'skipped' && selectedNode ? (
            <p className="stage-game-feedback">已跳过{selectedNode.title}任务，主线可继续推进。</p>
          ) : null}

          <div className="actions map-primary-actions">
            <button type="button" onClick={continueMainlineFromMap}>
              继续主线
            </button>
          </div>

        </section>
        ) : null}

        {activeView === 'node-detail' && selectedNode && nodeTask ? (
          <section className="node-task-panel" aria-label="节点详情页">
            <div className="stage-game-header">
              <div>
                <p className="meta-label">节点详情</p>
                <h2>{selectedNode.title}</h2>
              </div>
              <span className="stage-game-status">任务可跳过</span>
            </div>

            <p className="stage-game-objective">{selectedNode.summary}</p>
            <div className="postcard-preview" data-tone={selectedNode.postcard.imageTone}>
              <p className="meta-label">奖励预览</p>
              <strong>{selectedNode.postcard.title}</strong>
              <p>{selectedNode.postcard.caption}</p>
            </div>
            <p className="stage-game-objective">
              任务内容：对该区域内的三处景物进行拍照。你可以开始任务，也可以跳过后继续主线。
            </p>
            <div className="actions node-detail-actions">
              <button type="button" onClick={startNodeTask}>
                开始节点任务
              </button>
              <button type="button" className="secondary" onClick={handleSkipNodeTask}>
                跳过此节点任务
              </button>
              <button type="button" className="secondary" onClick={returnToMap}>
                返回地图
              </button>
            </div>
          </section>
        ) : null}

        {activeView === 'photo-task' && selectedNode && nodeTask ? (
          <section className="node-task-panel" aria-label="拍照任务页">
            <div className="stage-game-header">
              <div>
                <p className="meta-label">拍照任务</p>
                <h2>{selectedNode.title}</h2>
              </div>
              <span className="stage-game-status">
                {nodeTask.status === 'completed'
                  ? '已完成'
                  : `${nodeTask.capturedTargets.length} / ${nodeTask.requiredTargets.length}`}
              </span>
            </div>

            <p className="stage-game-objective">
              对该区域内的三处景物进行拍照，完成后获得一张可分享明信片。
            </p>
            <div className="photo-target-grid">
              {nodeTask.requiredTargets.map((target) => {
                const captured = nodeTask.capturedTargets.includes(target);

                return (
                  <button
                    key={target}
                    type="button"
                    className="secondary"
                    disabled={captured || nodeTask.status === 'completed'}
                    data-captured={captured}
                    onClick={() => handleCapturePhoto(target)}
                  >
                    {captured ? `已拍摄${target}` : `拍摄${target}`}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="secondary"
              disabled={nodeTask.status === 'completed'}
              onClick={handleSkipNodeTask}
            >
              跳过此节点任务
            </button>

            {postcardReward && postcardReward.nodeId === selectedNode.id ? (
              <>
                <div className="postcard-preview" data-tone={postcardReward.imageTone}>
                  <p className="meta-label">已获得{postcardReward.title}</p>
                  <strong>{postcardReward.caption}</strong>
                </div>
                <button type="button" className="secondary" onClick={returnToMap}>
                  返回地图
                </button>
              </>
            ) : null}
          </section>
        ) : null}

        {activeView === 'terminal' ? (
          <section className="terminal-panel" aria-label="玩家终端">
            <div className="terminal-profile-card">
              <div className="terminal-avatar-wrap">
                {player.avatarDataUrl ? (
                  <img src={player.avatarDataUrl} alt="玩家头像" className="terminal-avatar" />
                ) : (
                  <div className="terminal-avatar terminal-avatar--placeholder" aria-hidden="true">
                    湘
                  </div>
                )}
              </div>
              <div className="terminal-profile-copy">
                <p className="meta-label">玩家档案</p>
                <strong>{player.nickname}</strong>
                <span>{player.title}</span>
              </div>
            </div>

            <div className="terminal-grid">
              <section className="terminal-card">
                <p className="meta-label">基础信息</p>
                <label className="terminal-field" htmlFor="player-nickname">
                  <span>玩家昵称</span>
                  <input
                    id="player-nickname"
                    type="text"
                    value={player.nickname}
                    onChange={(event) => {
                      handleNicknameChange(event.target.value);
                    }}
                  />
                </label>
                <label className="terminal-field terminal-field--file" htmlFor="player-avatar">
                  <span>上传本地头像</span>
                  <input
                    id="player-avatar"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      handleAvatarUpload(event.target.files?.[0] ?? null);
                    }}
                  />
                </label>
                {terminalFeedback ? <p className="terminal-feedback">{terminalFeedback}</p> : null}
              </section>

              <section className="terminal-card">
                <p className="meta-label">探索概况</p>
                <div className="terminal-stat-grid">
                  <article>
                    <strong>{player.level}</strong>
                    <span>探索等级</span>
                  </article>
                  <article>
                    <strong>{player.completedNodeIds.length}</strong>
                    <span>完成节点</span>
                  </article>
                  <article>
                    <strong>{collectedPostcards.length}</strong>
                    <span>明信片</span>
                  </article>
                  <article>
                    <strong>{achievementProgress.unlocked}</strong>
                    <span>已解锁成就</span>
                  </article>
                </div>
              </section>

              <section className="terminal-card">
                <div className="stage-game-header">
                  <p className="meta-label">成就</p>
                  <span className="stage-game-status">
                    {achievementProgress.unlocked} / {achievementProgress.total}
                  </span>
                </div>
                <div className="terminal-tag-list">
                  {unlockedAchievements.length ? (
                    unlockedAchievements.map((achievement) => (
                      <span key={achievement.id} className="terminal-tag" data-kind={achievement.kind}>
                        {achievement.title}
                      </span>
                    ))
                  ) : (
                    <p className="stage-game-objective">先进入地图、节点和任务，终端会逐步点亮你的游戏化与文旅成就。</p>
                  )}
                </div>
              </section>

              <section className="terminal-card">
                <p className="meta-label">明信片收藏</p>
                <div className="terminal-collection-list">
                  {collectedPostcards.length ? (
                    collectedPostcards.map((postcard) => (
                      <article key={postcard.id} className="postcard-preview" data-tone={postcard.imageTone}>
                        <strong>{postcard.title}</strong>
                        <p>{postcard.caption}</p>
                      </article>
                    ))
                  ) : (
                    <p className="stage-game-objective">完成节点拍照任务后，你获得的明信片会收藏在这里。</p>
                  )}
                </div>
              </section>

              <section className="terminal-card">
                <p className="meta-label">系统设置</p>
                <div className="terminal-settings-list">
                  <p>AR 引导时自动隐藏底部导航，避免遮挡视野。</p>
                  <p>定位模式当前状态：{locationStatus === 'ready' ? '真实定位' : '演示定位'}</p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setTerminalFeedback('');
                      setPlayer((current) => updatePlayerAvatar(current, null));
                    }}
                  >
                    重置头像
                  </button>
                  <button type="button" className="secondary" onClick={returnFromTerminal}>
                    返回当前页面
                  </button>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === 'journey' && activeStageGameId ? (
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

        <p className="journey-note">{viewConfig.note}</p>

        {activeView === 'journey' && screen === 'finale' ? (
          <section className="settlement-panel" aria-label="最终结算图">
            <p className="meta-label">最终结算明信片</p>
            {postcardReward ? (
              <>
                <div className="postcard-preview settlement-postcard" data-tone={postcardReward.imageTone}>
                  <span>{postcardReward.capturedCount} / 3 景物已收集</span>
                  <h2>{postcardReward.title}</h2>
                  <p>{postcardReward.caption}</p>
                </div>
                <button type="button" className="secondary share-button" onClick={handleSharePostcard}>
                  分享明信片
                </button>
                {shareFeedback ? <p className="stage-game-feedback">{shareFeedback}</p> : null}
              </>
            ) : (
              <p className="stage-game-objective">本次旅程尚未获得明信片，也可以继续主线完成结算。</p>
            )}
          </section>
        ) : null}

        {activeView === 'entry' || activeView === 'journey' ? (
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
        ) : null}
      </section>

{!isScannerOpen ? (
        <nav className="bottom-nav" aria-label="底部导航">
          <button
            type="button"
            className={activeView === 'entry' || activeView === 'journey' ? 'is-active' : undefined}
            onClick={navigateHome}
          >
            <img className="bottom-nav__icon" src="/home/icon-spot.png" alt="" aria-hidden="true" />
            <span className="bottom-nav__label">主页</span>
          </button>
          <button
            type="button"
            className={activeView === 'map' || activeView === 'node-detail' || activeView === 'photo-task' ? 'is-active' : undefined}
            onClick={navigateMap}
          >
            <img className="bottom-nav__icon" src="/home/icon-map.png" alt="" aria-hidden="true" />
            <span className="bottom-nav__label">地图</span>
          </button>
          <button
            type="button"
            className={activeView === 'terminal' ? 'is-active' : undefined}
            onClick={openTerminal}
          >
            <img className="bottom-nav__icon" src="/home/icon-achievement.png" alt="" aria-hidden="true" />
            <span className="bottom-nav__label">终端</span>
          </button>
        </nav>
      ) : null}

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
