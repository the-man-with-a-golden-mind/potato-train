import { defineConfig } from "vite"
import { potato } from "potato-train-vite-plugin"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [potato(), tailwindcss()],
})
