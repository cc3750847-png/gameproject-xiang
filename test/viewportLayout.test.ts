import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8');
const tokensScss = readFileSync(join(process.cwd(), 'src/styles/tokens.scss'), 'utf-8');

describe('viewport layout styles', () => {
  it('locks the app viewport instead of allowing document-level scrollbars', () => {
    expect(indexCss).toMatch(/html,\s*body,\s*#root\s*{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  });

  it('keeps the journey panel scrollable without showing a visible scrollbar', () => {
    expect(tokensScss).toMatch(/\.journey-panel--fixed\s*{[^}]*overflow-y:\s*auto[^}]*scrollbar-width:\s*none/s);
    expect(tokensScss).toMatch(/\.journey-panel--fixed::-webkit-scrollbar\s*{[^}]*display:\s*none/s);
  });
});
