/**
 * Unit tests for src/lib/claude.js
 *
 * Mocks fetchJson so no real HTTP calls are made.
 * Mocks getConfig via the global setup in tests/setup.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock http.js before importing claude.js
vi.mock('../../src/lib/http.js', () => ({
  fetchJson: vi.fn()
}));

import { hasClaudeKey, complete, chat, chatRaw } from '../../src/lib/claude.js';
import { fetchJson } from '../../src/lib/http.js';

// Minimal Anthropic-format response
const FAKE_RESPONSE = {
  content: [
    { type: 'text', text: 'Hello from Claude' }
  ],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 }
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchJson.mockResolvedValue(FAKE_RESPONSE);
});

// ── hasClaudeKey ──────────────────────────────────────────────────────────────

describe('hasClaudeKey', () => {
  it('returns true when a claude key is in config', () => {
    // setup.js mocks getConfig to always return a key
    expect(hasClaudeKey()).toBe(true);
  });
});

// ── chatRaw ───────────────────────────────────────────────────────────────────

describe('chatRaw', () => {
  it('throws when messages is empty', async () => {
    await expect(chatRaw({ messages: [] })).rejects.toThrow('messages array required');
  });

  it('throws when messages is not an array', async () => {
    await expect(chatRaw({ messages: 'hello' })).rejects.toThrow('messages array required');
  });

  it('calls fetchJson with the correct endpoint and body', async () => {
    const messages = [{ role: 'user', content: 'test' }];
    await chatRaw({ messages, system: 'sys', maxTokens: 512, temperature: 0.5 });

    expect(fetchJson).toHaveBeenCalledOnce();
    const [url, agent, opts] = fetchJson.mock.calls[0];
    expect(url).toBe('/api/claude/complete');
    expect(agent).toBe('Claude');
    expect(opts.apiKey).toBe('test-claude-key-abc123');
    expect(opts.body.messages).toEqual(messages);
    expect(opts.body.system).toBe('sys');
    expect(opts.body.maxTokens).toBe(512);
    expect(opts.body.temperature).toBe(0.5);
  });

  it('wraps system in cache_control array when cacheSystemPrompt is true', async () => {
    const messages = [{ role: 'user', content: 'hi' }];
    await chatRaw({ messages, system: 'My system prompt', cacheSystemPrompt: true });

    const [, , opts] = fetchJson.mock.calls[0];
    expect(opts.body.system).toEqual([
      { type: 'text', text: 'My system prompt', cache_control: { type: 'ephemeral' } }
    ]);
  });

  it('passes system as plain string when cacheSystemPrompt is false', async () => {
    const messages = [{ role: 'user', content: 'hi' }];
    await chatRaw({ messages, system: 'My system prompt', cacheSystemPrompt: false });

    const [, , opts] = fetchJson.mock.calls[0];
    expect(opts.body.system).toBe('My system prompt');
  });

  it('returns the raw Anthropic response object', async () => {
    const result = await chatRaw({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toEqual(FAKE_RESPONSE);
  });
});

// ── chat ──────────────────────────────────────────────────────────────────────

describe('chat', () => {
  it('returns extracted text string from the response', async () => {
    const result = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toBe('Hello from Claude');
  });

  it('joins multiple text blocks', async () => {
    fetchJson.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Part one. ' },
        { type: 'tool_use', id: 'x', input: {} },
        { type: 'text', text: 'Part two.' }
      ]
    });
    const result = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toBe('Part one. Part two.');
  });

  it('returns empty string when content is empty', async () => {
    fetchJson.mockResolvedValueOnce({ content: [] });
    const result = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toBe('');
  });

  it('ignores non-text blocks', async () => {
    fetchJson.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'x', input: {} }]
    });
    const result = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toBe('');
  });
});

// ── complete ──────────────────────────────────────────────────────────────────

describe('complete', () => {
  it('throws when prompt is not provided', async () => {
    await expect(complete({})).rejects.toThrow('prompt required');
  });

  it('wraps prompt in a user message and returns text', async () => {
    const result = await complete({ prompt: 'Say hello' });
    expect(result).toBe('Hello from Claude');

    const [, , opts] = fetchJson.mock.calls[0];
    expect(opts.body.messages).toEqual([{ role: 'user', content: 'Say hello' }]);
  });
});
