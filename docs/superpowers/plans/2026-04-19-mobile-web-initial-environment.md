# Mobile Web Initial Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-web-first front-end foundation for the Xiang River cultural tourism game so the team can prototype, test, and deploy quickly.

**Architecture:** Use a single Vite + React + TypeScript application at the project root, keep the Obsidian vault as a sibling folder, and isolate mobile UI scaffolding in focused files under `src/`. Capture technical decisions in the vault and keep tooling lightweight so later AR/navigation features can plug into stable app shells.

**Tech Stack:** Vite, React, TypeScript, Sass, Zustand, Vitest, Testing Library, ESLint, Prettier

---

### Task 1: Document the mobile-web-first stack and project conventions

**Files:**
- Create: `E:/CSU/社会设计/gameproject-xiang/xiang-river-obsidian-vault/22-技术栈与前期环境.md`
- Modify: `E:/CSU/社会设计/gameproject-xiang/xiang-river-obsidian-vault/00-首页.md`

- [ ] **Step 1: Add the stack decision note to the Obsidian vault**

Write the note with these sections:

```md
# 技术栈与前期环境

## 目标
- 优先手机 Web 端，方便快速部署与分享

## 技术栈
- 构建工具：Vite
- UI 框架：React + TypeScript
- 样式：Sass + CSS Variables
- 状态管理：Zustand
- 测试：Vitest + Testing Library
- 规范：ESLint + Prettier
```

- [ ] **Step 2: Link the new note from the vault home page**

Add:

```md
- [[22-技术栈与前期环境]]
```

to the index list in `00-首页.md`.

### Task 2: Initialize the base front-end project

**Files:**
- Create: `E:/CSU/社会设计/gameproject-xiang/package.json`
- Create: `E:/CSU/社会设计/gameproject-xiang/tsconfig.json`
- Create: `E:/CSU/社会设计/gameproject-xiang/tsconfig.app.json`
- Create: `E:/CSU/社会设计/gameproject-xiang/tsconfig.node.json`
- Create: `E:/CSU/社会设计/gameproject-xiang/vite.config.ts`
- Create: `E:/CSU/社会设计/gameproject-xiang/index.html`
- Create: `E:/CSU/社会设计/gameproject-xiang/.gitignore`

- [ ] **Step 1: Generate the Vite React TypeScript scaffold**

Run:

```bash
npm create vite@latest . -- --template react-ts
```

Expected: Vite writes the base app files into the project root.

- [ ] **Step 2: Add ignore rules for local caches and build output**

Ensure `.gitignore` contains:

```gitignore
node_modules/
dist/
.npm-cache/
coverage/
```

- [ ] **Step 3: Install the base dependencies**

Run:

```bash
npm install
npm install zustand sass
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom prettier
```

Expected: lockfile and dependencies are installed successfully.

### Task 3: Add a mobile-first app shell with TDD

**Files:**
- Create: `E:/CSU/社会设计/gameproject-xiang/src/features/app-shell/getPrimaryAction.ts`
- Create: `E:/CSU/社会设计/gameproject-xiang/src/features/app-shell/getPrimaryAction.test.ts`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/App.tsx`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/main.tsx`
- Modify: `E:/CSU/社会设计/gameproject-xiang/src/index.css`
- Create: `E:/CSU/社会设计/gameproject-xiang/src/styles/tokens.scss`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getPrimaryAction } from './getPrimaryAction';

describe('getPrimaryAction', () => {
  it('returns the CTA copy for the start state', () => {
    expect(getPrimaryAction('start')).toBe('开始寻乐');
  });

  it('returns the CTA copy for the guiding state', () => {
    expect(getPrimaryAction('guiding')).toBe('继续寻乐');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- getPrimaryAction
```

Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type AppShellState = 'start' | 'guiding';

const LABELS: Record<AppShellState, string> = {
  start: '开始寻乐',
  guiding: '继续寻乐',
};

export function getPrimaryAction(state: AppShellState) {
  return LABELS[state];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- getPrimaryAction
```

Expected: PASS.

- [ ] **Step 5: Implement the mobile shell UI**

Build a minimal app shell in `src/App.tsx` with:

```tsx
<main className="app-shell">
  <section className="hero-card">
    <p className="eyebrow">橘子洲文旅主线</p>
    <h1>湘江寻乐</h1>
    <p className="description">跟随一段旧日旋律，离开喧闹，走入湘江深处。</p>
    <div className="actions">
      <button type="button">{primaryAction}</button>
      <button type="button" className="secondary">查看流程</button>
    </div>
  </section>
</main>
```

and wire it to the helper.

### Task 4: Configure quality tools and scripts

**Files:**
- Modify: `E:/CSU/社会设计/gameproject-xiang/package.json`
- Create: `E:/CSU/社会设计/gameproject-xiang/vitest.config.ts`
- Create: `E:/CSU/社会设计/gameproject-xiang/src/test/setup.ts`
- Create: `E:/CSU/社会设计/gameproject-xiang/.prettierrc.json`

- [ ] **Step 1: Add scripts**

Ensure `package.json` includes:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

- [ ] **Step 2: Configure Vitest with jsdom**

Use:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 3: Add test setup**

```ts
import '@testing-library/jest-dom/vitest';
```

### Task 5: Verify and hand off

**Files:**
- Modify: `E:/CSU/社会设计/gameproject-xiang/xiang-river-obsidian-vault/22-技术栈与前期环境.md`

- [ ] **Step 1: Run the full verification set**

Run:

```bash
npm run test
npm run build
```

Expected: both commands pass successfully.

- [ ] **Step 2: Record verification results**

Append to the environment note:

```md
## 已完成初始化
- `npm run test` 通过
- `npm run build` 通过
```

## Self-Review

- Spec coverage: covers stack decision, scaffold, mobile shell, tooling, and verification.
- Placeholder scan: no TODO/TBD placeholders remain in executable steps.
- Type consistency: `AppShellState` and `getPrimaryAction` names are consistent across test and implementation.
