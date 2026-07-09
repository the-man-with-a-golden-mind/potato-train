import type {
  AppState,
  ComponentCache,
  Emit,
  PotatoChild,
  StatefulComponent,
} from "./types.js"

/** Simple LRU cache for stateful components (nanocomponent spirit). */
export function createComponentCache(max = 100): ComponentCache {
  const map = new Map<string, StatefulComponent>()

  return (Component, id, ...args) => {
    const existing = map.get(id)
    if (existing) {
      // refresh LRU order
      map.delete(id)
      map.set(id, existing)
      return existing
    }
    // Evict oldest
    if (map.size >= max) {
      const first = map.keys().next().value
      if (first !== undefined) map.delete(first)
    }

    // Construction is deferred: we need state/emit from render time.
    // Callers typically do: state.cache(Map, 'id') after state is ready.
    // Potato injects a proper factory via app bootstrap.
    throw new Error(
      "Use app-provided state.cache after potato() bootstrap. Internal createComponentCache needs bindCache.",
    )
  }
}

export function bindCache(
  max: number,
  getState: () => AppState,
  getEmit: () => Emit,
): ComponentCache {
  const map = new Map<string, StatefulComponent>()

  return (Component, id, ...args) => {
    let inst = map.get(id)
    if (inst) {
      map.delete(id)
      map.set(id, inst)
      return inst
    }
    if (map.size >= max) {
      const first = map.keys().next().value
      if (first !== undefined) map.delete(first)
    }

    const state = getState()
    const emit = getEmit()
    inst = new Component(id, state, emit, ...args)

    // Wrap render to match nanocomponent pattern
    const originalCreate = inst.createElement.bind(inst)
    let mounted = false

    inst.render = (...renderArgs: unknown[]): PotatoChild => {
      if (!mounted) {
        const tree = originalCreate(...renderArgs)
        mounted = true
        return tree
      }
      const shouldUpdate =
        typeof inst.update === "function" ? inst.update(...renderArgs) : true
      if (shouldUpdate === false) {
        // Return a same-node marker via empty fragment placeholder
        return {
          type: "div",
          props: {
            "data-potato-same": id,
            ref: (el: Element | null) => {
              /* v8 ignore next 4 */
              if (el && inst.element) {
                ;(el as HTMLElement & { isSameNode?: (n: Node) => boolean }).isSameNode =
                  (n) => n === inst.element
              }
            },
          },
        }
      }
      return originalCreate(...renderArgs)
    }

    map.set(id, inst)
    return inst
  }
}

/** Base class for stateful components (optional OOP escape hatch). */
export abstract class Component implements StatefulComponent {
  id: string
  local: Record<string, unknown> = {}
  element: Element | null = null

  constructor(id: string, _state: AppState, _emit: Emit) {
    this.id = id
  }

  abstract createElement(...args: unknown[]): PotatoChild

  update(..._args: unknown[]): boolean {
    return true
  }

  load(_el: Element): void {}
  unload(_el: Element): void {}

  render(...args: unknown[]): PotatoChild {
    return this.createElement(...args)
  }
}
