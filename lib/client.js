/*! @mikulo/dsh-translator v1.0.0 | MIT | generated from src/client.js by scripts/build.mjs — edit src/, not lib/ */
/**
 * dsh-translator — Browser half (plain module-loader artifact, no build).
 *
 * 1. Settings → "回复翻译" section: translation model (the models configured
 *    under Settings → Models, fetched live from the Host), reasoning effort
 *    (off by default; low / medium / high), target language (the ten most
 *    spoken languages, Chinese by default), prompt template with `{{target}}`
 *    and `{{text}}`, timeout, a button filter and a "测试翻译" probe.
 * 2. A translate bar under every settled assistant text segment (never the
 *    reasoning / chain of thought). The bar sits right-aligned in normal
 *    document flow directly below the segment; the translation appears below
 *    it, so nothing overlaps the original text. A second button, 「替换原文」,
 *    shows the translation in place of the original instead: the original
 *    block is only hidden visually, the session (and so the conversation
 *    context the model sees) keeps the original text. Errors (timeout,
 *    missing model, provider failure…) show in red next to the buttons.
 *
 * How the segments are found: DSH has no per-segment slot (the
 * `conversation.chat.assistant-actions` slot exists once per finished turn),
 * so a MutationObserver scans `[data-chat-flow-kind="assistant-step"]` rows
 * for their Markdown blocks, inserts one plugin-owned container after each
 * settled block, and a single `shell.overlay` component portals the React UI
 * into those containers. The block's exact Markdown source is read from the
 * React props of DSH's `MarkdownText`; when that is unavailable the rendered
 * text is used instead. Translation state lives outside the chat rows, so
 * it survives the transcript's virtualized remounts (and page reloads, via a
 * small localStorage cache).
 */
