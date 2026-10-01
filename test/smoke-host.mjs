// Host smoke test with fake Harness services: node test/smoke-host.mjs
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const root = await mkdtemp(join(tmpdir(), 'dsh-tr-test-'))
process.env.DSH_HOME = join(root, 'home')

const plugin = await import('../lib/index.js')

// ── pure helpers
assert.deepEqual(plugin.mapEffort('off', ['off', 'low', 'high', 'max']), { effort: 'off' })
assert.deepEqual(plugin.mapEffort('medium', ['off', 'low', 'high', 'max']), { effort: 'high', note: 'mapped' }, 'tie prefers the stronger level')
assert.deepEqual(plugin.mapEffort('low', ['off', 'low', 'high']), { effort: 'low' })
assert.deepEqual(plugin.mapEffort('high', ['off', 'minimal', 'low']), { effort: 'low', note: 'mapped' })
assert.deepEqual(plugin.mapEffort('off', ['low', 'high']), { effort: 'low', note: 'mapped' }, 'always-thinking model → lightest')
assert.deepEqual(plugin.mapEffort('off', undefined), { effort: undefined })
assert.deepEqual(plugin.mapEffort('high', []), { effort: undefined, note: 'unsupported' })
assert.deepEqual(plugin.mapEffort('high', ['custom']), { effort: undefined, note: 'unsupported' })
assert.equal(plugin.renderPrompt('译为{{target}}:\n{{ text }}', '简体中文', 'Hi {{target}}'), '译为简体中文:\nHi {{target}}', 'single pass: text is never substituted')
assert.equal(plugin.renderPrompt('Translate to {{target}}.', 'English', 'abc'), 'Translate to English.\n\nabc', 'no {{text}} → appended')
assert.equal(plugin.LANGUAGES.length, 10)
assert.equal(plugin.LANGUAGES[0].code, 'zh-CN')
const defaults = plugin.normalizeSettings(undefined)
assert.deepEqual(
  { model: defaults.model, effort: defaults.effort, target: defaults.target, timeoutSec: defaults.timeoutSec, englishOnly: defaults.englishOnly },
  { model: null, effort: 'off', target: 'zh-CN', timeoutSec: 60, englishOnly: true },
)
assert.ok(defaults.prompt.includes('{{target}}') && defaults.prompt.includes('{{text}}'))

