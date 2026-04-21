# AR Guidance Demo Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a directly playable AR guidance prototype that demonstrates left/right particle flow, aligning, locked, and lost states using mock bearing data in the existing scanner overlay.

**Architecture:** Keep `App.tsx` as the journey coordinator, but move guidance math into pure functions under `src/features/guidance/`. The scanner overlay consumes derived guidance state plus a generated particle field so the UI can render a stable, testable demo without depending on real device sensors yet.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Sass

---

### Task 1: Add guidance state derivation as pure functions

**Files:**
- Create: `src/features/guidance/types.ts`
- Create: `src/features/guidance/deriveGuidanceState.ts`
- Create: `src/features/guidance/deriveGuidanceState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { deriveGuidanceState } from './deriveGuidanceState';

describe('deriveGuidanceState', () => {
  it('returns seeking-left when the target is clearly left of the viewer', () => {
    expect(deriveGuidanceState({ currentBearing: 40, targetBearing: 10, lastUpdateAt: 1000, now: 1000 }))
      .toMatchObject({ phase: 'seeking', direction: 'left' });
  });

  it('returns locked when the target is within the lock threshold', () => {
    expect(deriveGuidanceState({ currentBearing: 10, targetBearing: 12, lastUpdateAt: 1000, now: 1000 }))
      .toMatchObject({ phase: 'locked', direction: 'center' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/guidance/deriveGuidanceState.test.ts`
Expected: FAIL because `deriveGuidanceState` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
export function deriveGuidanceState(input: GuidanceInput): GuidanceStateResult {
  const deviation = normalizeSignedAngle(input.targetBearing - input.currentBearing);
  if (input.now - input.lastUpdateAt > 1600) return { phase: 'lost', direction: 'center', deviation };
  if (Math.abs(deviation) <= 6) return { phase: 'locked', direction: 'center', deviation };
  if (Math.abs(deviation) <= 18) return { phase: 'aligning', direction: deviation < 0 ? 'left' : 'right', deviation };
  return { phase: 'seeking', direction: deviation < 0 ? 'left' : 'right', deviation };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/guidance/deriveGuidanceState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/guidance/types.ts src/features/guidance/deriveGuidanceState.ts src/features/guidance/deriveGuidanceState.test.ts
git commit -m "feat: add guidance state derivation"
```

### Task 2: Generate a state-driven particle field

**Files:**
- Create: `src/features/guidance/deriveParticleField.ts`
- Create: `src/features/guidance/deriveParticleField.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { deriveParticleField } from './deriveParticleField';

describe('deriveParticleField', () => {
  it('biases particles toward the left edge while seeking left', () => {
    const particles = deriveParticleField({ phase: 'seeking', direction: 'left', deviation: -28 });
    expect(particles.every((particle) => particle.originX <= 40)).toBe(true);
  });

  it('converges particles toward the center while locked', () => {
    const particles = deriveParticleField({ phase: 'locked', direction: 'center', deviation: 0 });
    expect(particles.every((particle) => Math.abs(particle.targetX) <= 10)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/guidance/deriveParticleField.test.ts`
Expected: FAIL because `deriveParticleField` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
export function deriveParticleField(state: GuidanceStateResult): ParticleDescriptor[] {
  // Return deterministic descriptors tuned by phase/direction.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/guidance/deriveParticleField.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/guidance/deriveParticleField.ts src/features/guidance/deriveParticleField.test.ts
git commit -m "feat: add state-driven particle field"
```

### Task 3: Wire the scanner overlay to an interactive demo controller

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles/tokens.scss`

- [ ] **Step 1: Write the failing test**

```tsx
it('lets the user simulate direction changes inside the scanner overlay', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '开始寻乐' }));
  fireEvent.click(screen.getByRole('button', { name: '开启 AR 引导' }));

  expect(screen.getByText('请向左转动')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '模拟右转' }));
  expect(screen.getByText('请向右微调')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL because the scanner overlay has no guidance demo controls or direction copy

- [ ] **Step 3: Write minimal implementation**

```tsx
const [demoBearing, setDemoBearing] = useState(40);
const guidanceState = deriveGuidanceState({ currentBearing: demoBearing, targetBearing: 12, lastUpdateAt, now });
const particleField = deriveParticleField(guidanceState);
```

Add:
- a compact demo control bar in the scanner sheet
- direction/status copy tied to the derived guidance state
- particle rendering driven by `particleField`
- CSS classes/data attributes for `seeking`, `aligning`, `locked`, `lost`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/styles/tokens.scss
git commit -m "feat: add interactive AR guidance demo"
```

### Task 4: Verify and launch the local体验

**Files:**
- No code changes required unless verification finds issues

- [ ] **Step 1: Run the focused test suite**

Run: `npm test -- src/features/guidance/deriveGuidanceState.test.ts src/features/guidance/deriveParticleField.test.ts src/App.test.tsx`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with 0 failures

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: exit 0 and Vite build output

- [ ] **Step 4: Launch the dev server**

Run: `npm run dev -- --host 0.0.0.0 --port 5173`
Expected: local dev server starts so the user can open the page and try the demo

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: verify AR guidance demo experience"
```
