/**
 * The one LLM call SocialFlow makes: classify a DM reply into a follow-up intent (lib/followup-core.ts).
 *
 * Provider by environment, cheapest first: OPENAI_API_KEY (FOLLOWUP_LLM_MODEL, default gpt-4o-mini, JSON
 * mode), else ANTHROPIC_API_KEY (FOLLOWUP_LLM_MODEL, default claude-haiku-4-5). No key = not configured,
 * and the follow-up engine treats that like a low-confidence answer (fallback or no reply).
 * The output is only ever parsed for an intent id and a confidence; it is never sent to anyone.
 */
import type { ClassifierPrompt } from './followup-core';

const TIMEOUT_MS = 8000;

export function llmProvider(): 'openai' | 'anthropic' | null {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export async function classifyWithLlm(p: ClassifierPrompt): Promise<string> {
  const provider = llmProvider();
  if (!provider) throw new Error('llm_not_configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.FOLLOWUP_LLM_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
          response_format: { type: 'json_object' },
          max_tokens: 60,
          temperature: 0,
        }),
        signal: ctrl.signal,
        cache: 'no-store',
      });
      const data: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`openai ${res.status}: ${data?.error?.message || 'error'}`);
      return String(data?.choices?.[0]?.message?.content || '');
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': String(process.env.ANTHROPIC_API_KEY), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.FOLLOWUP_LLM_MODEL || 'claude-haiku-4-5',
        system: p.system,
        messages: [{ role: 'user', content: p.user }],
        max_tokens: 60,
        temperature: 0,
      }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${data?.error?.message || 'error'}`);
    return String((data?.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join(''));
  } finally {
    clearTimeout(timer);
  }
}
