import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable and usable offline: the service worker caches the app shell on first visit. A relative
// build (base './', hosted inside another page) ships without one.
if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.BASE_URL !== './') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
