import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { JOURNEY_SCREENS } from './features/journey/screens';

function openHomeMenuStart() {
  fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
}

function openGuidanceLayer() {
  openHomeMenuStart();
  fireEvent.click(screen.getByRole('button', { name: '继续主线' }));
  fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.secondaryLabel ?? '' }));
}

function setMediaDevices(getUserMedia?: () => Promise<{ getTracks: () => Array<{ stop: () => void }> }>) {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
}

function setGeolocation(latitude = 28.22821, longitude = 112.93882) {
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success({
      coords: {
        latitude,
        longitude,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1000,
    } as GeolocationPosition);
  });

  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition,
    },
  });

  return getCurrentPosition;
}

function mockFileReader(result = 'data:image/png;base64,avatar') {
  class MockFileReader {
    result: string | ArrayBuffer | null = result;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;

    readAsDataURL() {
      this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
    }
  }

  Object.defineProperty(globalThis, 'FileReader', {
    configurable: true,
    value: MockFileReader,
  });
}

function getScannerStage() {
  const scanner = screen.getByLabelText('AR 引导层');
  const stage = scanner.querySelector('.scanner-stage');

  if (!stage) {
    throw new Error('Expected .scanner-stage inside AR 引导层');
  }

  return stage as HTMLElement;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('App core flow', () => {
  it('shows the home menu with a reserved title area before the main flow starts', () => {
    render(<App />);

    expect(screen.getByLabelText('首页标题预留区')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '成就图鉴' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置选项' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出游戏' })).toBeInTheDocument();
    expect(document.querySelector('.home-menu__medallions')).toBeNull();
    expect(document.querySelector('.home-menu__utility-icons')).toBeNull();
    expect(document.querySelector('.home-menu__panel--compact')).not.toBeNull();
    expect(screen.queryByLabelText('底部导航')).not.toBeInTheDocument();
  });

  it('opens the camera guidance layer from the guiding screen', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });

    setMediaDevices(getUserMedia);
    render(<App />);

    openGuidanceLayer();

    await screen.findByLabelText('AR 引导层');

    const scannerStage = getScannerStage();
    expect(scannerStage).toHaveAttribute('data-phase', 'seeking');
    expect(scannerStage).toHaveAttribute('data-direction', 'left');
    expect(scannerStage.querySelector('.micro-close')).not.toBeNull();
  });

  it('shows the new scenic background on non-home pages', () => {
    render(<App />);

    openHomeMenuStart();

    const shell = document.querySelector('.app-shell--journey');
    const background = document.querySelector('.journey-background');
    const panel = document.querySelector('.journey-panel--fixed');

    expect(shell).not.toBeNull();
    expect(background).not.toBeNull();
    expect(panel).not.toBeNull();
  });

  it('renders the bottom navigation with icons and labels on journey pages', () => {
    render(<App />);

    openHomeMenuStart();

    const nav = screen.getByLabelText('底部导航');
    const navButtons = nav.querySelectorAll('button');
    const navIcons = nav.querySelectorAll('.bottom-nav__icon');
    const navLabels = nav.querySelectorAll('.bottom-nav__label');

    expect(navButtons).toHaveLength(3);
    expect(navIcons).toHaveLength(3);
    expect(navLabels).toHaveLength(3);
  });

  it('keeps the scanner demo visible when media APIs are unavailable', async () => {
    setMediaDevices();
    render(<App />);

    openGuidanceLayer();

    await screen.findByLabelText('AR 引导层');

    const scannerStage = getScannerStage();
    expect(scannerStage).toHaveAttribute('data-phase', 'seeking');
    expect(scannerStage).toHaveAttribute('data-direction', 'left');
    expect(scannerStage.querySelectorAll('.particle')).toHaveLength(18);
    expect(screen.getByText(/Demo mode/i)).toBeInTheDocument();
  });

  it('walks through the main journey screens', async () => {
    render(<App />);

    openHomeMenuStart();
    expect(screen.getByRole('heading', { name: '橘洲节点地图' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '继续主线' }));
    expect(screen.getByText(JOURNEY_SCREENS.guiding.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.approaching.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.resonance.title)).toBeInTheDocument();
  });

  it('completes resonance after a sustained hold', async () => {
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '继续主线' }));
    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.approaching.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.resonance.title)).toBeInTheDocument();

    vi.useFakeTimers();
    const holdButton = screen.getByRole('button', { name: '按住共鸣' });

    fireEvent.pointerDown(holdButton);

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.pointerUp(holdButton);

    vi.useRealTimers();
    expect(await screen.findByText(JOURNEY_SCREENS.completion.title)).toBeInTheDocument();
  });

  it('marks the scanner lost when the signal drops', async () => {
    setMediaDevices();
    render(<App />);

    openGuidanceLayer();

    const scanner = await screen.findByLabelText('AR 引导层');
    fireEvent.click(scanner.querySelector('button.debug-toggle') as HTMLButtonElement);
    fireEvent.click(scanner.querySelectorAll('.guidance-demo-actions button')[3] as HTMLButtonElement);

    const scannerStage = getScannerStage();
    expect(scannerStage).toHaveAttribute('data-phase', 'lost');
    expect(scannerStage).toHaveAttribute('data-direction', 'center');
    expect(scannerStage.querySelectorAll('.particle')).toHaveLength(8);
  });

  it('shows a higher guidance sound level when the target is locked', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });

    setMediaDevices(getUserMedia);

    const gainSetValueAtTime = vi.fn();
    const gainSetTargetAtTime = vi.fn();
    const gainDisconnect = vi.fn();
    const oscillatorSetValueAtTime = vi.fn();
    const oscillatorSetTargetAtTime = vi.fn();
    const oscillatorConnect = vi.fn();
    const oscillatorStart = vi.fn();
    const oscillatorStop = vi.fn();
    const oscillatorDisconnect = vi.fn();
    const contextResume = vi.fn().mockResolvedValue(undefined);
    const contextClose = vi.fn().mockResolvedValue(undefined);
    const gainConnect = vi.fn();

    class MockAudioContext {
      currentTime = 12;
      state: AudioContextState = 'suspended';
      destination = {};

      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: oscillatorSetValueAtTime,
            setTargetAtTime: oscillatorSetTargetAtTime,
          },
          connect: oscillatorConnect,
          start: oscillatorStart,
          stop: oscillatorStop,
          disconnect: oscillatorDisconnect,
        } as unknown as OscillatorNode;
      }

      createGain() {
        return {
          gain: {
            setValueAtTime: gainSetValueAtTime,
            setTargetAtTime: gainSetTargetAtTime,
          },
          connect: gainConnect,
          disconnect: gainDisconnect,
        } as unknown as GainNode;
      }

      resume() {
        this.state = 'running';
        return contextResume();
      }

      close() {
        return contextClose();
      }
    }

    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });

    render(<App />);

    openGuidanceLayer();

    await screen.findByLabelText('AR 引导层');

    expect(oscillatorStart).toHaveBeenCalledTimes(1);
    expect(contextResume).toHaveBeenCalled();
    await waitFor(() => {
      expect(gainSetTargetAtTime).toHaveBeenCalledWith(0.0288, 12, 0.12);
      expect(oscillatorSetTargetAtTime).toHaveBeenCalledWith(263.2, 12, 0.18);
    });

    const scanner = getScannerStage();
    fireEvent.click(scanner.querySelector('button.debug-toggle') as HTMLButtonElement);
    fireEvent.click(scanner.querySelectorAll('.guidance-demo-actions button')[2] as HTMLButtonElement);

    await waitFor(() => {
      expect(gainSetTargetAtTime).toHaveBeenCalledWith(0.08, 12, 0.12);
      expect(oscillatorSetTargetAtTime).toHaveBeenCalledWith(340, 12, 0.18);
    });

    fireEvent.click(scanner.querySelector('button.micro-close') as HTMLButtonElement);

    expect(oscillatorStop).toHaveBeenCalledTimes(1);
    expect(oscillatorDisconnect).toHaveBeenCalledTimes(1);
    expect(gainDisconnect).toHaveBeenCalledTimes(1);
    expect(contextClose).toHaveBeenCalledTimes(1);
  });

  it('keeps debug controls collapsed until the user expands them', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });

    setMediaDevices(getUserMedia);
    render(<App />);

    openGuidanceLayer();

    const scanner = await screen.findByLabelText('AR 引导层');
    expect(scanner.querySelector('.guidance-demo-panel')).toBeNull();

    fireEvent.click(scanner.querySelector('button.debug-toggle') as HTMLButtonElement);

    expect(scanner.querySelector('.guidance-demo-panel')).not.toBeNull();
    expect(scanner.querySelector('button.debug-toggle')).not.toBeNull();
  });

  it('loads stage game config and submits progress plus result when the mainline advances', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/health') {
        return {
          ok: true,
          json: async () => ({ status: 'ok' }),
        };
      }

      if (url === '/api/games/river-sound/config') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            gameId: 'river-sound',
            stageId: 'guiding',
            data: {
              title: 'River Sound',
              objective: 'Guide the signal to the next stage.',
              targetScore: 60,
              submitEndpoints: {
                progress: '/api/games/river-sound/progress',
                result: '/api/games/river-sound/result',
              },
              rewardPreview: [{ type: 'memory-fragment', amount: 1 }],
            },
            meta: {
              version: 'v1',
            },
          }),
        };
      }

      if (url === '/api/games/river-sound/progress') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              accepted: true,
              sessionId: 'session-guiding',
              completionRate: 0.5,
            },
          }),
        };
      }

      if (url === '/api/games/river-sound/result') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              passed: true,
              nextStageUnlocked: 'approaching',
              rewards: [{ type: 'memory-fragment', amount: 1 }],
            },
          }),
        };
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '继续主线' }));

    expect(await screen.findByText('River Sound')).toBeInTheDocument();
    expect(screen.getByText('Guide the signal to the next stage.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.primaryLabel }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/games/river-sound/progress',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/games/river-sound/result',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(await screen.findByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();
  });

  it('requests browser location and marks reachable map nodes', async () => {
    const getCurrentPosition = setGeolocation();
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '定位并刷新地图' }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('真实定位已连接')).toBeInTheDocument();
    expect(screen.getByTestId('map-node-shore-gate')).toHaveTextContent('可进入');
    expect(document.querySelector('.stage-strip')).toBeNull();
  });

  it('lets the user enter a node detail page and skip the optional task back to the map', async () => {
    setGeolocation();
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '定位并刷新地图' }));
    await screen.findByText('真实定位已连接');
    fireEvent.click(screen.getByRole('button', { name: '进入洲头渡口节点' }));

    expect(screen.getByRole('heading', { level: 1, name: '洲头渡口' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始节点任务' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '拍摄老码头' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '跳过此节点任务' }));

    expect(screen.getByRole('heading', { name: '橘洲节点地图' })).toBeInTheDocument();
    expect(screen.getByText('已跳过洲头渡口任务，主线可继续推进。')).toBeInTheDocument();
  });

  it('awards a postcard after three scene photos and shows it in the final settlement', async () => {
    setGeolocation();
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '定位并刷新地图' }));
    await screen.findByText('真实定位已连接');
    fireEvent.click(screen.getByRole('button', { name: '进入洲头渡口节点' }));
    fireEvent.click(screen.getByRole('button', { name: '开始节点任务' }));
    fireEvent.click(screen.getByRole('button', { name: '拍摄老码头' }));
    fireEvent.click(screen.getByRole('button', { name: '拍摄水纹' }));
    fireEvent.click(screen.getByRole('button', { name: '拍摄树影' }));

    expect(screen.getByText('已获得洲头渡口明信片')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回地图' }));

    fireEvent.click(screen.getByRole('button', { name: '继续主线' }));
    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.approaching.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.resonance.title)).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByRole('button', { name: '按住共鸣' }));

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
      await Promise.resolve();
    });

    vi.useRealTimers();
    fireEvent.click(await screen.findByRole('button', { name: JOURNEY_SCREENS.completion.primaryLabel }));
    fireEvent.click(await screen.findByRole('button', { name: JOURNEY_SCREENS.handoff.primaryLabel }));

    const settlement = await screen.findByLabelText('最终结算图');
    expect(settlement).toHaveTextContent('最终结算明信片');
    expect(settlement).toHaveTextContent('洲头渡口明信片');
    expect(settlement).toHaveTextContent('你把渡口的三处景物留在了回声里。');
    expect(screen.queryByLabelText('区域地图节点系统')).not.toBeInTheDocument();
  });

  it('opens the terminal from the bottom navigation and lets the player edit nickname', async () => {
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '终端' }));

    expect(screen.getByRole('heading', { name: '玩家终端' })).toBeInTheDocument();

    const nicknameInput = screen.getByLabelText('玩家昵称');
    fireEvent.change(nicknameInput, { target: { value: '橘洲收藏家' } });

    expect(screen.getByDisplayValue('橘洲收藏家')).toBeInTheDocument();
  });

  it('supports local avatar uploads inside the terminal', async () => {
    mockFileReader();
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '终端' }));

    const fileInput = screen.getByLabelText('上传本地头像');
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })],
      },
    });

    expect(await screen.findByAltText('玩家头像')).toHaveAttribute('src', 'data:image/png;base64,avatar');
  });

  it('resumes the current mainline stage after checking the map mid-journey', async () => {
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '继续主线' }));
    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '地图' }));
    expect(screen.getByRole('heading', { name: '橘洲节点地图' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '继续主线' }));
    expect(screen.getByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();
  });

  it('rejects oversized avatar uploads before persisting them', async () => {
    mockFileReader();
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '终端' }));

    const fileInput = screen.getByLabelText('上传本地头像');
    const oversizedFile = new File([new Uint8Array(3 * 1024 * 1024)], 'huge-avatar.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, {
      target: {
        files: [oversizedFile],
      },
    });

    expect(await screen.findByText('头像图片过大，请选择 2MB 以内的图片。')).toBeInTheDocument();
    expect(screen.queryByAltText('玩家头像')).not.toBeInTheDocument();
  });

  it('shows hybrid game and cultural achievements after postcard completion', async () => {
    setGeolocation();
    render(<App />);

    openHomeMenuStart();
    fireEvent.click(screen.getByRole('button', { name: '定位并刷新地图' }));
    await screen.findByText('真实定位已连接');
    fireEvent.click(screen.getByRole('button', { name: '进入洲头渡口节点' }));
    fireEvent.click(screen.getByRole('button', { name: '开始节点任务' }));
    fireEvent.click(screen.getByRole('button', { name: '拍摄老码头' }));
    fireEvent.click(screen.getByRole('button', { name: '拍摄水纹' }));
    fireEvent.click(screen.getByRole('button', { name: '拍摄树影' }));
    fireEvent.click(screen.getByRole('button', { name: '终端' }));

    expect(screen.getByText('第一张明信片')).toBeInTheDocument();
    expect(screen.getByText('江景采集者')).toBeInTheDocument();
    expect(screen.getByText('洲头渡口明信片')).toBeInTheDocument();
  });

  it('hides the bottom navigation while AR guidance is open', async () => {
    setMediaDevices();
    render(<App />);

    openGuidanceLayer();
    await screen.findByLabelText('AR 引导层');

    expect(screen.queryByLabelText('底部导航')).not.toBeInTheDocument();
  });
});


