export type JourneyScreen =
  | 'entry'
  | 'guiding'
  | 'approaching'
  | 'resonance'
  | 'completion'
  | 'handoff'
  | 'finale';

export type JourneyAction = 'primary' | 'complete';

const TRANSITIONS: Record<JourneyScreen, Partial<Record<JourneyAction, JourneyScreen>>> = {
  entry: { primary: 'guiding' },
  guiding: { primary: 'approaching' },
  approaching: { primary: 'resonance' },
  resonance: { complete: 'completion' },
  completion: { primary: 'handoff' },
  handoff: { primary: 'finale' },
  finale: { primary: 'entry' },
};

export function getNextScreen(screen: JourneyScreen, action: JourneyAction): JourneyScreen {
  return TRANSITIONS[screen][action] ?? screen;
}
