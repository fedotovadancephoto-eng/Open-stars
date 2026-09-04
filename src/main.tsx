import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminWorkspace from './admin/AdminWorkspace.tsx';
import CrmStandaloneWorkspace from './admin/CrmStandaloneWorkspace.tsx';
import { installSupabaseFetchGuard } from './supabaseFetchGuard';
import './index.css';

installSupabaseFetchGuard();

const pathname = window.location.pathname;
const isCrmPath = pathname === '/admin/crm' || pathname.startsWith('/admin/crm/');
const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCrmPath ? <CrmStandaloneWorkspace /> : isAdminPath ? <AdminWorkspace /> : <App />}
  </StrictMode>
);