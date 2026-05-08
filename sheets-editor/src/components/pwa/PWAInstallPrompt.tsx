'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PWAInstallPrompt() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      toast('App installed successfully!', 'success');
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();

    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      toast('Thanks! App installation started.', 'success');
    } else {
      toast('Install dismissed. You can install it later from your browser menu.', 'info');
    }

    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismissClick = () => {
    setShowInstallPrompt(false);
    toast('Install prompt hidden. Use your browser menu to add the app later.', 'info');
  };

  return (
    <>
      {!isOnline && (
        <div className="fixed top-4 left-4 right-4 z-50 rounded-2xl border px-4 py-3 text-sm shadow-lg" style={{ background: 'rgba(17, 24, 39, 0.95)', borderColor: 'rgba(255,255,255,0.08)', color: 'white' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span style={{ display: 'inline-flex', width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
              <span>Offline mode active. Cached content is available, but saves require network connectivity.</span>
            </div>
          </div>
        </div>
      )}

      {showInstallPrompt && isOnline && (
        <div className="fixed bottom-6 left-4 right-4 z-50 rounded-2xl border bg-slate-950/95 px-4 py-4 shadow-2xl backdrop-blur" style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'white' }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Install NAYCA Schedule</div>
              <div className="mt-1 text-sm text-slate-300">Add the app to your home screen for faster access and better offline support.</div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                onClick={handleInstallClick}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-300"
              >
                Install app
              </button>
              <button
                onClick={handleDismissClick}
                className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
