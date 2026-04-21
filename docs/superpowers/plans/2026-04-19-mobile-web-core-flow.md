# Mobile Web Core Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable mobile-web journey flow for Xiang River, covering entry, guidance, resonance, mini-game handoff, and finale states.

**Architecture:** Keep the first implementation lightweight by introducing a small pure transition function plus a single React-driven screen renderer. Use the transition helper as the TDD seam, then let `App.tsx` consume a screen configuration map so page copy and layout remain easy to expand. Preserve the existing mobile shell styling and grow it into a 7-screen guided prototype.

**Tech Stack:** React, TypeScript, Sass, Vitest, Testing Library

---

### Task 1: Add the journey transition model with TDD

**Files:**
- Create: `E:/CSU/社会设计/gameproject-xiang/src/features/journey/getNextScreen.test.ts`
- Create: `E:/CSU/社会设计/gameproject-xiang/src/features/journey/getNextScreen.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getNextScreen } from './getNextScreen';

describe('getNextScreen', () => {
  it('moves from entry to guiding on primary action', () => {
    expect(getNextScreen('entry', 'primary')).toBe('guiding');
  });

  it('moves from resonance to completion on complete action', () => {
    expect(getNextScreen('resonance', 'complete')).toBe('completion');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- getNextScreen
```

Expected: FAIL because `getNextScreen.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type JourneyScreen =
  | 'entry'
  | 'guiding'
  | 'approaching'
  | 'resonance'
  | 'completion'
  | 'handoff'
  | 'finale';

export type JourneyAction = 'primary' | 'complete';

const TRANSITIONS = {
  entry: { primary: 'guiding' },
  guiding: { primary: 'approaching' },
  approaching: { primary: 'resonance' },
  resonance: { complete: 'completion' },
  completion: { primary: 'handoff' },
  handoff: { primary: 'finale' },
  finale: { primary: 'entry' },
} as const;

export function getNextScreen(screen: JourneyScreen, action: JourneyAction): JourneyScreen {
  return TRANSITIONS[screen][action] ?? screen;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test -- getNextScreen
```

Expected: PASS.

### Task 2: Add the app flow integration test

**Files:**
- Create: `E:/CSU/社会设计/gameproject-xiang/src/App.test.tsx`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/test/setup.ts`

- [ ] **Step 1: Write the failing integration test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App core flow', () => {
  it('walks through the main journey screens', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '开始寻乐' }));
    expect(screen.getByText('洲上循音')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '前往下一处' }));
    expect(screen.getByText('洲影初醒')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '准备共鸣' }));
    expect(screen.getByText('与此地共鸣')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- App
```

Expected: FAIL because the current app does not render these states yet.

- [ ] **Step 3: Ensure jest-dom matchers are available**

`src/test/setup.ts` should contain:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Re-run the failing test**

Run:

```bash
npm run test -- App
```

Expected: still FAIL, now for missing UI behavior rather than matcher setup.

### Task 3: Implement the 7-screen mobile prototype

**Files:**
- Create: `E:/CSU/社会设计/gameproject-xiang/src/features/journey/screens.ts`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/App.tsx`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/styles/tokens.scss`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/index.css`

- [ ] **Step 1: Add the screen copy map**

Create a config object that defines:

```ts
title
eyebrow
description
primaryLabel
secondaryLabel
statusTag
```

for `entry`, `guiding`, `approaching`, `resonance`, `completion`, `handoff`, and `finale`.

- [ ] **Step 2: Render screens from state in `App.tsx`**

Implement:

```tsx
const [screen, setScreen] = useState<JourneyScreen>('entry');
const config = SCREENS[screen];
```

Then render screen-specific CTA buttons, a progress label, and a simplified stage indicator.

- [ ] **Step 3: Add resonance-specific complete action**

In the resonance state, use:

```tsx
<button type="button" onClick={() => setScreen(getNextScreen('resonance', 'complete'))}>
  完成共鸣
</button>
```

so the testable flow matches the intended interaction.

- [ ] **Step 4: Expand styles for a mobile storytelling card**

Add styles for:

```scss
.stage-strip
.status-pill
.journey-panel
.journey-actions
.journey-note
```

Keep the layout mobile-first and readable.

### Task 4: Verify the full flow and document it

**Files:**
- Modify: `E:/CSU/社会设计/gameproject-xiang/xiang-river-obsidian-vault/22-技术栈与前期环境.md`

- [ ] **Step 1: Run the full verification set**

Run:

```bash
npm run test
npm run build
npm run lint
```

Expected: all commands pass.

- [ ] **Step 2: Record that the core flow prototype is now in place**

Append:

```md
## 当前原型进度
- 已接入 7 个核心状态页的首版 React 原型
- 已可演示“开始寻乐 -> 接近节点 -> 共鸣 -> 进入小游戏衔接 -> 终章”
```

## Self-Review

- Spec coverage: covers state transitions, rendered flow, styling, and verification.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: `JourneyScreen`, `JourneyAction`, and `getNextScreen` are consistent across tasks.
