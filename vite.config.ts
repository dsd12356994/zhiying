import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const PROXY_TIMEOUT = 10 * 60 * 1000; // 10 minutes for video generation

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
    proxy: {
      // fal.ai — async queue endpoint (MUST come before /proxy/fal to avoid prefix collision)
      "/proxy/fal-queue": {
        target: "https://queue.fal.run",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/fal-queue/, ""),
        timeout: PROXY_TIMEOUT,
        proxyTimeout: PROXY_TIMEOUT,
      },
      // fal.ai — synchronous endpoint
      "/proxy/fal": {
        target: "https://fal.run",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/fal/, ""),
        timeout: PROXY_TIMEOUT,
        proxyTimeout: PROXY_TIMEOUT,
      },
      // Runway
      "/proxy/runway": {
        target: "https://api.runwayml.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/runway/, ""),
        timeout: PROXY_TIMEOUT,
        proxyTimeout: PROXY_TIMEOUT,
      },
      // Replicate
      "/proxy/replicate": {
        target: "https://api.replicate.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/replicate/, ""),
        timeout: PROXY_TIMEOUT,
        proxyTimeout: PROXY_TIMEOUT,
      },
      // DashScope — China / Beijing region
      "/proxy/dashscope": {
        target: "https://dashscope.aliyuncs.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/dashscope/, ""),
        timeout: PROXY_TIMEOUT,
        proxyTimeout: PROXY_TIMEOUT,
      },
      // DashScope — International / Singapore region
      "/proxy/dashscope-intl": {
        target: "https://dashscope-intl.aliyuncs.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/dashscope-intl/, ""),
        timeout: PROXY_TIMEOUT,
        proxyTimeout: PROXY_TIMEOUT,
      },
    },
  },
});
