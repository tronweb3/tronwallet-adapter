import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { nodePolyfills } from 'vite-plugin-node-polyfills'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
  ],
  build: {
      // Set false to speed up build process, should change to `true` for production mode.
      minify: false,
  },
  server: {
    host: "0.0.0.0",
    port: 5003,
  }
})
