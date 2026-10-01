// Segment scanner + per-segment translate UI over a tiny fake DOM:
// node test/smoke-client-dom.mjs
import assert from 'node:assert/strict'
import { createCtx, createHooks, find, findAll, loadClient, textOf, tick } from './fake-runtime.mjs'

// ── minimal DOM: just what the scanner touches
class El {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase()
    this.children = []
    this.parentElement = null
    this.attrs = { ...attrs }
    this.className = attrs.class ?? ''
    this.style = {
      setProperty(k, v, priority) { this[k] = v; this[`${k}!`] = priority },
      removeProperty(k) { delete this[k]; delete this[`${k}!`] },
    }
    this._text = ''
  }
  get classList() { return { contains: (c) => this.className.split(/\s+/).includes(c) } }
  get firstElementChild() { return this.children[0] ?? null }
  get nextElementSibling() {
    const p = this.parentElement
    if (!p) return null
    return p.children[p.children.indexOf(this) + 1] ?? null
  }
  get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === doc.documentElement }
  get textContent() { return this._text + this.children.map(c => c.textContent).join('') }
  set textContent(v) { this._text = v; this.children = [] }
  get innerText() { return this.textContent }
  setAttribute(k, v) { this.attrs[k] = String(v) }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null }
  removeAttribute(k) { delete this.attrs[k] }
  hasAttribute(k) { return k in this.attrs }
  appendChild(c) { c.remove(); c.parentElement = this; this.children.push(c); return c }
  append(...cs) { for (const c of cs) this.appendChild(c); return this }
  insertBefore(node, ref) {
    node.remove()
    node.parentElement = this
    const at = ref ? this.children.indexOf(ref) : -1
    if (at < 0) this.children.push(node)
    else this.children.splice(at, 0, node)
    return node
  }
  remove() { const p = this.parentElement; if (p) p.children = p.children.filter(c => c !== this); this.parentElement = null }
  *all() { for (const c of this.children) { yield c; yield* c.all() } }
  matches(sel) {
    let m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel)
    if (m) return m[2] === undefined ? m[1] in this.attrs : this.attrs[m[1]] === m[2]
    m = /^\.([\w-]+)$/.exec(sel)
    if (m) return this.classList.contains(m[1])
    throw new Error(`unsupported selector ${sel}`)
  }
  querySelectorAll(sel) { return [...this.all()].filter(e => e.matches(sel)) }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null }
  closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches(sel)) return n; return null }
  // Geometry: `layoutTop` is the position in the scrolled content; a scrollport subtracts its scrollTop.
  getBoundingClientRect() {
    const port = this.parentElement?.closest('[data-conversation-scroll]')
    if (this.portRect) return this.portRect
    const top = (this.layoutTop ?? 0) - (port?.scrollTop ?? 0)
    return { top, bottom: top + (this.layoutHeight ?? 20) }
  }
  addEventListener(type, fn) { (this.listeners ??= {})[type] = [...(this.listeners[type] ?? []), fn] }
  removeEventListener(type, fn) { if (this.listeners?.[type]) this.listeners[type] = this.listeners[type].filter(f => f !== fn) }
  fire(type) { for (const fn of this.listeners?.[type] ?? []) fn({ type }) }
}
const doc = {
  documentElement: new El('html'),
  createElement: (tag) => new El(tag),
  querySelectorAll(sel) { return this.documentElement.querySelectorAll(sel) },
}
// Markdown bodies are 16px-gap flex columns (like DSH); the fallback row's body is a plain block.
doc.defaultView = { getComputedStyle: (el) => (el.attrs['data-flex'] !== undefined ? { display: 'flex', rowGap: '16px' } : { display: 'block', rowGap: 'normal' }) }
doc.head = doc.documentElement.appendChild(new El('head'))
doc.body = doc.documentElement.appendChild(new El('body'))

/** A DOM element owned by a React component whose props are `props`. */
const FIBER = '__reactFiber$test'
function owned(el, props) {
  el[FIBER] = { type: 'div', return: { type: function Owner() {}, memoizedProps: props } }
  return el
}
const LABELS = { code: { copyLabel: 'c', copiedLabel: 'd' }, footnotes: 'f' }
const text = (tag, value, attrs) => { const e = new El(tag, attrs); e.textContent = value; return e }

