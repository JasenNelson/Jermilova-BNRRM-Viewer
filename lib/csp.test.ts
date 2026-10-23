// The build-derived Content Security Policy (scripts/csp.mjs), proven on synthetic pages.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTRY_SHA256 as CHECK_ASSETS_REGISTRY_SHA256 } from '../scripts/check-assets.mjs';
import { HEADER_CSP, checkPage, expectedVercelConfig, injectCsp, inlineScriptHashes, metaCsp } from '../scripts/csp.mjs';
import { REGISTRY_SHA256 } from './verifiedFetch';

const hash = (text: string) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
const page = (body: string) => `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><link rel="stylesheet" href="/_next/static/css/a.css"/><script src="/_next/static/chunks/main.js" async=""></script></head><body>${body}</body></html>`;
const BOOT = '(self.__next_f=self.__next_f||[]).push([0])';
const PAYLOAD = 'self.__next_f.push([1,"0:{}"])';

describe('build-derived CSP', () => {
  it('hashes exactly the inline scripts and places the policy before every resource', () => {
    const html = injectCsp(page(`<div>x</div><script>${BOOT}</script><script>${PAYLOAD}</script>`));
    expect(inlineScriptHashes(html)).toEqual([hash(BOOT), hash(PAYLOAD)]);
    expect(html.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(html.indexOf('<link'));
    expect(html).toContain(`script-src 'self' '${hash(BOOT)}' '${hash(PAYLOAD)}';`);
    expect(checkPage(html)).toEqual([]);
  });

  it('never allows unsafe-inline or unsafe-eval for scripts', () => {
    const policy = metaCsp([hash(BOOT)]);
    const scriptSrc = policy.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(scriptSrc).toBe(`script-src 'self' '${hash(BOOT)}'`);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("worker-src 'none'");
    expect(HEADER_CSP).toContain("frame-ancestors 'none'");
    expect(HEADER_CSP).not.toContain('script-src');
  });

  it('fails a page whose scripts changed after the policy was written', () => {
    const html = injectCsp(page(`<script>${BOOT}</script>`)).replace(BOOT, `${BOOT};alert(1)`);
    expect(checkPage(html)).toContain('CSP meta policy does not equal the policy derived from this page');
  });

  it('fails a page with no policy, two policies, a late policy, event handlers or javascript: URLs', () => {
    expect(checkPage(page(`<script>${BOOT}</script>`))[0]).toMatch(/exactly one CSP meta tag/);
    const once = injectCsp(page(''));
    expect(() => injectCsp(once)).toThrow(/already has a CSP meta tag/);
    const meta = once.match(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/)![0];
    expect(checkPage(once.replace(meta, '') + meta)).toContain('CSP meta tag comes after a script, link or style');
    expect(checkPage(injectCsp(page('<img src="x" onerror="alert(1)">')))).toContain('inline event-handler attribute');
    expect(checkPage(injectCsp(page('<a href="javascript:alert(1)">x</a>')))).toContain('javascript: URL');
    // Ordinary text that merely contains "on...=" or "javascript:" is not markup.
    expect(checkPage(injectCsp(page('<p>once = twice; see javascript: docs</p>')))).toEqual([]);
  });

  it('vercel.json carries exactly the headers defined by the CSP module', () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8'));
    expect(vercel).toEqual(expectedVercelConfig());
    const all = vercel.headers.find((rule: { source: string }) => rule.source === '/(.*)').headers;
    const value = (key: string) => all.find((h: { key: string }) => h.key === key)?.value;
    expect(value('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(value('X-Frame-Options')).toBe('DENY');
    expect(value('X-Content-Type-Options')).toBe('nosniff');
  });

  it('pins the same registry bytes in the asset check and the runtime fetch guard', () => {
    expect(CHECK_ASSETS_REGISTRY_SHA256).toBe(REGISTRY_SHA256);
  });
});
