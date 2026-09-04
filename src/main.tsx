import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminWorkspace from './admin/AdminWorkspace.tsx';
import CrmStandaloneWorkspace from './admin/CrmStandaloneWorkspace.tsx';
import CrmVisualPreview from './admin/CrmVisualPreview.tsx';
import { installSupabaseFetchGuard } from './supabaseFetchGuard';
import './index.css';

installSupabaseFetchGuard();

const pathname = window.location.pathname;
const isCrmPath = pathname === '/admin/crm' || pathname.startsWith('/admin/crm/');
const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
const isSafeCrmVisualPreview =
  isCrmPath &&
  window.location.hostname.startsWith('open-stars-parent-portal-') &&
  new URLSearchParams(window.location.search).get('preview-ui') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSafeCrmVisualPreview ? <CrmVisualPreview /> : isCrmPath ? <CrmStandaloneWorkspace /> : isAdminPath ? <AdminWorkspace /> : <App />}
  </StrictMode>
);