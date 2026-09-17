import { useEffect, useRef } from 'react';
import { messaging, getToken, onMessage } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { playNotificationRing } from '@/lib/notificationSound';

const VAPID_KEY = 'BB46kklO696abLSqlK13UKbJh5zCJR-ZCjNa4j4NE08X7JOSJM_IpsJIjsLck4Aqx9QEnQ6Rid4gjLhk1cNjd2w';

async function registerToken(token: string, role: string, accessToken: string) {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token, role }),
  });
}

export function usePushNotifications() {
  const { session, isAdmin, isStaff } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!session || registeredRef.current) return;
    if (!isAdmin && !isStaff) return;
    if (!messaging || !('serviceWorker' in navigator)) return;

    registeredRef.current = true;

    let unsubMessage: (() => void) | null = null;

    (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Register the service worker and wait for it to be ready
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        const fcmToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!fcmToken) return;

        const role = isAdmin ? 'admin' : 'staff';
        await registerToken(fcmToken, role, session.access_token);
      } catch {
        // Push registration failed — not critical, dashboard still works
      }
    })();

    // Foreground message handler — fires when app is open
    // With data-only messages, payload.data contains title/body/url
    if (messaging) {
      unsubMessage = onMessage(messaging, (payload) => {
        // Support both notification and data payload styles
        const data = payload.data || {};
        const notification = payload.notification || {};
        const title = notification.title || data.title || 'New Order!';
        const body = notification.body || data.body || 'You have a new order';

        // Play the ringing sound in foreground
        playNotificationRing();

        // Also show a visual notification (works when tab is not focused)
        if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: data.tag || 'new-order',
              requireInteraction: true,
              renotify: true,
              vibrate: [200, 100, 200, 100, 200, 100, 400],
              data: { url: data.url || '/staff', ...data },
            });
          }).catch(() => {
            new Notification(title, { body, icon: '/icon-192.png', tag: 'new-order' });
          });
        } else if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icon-192.png', tag: 'new-order' });
        }
      });
    }

    return () => {
      if (unsubMessage) unsubMessage();
    };
  }, [session, isAdmin, isStaff]);
}
