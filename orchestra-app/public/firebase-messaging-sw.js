// Import Firebase scripts for messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a-3b48e.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45",
  measurementId: "G-B58VR5VGT4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background message reception
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Orchestra';
  const notificationOptions = {
    body: payload.notification?.body || 'Nouvelle notification',
    icon: payload.notification?.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: payload.data?.notificationId || 'orchestra-notification',
    data: {
      ...payload.data,
      click_action: payload.notification?.click_action || payload.data?.actionUrl || '/'
    },
    requireInteraction: payload.data?.priority === 'critical',
    silent: payload.data?.silent === 'true',
    timestamp: Date.now(),
    actions: []
  };

  // Add custom actions if provided
  if (payload.data?.actions) {
    try {
      const actions = JSON.parse(payload.data.actions);
      notificationOptions.actions = actions.slice(0, 2).map(action => ({
        action: action.action,
        title: action.title,
        icon: action.icon || '/icons/action-icon.png'
      }));
    } catch (error) {
      console.error('Error parsing notification actions:', error);
    }
  }

  // Add sound for high priority notifications
  if (payload.data?.priority === 'high' || payload.data?.priority === 'critical') {
    notificationOptions.vibrate = [200, 100, 200];
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received:', event);

  event.notification.close();

  const clickAction = event.notification.data?.click_action || '/';
  const notificationId = event.notification.data?.notificationId;

  // Handle action button clicks
  if (event.action) {
    console.log('Action clicked:', event.action);
    
    // Handle specific actions
    switch (event.action) {
      case 'approve':
      case 'view':
      case 'open':
        handleNotificationAction(event.action, event.notification.data);
        break;
      default:
        // Open the app for unknown actions
        openAppWindow(clickAction);
    }
  } else {
    // Handle notification body click
    openAppWindow(clickAction);
  }

  // Mark notification as interacted
  if (notificationId) {
    markNotificationAsInteracted(notificationId);
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] Notification closed:', event);
  
  // Track notification dismissal if needed
  const notificationId = event.notification.data?.notificationId;
  if (notificationId) {
    // Could send analytics about dismissed notifications
    console.log('Notification dismissed:', notificationId);
  }
});

// Helper function to open app window
function openAppWindow(url) {
  const urlToOpen = new URL(url, self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
}

// Helper function to handle notification actions
function handleNotificationAction(action, data) {
  console.log('Handling notification action:', action, data);
  
  // Build action URL based on the action and notification data
  let actionUrl = '/';
  
  switch (action) {
    case 'approve':
      actionUrl = `/workflows/${data.workflowId}/approve`;
      break;
    case 'view':
      actionUrl = data.actionUrl || '/notifications';
      break;
    case 'open':
      actionUrl = data.actionUrl || '/';
      break;
    default:
      actionUrl = data.actionUrl || '/';
  }

  openAppWindow(actionUrl);
}

// Helper function to mark notification as interacted
function markNotificationAsInteracted(notificationId) {
  // Send a message to the main app about the interaction
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      if (clientList.length > 0) {
        // Send message to the first available client
        clientList[0].postMessage({
          type: 'NOTIFICATION_CLICKED',
          notificationId: notificationId,
          timestamp: Date.now()
        });
      }
    });
}

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[firebase-messaging-sw.js] Push subscription changed:', event);
  
  event.waitUntil(
    // Re-register push subscription
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_KEY_HERE' // Should be set from environment
    }).then((subscription) => {
      console.log('Push subscription renewed:', subscription);
      
      // Send new subscription to server
      return fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          subscription: subscription
        })
      });
    }).catch((error) => {
      console.error('Error renewing push subscription:', error);
    })
  );
});

// Handle installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installing');
  self.skipWaiting();
});

// Handle activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Periodic background sync for checking missed notifications
self.addEventListener('sync', (event) => {
  console.log('[firebase-messaging-sw.js] Background sync:', event.tag);
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkMissedNotifications());
  }
});

// Helper function to check for missed notifications
async function checkMissedNotifications() {
  try {
    // This would typically check with your backend for any notifications
    // that might have been missed while the user was offline
    console.log('Checking for missed notifications...');
    
    // Example implementation:
    // const response = await fetch('/api/missed-notifications');
    // const notifications = await response.json();
    // 
    // for (const notification of notifications) {
    //   await self.registration.showNotification(notification.title, {
    //     body: notification.body,
    //     icon: '/icons/icon-192x192.png',
    //     tag: notification.id,
    //     data: notification.data
    //   });
    // }
  } catch (error) {
    console.error('Error checking missed notifications:', error);
  }
}

// Handle messages from the main application
self.addEventListener('message', (event) => {
  console.log('[firebase-messaging-sw.js] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '1.0.0' });
  }
});