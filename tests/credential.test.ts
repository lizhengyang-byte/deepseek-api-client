import { describe, expect, it } from 'vitest';
import { credentialLabel, detectCredential, normalizeCredential } from '../src/lib/credential';
import { LinkImportError, validateLink } from '../src/lib/linkImport';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.abcdefghijklmnop';

describe('credential', () => {
  it('识别 sk- 开头的 API Key', () => {
    expect(detectCredential('sk-1234567890abcdef')).toBe('apikey');
  });

  it('识别 JWT 形态的网页令牌', () => {
    expect(detectCredential(JWT)).toBe('web');
  });

  it('识别超长非 JWT 的网页令牌', () => {
    expect(detectCredential('a'.repeat(48))).toBe('web');
  });

  it('空值与无法识别的值', () => {
    expect(detectCredential('')).toBe('empty');
    expect(detectCredential('hello world')).toBe('unknown');
  });

  it('清理 Bearer 前缀与引号', () => {
    expect(normalizeCredential('Authorization: Bearer sk-abc')).toBe('sk-abc');
    expect(normalizeCredential('"sk-abc"')).toBe('sk-abc');
    expect(normalizeCredential('  sk-abc  ')).toBe('sk-abc');
  });

  it('给出通道说明', () => {
    expect(credentialLabel('apikey')).toContain('API Key');
    expect(credentialLabel('web')).toContain('网页');
  });
});

describe('link import', () => {
  it('接受 http(s) 链接', () => {
    expect(validateLink('https://example.com/export.zip')).toBe('https://example.com/export.zip');
  });

  it('拒绝空值与非法协议', () => {
    expect(() => validateLink('')).toThrow(LinkImportError);
    expect(() => validateLink('ftp://example.com/a.zip')).toThrow(LinkImportError);
    expect(() => validateLink('not a url')).toThrow(LinkImportError);
  });
});
