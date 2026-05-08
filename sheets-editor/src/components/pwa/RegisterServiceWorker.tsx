'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('Service worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
