'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';

/**
 * /mcp: a plain-language explanation first (what it gives you, three steps,
 * three sentences to try), then the per-assistant setup, and only then the
 * technical part (keys, server address, tool list) folded away. A first-timer
 * asked "so MCP means connecting it to Grok?" (Tolik, 26.9.2026): the page
 * opened with a wall of protocol text, so it now opens with the outcome.
 */

interface KeyRow { key: string; masked: string; label: string; created_at: string; last_used_at: string | null }
const TOOL_NAMES = ['list_pages', 'list_posts', 'list_automations', 'create_automation', 'update_automation', 'delete_automation', 'get_activity', 'get_report'] as const;

export default function McpScreen() {
  const { m, t, dateTime, locale } = useI18n();
  const M = m.mcp;
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<'claude-code' | 'claude-ai' | 'chatgpt' | 'cursor'>('claude-ai');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://isocialflow.com';

  const showToast = (x: string) => { setToast(x); setTimeout(() => setToast(null), 2600); };
  const load = async () => { setLoading(true); try { const d = await fetch('/api/mcp-keys').then((r) => r.json()); setKeys(d.keys || []); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const mint = async () => {
    setBusy(true);
    try { const d = await fetch('/api/mcp-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'MCP', locale }) }).then((r) => r.json()); if (d.key) { setFresh(d.key); await load(); showToast(M.keyCreated); } }
    finally { setBusy(false); }
  };
  const revoke = async (k: string) => {
    if (!confirm(M.revokeConfirm)) return;
    await fetch(`/api/mcp-keys?key=${encodeURIComponent(k)}`, { method: 'DELETE' });
    if (fresh === k) setFresh(null);
    await load(); showToast(M.revoked);
  };
  const copy = async (x: string, what = m.common.copied) => { try { await navigator.clipboard.writeText(x); showToast(what); } catch { showToast(M.copyFailed); } };

  const key = fresh || keys[0]?.key || '<KEY>';
  const url = `${origin}/api/mcp`;
  const urlWithKey = `${origin}/api/mcp/${key}`;
  const claudeCodeCmd = `claude mcp add --transport http socialflow ${url} --header "Authorization: Bearer ${key}"`;
  const cursorJson = `{\n  "mcpServers": {\n    "socialflow": {\n      "url": "${url}",\n      "headers": { "Authorization": "Bearer ${key}" }\n    }\n  }\n}`;

  return (
    <>
      <div className="sfa-head">
        <div><div className="sfa-h">{M.title}</div><p>{M.sub}</p></div>
      </div>

      <div className="sfa-card sfa-mcp-intro">
        <h2>{M.introTitle}</h2>
        <p className="sfa-p">{M.introText}</p>
        <div className="sfa-eyebrow" style={{ marginTop: 16 }}>{M.introStepsTitle}</div>
        <ol className="sfa-mcp-steps">
          <li>{M.introStep1}</li>
          <li>{M.introStep2}</li>
          <li>{M.introStep3}</li>
        </ol>
        <div className="sfa-eyebrow" style={{ marginTop: 16 }}>{M.introTryTitle}</div>
        <ul className="sfa-mcp-try">{[M.introTry1, M.introTry2, M.introTry3].map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="sfa-sub" style={{ marginTop: 14 }}>{M.introOther}</p>
        <p className="sfa-sub" style={{ marginTop: 6 }}>{M.introNoAssistant}</p>
      </div>

      <div className="sfa-card" style={{ marginTop: 16 }}>
        <div className="sfa-eyebrow">{M.howTitle}</div>
        <div className="sfa-tabs">
          {([['claude-ai', 'Claude.ai'], ['chatgpt', 'ChatGPT'], ['claude-code', 'Claude Code'], ['cursor', M.tabOther]] as const).map(([id, label]) => (
            <button type="button" key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'claude-code' && (
          <div className="sfa-howto">
            <ol><li>{M.cc1}</li></ol>
            <pre dir="ltr"><code>{claudeCodeCmd}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(claudeCodeCmd, M.cmdCopied)}>{M.copyCmd}</button>
            <ol start={2}><li>{M.cc2}</li></ol>
          </div>
        )}
        {tab === 'claude-ai' && (
          <div className="sfa-howto">
            <ol><li>{M.cai1}</li><li>{M.cai2}</li></ol>
            <pre dir="ltr"><code>{url}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(url, M.urlCopied)}>{M.copyUrl}</button>
            <ol start={3}><li>{M.cai3}</li></ol>
          </div>
        )}
        {tab === 'chatgpt' && (
          <div className="sfa-howto">
            <ol><li>{M.gpt1}</li><li>{M.gpt2}</li></ol>
            <pre dir="ltr"><code>{url}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(url, M.urlCopied)}>{M.copyUrl}</button>
            <ol start={3}><li>{M.gpt3}</li><li>{M.gpt4} <code dir="ltr">{urlWithKey}</code></li></ol>
          </div>
        )}
        {tab === 'cursor' && (
          <div className="sfa-howto">
            <ol><li>{M.cur1}</li></ol>
            <pre dir="ltr"><code>{cursorJson}</code></pre>
            <button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(cursorJson, M.configCopied)}>{M.copyConfig}</button>
            <ol start={2}><li>{M.cur2}</li></ol>
          </div>
        )}
      </div>

      <details className="sfa-mcp-tech" style={{ marginTop: 16 }}>
        <summary>{M.techTitle}</summary>
      <div className="sfa-mcp-grid" style={{ marginTop: 14 }}>
        <div className="sfa-card">
          <div className="sfa-eyebrow">{M.whatTitle}</div>
          <p className="sfa-p">{M.what1}</p>
          <p className="sfa-p">{M.what2}</p>
          <div className="sfa-eyebrow" style={{ marginTop: 18 }}>{M.toolsTitle}</div>
          <ul className="sfa-tools">{TOOL_NAMES.map((n) => <li key={n}><code>{n}</code><span>{M.tools[n]}</span></li>)}</ul>
        </div>

        <div className="sfa-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div className="sfa-eyebrow">{M.yourKeys}</div>
            <button type="button" className="sfa-btn sfa-btn-primary sfa-btn-sm" onClick={mint} disabled={busy}>{busy ? M.creating : M.newKey}</button>
          </div>
          {fresh && (
            <div className="sfa-keybox">
              <div className="sfa-sub">{M.freshNote}</div>
              <div className="sfa-keyrow"><code dir="ltr">{fresh}</code><button type="button" className="sfa-btn sfa-btn-cyan sfa-btn-sm" onClick={() => copy(fresh, M.keyCopied)}>{m.common.copy}</button></div>
            </div>
          )}
          {loading ? <div className="sfa-loading"><span className="sfa-spinner" />{m.common.loading}</div> : keys.length === 0 ? (
            <div className="sfa-sub">{M.noKeys}</div>
          ) : (
            <div className="sfa-stack" style={{ gap: 8 }}>
              {keys.map((k) => (
                <div key={k.key} className="sfa-keyrow">
                  <code dir="ltr">{k.masked}</code>
                  <span className="sfa-sub">{k.last_used_at ? t(M.lastUsed, { when: dateTime(k.last_used_at) }) : M.neverUsed}</span>
                  {k.label && <span className="sfa-tag sfa-tag-unsent">{k.label}</span>}
                  <button type="button" className="sfa-btn sfa-btn-danger sfa-btn-sm" onClick={() => revoke(k.key)}>{M.revoke}</button>
                </div>
              ))}
            </div>
          )}
          <div className="sfa-eyebrow" style={{ marginTop: 18 }}>{M.serverUrl}</div>
          <div className="sfa-keyrow"><code dir="ltr">{url}</code><button type="button" className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={() => copy(url, M.urlCopied)}>{m.common.copy}</button></div>
        </div>
      </div>

        <div className="sfa-eyebrow" style={{ marginTop: 20 }}>{M.examplesTitle}</div>
        <ul className="sfa-examples">{M.examples.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>

      {toast && <div className="sfa-toast">{toast}</div>}
    </>
  );
}
