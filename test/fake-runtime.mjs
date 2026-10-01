// Shared fakes for the client smoke tests: a module loader, a tiny hook
// runtime (state persists per "component instance"), vnode helpers and a
// fetch mock for the Host routes.
import { readFile } from 'node:fs/promises'

/** Hook runtime: one slot array per component instance id. */
export function createHooks() {
  const instances = new Map()
  let current
  let index = 0
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }),
    useState(init) {
      const slots = current
      const i = index++
      if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init
      return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }]
    },
    // Runs when deps change (like React), never cleans up.
    useEffect(fn, deps) {
      const slots = current
      const i = index++
      const prev = slots[i]
      if (deps === undefined || prev === undefined || deps.length !== prev.length || deps.some((d, k) => !Object.is(d, prev[k]))) {
        slots[i] = deps ?? []
        fn()
      }
    },
    useRef(v) { const slots = current; const i = index++; if (!(i in slots)) slots[i] = { current: v }; return slots[i] },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps) },
    useMemo(fn, deps) {
      const slots = current
      const i = index++
      const prev = slots[i]
      if (prev && deps && prev.deps.length === deps.length && deps.every((d, k) => Object.is(d, prev.deps[k]))) return prev.value
      const value = fn()
      slots[i] = { deps: deps ?? [], value }
      return value
    },
  }
  /** Render `Component(props)` as instance `id` (hooks persist per id). */
  function render(id, Component, props = {}) {
    if (!instances.has(id)) instances.set(id, [])
    current = instances.get(id)
    index = 0
    return Component(props)
  }
  return { React, render }
}

/** Depth-first search over a vnode tree (function components are not expanded). */
export function findAll(node, pred, out = []) {
  if (node == null || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) findAll(n, pred, out)
    return out
  }
  if (pred(node)) out.push(node)
  findAll(node.children, pred, out)
  if (node.props?.children) findAll(node.props.children, pred, out)
  return out
}
export const find = (node, pred) => findAll(node, pred)[0]
/** Concatenated text of a vnode tree. */
export function textOf(node) {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children) + (node.props?.children ? textOf(node.props.children) : '')
}

/** Load lib/client.js through a fake module loader. */
export async function loadClient(modules) {
  let loaded
  globalThis.window = { __ModuleLoader__: { load(def) { loaded = def } } }
  new Function(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'))()
  const plugin = loaded.factory((id) => {
    if (!(id in modules)) throw new Error(`module not shared: ${id}`)
    return modules[id]
  })
  return { id: loaded.id, plugin }
}

/** A fake client ctx recording slot registrations. */
export function createCtx() {
  const dict = {}
  const slots = {}
  const effects = []
  const ctx = {
    effect(fn) { const dispose = fn(); effects.push(dispose); return dispose },
    locale: {
      register(ns, d) { dict[ns] = d.zh; return () => {} },
      bind: ns => (key, vars) => {
        const template = dict[ns]?.[key] ?? key
        return vars ? template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : template
      },
    },
    slots: {
      inject(name, fn) { fn() },
      register(opts, Component) { slots[opts.name] = { opts, Component }; return () => {} },
    },
    get(name) { throw new Error(`cannot get property "${name}" without inject`) },
  }
  return { ctx, slots, effects, dict }
}

export const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))