const EN1 = 'The **build** failed because `npm` could not find the package. Run the install step again and check the logs.'
const ZH = '构建失败了，原因是找不到依赖包。请重新运行安装步骤。'
const EN2 = 'Here is the summary of the changes I made to the configuration file.'
const EN_STREAM = 'This answer is still streaming in right now and should not get a button.'

// Row A: React fibers available. Blocks: English, inline reasoning, Chinese, compact markdown.
const rowA = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-node-key': 'a' }), { node: {} })
const rootA = owned(new El('div'), { blocks: [] })
const bodyA = owned(new El('div', { 'data-flex': '' }), {})
const md1 = owned(text('div', EN1), { text: EN1, labels: LABELS })
const reasoning = owned(new El('div', { 'data-turn-process-inline': '' }), {})
reasoning.appendChild(owned(text('div', 'Let me think about the English text here.'), { text: 'Let me think about the English text here.', labels: LABELS }))
const md2 = owned(text('div', ZH), { text: ZH, labels: LABELS })
const compact = owned(text('div', 'compact markdown preview of something'), { text: 'compact markdown preview of something', labels: LABELS, variant: 'compact' })
bodyA.append(md1, reasoning, md2, compact)
rootA.appendChild(bodyA)
rowA.appendChild(rootA)
// Row B: still streaming.
const rowB = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step' }), {})
const rootB = owned(new El('div', { 'data-streaming': 'true' }), {})
const bodyB = owned(new El('div'), {})
bodyB.appendChild(owned(text('div', EN_STREAM), { text: EN_STREAM, labels: LABELS }))
rootB.appendChild(bodyB)
rowB.appendChild(rootB)
// Row C: the reasoning half of a grouped step.
const rowC = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-group-part': 'reasoning' }), {})
rowC.appendChild(owned(text('div', 'Reasoning text in English that must never be translated.'), { text: 'x', labels: LABELS }))
// Row D: no React fibers → structural fallback with rendered text.
const rowD = new El('div', { 'data-chat-flow-kind': 'assistant-step' })
const bodyD = new El('div')
const mdD = text('div', EN2)
const thinkD = new El('div')
thinkD.appendChild(text('div', 'Thinking about the English words here', { 'data-variant': 'think' }))
bodyD.append(mdD, thinkD)
rowD.appendChild(new El('div')).appendChild(bodyD)
// Something that is not an assistant row.
const userRow = new El('div', { 'data-chat-flow-kind': 'user-message' })
userRow.appendChild(owned(text('div', 'A user message in English that is long enough.'), { text: 'A user message in English that is long enough.', labels: LABELS }))
doc.body.append(rowA, rowB, rowC, rowD, userRow)

// ── runtime fakes
const observers = []
globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; observers.push(this) } observe() {} disconnect() { this.disconnected = true } }
globalThis.document = doc
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }

const { React, render } = createHooks()
const primitives = { Button() {}, Switch() {}, MarkdownText: function MarkdownText() {} }
const ReactDOM = { createPortal: (children, host, key) => ({ type: 'portal', props: {}, children: [], portal: { children, host, key } }) }
const { plugin } = await loadClient({ react: React, 'react-dom': ReactDOM, '@deepseek-ai/dsh-client-ui-primitives': primitives })

let settings = { model: null, effort: 'off', target: 'zh-CN', prompt: 'P', timeoutSec: 60, englishOnly: true }
const translations = []
let translateImpl = async (body) => ({ status: 200, body: { translation: `译:${body.text.slice(0, 12)}`, model: { name: 'DeepSeek Chat' }, effort: 'off', target: 'zh-CN' } })
globalThis.fetch = async (url, init) => {
  const route = String(url).slice('/api/dsh-translator/'.length)
  const body = init?.body ? JSON.parse(init.body) : undefined
  let status = 200
  let payload
  if (route === 'settings') {
    if (body) settings = { ...settings, ...body }
    payload = { hostProtocol: 1, settings, defaults: { prompt: 'P' }, languages: [{ code: 'zh-CN', label: '简体中文' }], efforts: ['off', 'low', 'medium', 'high'], limits: {} }
  } else if (route === 'models') payload = { hostProtocol: 1, groups: [], failures: [] }
  else if (route === 'translate') {
    translations.push(body.text)
    ;({ status, body: payload } = await translateImpl(body, init.signal))
  }
  return { ok: status < 300, status, json: async () => payload }
}

