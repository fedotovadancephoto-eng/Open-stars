import { Capacitor } from '@capacitor/core';

export const isNativeOpenStarsApp = Capacitor.isNativePlatform();

function routeFromAppUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    // Custom scheme example: openstars://admin -> /admin
    const customSchemeHost = url.protocol === 'openstars:' && url.hostname
      ? `/${url.hostname}`
      : '';
    const pathname = customSchemeHost
      ? `${customSchemeHost}${url.pathname === '/' ? '' : url.pathname}`
      : (url.pathname || '/');

    return `${pathname || '/'}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export async function initializeNativeApp() {
  if (!isNativeOpenStarsApp) return;

  document.documentElement.dataset.nativeApp = 'true';

  const [{ App }, { SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ]);

  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);

  await App.addListener('appUrlOpen', ({ url }) => {
    const route = routeFromAppUrl(url);
    if (!route) return;

    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (route === current) return;

    window.history.pushState({}, '', route);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  window.setTimeout(() => {
    void SplashScreen.hide().catch(() => undefined);
  }, 100);
}
