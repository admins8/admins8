"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheckinDateString = getCheckinDateString;
exports.normalizeCheckinPoints = normalizeCheckinPoints;
exports.buildCheckinMonthRange = buildCheckinMonthRange;
exports.getUserCheckinStatus = getUserCheckinStatus;
exports.getUserCheckinMonth = getUserCheckinMonth;
exports.checkinToday = checkinToday;
const database_1 = require("../config/database");
function getCheckinDateString(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}
function normalizeCheckinPoints(value) {
    const n = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 10;
}
function pad2(value) {
    return String(value).padStart(2, '0');
}
function buildCheckinMonthRange(monthInput, now = new Date()) {
    const raw = String(monthInput || '').trim();
    const matched = raw.match(/^(\d{4})-(\d{2})$/);
    let year;
    let monthIndex;
    if (matched) {
        year = Number(matched[1]);
        monthIndex = Number(matched[2]) - 1;
    }
    else {
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
async function getUserCheckinStatus(userId) {
    const today = getCheckinDateString();
    const [todayRow, totalRow, pointsRow] = await Promise.all([
        (0, database_1.queryOne)('SELECT id FROM user_checkins WHERE user_id = ? AND checkin_date = ? LIMIT 1', [userId, today]),
        (0, database_1.queryOne)('SELECT COUNT(*) AS count FROM user_checkins WHERE user_id = ?', [userId]),
        (0, database_1.queryOne)('SELECT COALESCE(SUM(points), 0) AS points FROM user_checkins WHERE user_id = ?', [userId]),
    ]);
    return {
        today,
        checkedInToday: !!todayRow,
        totalDays: Number(totalRow?.count || 0),
        totalPoints: Number(pointsRow?.points || 0),
    };
}
async function getUserCheckinMonth(userId, monthInput) {
    const range = buildCheckinMonthRange(monthInput);
    const rows = await (0, database_1.query)(`SELECT checkin_date AS checkinDate, points, created_at AS createdAt
     FROM user_checkins
     WHERE user_id = ? AND checkin_date >= ? AND checkin_date < ?
     ORDER BY checkin_date ASC`, [userId, range.start, range.end]);
    return {
        ...range,
        records: rows.map((row) => ({
            checkinDate: row.checkinDate instanceof Date ? getCheckinDateString(row.checkinDate) : String(row.checkinDate).slice(0, 10),
            points: Number(row.points || 0),
            createdAt: row.createdAt,
        })),
    };
}
async function checkinToday(userId, pointsValue) {
    const today = getCheckinDateString();
    const points = normalizeCheckinPoints(pointsValue);
    const existing = await (0, database_1.queryOne)('SELECT id FROM user_checkins WHERE user_id = ? AND checkin_date = ? LIMIT 1', [userId, today]);
    if (existing) {
        return { ...(await getUserCheckinStatus(userId)), pointsEarned: 0, alreadyChecked: true };
    }
    await (0, database_1.execute)('INSERT INTO user_checkins (user_id, checkin_date, points) VALUES (?, ?, ?)', [userId, today, points]);
    return { ...(await getUserCheckinStatus(userId)), pointsEarned: points, alreadyChecked: false };
}
//# sourceMappingURL=userCheckinService.js.map