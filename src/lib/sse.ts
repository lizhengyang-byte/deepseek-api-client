/**
 * SSE 增量解码器：服务端分块到达时可能切断行或事件，
 * 这里按空行（事件边界）切分，保证跨块内容正确拼接。
 */
export class SSEDecoder {
  private buffer = '';

  /** 推入一段原始文本，返回本次完整事件的 data 内容数组 */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const events: string[] = [];

    // 统一换行符，避免 \r\n 导致事件边界识别失败
    this.buffer = this.buffer.replace(/\r\n/g, '\n');

    let index = this.buffer.indexOf('\n\n');
    while (index !== -1) {
      const raw = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const data = raw
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) events.push(data);
      index = this.buffer.indexOf('\n\n');
    }
    return events;
  }

  /** 流结束时取出残留事件（有些服务端不补最后一个空行） */
  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = '';
    if (!rest) return [];
    const data = rest
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    return data ? [data] : [];
  }
}

export async function readSSE(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => boolean | void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const sse = new SSEDecoder();

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      const { value, done } = await reader.read();
      if (done) break;
      const events = sse.push(decoder.decode(value, { stream: true }));
      for (const event of events) {
        const stop = onData(event);
        if (stop === true) return;
      }
    }
    for (const event of sse.flush()) {
      const stop = onData(event);
      if (stop === true) return;
    }
  } finally {
    reader.releaseLock();
  }
}
