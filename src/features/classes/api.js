// Thin wrappers around the database functions in supabase/migrations/002_roles_classes.sql.
// The database decides who may do what (row-level security + checked functions); these helpers only translate errors.
import { sync } from '../sync/index.js';

export class ClassError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const CODES = { 42501: 'notAllowed', P0002: 'invalidCode', 22023: 'invalidInput', 55000: 'lastAdmin', 54000: 'slowDown', ML001: 'termsRequired', ML002: 'blocked', ML003: 'suspended', ML004: 'filtered' };
function fail(error) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  throw new ClassError(CODES[error && error.code] || (offline ? 'network' : 'failed'));
}
async function rpc(name, args) {
  const c = await sync.ensureClient();
  let res;
  try { res = await c.rpc(name, args); } catch { fail(null); }
  if (res.error) fail(res.error);
  return res.data;
}

export const createClass = (name) => rpc('create_class', { p_name: name });
export async function joinClass(code) {
  const rows = await rpc('join_class', { p_code: code });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new ClassError('invalidCode'); // a wrong or banned code returns nothing (so the attempt is counted)
  return row;
}
export const myMemberships = () => rpc('my_memberships');
export const teacherClasses = () => rpc('teacher_classes');
export const classRoster = (classId) => rpc('class_roster', { p_class: classId });
export const deleteClass = (classId) => rpc('delete_class', { p_class: classId });
export const adminListUsers = () => rpc('admin_list_users');
export const adminSetRole = (userId, role) => rpc('admin_set_role', { p_user: userId, p_role: role });

// Rewards (supabase/migrations/003_rewards.sql): only admins can grant, list or revoke; everyone reads their own.
export const myRewards = () => rpc('my_rewards');
export const adminGrantReward = ({ email, kind, amount, label, reason }) => rpc('admin_grant_reward', { p_email: email, p_kind: kind, p_amount: amount, p_label: label || null, p_reason: reason || null });
export const adminListRewards = (email) => rpc('admin_list_rewards', { p_email: email || null });
export const adminRevokeReward = (id) => rpc('admin_revoke_reward', { p_id: id });

// Announcements (supabase/migrations/004_announcements.sql): only admins post, list or archive; learners read what is meant for them.
export const myAnnouncements = () => rpc('my_announcements');
export const adminCreateAnnouncement = ({ title, body, classId, expires, userEmail, style }) => rpc('admin_create_announcement', { p_title: title, p_body: body, p_class: classId || null, p_expires: expires || null, p_user_email: userEmail || null, p_style: style || 'info' });
export const adminListAnnouncements = () => rpc('admin_list_announcements');
export const adminArchiveAnnouncement = (id) => rpc('admin_archive_announcement', { p_id: id });
/** Every class, for the admin's audience picker (row-level security lets admins read all classes). */
export async function adminClasses() {
  const c = await sync.ensureClient();
  let res;
  try { res = await c.from('classes').select('id,name').order('name'); } catch { fail(null); }
  if (res.error) fail(res.error);
  return res.data || [];
}

// Content switches (supabase/migrations/005_content_switch.sql): everyone reads which paths/lessons are hidden; only admins change it.
export const contentDisabled = () => rpc('content_disabled');
export const adminSetContentEnabled = (kind, key, enabled) => rpc('admin_set_content_enabled', { p_kind: kind, p_key: key, p_enabled: enabled });

// Chat (supabase/migrations/007_chat.sql): private one-to-one conversations. Only the two people in a chat can read or write it;
// admins can also read every chat (and remove a message) through the admin_* functions.
export const startChat = (otherId) => rpc('start_chat', { p_other: otherId });
export const sendMessage = (conv, body) => rpc('send_message', { p_conv: conv, p_body: body });
export const myChats = () => rpc('my_chats');
export const chatMessages = (conv) => rpc('chat_messages_of', { p_conv: conv });
export const markChatRead = (conv) => rpc('mark_chat_read', { p_conv: conv });
export const chatUnreadTotal = () => rpc('chat_unread_total');
export const sendAttachment = ({ conv, kind, path, mime, size, durationMs, caption }) => rpc('send_attachment', { p_conv: conv, p_kind: kind, p_path: path, p_mime: mime, p_size: size, p_duration_ms: durationMs ?? null, p_caption: caption || null });
// Safety (supabase/migrations/014_security_hardening.sql): report and block, the admins' report queue, suspension, class codes.
export const reportChat = ({ conv, message, reason, details }) => rpc('report_chat', { p_conversation: conv, p_message: message || null, p_reason: reason, p_details: details || '' });
export const blockChat = (conv) => rpc('block_chat', { p_conversation: conv });
export const unblockChat = (conv) => rpc('unblock_chat', { p_conversation: conv });
export const adminListReports = () => rpc('admin_list_reports');
export const adminResolveReport = (id, status) => rpc('admin_resolve_report', { p_id: id, p_status: status });
export const adminSetSuspended = (userId, suspended, reason) => rpc('admin_set_suspended', { p_user: userId, p_suspended: suspended, p_reason: reason || '' });
export const adminListBlockedWords = () => rpc('admin_list_blocked_words');
export const adminAddBlockedWord = (word) => rpc('admin_add_blocked_word', { p_word: word });
export const adminRemoveBlockedWord = (id) => rpc('admin_remove_blocked_word', { p_id: id });
export const rotateClassCode = (classId) => rpc('rotate_class_code', { p_class: classId });
export const classBans = (classId) => rpc('teacher_class_bans', { p_class: classId });
export const unbanStudent = (classId, studentId) => rpc('teacher_unban', { p_class: classId, p_student: studentId });
// Calls (supabase/migrations/010_calls.sql): the media goes directly between the two browsers; the database only keeps the call state
// and passes the small connection messages. Admins and teachers (for their own students) can start calls; everyone in the chat can answer.
export const startCall = (conv, media) => rpc('start_call', { p_conv: conv, p_media: media });
export const answerCall = (id) => rpc('answer_call', { p_call: id });
export const endCall = (id) => rpc('end_call', { p_call: id });
export const callSignalSend = (id, kind, payload) => rpc('call_signal_send', { p_call: id, p_kind: kind, p_payload: payload });
export const callPoll = (id, after = 0) => rpc('call_poll', { p_call: id, p_after: after });
export const myIncomingCalls = () => rpc('my_incoming_calls');
export const adminListChats = () => rpc('admin_list_chats');
export const adminChatMessages = (conv) => rpc('admin_chat_messages', { p_conv: conv });
export const adminRemoveMessage = (id) => rpc('admin_remove_message', { p_msg: id });

/** A student leaves a class, or a teacher removes a student (row-level security allows exactly these two). */
export async function removeMember(classId, studentId) {
  const c = await sync.ensureClient();
  let res;
  try { res = await c.from('class_members').delete().eq('class_id', classId).eq('student_id', studentId); } catch { fail(null); }
  if (res.error) fail(res.error);
}

/** The streak as it stands today: a streak is broken when the last learning day was before yesterday. */
export function liveStreak(current, lastDay, today) {
  if (!lastDay || !current) return 0;
  const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
  return Math.round((d(today) - d(lastDay)) / 86400000) <= 1 ? current : 0;
}
