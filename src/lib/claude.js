/**
 * Claude LLM client — thin wrapper around the /api/claude/complete proxy.
 *
 * BYOK: reads the user's Claude key from config and forwards it via the
 * standard X-Brovis-Key header. Widgets never touch the key directly.
 *
 * Two entry points are provided:
 *   complete({ prompt, system, ... })   — single-turn convenience
 *   chat({ messages, system, ... })     — multi-turn (pass your own history)
 *
 * Both return the extracted text string. If the caller needs the raw
 * Anthropic response object (tool_use, stop_reason, usage, etc.), use
 * `chatRaw` instead.
 *
 * Designed so future widgets (VIP email triage, recipe generation, task
 * prioritization, morning briefing synthesis) can share one code path.
 */
import { fetchJson } from './http.js';
import { getConfig } from './config.js';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Is there a Claude key configured? Widgets that rely on LLM calls should
 * gate themselves on this before attempting a request.
 */
export function hasClaudeKey() {
  return Boolean(getConfig().keys?.claude);
}

/**
 * Single-turn completion. Returns the assistant's text reply as a string.
 *
 * @param {object} opts
 * @param {string} opts.prompt              — the user message
 * @param {string} [opts.system]            — optional system prompt
 * @param {string} [opts.model]             — model id (defaults to Haiku 4.5)
 * @param {number} [opts.maxTokens]         — max output tokens
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.cacheSystemPrompt] — enable prompt caching for system prompt
 */
export async function complete({ prompt, system, model, maxTokens, temperature, cacheSystemPrompt } = {}) {
  if (!prompt) throw new Error('Claude: prompt required');
  return chat({
    messages: [{ role: 'user', content: prompt }],
    system,
    model,
    maxTokens,
    temperature,
    cacheSystemPrompt
  });
}

/**
 * Multi-turn completion. Returns the assistant's text reply as a string.
 * Caller owns the message history.
 *
 * @param {object} opts
 * @param {Array} opts.messages         — message history
 * @param {string} [opts.system]        — system prompt
 * @param {string} [opts.model]         — model id
 * @param {number} [opts.maxTokens]     — max output tokens
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.cacheSystemPrompt] — enable prompt caching for system prompt
 */
export async function chat(opts) {
  const raw = await chatRaw(opts);
  return extractText(raw);
}

/**
 * Low-level call that returns the full Anthropic response object.
 * Use when you need stop_reason, usage, or tool_use blocks.
 *
 * @param {object} opts
 * @param {Array} opts.messages                 — message history
 * @param {string} [opts.system]                — system prompt
 * @param {string} [opts.model]                 — model id (defaults to Haiku)
 * @param {number} [opts.maxTokens]             — max output tokens
 * @param {number} [opts.temperature]
 * @param {boolean} [opts.cacheSystemPrompt]    — enable prompt caching (90% token savings for 5m)
 */
export async function chatRaw({ messages, system, model = DEFAULT_MODEL, maxTokens = 1024, temperature = 0.7, cacheSystemPrompt = false } = {}) {
  const apiKey = getConfig().keys?.claude;
  if (!apiKey) throw new Error('Claude: API key not configured. Add it in CONFIG.');
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Claude: messages array required');
  }

  // Build system parameter with optional cache_control for ephemeral caching
  let systemParam = system;
  if (system && cacheSystemPrompt) {
    systemParam = [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  return fetchJson('/api/claude/complete', 'Claude', {
    apiKey,
    body: { messages, system: systemParam, model, maxTokens, temperature }
  });
}

/**
 * Pull the text out of an Anthropic messages-API response.
 * Concatenates all text blocks; ignores tool_use blocks.
 */
function extractText(response) {
  const blocks = response?.content || [];
  return blocks
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();
}
