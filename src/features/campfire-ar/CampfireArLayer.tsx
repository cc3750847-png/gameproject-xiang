import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { GuidanceStateResult } from '../guidance/types';
import {
  deleteCloudCampfire,
  fetchCloudCampfires,
  isCampfireCloudConfigured,
  saveCloudCampfire,
  saveCloudComment,
  subscribeCloudCampfires,
} from './campfireStore';
import type { CampfireComment, CampfireKind, CampfireNote } from './campfireTypes';
import './campfireAr.scss';

type ThreeModule = typeof import('three');

type CameraPipelineModule = {
  name?: string;
  onStart?: (args: { canvas: HTMLCanvasElement }) => void;
  onUpdate?: () => void;
  requiredPermissions?: () => unknown[];
};

type XrSceneState = {
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  scene: Scene;
};

type Xr8Runtime = {
  addCameraPipelineModules?: (modules: CameraPipelineModule[]) => void;
  removeCameraPipelineModules?: (moduleNames: string[]) => void;
  run?: (options: { cameraConfig?: { direction?: unknown }; canvas: HTMLCanvasElement }) => void;
  pause?: () => void;
  stop?: () => void;
  loadChunk?: (chunkName: string) => Promise<void>;
  GlTextureRenderer?: {
    pipelineModule?: () => CameraPipelineModule;
  };
  Threejs?: {
    pipelineModule?: () => CameraPipelineModule;
    xrScene?: () => XrSceneState;
  };
  XrConfig?: {
    camera?: () => {
      BACK?: unknown;
    };
  };
  XrController?: {
    pipelineModule?: () => CameraPipelineModule;
    updateCameraProjectionMatrix?: (args: { facing: PerspectiveCamera['quaternion']; origin: Vector3 }) => void;
  };
  XrPermissions?: {
    permissions?: () => {
      DEVICE_ORIENTATION?: unknown;
    };
  };
};

type XrExtrasRuntime = {
  FullWindowCanvas?: {
    pipelineModule?: () => CameraPipelineModule;
  };
  RuntimeError?: {
    pipelineModule?: () => CameraPipelineModule;
  };
};

type XrWindow = Window & {
  THREE?: ThreeModule;
  XR8?: Xr8Runtime;
  XRExtras?: XrExtrasRuntime;
};

type CampfireObject = ReturnType<typeof createCampfireObject> & {
  id: string;
  kind: CampfireKind;
};

type DrawerDragState = {
  lastY: number;
  pointerId: number;
  startY: number;
};

type DrawerMode = 'compose' | 'view';

type HotspotScreenState = {
  initialized: boolean;
  missedFrames: number;
  x: number;
  y: number;
};

type RuntimeStatus = 'loading' | 'ready' | 'error';
type SyncMode = 'cloud' | 'loading' | 'local';

type CampfireArLayerProps = {
  guidanceState: GuidanceStateResult;
  onRuntimeStatusChange?: (status: RuntimeStatus) => void;
  playerId: string;
  scene: string;
};

const CAMERA_HEIGHT = 1.48;
const CAMPFIRE_DISTANCE = 3;
const CAMPFIRE_VISIBLE_RADIUS = 10;
const CAMPFIRE_WORLD_SCALE = 0.72;
const CAMPFIRE_HOTSPOT_MIN_SCALE = 0.46;
const CAMPFIRE_HOTSPOT_MAX_SCALE = 0.72;
const CAMPFIRE_GROUND_ANCHOR_PERCENT = 68;
const RUNTIME_TIMEOUT_MS = 20000;
const STORAGE_VERSION = 4;
const OFFICIAL_CAMPFIRE_ID = 'official-origin-campfire';
const CAMPFIRE_MODULE_NAME = 'xiang-campfire-scene';
const PERMISSION_MODULE_NAME = 'xiang-campfire-orientation';
const ORIENTATION_SMOOTHING = 0.16;
const HOTSPOT_SMOOTHING = 0.18;
const HOTSPOT_HIDE_AFTER_MISSED_FRAMES = 12;

let runtimePromise: Promise<void> | null = null;

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStorageKey(scene: string) {
  return `xiang-campfire-webar:${STORAGE_VERSION}:${scene}`;
}

function shouldPreferNativeCameraOverlay() {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('xr8') === '1') {
    return false;
  }

  if (params.get('tracking') === 'world') {
    return false;
  }

  if (params.get('nativear') === '1') {
    return true;
  }

  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

