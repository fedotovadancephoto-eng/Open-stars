import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AdminWorkspace from './admin/AdminWorkspace.tsx';
import { initializeNativeApp } from './nativeApp';
import { installSupabaseFetchGuard } from './supabaseFetchGuard';
import './index.css';

installSupabaseFetchGuard();
void initializeNativeApp();

function isAdminLocation() {
  return window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
}

function RootApp() {
  const [isAdminPath, setIsAdminPath] = useState(isAdminLocation);

  useEffect(() => {
    const syncRoute = () => setIsAdminPath(isAdminLocation());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  return isAdminPath ? <AdminWorkspace /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);