const { ctx, slots, effects } = createCtx()
plugin.apply(ctx)
assert.ok(slots['shell.overlay'], 'layer registered in shell.overlay')
assert.equal(slots['shell.overlay'].opts.id, 'translator.layer')
assert.ok(doc.head.children.some(c => c.tagName === 'STYLE'), 'styles installed')
assert.equal(observers.length, 1)
await tick(200)

// ── which segments got a container
const hosts = () => [...doc.body.all()].filter(e => e.classList.contains('dshtr-host'))
assert.equal(hosts().length, 2, 'English settled text blocks only')
assert.ok(md1.nextElementSibling.classList.contains('dshtr-host'), 'directly after the first English block')
assert.ok(mdD.nextElementSibling.classList.contains('dshtr-host'), 'fallback without React fibers')
assert.ok(!md2.nextElementSibling?.classList.contains('dshtr-host'), 'Chinese block skipped (English only)')
assert.equal(reasoning.children.length, 1, 'inline reasoning untouched')
assert.equal(bodyB.children.length, 1, 'streaming block untouched')
assert.equal(rowC.children.length, 1, 'reasoning group part untouched')
assert.equal(userRow.children.length, 1, 'user rows untouched')
assert.ok(!compact.nextElementSibling, 'compact markdown untouched')
assert.equal(md1.nextElementSibling.style.marginTop, '-10px', 'bar tucked into the 16px flex gap (6px left)')
assert.equal(mdD.nextElementSibling.style.marginTop, '', 'no gap → no negative margin, never overlaps')

// ── the layer portals one Segment into each container
let layerTree = render('layer', slots['shell.overlay'].Component)
let portals = findAll(layerTree, n => n.type === 'portal')
assert.equal(portals.length, 2)
assert.deepEqual(new Set(portals.map(p => p.portal.host)), new Set(hosts()))
const portalFor = (block) => portals.find(p => p.portal.host === block.nextElementSibling).portal.children
const seg1 = portalFor(md1)
assert.equal(seg1.props.source, EN1, 'exact Markdown source from MarkdownText props')
const segD = portalFor(mdD)
assert.equal(segD.props.source, EN2)

// ── click 翻译 → translation below, button toggles hide/show
const renderSeg = (id, vnode) => render(id, vnode.type, vnode.props)
const buttonFor = (tree, action) => find(tree, n => n.type === 'button' && n.props['data-action'] === action)
const mainButton = (tree) => buttonFor(tree, 'below')
const replaceButton = (tree) => buttonFor(tree, 'replace')
let tree = renderSeg('seg1', seg1)
assert.equal(textOf(mainButton(tree)), '翻译')
assert.equal(textOf(replaceButton(tree)), '替换原文', 'second button: replace in place')
assert.deepEqual(find(tree, n => n.props?.className === 'dshtr-bar').children.filter(Boolean).map(b => b.props['data-action']), ['below', 'replace'], 'both buttons in the right-aligned bar')
assert.equal(find(tree, n => n.props?.className === 'dshtr-result'), undefined, 'no translation before clicking')
mainButton(tree).props.onClick()
tree = renderSeg('seg1', seg1)
assert.equal(textOf(mainButton(tree)), '翻译中…')
assert.equal(mainButton(tree).props['data-state'], 'loading')
assert.equal(replaceButton(tree).props.disabled, true, 'the other button waits while translating')
await tick(10)
tree = renderSeg('seg1', seg1)
assert.deepEqual(translations, [EN1])
const result = find(tree, n => n.props?.className === 'dshtr-result')
assert.ok(result, 'translation rendered')
assert.equal(find(result, n => n.type === primitives.MarkdownText).props.text, `译:${EN1.slice(0, 12)}`)
assert.match(textOf(result), /译文 · 简体中文 · DeepSeek Chat/)
assert.equal(textOf(mainButton(tree)), '隐藏译文')
// the bar comes first (right-aligned, under the original), the translation after it
const [bar, res] = tree.children.filter(Boolean)
assert.equal(bar.props.className, 'dshtr-bar')
assert.equal(res.props.className, 'dshtr-result')
mainButton(tree).props.onClick()
tree = renderSeg('seg1', seg1)
assert.equal(textOf(mainButton(tree)), '显示译文')
assert.equal(find(tree, n => n.props?.className === 'dshtr-result'), undefined)
mainButton(tree).props.onClick()
tree = renderSeg('seg1', seg1)
assert.ok(find(tree, n => n.props?.className === 'dshtr-result'))
assert.equal(translations.length, 1, 'toggling does not re-translate')
await tick(400)
assert.ok(store.get('dsh-translator.cache.v1').includes('译:The **build'), 'finished translation cached')