async function requestDeviceOrientationPermission() {
  const DeviceOrientation = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      })
    | undefined;

  if (typeof DeviceOrientation?.requestPermission !== 'function') {
    return true;
  }

  try {
    return (await DeviceOrientation.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function createOfficialCampfire(existing?: CampfireNote): CampfireNote {
  return {
    id: OFFICIAL_CAMPFIRE_ID,
    kind: 'official',
    title: '橘子洲官方篝火',
    body: '橘子洲测试使用。这里是湘江橘子洲场景的官方留言点。',
    x: 0,
    y: 0,
    z: 0,
    comments: existing?.comments ?? [],
    createdAt: existing?.createdAt ?? 'official',
  };
}

function normalizeCampfire(value: unknown): CampfireNote | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<CampfireNote>;
  if (
    typeof record.id !== 'string' ||
    (record.kind !== 'official' && record.kind !== 'user') ||
    typeof record.title !== 'string' ||
    typeof record.body !== 'string' ||
    typeof record.x !== 'number' ||
    typeof record.z !== 'number'
  ) {
    return null;
  }

  const comments = Array.isArray(record.comments)
    ? record.comments.filter(
        (comment): comment is CampfireComment =>
          Boolean(comment) &&
          typeof comment === 'object' &&
          typeof (comment as CampfireComment).id === 'string' &&
          typeof (comment as CampfireComment).authorName === 'string' &&
          typeof (comment as CampfireComment).body === 'string' &&
          typeof (comment as CampfireComment).createdAt === 'string'
      )
    : [];

  return {
    id: record.id,
    kind: record.kind,
    ownerId: typeof record.ownerId === 'string' ? record.ownerId : undefined,
    title: record.title,
    body: record.body,
    x: record.x,
    y: typeof record.y === 'number' ? record.y : 0,
    z: record.z,
    comments,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  };
}

function readStoredCampfires(scene: string): CampfireNote[] {
  if (typeof window === 'undefined') {
    return [createOfficialCampfire()];
  }

  try {
    [1, 2, 3].forEach((version) => {
      window.localStorage.removeItem(`xiang-campfire-webar:${version}:${scene}`);
    });
    const raw = window.localStorage.getItem(getStorageKey(scene));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const campfires = Array.isArray(parsed)
      ? parsed.map(normalizeCampfire).filter((campfire): campfire is CampfireNote => campfire !== null)
      : [];
    const official = createOfficialCampfire(
      campfires.find((campfire): campfire is CampfireNote => campfire?.id === OFFICIAL_CAMPFIRE_ID)
    );
    const userCampfires = campfires.filter(
      (campfire) => campfire.kind === 'user' && campfire.id !== OFFICIAL_CAMPFIRE_ID
    );

    return [official, ...userCampfires];
  } catch {
    return [createOfficialCampfire()];
  }
}

function withOfficialCampfire(campfires: CampfireNote[]) {
  const official = createOfficialCampfire(
    campfires.find((campfire): campfire is CampfireNote => campfire?.id === OFFICIAL_CAMPFIRE_ID)
  );
  const userCampfires = campfires.filter(
    (campfire) => campfire.kind === 'user' && campfire.id !== OFFICIAL_CAMPFIRE_ID
  );

  return [official, ...userCampfires];
}

function formatCommentTime(input: string) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return '刚刚';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function waitForGlobal(test: () => boolean, label: string, eventName?: string, timeoutMs = RUNTIME_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    if (test()) {
      resolve();
      return;
    }

    let settled = false;

    const cleanup = () => {
      if (eventName) {
        window.removeEventListener(eventName, handleReady);
      }
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const handleReady = () => {
      if (test()) {
        finish(resolve);
      }
    };

    const intervalId = window.setInterval(handleReady, 80);
    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error(`${label} 初始化超时`)));
    }, timeoutMs);

    if (eventName) {
      window.addEventListener(eventName, handleReady);
    }
  });
}

async function loadScriptOnce(
  src: string,
  label: string,
  test: () => boolean,
  eventName?: string,
  attributes?: Record<string, string>
) {
  if (test()) {
    return;
  }

  const selector = `script[data-runtime-src="${src}"]`;
  let script = document.querySelector<HTMLScriptElement>(selector);

  if (!script) {
    script = document.createElement('script');
    script.async = true;
    script.dataset.runtimeSrc = src;
    script.src = src;
    Object.entries(attributes ?? {}).forEach(([key, value]) => {
      script?.setAttribute(key, value);
    });
    document.head.appendChild(script);
  }

  await Promise.race([
    waitForGlobal(test, label, eventName),
    new Promise<void>((_, reject) => {
      script?.addEventListener(
        'error',
        () => {
          reject(new Error(`${label} 脚本加载失败`));
        },
        { once: true }
      );
    }),
  ]);
}

async function ensure8thWallRuntime() {
  const win = window as XrWindow;

  if (win.XR8 && win.XRExtras) {
    return;
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const THREE = await import('three');
      THREE.ColorManagement.enabled = false;
      win.THREE = THREE;

      await loadScriptOnce(
        '/external/xrextras/xrextras.js',
        'XR Extras',
        () => Boolean((window as XrWindow).XRExtras),
        'xrextrasloaded'
      );

      await loadScriptOnce(
        '/external/xr/xr.js',
        '8th Wall Runtime',
        () => Boolean((window as XrWindow).XR8),
        'xrloaded',
        {
          'data-preload-chunks': 'slam',
        }
      );

      if (!win.XR8?.XrController) {
        await win.XR8?.loadChunk?.('slam');
      }

      if (!win.XR8?.XrController) {
        throw new Error('8th Wall SLAM 模块没有加载成功');
      }
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }

  await runtimePromise;
}

function createCampfireObject(THREE: ThreeModule, theme: CampfireKind) {
  const root = new THREE.Group();
  const flameMeshes: Mesh[] = [];
  const isOfficial = theme === 'official';

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 40),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      opacity: 0.24,
      transparent: true,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;

  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.36, 42),
    new THREE.MeshBasicMaterial({
      color: isOfficial ? 0x64c8ff : 0xf3b55d,
      opacity: 0.72,
      side: THREE.DoubleSide,
      transparent: true,
    })
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.015;

  const logMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f3a22,
    metalness: 0.06,
    roughness: 0.92,
  });

  const emberMaterial = new THREE.MeshStandardMaterial({
    color: isOfficial ? 0x6ed3ff : 0xff9d3d,
    emissive: isOfficial ? 0x219dff : 0xff7b1b,
    emissiveIntensity: 1.1,
    metalness: 0.04,
    roughness: 0.42,
  });

  const flameOuterMaterial = new THREE.MeshStandardMaterial({
    color: isOfficial ? 0x9be7ff : 0xffcf7c,
    emissive: isOfficial ? 0x1d8dff : 0xff9625,
    emissiveIntensity: 1.35,
    opacity: 0.9,
    transparent: true,
  });

  const flameInnerMaterial = new THREE.MeshStandardMaterial({
    color: isOfficial ? 0xe3fbff : 0xfff1c5,
    emissive: isOfficial ? 0x79d8ff : 0xffd174,
    emissiveIntensity: 1.5,
    opacity: 0.95,
    transparent: true,
  });

  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 18), emberMaterial);
  ember.castShadow = true;
  ember.position.y = 0.11;

  const logOne = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 10), logMaterial);
  logOne.castShadow = true;
  logOne.position.set(-0.02, 0.05, 0);
  logOne.rotation.set(0, Math.PI / 6, Math.PI / 2.9);

  const logTwo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), logMaterial);
  logTwo.castShadow = true;
  logTwo.position.set(0.03, 0.05, 0.02);
  logTwo.rotation.set(0, -Math.PI / 5, -Math.PI / 2.8);

  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 12), flameOuterMaterial);
  flameOuter.castShadow = true;
  flameOuter.position.set(0, 0.34, -0.01);

  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.25, 12), flameInnerMaterial);
  flameInner.castShadow = true;
  flameInner.position.set(0.015, 0.28, 0.02);

  const hitTarget = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 1.5, 20),
    new THREE.MeshBasicMaterial({
      depthWrite: false,
      opacity: 0,
      transparent: true,
    })
  );
  hitTarget.position.y = 0.58;

  root.add(shadow, glowRing, ember, logOne, logTwo, flameOuter, flameInner, hitTarget);
  root.scale.setScalar(CAMPFIRE_WORLD_SCALE);
  flameMeshes.push(flameOuter, flameInner);

  return {
    flameMeshes,
    glowRing,
    hitTarget,
    root,
  };
}

