import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import type { AqsaAndroidBridgeApi } from '../types/business';

interface VersionManifest {
  app?: string;
  version?: string;
  buildId?: string;
  builtAt?: string;
}

const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
const currentBuiltAt = typeof __APP_BUILT_AT__ !== 'undefined' ? __APP_BUILT_AT__ : '';

let swRegistration: ServiceWorkerRegistration | undefined;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
const updateListeners = new Set<(latestBuildId: string | null) => void>();
let detectedBuildId: string | null = null;
let swInitialized = false;

function notifyUpdateListeners(buildId: string | null) {
  detectedBuildId = buildId;
  updateListeners.forEach((cb) => cb(buildId));
}

function initServiceWorkerUpdater() {
  if (swInitialized || typeof window === 'undefined') return;
  swInitialized = true;

  const isLocalAssetBundle = window.location.hostname === 'appassets.androidplatform.net';
  if (isLocalAssetBundle || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    updateSWFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        notifyUpdateListeners('new-sw');
      },
      onRegisteredSW(_swUrl, reg) {
        swRegistration = reg;
        if (reg) {
          setInterval(() => {
            void reg.update().catch(() => {});
          }, 60 * 1000);
        }
      },
    });
  } catch {
    // Service worker registration unsupported in current context
  }
}

export async function checkRemoteAppVersion(): Promise<{
  hasUpdate: boolean;
  latestBuildId: string | null;
}> {
  if (typeof window === 'undefined') {
    return { hasUpdate: false, latestBuildId: null };
  }

  if (swRegistration) {
    try {
      await swRegistration.update();
    } catch {
      // Ignore SW check error
    }
  }

  // Only poll version.json over http/https (not Android offline asset origin)
  if (
    window.location.protocol.startsWith('http') &&
    window.location.hostname !== 'appassets.androidplatform.net'
  ) {
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = (await res.json()) as VersionManifest;
        if (
          data?.app === 'aqsa-bms' &&
          data.buildId &&
          currentBuildId !== 'dev' &&
          data.buildId !== currentBuildId
        ) {
          notifyUpdateListeners(data.buildId);
          return { hasUpdate: true, latestBuildId: data.buildId };
        }
      }
    } catch {
      // Offline or unreachable
    }
  }

  return { hasUpdate: Boolean(detectedBuildId), latestBuildId: detectedBuildId };
}

export function useAppUpdater() {
  const [latestBuildId, setLatestBuildId] = useState<string | null>(detectedBuildId);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    initServiceWorkerUpdater();

    const listener = (nextBuild: string | null) => setLatestBuildId(nextBuild);
    updateListeners.add(listener);

    const handleFocusOrOnline = () => {
      void checkRemoteAppVersion();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkRemoteAppVersion();
      }
    };

    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    const pollId = window.setInterval(() => {
      if (navigator.onLine) {
        void checkRemoteAppVersion();
      }
    }, 90 * 1000);

    return () => {
      updateListeners.delete(listener);
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(pollId);
    };
  }, []);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      return await checkRemoteAppVersion();
    } finally {
      setChecking(false);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    try {
      if (updateSWFn) {
        await updateSWFn(true);
      }
    } catch {
      // Fallback to hard reload
    }
    if (window.AqsaAndroidBridge?.reloadApp) {
      window.AqsaAndroidBridge.reloadApp();
    } else {
      window.location.reload();
    }
  }, []);

  return {
    currentBuildId,
    currentBuiltAt,
    hasUpdate: Boolean(latestBuildId),
    latestBuildId,
    checking,
    checkNow,
    applyUpdate,
  };
}
