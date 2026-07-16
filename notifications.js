const SABI_API = 'https://sabicars-api.onrender.com/api';
const ONESIGNAL_APP_ID = '6f283e9c-796d-45b1-9873-3c5116b91e61'; // replace after creating account

// ── NOTIFICATION BELL ──
function injectNotificationBell() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight || document.getElementById('notifBell')) return;

  const bell = document.createElement('div');
  bell.id = 'notifBell';
  bell.style.cssText = 'position:relative;cursor:pointer;margin-right:4px;';
  bell.innerHTML = `
    <button id="notifBtn" style="background:transparent;border:none;cursor:pointer;color:var(--text);font-size:1.05rem;padding:6px;position:relative;width:auto;" onclick="toggleNotifPanel()">
      <i class="fas fa-bell"></i>
      <span id="notifBadge" style="display:none;position:absolute;top:2px;right:2px;width:16px;height:16px;background:#DC2626;border-radius:50%;font-size:.55rem;font-weight:700;color:#fff;display:none;align-items:center;justify-content:center;"></span>
    </button>
    <div id="notifPanel" style="display:none;position:absolute;top:44px;right:0;width:310px;background:var(--card,#1a1a1a);border:1px solid var(--border2,#2a2a2a);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.4);z-index:999;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border2,#2a2a2a);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:.78rem;font-weight:700;color:var(--text,#eee);">🔔 Updates</span>
        <button onclick="markAllRead()" style="background:transparent;border:none;color:#d4af37;font-size:.68rem;cursor:pointer;width:auto;padding:0;">Mark all read</button>
      </div>
      <div id="notifList" style="max-height:320px;overflow-y:auto;"></div>
      <div style="padding:10px 16px;border-top:1px solid var(--border2,#2a2a2a);text-align:center;">
        <span style="font-size:.7rem;color:var(--muted,#888);">Sabicars Updates · <a href="cars.html" style="color:#d4af37;">Browse Inventory</a></span>
      </div>
    </div>
  `;

  const themeBtn = headerRight.querySelector('.theme-btn');
  if (themeBtn) headerRight.insertBefore(bell, themeBtn);
  else headerRight.prepend(bell);

  loadNotifications();

  document.addEventListener('click', (e) => {
    if (!bell.contains(e.target)) document.getElementById('notifPanel').style.display = 'none';
  });
}

let notifData = [];
const NOTIF_READ_KEY = 'sabi_notif_read_ts';

