import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";

export default defineConfig({
  base: "/beijing/", // 生产环境路径，与Nginx的location路径一致
  plugins: [
    react(),
    compression({
      verbose: true,
      disable: false,
      threshold: 10240, // 对超过 10kb 的文件进行压缩
      algorithm: 'gzip',
      ext: '.gz',
    }),
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('antd') || id.includes('@ant-design/icons')) {
              return 'vendor-antd';
            }
            if (id.includes('reactflow')) {
              return 'vendor-flow';
            }
            if (id.includes('react-markdown')) {
              return 'vendor-markdown';
            }
            if (id.includes('axios') || id.includes('html2canvas') || id.includes('jspdf')) {
              return 'vendor-utils';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000, // 提高警告阈值，因为我们已经手动拆分了
  },
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
