import { describe, expect, it } from 'vitest';
import { SSEDecoder } from '../src/lib/sse';

describe('SSEDecoder', () => {
  it('按空行切分事件', () => {
    const decoder = new SSEDecoder();
    const events = decoder.push('data: {"a":1}\n\ndata: {"b":2}\n\n');
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('跨块断行时正确拼接', () => {
    const decoder = new SSEDecoder();
    const first = decoder.push('data: {"content":"你');
    expect(first).toEqual([]);
    const second = decoder.push('好"}\n\n');
    expect(second).toEqual(['{"content":"你好"}']);
  });

  it('兼容 \\r\\n 与多行 data', () => {
    const decoder = new SSEDecoder();
    const events = decoder.push('event: message\r\ndata: line1\r\ndata: line2\r\n\r\n');
    expect(events).toEqual(['line1\nline2']);
  });

  it('flush 取出残留事件', () => {
    const decoder = new SSEDecoder();
    decoder.push('data: tail');
    expect(decoder.flush()).toEqual(['tail']);
  });
});
