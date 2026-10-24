/* ==========================================================================
   AfricaHub – client-side authentication (shared by index.html and app.html)

   DEMO-GRADE ONLY: accounts live in this browser's localStorage and the
   "session" is a flag in web storage. This gates the UI but is NOT secure
   against a determined user. Replace login()/register() with calls to a real
   backend before exposing the app publicly.
   ========================================================================== */
const UHIAuth = (() => {
  const USERS_KEY   = 'uhi-users';     // JSON array of registered accounts
  const SESSION_KEY = 'uhi-session';   // JSON {name, email, at}
  const LOGIN_PAGE  = 'index.html';
  const APP_PAGE    = 'app.html';

  // Built-in test account (username "sidi" / password "sidi")
  const DEFAULT_USER = { username: 'sidi', email: 'sidi@africahub.local', hash: null, builtin: true };

  /* ---- storage helpers (storage can throw in private mode) ---- */
  const read  = (store, k) => { try { return JSON.parse(store.getItem(k)); } catch (e) { return null; } };
  const write = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const drop  = (store, k) => { try { store.removeItem(k); } catch (e) {} };

  /* ---- password hashing: SHA-256 when available, simple fallback otherwise ---- */
  async function hash(text) {
    const salted = 'africahub::' + text;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381;                                   // djb2 fallback (non-secure contexts)
    for (let i = 0; i < salted.length; i++) h = ((h << 5) + h + salted.charCodeAt(i)) | 0;
    return 'djb2-' + (h >>> 0).toString(16);
  }

  const users = () => read(localStorage, USERS_KEY) || [];

  /* ---- public API ---- */
  async function login(identifier, password, remember) {
    const id = (identifier || '').trim().toLowerCase();
    if (!id || !password) return { ok: false, error: 'Please enter your username/email and password.' };

    let account = null;
    if (id === DEFAULT_USER.username || id === DEFAULT_USER.email) {
      if (password === 'sidi') account = DEFAULT_USER;
    } else {
      const h = await hash(password);
      account = users().find(u => (u.username.toLowerCase() === id || u.email.toLowerCase() === id) && u.hash === h) || null;
    }
    if (!account) return { ok: false, error: 'Invalid credentials. Check your username/email and password.' };

    const session = { name: account.username, email: account.email, at: Date.now() };
    drop(sessionStorage, SESSION_KEY); drop(localStorage, SESSION_KEY);
    write(remember ? localStorage : sessionStorage, SESSION_KEY, session);
    return { ok: true, session };
  }

  async function register(username, email, password) {
    const u = (username || '').trim(), e = (email || '').trim().toLowerCase();
    const taken = users().concat([DEFAULT_USER]);
    if (taken.some(x => x.username.toLowerCase() === u.toLowerCase())) return { ok: false, error: 'That username is already taken.' };
    if (taken.some(x => x.email.toLowerCase() === e))                    return { ok: false, error: 'An account with that email already exists.' };
    const list = users();
    list.push({ username: u, email: e, hash: await hash(password), created: Date.now() });
    if (!write(localStorage, USERS_KEY, list)) return { ok: false, error: 'Could not save the account (browser storage unavailable).' };
    return { ok: true };
  }

  const getSession = () => read(sessionStorage, SESSION_KEY) || read(localStorage, SESSION_KEY);

  /** Guard for protected pages: redirect to the login page when not signed in. */
  function requireSession() {
    if (getSession()) return true;
    window.location.replace(LOGIN_PAGE);
    return false;
  }

  function logout() {
    drop(sessionStorage, SESSION_KEY); drop(localStorage, SESSION_KEY);
    ['aoi_geojson', 'sim_scene', 'sim_data'].forEach(k => drop(sessionStorage, k));  // clear previous analysis state
    window.location.href = LOGIN_PAGE;
  }

  return { login, register, getSession, requireSession, logout, APP_PAGE, LOGIN_PAGE };
})();
