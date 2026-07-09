import { createApp, h } from "@potato/core"

export function createUserApp() {
  const app = createApp()
  app.route("/users/:id", (state) =>
    h("h1", null, `User ${state.params.id}`),
  )
  return app
}
