import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/beijing/", // 生产环境路径，与Nginx的location路径一致
  plugins: [
    react(),
    {
      name: "redirect-beijing",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/beijing") {
            res.statusCode = 301;
            res.setHeader("Location", "/beijing/");
            res.end();
          } else {
            next();
          }
        });
      },
    },
  ],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "antd",
      "@ant-design/icons",
      "axios",
      "react-markdown",
      "reactflow",
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5050", // 本地开发时的后端地址
        changeOrigin: true,
        secure: false,
      },
      "/api_beijing": {
        target: "http://localhost:5050", // 本地开发时的后端地址
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
