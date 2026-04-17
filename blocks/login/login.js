/**
 * Adobe EDS — Login Gmail Block
 *
 * Authenticates users via Google OAuth 2.0 (popup or redirect flow).
 * Optionally validates that the signed-in account uses a specific domain.
 *
 * Block table structure (in Google Doc / SharePoint):
 * ┌─────────────────┬──────────────────────────────────────────┐
 * │ Login Gmail     │                                          │
 * ├─────────────────┼──────────────────────────────────────────┤
 * │ clientid        │ YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com │
 * │ redirect        │ /dashboard                               │
 * │ scope           │ openid email profile                     │
 * │ hd              │ mycompany.com  (optional hosted domain)  │
 * │ flow            │ popup  OR  redirect  (default: popup)    │
 * │ title           │ Welcome                                  │
 * │ subtitle        │ Sign in with your Google account         │
 * │ buttonlabel     │ Continue with Google                     │
 * └─────────────────┴──────────────────────────────────────────┘
 */

/* ── Helpers ─────────────────────────────────────────── */

function parseConfig(block) {
  const config = {};
  [...block.querySelectorAll(':scope > div')].forEach((row) => {
    const cells = row.querySelectorAll(':scope > div');
    if (cells.length >= 2) {
      config[cells[0].textContent.trim().toLowerCase()] = cells[1].textContent.trim();
    }
  });
  return config;
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function setStatus(card, type, message) {
  let el = qs('.lgm-status', card);
  if (!el) {
    el = document.createElement('p');
    el.className = 'lgm-status';
    qs('.lgm-body', card).prepend(el);
  }
  el.className = `lgm-status lgm-status--${type}`;
  el.textContent = message;
  el.setAttribute('role', 'alert');
}

function clearStatus(card) {
  qs('.lgm-status', card)?.remove();
}

/* ── Google Identity Services loader ─────────────────── */

let gisReady = false;
let gisCallbacks = [];

function loadGIS() {
  return new Promise((resolve) => {
    if (gisReady) return resolve();
    gisCallbacks.push(resolve);
    if (qs('script[src*="accounts.google.com/gsi/client"]')) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      gisReady = true;
      gisCallbacks.forEach((cb) => cb());
      gisCallbacks = [];
    };
    document.head.append(s);
  });
}

/* ── OAuth popup flow ─────────────────────────────────── */

function buildOAuthURL(config) {
  const params = new URLSearchParams({
    client_id: config.clientid,
    redirect_uri: window.location.origin + (config.callbackpath || '/auth/google/callback'),
    response_type: 'code',
    scope: config.scope || 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  if (config.hd) params.set('hd', config.hd);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function popupLogin(config) {
  return new Promise((resolve, reject) => {
    const url = buildOAuthURL(config);
    const w = 500, h = 620;
    const left = Math.round(screen.width / 2 - w / 2);
    const top = Math.round(screen.height / 2 - h / 2);
    const popup = window.open(url, 'google-login', `width=${w},height=${h},left=${left},top=${top}`);

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          reject(new Error('Sign-in was cancelled.'));
          return;
        }
        const href = popup.location.href;
        if (href.includes(window.location.origin)) {
          clearInterval(timer);
          popup.close();
          const params = new URL(href).searchParams;
          if (params.get('error')) {
            reject(new Error(params.get('error_description') || 'Google sign-in failed.'));
          } else {
            resolve({ code: params.get('code'), state: params.get('state') });
          }
        }
      } catch {
        /* cross-origin — still loading */
      }
    }, 300);
  });
}

/* ── One Tap / GIS button (Google Identity Services) ──── */

function renderGISButton(config, container, card) {
  loadGIS().then(() => {
    if (!window.google?.accounts?.id) {
      setStatus(card, 'error', 'Google Sign-In library failed to load.');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: config.clientid,
      callback: (response) => handleCredentialResponse(response, config, card),
      hosted_domain: config.hd || undefined,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      logo_alignment: 'left',
      text: 'continue_with',
      width: container.offsetWidth || 320,
    });

    // Also prompt One Tap if available
    window.google.accounts.id.prompt();
  });
}

function handleCredentialResponse(response, config, card) {
  clearStatus(card);
  if (!response.credential) {
    setStatus(card, 'error', 'No credential returned from Google.');
    return;
  }

  // Decode JWT payload (display purposes — server must verify signature)
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Domain restriction check (client-side hint; enforce server-side too)
    if (config.hd && payload.hd !== config.hd) {
      setStatus(card, 'error', `Only @${config.hd} accounts are allowed.`);
      return;
    }

    showUserPreview(card, payload);
    sendCredentialToServer(response.credential, config, card, payload);
  } catch {
    setStatus(card, 'error', 'Failed to read Google credential.');
  }
}

