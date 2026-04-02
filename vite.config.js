import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // 配置API代理，解决跨域问题
      "/api": {
        target: "http://localhost:5050",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      // 配置文档上传接口代理
      "/upload/document": {
        target: "http://localhost:5050",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
