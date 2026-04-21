export function getHoldState(holdMs: number, targetMs: number) {
  if (targetMs <= 0) {
    return { done: true, progress: 1 };
  }

  const progress = Math.max(0, Math.min(holdMs / targetMs, 1));

  return {
    done: progress >= 1,
    progress,
  };
}
