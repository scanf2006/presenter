import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 注入 Polyfill 解决最新版 pdfjs-dist 在当前 Electron 版本的兼容性问题
if (!Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function() {
    return Array.from(this).map(b => b.toString(16).padStart(2, '0')).join('');
  };
}

console.log("%c [DIAGNOSTIC] main.jsx Loaded", "color: red; font-size: 20px; font-weight: bold;");

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
