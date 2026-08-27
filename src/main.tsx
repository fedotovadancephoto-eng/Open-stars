import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installSupabaseFetchGuard } from './supabaseFetchGuard';
import './index.css';

installSupabaseFetchGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
