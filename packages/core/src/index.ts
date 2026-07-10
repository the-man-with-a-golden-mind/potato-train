/**
 * potato-train-core — typed Choo-shaped framework
 *
 * Product surface (apps):
 *   createApp · defineStore · defineFeature · h / JSX
 *
 * Type spine: State + Events (refactors via tsc, not grep)
 *
 * Low-level: potato() for adapters / untyped interop
 */
export {
  potato,
  defineStore,
  Component,
  isolateState,
  isolateStateForRender,
  pureEmit,
} from "./app.js"
export type {
  PotatoApp,
  PotatoOptions,
  Store,
  View,
  AppState,
  Emit,
  StoreApi,
  StoreSetup,
} from "./app.js"
export type { EmitterOptions } from "./emitter.js"

export { h, Fragment, fragment, isVNode, normalizeChildren } from "./vnode.js"
export { EVENTS } from "./events.js"
export type { EventName } from "./events.js"

export { createEmitter } from "./emitter.js"
export { createRouter, parseLocation, parseQuery } from "./router.js"
export { createRoot, renderToString } from "./morph.js"
export { morphHtml } from "./morph-html.js"
export { bindCache } from "./cache.js"

/** Compile-time safety + app entry */
export { createApp, asRawApp } from "./typed-app.js"
export type {
  TypedPotatoApp,
  TypedView,
  TypedStoreFn,
  TypedEmitter,
  CreateAppOptions,
  Expect,
  Equal,
} from "./typed-app.js"
export type {
  EventMap,
  FrameworkEventMap,
  WithFrameworkEvents,
  TypedEmit,
  TypedOn,
  TypedListener,
  EventArgs,
} from "./typed-events.js"
export { defineEvents } from "./typed-events.js"
export type { PathParams, RoutePattern } from "./typed-paths.js"
export type { CoreState, StrictState, RouteState } from "./strict-state.js"

/** Feature modules */
export {
  defineFeature,
  combineState,
  useFeatures,
  eventName,
} from "./feature.js"
export type {
  Feature,
  DefineFeatureConfig,
  InferFeatureState,
  InferFeatureEvents,
  CombineFeatureStates,
  CombineFeatureEvents,
  PrefixEvents,
} from "./feature.js"

export type {
  VNode,
  Props,
  PotatoChild,
  ComponentFn,
  ComponentContext,
  Emitter,
  RouteMatch,
  StatefulComponent,
  PotatoApp as App,
} from "./types.js"
