import { describe, expect, it } from 'vitest';
import { extractText, normalizeExport, normalizeRole, stableId } from '../src/lib/importer';

describe('importer', () => {
  it('解析 messages 数组结构', () => {
    const preview = normalizeExport({
      conversations: [
        {
          id: 'c1',
          title: '测试会话',
          messages: [
            { role: 'user', content: '你好' },
            { role: 'assistant', content: '你好，有什么可以帮你？' },
          ],
        },
      ],
    });
    expect(preview.conversations).toBe(1);
    expect(preview.messages).toBe(2);
    expect(preview.items[0].messages[1].role).toBe('assistant');
  });

  it('解析 chat_messages 结构并抽取对象内容', () => {
    const preview = normalizeExport([
      {
        id: 'c2',
        title: '对象内容',
        chat_messages: [
          { role: 'user', content: { text: '第一句' } },
          { role: 'assistant', content: [{ type: 'text', text: '第二句' }] },
        ],
      },
    ]);
    expect(preview.conversations).toBe(1);
    expect(preview.items[0].messages[0].content).toBe('第一句');
    expect(preview.items[0].messages[1].content).toBe('第二句');
  });

  it('mapping 树从叶子回溯出线性对话', () => {
    const preview = normalizeExport({
      data: [
        {
          id: 'c3',
          title: '树结构',
          mapping: {
            root: { id: 'root', parent: null, message: { role: 'system', content: '设定' } },
            u1: { id: 'u1', parent: 'root', message: { role: 'user', content: '问题' } },
            a1: { id: 'a1', parent: 'u1', message: { role: 'assistant', content: '回答' } },
          },
        },
      ],
    });
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].messages.map((m) => m.content)).toEqual(['设定', '问题', '回答']);
  });

  it('重复 id 去重', () => {
    const preview = normalizeExport([
      { id: 'dup', title: 'A', messages: [{ role: 'user', content: '1' }] },
      { id: 'dup', title: 'A', messages: [{ role: 'user', content: '1' }] },
    ]);
    expect(preview.conversations).toBe(1);
    expect(preview.skipped).toBe(1);
  });

  it('工具函数稳定', () => {
    expect(normalizeRole('HUMAN')).toBe('user');
    expect(normalizeRole('unknown')).toBeNull();
    expect(extractText({ parts: [{ text: 'a' }, { text: 'b' }] })).toBe('a\nb');
    expect(stableId('t', 1, 'm')).toBe(stableId('t', 1, 'm'));
  });
});
