/**
 * Potato Sheet — createApp + typed feature (product architecture).
 *
 * Type spine: SheetState + SheetEvents — renames fail tsc, not grep.
 */
import {
  createApp as createTypedApp,
  asRawApp,
  type PotatoApp,
  type TypedPotatoApp,
} from "potato-train-core"
import { sheetFeature } from "./sheet/feature.js"
import { SheetView } from "./sheet/view.js"
import type { SheetState, SheetEvents } from "./sheet/types.js"

export type { SheetState, SheetEvents, Cell, Row } from "./sheet/types.js"

export function createSheetApp(): TypedPotatoApp<SheetState, SheetEvents> {
  const app = createTypedApp<SheetState, SheetEvents>({
    href: false,
    state: { ...sheetFeature.state },
  })
  app.useFeature(sheetFeature)
  app.route("/", (state, emit) => SheetView(state, emit))
  return app
}

/** Raw PotatoApp for SSR / server adapters */
export function createApp(): PotatoApp {
  return asRawApp(createSheetApp())
}
