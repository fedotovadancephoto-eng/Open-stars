import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminWorkspace from './admin/AdminWorkspace.tsx';
import { DocumentsPage } from './components/DocumentsPage';
import { installSupabaseFetchGuard } from './supabaseFetchGuard';
import './index.css';

installSupabaseFetchGuard();

const isAdminPath = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
const isDocumentsPath = window.location.pathname === '/documents' || window.location.pathname.startsWith('/documents/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminPath ? <AdminWorkspace /> : isDocumentsPath ? <DocumentsPage /> : <App />}
  </StrictMode>
);
