# Geolocated Map Node System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-location-backed map node system where users can enter marked nodes, optionally complete or skip photo tasks, earn a postcard, and see it in the final settlement screen.

**Architecture:** Keep map and task rules in pure functions under `src/features/map-nodes/`, then let `App.tsx` own browser geolocation, selected node, photo progress, postcard reward, and share actions. The visual map uses calibrated local coordinates and browser Geolocation now, leaving room for a full third-party map SDK later without changing the task model.

**Tech Stack:** React 19, TypeScript, Browser Geolocation API, Web Share API, Vitest, Testing Library, Sass

---

### Task 1: Add Map Node Domain Logic

**Files:**
- Create: `src/features/map-nodes/types.ts`
- Create: `src/features/map-nodes/mapNodes.ts`
- Create: `src/features/map-nodes/mapNodes.test.ts`

- [ ] **Step 1: Write failing tests**

Cover node distance derivation, nearest-node selection, optional task skip, photo progress, and postcard reward generation.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/features/map-nodes/mapNodes.test.ts`
Expected: fail because `mapNodes` module does not exist yet.

- [ ] **Step 3: Implement minimal pure functions**

Implement:
- `calculateDistanceMeters`
- `getMapNodesWithDistance`
- `getNearestReachableNode`
- `createInitialNodeTaskState`
- `recordPhotoCapture`
- `skipNodeTask`
- `createPostcardReward`

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/features/map-nodes/mapNodes.test.ts`
Expected: pass.

### Task 2: Wire Map Nodes Into The App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing App tests**

Cover map geolocation, node entry, optional skip, photo completion, postcard settlement display, and share fallback.

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- src/App.test.tsx`
Expected: fail because map node UI is not wired yet.

- [ ] **Step 3: Implement App state and UI**

Add geolocation request and fallback demo location, live node marker panel, selected node task panel, skip and photo capture actions, postcard reward state, final settlement postcard, and share button.

- [ ] **Step 4: Run tests and verify green**

Run: `npm test -- src/App.test.tsx`
Expected: pass.

### Task 3: Style And Verify The Experience

**Files:**
- Modify: `src/styles/tokens.scss`

- [ ] **Step 1: Add responsive styling**

Style the map card, location status, route surface, node markers, task panel, scene checklist, postcard, and share button so the mobile prototype remains readable.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/features/map-nodes/mapNodes.test.ts src/App.test.tsx`
Expected: pass.

- [ ] **Step 3: Run full verification**

Run: `npm test`
Run: `npm run build`
Expected: both exit successfully.
