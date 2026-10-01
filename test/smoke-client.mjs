// Client smoke test: registration + settings page, with fake React and fetch.
// node test/smoke-client.mjs
import assert from 'node:assert/strict'
import { createCtx, createHooks, find, findAll, loadClient, textOf, tick } from './fake-runtime.mjs'

const { React, render } = createHooks()
const primitives = { Button() {}, Switch() {}, MarkdownText() {} }
const { id, plugin } = await loadClient({ react: React, 'react-dom': { createPortal: (c, host, key) => ({ portal: true, c, host, key }) }, '@deepseek-ai/dsh-client-ui-primitives': primitives })
assert.equal(id, '@mikulo/dsh-translator')
assert.deepEqual(plugin.inject, ['slots', 'locale'])

// ── fetch mock for the Host routes
let settings = { model: null, effort: 'off', target: 'zh-CN', prompt: 'P {{target}} {{text}}', timeoutSec: 60, englishOnly: true }
const posted = []
const SETTINGS = () => ({
  hostProtocol: 1,
  settings,
  defaults: { prompt: 'DEFAULT {{target}} {{text}}', timeoutSec: 60, target: 'zh-CN', effort: 'off' },
  languages: [{ code: 'zh-CN', label: '简体中文' }, { code: 'en', label: 'English' }, { code: 'ru', label: 'Русский (Russian)' }],
  efforts: ['off', 'low', 'medium', 'high'],
  limits: { minTimeoutSec: 5, maxTimeoutSec: 600 },
})
const CATALOG = {
  hostProtocol: 1,
  default: { provider: 'deepseek', model: 'deepseek-chat' },
  groups: [
    { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', efforts: ['off', 'low', 'high', 'max'] }, { id: 'plain', name: 'plain' }] },
    { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-x', name: 'GPT X', efforts: ['minimal', 'low', 'medium', 'high'] }] },
  ],
  failures: [{ id: 'broken', name: 'Broken', message: 'bad api key' }],
}
let translateReply = { status: 200, body: { translation: '测试译文', model: { name: 'DeepSeek Chat' }, effort: 'off', target: 'zh-CN' } }
globalThis.fetch = async (url, init) => {
  const path = String(url)
  assert.ok(path.startsWith('/api/dsh-translator/'), path)
  const route = path.slice('/api/dsh-translator/'.length)
  const body = init?.body ? JSON.parse(init.body) : undefined
  if (init?.method === 'POST') posted.push({ route, body })
  let status = 200
  let payload
  if (route === 'settings') {
    if (body) {
      if (body.effort === 'max') { status = 400; payload = { error: '思考强度只能是：off / low / medium / high' } }
      else { settings = { ...settings, ...body }; payload = SETTINGS() }
    } else payload = SETTINGS()
  } else if (route === 'models') payload = CATALOG
  else if (route === 'translate') ({ status, body: payload } = translateReply)
  else { status = 404; payload = undefined }
  return { ok: status >= 200 && status < 300, status, json: async () => { if (payload === undefined) throw new Error('no json'); return payload } }
}

const { ctx, slots } = createCtx()
globalThis.document = undefined
plugin.apply(ctx)
assert.ok(slots['settings.section'], 'settings section registered')
assert.equal(slots['settings.section'].opts.id, 'translator')
assert.equal(slots['settings.section'].opts.label(), '回复翻译')
assert.equal(slots['shell.overlay'], undefined, 'no document → no chat layer (settings page still works)')

// ── settings page
const Page = slots['settings.section'].Component
let tree = render('page', Page)
assert.match(textOf(tree), /加载中/)
await tick(5)
tree = render('page', Page)
const text = textOf(tree)
for (const expected of ['回复翻译', '翻译模型', '思考强度', '翻译成', '翻译提示词', '超时（秒）', '只在包含英文的段落显示翻译按钮', '测试翻译']) {
  assert.ok(text.includes(expected), expected)
}

// model select: DSH default first, then provider optgroups with the configured models
const modelSelect = find(tree, n => n.type === 'select' && n.props.id === 'dshtr-model')
assert.equal(modelSelect.props.value, '')
const options = findAll(modelSelect, n => n.type === 'option')
assert.match(textOf(options[0]), /跟随 DSH 默认模型（deepseek \/ deepseek-chat）/)
assert.deepEqual(findAll(modelSelect, n => n.type === 'optgroup').map(g => g.props.label), ['DeepSeek', 'OpenAI'])
assert.deepEqual(options.slice(1).map(o => o.props.value), ['deepseek\u0000deepseek-chat', 'deepseek\u0000plain', 'openai\u0000gpt-x'])
assert.match(text, /Broken：bad api key/, 'provider failures are shown')

// effort select: off by default, low / medium / high
const effortSelect = find(tree, n => n.type === 'select' && n.props.id === 'dshtr-effort')
assert.equal(effortSelect.props.value, 'off')
assert.deepEqual(findAll(effortSelect, n => n.type === 'option').map(o => o.props.value), ['off', 'low', 'medium', 'high'])
assert.match(textOf(findAll(effortSelect, n => n.type === 'option')[0]), /关闭（默认）/)

// target language select, Chinese by default
const targetSelect = find(tree, n => n.type === 'select' && n.props.id === 'dshtr-target')
assert.equal(targetSelect.props.value, 'zh-CN')

// picking a model and an effort saves immediately
await modelSelect.props.onChange({ target: { value: 'openai\u0000gpt-x' } })
assert.deepEqual(posted.at(-1), { route: 'settings', body: { model: { provider: 'openai', model: 'gpt-x' } } })
tree = render('page', Page)
assert.equal(find(tree, n => n.type === 'select' && n.props.id === 'dshtr-model').props.value, 'openai\u0000gpt-x')
await find(tree, n => n.type === 'select' && n.props.id === 'dshtr-effort').props.onChange({ target: { value: 'medium' } })
assert.deepEqual(posted.at(-1).body, { effort: 'medium' })
await modelSelect.props.onChange({ target: { value: 'deepseek\u0000deepseek-chat' } })
tree = render('page', Page)
assert.match(textOf(tree), /该模型支持的思考强度：off, low, high, max。 所选强度不受支持，将使用最接近的「high」/)

// a saved model that no longer exists is flagged in red
settings = { ...settings, model: { provider: 'deepseek', model: 'deleted' } }
await find(tree, n => n.type === 'select' && n.props.id === 'dshtr-target').props.onChange({ target: { value: 'en' } })
tree = render('page', Page)
assert.match(textOf(tree), /当前选择的模型 deepseek \/ deleted 已不在已配置的模型列表中/)
assert.match(textOf(find(tree, n => n.type === 'select' && n.props.id === 'dshtr-model')), /（已不存在）deepseek \/ deleted/)
settings = { ...settings, model: { provider: 'deepseek', model: 'deepseek-chat' } }

// a rejected save shows the Host error
await find(tree, n => n.type === 'select' && n.props.id === 'dshtr-effort').props.onChange({ target: { value: 'max' } })
tree = render('page', Page)
assert.match(textOf(tree), /思考强度只能是/)

// prompt: edit, save, restore default
let textarea = find(tree, n => n.type === 'textarea')
textarea.props.onChange({ target: { value: '将下面的文本翻译为{{target}}:\n{{text}}' } })
tree = render('page', Page)
assert.match(textOf(tree), /提示词有未保存的修改/)
const saveButton = find(tree, n => n.type === primitives.Button && textOf(n) === '保存提示词')
assert.equal(saveButton.props.disabled, false)
await saveButton.props.onClick()
assert.deepEqual(posted.at(-1).body, { prompt: '将下面的文本翻译为{{target}}:\n{{text}}' })
tree = render('page', Page)
assert.doesNotMatch(textOf(tree), /提示词有未保存的修改/)
find(tree, n => n.type === primitives.Button && textOf(n) === '恢复默认').props.onClick()
tree = render('page', Page)
assert.equal(find(tree, n => n.type === 'textarea').props.value, 'DEFAULT {{target}} {{text}}')

// timeout commits on blur; english-only switch saves
find(tree, n => n.type === 'input' && n.props.id === 'dshtr-timeout').props.onChange({ target: { value: '90' } })
tree = render('page', Page)
find(tree, n => n.type === 'input' && n.props.id === 'dshtr-timeout').props.onBlur()
await tick(5)
assert.deepEqual(posted.at(-1).body, { timeoutSec: 90 })
tree = render('page', Page)
await find(tree, n => n.type === primitives.Switch).props.onChange(false)
assert.deepEqual(posted.at(-1).body, { englishOnly: false })

// test translation: success, then a red error
tree = render('page', Page)
await find(tree, n => n.type === primitives.Button && textOf(n) === '测试翻译').props.onClick()
tree = render('page', Page)
assert.match(textOf(tree), /测试译文/)
assert.equal(posted.at(-1).route, 'translate')
assert.equal(posted.at(-1).body.test, true)
assert.equal(posted.at(-1).body.settings.prompt, 'DEFAULT {{target}} {{text}}', 'unsaved prompt draft is tested')
translateReply = { status: 504, body: { error: '翻译超时：模型 DeepSeek Chat 在 60 秒内没有完成', code: 'timeout' } }
await find(tree, n => n.type === primitives.Button && textOf(n) === '测试翻译').props.onClick()
tree = render('page', Page)
const alert = find(tree, n => n.props?.role === 'alert' && /翻译超时/.test(textOf(n)))
assert.ok(alert, 'timeout error shown')
assert.match(alert.props.style.color, /error/)

// a Host half that lacks the routes (dsh web not restarted) → explicit hint
const realFetch = globalThis.fetch
globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new Error('html') } })
const fresh = createHooks()
void fresh
tree = render('page2', Page)
await tick(5)
tree = render('page2', Page)
assert.match(textOf(tree), /重启 dsh web/)
globalThis.fetch = realFetch

console.log('client smoke test: all assertions passed')
