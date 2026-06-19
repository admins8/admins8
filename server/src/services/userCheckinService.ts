import { execute, query, queryOne } from '../config/database';

export function getCheckinDateString(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function normalizeCheckinPoints(value: unknown): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildCheckinMonthRange(monthInput?: string, now = new Date()) {
  const raw = String(monthInput || '').trim();
  const matched = raw.match(/^(\d{4})-(\d{2})$/);
  let year: number;
  let monthIndex: number;

  if (matched) {
    year = Number(matched[1]);
    monthIndex = Number(matched[2]) - 1;
  } else {
    const today = getCheckinDateString(now);
    year = Number(today.slice(0, 4));
    monthIndex = Number(today.slice(5, 7)) - 1;
  }

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const today = getCheckinDateString(now);
    year = Number(today.slice(0, 4));
    monthIndex = Number(today.slice(5, 7)) - 1;
  }

  const start = `${year}-${pad2(monthIndex + 1)}-01`;
  const next = monthIndex === 11 ? { year: year + 1, month: 1 } : { year, month: monthIndex + 2 };
  const end = `${next.year}-${pad2(next.month)}-01`;
  return { month: `${year}-${pad2(monthIndex + 1)}`, start, end };
}

export async function getUserCheckinStatus(userId: number) {
  const today = getCheckinDateString();
  const [todayRow, totalRow, pointsRow] = await Promise.all([
    queryOne('SELECT id FROM user_checkins WHERE user_id = ? AND checkin_date = ? LIMIT 1', [userId, today]),
    queryOne('SELECT COUNT(*) AS count FROM user_checkins WHERE user_id = ?', [userId]),
    queryOne('SELECT COALESCE(SUM(points), 0) AS points FROM user_checkins WHERE user_id = ?', [userId]),
  ]);
  return {
    today,
    checkedInToday: !!todayRow,
    totalDays: Number(totalRow?.count || 0),
    totalPoints: Number(pointsRow?.points || 0),
  };
}

export async function getUserCheckinMonth(userId: number, monthInput?: string) {
  const range = buildCheckinMonthRange(monthInput);
  const rows = await query(
    `SELECT checkin_date AS checkinDate, points, created_at AS createdAt
     FROM user_checkins
     WHERE user_id = ? AND checkin_date >= ? AND checkin_date < ?
     ORDER BY checkin_date ASC`,
    [userId, range.start, range.end]
  );
  return {
    ...range,
    records: rows.map((row: any) => ({
      checkinDate: row.checkinDate instanceof Date ? getCheckinDateString(row.checkinDate) : String(row.checkinDate).slice(0, 10),
      points: Number(row.points || 0),
      createdAt: row.createdAt,
    })),
  };
}

export async function checkinToday(userId: number, pointsValue?: unknown) {
  const today = getCheckinDateString();
  const points = normalizeCheckinPoints(pointsValue);
  const existing = await queryOne('SELECT id FROM user_checkins WHERE user_id = ? AND checkin_date = ? LIMIT 1', [userId, today]);
  if (existing) {
    return { ...(await getUserCheckinStatus(userId)), pointsEarned: 0, alreadyChecked: true };
  }
  await execute(
    'INSERT INTO user_checkins (user_id, checkin_date, points) VALUES (?, ?, ?)',
    [userId, today, points]
  );
  return { ...(await getUserCheckinStatus(userId)), pointsEarned: points, alreadyChecked: false };
}
