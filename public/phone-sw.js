self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch { /* Use a generic alert. */ }
  event.waitUntil(self.registration.showNotification(message.title || 'AgentPass payment request', {
    body: message.body || 'Open AgentPass to review your request.',
    icon: '/phone-icon.png', badge: '/phone-icon.png',
    tag: message.tag || 'agentpass-payment', data: { url: '/phone' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/phone'));
});
// Deliberately do not cache authenticated pages or payment requests.
