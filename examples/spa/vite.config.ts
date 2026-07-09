import { defineConfig } from "vite"
import { potato } from "@potato/vite-plugin"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [potato(), tailwindcss()],
})
