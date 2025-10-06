// Orchestr'A Service Worker - PWA Offline-First
const CACHE_NAME = 'orchestra-v4-half-day-complete-fix';
const CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('🚀 Orchestr\'A Service Worker: Installation en cours');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache ouvert, ajout des ressources critiques');
        return cache.addAll(CACHE_URLS);
      })
  );
  // Activer immédiatement le nouveau service worker
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('✅ Orchestr\'A Service Worker: Activation terminée');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prendre contrôle immédiatement de tous les clients
  return self.clients.claim();
});

// Stratégie Cache First pour les ressources statiques
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Ignorer les requêtes POST, PUT, DELETE (ne peuvent pas être mises en cache)
  if (event.request.method !== 'GET') {
    return;
  }

  // Stratégie différente selon le type de ressource
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase')) {
    // Laisser passer les requêtes Firebase/Firestore sans interception
    return;
  } else if (event.request.destination === 'document') {
    // Network First pour les pages HTML
    event.respondWith(networkFirst(event.request));
  } else {
    // Cache First pour les ressources statiques
    event.respondWith(cacheFirst(event.request));
  }
});

// Stratégie Cache First
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('🔗 Ressource non disponible offline:', request.url);
    // Retourner une page offline basique pour les documents
    if (request.destination === 'document') {
      return new Response(
        `<!DOCTYPE html>
         <html><head><title>Orchestr'A - Mode Hors Ligne</title>
         <style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5}
         .offline{color:#666;font-size:18px}</style></head>
         <body><h1>🌐 Orchestr'A</h1>
         <p class="offline">Mode hors ligne - Certaines fonctionnalités peuvent être limitées</p>
         <p><a href="/">Réessayer la connexion</a></p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    throw error;
  }
}

// Stratégie Network First
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('🔗 Réseau non disponible, tentative cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Pour les requêtes Firestore/Firebase, laisser passer l'erreur sans intercepter
    if (request.url.includes('firestore.googleapis.com') || request.url.includes('firebase')) {
      return fetch(request);
    }
    throw error;
  }
}

// Gestion des messages depuis l'application
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.addAll(event.data.urls))
    );
  }
});

// Notifications Push (pour les futures fonctionnalités)
self.addEventListener('push', event => {
  console.log('📬 Notification push reçue');
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo192.png',
      badge: '/favicon.ico',
      tag: 'orchestra-notification',
      renotify: true,
      requireInteraction: true,
      actions: [
        {
          action: 'open',
          title: 'Ouvrir Orchestr\'A',
          icon: '/logo192.png'
        },
        {
          action: 'close',
          title: 'Fermer'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Orchestr\'A', options)
    );
  }
});

// Gestion des clics sur notifications
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('🎯 Orchestr\'A Service Worker: Chargé et prêt pour PWA offline-first');