// ── errors show in red next to the button; the button becomes 重试
translateImpl = async () => ({ status: 404, body: { error: '翻译模型不存在：deepseek / gone 不在已配置的模型列表中，请重新选择。', code: 'model-missing' } })
let treeD = renderSeg('segD', segD)
mainButton(treeD).props.onClick()
await tick(10)
treeD = renderSeg('segD', segD)
const error = find(treeD, n => n.props?.className === 'dshtr-error')
assert.ok(error, 'error shown')
assert.equal(error.props.role, 'alert')
assert.match(textOf(error), /^翻译失败：翻译模型不存在/)
assert.equal(textOf(mainButton(treeD)), '重试')
assert.equal(mainButton(treeD).props['data-state'], 'error')
// error sits in the same bar as the button, before it
const barD = find(treeD, n => n.props?.className === 'dshtr-bar')
assert.ok(barD.children.indexOf(error) < barD.children.indexOf(mainButton(treeD)))
// timeout from the Host
translateImpl = async () => ({ status: 504, body: { error: '翻译超时：模型 DeepSeek Chat 在 60 秒内没有完成（可在设置中调大超时时间）。', code: 'timeout' } })
mainButton(treeD).props.onClick()
await tick(10)
treeD = renderSeg('segD', segD)
assert.match(textOf(find(treeD, n => n.props?.className === 'dshtr-error')), /翻译超时/)
// Host half not restarted (route missing)
translateImpl = async () => ({ status: 404, body: undefined })
mainButton(treeD).props.onClick()
await tick(10)
treeD = renderSeg('segD', segD)
assert.match(textOf(find(treeD, n => n.props?.className === 'dshtr-error')), /重启 dsh web/)
// network failure
const realFetch = globalThis.fetch
globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
mainButton(treeD).props.onClick()
await tick(10)
treeD = renderSeg('segD', segD)
assert.match(textOf(find(treeD, n => n.props?.className === 'dshtr-error')), /无法连接 dsh web：Failed to fetch/)
globalThis.fetch = realFetch
// retry succeeds → error cleared
translateImpl = async (body) => ({ status: 200, body: { translation: `译:${body.text}`, model: { name: 'M' }, target: 'zh-CN' } })
mainButton(treeD).props.onClick()
await tick(10)
treeD = renderSeg('segD', segD)
assert.equal(find(treeD, n => n.props?.className === 'dshtr-error'), undefined)
assert.ok(find(treeD, n => n.props?.className === 'dshtr-result'))

