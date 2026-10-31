/* ABC Selaras — Service Worker untuk notifikasi push ke perangkat. */

self.addEventListener('install', function(event){
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event){
  var data = {};
  try{
    data = event.data ? event.data.json() : {};
  }catch(e){
    data = { title: 'ABC Selaras', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'ABC Selaras';
  var options = {
    body: data.body || '',
    icon: data.icon || 'icon-192.png',
    badge: data.badge || 'icon-192.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  /* url dari server berupa '#nama-halaman' atau '/'. Harus diarahkan ke halaman aplikasi
     (scope service worker), BUKAN relatif ke sw.js — kalau tidak, iPhone membuka isi sw.js. */
  var raw = (event.notification.data && event.notification.data.url) || '';
  var scope = self.registration.scope;              /* mis. https://abcselaras.my.id/web/ */
  var link = String(raw).indexOf('#')===0 ? String(raw).slice(1) : '';
  var targetUrl = scope + 'index.html' + (link ? '#' + link : '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList){
      for(var i=0;i<clientList.length;i++){
        var client = clientList[i];
        if(client.url && client.url.indexOf(scope)===0 && 'focus' in client){
          try{ client.postMessage({ type:'notif-open', link: link }); }catch(e){}
          return client.focus();
        }
      }
      if(self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