async function loadNotifications() {
  try {
    const res = await fetch(SABI_API + '/notifications');
    const data = await res.json();
    if (!data.success) return;
    notifData = data.notifications;
    renderNotifications();
    updateBadge();
  } catch (e) {}
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  const icons = { car: '🚗', blog: '📝', offer: '🔥', system: '📢' };
  if (!notifData.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted,#888);font-size:.8rem;">No updates yet</div>';
    return;
  }
  const readTs = Number(localStorage.getItem(NOTIF_READ_KEY) || 0);
  list.innerHTML = notifData.map(n => {
    const isNew = new Date(n.createdAt).getTime() > readTs;
    return `<div style="padding:12px 16px;border-bottom:1px solid var(--border2,#2a2a2a);${isNew ? 'background:rgba(212,175,55,.06);' : ''}cursor:pointer;" onclick="notifClick('${n.link || ''}')">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:1.1rem;flex-shrink:0;">${icons[n.type] || '📢'}</span>
        <div>
          <div style="font-size:.8rem;font-weight:700;color:var(--text,#eee);margin-bottom:2px;">${n.title}${isNew ? '<span style="background:#d4af37;color:#000;font-size:.55rem;padding:1px 5px;border-radius:3px;margin-left:6px;font-weight:800;">NEW</span>' : ''}</div>
          <div style="font-size:.74rem;color:var(--muted,#888);line-height:1.4;">${n.message}</div>
          <div style="font-size:.65rem;color:var(--muted2,#666);margin-top:4px;">${timeAgo(n.createdAt)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const readTs = Number(localStorage.getItem(NOTIF_READ_KEY) || 0);
  const unread = notifData.filter(n => new Date(n.createdAt).getTime() > readTs).length;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function markAllRead() {
  localStorage.setItem(NOTIF_READ_KEY, Date.now().toString());
  renderNotifications();
  updateBadge();
}

function notifClick(link) {
  markAllRead();
  document.getElementById('notifPanel').style.display = 'none';
  if (link) window.location.href = link;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

// ── SUBSCRIBE POPUP ──
function initSubscribePopup() {
  if (localStorage.getItem('sabi_subscribed')) return;
  let scrollOk = false, timeOk = false;
  const tryShow = () => { if (scrollOk && timeOk && !localStorage.getItem('sabi_subscribed') && !document.getElementById('subPopup')) showSubscribePopup(); };
  setTimeout(() => { timeOk = true; tryShow(); }, 60000);
  const onScroll = () => {
    const pct = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
    if (pct > 0.5) { scrollOk = true; window.removeEventListener('scroll', onScroll); tryShow(); }
  };
  window.addEventListener('scroll', onScroll);
}

function showSubscribePopup() {
  const overlay = document.createElement('div');
  overlay.id = 'subPopup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:var(--card,#1a1a1a);border:1px solid var(--border2,#2a2a2a);border-radius:14px;padding:32px;max-width:380px;width:100%;position:relative;text-align:center;">
      <button onclick="closeSubscribePopup()" style="position:absolute;top:12px;right:12px;background:transparent;border:none;color:var(--muted,#888);font-size:1.1rem;cursor:pointer;width:auto;padding:4px;"><i class="fas fa-times"></i></button>
      <div style="font-size:2.2rem;margin-bottom:14px;">📬</div>
      <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;color:var(--text,#eee);margin-bottom:8px;">Stay in the Loop</h3>
      <p style="font-size:.83rem;color:var(--muted,#888);font-weight:300;line-height:1.6;margin-bottom:22px;">Get notified when new vehicles arrive, special offers drop, and exclusive deals go live. No spam — only the good stuff.</p>
      <div id="subForm">
        <input id="subName" type="text" placeholder="Your name" style="width:100%;padding:10px 12px;margin-bottom:10px;background:var(--bg,#111);border:1px solid var(--border2,#2a2a2a);border-radius:6px;color:var(--text,#eee);font-size:.85rem;font-family:inherit;" maxlength="100"/>
        <input id="subEmail" type="email" placeholder="Your email address *" style="width:100%;padding:10px 12px;margin-bottom:10px;background:var(--bg,#111);border:1px solid var(--border2,#2a2a2a);border-radius:6px;color:var(--text,#eee);font-size:.85rem;font-family:inherit;" maxlength="200"/>
        <p id="subMsg" style="display:none;font-size:.78rem;color:#ff6b6b;margin-bottom:10px;"></p>
        <button onclick="submitSubscribe()" style="width:100%;padding:12px;background:#d4af37;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:.88rem;letter-spacing:.06em;">Subscribe Free</button>
        <button onclick="closeSubscribePopup()" style="width:100%;padding:10px;background:transparent;border:none;color:var(--muted,#888);cursor:pointer;font-size:.75rem;margin-top:6px;">No thanks</button>
      </div>
      <div id="subThanks" style="display:none;padding:16px 0;">
        <div style="font-size:2.5rem;margin-bottom:12px;">🎉</div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:#d4af37;margin-bottom:6px;">You're In!</h3>
        <p style="font-size:.84rem;color:var(--muted,#888);font-weight:300;">Watch your inbox for new arrivals and exclusive offers from Sabicars.</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeSubscribePopup() {
  const popup = document.getElementById('subPopup');
  if (popup) popup.remove();
}

async function submitSubscribe() {
  const name = document.getElementById('subName').value.trim();
  const email = document.getElementById('subEmail').value.trim();
  const msgEl = document.getElementById('subMsg');
  if (!email) { msgEl.textContent = 'Please enter your email.'; msgEl.style.display = 'block'; return; }
  try {
    const res = await fetch(SABI_API + '/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('sabi_subscribed', '1');
      document.getElementById('subForm').style.display = 'none';
      document.getElementById('subThanks').style.display = 'block';
      setTimeout(closeSubscribePopup, 3500);
    } else {
      msgEl.textContent = data.message || 'Something went wrong.';
      msgEl.style.display = 'block';
    }
  } catch (e) { msgEl.textContent = 'Network error. Try again.'; msgEl.style.display = 'block'; }
}

// ── ONESIGNAL PUSH ──
function initOneSignal() {
  if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
    console.log('OneSignal: App ID not set');
    return;
  }
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        // Ensure the path includes your GitHub repository name
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
        notifyButton: { enable: true },
      });
      console.log('OneSignal: initialized successfully');
      OneSignal.Slidedown.promptPush();
    } catch (e) {
      console.error('OneSignal init error:', e);
    }
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  injectNotificationBell();
  initSubscribePopup();
  initOneSignal();
});
