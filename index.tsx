import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Failed to render PixelForge:", error);
    container.innerHTML = `<div style="padding: 20px; color: white;">Failed to load the app. Check console for details.</div>`;
  }
} else {
  console.error("Root element not found");
}