export function CampfireArLayer({
  guidanceState,
  onRuntimeStatusChange,
  playerId,
  scene,
}: CampfireArLayerProps) {
  const [campfires, setCampfires] = useState<CampfireNote[]>(() => readStoredCampfires(scene));
  const [activeCampfireId, setActiveCampfireId] = useState(OFFICIAL_CAMPFIRE_ID);
  const [draftBody, setDraftBody] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [placementReady, setPlacementReady] = useState(false);
  const [runtimeAttempt, setRuntimeAttempt] = useState(0);
  const [nativeFallbackActive, setNativeFallbackActive] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>(() => (isCampfireCloudConfigured() ? 'loading' : 'local'));
  const [statusText, setStatusText] = useState('点击进入 AR 后启动相机。');
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackStreamRef = useRef<MediaStream | null>(null);
  const hotspotRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const hotspotScreensRef = useRef<Map<string, HotspotScreenState>>(new Map());
  const drawerRef = useRef<HTMLElement | null>(null);
  const drawerDragRef = useRef<DrawerDragState | null>(null);
  const notesRef = useRef(campfires);
  const xrSceneRef = useRef<Scene | null>(null);
  const activeCameraRef = useRef<PerspectiveCamera | null>(null);
  const campfireObjectsRef = useRef<Map<string, CampfireObject>>(new Map());
  const runtimeStatusRef = useRef(onRuntimeStatusChange);

  const activeCampfire = useMemo(
    () => campfires.find((campfire) => campfire.id === activeCampfireId) ?? campfires[0],
    [activeCampfireId, campfires]
  );
  const userCampfireCount = useMemo(
    () => campfires.filter((campfire) => campfire.kind === 'user').length,
    [campfires]
  );
  const canDeleteActiveCampfire =
    activeCampfire?.kind === 'user' && (!activeCampfire.ownerId || activeCampfire.ownerId === playerId);
  const hasStarted = runtimeAttempt > 0;
  const syncLabel = syncMode === 'cloud' ? '多人同步' : syncMode === 'loading' ? '连接云端' : '本地 Demo';

  useEffect(() => {
    runtimeStatusRef.current = onRuntimeStatusChange;
  }, [onRuntimeStatusChange]);

  useEffect(() => {
    let disposed = false;
    let refreshTimer: number | null = null;
    let unsubscribe: (() => void) | null = null;

    const loadCloudCampfires = async () => {
      try {
        const cloudCampfires = await fetchCloudCampfires(scene);
        if (disposed || !cloudCampfires) {
          return;
        }

        setCampfires(withOfficialCampfire(cloudCampfires));
        setSyncMode('cloud');
      } catch {
        if (!disposed) {
          setSyncMode('local');
          setStatusText('云端留言暂不可用，当前使用本机 Demo 数据。');
        }
      }
    };

    if (!isCampfireCloudConfigured()) {
      return () => {
        disposed = true;
      };
    }

    void loadCloudCampfires();

    unsubscribe = subscribeCloudCampfires(scene, () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void loadCloudCampfires();
      }, 120);
    });

    return () => {
      disposed = true;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      unsubscribe?.();
    };
  }, [scene]);

  useEffect(() => {
    notesRef.current = campfires;
    if (syncMode === 'local') {
      window.localStorage.setItem(getStorageKey(scene), JSON.stringify(campfires));
    }
  }, [campfires, scene, syncMode]);

  useEffect(() => {
    const activeIds = new Set(campfires.map((campfire) => campfire.id));
    hotspotScreensRef.current.forEach((_screen, campfireId) => {
      if (!activeIds.has(campfireId)) {
        hotspotScreensRef.current.delete(campfireId);
      }
    });
  }, [campfires]);

  const notifyRuntimeStatus = (status: RuntimeStatus) => {
    runtimeStatusRef.current?.(status);
  };

  const setHotspotRef = useCallback((campfireId: string, element: HTMLButtonElement | null) => {
    if (element) {
      hotspotRefs.current.set(campfireId, element);
      return;
    }

    hotspotRefs.current.delete(campfireId);
    hotspotScreensRef.current.delete(campfireId);
  }, []);

  const hideHotspot = useCallback((campfireId: string, force = false) => {
    const hotspot = hotspotRefs.current.get(campfireId);
    const screen = hotspotScreensRef.current.get(campfireId);

    if (screen) {
      screen.missedFrames += 1;
      if (!force && screen.missedFrames <= HOTSPOT_HIDE_AFTER_MISSED_FRAMES) {
        return;
      }
      screen.initialized = false;
    }

    if (hotspot) {
      hotspot.style.opacity = '0';
      hotspot.style.pointerEvents = 'none';
    }
  }, []);

  const hideAllHotspots = useCallback(() => {
    hotspotRefs.current.forEach((_hotspot, campfireId) => hideHotspot(campfireId, true));
  }, [hideHotspot]);

  const updateProjectedHotspots = useCallback(
    (canvas: HTMLCanvasElement, activeCamera: PerspectiveCamera | null, projectedPosition: Vector3) => {
      const currentCampfires = [...campfireObjectsRef.current.values()];

      if (!activeCamera || currentCampfires.length === 0) {
        hideAllHotspots();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        hideAllHotspots();
        return;
      }

      const visibleIds = new Set<string>();

      for (const campfire of currentCampfires) {
        const hotspot = hotspotRefs.current.get(campfire.id);
        if (!hotspot) {
          continue;
        }

        campfire.root.getWorldPosition(projectedPosition);
        projectedPosition.y = 0;

        const horizontalDistance = Math.hypot(
          projectedPosition.x - activeCamera.position.x,
          projectedPosition.z - activeCamera.position.z
        );

        if (horizontalDistance > CAMPFIRE_VISIBLE_RADIUS) {
          continue;
        }

        projectedPosition.project(activeCamera);
        if (
          !Number.isFinite(projectedPosition.x) ||
          !Number.isFinite(projectedPosition.y) ||
          !Number.isFinite(projectedPosition.z)
        ) {
          continue;
        }

        const isVisible =
          projectedPosition.z > -1 &&
          projectedPosition.z < 1 &&
          projectedPosition.x >= -1.18 &&
          projectedPosition.x <= 1.18 &&
          projectedPosition.y >= -1.15 &&
          projectedPosition.y <= 1.18;

        if (!isVisible) {
          continue;
        }

        const targetX = ((projectedPosition.x + 1) * 0.5) * rect.width;
        const targetY = ((1 - projectedPosition.y) * 0.5) * rect.height;
        let screen = hotspotScreensRef.current.get(campfire.id);

        if (!screen) {
          screen = {
            initialized: false,
            missedFrames: HOTSPOT_HIDE_AFTER_MISSED_FRAMES + 1,
            x: targetX,
            y: targetY,
          };
          hotspotScreensRef.current.set(campfire.id, screen);
        }

        if (!screen.initialized) {
          screen.x = targetX;
          screen.y = targetY;
          screen.initialized = true;
        } else {
          screen.x += (targetX - screen.x) * HOTSPOT_SMOOTHING;
          screen.y += (targetY - screen.y) * HOTSPOT_SMOOTHING;
        }

        const distanceRatio = Math.min(Math.max(horizontalDistance / CAMPFIRE_VISIBLE_RADIUS, 0), 1);
        const baseScale =
          CAMPFIRE_HOTSPOT_MAX_SCALE -
          (CAMPFIRE_HOTSPOT_MAX_SCALE - CAMPFIRE_HOTSPOT_MIN_SCALE) * distanceRatio;
        const scale = campfire.kind === 'official' ? baseScale * 1.06 : baseScale;

        screen.missedFrames = 0;
        visibleIds.add(campfire.id);
        hotspot.dataset.kind = campfire.kind;
        hotspot.style.opacity = '1';
        hotspot.style.pointerEvents = 'auto';
        hotspot.style.zIndex = String(10 + Math.round((CAMPFIRE_VISIBLE_RADIUS - horizontalDistance) * 0.8));
        hotspot.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0) translate(-50%, -${CAMPFIRE_GROUND_ANCHOR_PERCENT}%) scale(${scale.toFixed(3)})`;
      }

      hotspotRefs.current.forEach((_hotspot, campfireId) => {
        if (!visibleIds.has(campfireId)) {
          hideHotspot(campfireId);
        }
      });
    },
    [hideAllHotspots, hideHotspot]
  );

  const stopFallbackCamera = () => {
    fallbackStreamRef.current?.getTracks().forEach((track) => track.stop());
    fallbackStreamRef.current = null;

    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.srcObject = null;
    }
  };

  const startFallbackCamera = async () => {
    if (fallbackStreamRef.current || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
      });

      fallbackStreamRef.current = stream;
      if (fallbackVideoRef.current) {
        fallbackVideoRef.current.srcObject = stream;
        await fallbackVideoRef.current.play().catch(() => undefined);
      }
    } catch {
      // 8th Wall may already own the camera. This video only prevents a black visual layer.
    }
  };

  const openCampfire = (campfireId: string) => {
    setActiveCampfireId(campfireId);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    const drawer = drawerRef.current;
    if (drawer) {
      drawer.style.transition = '';
      drawer.style.transform = '';
    }

    drawerDragRef.current = null;
    setDrawerOpen(false);
  };

  const addCampfireObject = (note: CampfireNote, xrScene: Scene, THREE: ThreeModule) => {
    const existing = campfireObjectsRef.current.get(note.id);
    if (existing) {
      existing.root.position.set(note.x, note.y, note.z);
      return existing;
    }

    const campfire = createCampfireObject(THREE, note.kind) as CampfireObject;
    campfire.id = note.id;
    campfire.kind = note.kind;
    campfire.hitTarget.name = note.id;
    campfire.root.position.set(note.x, note.y, note.z);
    xrScene.add(campfire.root);
    campfireObjectsRef.current.set(note.id, campfire);

    return campfire;
  };

  const removeCampfireObject = (campfireId: string) => {
    const campfire = campfireObjectsRef.current.get(campfireId);
    if (campfire) {
      campfire.root.removeFromParent();
      campfireObjectsRef.current.delete(campfireId);
    }

    hotspotRefs.current.delete(campfireId);
    hotspotScreensRef.current.delete(campfireId);
  };

  useEffect(() => {
    const xrScene = xrSceneRef.current;
    const THREE = (window as XrWindow).THREE;
    if (!xrScene || !THREE) {
      return;
    }

    const activeIds = new Set(campfires.map((campfire) => campfire.id));
    campfireObjectsRef.current.forEach((_campfire, campfireId) => {
      if (!activeIds.has(campfireId)) {
        removeCampfireObject(campfireId);
      }
    });

    campfires.forEach((campfire) => {
      addCampfireObject(campfire, xrScene, THREE);
    });
  }, [campfires]);

  const deleteActiveCampfire = () => {
    if (!activeCampfire || activeCampfire.kind === 'official') {
      return;
    }

    if (activeCampfire.ownerId && activeCampfire.ownerId !== playerId) {
      setStatusText('只能删除自己放置的篝火。');
      return;
    }

    removeCampfireObject(activeCampfire.id);
    setCampfires((current) => current.filter((campfire) => campfire.id !== activeCampfire.id));
    if (syncMode === 'cloud') {
      void deleteCloudCampfire(activeCampfire.id).catch(() => {
        setStatusText('本机已删除，云端删除失败，请稍后重试。');
      });
    }
    setActiveCampfireId(OFFICIAL_CAMPFIRE_ID);
    setCommentBody('');
    closeDrawer();
    setStatusText('已删除你的篝火。');
  };

  const openCampfireComposer = () => {
    if (!placementReady || !activeCameraRef.current || !xrSceneRef.current || !(window as XrWindow).THREE) {
      setStatusText('WebAR 还没有稳定，稍等几秒再放置。');
      return;
    }

    setDraftTitle(`我的篝火 ${userCampfireCount + 1}`);
    setDraftBody('');
    setDrawerMode('compose');
    setDrawerOpen(true);
  };

  const placeCampfireAhead = () => {
    const camera = activeCameraRef.current;
    const xrScene = xrSceneRef.current;
    const THREE = (window as XrWindow).THREE;
    const title = draftTitle.trim() || `我的篝火 ${userCampfireCount + 1}`;
    const body = draftBody.trim();

    if (!placementReady || !camera || !xrScene || !THREE) {
      setStatusText('WebAR 还没有稳定，稍等几秒再放置。');
      return;
    }

    if (!body) {
      setStatusText('先写一句你想留下的内容。');
      return;
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;

    if (direction.lengthSq() < 0.0001) {
      direction.set(0, 0, -1);
    } else {
      direction.normalize();
    }

    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    const lateralOffset = ((userCampfireCount % 5) - 2) * 0.22;
    const nextPosition = new THREE.Vector3()
      .copy(camera.position)
      .addScaledVector(direction, CAMPFIRE_DISTANCE)
      .addScaledVector(right, lateralOffset);
    nextPosition.y = 0;

    const nextCampfire: CampfireNote = {
      id: createId('campfire'),
      kind: 'user',
      ownerId: playerId,
      title,
      body,
      x: nextPosition.x,
      y: nextPosition.y,
      z: nextPosition.z,
      comments: [],
      createdAt: new Date().toISOString(),
    };

    addCampfireObject(nextCampfire, xrScene, THREE);
    setCampfires((current) => [...current, nextCampfire]);
    if (syncMode === 'cloud') {
      void saveCloudCampfire(scene, nextCampfire).catch(() => {
        setStatusText('本机已放置，云端同步失败，请稍后重试。');
      });
    }
    setActiveCampfireId(nextCampfire.id);
    setDraftBody('');
    setDraftTitle('');
    setDrawerMode('view');
    setDrawerOpen(true);
    setStatusText(`已放置第 ${userCampfireCount + 1} 个篝火。`);
  };

  const startWebAr = () => {
    setRuntimeError(null);
    setPlacementReady(false);
    setStatusText('正在启动 WebAR...');
    void startFallbackCamera();
    void requestDeviceOrientationPermission();
    setNativeFallbackActive(shouldPreferNativeCameraOverlay());
    setRuntimeAttempt((current) => current + 1);
    notifyRuntimeStatus('loading');
  };

  const saveComment = () => {
    const body = commentBody.trim();
    if (!body || !activeCampfire) {
      return;
    }

    const nextComment: CampfireComment = {
      id: createId('comment'),
      authorName: playerId || 'player-demo',
      body,
      createdAt: new Date().toISOString(),
    };

    setCampfires((current) =>
      current.map((campfire) =>
        campfire.id === activeCampfire.id
          ? {
              ...campfire,
              comments: [...campfire.comments, nextComment],
            }
          : campfire
      )
    );
    if (syncMode === 'cloud') {
      void saveCloudComment(scene, activeCampfire.id, nextComment).catch(() => {
        setStatusText('本机已保存，云端评论同步失败，请稍后重试。');
      });
    }
    setCommentBody('');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    closeDrawer();
    setStatusText('评论已保存，留言面板已收起。');
  };

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveComment();
  };

  const handleDrawerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drawer = drawerRef.current;
    if (!drawerOpen || !drawer) {
      return;
    }

    drawerDragRef.current = {
      lastY: event.clientY,
      pointerId: event.pointerId,
      startY: event.clientY,
    };
    drawer.style.transition = 'none';
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDrawerPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = drawerDragRef.current;
    const drawer = drawerRef.current;
    if (!drag || !drawer || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = Math.max(0, event.clientY - drag.startY);
    drag.lastY = event.clientY;
    drawer.style.transform = `translateY(${deltaY}px)`;
  };

  const handleDrawerPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = drawerDragRef.current;
    const drawer = drawerRef.current;
    if (!drag || !drawer || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = Math.max(0, drag.lastY - drag.startY);
    drawer.style.transition = '';
    drawer.style.transform = '';
    drawerDragRef.current = null;

    if (deltaY > 72) {
      setDrawerOpen(false);
    }
  };

  useEffect(() => {
    if (runtimeAttempt === 0 || !nativeFallbackActive) {
      return;
    }

    const canvas = fallbackCanvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    let removeCanvasListeners: (() => void) | null = null;
    const campfireObjects = campfireObjectsRef.current;

    const bootNativeCameraOverlay = async () => {
      try {
        const THREE = await import('three');
        (window as XrWindow).THREE = THREE;
        THREE.ColorManagement.enabled = false;

        if (disposed) {
          return;
        }

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          canvas,
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const xrScene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(58, 1, 0.01, 80);
        camera.position.set(0, CAMERA_HEIGHT, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
        const directionalLight = new THREE.DirectionalLight(0xffe0b3, 1.25);
        directionalLight.position.set(1.8, 3.4, 2.2);
        xrScene.add(ambientLight, directionalLight);

        xrSceneRef.current = xrScene;
        activeCameraRef.current = camera;
        campfireObjects.clear();
        notesRef.current.forEach((note) => {
          addCampfireObject(note, xrScene, THREE);
        });

        const resize = () => {
          const width = canvas.clientWidth || window.innerWidth;
          const height = canvas.clientHeight || window.innerHeight;
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        };

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const projectedPosition = new THREE.Vector3();

        const handleCanvasTap = (clientX: number, clientY: number) => {
          const activeCamera = activeCameraRef.current;
          const currentCampfires = [...campfireObjectsRef.current.values()];
          if (!activeCamera || currentCampfires.length === 0) {
            return;
          }

          const rect = canvas.getBoundingClientRect();
          pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(pointer, activeCamera);
          const hits = raycaster.intersectObjects(
            currentCampfires.map((campfire) => campfire.hitTarget),
            false
          );
          const hitCampfire = currentCampfires.find((campfire) => campfire.hitTarget === hits[0]?.object);

          if (hitCampfire) {
            openCampfire(hitCampfire.id);
          }
        };

        const handlePointerDown = (event: PointerEvent) => {
          handleCanvasTap(event.clientX, event.clientY);
        };

        const handleTouchStart = (event: TouchEvent) => {
          const touch = event.touches[0];
          if (touch) {
            handleCanvasTap(touch.clientX, touch.clientY);
          }
        };

        const zee = new THREE.Vector3(0, 0, 1);
        const euler = new THREE.Euler();
        const q0 = new THREE.Quaternion();
        const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
        const orientationQuaternion = new THREE.Quaternion();
        const targetCameraQuaternion = new THREE.Quaternion();
        let hasOrientation = false;
        let initialInverse: import('three').Quaternion | null = null;

        const getScreenOrientation = () => {
          const screenOrientation = window.screen.orientation?.angle;
          const legacyOrientation = (window as Window & { orientation?: number }).orientation;
          return THREE.MathUtils.degToRad(screenOrientation ?? legacyOrientation ?? 0);
        };

        const setObjectQuaternion = (alpha: number, beta: number, gamma: number, orient: number) => {
          euler.set(beta, alpha, -gamma, 'YXZ');
          orientationQuaternion.setFromEuler(euler);
          orientationQuaternion.multiply(q1);
          orientationQuaternion.multiply(q0.setFromAxisAngle(zee, -orient));
        };

        const handleOrientation = (event: DeviceOrientationEvent) => {
          if (event.alpha === null || event.beta === null || event.gamma === null) {
            return;
          }

          setObjectQuaternion(
            THREE.MathUtils.degToRad(event.alpha),
            THREE.MathUtils.degToRad(event.beta),
            THREE.MathUtils.degToRad(event.gamma),
            getScreenOrientation()
          );

          if (!initialInverse) {
            initialInverse = orientationQuaternion.clone().invert();
          }

          targetCameraQuaternion.copy(orientationQuaternion).premultiply(initialInverse);
          if (!hasOrientation) {
            hasOrientation = true;
            camera.quaternion.copy(targetCameraQuaternion);
          }
        };

        const renderFrame = () => {
          if (disposed) {
            return;
          }

          const time = performance.now() * 0.001;
          if (hasOrientation) {
            camera.quaternion.slerp(targetCameraQuaternion, ORIENTATION_SMOOTHING);
          }

          [...campfireObjectsRef.current.values()].forEach((campfire, campfireIndex) => {
            campfire.flameMeshes.forEach((mesh, index) => {
              const scale = 0.96 + Math.sin(time * 5.2 + index * 1.25 + campfireIndex) * 0.08;
              mesh.scale.set(scale, 1 + Math.sin(time * 6.4 + index * 0.8) * 0.12, scale);
              mesh.rotation.z = Math.sin(time * 2.8 + index + campfireIndex) * 0.05;
            });

            const glowMaterial = campfire.glowRing.material as MeshBasicMaterial;
            glowMaterial.opacity = 0.6 + Math.sin(time * 4.1 + campfireIndex) * 0.08;
          });

          updateProjectedHotspots(canvas, activeCameraRef.current, projectedPosition);
          renderer.render(xrScene, camera);
          animationFrame = window.requestAnimationFrame(renderFrame);
        };

        resize();
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', resize);
        window.addEventListener('deviceorientation', handleOrientation, true);
        canvas.addEventListener('pointerdown', handlePointerDown, true);
        canvas.addEventListener('touchstart', handleTouchStart, true);

        removeCanvasListeners = () => {
          window.removeEventListener('resize', resize);
          window.removeEventListener('orientationchange', resize);
          window.removeEventListener('deviceorientation', handleOrientation, true);
          canvas.removeEventListener('pointerdown', handlePointerDown, true);
          canvas.removeEventListener('touchstart', handleTouchStart, true);
        };

        setPlacementReady(true);
        setStatusText('轻量方向锚定已启动：转动会对齐，走动位移需要 World Tracking。');
        notifyRuntimeStatus('ready');
        renderFrame();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '相机 AR 启动失败';
        setRuntimeError(message);
        setPlacementReady(false);
        setStatusText('相机 AR 启动失败');
        notifyRuntimeStatus('error');
      }
    };

    void bootNativeCameraOverlay();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      removeCanvasListeners?.();
      campfireObjects.forEach((campfire) => {
        campfire.root.removeFromParent();
      });
      campfireObjects.clear();
      xrSceneRef.current = null;
      activeCameraRef.current = null;
    };
  }, [nativeFallbackActive, runtimeAttempt, scene, updateProjectedHotspots]);

  useEffect(() => {
    if (runtimeAttempt === 0 || nativeFallbackActive) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    setPlacementReady(false);
    setRuntimeError(null);
    setStatusText('正在加载 8th Wall WebAR...');
    notifyRuntimeStatus('loading');

    let disposed = false;
    let cleanupTap: (() => void) | null = null;
    let moduleNames: string[] = [];
    const campfireObjects = campfireObjectsRef.current;

    const bootWorldTracking = async () => {
      try {
        await ensure8thWallRuntime();

        if (disposed) {
          return;
        }

        const win = window as XrWindow;
        const XR8 = win.XR8;
        const XRExtras = win.XRExtras;
        const THREE = win.THREE;

        if (!XR8 || !XRExtras || !THREE) {
          throw new Error('WebAR runtime 没有准备好');
        }

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const projectedPosition = new THREE.Vector3();

        const handleCanvasTap = (clientX: number, clientY: number) => {
          const activeCamera = activeCameraRef.current;
          const campfireObjects = [...campfireObjectsRef.current.values()];
          if (!activeCamera || campfireObjects.length === 0) {
            return;
          }

          const rect = canvas.getBoundingClientRect();
          pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(pointer, activeCamera);
          const hits = raycaster.intersectObjects(
            campfireObjects.map((campfire) => campfire.hitTarget),
            false
          );
          const hitCampfire = campfireObjects.find((campfire) => campfire.hitTarget === hits[0]?.object);

          if (hitCampfire) {
            openCampfire(hitCampfire.id);
          }
        };

        const handlePointerDown = (event: PointerEvent) => {
          handleCanvasTap(event.clientX, event.clientY);
        };

        const handleTouchStart = (event: TouchEvent) => {
          const touch = event.touches[0];
          if (touch) {
            handleCanvasTap(touch.clientX, touch.clientY);
          }
        };

        const sceneModule: CameraPipelineModule = {
          name: CAMPFIRE_MODULE_NAME,
          onStart: ({ canvas: runtimeCanvas }) => {
            const xrSceneState = XR8.Threejs?.xrScene?.();
            if (!xrSceneState) {
              throw new Error('Three.js XR scene 创建失败');
            }

            const { camera, renderer, scene: xrScene } = xrSceneState;
            xrSceneRef.current = xrScene;
            activeCameraRef.current = camera;
            camera.position.set(0, CAMERA_HEIGHT, 0);

            renderer.autoClearColor = false;
            renderer.setClearColor(0x000000, 0);
            renderer.setClearAlpha(0);
            renderer.shadowMap.enabled = true;

            const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
            const directionalLight = new THREE.DirectionalLight(0xffe0b3, 1.35);
            directionalLight.castShadow = true;
            directionalLight.position.set(1.8, 3.4, 2.2);
            directionalLight.shadow.camera.near = 0.1;
            directionalLight.shadow.camera.far = 18;
            directionalLight.shadow.mapSize.height = 1024;
            directionalLight.shadow.mapSize.width = 1024;

            const ground = new THREE.Mesh(
              new THREE.CircleGeometry(14, 72),
              new THREE.ShadowMaterial({
                opacity: 0.22,
              })
            );
            ground.receiveShadow = true;
            ground.rotation.x = -Math.PI / 2;
            xrScene.add(ambientLight, directionalLight, ground);

            campfireObjectsRef.current.clear();
            notesRef.current.forEach((note) => {
              addCampfireObject(note, xrScene, THREE);
            });

            runtimeCanvas.addEventListener('pointerdown', handlePointerDown, true);
            runtimeCanvas.addEventListener('touchstart', handleTouchStart, true);
            runtimeCanvas.addEventListener(
              'touchmove',
              (event: TouchEvent) => {
                event.preventDefault();
              },
              { passive: false }
            );

            cleanupTap = () => {
              runtimeCanvas.removeEventListener('pointerdown', handlePointerDown, true);
              runtimeCanvas.removeEventListener('touchstart', handleTouchStart, true);
            };

            XR8.XrController?.updateCameraProjectionMatrix?.({
              facing: camera.quaternion,
              origin: camera.position,
            });

            setPlacementReady(true);
            setStatusText('WebAR 已启动。官方蓝色篝火在世界原点，可继续放置自己的篝火。');
            notifyRuntimeStatus('ready');
          },
          onUpdate: () => {
            const campfireObjects = [...campfireObjectsRef.current.values()];
            const activeCamera = activeCameraRef.current;
            const time = performance.now() * 0.001;

            campfireObjects.forEach((campfire, campfireIndex) => {
              campfire.flameMeshes.forEach((mesh, index) => {
                const scale = 0.96 + Math.sin(time * 5.2 + index * 1.25 + campfireIndex) * 0.08;
                mesh.scale.set(scale, 1 + Math.sin(time * 6.4 + index * 0.8) * 0.12, scale);
                mesh.rotation.z = Math.sin(time * 2.8 + index + campfireIndex) * 0.05;
              });

              const glowMaterial = campfire.glowRing.material as MeshBasicMaterial;
              glowMaterial.opacity = 0.6 + Math.sin(time * 4.1 + campfireIndex) * 0.08;
            });

            updateProjectedHotspots(canvas, activeCamera, projectedPosition);
          },
        };

        const permissionModule: CameraPipelineModule = {
          name: PERMISSION_MODULE_NAME,
          requiredPermissions: () => {
            const orientationPermission = XR8.XrPermissions?.permissions?.().DEVICE_ORIENTATION;
            return orientationPermission ? [orientationPermission] : [];
          },
        };

        const modules = [
          XR8.GlTextureRenderer?.pipelineModule?.(),
          XR8.Threejs?.pipelineModule?.(),
          XR8.XrController?.pipelineModule?.(),
          XRExtras.FullWindowCanvas?.pipelineModule?.(),
          XRExtras.RuntimeError?.pipelineModule?.(),
          permissionModule,
          sceneModule,
        ].filter((module): module is CameraPipelineModule => Boolean(module));

        moduleNames = modules
          .map((module) => module.name)
          .filter((moduleName): moduleName is string => typeof moduleName === 'string');

        XR8.addCameraPipelineModules?.(modules);
        setStatusText('正在打开后置相机...');
        XR8.run?.({
          cameraConfig: {
            direction: XR8.XrConfig?.camera?.().BACK,
          },
          canvas,
        });
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'WebAR 启动失败，请确认使用 iPhone Safari 并允许相机和方向权限。';
        setRuntimeError(message);
        setPlacementReady(false);
        setStatusText('WebAR 启动失败');
        notifyRuntimeStatus('error');
      }
    };

    void bootWorldTracking();

    return () => {
      disposed = true;
      cleanupTap?.();
      campfireObjects.forEach((campfire) => {
        campfire.root.removeFromParent();
      });
      campfireObjects.clear();
      stopFallbackCamera();
      xrSceneRef.current = null;
      activeCameraRef.current = null;

      const XR8 = (window as XrWindow).XR8;
      if (!XR8) {
        return;
      }

      try {
        XR8.pause?.();
        XR8.stop?.();
      } catch (error) {
        void error;
      }

      try {
        if (moduleNames.length > 0) {
          XR8.removeCameraPipelineModules?.(moduleNames);
        }
      } catch (error) {
        void error;
      }
    };
  }, [nativeFallbackActive, runtimeAttempt, scene, updateProjectedHotspots]);

  return (
    <div
      className="campfire-ar-layer"
      data-guidance-phase={guidanceState.phase}
      data-drawer-open={drawerOpen}
      data-native-fallback={nativeFallbackActive}
      data-runtime={runtimeError ? 'error' : hasStarted ? 'started' : 'idle'}
    >
      <video
        ref={fallbackVideoRef}
        aria-hidden="true"
        autoPlay
        className="campfire-camera-fallback"
        muted
        playsInline
      />
      <canvas ref={fallbackCanvasRef} className="campfire-fallback-canvas" />
      <canvas ref={canvasRef} className="campfire-ar-canvas" id="camerafeed" />

      {!hasStarted || runtimeError ? (
        <div className="campfire-start-panel">
          <p>留言篝火 WebAR</p>
          <h2>{runtimeError ? 'WebAR 启动失败' : '进入后启动相机'}</h2>
          <span>
            {runtimeError ??
              '为了避免手机浏览器首屏卡死，先打开轻量页面；点击后再请求相机和方向权限。'}
          </span>
          <button type="button" onClick={startWebAr}>
            {runtimeError ? '重新进入 AR' : '进入 AR'}
          </button>
        </div>
      ) : null}

      {campfires.map((campfire) => (
      <button
        aria-label="查看篝火留言"
        className="campfire-hotspot"
        data-campfire-id={campfire.id}
        data-kind={campfire.kind}
        key={campfire.id}
        onClick={() => openCampfire(campfire.id)}
        ref={(element) => setHotspotRef(campfire.id, element)}
        type="button"
      >
        <span className="campfire-hotspot-model" aria-hidden="true">
          <span className="campfire-hotspot-brush" />
          <span className="campfire-hotspot-stones" />
          <span className="campfire-hotspot-shadow" />
          <span className="campfire-hotspot-log campfire-hotspot-log--one" />
          <span className="campfire-hotspot-log campfire-hotspot-log--two" />
          <span className="campfire-hotspot-smoke campfire-hotspot-smoke--one" />
          <span className="campfire-hotspot-smoke campfire-hotspot-smoke--two" />
          <span className="campfire-hotspot-flame campfire-hotspot-flame--outer" />
          <span className="campfire-hotspot-flame campfire-hotspot-flame--middle" />
          <span className="campfire-hotspot-flame campfire-hotspot-flame--inner" />
          <span className="campfire-hotspot-leaf campfire-hotspot-leaf--one" />
          <span className="campfire-hotspot-leaf campfire-hotspot-leaf--two" />
          <span className="campfire-hotspot-ember campfire-hotspot-ember--one" />
          <span className="campfire-hotspot-ember campfire-hotspot-ember--two" />
        </span>
        <span className="campfire-hotspot-ring" />
        <span className="campfire-hotspot-label">查看留言</span>
      </button>
      ))}

      <div className="campfire-ar-topline">
        <span>{runtimeError ? 'WebAR 异常' : `留言篝火 · ${syncLabel}`}</span>
        <strong>{runtimeError ?? statusText}</strong>
      </div>

      {hasStarted && !drawerOpen ? (
        <div className="campfire-action-rail">
          <button
            className="campfire-place-button"
            disabled={!placementReady}
            onClick={openCampfireComposer}
            type="button"
          >
            {userCampfireCount > 0 ? `继续放置篝火 (${userCampfireCount})` : '放置我的篝火'}
          </button>
          <button
            className="campfire-note-button"
            onClick={() => openCampfire(OFFICIAL_CAMPFIRE_ID)}
            type="button"
          >
            官方留言
          </button>
        </div>
      ) : null}

      <aside className="campfire-drawer" data-open={drawerOpen} ref={drawerRef} aria-label="篝火留言抽屉">
        <button
          aria-label="下滑或点击收起留言"
          className="campfire-drawer-handle"
          onClick={closeDrawer}
          onPointerCancel={handleDrawerPointerUp}
          onPointerDown={handleDrawerPointerDown}
          onPointerMove={handleDrawerPointerMove}
          onPointerUp={handleDrawerPointerUp}
          type="button"
        >
          <span />
        </button>

        {drawerMode === 'compose' ? (
          <>
            <div className="campfire-drawer-header">
              <div>
                <p>放置新篝火</p>
                <h2>写下你想留的话</h2>
              </div>
              <div className="campfire-drawer-actions">
                <button type="button" onClick={closeDrawer}>
                  取消
                </button>
              </div>
            </div>

            <form
              className="campfire-composer campfire-composer--create"
              onSubmit={(event) => {
                event.preventDefault();
                placeCampfireAhead();
              }}
            >
              <label>
                <span>标题</span>
                <input
                  maxLength={24}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="给这个篝火起个名字"
                  value={draftTitle}
                />
              </label>
              <label>
                <span>留言</span>
                <textarea
                  maxLength={220}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder="写下你想留在这里的话..."
                  rows={4}
                  value={draftBody}
                />
              </label>
              <button disabled={!draftBody.trim()} type="submit">
                放置篝火
              </button>
            </form>
          </>
        ) : activeCampfire ? (
          <>
            <div className="campfire-drawer-header">
              <div>
                <p>{activeCampfire.kind === 'official' ? '官方蓝色篝火' : '玩家留言篝火'}</p>
                <h2>{activeCampfire.title}</h2>
              </div>
              <div className="campfire-drawer-actions">
                {canDeleteActiveCampfire ? (
                  <button className="campfire-delete-button" type="button" onClick={deleteActiveCampfire}>
                    删除
                  </button>
                ) : null}
                <button type="button" onClick={closeDrawer}>
                  收起
                </button>
              </div>
            </div>

            <p className="campfire-body">{activeCampfire.body}</p>

            <div className="campfire-comments" aria-label="评论列表">
              {activeCampfire.comments.length === 0 ? (
                <p className="campfire-empty">还没有评论。</p>
              ) : (
                activeCampfire.comments.map((comment) => (
                  <article key={comment.id} className="campfire-comment">
                    <div>
                      <strong>{comment.authorName}</strong>
                      <time>{formatCommentTime(comment.createdAt)}</time>
                    </div>
                    <p>{comment.body}</p>
                  </article>
                ))
              )}
            </div>

            <form className="campfire-composer" onSubmit={submitComment}>
              <textarea
                maxLength={200}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="写一句现场留言..."
                rows={3}
                value={commentBody}
              />
              <button disabled={!commentBody.trim()} type="submit">
                发送评论
              </button>
            </form>
          </>
        ) : null}
      </aside>
    </div>
  );
}
