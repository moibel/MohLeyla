// In-memory Supabase API for Playwright (auth OTP + progress table), shared between browser contexts to simulate two devices.
export const MOCK_URL = 'https://mohleyla-test.supabase.co';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function makeSession(email, id) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.sig`;
  const user = { id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'refresh-' + id, user };
}

export function createMockBackend({ code = '123456', users = {}, googleEmail = 'google.learner@gmail.com' } = {}) {
  const rows = new Map();
  const stats = { upserts: 0, selects: 0, deletes: 0, otps: 0 };
  const state = { rateLimit: false, failSelect: false };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/otp') {
      stats.otps++;
      if (state.rateLimit) return json(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' });
      return json(200, {});
    }
    if (url.pathname === '/auth/v1/verify') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.token !== code) return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      const email = body.email;
      const id = users[email] || 'user-' + Buffer.from(email).toString('hex').slice(0, 8);
      const now = Math.floor(Date.now() / 1000);
      const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.sig`;
      return json(200, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'refresh-' + id,
        user: { id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (url.pathname === '/auth/v1/user') {
      const tok = (req.headers()['authorization'] || '').replace('Bearer ', '');
      try { const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); return json(200, makeSession(p.email, p.sub).user); } catch { return json(401, { message: 'bad token' }); }
    }
    if (url.pathname === '/auth/v1/authorize') {
      // Google OAuth: Supabase would send the user to Google, then back to redirect_to with a session in the URL hash.
      stats.oauth = (stats.oauth || 0) + 1;
      const redirect = url.searchParams.get('redirect_to') || '/';
      const email = googleEmail;
      const s = makeSession(email, users[email] || 'user-google');
      const hash = `access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&provider_token=google-token`;
      return route.fulfill({ status: 302, headers: { ...cors, location: `${redirect}#${hash}` }, body: '' });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/rest/v1/progress') {
      const uid = (url.searchParams.get('user_id') || '').replace('eq.', '');
      if (req.method() === 'GET') {
        stats.selects++;
        if (state.failSelect) return json(500, { message: 'boom' });
        return json(200, rows.has(uid) ? [{ state: rows.get(uid) }] : []);
      }
      if (req.method() === 'POST') {
        stats.upserts++;
        const body = JSON.parse(req.postData());
        const row = Array.isArray(body) ? body[0] : body;
        rows.set(row.user_id, row.state);
        return route.fulfill({ status: 201, headers: cors, body: '' });
      }
      if (req.method() === 'DELETE') {
        stats.deletes++;
        rows.delete(uid);
        return route.fulfill({ status: 204, headers: cors });
      }
    }
    return json(404, { message: 'not mocked: ' + url.pathname });
  }
  return { rows, stats, state, install: (ctxOrPage) => ctxOrPage.route(`${MOCK_URL}/**`, handle), code };
}
