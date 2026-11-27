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
  const conversations = []; // { id, a, b, last_at } (mirrors 007_chat.sql)
  const chatMsgs = []; // { id, conv, sender, body, created_at, removed_at, kind, file_path, file_mime, duration_ms }
  const files = new Map(); // storage path -> { owner, mime, size, created_at }
  const calls = []; // { id, conv, caller, media, status, created_at, answered_at } (mirrors 010_calls.sql)
  const signals = []; // { id, call, sender, kind, payload }
  const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  const chatReads = new Map(); // `${conv}:${userId}` -> ISO time
  let clock = Date.now();
  const tick = () => new Date(clock += 1000).toISOString();
  const contentOff = []; // [{ kind, key }] hidden lessons/paths (mirrors 005_content_switch.sql)
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
  const blocks = []; // { conv, by } (mirrors 014_security_hardening.sql)
  const reports = [];
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
      // Google OAuth (PKCE): Supabase would send the user to Google, then back to redirect_to with a one-time code.
      stats.oauth = (stats.oauth || 0) + 1;
      const redirect = url.searchParams.get('redirect_to') || '/';
      const email = googleEmail;
      know(email, 'google');
      stats.challenge = url.searchParams.get('code_challenge') || null;
      return route.fulfill({ status: 302, headers: { ...cors, location: `${redirect}${redirect.includes('?') ? '&' : '?'}code=mock-oauth-code` }, body: '' });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.auth_code !== 'mock-oauth-code' || !body.code_verifier) return json(400, { message: 'invalid flow state' });
      return json(200, makeSession(googleEmail, users[googleEmail] || 'user-google', { ...googleMeta, ...(profiles[googleEmail] || {}) }));
    }
    if (url.pathname === '/functions/v1/delete-account') {
      if (req.method() !== 'POST') return route.fulfill({ status: 204, headers: cors });
      const bearer = (req.headers().authorization || '').replace(/^Bearer /, '');
      let sub = null;
      try { sub = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString()).sub; } catch { /* no token */ }
      const body = JSON.parse(req.postData() || '{}');
      stats.deleteCalls = (stats.deleteCalls || []).concat([{ confirm: body.confirm, appleCode: body.appleCode ?? null, hasToken: !!sub }]);
      if (!sub) return json(401, { error: 'unauthorised' });
      if (body.confirm !== true) return json(400, { error: 'confirm' });
      if (state.deleteAccount === 'lastAdmin') return json(409, { error: 'lastAdmin' });
      if (state.deleteAccount === 'fail') return json(500, { error: 'delete' });
      // what the real function and the database cascade remove (rules tested in supabase/tests/account_deletion.test.sql)
      rows.delete(sub);
      known.delete(sub);
      for (let i = members.length - 1; i >= 0; i--) if (members[i].student_id === sub) members.splice(i, 1);
      for (let i = conversations.length - 1; i >= 0; i--) if (conversations[i].a === sub || conversations[i].b === sub) { const id = conversations[i].id; conversations.splice(i, 1); for (let j = chatMsgs.length - 1; j >= 0; j--) if (chatMsgs[j].conv === id) chatMsgs.splice(j, 1); }
      state.deletedUsers = (state.deletedUsers || []).concat([sub]);
      return json(200, { ok: true, appleRevoked: null, filesRemoved: 0 });
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.startsWith('/storage/v1/')) {
      const tok = (req.headers()['authorization'] || '').replace('Bearer ', '');
      let claims = null;
      try { claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch { /* signed links carry their own token */ }
      const rest = url.pathname.replace('/storage/v1/', '');
      const who = claims && claims.email ? know(claims.email) : null;
      const inConv = (path, u) => { const c = conversations.find((x) => path.startsWith(x.id + '/')); return !!c && !!u && (c.a === u.id || c.b === u.id); };
      if (req.method() === 'POST' && rest.startsWith('object/chat-files/')) { // upload
        const path = decodeURIComponent(rest.slice('object/chat-files/'.length));
        if (!who || !inConv(path, who)) return json(403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
        // supabase-js sends a Blob as multipart/form-data; the file part carries the real content type
        const raw = (req.postDataBuffer() || Buffer.alloc(0)).toString('latin1');
        const part = raw.match(/filename="[^"]*"\r\nContent-Type: ([^\r\n]+)\r\n\r\n/i);
        const ct = part ? part[1].split(';')[0].trim() : (req.headers()['content-type'] || '').split(';')[0];
        files.set(path, { owner: who.id, mime: ct, size: part ? raw.length - raw.indexOf(part[0]) - part[0].length : raw.length, created_at: new Date().toISOString(), bytes: Buffer.from(raw, 'latin1') });
        return json(200, { Key: 'chat-files/' + path, Id: 'obj-' + files.size });
      }
      if (req.method() === 'POST' && rest.startsWith('object/sign/chat-files/')) { // signed link
        const path = decodeURIComponent(rest.slice('object/sign/chat-files/'.length));
        const f = files.get(path);
        if (!f || !who || !(inConv(path, who) || who.role === 'admin') || Date.now() - new Date(f.created_at).getTime() > 90 * 864e5) return json(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        return json(200, { signedURL: `/object/sign/chat-files/${path}?token=t-${who.id}` });
      }
      if (req.method() === 'GET' && rest.startsWith('object/sign/chat-files/')) { // the file itself
        const path = decodeURIComponent(rest.slice('object/sign/chat-files/'.length).split('?')[0]);
        const f = files.get(path);
        if (!f) return json(404, { message: 'not found' });
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': f.mime || 'application/octet-stream' }, body: f.mime && f.mime.startsWith('image/') ? tinyJpeg : (f.bytes || Buffer.alloc(0)) });
      }
      if (req.method() === 'DELETE' && rest.startsWith('object/chat-files')) { // admin removes files
        if (!who || who.role !== 'admin') return json(403, { message: 'not allowed' });
        const body = JSON.parse(req.postData() || '{}');
        for (const p of body.prefixes || []) files.delete(p);
        return json(200, (body.prefixes || []).map((name) => ({ name })));
      }
      return json(404, { message: 'storage not mocked: ' + rest });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/') || url.pathname === '/rest/v1/class_members' || url.pathname === '/rest/v1/classes') {
      if (url.pathname === '/rest/v1/rpc/content_disabled') return json(200, contentOff); // public: no sign-in needed
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
        return json(200, [...known.values()].map((u) => ({ user_id: u.id, email: u.email, display_name: nameOf(u) || (profiles[u.email]?.display_name || ''), role: u.role, suspended: !!u.suspended, providers: [...u.providers].sort().join(','), created_at: '2026-11-01T10:00:00Z', last_sign_in_at: '2026-11-21T09:00:00Z', xp: u.summary?.xp ?? 0, lessons_done: u.summary?.lessons_done ?? 0, last_active: u.summary?.last_active ?? null })));
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
      const nameFor = (id) => { const u = known.get(id); return u ? (nameOf(u) || profiles[u.email]?.display_name || u.email.split('@')[0]) : '?'; };
      const memberOf = (c) => c && (c.a === me.id || c.b === me.id);
      if (fn === 'start_chat') {
        const other = args.p_other;
        if (!other || other === me.id || !known.has(other)) return json(400, { code: '22023', message: 'unknown person' });
        const isMyStudent = classes.some((c) => c.teacher_id === me.id && members.some((m) => m.class_id === c.id && m.student_id === other));
        if (!(me.role === 'admin' || isMyStudent)) return deny();
        let c = conversations.find((x) => (x.a === me.id && x.b === other) || (x.a === other && x.b === me.id));
        if (!c) { c = { id: 'conv-' + (conversations.length + 1), a: me.id, b: other, last_at: tick() }; conversations.push(c); }
        return json(200, c.id);
      }
      if (fn === 'accept_terms') return json(200, null);
      if (fn === 'block_chat' || fn === 'unblock_chat') {
        const c = conversations.find((x) => x.id === args.p_conversation);
        if (!memberOf(c)) return deny();
        const i = blocks.findIndex((b) => b.conv === c.id && b.by === me.id);
        if (fn === 'block_chat' && i < 0) blocks.push({ conv: c.id, by: me.id });
        if (fn === 'unblock_chat' && i >= 0) blocks.splice(i, 1);
        return json(200, null);
      }
      if (fn === 'report_chat') {
        const c = conversations.find((x) => x.id === args.p_conversation);
        if (!memberOf(c)) return deny();
        const other = c.a === me.id ? c.b : c.a;
        const msg = chatMsgs.find((x) => x.id === args.p_message);
        const r = { id: 'report-' + (reports.length + 1), created_at: new Date().toISOString(), reporter_name: nameFor(me.id), reporter_email: me.email, reported_id: other, reported_name: nameFor(other), reported_email: known.get(other)?.email, conversation_id: c.id, message_id: msg?.id || null, message_body: msg?.body || null, reason: args.p_reason, details: args.p_details, status: 'open' };
        reports.push(r);
        return json(200, r.id);
      }
      if (fn === 'admin_list_reports') return me.role === 'admin' ? json(200, reports) : deny();
      if (fn === 'admin_resolve_report') {
        if (me.role !== 'admin') return deny();
        reports.find((r) => r.id === args.p_id).status = args.p_status;
        return json(200, null);
      }
      if (fn === 'admin_set_suspended') {
        if (me.role !== 'admin') return deny();
        known.get(args.p_user).suspended = !!args.p_suspended;
        return json(200, null);
      }
      if (fn === 'send_message') {
        const c = conversations.find((x) => x.id === args.p_conv);
        if (!memberOf(c)) return deny();
        if (me.suspended) return json(400, { code: 'ML003', message: 'suspended' });
        if (blocks.some((b) => b.conv === c.id)) return json(400, { code: 'ML002', message: 'blocked' });
        const body = String(args.p_body || '').trim();
        if (!body || body.length > 1000) return json(400, { code: '22023', message: 'bad body' });
        if (chatMsgs.filter((m) => m.sender === me.id && Date.now() - new Date(m.created_at).getTime() < 60000).length >= 20) return json(400, { code: '54000', message: 'slow down' });
        const m = { id: 'msg-' + (chatMsgs.length + 1), conv: c.id, sender: me.id, body, created_at: tick(), removed_at: null };
        chatMsgs.push(m); c.last_at = m.created_at; chatReads.set(`${c.id}:${me.id}`, m.created_at);
        return json(200, m.id);
      }
      const myConvs = () => conversations.filter(memberOf).sort((x, y) => y.last_at.localeCompare(x.last_at));
      const unreadOf = (c) => chatMsgs.filter((m) => m.conv === c.id && m.sender !== me.id && !m.removed_at && m.created_at > (chatReads.get(`${c.id}:${me.id}`) || '')).length;
      if (fn === 'my_chats') {
        return json(200, myConvs().map((c) => { const oid = c.a === me.id ? c.b : c.a; const last = [...chatMsgs].reverse().find((m) => m.conv === c.id);
          return { conversation_id: c.id, blocked_by_me: blocks.some((b) => b.conv === c.id && b.by === me.id), blocked: blocks.some((b) => b.conv === c.id), other_id: oid, other_name: nameFor(oid), other_role: known.get(oid)?.role || 'student', last_body: last ? (last.removed_at ? '' : last.body.slice(0, 120)) : null, last_kind: last && !last.removed_at ? last.kind || 'text' : 'text', last_at: c.last_at, last_is_mine: !!last && last.sender === me.id, unread: unreadOf(c) }; }));
      }
      if (fn === 'chat_unread_total') return json(200, myConvs().reduce((n, c) => n + unreadOf(c), 0));
      if (fn === 'chat_messages_of') {
        const c = conversations.find((x) => x.id === args.p_conv);
        if (!memberOf(c)) return deny();
        const old = (m) => Date.now() - new Date(m.created_at).getTime() > 90 * 864e5;
        return json(200, chatMsgs.filter((m) => m.conv === c.id).map((m) => ({ id: m.id, mine: m.sender === me.id, body: m.removed_at ? '' : m.body, created_at: m.created_at, removed: !!m.removed_at, kind: m.kind || 'text', file_path: m.removed_at || old(m) ? null : m.file_path || null, file_mime: m.file_mime || null, duration_ms: m.duration_ms || null, expired: (m.kind || 'text') !== 'text' && old(m) })));
      }
      if (fn === 'mark_chat_read') {
        const c = conversations.find((x) => x.id === args.p_conv);
        if (!memberOf(c)) return deny();
        chatReads.set(`${c.id}:${me.id}`, tick());
        return json(200, null);
      }
      const callOf = (id) => calls.find((k) => k.id === id);
      const callMember = (k) => !!k && memberOf(conversations.find((c) => c.id === k.conv));
      const finishCall = (k, status) => {
        k.status = status; k.ended_at = new Date().toISOString();
        const mins = status === 'ended' && k.answered_at ? Math.max(1, Math.round((Date.now() - new Date(k.answered_at).getTime()) / 60000)) : null;
        chatMsgs.push({ id: 'msg-' + (chatMsgs.length + 1), conv: k.conv, sender: k.caller, body: `${k.media}:${status}${mins ? ':' + mins : ''}`, created_at: tick(), removed_at: null, kind: 'call' });
        conversations.find((c) => c.id === k.conv).last_at = tick();
      };
      if (fn === 'start_call') {
        const c = conversations.find((x) => x.id === args.p_conv);
        if (!memberOf(c)) return deny();
        if (!['audio', 'video'].includes(args.p_media)) return json(400, { code: '22023', message: 'unknown call type' });
        const other = c.a === me.id ? c.b : c.a;
        const mine = classes.some((cl) => cl.teacher_id === me.id && members.some((m) => m.class_id === cl.id && m.student_id === other));
        if (!(me.role === 'admin' || mine)) return deny();
        for (const k of calls.filter((x) => x.conv === c.id && ['ringing', 'active'].includes(x.status))) {
          if ((k.status === 'ringing' && Date.now() - new Date(k.created_at).getTime() > 60000) || Date.now() - new Date(k.created_at).getTime() > 6 * 3600e3) finishCall(k, k.status === 'ringing' ? 'missed' : 'ended');
        }
        if (calls.some((x) => x.conv === c.id && ['ringing', 'active'].includes(x.status))) return json(400, { code: '55000', message: 'a call is already in progress' });
        const k = { id: 'call-' + (calls.length + 1), conv: c.id, caller: me.id, media: args.p_media, status: 'ringing', created_at: new Date().toISOString(), answered_at: null };
        calls.push(k);
        return json(200, k.id);
      }
      if (fn === 'my_incoming_calls') {
        return json(200, calls.filter((k) => callMember(k) && k.caller !== me.id && k.status === 'ringing' && Date.now() - new Date(k.created_at).getTime() < 60000).map((k) => ({ call_id: k.id, conversation_id: k.conv, caller_id: k.caller, caller_name: nameFor(k.caller), media: k.media, created_at: k.created_at })));
      }
      if (fn === 'answer_call') {
        const k = callOf(args.p_call);
        if (!callMember(k)) return deny();
        if (k.caller === me.id) return json(400, { code: '22023', message: 'you started this call' });
        if (k.status !== 'ringing' || Date.now() - new Date(k.created_at).getTime() > 90000) return json(400, { code: '55000', message: 'call is over' });
        k.status = 'active'; k.answered_at = new Date().toISOString();
        return json(200, null);
      }
      if (fn === 'end_call') {
        const k = callOf(args.p_call);
        if (!callMember(k)) return deny();
        if (['ended', 'declined', 'missed'].includes(k.status)) return json(200, null);
        finishCall(k, k.status === 'active' ? 'ended' : k.caller === me.id ? 'missed' : 'declined');
        signals.push({ id: signals.length + 1, call: k.id, sender: me.id, kind: 'bye', payload: {} });
        return json(200, null);
      }
      if (fn === 'call_signal_send') {
        const k = callOf(args.p_call);
        if (!callMember(k)) return deny();
        if (!['offer', 'answer', 'ice'].includes(args.p_kind) || !args.p_payload || typeof args.p_payload !== 'object') return json(400, { code: '22023', message: 'bad message' });
        if (!['ringing', 'active'].includes(k.status)) return json(400, { code: '55000', message: 'call is over' });
        signals.push({ id: signals.length + 1, call: k.id, sender: me.id, kind: args.p_kind, payload: args.p_payload });
        return json(200, signals.length);
      }
      if (fn === 'call_poll') {
        const k = callOf(args.p_call);
        if (!callMember(k)) return deny();
        const head = { status: k.status, media: k.media, i_am_caller: k.caller === me.id, signal_id: null, kind: null, payload: null };
        return json(200, [head, ...signals.filter((s2) => s2.call === k.id && s2.sender !== me.id && s2.id > (args.p_after || 0)).map((s2) => ({ status: k.status, media: k.media, i_am_caller: k.caller === me.id, signal_id: s2.id, kind: s2.kind, payload: s2.payload }))]);
      }
      if (fn === 'send_attachment') {
        const c = conversations.find((x) => x.id === args.p_conv);
        if (!memberOf(c)) return deny();
        const { p_kind: kind, p_path: path, p_mime: mime, p_size: size, p_duration_ms: dur } = args;
        const okPath = typeof path === 'string' && path.startsWith(c.id + '/') && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4|mp3|aac|jpg|jpeg|png|webp)$/.test(path);
        const okMime = kind === 'voice' ? /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a)$/.test(mime || '') : kind === 'image' ? /^image\/(jpeg|png|webp)$/.test(mime || '') : false;
        if (!okPath || !okMime || !(size >= 1 && size <= 5242880) || (kind === 'voice' && !(dur >= 300 && dur <= 125000)) || String(args.p_caption || '').length > 200) return json(400, { code: '22023', message: 'invalid attachment' });
        const f = files.get(path);
        if (!f || f.owner !== me.id) return json(400, { code: 'P0002', message: 'file not found' });
        if (chatMsgs.some((m) => m.file_path === path)) return json(400, { code: '22023', message: 'file already used' });
        const m = { id: 'msg-' + (chatMsgs.length + 1), conv: c.id, sender: me.id, body: String(args.p_caption || '').trim(), created_at: tick(), removed_at: null, kind, file_path: path, file_mime: mime, duration_ms: kind === 'voice' ? dur : null };
        chatMsgs.push(m); c.last_at = m.created_at; chatReads.set(`${c.id}:${me.id}`, m.created_at);
        return json(200, m.id);
      }
      if (fn === 'admin_expired_files') {
        if (me.role !== 'admin') return deny();
        return json(200, [...files.entries()].filter(([, f]) => Date.now() - new Date(f.created_at).getTime() > 90 * 864e5).map(([name]) => ({ name })));
      }
      if (fn === 'admin_list_chats') {
        if (me.role !== 'admin') return deny();
        return json(200, [...conversations].sort((x, y) => y.last_at.localeCompare(x.last_at)).map((c) => ({ conversation_id: c.id, a_id: c.a, a_name: nameFor(c.a), a_email: known.get(c.a)?.email, b_id: c.b, b_name: nameFor(c.b), b_email: known.get(c.b)?.email, message_count: chatMsgs.filter((m) => m.conv === c.id).length, last_at: c.last_at })));
      }
      if (fn === 'admin_chat_messages') {
        if (me.role !== 'admin') return deny();
        const oldA = (m) => Date.now() - new Date(m.created_at).getTime() > 90 * 864e5;
        return json(200, chatMsgs.filter((m) => m.conv === args.p_conv).map((m) => ({ id: m.id, sender_id: m.sender, sender_name: nameFor(m.sender), body: m.body, created_at: m.created_at, removed: !!m.removed_at, kind: m.kind || 'text', file_path: oldA(m) ? null : m.file_path || null, file_mime: m.file_mime || null, duration_ms: m.duration_ms || null, expired: (m.kind || 'text') !== 'text' && oldA(m) })));
      }
      if (fn === 'admin_remove_message') {
        if (me.role !== 'admin') return deny();
        const m = chatMsgs.find((x) => x.id === args.p_msg && !x.removed_at);
        if (!m) return json(400, { code: 'P0002', message: 'message not found' });
        m.removed_at = tick();
        return json(200, null);
      }
      if (fn === 'admin_set_content_enabled') {
        if (me.role !== 'admin') return deny();
        const { p_kind: kind, p_key: key, p_enabled: on } = args;
        const ok = (kind === 'track' && /^(ar|sa|eg|en|id|fr|es|zh)$/.test(key || '')) || (kind === 'lesson' && /^(ar|sa|eg|en|id|fr|es|zh)-[0-9]{2}$/.test(key || ''));
        if (!ok || typeof on !== 'boolean') return json(400, { code: '22023', message: 'unknown content item' });
        const i = contentOff.findIndex((x) => x.kind === kind && x.key === key);
        if (on && i >= 0) contentOff.splice(i, 1);
        if (!on && i < 0) contentOff.push({ kind, key });
        return json(200, null);
      }
      if (fn === 'my_announcements') {
        const now = Date.now();
        return json(200, announcements.filter((a) => !a.archived_at && (!a.expires_at || new Date(a.expires_at) > now) && (a.audience === 'all' || (a.audience === 'class' && members.some((m) => m.class_id === a.class_id && m.student_id === me.id)) || (a.audience === 'user' && a.user_email === me.email.toLowerCase())))
          .reverse().map((a) => ({ id: a.id, title: a.title, body: a.body, class_name: a.class_id ? classes.find((c) => c.id === a.class_id)?.name : null, audience: a.audience, style: a.style, created_at: a.created_at })));
      }
      if (fn === 'admin_create_announcement') {
        if (me.role !== 'admin') return deny();
        const clean = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) { if (!['ar', 'en', 'id'].includes(k) || typeof v !== 'string') return null; if (v.trim()) out[k] = v.trim(); } return Object.keys(out).length ? out : null; };
        const title = clean(args.p_title); const body = clean(args.p_body);
        const same = title && body && Object.keys(title).sort().join() === Object.keys(body).sort().join();
        if (!same || Object.values(title).some((v) => v.length > 80) || Object.values(body).some((v) => v.length > 600)) return json(400, { code: '22023', message: 'invalid' });
        const userEmail = String(args.p_user_email || '').trim().toLowerCase() || null;
        if (!['info', 'celebrate', 'alert'].includes(args.p_style)) return json(400, { code: '22023', message: 'unknown style' });
        if (userEmail && (args.p_class || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userEmail))) return json(400, { code: '22023', message: 'bad target' });
        if (args.p_class && !classes.some((c) => c.id === args.p_class)) return json(400, { code: 'P0002', message: 'class not found' });
        if (args.p_expires && new Date(args.p_expires) <= new Date()) return json(400, { code: '22023', message: 'expiry in the past' });
        const a = { id: 'an-' + (announcements.length + 1), title, body, audience: userEmail ? 'user' : args.p_class ? 'class' : 'all', class_id: args.p_class || null, user_email: userEmail, style: args.p_style, created_at: new Date().toISOString(), expires_at: args.p_expires || null, archived_at: null };
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
  return { rows, stats, state, install: (ctxOrPage) => ctxOrPage.route(`${MOCK_URL}/**`, handle), code, profiles, known, classes, members, rewards, announcements, contentOff, conversations, chatMsgs, files, calls, signals, addUser: (email, extra = {}) => { const u = know(email); Object.assign(u, extra); return u; } };
}
