// In-memory Supabase API for Playwright (auth OTP + progress table), shared between browser contexts to simulate two devices.
export const MOCK_URL = 'https://mohleyla-test.supabase.co';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function makeSession(email, id, meta = {}) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.sig`;
  const user = { id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: meta, created_at: '2026-11-01T10:00:00.000Z' };
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'refresh-' + id, user };
}

export function createMockBackend(opts = {}) {
  const { code = '123456', users = {}, googleEmail = 'google.learner@gmail.com', googleMeta = { full_name: 'Google Learner', avatar_url: 'https://lh3.googleusercontent.com/a/test-avatar' } } = opts;
  const rows = new Map();
  const profiles = {}; // email -> user_metadata (display_name set from the app)
  // roles / classes (mirrors supabase/migrations/002_roles_classes.sql closely enough for UI tests; the real rules are tested in SQL)
  const known = new Map(); // userId -> { id, email, display_name, providers, role, summary }
  const classes = []; // { id, name, code, teacher_id, created_at }
  const members = []; // { class_id, student_id, joined_at }
  const announcements = []; // mirrors 004_announcements.sql
  const rewards = []; // { id, email, kind, amount, label, reason, created_at, granted_by_email, revoked_at } (mirrors 003_rewards.sql)
  const adminEmails = new Set(Array.isArray(opts.admins) ? opts.admins : []);
  const teacherEmails = new Set(Array.isArray(opts.teachers) ? opts.teachers : []);
  const idFor = (email) => users[email] || 'user-' + Buffer.from(email).toString('hex').slice(0, 8);
  function know(email, provider) {
    const id = idFor(email);
    const u = known.get(id) || { id, email, display_name: '', providers: new Set(), role: adminEmails.has(email) ? 'admin' : teacherEmails.has(email) ? 'teacher' : 'student', summary: {} };
    if (provider) u.providers.add(provider);
    known.set(id, u);
    return u;
  }
  const stats = { upserts: 0, selects: 0, deletes: 0, otps: 0 };
  const state = { rateLimit: false, failSelect: false, failNameUpdate: false };
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
      const id = idFor(email);
      know(email, 'email');
      return json(200, makeSession(email, id, profiles[email] || {}));
    }
    if (url.pathname === '/auth/v1/user') {
      const tok = (req.headers()['authorization'] || '').replace('Bearer ', '');
      let claims;
      try { claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch { return json(401, { message: 'bad token' }); }
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData() || '{}');
        stats.nameUpdates = (stats.nameUpdates || 0) + 1;
        if (state.failNameUpdate) return json(500, { message: 'boom' });
        profiles[claims.email] = { ...(profiles[claims.email] || {}), ...(body.data || {}) };
      }
      const isGoogle = claims.email === googleEmail;
      return json(200, makeSession(claims.email, claims.sub, { ...(isGoogle ? googleMeta : {}), ...(profiles[claims.email] || {}) }).user);
    }
    if (url.pathname === '/auth/v1/authorize') {
      // Google OAuth: Supabase would send the user to Google, then back to redirect_to with a session in the URL hash.
      stats.oauth = (stats.oauth || 0) + 1;
      const redirect = url.searchParams.get('redirect_to') || '/';
      const email = googleEmail;
      know(email, 'google');
      const s = makeSession(email, users[email] || 'user-google', { ...googleMeta, ...(profiles[email] || {}) });
      const hash = `access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&provider_token=google-token`;
      return route.fulfill({ status: 302, headers: { ...cors, location: `${redirect}#${hash}` }, body: '' });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.startsWith('/rest/v1/rpc/') || url.pathname === '/rest/v1/class_members' || url.pathname === '/rest/v1/classes') {
      const tok = (req.headers()['authorization'] || '').replace('Bearer ', '');
      let claims;
      try { claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch { return json(401, { message: 'bad token' }); }
      const me = know(claims.email);
      const deny = () => json(403, { code: '42501', message: 'not allowed' });
      const args = req.postData() ? JSON.parse(req.postData()) : {};
      stats.rpc = stats.rpc || {};
      if (url.pathname === '/rest/v1/classes') {
        if (me.role !== 'admin') return json(200, classes.filter((c) => c.teacher_id === me.id).map((c) => ({ id: c.id, name: c.name })));
        return json(200, classes.map((c) => ({ id: c.id, name: c.name })).sort((x, y) => x.name.localeCompare(y.name)));
      }
      if (url.pathname === '/rest/v1/class_members' && req.method() === 'DELETE') {
        const cid = (url.searchParams.get('class_id') || '').replace('eq.', '');
        const sid = (url.searchParams.get('student_id') || '').replace('eq.', '');
        const cls = classes.find((c) => c.id === cid);
        if (!(sid === me.id || (cls && cls.teacher_id === me.id) || me.role === 'admin')) return route.fulfill({ status: 204, headers: cors });
        const i = members.findIndex((m) => m.class_id === cid && m.student_id === sid);
        if (i >= 0) members.splice(i, 1);
        return route.fulfill({ status: 204, headers: cors });
      }
      const fn = url.pathname.replace('/rest/v1/rpc/', '');
      stats.rpc[fn] = (stats.rpc[fn] || 0) + 1;
      const nameOf = (u) => u.display_name || '';
      if (fn === 'my_role') return json(200, me.role);
      if (fn === 'create_class') {
        if (!['teacher', 'admin'].includes(me.role)) return deny();
        const name = String(args.p_name || '').trim();
        if (!name || name.length > 60) return json(400, { code: '22023', message: 'bad name' });
        const c = { id: 'class-' + (classes.length + 1), name, code: (Math.random().toString(16).slice(2) + '00000000').slice(0, 8).toUpperCase(), teacher_id: me.id, created_at: new Date().toISOString() };
        classes.push(c);
        return json(200, c);
      }
      if (fn === 'join_class') {
        const c = classes.find((x) => x.code === String(args.p_code || '').trim().toUpperCase());
        if (!c) return json(400, { code: 'P0002', message: 'invalid class code' });
        if (!members.some((m) => m.class_id === c.id && m.student_id === me.id)) members.push({ class_id: c.id, student_id: me.id, joined_at: new Date().toISOString() });
        return json(200, [{ class_id: c.id, class_name: c.name }]);
      }
      if (fn === 'my_memberships') return json(200, members.filter((m) => m.student_id === me.id).map((m) => { const c = classes.find((x) => x.id === m.class_id); const t = known.get(c.teacher_id); return { class_id: c.id, class_name: c.name, teacher_name: t ? (nameOf(t) || t.email.split('@')[0]) : '', joined_at: m.joined_at }; }));
      if (fn === 'teacher_classes') return json(200, classes.filter((c) => c.teacher_id === me.id && ['teacher', 'admin'].includes(me.role)).map((c) => ({ class_id: c.id, class_name: c.name, code: c.code, member_count: members.filter((m) => m.class_id === c.id).length, created_at: c.created_at })));
      if (fn === 'class_roster') {
        const c = classes.find((x) => x.id === args.p_class);
        if (!c || !(c.teacher_id === me.id || me.role === 'admin')) return deny();
        return json(200, members.filter((m) => m.class_id === c.id).map((m) => { const u = known.get(m.student_id); const s = u.summary || {}; return { student_id: u.id, display_name: nameOf(u), email: u.email, joined_at: m.joined_at, xp: s.xp ?? 0, lessons_done: s.lessons_done ?? 0, streak: s.streak ?? 0, best_streak: s.best_streak ?? 0, accuracy: s.accuracy ?? null, last_active: s.last_active ?? null, streak_last: s.streak_last ?? null }; }));
      }
      if (fn === 'delete_class') {
        const i = classes.findIndex((x) => x.id === args.p_class);
        if (i < 0 || !(classes[i].teacher_id === me.id || me.role === 'admin')) return deny();
        const id = classes[i].id; classes.splice(i, 1);
        for (let j = members.length - 1; j >= 0; j--) if (members[j].class_id === id) members.splice(j, 1);
        return json(200, null);
      }
      if (fn === 'admin_list_users') {
        if (me.role !== 'admin') return deny();
        return json(200, [...known.values()].map((u) => ({ user_id: u.id, email: u.email, display_name: nameOf(u) || (profiles[u.email]?.display_name || ''), role: u.role, providers: [...u.providers].sort().join(','), created_at: '2026-11-01T10:00:00Z', last_sign_in_at: '2026-11-21T09:00:00Z', xp: u.summary?.xp ?? 0, lessons_done: u.summary?.lessons_done ?? 0, last_active: u.summary?.last_active ?? null })));
      }
      if (fn === 'admin_set_role') {
        if (me.role !== 'admin') return deny();
        if (!['student', 'teacher', 'admin'].includes(args.p_role)) return json(400, { code: '22023', message: 'unknown role' });
        const u = known.get(args.p_user);
        if (u.role === 'admin' && args.p_role !== 'admin' && [...known.values()].filter((x) => x.role === 'admin').length <= 1) return json(400, { code: '55000', message: 'cannot remove the last admin' });
        u.role = args.p_role;
        return json(200, null);
      }
      if (fn === 'my_rewards') return json(200, rewards.filter((r) => !r.revoked_at && r.email === me.email.toLowerCase()).map(({ id, kind, amount, label, reason, created_at }) => ({ id, kind, amount, label, reason, created_at })));
      if (fn === 'admin_grant_reward') {
        if (me.role !== 'admin') return deny();
        const email = String(args.p_email || '').trim().toLowerCase();
        const kind = args.p_kind;
        const amount = kind === 'badge' ? 1 : args.p_amount;
        const label = (args.p_label || '').trim() || null;
        const max = kind === 'xp' ? 10000 : 1000;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !['xp', 'star', 'badge'].includes(kind) || (kind === 'badge' ? !label || label.length > 40 : !(amount >= 1 && amount <= max)) || String(args.p_reason || '').length > 140) return json(400, { code: '22023', message: 'invalid' });
        const r = { id: 'rw-' + (rewards.length + 1), email, kind, amount, label: kind === 'badge' ? label : null, reason: args.p_reason || null, created_at: new Date().toISOString(), granted_by_email: me.email, revoked_at: null };
        rewards.push(r);
        return json(200, r.id);
      }
      if (fn === 'admin_list_rewards') {
        if (me.role !== 'admin') return deny();
        const nm = (email) => { const u = [...known.values()].find((x) => x.email.toLowerCase() === email); return u ? (nameOf(u) || profiles[u.email]?.display_name || '') : ''; };
        return json(200, [...rewards].reverse().filter((r) => !args.p_email || r.email === String(args.p_email).toLowerCase()).map((r) => ({ ...r, display_name: nm(r.email) })));
      }
      if (fn === 'admin_revoke_reward') {
        if (me.role !== 'admin') return deny();
        const r = rewards.find((x) => x.id === args.p_id && !x.revoked_at);
        if (!r) return json(400, { code: 'P0002', message: 'reward not found' });
        r.revoked_at = new Date().toISOString();
        return json(200, null);
      }
      if (fn === 'my_announcements') {
        const now = Date.now();
        return json(200, announcements.filter((a) => !a.archived_at && (!a.expires_at || new Date(a.expires_at) > now) && (a.audience === 'all' || members.some((m) => m.class_id === a.class_id && m.student_id === me.id)))
          .reverse().map((a) => ({ id: a.id, title: a.title, body: a.body, class_name: a.class_id ? classes.find((c) => c.id === a.class_id)?.name : null, created_at: a.created_at })));
      }
      if (fn === 'admin_create_announcement') {
        if (me.role !== 'admin') return deny();
        const clean = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) { if (!['ar', 'en', 'id'].includes(k) || typeof v !== 'string') return null; if (v.trim()) out[k] = v.trim(); } return Object.keys(out).length ? out : null; };
        const title = clean(args.p_title); const body = clean(args.p_body);
        const same = title && body && Object.keys(title).sort().join() === Object.keys(body).sort().join();
        if (!same || Object.values(title).some((v) => v.length > 80) || Object.values(body).some((v) => v.length > 600)) return json(400, { code: '22023', message: 'invalid' });
        if (args.p_class && !classes.some((c) => c.id === args.p_class)) return json(400, { code: 'P0002', message: 'class not found' });
        if (args.p_expires && new Date(args.p_expires) <= new Date()) return json(400, { code: '22023', message: 'expiry in the past' });
        const a = { id: 'an-' + (announcements.length + 1), title, body, audience: args.p_class ? 'class' : 'all', class_id: args.p_class || null, created_at: new Date().toISOString(), expires_at: args.p_expires || null, archived_at: null };
        announcements.push(a);
        return json(200, a.id);
      }
      if (fn === 'admin_list_announcements') {
        if (me.role !== 'admin') return deny();
        return json(200, [...announcements].reverse().map((a) => ({ ...a, class_name: a.class_id ? classes.find((c) => c.id === a.class_id)?.name : null })));
      }
      if (fn === 'admin_archive_announcement') {
        if (me.role !== 'admin') return deny();
        const a = announcements.find((x) => x.id === args.p_id && !x.archived_at);
        if (!a) return json(400, { code: 'P0002', message: 'not found' });
        a.archived_at = new Date().toISOString();
        return json(200, null);
      }
      return json(404, { message: 'rpc not mocked: ' + fn });
    }
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
  return { rows, stats, state, install: (ctxOrPage) => ctxOrPage.route(`${MOCK_URL}/**`, handle), code, profiles, known, classes, members, rewards, announcements, addUser: (email, extra = {}) => { const u = know(email); Object.assign(u, extra); return u; } };
}