// ── fake llm service
const calls = []
let behavior = 'ok'
const llm = {
  listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }, { id: 'broken', name: 'Broken' }, { id: 'empty', name: 'Empty' }],
  async listModels(provider) {
    if (provider === 'broken') throw new Error('bad api key')
    if (provider === 'empty') return []
    return [{ provider, id: 'deepseek-chat', name: 'DeepSeek Chat' }, { provider, id: 'plain', name: 'plain' }]
  },
  async resolveModelInfo(provider, model) {
    if (model === 'plain') return { provider, id: model, name: model }
    return { provider, id: model, name: model, reasoning: { efforts: ['off', 'low', 'high', 'max'].map(id => ({ id, name: id })) } }
  },
  async *stream(options) {
    calls.push(options)
    switch (behavior) {
      case 'ok':
        yield { type: 'block-start', index: 0, blockType: 'reasoning' }
        yield { type: 'reasoning-delta', index: 0, text: 'thinking about it' }
        yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'thinking about it' } }
        yield { type: 'block-start', index: 1, blockType: 'text' }
        yield { type: 'text-delta', index: 1, text: '你好，' }
        yield { type: 'text-delta', index: 1, text: '世界' }
        yield { type: 'block-end', index: 1, block: { type: 'text', text: '你好，世界' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      case 'truncated':
        yield { type: 'text-delta', index: 0, text: '部分译文' }
        yield { type: 'finish', reason: { kind: 'max-tokens' } }
        return
      case 'reasoning-only':
        yield { type: 'block-start', index: 0, blockType: 'reasoning' }
        yield { type: 'reasoning-delta', index: 0, text: 'hmm' }
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      case 'error':
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Insufficient Balance', code: 'QUOTA_EXCEEDED', status: 402 } } }
        return
      case 'throw':
        throw new Error('socket hang up')
      case 'hang':
        await new Promise((_, reject) => {
          if (options.signal.aborted) return reject(new Error('aborted'))
          options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
        return
      default:
        throw new Error(`unknown behavior ${behavior}`)
    }
  },
}

let defaultModel = { provider: 'deepseek', model: 'deepseek-chat' }
const routes = new Map()
const ctx = {
  logger: { warn() {} },
  webServer: { register(r) { routes.set(r.path, r); return () => routes.delete(r.path) } },
  llm,
  get(name) { return name === 'agentDefaultModel' ? { currentSelection: () => defaultModel } : undefined },
  effect(fn) { fn() },
}
plugin.apply(ctx)
assert.deepEqual([...routes.keys()].sort(), ['/api/dsh-translator/models', '/api/dsh-translator/settings', '/api/dsh-translator/translate'])

async function hit(path, method = 'GET', body) {
  const r = routes.get(`/api/dsh-translator/${path}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  Object.assign(req, { method, url: `/api/dsh-translator/${path}`, headers: { host: '127.0.0.1:3080' }, socket: { remoteAddress: '127.0.0.1' }, complete: true })
  let status, payload
  const res = { writableEnded: false, on() {}, writeHead(s) { status = s }, end(p) { this.writableEnded = true; payload = JSON.parse(p) } }
  await r.handler(req, res)
  return { status, payload }
}

// ── settings
let r = await hit('settings')
assert.equal(r.status, 200)
assert.equal(r.payload.hostProtocol, plugin.HOST_PROTOCOL)
assert.equal(r.payload.settings.target, 'zh-CN')
assert.equal(r.payload.languages.length, 10)
assert.deepEqual(r.payload.efforts, ['off', 'low', 'medium', 'high'])
for (const bad of [{ effort: 'max' }, { target: 'xx' }, { timeoutSec: 1 }, { timeoutSec: 'abc' }, { model: { provider: '', model: 'x' } }, { englishOnly: 'yes' }, { prompt: 5 }]) {
  r = await hit('settings', 'POST', bad)
  assert.equal(r.status, 400, JSON.stringify(bad))
}
r = await hit('settings', 'POST', { model: { provider: 'deepseek', model: 'deepseek-chat' }, effort: 'medium', target: 'en', timeoutSec: 30, englishOnly: false, prompt: 'To {{target}}:\r\n{{text}}' })
assert.equal(r.status, 200, r.payload.error)
assert.deepEqual(r.payload.settings, {
  model: { provider: 'deepseek', model: 'deepseek-chat' }, effort: 'medium', target: 'en', prompt: 'To {{target}}:\n{{text}}', timeoutSec: 30, englishOnly: false,
})
const saved = JSON.parse(await readFile(join(process.env.DSH_HOME, 'dsh-translator.json'), 'utf8'))
assert.equal(saved.effort, 'medium')
r = await hit('settings', 'POST', { prompt: '   ' })
assert.equal(r.payload.settings.prompt, plugin.DEFAULT_PROMPT, 'empty prompt restores the default')
r = await hit('settings', 'POST', { target: 'zh-CN', effort: 'off' })
assert.equal(r.payload.settings.model.model, 'deepseek-chat', 'partial updates keep other fields')

// forbidden from non-loopback
{
  const route = routes.get('/api/dsh-translator/translate')
  let status
  await route.handler({ method: 'POST', headers: { host: 'example.com' }, socket: { remoteAddress: '192.0.2.1' } }, { on() {}, writeHead(s) { status = s }, end() {} })
  assert.equal(status, 403)
}

// ── models: grouped like Settings → Models; failures isolated; empty providers dropped
r = await hit('models')
assert.equal(r.status, 200)
assert.deepEqual(r.payload.groups.map(g => g.id), ['deepseek'])
assert.deepEqual(r.payload.groups[0].models[0], { id: 'deepseek-chat', name: 'DeepSeek Chat', efforts: ['off', 'low', 'high', 'max'] })
assert.equal(r.payload.groups[0].models[1].efforts, undefined)
assert.deepEqual(r.payload.failures, [{ id: 'broken', name: 'Broken', message: 'bad api key' }])
assert.deepEqual(r.payload.default, { provider: 'deepseek', model: 'deepseek-chat' })

// ── translate: success, reasoning dropped, effort off, prompt rendered
r = await hit('translate', 'POST', { text: 'Hello, world {{target}}' })
assert.equal(r.status, 200, r.payload.error)
assert.equal(r.payload.translation, '你好，世界')
assert.equal(r.payload.effort, 'off')
assert.equal(r.payload.truncated, false)
assert.deepEqual(r.payload.model, { provider: 'deepseek', model: 'deepseek-chat', name: 'DeepSeek Chat' })
let last = calls.at(-1)
assert.equal(last.reasoningEffort, 'off')
assert.equal(last.provider, 'deepseek')
assert.equal(last.model, 'deepseek-chat')
assert.ok(last.system.includes('translator'))
assert.equal(last.messages.length, 1)
assert.equal(last.messages[0].role, 'user')
assert.equal(last.messages[0].id, undefined, 'one-shot request input carries no identity')
assert.equal(last.messages[0].content[0].text, plugin.renderPrompt(plugin.DEFAULT_PROMPT, '简体中文（Simplified Chinese）', 'Hello, world {{target}}'))
assert.ok(last.signal instanceof AbortSignal)

// medium is mapped onto the closest supported level
await hit('settings', 'POST', { effort: 'medium' })
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.payload.effort, 'high')
assert.equal(r.payload.effortNote, 'mapped')
assert.equal(calls.at(-1).reasoningEffort, 'high')
// a model without reasoning metadata → no effort sent
await hit('settings', 'POST', { model: { provider: 'deepseek', model: 'plain' } })
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 200)
assert.equal('reasoningEffort' in calls.at(-1), false)
assert.equal(r.payload.effortNote, 'unsupported')
await hit('settings', 'POST', { model: { provider: 'deepseek', model: 'deepseek-chat' }, effort: 'off' })

// follows the DSH default model when none is chosen
await hit('settings', 'POST', { model: null })
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 200)
assert.equal(calls.at(-1).model, 'deepseek-chat')
defaultModel = undefined
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 400)
assert.equal(r.payload.code, 'no-model')
assert.match(r.payload.error, /未配置翻译模型/)
defaultModel = { provider: 'deepseek', model: 'deepseek-chat' }

// missing provider / model → 404 model-missing (not a generic "host outdated")
await hit('settings', 'POST', { model: { provider: 'gone', model: 'x' } })
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 404)
assert.equal(r.payload.code, 'model-missing')
assert.match(r.payload.error, /不存在/)
await hit('settings', 'POST', { model: { provider: 'deepseek', model: 'deleted-model' } })
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 404)
assert.equal(r.payload.code, 'model-missing')
assert.match(r.payload.error, /deleted-model/)
await hit('settings', 'POST', { model: { provider: 'deepseek', model: 'deepseek-chat' } })

// empty / too long
assert.equal((await hit('translate', 'POST', { text: '   ' })).status, 400)
assert.equal((await hit('translate', 'POST', { text: 'x'.repeat(plugin.MAX_TEXT_CHARS + 1) })).status, 413)

// provider error, thrown stream, reasoning-only, truncated
behavior = 'error'
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 502)
assert.match(r.payload.error, /Insufficient Balance.*QUOTA_EXCEEDED.*HTTP 402/)
behavior = 'throw'
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 502)
assert.match(r.payload.error, /socket hang up/)
behavior = 'reasoning-only'
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 502)
assert.equal(r.payload.code, 'empty-output')
behavior = 'truncated'
r = await hit('translate', 'POST', { text: 'Hello' })
assert.equal(r.status, 200)
assert.equal(r.payload.truncated, true)
assert.equal(r.payload.translation, '部分译文')

// timeout (direct call with a tiny override) and cancellation
behavior = 'hang'
await assert.rejects(plugin.translate(ctx, 'Hello', undefined, { timeoutSec: 0.05 }), (error) => {
  assert.equal(error.status, 504)
  assert.equal(error.payload.code, 'timeout')
  assert.match(error.message, /超时/)
  return true
})
{
  const controller = new AbortController()
  const pending = plugin.translate(ctx, 'Hello', controller.signal, { timeoutSec: 30 })
  setTimeout(() => controller.abort(), 20)
  await assert.rejects(pending, (error) => error.status === 499 && error.payload.code === 'cancelled')
}

// "测试翻译": draft settings override the saved ones for that one call
behavior = 'ok'
r = await hit('translate', 'POST', { text: 'Hello', test: true, settings: { prompt: 'X {{target}} Y {{text}}', target: 'ru' } })
assert.equal(r.status, 200, r.payload.error)
assert.equal(calls.at(-1).messages[0].content[0].text, 'X Русский (Russian) Y Hello')
assert.equal((await hit('settings')).payload.settings.target, 'zh-CN', 'test does not save')

// a malformed settings file reads as defaults
const { writeFile } = await import('node:fs/promises')
await writeFile(join(process.env.DSH_HOME, 'dsh-translator.json'), '{ nope')
r = await hit('settings')
assert.equal(r.payload.settings.target, 'zh-CN')
assert.equal(r.payload.settings.model, null)

await rm(root, { recursive: true, force: true })
console.log('host smoke test: all assertions passed')
