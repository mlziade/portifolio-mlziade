const CACHE_NAME = 'mlziade-portfolio-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/static/base.css',
  '/static/responsive.css',
  '/static/profile_picture.jpg',
  '/static/us.svg',
  '/static/br.svg'
];

// External domains to allow for social media integration
const ALLOWED_EXTERNAL_DOMAINS = [
  'x.com',
  'twitter.com',
  'linkedin.com',
  'github.com',
  'instagram.com'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .catch((error) => {
        console.log('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Allow external social media requests to pass through
  const url = new URL(event.request.url);
  if (ALLOWED_EXTERNAL_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Return a basic offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response('Offline - Please check your connection', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        }
      })
  );
});
