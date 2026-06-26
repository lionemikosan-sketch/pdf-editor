import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 開発時のみ：ブラウザコンソール / 自動検証から状態と書き出し関数へアクセスできるようにする
if (import.meta.env.DEV) {
  Promise.all([import('./store/useStore'), import('./lib/export')]).then(
    ([store, exp]) => {
      (window as unknown as Record<string, unknown>).__pdf = { store: store.useStore, exp };
    },
  );
}
