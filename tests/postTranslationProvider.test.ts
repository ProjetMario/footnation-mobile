import { describe, expect, it } from 'vitest';
import { TRANSLATION_LANGUAGES } from '../src/lib/postLanguage';
import { supportsCloudflareLanguage } from '../../supabase/functions/translate/cloudflare';

describe('manual discussion source language choices',()=>{
 it('only offers languages accepted by the configured Cloudflare model',()=>{
  expect(TRANSLATION_LANGUAGES.length).toBeGreaterThan(0);
  for(const code of TRANSLATION_LANGUAGES) expect(supportsCloudflareLanguage(code),code).toBe(true);
  expect(supportsCloudflareLanguage('auto')).toBe(false);
  expect(supportsCloudflareLanguage('fa')).toBe(false);
 });
});
