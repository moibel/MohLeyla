// Thin wrappers around the database functions in supabase/migrations/002_roles_classes.sql.
// The database decides who may do what (row-level security + checked functions); these helpers only translate errors.
import { sync } from '../sync/index.js';

export class ClassError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const CODES = { 42501: 'notAllowed', P0002: 'invalidCode', 22023: 'invalidInput', 55000: 'lastAdmin' };
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
  return Array.isArray(rows) ? rows[0] : rows;
}
export const myMemberships = () => rpc('my_memberships');
export const teacherClasses = () => rpc('teacher_classes');
export const classRoster = (classId) => rpc('class_roster', { p_class: classId });
export const deleteClass = (classId) => rpc('delete_class', { p_class: classId });
export const adminListUsers = () => rpc('admin_list_users');
export const adminSetRole = (userId, role) => rpc('admin_set_role', { p_user: userId, p_role: role });

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