// ── cancel while translating
translateImpl = (body, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
treeD = renderSeg('segD', segD)
const redo = buttonFor(treeD, 'redo')
assert.equal(redo.props['aria-label'], '重新翻译')
redo.props.onClick()
treeD = renderSeg('segD', segD)
assert.equal(textOf(mainButton(treeD)), '翻译中…')
mainButton(treeD).props.onClick() // cancel
await tick(10)
treeD = renderSeg('segD', segD)
assert.equal(textOf(mainButton(treeD)), '隐藏译文', 'cancel keeps the previous translation')
assert.equal(find(treeD, n => n.props?.className === 'dshtr-error'), undefined)

// ── virtualized remount: the row is replaced, state survives by text
rowA.remove()
const rowA2 = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step' }), {})
const rootA2 = owned(new El('div'), {})
const bodyA2 = owned(new El('div', { 'data-flex': '' }), {})
const md1b = owned(text('div', EN1), { text: EN1, labels: LABELS })
bodyA2.appendChild(md1b)
rootA2.appendChild(bodyA2)
rowA2.appendChild(rootA2)
doc.body.insertBefore(rowA2, rowB)
observers[0].cb([{ target: doc.body }])
await tick(200)
assert.equal(hosts().length, 2, 'old container dropped, new one added')
assert.ok(md1b.nextElementSibling.classList.contains('dshtr-host'))
layerTree = render('layer', slots['shell.overlay'].Component)
portals = findAll(layerTree, n => n.type === 'portal')
const seg1b = portalFor(md1b)
tree = renderSeg('seg1b', seg1b)
assert.ok(find(tree, n => n.props?.className === 'dshtr-result'), 'translation still shown after remount')
assert.equal(textOf(mainButton(tree)), '隐藏译文')

// React inserted a new sibling between the block and our container → container moves back
bodyA2.insertBefore(new El('span'), md1b.nextElementSibling)
observers[0].cb([{ target: bodyA2 }])
await tick(200)
assert.ok(md1b.nextElementSibling.classList.contains('dshtr-host'))
// mutations inside our own containers do not trigger scans
const before = translations.length
observers[0].cb([{ target: md1b.nextElementSibling }])
assert.equal(translations.length, before)

// ── 替换原文: translation shown in place of the original (display only)
const hostOf = (block) => block.nextElementSibling
assert.equal(hostOf(md1b).style.marginTop, '-10px')
replaceButton(tree).props.onClick()
assert.equal(translations.length, before, 'existing translation reused, no new request')
assert.equal(md1b.style.display, 'none', 'original hidden immediately')
assert.equal(md1b.style['display!'], 'important')
assert.ok(md1b.hasAttribute('data-dsh-translator-replaced'))
assert.equal(md1b.textContent, EN1, 'original text itself untouched (still in the page and the session)')
assert.equal(hostOf(md1b).getAttribute('data-view'), 'replace')
assert.equal(hostOf(md1b).style.marginTop, '', 'no negative margin while the block above is hidden')
tree = renderSeg('seg1b', seg1b)
let parts = tree.children.filter(Boolean)
assert.equal(parts[0].props.className, 'dshtr-replaced', 'translation first, in the original\'s place')
assert.equal(find(parts[0], n => n.type === primitives.MarkdownText).props.text, `译:${EN1.slice(0, 12)}`)
assert.equal(parts[1].props.className, 'dshtr-bar', 'bar follows the translated text')
assert.equal(find(tree, n => n.props?.className === 'dshtr-result'), undefined, 'not also shown below')
assert.match(textOf(parts[1]), /已替换为译文 · 简体中文 · DeepSeek Chat/)
assert.equal(textOf(replaceButton(tree)), '显示原文')
assert.equal(replaceButton(tree).props['aria-pressed'], true)
assert.equal(textOf(mainButton(tree)), '显示译文')
// a rescan (e.g. another mutation) keeps it replaced
observers[0].cb([{ target: doc.body }])
await tick(200)
assert.equal(md1b.style.display, 'none')
// 显示原文 → original back, nothing shown
replaceButton(tree).props.onClick()
assert.equal(md1b.style.display, undefined, 'original restored')
assert.ok(!md1b.hasAttribute('data-dsh-translator-replaced'))
assert.equal(hostOf(md1b).style.marginTop, '-10px', 'bar tucked again')
tree = renderSeg('seg1b', seg1b)
assert.equal(find(tree, n => n.props?.className === 'dshtr-replaced'), undefined)
assert.equal(find(tree, n => n.props?.className === 'dshtr-result'), undefined)
assert.equal(textOf(replaceButton(tree)), '替换原文')
// from "below" straight to "replace" and back to "below"
mainButton(tree).props.onClick()
tree = renderSeg('seg1b', seg1b)
assert.ok(find(tree, n => n.props?.className === 'dshtr-result'))
replaceButton(tree).props.onClick()
tree = renderSeg('seg1b', seg1b)
assert.ok(find(tree, n => n.props?.className === 'dshtr-replaced'))
assert.equal(find(tree, n => n.props?.className === 'dshtr-result'), undefined)
mainButton(tree).props.onClick()
assert.equal(md1b.style.display, undefined, 'switching to below shows the original again')
tree = renderSeg('seg1b', seg1b)
assert.ok(find(tree, n => n.props?.className === 'dshtr-result'))
await tick(400)
assert.ok(store.get('dsh-translator.cache.v1').includes('"view":"below"'), 'view persisted')

// 替换原文 on an untranslated segment: translate first, then replace; errors on that button
const mdR = owned(text('div', EN2 + ' Again.'), { text: EN2 + ' Again.', labels: LABELS })
bodyA2.appendChild(mdR)
observers[0].cb([{ target: bodyA2 }])
await tick(200)
layerTree = render('layer', slots['shell.overlay'].Component)
portals = findAll(layerTree, n => n.type === 'portal')
const segR = portalFor(mdR)
translateImpl = async () => ({ status: 502, body: { error: '翻译模型返回错误：Insufficient Balance', code: 'llm-error' } })
let treeR = renderSeg('segR', segR)
replaceButton(treeR).props.onClick()
treeR = renderSeg('segR', segR)
assert.equal(textOf(replaceButton(treeR)), '翻译中…')
assert.equal(mainButton(treeR).props.disabled, true)
await tick(10)
treeR = renderSeg('segR', segR)
assert.equal(textOf(replaceButton(treeR)), '重试', 'the failed button offers retry')
assert.equal(replaceButton(treeR).props['data-state'], 'error')
assert.equal(textOf(mainButton(treeR)), '翻译', 'the other button is unaffected')
assert.match(textOf(find(treeR, n => n.props?.className === 'dshtr-error')), /Insufficient Balance/)
assert.equal(mdR.style.display, undefined, 'original stays visible on failure')
translateImpl = async (body) => ({ status: 200, body: { translation: `替换:${body.text}`, model: { name: 'M' }, target: 'zh-CN' } })
replaceButton(treeR).props.onClick()
await tick(10)
treeR = renderSeg('segR', segR)
assert.equal(mdR.style.display, 'none', 'replaced after the translation arrived')
assert.equal(find(treeR, n => n.type === primitives.MarkdownText).props.text, `替换:${EN2} Again.`)
assert.equal(find(treeR, n => n.props?.className === 'dshtr-error'), undefined)

// ── "English only" off → Chinese blocks get a button too (no reload needed)
settings.englishOnly = false
const Page = slots['settings.section'].Component
render('page', Page)
await tick(5)
const pageTree = render('page', Page)
await find(pageTree, n => n.type === primitives.Switch).props.onChange(false)
await tick(200)
assert.equal(hosts().length, 3, 'rowA is gone; mdD + md1b + mdR')
const rowE = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step' }), {})
const rootE = owned(new El('div'), {})
const bodyE = owned(new El('div'), {})
const mdZh = owned(text('div', ZH), { text: ZH, labels: LABELS })
bodyE.appendChild(mdZh)
rootE.appendChild(bodyE)
rowE.appendChild(rootE)
doc.body.appendChild(rowE)
observers[0].cb([{ target: doc.body }])
await tick(200)
assert.ok(mdZh.nextElementSibling?.classList.contains('dshtr-host'), 'Chinese block has a button when English-only is off')

// ── a future DSH renames MarkdownText's props → structural fallback still finds the text
const rowF = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step' }), {})
const rootF = owned(new El('div'), {})
const bodyF = owned(new El('div'), {})
const mdF = owned(text('div', 'Another English paragraph rendered by a renamed component.'), { source: 'x', copy: {} })
const thinkF = owned(new El('div'), {})
thinkF.appendChild(owned(text('div', 'Hidden English reasoning that stays untouched.', { 'data-variant': 'think' }), {}))
bodyF.append(thinkF, mdF)
rootF.appendChild(bodyF)
rowF.appendChild(rootF)
doc.body.appendChild(rowF)
observers[0].cb([{ target: doc.body }])
await tick(200)
assert.ok(mdF.nextElementSibling?.classList.contains('dshtr-host'), 'fallback used when fibers exist but props changed')
assert.equal(thinkF.children.length, 1, 'reasoning still skipped in the fallback')

// ── unload: every container removed, observer disconnected
// ── keep the reader's place: after each button the view lands on the first line
{
  const port = new El('div', { 'data-conversation-scroll': '' })
  port.portRect = { top: 0, bottom: 800 }
  port.scrollTop = 0
  const row = owned(new El('div', { 'data-chat-flow-kind': 'assistant-step' }), {})
  const root = owned(new El('div'), {})
  const body = owned(new El('div', { 'data-flex': '' }), {})
  const LONG = 'A very long English answer that goes on for many screens. '.repeat(40)
  const block = owned(text('div', LONG), { text: LONG, labels: LABELS })
  block.layoutTop = 2000 // the original's first line, far below the visible area
  body.appendChild(block)
  root.appendChild(body)
  row.appendChild(root)
  port.appendChild(row)
  doc.body.appendChild(port)
  observers[0].cb([{ target: doc.body }])
  await tick(200)
  const host = block.nextElementSibling
  assert.ok(host.classList.contains('dshtr-host'))
  layerTree = render('layer', slots['shell.overlay'].Component)
  portals = findAll(layerTree, n => n.type === 'portal')
  const seg = portalFor(block)
  assert.equal(seg.props.host, host)
  assert.equal(seg.props.block, block)
  // What React would render into the container (the fake runtime does not mount portals).
  const fakeRender = (cls, top) => {
    for (const c of [...host.children]) c.remove()
    const el = new El('div', { class: cls })
    el.layoutTop = top
    host.appendChild(el)
    return el
  }

  // 「翻译」: the translation arrives later; then its first line lands 64px below the top
  translateImpl = async (body2) => { await tick(30); return { status: 200, body: { translation: `长译文:${body2.text.slice(0, 8)}`, model: { name: 'M' }, target: 'zh-CN' } } }
  let t = renderSeg('segLong', seg)
  mainButton(t).props.onClick()
  const result = fakeRender('dshtr-result', 3500)
  await tick(120)
  assert.equal(port.scrollTop, 3500 - 64, 'translation first line revealed')
  // content above keeps laying out → a later pass corrects
  result.layoutTop = 3600
  await tick(200)
  assert.equal(port.scrollTop, 3600 - 64, 'corrected after layout shift')
  // the reader scrolls → no more automatic moves
  port.fire('wheel')
  result.layoutTop = 3900
  await tick(600)
  assert.equal(port.scrollTop, 3600 - 64, 'reader scroll wins')

  // 「隐藏译文」: back to the original's first line
  t = renderSeg('segLong', seg)
  mainButton(t).props.onClick()
  fakeRender('unused', 0)
  await tick(60)
  assert.equal(port.scrollTop, 2000 - 64, 'original first line revealed')

  // 「替换原文」 (translation cached → immediate): the replaced text's first line
  t = renderSeg('segLong', seg)
  replaceButton(t).props.onClick()
  assert.equal(block.style.display, 'none')
  fakeRender('dshtr-replaced', 2000)
  port.scrollTop = 5000
  await tick(60)
  assert.equal(port.scrollTop, 2000 - 64, 'replaced text first line revealed')

  // 「显示原文」 while the original's first line is already visible → the view does not move
  t = renderSeg('segLong', seg)
  replaceButton(t).props.onClick()
  port.scrollTop = 1800 // block top at 200px: visible
  await tick(60)
  assert.equal(port.scrollTop, 1800, 'no jump when the first line is already on screen')

  // the reader scrolls away while a translation is still loading → no jump when it arrives
  t = renderSeg('segLong', seg)
  mainButton(t).props.onClick() // show below (cached) …
  await tick(60)
  t = renderSeg('segLong', seg)
  port.scrollTop = 100
  buttonFor(t, 'redo').props.onClick() // … then re-translate
  port.fire('wheel')
  fakeRender('dshtr-result', 4000)
  await tick(150)
  assert.equal(port.scrollTop, 100, 'reader moved during loading → stays put')

  // a click elsewhere while this one is loading → its later arrival does not steal the view
  t = renderSeg('segLong', seg)
  buttonFor(t, 'redo').props.onClick()
  fakeRender('dshtr-result', 4200)
  let other = renderSeg('seg1b', seg1b)
  mainButton(other).props.onClick() // toggles seg1b (outside this scrollport): supersedes
  await tick(150)
  assert.equal(port.scrollTop, 100, 'superseded by a newer click')
  port.remove()
  observers[0].cb([{ target: doc.body }])
  await tick(200)
}

assert.equal(mdR.style.display, 'none', 'still replaced before unload')
for (const dispose of effects) if (typeof dispose === 'function') dispose()
assert.equal(hosts().length, 0)
assert.equal(mdR.style.display, undefined, 'unloading the plugin restores replaced originals')
assert.ok(!mdR.hasAttribute('data-dsh-translator-replaced'))
assert.ok(observers[0].disconnected)
assert.ok(!doc.head.children.some(c => c.tagName === 'STYLE'), 'styles removed')

console.log('client DOM smoke test: all assertions passed')
