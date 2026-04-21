export type AppShellState = 'start' | 'guiding';

const LABELS: Record<AppShellState, string> = {
  start: '开始寻乐',
  guiding: '继续寻乐',
};

export function getPrimaryAction(state: AppShellState) {
  return LABELS[state];
}