window.__ModuleLoader__.load({
  id: '@mikulo/dsh-translator',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    let ReactDOM
    try {
      ReactDOM = require('react-dom')
    } catch {
      /* without portals only the settings page is installed */
    }
    let primitives = {}
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    } catch {
      /* fall back to native controls below */
    }

    /** Package version, stamped by scripts/build.mjs (shown on the settings page). */
    const VERSION = '1.0.0'
    const NS = 'dsh-translator'
    const API = '/api/dsh-translator'
    const SECTION_ID = 'translator'
    /** Must equal HOST_PROTOCOL in index.js; a mismatch means `dsh web` still runs an older Host half. */
    const HOST_PROTOCOL = 1
    /** Class of the plugin-owned container inserted after each segment. */
    const HOST_CLASS = 'dshtr-host'
    /** localStorage key of the finished-translation cache. */
    const CACHE_KEY = 'dsh-translator.cache.v1'
    const CACHE_LIMIT = 200
    /** Extra client-side grace on top of the Host timeout (network, queueing). */
    const CLIENT_GRACE_MS = 15_000
    const EFFORT_LADDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max']

    const zh = {
      nav: '回复翻译',
      title: '回复翻译',
      intro: '在对话中，AI 输出的每段回复（不含思维链）右下方会出现「翻译」按钮，点击后在原文下方显示译文。这里设置翻译使用的模型、思考强度、目标语言和提示词。',
      modelGroup: '翻译模型',
      modelLabel: '模型',
      modelHint: '列表与 设置 → 模型 中已配置的模型同步；在那里增删模型后点「刷新」。',
      modelDefault: '跟随 DSH 默认模型{name}',
      modelMissing: '（已不存在）{name}',
      modelMissingWarn: '当前选择的模型 {name} 已不在已配置的模型列表中，翻译会失败，请重新选择。',
      modelFailures: '以下提供商的模型列表读取失败：{list}',
      noModels: '没有读取到已配置的模型，请先在 设置 → 模型 中配置。',
      refresh: '刷新',
      refreshing: '刷新中…',
      effortLabel: '思考强度',
      effortOff: '关闭（默认）',
      effortLow: 'low',
      effortMedium: 'medium',
      effortHigh: 'high',
      effortHintOffered: '该模型支持的思考强度：{list}。',
      effortHintMapped: '所选强度不受支持，将使用最接近的「{effort}」。',
      effortHintNone: '该模型没有可选的思考强度，将使用模型默认行为。',
      targetLabel: '翻译成',
      promptGroup: '翻译提示词',
      promptHint: '占位符：{{target}} 替换为目标语言，{{text}} 替换为原文；没有 {{text}} 时原文附加在提示词末尾。留空保存即恢复默认。',
      promptSave: '保存提示词',
      promptReset: '恢复默认',
      promptDirty: '提示词有未保存的修改',
      otherGroup: '其他',
      timeoutLabel: '超时（秒）',
      timeoutHint: '模型在此时间内没有完成翻译即视为超时（{min}–{max} 秒）。',
      englishOnlyTitle: '只在包含英文的段落显示翻译按钮',
      englishOnlyDesc: '关闭后，所有 AI 回复段落都显示翻译按钮。',
      testGroup: '测试',
      testPlaceholder: '输入一段要测试翻译的文本',
      testSample: 'Hello! This is a quick test of the reply translator.',
      testRun: '测试翻译',
      testRunning: '翻译中…',
      saved: '已保存',
      saving: '保存中…',
      loading: '加载中…',
      hostOutdated: '插件的服务端仍是旧版本或未加载：安装/更新插件后需要重启 dsh web（停止后重新运行 dsh web），然后刷新页面。',
      // segment bar
      translate: '翻译',
      translating: '翻译中…',
      cancelTitle: '点击取消翻译',
      hide: '隐藏译文',
      show: '显示译文',
      retry: '重试',
      retranslate: '重新翻译',
      replace: '替换原文',
      replaceTitle: '在原处用译文替换显示原文（仅改变显示，对话上下文仍是原文）',
      showOriginal: '显示原文',
      showOriginalTitle: '恢复显示原文',
      replacedNote: '已替换为译文',
      errorPrefix: '翻译失败：',
      clientTimeout: '翻译超时：{sec} 秒内没有收到服务端响应。',
      network: '无法连接 dsh web：{message}',
      truncated: '译文可能因长度上限被截断。',
      metaLine: '译文 · {lang} · {model}{effort}',
      metaEffort: ' · 思考 {effort}',
      copy: '复制',
      copied: '已复制',
      footnotes: '脚注',
    }
    const en = {
      nav: 'Reply translation',
      title: 'Reply translation',
      intro: 'In a conversation, every AI reply segment (not the chain of thought) gets a "Translate" button at its lower right; the translation appears below the original. Configure the model, reasoning effort, target language and prompt here.',
      modelGroup: 'Translation model',
      modelLabel: 'Model',
      modelHint: 'Synced with the models configured under Settings → Models; click Refresh after changing them there.',
      modelDefault: 'Follow the DSH default model{name}',
      modelMissing: '(missing) {name}',
      modelMissingWarn: 'The selected model {name} is no longer configured; translations will fail. Please choose another one.',
      modelFailures: 'Could not list the models of: {list}',
      noModels: 'No configured models found. Configure one under Settings → Models first.',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      effortLabel: 'Reasoning effort',
      effortOff: 'Off (default)',
      effortLow: 'low',
      effortMedium: 'medium',
      effortHigh: 'high',
      effortHintOffered: 'Efforts this model supports: {list}.',
      effortHintMapped: 'The selected effort is not supported; the closest, "{effort}", will be used.',
      effortHintNone: 'This model exposes no reasoning effort; its default behavior is used.',
      targetLabel: 'Translate into',
      promptGroup: 'Translation prompt',
      promptHint: 'Placeholders: {{target}} becomes the target language, {{text}} the original text; without {{text}} the text is appended. Save it empty to restore the default.',
      promptSave: 'Save prompt',
      promptReset: 'Restore default',
      promptDirty: 'The prompt has unsaved changes',
      otherGroup: 'Other',
      timeoutLabel: 'Timeout (seconds)',
      timeoutHint: 'A translation not finished within this time fails as a timeout ({min}–{max} s).',
      englishOnlyTitle: 'Show the button only on segments containing English',
      englishOnlyDesc: 'When off, every AI reply segment gets a Translate button.',
      testGroup: 'Test',
      testPlaceholder: 'Text to test the translation with',
      testSample: 'Hello! This is a quick test of the reply translator.',
      testRun: 'Test translation',
      testRunning: 'Translating…',
      saved: 'Saved',
      saving: 'Saving…',
      loading: 'Loading…',
      hostOutdated: 'The plugin\'s server half is outdated or not loaded: restart dsh web after installing/updating the plugin, then reload the page.',
      translate: 'Translate',
      translating: 'Translating…',
      cancelTitle: 'Click to cancel',
      hide: 'Hide translation',
      show: 'Show translation',
      retry: 'Retry',
      retranslate: 'Translate again',
      replace: 'Replace original',
      replaceTitle: 'Show the translation in place of the original (display only; the conversation context keeps the original)',
      showOriginal: 'Show original',
      showOriginalTitle: 'Show the original text again',
      replacedNote: 'Showing translation',
      errorPrefix: 'Translation failed: ',
      clientTimeout: 'Timed out: no response from the server within {sec} s.',
      network: 'Cannot reach dsh web: {message}',
      truncated: 'The translation may be truncated by the output limit.',
      metaLine: 'Translation · {lang} · {model}{effort}',
      metaEffort: ' · effort {effort}',
      copy: 'Copy',
      copied: 'Copied',
      footnotes: 'Footnotes',
    }

    /** Locale-bound text lookup, rebound in `apply`. */
    let text = (key) => zh[key] ?? key

    // ─────────────────────────────────────────────── Host calls

    /**
     * Call one Host route.
     * @param path - route under the API prefix.
     * @param body - JSON body (POST) or undefined (GET).
     * @param signal - optional cancellation.
     */
    async function call(path, body, signal) {
      let response
      try {
        response = await fetch(`${API}/${path}`, body === undefined
          ? { method: 'GET', cache: 'no-store', signal }
          : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal })
      } catch (error) {
        if (signal?.aborted) throw error
        throw new Error(text('network').replace('{message}', error?.message ?? String(error)))
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }
      // Our routes answer 404 only with a `model-missing` code. Any other 404
      // (no route) or 401 (the web shell's authenticated fallback) means the
      // running Host half lacks the route — `dsh web` was not restarted.
      if ((response.status === 404 && payload?.code !== 'model-missing') || response.status === 401) {
        throw Object.assign(new Error(text('hostOutdated')), { status: response.status, code: 'host-outdated' })
      }
      if (payload === undefined) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status })
      if (!response.ok) throw Object.assign(new Error(payload?.error ?? `HTTP ${response.status}`), { status: response.status, payload })
      return payload
    }

    // ─────────────────────────────────────────────── shared settings mirror

    /** Last settings the Host reported (drives the button filter and client timeout). */
    const shared = { settings: undefined, loading: undefined, listeners: new Set() }
    function setShared(settings) {
      const before = shared.settings
      shared.settings = settings
      if (before?.englishOnly !== settings?.englishOnly) {
        for (const listener of [...shared.listeners]) {
          try { listener() } catch (error) { console.error('[dsh-translator] settings listener failed:', error) }
        }
      }
    }
    function loadShared() {
      shared.loading ??= call('settings').then(
        (value) => {
          if (value?.settings) setShared(value.settings)
          for (const l of value?.languages ?? []) languageLabels.set(l.code, l.label)
        },
        () => {},
      ).finally(() => { shared.loading = undefined })
      return shared.loading
    }

    /** Language label for a target code (from the Host list). */
    const languageLabels = new Map()

    // ─────────────────────────────────────────────── text helpers

    /** Stable short key for a segment text (two 32-bit hashes + length). */
    function segmentKey(source) {
      let a = 0x811c9dc5
      let b = 0x5bd1e995
      for (let i = 0; i < source.length; i++) {
        const c = source.charCodeAt(i)
        a = Math.imul(a ^ c, 0x01000193)
        b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 13)
      }
      return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}${source.length.toString(36)}`
    }

    /**
     * Whether a segment is worth a Translate button under "English only":
     * at least three English words outside code, and Latin letters clearly
     * outweighing CJK characters (a Chinese reply quoting a few English terms
     * does not count).
     */
    function looksEnglish(source) {
      const prose = String(source)
        .replace(/```[\s\S]*?(```|$)/g, ' ')
        .replace(/~~~[\s\S]*?(~~~|$)/g, ' ')
        .replace(/`[^`\n]*`/g, ' ')
        .replace(/\]\([^)]*\)/g, ']')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/(?:[A-Za-z]:)?[\\/][\w.\-\\/]+/g, ' ')
      const words = (prose.match(/[A-Za-z]{2,}/g) || []).length
      const latin = (prose.match(/[A-Za-z]/g) || []).length
      const cjk = (prose.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g) || []).length
      return words >= 3 && latin >= cjk * 3
    }

    /** Same mapping as the Host's `mapEffort` (for the settings hint only). */
    function mapEffort(requested, offered) {
      if (!Array.isArray(offered) || offered.length === 0) return { effort: undefined, note: requested === 'off' ? undefined : 'unsupported' }
      if (offered.includes(requested)) return { effort: requested }
      if (requested === 'off') return { effort: EFFORT_LADDER.find(l => offered.includes(l)) ?? offered[0], note: 'mapped' }
      const want = EFFORT_LADDER.indexOf(requested)
      let best
      let bestDistance = Infinity
      for (const id of offered) {
        const at = EFFORT_LADDER.indexOf(id)
        if (at < 0) continue
        const distance = Math.abs(at - want)
        if (distance < bestDistance || (distance === bestDistance && at > EFFORT_LADDER.indexOf(best))) {
          best = id
          bestDistance = distance
        }
      }
      return best === undefined ? { effort: undefined, note: 'unsupported' } : { effort: best, note: 'mapped' }
    }

    // ─────────────────────────────────────────────── translation store

    /**
     * One segment's translation state.
     * - `view`: what is shown — 'none' (original only), 'below' (original +
     *   translation underneath) or 'replace' (translation shown in place of the
     *   original). Display only: nothing is ever written to the session, so
     *   the conversation context the model sees keeps the original text.
     * - `pending`: the view the running request will switch to.
     * - `failed`: the view whose request failed (its button shows 重试).
     */
    const VIEWS = ['none', 'below', 'replace']
    const IDLE = Object.freeze({ status: 'idle', translation: '', error: '', view: 'none', pending: null, failed: null, meta: null, controller: null })
    /** segment key -> entry */
    const entries = new Map()
    /** segment key -> Set<listener> */
    const entryListeners = new Map()
    /** Listeners for every entry change: `(entry, key)` (the scanner applies the view). */
    const entryWatchers = new Set()
    let cacheLoaded = false

    function storage() {
      try {
        return globalThis.localStorage
      } catch {
        return undefined
      }
    }

    function loadCache() {
      if (cacheLoaded) return
      cacheLoaded = true
      try {
        const raw = JSON.parse(storage()?.getItem(CACHE_KEY) ?? 'null')
        if (!raw || typeof raw !== 'object') return
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value?.translation !== 'string' || value.translation === '' || entries.has(key)) continue
          // 1.0.0 stored `open` (true = shown below).
          const view = VIEWS.includes(value.view) ? value.view : value.open === false ? 'none' : 'below'
          entries.set(key, { ...IDLE, status: 'done', translation: value.translation, view, meta: value.meta ?? null })
        }
      } catch { /* storage unavailable or corrupt: start empty */ }
    }

    let persistTimer
    function persistCache() {
      clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        try {
          const done = [...entries.entries()].filter(([, e]) => e.translation !== '')
          const out = {}
          for (const [key, e] of done.slice(-CACHE_LIMIT)) out[key] = { translation: e.translation, view: e.view, meta: e.meta }
          storage()?.setItem(CACHE_KEY, JSON.stringify(out))
        } catch { /* quota or privacy mode: the cache is best-effort */ }
      }, 300)
    }

    function getEntry(key) {
      loadCache()
      return entries.get(key) ?? IDLE
    }
    function setEntry(key, patch) {
      const previous = getEntry(key)
      const next = { ...previous, ...patch }
      // Re-insert at the end so the persisted cache keeps the most recent entries.
      entries.delete(key)
      entries.set(key, next)
      for (const listener of [...(entryListeners.get(key) ?? []), ...entryWatchers]) {
        try { listener(next, key) } catch (error) { console.error('[dsh-translator] entry listener failed:', error) }
      }
      if (next.translation !== previous.translation || next.view !== previous.view) persistCache()
    }
    function useEntry(key) {
      const [entry, setState] = useState(() => getEntry(key))
      useEffect(() => {
        setState(getEntry(key))
        let set = entryListeners.get(key)
        if (!set) entryListeners.set(key, set = new Set())
        set.add(setState)
        return () => {
          set.delete(setState)
          if (set.size === 0) entryListeners.delete(key)
        }
      }, [key])
      return entry
    }

    /**
     * Start (or restart) translating one segment.
     * @param view - 'below' or 'replace': shown once the translation arrives.
     */
    function startTranslation(key, source, view) {
      getEntry(key).controller?.abort()
      const controller = new AbortController()
      const timeoutSec = shared.settings?.timeoutSec ?? 60
      let clientTimedOut = false
      const timer = setTimeout(() => {
        clientTimedOut = true
        controller.abort()
      }, timeoutSec * 1000 + CLIENT_GRACE_MS)
      setEntry(key, { status: 'loading', error: '', failed: null, pending: view, controller })
      return call('translate', { text: source }, controller.signal).then(
        (result) => {
          if (getEntry(key).controller !== controller) return
          setEntry(key, {
            status: 'done',
            translation: result.translation,
            view,
            pending: null,
            error: '',
            controller: null,
            meta: {
              target: result.target,
              model: result.model?.name ?? result.model?.model ?? '',
              effort: result.effort ?? null,
              truncated: result.truncated === true,
            },
          })
          settleReveal(key, true)
        },
        (error) => {
          if (getEntry(key).controller !== controller) return
          settleReveal(key, false)
          if (controller.signal.aborted && !clientTimedOut) {
            // Cancelled by the user: back to where it was.
            setEntry(key, { status: getEntry(key).translation ? 'done' : 'idle', controller: null, pending: null, error: '' })
            return
          }
          const message = clientTimedOut
            ? text('clientTimeout').replace('{sec}', String(timeoutSec + CLIENT_GRACE_MS / 1000))
            : (error?.message ?? String(error))
          setEntry(key, { status: 'error', error: message, controller: null, pending: null, failed: view })
        },
      ).finally(() => clearTimeout(timer))
    }

    function cancelTranslation(key) {
      getEntry(key).controller?.abort()
    }

    // ─────────────────────────────────────────────── styles

    const CSS = `
.${HOST_CLASS}{display:flex;flex-direction:column;gap:8px;min-width:0;margin:0}
.dshtr-bar{display:flex;align-items:center;justify-content:flex-end;gap:6px;min-height:24px;flex-wrap:wrap}
.dshtr-error{flex:1 1 220px;min-width:0;text-align:right;color:var(--dsw-alias-state-error-primary,#d93026);font-size:12px;line-height:18px;overflow-wrap:anywhere;white-space:pre-wrap}
.dshtr-btn{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:24px;cursor:pointer;white-space:nowrap;opacity:.75;transition:opacity .1s,background-color .1s,color .1s;flex:none}
.dshtr-btn:hover,.dshtr-btn:focus-visible{opacity:1;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dshtr-btn:focus-visible{outline:1.5px solid var(--dsw-alias-button-info-fill,#4d6bfe);outline-offset:1px}
.dshtr-btn[data-state="error"]{color:var(--dsw-alias-state-error-primary,#d93026);opacity:1}
.dshtr-btn[data-state="loading"],.dshtr-btn[data-state="active"]{opacity:1}
.dshtr-btn[data-state="active"]{color:var(--dsw-alias-label-secondary,inherit)}
.dshtr-btn:disabled{cursor:default;opacity:.4;background:transparent}
.dshtr-bar-note{flex:1 1 160px;min-width:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshtr-replaced{min-width:0;overflow-wrap:anywhere}
.dshtr-btn svg{flex:none}
.dshtr-spin{animation:dshtr-spin 1s linear infinite}
@keyframes dshtr-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dshtr-spin{animation:none}}
.dshtr-result{min-width:0;overflow-wrap:anywhere;border-left:2px solid var(--dsw-alias-button-info-fill,#4d6bfe);padding:2px 0 2px 12px;display:flex;flex-direction:column;gap:6px}
.dshtr-result[dir="rtl"]{border-left:0;border-right:2px solid var(--dsw-alias-button-info-fill,#4d6bfe);padding:2px 12px 2px 0}
.dshtr-result-body{min-width:0}
.dshtr-plain{white-space:pre-wrap;margin:0;font:inherit}
.dshtr-meta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dshtr-warn{color:var(--dsw-alias-state-warn-primary,#b26a00)}
`

    function installStyles(doc) {
      if (!doc?.head || typeof doc.createElement !== 'function') return () => {}
      const tag = doc.createElement('style')
      tag.setAttribute('data-dsh-translator', VERSION)
      tag.textContent = CSS
      doc.head.appendChild(tag)
      return () => tag.remove()
    }

    // ─────────────────────────────────────────────── segment discovery

    /** The React fiber property of a DOM node, if React exposes one. */
    function fiberKey(el) {
      for (const k of Object.keys(el)) if (k.startsWith('__reactFiber$')) return k
      return undefined
    }

    /** React props of DSH's `MarkdownText` whose root element is `el`, if any. */
    function markdownProps(el) {
      const key = fiberKey(el)
      if (key === undefined) return undefined
      // el's own fiber is the host <div>; its owner component sits just above.
      let fiber = el[key]?.return
      for (let i = 0; fiber && i < 2; i++, fiber = fiber.return) {
        const props = fiber.memoizedProps
        if (props && typeof props.text === 'string' && props.labels && typeof props.labels === 'object') return props
        if (typeof fiber.type === 'string') return undefined // reached another DOM element
      }
      return undefined
    }

    /** Reasoning rows and inline process reasoning are never translated. */
    function isExcluded(el) {
      if (el.classList?.contains(HOST_CLASS)) return true
      if (el.hasAttribute?.('data-turn-process-inline')) return true
      if (el.getAttribute?.('data-variant') === 'think') return true
      return false
    }

    /** Whether `el` is still streaming (a `data-streaming` ancestor inside the row). */
    function isStreaming(el, row) {
      for (let n = el; n && n !== row; n = n.parentElement) {
        if (n.hasAttribute?.('data-streaming')) return true
      }
      return row.hasAttribute?.('data-streaming') === true
    }

    /**
     * The text blocks of one assistant row: `[{ el, text }]`.
     * Preferred: elements whose React owner is `MarkdownText` (exact Markdown
     * source). Fallback: the children of the Markdown body column, using the
     * rendered text.
     */
    function findBlocks(row) {
      const out = []
      if (fiberKey(row) !== undefined) {
        const queue = [[row, 0]]
        while (queue.length > 0) {
          const [el, depth] = queue.shift()
          for (const child of el.children ?? []) {
            if (isExcluded(child)) continue
            const props = markdownProps(child)
            if (props) {
              if (props.variant !== 'compact') out.push({ el: child, text: props.text })
              continue
            }
            if (depth < 5) queue.push([child, depth + 1])
          }
        }
        if (out.length > 0) return out
      }
      // Fallback (no React fibers, or MarkdownText props changed shape):
      // row > AssistantMarkdown root > body > blocks.
      const body = row.firstElementChild?.firstElementChild
      if (!body) return out
      for (const child of body.children ?? []) {
        if (isExcluded(child) || child.tagName !== 'DIV') continue
        if (child.querySelector?.('[data-variant="think"]')) continue
        const rendered = String(child.innerText ?? child.textContent ?? '').trim()
        if (rendered !== '') out.push({ el: child, text: rendered })
      }
      return out
    }

    /**
     * Pull the bar up into the parent's flex/grid gap (DSH spaces Markdown
     * blocks 16px apart), leaving 6px between the text and the bar. Only a
     * real gap is consumed, so the bar can never overlap the text above it.
     */
    function tuck(host, parent, view) {
      let gap = 0
      try {
        const style = view?.getComputedStyle?.(parent)
        if (style && /flex|grid/.test(style.display)) gap = parseFloat(style.rowGap) || 0
      } catch { /* detached or no layout */ }
      host.style.marginTop = gap > 8 ? `${-(gap - 6)}px` : ''
    }

    /** Marks an original block hidden by "替换原文" (display only). */
    const REPLACED_ATTR = 'data-dsh-translator-replaced'

    /**
     * Show the segment as its entry's view asks: in 'replace' view the
     * original block is hidden *visually* (inline `display:none`, which React
     * never manages on MarkdownText's root) and the translation renders in our
     * container in its place. Nothing touches the session: the transcript data
     * and the context sent to the model keep the original text.
     */
    function applyView(el, segment, view) {
      const replaced = getEntry(segment.key).view === 'replace' && getEntry(segment.key).translation !== ''
      if (segment.replaced === replaced && segment.placed) return
      segment.replaced = replaced
      segment.placed = true
      if (replaced) {
        el.style.setProperty('display', 'none', 'important')
        el.setAttribute(REPLACED_ATTR, '')
        segment.host.setAttribute('data-view', 'replace')
        // The hidden block takes no gap, so the container must not be pulled up.
        segment.host.style.marginTop = ''
      } else {
        restoreBlock(el)
        segment.host.removeAttribute('data-view')
        if (el.parentElement) tuck(segment.host, el.parentElement, view)
      }
    }

    /** Undo `applyView`'s hiding of an original block. */
    function restoreBlock(el) {
      if (!el.hasAttribute(REPLACED_ATTR)) return
      el.style.removeProperty('display')
      el.removeAttribute(REPLACED_ATTR)
    }

    /**
     * Keep one plugin container right after every settled assistant text block.
     * @param doc - the browser `document` (injectable for tests).
     * @param onChange - called when the set of segments changed.
     * @returns `{ scan, segments, dispose }`.
     */
    function createScanner(doc, onChange) {
      /** block element -> { id, host, key, text } */
      const segments = new Map()
      let seq = 0

      function scan() {
        let changed = false
        const seen = new Set()
        const englishOnly = shared.settings?.englishOnly !== false
        for (const row of doc.querySelectorAll('[data-chat-flow-kind="assistant-step"]')) {
          if (row.getAttribute('data-chat-group-part') === 'reasoning') continue
          let blocks
          try {
            blocks = findBlocks(row)
          } catch (error) {
            console.warn('[dsh-translator] segment scan skipped a row:', error)
            continue
          }
          for (const { el, text: source } of blocks) {
            if (isStreaming(el, row)) continue
            if (source.trim() === '') continue
            if (englishOnly && !looksEnglish(source)) continue
            seen.add(el)
            let segment = segments.get(el)
            if (!segment) {
              const host = doc.createElement('div')
              host.className = HOST_CLASS
              host.setAttribute('data-dsh-translator', '')
              segment = { id: `s${++seq}`, host, block: el, key: '', text: '' }
              segments.set(el, segment)
              changed = true
            }
            if (segment.text !== source) {
              segment.text = source
              segment.key = segmentKey(source)
              segment.placed = false
              changed = true
            }
            // Directly after its block (React may have inserted or moved siblings).
            if (el.nextElementSibling !== segment.host && el.parentElement) {
              el.parentElement.insertBefore(segment.host, el.nextElementSibling)
              segment.placed = false
            }
            applyView(el, segment, doc.defaultView)
          }
        }
        for (const [el, segment] of segments) {
          if (seen.has(el)) continue
          restoreBlock(el)
          segment.host.remove()
          segments.delete(el)
          changed = true
        }
        if (changed) onChange()
      }

      let timer
      const schedule = () => {
        if (timer !== undefined) return
        timer = setTimeout(() => {
          timer = undefined
          try { scan() } catch (error) { console.warn('[dsh-translator] scan failed:', error) }
        }, 120)
      }
      /** Our own portal renders mutate only inside our containers: ignore those. */
      const insideOwn = (node) => {
        for (let n = node; n; n = n.parentElement) if (n.classList?.contains(HOST_CLASS)) return true
        return false
      }
      let observer
      if (typeof MutationObserver === 'function' && doc.body) {
        observer = new MutationObserver((records) => {
          for (const record of records) {
            if (!insideOwn(record.target)) {
              schedule()
              return
            }
          }
        })
        observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-streaming', 'data-chat-flow-kind'] })
      }
      shared.listeners.add(schedule)
      // A view change (替换原文 / 显示原文) applies immediately, not on the next scan.
      const onEntry = (_entry, key) => {
        for (const [el, segment] of segments) if (segment.key === key) applyView(el, segment, doc.defaultView)
      }
      entryWatchers.add(onEntry)
      schedule()

      return {
        scan,
        segments,
        dispose() {
          clearTimeout(timer)
          timer = undefined
          observer?.disconnect()
          shared.listeners.delete(schedule)
          entryWatchers.delete(onEntry)
          for (const [el, segment] of segments) {
            restoreBlock(el)
            segment.host.remove()
          }
          segments.clear()
          onChange()
        },
      }
    }

    // ─────────────────────────────────────────────── segment UI

    const icon = (paths, extra) => h('svg', {
      width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...extra,
    }, ...paths.map((d, i) => h('path', { key: i, d })))
    const ICON_TRANSLATE = ['M4 5h8', 'M8 3v2', 'M10.5 5c-.8 3.6-3 6.4-6.5 8', 'M6 9c1 1.8 2.6 3.2 4.5 4', 'M12.5 21l4-9 4 9', 'M14 17.5h5']
    const ICON_SPIN = ['M21 12a9 9 0 1 1-6.2-8.56']
    const ICON_REDO = ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6']
    const ICON_ALERT = ['M12 8v5', 'M12 16.5v.01', 'M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z']

    const MarkdownText = primitives.MarkdownText
    /** Reference-stable Markdown chrome labels (MarkdownText caches on identity). */
    let markdownLabels
    function labels() {
      markdownLabels ??= { code: { copyLabel: text('copy'), copiedLabel: text('copied') }, footnotes: text('footnotes') }
      return markdownLabels
    }

    const RTL = new Set(['ar', 'ur'])

    const ICON_SWAP = ['M7 4L3 8l4 4', 'M3 8h14', 'M17 20l4-4-4-4', 'M21 16H7']

    // ─────────────────────────────────────────────── keep the reader's place

    /** Where the revealed first line lands, below the top of the chat scrollport (px). */
    const REVEAL_OFFSET = 64
    /** Re-alignment passes while Markdown, code highlighting and DSH's own resize handling settle (ms). */
    const REVEAL_PASSES = [120, 320, 700]
    /** Input that means the reader is scrolling on their own: stop moving the view. */
    const READER_INTENTS = ['wheel', 'touchstart', 'keydown']

    /** Stops the reveal currently steering the view, if any. */
    let stopActiveReveal

    const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16))

    /** The chat scrollport containing `el` (DSH marks it `data-conversation-scroll`). */
    function scrollerOf(el) {
      const marked = el.closest?.('[data-conversation-scroll]')
      if (marked) return marked
      const view = el.ownerDocument?.defaultView
      for (let n = el.parentElement; n; n = n.parentElement) {
        try {
          const style = view?.getComputedStyle?.(n)
          if (style && /auto|scroll/.test(style.overflowY) && n.scrollHeight > n.clientHeight) return n
        } catch { /* keep walking */ }
      }
      return el.ownerDocument?.scrollingElement ?? null
    }

    /** The live block + container of a segment (rows remount while a request runs). */
    function liveSegment(key, host, block) {
      if (host?.isConnected) return { host, block }
      for (const [el, segment] of layer.scanner?.segments ?? []) {
        if (segment.key === key) return { host: segment.host, block: el }
      }
      return undefined
    }

    /**
     * Bring the first line of what `view` shows into view after a layout
     * change: the translation for 'below' / 'replace', the original block for
     * 'none'. Nothing moves when that first line is already visible. A few
     * later passes correct for content that keeps laying out (and for DSH
     * re-pinning the transcript to its bottom); any wheel / touch / scroll-key
     * input from the reader cancels the rest.
     */
    function reveal(key, host, block, view) {
      // Only the latest click steers the view: stop any earlier reveal's passes.
      stopActiveReveal?.()
      const scroller = host && scrollerOf(host)
      if (!scroller) return
      let stopped = false
      const stop = () => { stopped = true }
      for (const type of READER_INTENTS) scroller.addEventListener?.(type, stop, { capture: true, passive: true, once: true })
      const release = () => {
        for (const type of READER_INTENTS) scroller.removeEventListener?.(type, stop, { capture: true })
        if (stopActiveReveal === halt) stopActiveReveal = undefined
      }
      const halt = () => {
        stop()
        release()
      }
      stopActiveReveal = halt
      const target = () => {
        const live = liveSegment(key, host, block)
        if (!live) return null
        if (view === 'below') return live.host.querySelector?.('.dshtr-result') ?? null
        if (view === 'replace') return live.host.querySelector?.('.dshtr-replaced') ?? null
        return live.block
      }
      /** @param first - the first pass may leave an already-visible line alone. */
      const align = (first) => {
        if (stopped) return false
        const el = target()
        if (!el || el.isConnected === false) return false
        const port = scroller.getBoundingClientRect()
        const composer = scroller.querySelector?.('[data-composer-seat]')
        const bottom = Math.min(port.bottom, composer?.getBoundingClientRect?.().top ?? port.bottom)
        const top = el.getBoundingClientRect().top
        if (first && top >= port.top + 8 && top <= bottom - 48) return false
        const delta = top - port.top - REVEAL_OFFSET
        if (Math.abs(delta) > 4) scroller.scrollTop += delta
        return true
      }
      // Two frames: React commits the change, then DSH's resize handling runs.
      nextFrame(() => nextFrame(() => {
        if (!align(true)) return release()
        let pass = 0
        const again = () => {
          if (pass >= REVEAL_PASSES.length || stopped) return release()
          setTimeout(() => {
            align(false)
            again()
          }, REVEAL_PASSES[pass] - (REVEAL_PASSES[pass - 1] ?? 0))
          pass++
        }
        again()
      }))
    }

    /** Reveals waiting for a translation request: segment key -> { host, block, cancelled, release }. */
    const pendingReveals = new Map()

    /** A newer click owns the view: earlier requests still loading will not move it. */
    function supersedeReveals() {
      for (const pending of pendingReveals.values()) pending.cancelled = true
    }

    /** Remember to reveal the translation once it arrives (unless the reader scrolls meanwhile). */
    function armReveal(key, host, block) {
      pendingReveals.get(key)?.release()
      supersedeReveals()
      const scroller = host && scrollerOf(host)
      const pending = { host, block, cancelled: false }
      const cancel = () => { pending.cancelled = true }
      for (const type of READER_INTENTS) scroller?.addEventListener?.(type, cancel, { capture: true, passive: true })
      pending.release = () => {
        for (const type of READER_INTENTS) scroller?.removeEventListener?.(type, cancel, { capture: true })
        if (pendingReveals.get(key) === pending) pendingReveals.delete(key)
      }
      pendingReveals.set(key, pending)
    }

    /** A request finished: reveal on success unless the reader moved away meanwhile. */
    function settleReveal(key, success) {
      const pending = pendingReveals.get(key)
      if (!pending) return
      pending.release()
      if (!success || pending.cancelled) return
      const live = liveSegment(key, pending.host, pending.block)
      if (live) reveal(key, live.host, live.block, getEntry(key).view)
    }

    /**
     * The bar and translation of one segment. Two buttons:
     * - 「翻译」: show the translation below the original (toggle);
     * - 「替换原文」: show the translation in place of the original (toggle back
     *   with 「显示原文」). Display only — the conversation keeps the original.
     */
    function Segment({ segKey, source, host, block }) {
      const entry = useEntry(segKey)
      const busy = entry.status === 'loading'
      const hasTranslation = entry.translation !== ''
      const view = hasTranslation ? entry.view : 'none'

      /** One button's click: cancel its own request, toggle its view, or translate. */
      const press = useCallback((target) => {
        if (busy) {
          if (entry.pending === target) cancelTranslation(segKey)
          return
        }
        if (hasTranslation && !(entry.status === 'error' && entry.failed === target)) {
          const next = view === target ? 'none' : target
          setEntry(segKey, { view: next, failed: null, error: '' })
          supersedeReveals()
          reveal(segKey, host, block, next)
          return
        }
        armReveal(segKey, host, block)
        startTranslation(segKey, source, target)
      }, [busy, entry.pending, entry.status, entry.failed, hasTranslation, view, segKey, source, host, block])
      const onBelow = useCallback(() => press('below'), [press])
      const onReplace = useCallback(() => press('replace'), [press])
      const onRedo = useCallback(() => {
        armReveal(segKey, host, block)
        startTranslation(segKey, source, view)
      }, [segKey, source, view, host, block])

      /** Label, glyph and state of the button for `target`. */
      const describe = (target) => {
        if (busy && entry.pending === target) return { label: text('translating'), glyph: icon(ICON_SPIN, { className: 'dshtr-spin' }), state: 'loading' }
        if (entry.status === 'error' && entry.failed === target) return { label: text('retry'), glyph: icon(ICON_ALERT), state: 'error' }
        if (target === 'below') {
          const label = view === 'below' ? text('hide') : hasTranslation ? text('show') : text('translate')
          return { label, glyph: icon(ICON_TRANSLATE), state: view === 'below' ? 'active' : hasTranslation ? 'done' : 'idle' }
        }
        const label = view === 'replace' ? text('showOriginal') : text('replace')
        return { label, glyph: icon(ICON_SWAP), state: view === 'replace' ? 'active' : hasTranslation ? 'done' : 'idle' }
      }
      const button = (target, onClick, title) => {
        const d = describe(target)
        const own = busy && entry.pending === target
        return h('button', {
          type: 'button',
          className: 'dshtr-btn',
          'data-action': target,
          'data-state': d.state,
          onClick,
          disabled: busy && !own,
          title: own ? text('cancelTitle') : title ?? d.label,
          'aria-busy': own || undefined,
          'aria-pressed': view === target,
        }, d.glyph, d.label)
      }

      const meta = entry.meta
      const metaText = meta
        ? text('metaLine')
          .replace('{lang}', languageLabels.get(meta.target) ?? meta.target ?? '')
          .replace('{model}', meta.model || '')
          .replace('{effort}', meta.effort ? text('metaEffort').replace('{effort}', meta.effort) : '')
        : ''
      const dir = RTL.has(meta?.target) ? 'rtl' : 'auto'
      const body = h('div', { className: 'dshtr-result-body' },
        MarkdownText
          ? h(MarkdownText, { text: entry.translation, labels: labels() })
          : h('p', { className: 'dshtr-plain' }, entry.translation))

      const bar = h('div', { className: 'dshtr-bar' },
        entry.status === 'error' && entry.error
          ? h('span', { className: 'dshtr-error', role: 'alert' }, text('errorPrefix') + entry.error)
          : null,
        view === 'replace' && entry.status !== 'error'
          ? h('span', { className: 'dshtr-meta dshtr-bar-note' },
            text('replacedNote') + metaText.replace(/^[^·]*·\s*/, ' · '),
            meta?.truncated ? h('span', { className: 'dshtr-warn' }, ' · ' + text('truncated')) : null)
          : null,
        view !== 'none' && !busy
          ? h('button', { type: 'button', className: 'dshtr-btn', 'data-action': 'redo', onClick: onRedo, title: text('retranslate'), 'aria-label': text('retranslate') },
            icon(ICON_REDO))
          : null,
        button('below', onBelow),
        button('replace', onReplace, view === 'replace' ? text('showOriginalTitle') : text('replaceTitle')))

      if (view === 'replace') {
        // In place of the hidden original: same typography, no side bar; the bar follows.
        return h(React.Fragment, null,
          h('div', { className: 'dshtr-replaced', dir, lang: meta?.target || undefined }, body),
          bar)
      }
      return h(React.Fragment, null,
        bar,
        view === 'below'
          ? h('div', { className: 'dshtr-result', dir, lang: meta?.target || undefined },
            body,
            h('div', { className: 'dshtr-meta', dir: 'ltr' },
              metaText,
              meta?.truncated ? h('span', { className: 'dshtr-warn' }, ' · ' + text('truncated')) : null))
          : null)
    }

    /** Re-render hook for the overlay layer. */
    const layer = { listeners: new Set(), scanner: undefined }
    function notifyLayer() {
      for (const listener of [...layer.listeners]) {
        try { listener() } catch (error) { console.error('[dsh-translator] layer listener failed:', error) }
      }
    }

    /** One root-level component that portals a Segment into every container. */
    function Layer() {
      const [, setTick] = useState(0)
      useEffect(() => {
        const listener = () => setTick(n => n + 1)
        layer.listeners.add(listener)
        return () => { layer.listeners.delete(listener) }
      }, [])
      const segments = layer.scanner ? [...layer.scanner.segments.values()] : []
      if (segments.length === 0 || typeof ReactDOM?.createPortal !== 'function') return null
      return h(React.Fragment, null, segments.map(segment =>
        ReactDOM.createPortal(h(Segment, { segKey: segment.key, source: segment.text, host: segment.host, block: segment.block }), segment.host, segment.id)))
    }

    // ─────────────────────────────────────────────── settings page

    const Button = primitives.Button ?? ((props) => h('button', { type: 'button', ...props }))
    const Switch = primitives.Switch ?? (({ checked, onChange, label, disabled }) => h('input', {
      type: 'checkbox', checked, disabled, 'aria-label': label, onChange: (event) => onChange(event.target.checked),
    }))

    const border = '0.5px solid var(--dsw-alias-border-l2)'
    const control = {
      boxSizing: 'border-box', height: 32, padding: '0 10px', borderRadius: 8, border,
      background: 'var(--dsw-specific-input-major, transparent)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 13,
    }
    const styles = {
      section: { maxWidth: 760, color: 'var(--dsw-alias-label-primary)', display: 'flex', flexDirection: 'column', gap: 12 },
      heading: { margin: 0, fontSize: 18, fontWeight: 600 },
      intro: { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary)' },
      groupTitle: { margin: '8px 0 0', fontSize: 15, fontWeight: 600, lineHeight: '22px' },
      card: { border, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 },
      field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
      label: { fontSize: 13, fontWeight: 500 },
      row: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' },
      select: { ...control, flex: 1, minWidth: 200, cursor: 'pointer' },
      input: { ...control, width: 120 },
      textInput: { ...control, flex: 1, minWidth: 200 },
      textarea: {
        ...control, height: 'auto', minHeight: 180, padding: '8px 10px', resize: 'vertical', lineHeight: '20px', width: '100%',
        fontFamily: 'var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Consolas, monospace)', fontSize: 12.5,
      },
      hint: { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
      error: { margin: 0, fontSize: 13, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary, #d93026)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
      ok: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' },
      switchRow: { display: 'flex', alignItems: 'center', gap: 12 },
      switchText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
      testResult: { margin: 0, padding: '8px 12px', borderRadius: 8, border, fontSize: 13, lineHeight: '20px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
      version: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', fontWeight: 400, marginLeft: 8 },
    }

    const modelValue = (provider, model) => `${provider}\u0000${model}`

    function Page() {
      const [data, setData] = useState()
      const [catalog, setCatalog] = useState()
      const [loadError, setLoadError] = useState('')
      const [saveError, setSaveError] = useState('')
      const [savedAt, setSavedAt] = useState(0)
      const [busy, setBusy] = useState('')
      const [promptDraft, setPromptDraft] = useState()
      const [timeoutDraft, setTimeoutDraft] = useState()
      const [testText, setTestText] = useState(() => text('testSample'))
      const [testState, setTestState] = useState({ status: 'idle' })
      const alive = useRef(true)
      useEffect(() => {
        alive.current = true
        return () => { alive.current = false }
      }, [])

      const accept = useCallback((value) => {
        if (!alive.current || !value?.settings) return
        if (value.hostProtocol !== HOST_PROTOCOL) setLoadError(text('hostOutdated'))
        setData(value)
        setShared(value.settings)
        for (const l of value.languages ?? []) languageLabels.set(l.code, l.label)
      }, [])

      const loadModels = useCallback(async () => {
        setBusy('models')
        try {
          const value = await call('models')
          if (alive.current) setCatalog(value)
        } catch (error) {
          if (alive.current) setLoadError(error?.message ?? String(error))
        } finally {
          if (alive.current) setBusy('')
        }
      }, [])

      useEffect(() => {
        call('settings').then(
          (value) => {
            accept(value)
            if (!alive.current) return
            setPromptDraft(value.settings.prompt)
            setTimeoutDraft(String(value.settings.timeoutSec))
          },
          (error) => { if (alive.current) setLoadError(error?.message ?? String(error)) },
        )
        loadModels()
      }, [accept, loadModels])

      const save = useCallback(async (patch) => {
        setSaveError('')
        setBusy('save')
        try {
          const value = await call('settings', patch)
          accept(value)
          if (alive.current) setSavedAt(Date.now())
          return value
        } catch (error) {
          if (alive.current) setSaveError(error?.message ?? String(error))
          return undefined
        } finally {
          if (alive.current) setBusy('')
        }
      }, [accept])

      const settings = data?.settings
      const groups = catalog?.groups ?? []
      const selected = settings?.model ?? null
      const selectedModel = useMemo(() => {
        const route = selected ?? catalog?.default
        if (!route) return undefined
        return groups.find(g => g.id === route.provider)?.models.find(m => m.id === route.model)
      }, [catalog, groups, selected])
      const missing = Boolean(selected && catalog && !selectedModel)

      if (!settings) {
        return h('section', { style: styles.section },
          h('h2', { style: styles.heading }, text('title')),
          loadError ? h('p', { style: styles.error, role: 'alert' }, loadError) : h('p', { style: styles.hint }, text('loading')))
      }

      // ── model select (grouped by provider, like Settings → Models)
      const defaultName = catalog?.default ? `（${catalog.default.provider} / ${catalog.default.model}）` : ''
      const modelOptions = [h('option', { key: '', value: '' }, text('modelDefault').replace('{name}', defaultName))]
      if (missing) {
        modelOptions.push(h('option', { key: 'missing', value: modelValue(selected.provider, selected.model) },
          text('modelMissing').replace('{name}', `${selected.provider} / ${selected.model}`)))
      }
      for (const group of groups) {
        modelOptions.push(h('optgroup', { key: `g:${group.id}`, label: group.name },
          group.models.map(m => h('option', { key: m.id, value: modelValue(group.id, m.id) }, m.name === m.id ? m.id : `${m.name}（${m.id}）`))))
      }
      const onModel = (event) => {
        const value = event.target.value
        if (value === '') return save({ model: null })
        const [provider, model] = value.split('\u0000')
        return save({ model: { provider, model } })
      }

      // ── effort hint for the selected model
      const offered = selectedModel?.efforts
      const mapped = mapEffort(settings.effort, offered)
      let effortHint = ''
      if (selectedModel) {
        if (!offered || offered.length === 0) effortHint = settings.effort === 'off' ? '' : text('effortHintNone')
        else {
          effortHint = text('effortHintOffered').replace('{list}', offered.join(', '))
          if (mapped.note === 'mapped') effortHint += ' ' + text('effortHintMapped').replace('{effort}', mapped.effort)
        }
      }

      const currentPrompt = promptDraft ?? settings.prompt
      const promptDirty = currentPrompt !== settings.prompt
      const savePrompt = () => save({ prompt: currentPrompt }).then(v => { if (v && alive.current) setPromptDraft(v.settings.prompt) })
      const commitTimeout = () => {
        if (timeoutDraft === undefined || String(Number(timeoutDraft)) === String(settings.timeoutSec)) return
        save({ timeoutSec: Number(timeoutDraft) }).then((value) => { if (!value && alive.current) setTimeoutDraft(String(settings.timeoutSec)) })
      }

      const runTest = async () => {
        setTestState({ status: 'loading' })
        try {
          const draft = { prompt: currentPrompt }
          const n = Number(timeoutDraft)
          if (Number.isFinite(n) && n > 0) draft.timeoutSec = n
          const result = await call('translate', { text: testText, test: true, settings: draft })
          if (alive.current) setTestState({ status: 'done', result })
        } catch (error) {
          if (alive.current) setTestState({ status: 'error', error: error?.message ?? String(error) })
        }
      }

      const disabled = busy === 'save'
      const effortLabels = { off: text('effortOff'), low: text('effortLow'), medium: text('effortMedium'), high: text('effortHigh') }

      return h('section', { style: styles.section },
        h('h2', { style: styles.heading }, text('title'), h('span', { style: styles.version }, `v${VERSION}`)),
        h('p', { style: styles.intro }, text('intro')),
        loadError ? h('p', { style: styles.error, role: 'alert' }, loadError) : null,

        // ── model + effort + target
        h('h3', { style: styles.groupTitle }, text('modelGroup')),
        h('div', { style: styles.card },
          h('div', { style: styles.field },
            h('label', { style: styles.label, htmlFor: 'dshtr-model' }, text('modelLabel')),
            h('div', { style: styles.row },
              h('select', {
                id: 'dshtr-model', style: styles.select, disabled,
                value: selected ? modelValue(selected.provider, selected.model) : '', onChange: onModel,
              }, modelOptions),
              h(Button, { variant: 'outline', size: 'sm', disabled: busy === 'models', onClick: loadModels },
                busy === 'models' ? text('refreshing') : text('refresh'))),
            h('p', { style: styles.hint }, text('modelHint')),
            missing ? h('p', { style: styles.error, role: 'alert' }, text('modelMissingWarn').replace('{name}', `${selected.provider} / ${selected.model}`)) : null,
            catalog && groups.length === 0 ? h('p', { style: styles.error }, text('noModels')) : null,
            catalog?.failures?.length
              ? h('p', { style: styles.error }, text('modelFailures').replace('{list}', catalog.failures.map(f => `${f.name}：${f.message}`).join('；')))
              : null),
          h('div', { style: styles.field },
            h('label', { style: styles.label, htmlFor: 'dshtr-effort' }, text('effortLabel')),
            h('div', { style: styles.row },
              h('select', { id: 'dshtr-effort', style: styles.select, disabled, value: settings.effort, onChange: (e) => save({ effort: e.target.value }) },
                (data.efforts ?? ['off', 'low', 'medium', 'high']).map(id => h('option', { key: id, value: id }, effortLabels[id] ?? id)))),
            effortHint ? h('p', { style: styles.hint }, effortHint) : null),
          h('div', { style: styles.field },
            h('label', { style: styles.label, htmlFor: 'dshtr-target' }, text('targetLabel')),
            h('div', { style: styles.row },
              h('select', { id: 'dshtr-target', style: styles.select, disabled, value: settings.target, onChange: (e) => save({ target: e.target.value }) },
                (data.languages ?? []).map(l => h('option', { key: l.code, value: l.code }, l.label)))))),

        // ── prompt
        h('h3', { style: styles.groupTitle }, text('promptGroup')),
        h('div', { style: styles.card },
          h('textarea', {
            style: styles.textarea,
            rows: 9,
            spellCheck: false,
            'aria-label': text('promptGroup'),
            value: currentPrompt,
            onChange: (e) => setPromptDraft(e.target.value),
            onKeyDown: (e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault()
                savePrompt()
              }
            },
          }),
          h('p', { style: styles.hint }, text('promptHint')),
          h('div', { style: styles.row },
            h(Button, { variant: 'primary', size: 'sm', disabled: disabled || !promptDirty, onClick: savePrompt }, text('promptSave')),
            h(Button, {
              variant: 'outline', size: 'sm', disabled: disabled || currentPrompt === data.defaults?.prompt,
              onClick: () => setPromptDraft(data.defaults?.prompt ?? ''),
            }, text('promptReset')),
            promptDirty ? h('span', { style: styles.ok }, text('promptDirty')) : null)),

        // ── other
        h('h3', { style: styles.groupTitle }, text('otherGroup')),
        h('div', { style: styles.card },
          h('div', { style: styles.field },
            h('label', { style: styles.label, htmlFor: 'dshtr-timeout' }, text('timeoutLabel')),
            h('input', {
              id: 'dshtr-timeout', type: 'number', style: styles.input, disabled,
              min: data.limits?.minTimeoutSec, max: data.limits?.maxTimeoutSec, step: 1,
              value: timeoutDraft ?? String(settings.timeoutSec),
              onChange: (e) => setTimeoutDraft(e.target.value),
              onBlur: commitTimeout,
              onKeyDown: (e) => { if (e.key === 'Enter') commitTimeout() },
            }),
            h('p', { style: styles.hint }, text('timeoutHint')
              .replace('{min}', String(data.limits?.minTimeoutSec ?? 5))
              .replace('{max}', String(data.limits?.maxTimeoutSec ?? 600)))),
          h('div', { style: styles.switchRow },
            h('div', { style: styles.switchText },
              h('span', { style: styles.label }, text('englishOnlyTitle')),
              h('span', { style: styles.hint }, text('englishOnlyDesc'))),
            h(Switch, { checked: settings.englishOnly, disabled, label: text('englishOnlyTitle'), onChange: (next) => save({ englishOnly: next }) }))),

        saveError ? h('p', { style: styles.error, role: 'alert' }, saveError) : null,
        !saveError && busy === 'save' ? h('p', { style: styles.ok }, text('saving')) : null,
        !saveError && busy !== 'save' && savedAt > 0 ? h('p', { style: styles.ok }, text('saved')) : null,

        // ── test
        h('h3', { style: styles.groupTitle }, text('testGroup')),
        h('div', { style: styles.card },
          h('div', { style: styles.row },
            h('input', { type: 'text', style: styles.textInput, value: testText, placeholder: text('testPlaceholder'), onChange: (e) => setTestText(e.target.value) }),
            h(Button, { variant: 'outline', size: 'sm', disabled: testState.status === 'loading' || testText.trim() === '', onClick: runTest },
              testState.status === 'loading' ? text('testRunning') : text('testRun'))),
          testState.status === 'error' ? h('p', { style: styles.error, role: 'alert' }, text('errorPrefix') + testState.error) : null,
          testState.status === 'done'
            ? h('div', { style: styles.field },
              h('p', { style: styles.testResult, dir: 'auto' }, testState.result.translation),
              h('p', { style: styles.hint },
                `${testState.result.model?.name ?? ''}${testState.result.effort ? ` · ${testState.result.effort}` : ''}${testState.result.truncated ? ` · ${text('truncated')}` : ''}`))
            : null))
    }

    // ─────────────────────────────────────────────── plugin

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        /**
         * Each feature is installed on its own: a DSH change that breaks one
         * (a renamed slot contract, a DOM change) is logged and leaves the
         * others — above all the settings page — working.
         */
        const safely = (label, install) => {
          try {
            install()
          } catch (error) {
            console.warn(`[dsh-translator] ${label} not installed:`, error)
          }
        }
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-translator: dictionaries')
        const t = ctx.locale.bind(NS)
        text = (key) => {
          const value = t(key)
          return typeof value === 'string' && value !== '' && value !== key ? value : (zh[key] ?? key)
        }
        markdownLabels = undefined

        safely('settings page', () => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: SECTION_ID,
          order: 30,
          label: () => text('nav'),
          locale: NS,
        }, Page)))

        const doc = typeof document === 'undefined' ? undefined : document
        if (!doc) return
        if (typeof ReactDOM?.createPortal !== 'function') {
          console.warn('[dsh-translator] react-dom is unavailable; translate buttons are disabled.')
          return
        }
        safely('styles', () => ctx.effect(() => installStyles(doc), 'dsh-translator: styles'))
        safely('translate layer', () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'translator.layer',
          locale: NS,
        }, Layer)))
        safely('segment scanner', () => ctx.effect(() => {
          const scanner = createScanner(doc, notifyLayer)
          layer.scanner = scanner
          return () => {
            if (layer.scanner === scanner) layer.scanner = undefined
            scanner.dispose()
          }
        }, 'dsh-translator: segment scanner'))
        loadShared().then(() => {
          for (const listener of [...shared.listeners]) listener()
        })
      },
    }
  },
})
