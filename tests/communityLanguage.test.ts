import { expect, it } from 'vitest';
import { discussionLanguage } from '../src/lib/communityLanguage';

it('accepts language/script/region codes without accepting URLs, markup or unbounded data', () => {
  for (const tag of ['fr', 'tpi', 'sr-Latn', 'zh-Hant-TW', 'es-419']) expect(discussionLanguage(tag)).toBe(tag);
  expect(discussionLanguage('sr-latn')).toBe('sr-Latn');
  for (const value of ['https://evil.test', '<script>', 'x', 'abcdef', 'en&publish=1', null, ['fr']]) expect(discussionLanguage(value)).toBeNull();
});
