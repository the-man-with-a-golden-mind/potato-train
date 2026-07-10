import { h, Fragment as Frag } from "potato-train-core"
import type { ComponentFn, PotatoChild, Props, VNode } from "potato-train-core"

export const Fragment = Frag

export function jsx(
  type: string | ComponentFn,
  props: Props,
  key?: string | number,
): VNode {
  const p = key !== undefined ? { ...props, key } : props
  return h(type, p)
}

export function jsxs(
  type: string | ComponentFn,
  props: Props,
  key?: string | number,
): VNode {
  return jsx(type, props, key)
}

export function jsxDEV(
  type: string | ComponentFn,
  props: Props,
  key?: string | number,
): VNode {
  return jsx(type, props, key)
}

export namespace JSX {
  export type Element = VNode | string | number | null
  export interface ElementChildrenAttribute {
    children: PotatoChild
  }
  export type IntrinsicElements = {
    [K in keyof HTMLElementTagNameMap]: HtmlAttrs
  } & {
    [K in keyof SVGElementTagNameMap]: HtmlAttrs
  } & {
    [elem: string]: Props
  }
  export interface IntrinsicAttributes {
    key?: string | number
  }
}

type HtmlAttrs = Props & {
  class?: string
  className?: string
  style?: string | Record<string, string | number>
  children?: PotatoChild
}
