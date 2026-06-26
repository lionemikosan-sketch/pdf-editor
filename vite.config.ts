import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages のプロジェクトサイトとして配信する場合、本番ビルドだけ
// base をサブパスにする（開発サーバーはルートのまま）。リポジトリ名に合わせて変更可。
const BASE = '/pdf-editor/';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    strictPort: true,
  },
  // pdfjs-dist の worker は ?url で取り込むため最適化対象から外しておく
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  plugins: [react()],
}));
