import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { JOURNEY_SCREENS } from './features/journey/screens';

function openGuidanceLayer() {
  fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.entry.primaryLabel }));
  fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.secondaryLabel ?? '' }));
}

function setMediaDevices(getUserMedia?: () => Promise<{ getTracks: () => Array<{ stop: () => void }> }>) {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
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
});

describe('App core flow', () => {
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

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.entry.primaryLabel }));
    expect(screen.getByText(JOURNEY_SCREENS.guiding.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.guiding.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.approaching.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.approaching.primaryLabel }));
    expect(await screen.findByText(JOURNEY_SCREENS.resonance.title)).toBeInTheDocument();
  });

  it('completes resonance after a sustained hold', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.entry.primaryLabel }));
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

    fireEvent.click(screen.getByRole('button', { name: JOURNEY_SCREENS.entry.primaryLabel }));

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
});


