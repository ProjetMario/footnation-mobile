import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { translationLanguage } from '../src/lib/postLanguage';

describe('discussion translation target contract', () => {
  it('offers exactly the base languages accepted by the translation function', () => {
    const source = readFileSync('../supabase/functions/translate/index.ts', 'utf8');
    const declaration = source.match(/const SUPPORTED_LANGUAGES\s*=\s*\[([\s\S]*?)\]/);
    expect(declaration).not.toBeNull();
    const accepted = [...declaration![1].matchAll(/'([A-Z]+)'/g)].map(match => match[1].toLowerCase());
    expect(accepted.length).toBeGreaterThan(20);
    for (let first = 97; first <= 122; first++) for (let second = 97; second <= 122; second++) {
      const target = String.fromCharCode(first, second);
      expect(translationLanguage(target)).toBe(accepted.includes(target) ? target : null);
    }
    for (const target of ['is', 'nn', 'sr', 'fo', 'az', 'mi', 'sw']) expect(translationLanguage(target)).toBeNull();
  });
  it('does not claim the simplified Chinese provider target covers traditional Chinese', () => {
    for (const target of ['zh-Hant', 'zh-Hant-TW', 'zh-TW', 'zh-HK', 'zh-MO']) expect(translationLanguage(target)).toBeNull();
    expect(translationLanguage('zh-CN')).toBe('zh');
  });
});
