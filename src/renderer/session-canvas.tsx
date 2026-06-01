import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import { SessionCanvasStandaloneApp } from './components/canvas/SessionCanvasStandaloneApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionCanvasStandaloneApp />
  </StrictMode>
);