function showUserPreview(card, payload) {
  const body = qs('.lgm-body', card);
  let preview = qs('.lgm-user-preview', card);
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'lgm-user-preview';
    body.append(preview);
  }
  preview.innerHTML = `
    ${payload.picture ? `<img src="${payload.picture}" alt="" class="lgm-avatar" width="48" height="48">` : ''}
    <div class="lgm-user-info">
      <span class="lgm-user-name">${payload.name || ''}</span>
      <span class="lgm-user-email">${payload.email || ''}</span>
    </div>
    <span class="lgm-spinner" aria-hidden="true"></span>
  `;
}

async function sendCredentialToServer(credential, config, card, payload) {
  const action = config.action || '/api/auth/google';
  try {
    const res = await fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Authentication failed. Please try again.');
    }
    setStatus(card, 'success', `Signed in as ${payload.email}. Redirecting…`);
    setTimeout(() => {
      window.location.href = config.redirect || '/';
    }, 800);
  } catch (err) {
    qs('.lgm-user-preview', card)?.remove();
    setStatus(card, 'error', err.message);
  }
}

/* ── Fallback custom button (when clientid missing) ───── */

function renderFallbackButton(config, container, card) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lgm-btn';
  btn.setAttribute('aria-label', config.buttonlabel || 'Continue with Google');
  btn.innerHTML = `
    <svg class="lgm-google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
    <span>${config.buttonlabel || 'Continue with Google'}</span>
  `;

  btn.addEventListener('click', async () => {
    clearStatus(card);
    btn.disabled = true;
    btn.classList.add('lgm-btn--loading');

    try {
      if (config.flow === 'redirect') {
        window.location.href = buildOAuthURL(config);
        return;
      }
      const result = await popupLogin(config);
      setStatus(card, 'success', 'Google sign-in successful. Redirecting…');
      // Exchange code server-side
      const res = await fetch(config.action || '/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Authentication failed.');
      }
      setTimeout(() => { window.location.href = config.redirect || '/'; }, 600);
    } catch (err) {
      setStatus(card, 'error', err.message);
      btn.disabled = false;
      btn.classList.remove('lgm-btn--loading');
    }
  });

  container.append(btn);
}

/* ── Card builder ─────────────────────────────────────── */

function buildCard(config) {
  const card = document.createElement('div');
  card.className = 'lgm-card';

  // Brand logo area
  const brand = document.createElement('div');
  brand.className = 'lgm-brand';
  brand.innerHTML = `
    <svg class="lgm-brand-icon" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#FA0F00"/>
      <path d="M6 8.5L14 15.5L22 8.5V19.5C22 20.05 21.55 20.5 21 20.5H7C6.45 20.5 6 20.05 6 19.5V8.5Z" fill="white"/>
      <path d="M6 8.5L14 15.5L22 8.5H6Z" fill="#FFCDD2"/>
    </svg>
    <span class="lgm-brand-name">Gmail Sign-In</span>
  `;

  // Header
  const header = document.createElement('div');
  header.className = 'lgm-header';
  header.innerHTML = `
    <h1 class="lgm-title">${config.title || 'Sign in'}</h1>
    <p class="lgm-subtitle">${config.subtitle || 'Use your Google account to continue'}</p>
    ${config.hd ? `<p class="lgm-domain-badge">@${config.hd} accounts only</p>` : ''}
  `;

  // Button container
  const body = document.createElement('div');
  body.className = 'lgm-body';

  const btnContainer = document.createElement('div');
  btnContainer.className = 'lgm-btn-container';

  body.append(btnContainer);

  // Privacy note
  const privacy = document.createElement('p');
  privacy.className = 'lgm-privacy';
  privacy.innerHTML = `By signing in you agree to our <a href="${config.termsurl || '/terms'}">Terms</a> and <a href="${config.privacyurl || '/privacy'}">Privacy Policy</a>.`;

  card.append(brand, header, body, privacy);

  // Render button strategy
  if (config.clientid) {
    renderGISButton(config, btnContainer, card);
  } else {
    renderFallbackButton(config, btnContainer, card);
  }

  return card;
}

/* ── decorate (EDS entry point) ───────────────────────── */

export default function decorate(block) {
  const config = parseConfig(block);
  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'lgm-wrapper';
  wrapper.append(buildCard(config));
  block.append(wrapper);
}
