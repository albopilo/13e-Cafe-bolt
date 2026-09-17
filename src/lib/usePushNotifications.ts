import { useEffect, useRef } from 'react';
import { messaging, getToken, onMessage } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const VAPID_KEY = 'BB46kklO696abLSqlK13UKbJh5zCJR-ZCjNa4j4NE08X7JOSJM_IpsJIjsLck4Aqx9QEnQ6Rid4gjLhk1cNjd2w';

export function usePushNotifications() {
  const { session, isAdmin, isStaff } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!session || registeredRef.current) return;
    if (!isAdmin && !isStaff) return;
    if (!messaging || !('serviceWorker' in navigator)) return;

    registeredRef.current = true;

    (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;

        const fcmToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!fcmToken) return;

        const role = isAdmin ? 'admin' : 'staff';

        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token: fcmToken, role }),
        });
      } catch {
        // Push registration failed — not critical, dashboard still works
      }
    })();

    if (messaging) {
      const unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'New Order';
        const body = payload.notification?.body || 'You have a new order';

        if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
              body,
              icon: '/vite.svg',
              badge: '/vite.svg',
              tag: 'new-order',
              requireInteraction: true,
              data: { url: '/staff' },
            });
          }).catch(() => {
            new Notification(title, { body, icon: '/vite.svg', tag: 'new-order' });
          });
        } else if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/vite.svg', tag: 'new-order' });
        }
      });
      return () => unsub();
    }
  }, [session, isAdmin, isStaff]);
}
