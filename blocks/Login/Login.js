/**
 * Adobe EDS Login Block
 * Renders a login form with email/password fields and handles authentication.
 *
 * Block Table Structure (in document):
 * | Login          |
 * | action         | /api/login (optional)
 * | redirect       | /dashboard (optional)
 * | title          | Welcome Back (optional)
 * | subtitle       | Sign in to continue (optional)
 */

function showError(form, message) {
  let errorEl = form.querySelector('.login-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'login-error';
    form.prepend(errorEl);
  }
  errorEl.textContent = message;
  errorEl.setAttribute('role', 'alert');
}

function clearError(form) {
  const errorEl = form.querySelector('.login-error');
  if (errorEl) errorEl.remove();
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.setAttribute('aria-busy', loading);
  button.textContent = loading ? 'Signing in…' : 'Sign In';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleSubmit(e, config) {
  e.preventDefault();
  const form = e.target;
  const email = form.querySelector('#login-email').value.trim();
  const password = form.querySelector('#login-password').value;
  const submitBtn = form.querySelector('.login-submit');

  clearError(form);

  if (!email || !validateEmail(email)) {
    showError(form, 'Please enter a valid email address.');
    form.querySelector('#login-email').focus();
    return;
  }

  if (!password || password.length < 6) {
    showError(form, 'Password must be at least 6 characters.');
    form.querySelector('#login-password').focus();
    return;
  }

  setLoading(submitBtn, true);

  try {
    const action = config.action || '/api/login';
    const response = await fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Invalid email or password.');
    }

    // Successful login — redirect
    const redirect = config.redirect || '/';
    window.location.href = redirect;
  } catch (err) {
    showError(form, err.message || 'Something went wrong. Please try again.');
    setLoading(submitBtn, false);
  }
}

function parseConfig(block) {
  const config = {};
  const rows = [...block.querySelectorAll(':scope > div')];

  rows.forEach((row) => {
    const cells = row.querySelectorAll(':scope > div');
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      const value = cells[1].textContent.trim();
      config[key] = value;
    }
  });

  return config;
}

function buildLoginForm(config) {
  const wrapper = document.createElement('div');
  wrapper.className = 'login-wrapper';

  const card = document.createElement('div');
  card.className = 'login-card';

  // Header
  const header = document.createElement('div');
  header.className = 'login-header';

  const title = document.createElement('h1');
  title.className = 'login-title';
  title.textContent = config.title || 'Welcome Back';

  const subtitle = document.createElement('p');
  subtitle.className = 'login-subtitle';
  subtitle.textContent = config.subtitle || 'Sign in to your account to continue';

  header.append(title, subtitle);

  // Form
  const form = document.createElement('form');
  form.className = 'login-form';
  form.setAttribute('novalidate', '');

  // Email field
  const emailGroup = document.createElement('div');
  emailGroup.className = 'login-field';

  const emailLabel = document.createElement('label');
  emailLabel.htmlFor = 'login-email';
  emailLabel.className = 'login-label';
  emailLabel.textContent = 'Email address';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'login-email';
  emailInput.name = 'email';
  emailInput.className = 'login-input';
  emailInput.placeholder = 'you@example.com';
  emailInput.autocomplete = 'email';
  emailInput.required = true;

  emailGroup.append(emailLabel, emailInput);

  // Password field
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'login-field';

  const passwordHeader = document.createElement('div');
  passwordHeader.className = 'login-field-header';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'login-password';
  passwordLabel.className = 'login-label';
  passwordLabel.textContent = 'Password';

  const forgotLink = document.createElement('a');
  forgotLink.href = config.forgoturl || '/forgot-password';
  forgotLink.className = 'login-forgot';
  forgotLink.textContent = 'Forgot password?';

  passwordHeader.append(passwordLabel, forgotLink);

  const passwordInputWrapper = document.createElement('div');
  passwordInputWrapper.className = 'login-password-wrapper';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'login-password';
  passwordInput.name = 'password';
  passwordInput.className = 'login-input';
  passwordInput.placeholder = '••••••••';
  passwordInput.autocomplete = 'current-password';
  passwordInput.required = true;

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'login-toggle-password';
  toggleBtn.setAttribute('aria-label', 'Show password');
  toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });

  passwordInputWrapper.append(passwordInput, toggleBtn);
  passwordGroup.append(passwordHeader, passwordInputWrapper);

  // Remember me
  const rememberGroup = document.createElement('div');
  rememberGroup.className = 'login-remember';

  const rememberLabel = document.createElement('label');
  rememberLabel.className = 'login-checkbox-label';

  const rememberInput = document.createElement('input');
  rememberInput.type = 'checkbox';
  rememberInput.id = 'login-remember';
  rememberInput.name = 'remember';
  rememberInput.className = 'login-checkbox';

  const rememberText = document.createElement('span');
  rememberText.textContent = 'Remember me for 30 days';

  rememberLabel.append(rememberInput, rememberText);
  rememberGroup.append(rememberLabel);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'login-submit';
  submitBtn.textContent = 'Sign In';

  // Social divider
  const divider = document.createElement('div');
  divider.className = 'login-divider';
  divider.innerHTML = '<span>or continue with</span>';

  // Social buttons
  const socialGroup = document.createElement('div');
  socialGroup.className = 'login-social';

  const socialProviders = [
    {
      name: 'Google',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`,
    },
    {
      name: 'GitHub',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>`,
    },
  ];

  socialProviders.forEach(({ name, icon }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'login-social-btn';
    btn.setAttribute('aria-label', `Sign in with ${name}`);
    btn.innerHTML = `${icon}<span>${name}</span>`;
    btn.addEventListener('click', () => {
      window.location.href = config[`${name.toLowerCase()}url`] || `/auth/${name.toLowerCase()}`;
    });
    socialGroup.append(btn);
  });

  // Sign up link
  const signupRow = document.createElement('p');
  signupRow.className = 'login-signup';
  signupRow.innerHTML = `Don't have an account? <a href="${config.signupurl || '/signup'}" class="login-signup-link">Create one</a>`;

  form.append(emailGroup, passwordGroup, rememberGroup, submitBtn, divider, socialGroup);
  form.addEventListener('submit', (e) => handleSubmit(e, config));

  card.append(header, form, signupRow);
  wrapper.append(card);

  return wrapper;
}

export default function decorate(block) {
  const config = parseConfig(block);
  block.innerHTML = '';
  const loginUI = buildLoginForm(config);
  block.append(loginUI);
}
