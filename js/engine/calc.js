/**
 * Dawam - Calculation Engine (Pure functions)
 * All calculations in integer minutes. No DOM, no store access inside pure functions.
 * Adheres strictly to Section 4 of docs/PLAN.md.
 */

/**
 * Converts "HH:MM" (24h) to minutes from midnight.
 * @param {string} hhmm
 * @returns {number}
 */
export function hhmmToMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return 0;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

/**
 * Normalizes timeline for night shifts (shiftEnd <= shiftStart) and midnight crossing (out <= in).
 * Places shiftStart, shiftEnd, in, out on a consistent linear timeline.
 * @param {number} shiftStart
 * @param {number} shiftEnd
 * @param {number} inMin
 * @param {number} outMin
 * @returns {{ shiftStart: number, shiftEnd: number, in: number, out: number }}
 */
export function normalizeTimeline(shiftStart, shiftEnd, inMin, outMin) {
  let sStart = shiftStart;
  let sEnd = shiftEnd;
  let iMin = inMin;
  let oMin = outMin;

  // Night shift definition: shift ends on or after midnight of the next day
  if (sEnd <= sStart) {
    sEnd += 1440;
    // If arrival is in the morning of the next day (e.g., 00:30 when shift is 22:00-06:00),
    // map it past midnight (1440+) on the same timeline.
    if (iMin < sStart - 720) {
      iMin += 1440;
    }
  }

  // Work session crossed midnight
  if (oMin <= iMin) {
    oMin += 1440;
  }

  return { shiftStart: sStart, shiftEnd: sEnd, in: iMin, out: oMin };
}

/**
 * Calculates attendance metrics for a single day record.
 * @param {object} record - Attendance record { in, out, status }
 * @param {object} settings - System settings
 * @param {number} [lateNo=1] - 1-based sequential late count for current cycle
 * @returns {object} Breakdown object
 */
export function calcDay(record, settings = {}, lateNo = 1) {
  const shiftStart = hhmmToMin(settings.shiftStart || '08:00');
  const shiftEnd = hhmmToMin(settings.shiftEnd || '16:00');
  const breakMinutes = Number(settings.breakMinutes ?? 30);
  const graceMinutes = Number(settings.graceMinutes ?? 0);
  const otCountedPer60 = Number(settings.otCountedPer60 ?? 52);
  const otMinMinutes = Number(settings.otMinMinutes ?? 0);
  const absentDayHours = Number(settings.absentDayHours ?? 8);
  const leavePaid = !!settings.leavePaid;
  const lateRules = Array.isArray(settings.lateRules) ? settings.lateRules : [];

  // Official day minutes
  const normShiftEnd = shiftEnd <= shiftStart ? shiftEnd + 1440 : shiftEnd;
  const official = Math.max(0, normShiftEnd - shiftStart - breakMinutes);

  const status = record?.status || 'present';

  // 1. Absent Day
  if (status === 'absent') {
    return {
      worked: 0,
      late: 0,
      lateNo: 0,
      ruleUsed: null,
      ruleAmount: 0,
      lateDeduction: 0,
      otRaw: 0,
      ot: 0,
      regular: 0,
      net: -(absentDayHours * 60)
    };
  }

  // 2. Leave Day (default leavePaid = false -> net 0, no credit, no deduction)
  if (status === 'leave') {
    return {
      worked: 0,
      late: 0,
      lateNo: 0,
      ruleUsed: null,
      ruleAmount: 0,
      lateDeduction: 0,
      otRaw: 0,
      ot: 0,
      regular: 0,
      net: leavePaid ? official : 0
    };
  }

  // 3. Present Day
  const rawIn = hhmmToMin(record?.in);
  const rawOut = hhmmToMin(record?.out);

  const norm = normalizeTimeline(shiftStart, shiftEnd, rawIn, rawOut);
  const sStart = norm.shiftStart;
  const sEnd = norm.shiftEnd;
  const inMin = norm.in;
  const outMin = norm.out;

  // Actual worked minutes
  const worked = Math.max(0, outMin - inMin - breakMinutes);

  // Late calculation
  const lateRaw = Math.max(0, inMin - sStart);
  const isLate = lateRaw > graceMinutes;
  const late = isLate ? lateRaw : 0;

  // BUG 2 FIX: safeLateNo must be >= 1 whenever late > 0. Defaults to 1 if <= 0.
  let safeLateNo = 0;
  let ruleUsed = null;
  let ruleAmount = 0;
  let lateDeduction = 0;

  if (late > 0) {
    safeLateNo = (lateNo && lateNo >= 1) ? lateNo : 1;

    if (lateRules.length > 0) {
      const ruleIdx = (safeLateNo - 1) % lateRules.length;
      ruleUsed = lateRules[ruleIdx];

      switch (ruleUsed.type) {
        case 'late_x':
          ruleAmount = Math.round(late * (ruleUsed.factor ?? 1));
          break;
        case 'remaining_x': {
          const remainingOfficial = Math.max(0, sEnd - inMin - breakMinutes);
          ruleAmount = Math.round(remainingOfficial * (ruleUsed.factor ?? 0.5));
          break;
        }
        case 'fixed_hours':
          ruleAmount = Math.round((ruleUsed.hours || 0) * 60);
          break;
        case 'full_day':
          ruleAmount = official;
          break;
        default:
          ruleAmount = late;
      }
    } else {
      ruleAmount = late;
    }

    // Total Loss Principle: lateDeduction = max(0, ruleAmount - lateMinutes)
    lateDeduction = Math.max(0, Math.round(ruleAmount - late));
  }

  // Overtime calculation
  let otRaw = Math.max(0, outMin - sEnd);
  if (otRaw < otMinMinutes) {
    otRaw = 0;
  }
  const ot = Math.round((otRaw * otCountedPer60) / 60);

  // BUG 1 FIX: Regular time calculation
  // Only time strictly inside the official window counts as regular.
  // Overtime time after shiftEnd must NOT compensate for late arrival minutes.
  const regular = Math.max(0, Math.min(outMin, sEnd) - Math.max(inMin, sStart) - breakMinutes);

  // Daily Net
  const net = regular + ot - lateDeduction;

  return {
    worked,
    late,
    lateNo: safeLateNo,
    ruleUsed,
    ruleAmount,
    lateDeduction,
    otRaw,
    ot,
    regular,
    net
  };
}

/**
 * Counts past late occurrences for an employee in the active counter period.
 * When lateCounterReset === 'monthly', counts only within the same month (YYYY-MM).
 * @param {Array} attendanceRecords
 * @param {string} employeeId
 * @param {string} currentDate - "YYYY-MM-DD"
 * @param {object} settings
 * @returns {number}
 */
export function countPreviousLates(attendanceRecords, employeeId, currentDate, settings) {
  if (!Array.isArray(attendanceRecords) || !employeeId || !currentDate) return 0;

  const currentMonth = currentDate.slice(0, 7);
  const isMonthly = (settings.lateCounterReset || 'monthly') === 'monthly';

  // Filter relevant records strictly before currentDate
  const prevRecords = attendanceRecords.filter(r => {
    if (r.employeeId !== employeeId) return false;
    if (r.status && r.status !== 'present') return false;
    if (!r.date || r.date >= currentDate) return false;
    if (isMonthly && r.date.slice(0, 7) !== currentMonth) return false;
    return true;
  });

  // Count how many days were late
  let count = 0;
  for (const rec of prevRecords) {
    const res = calcDay(rec, settings, 1);
    if (res.late > 0) {
      count++;
    }
  }

  return count;
}

/**
 * Computes the 1-based sequential late number for an employee on a given date.
 * RULE: lateNo is NEVER stored in database records. It is computed dynamically.
 * @param {Array} attendanceRecords
 * @param {string} employeeId
 * @param {string} targetDate - "YYYY-MM-DD"
 * @param {object} settings
 * @returns {number}
 */
export function getLateNoForDate(attendanceRecords, employeeId, targetDate, settings) {
  return countPreviousLates(attendanceRecords, employeeId, targetDate, settings) + 1;
}

/**
 * Builds monthly totals and day-by-day calculations for an employee.
 * @param {string} employeeId
 * @param {string} yyyy_mm - "YYYY-MM"
 * @param {object} db - Database object { settings, employees, attendance, penalties }
 * @returns {object} Monthly breakdown object
 */
export function buildMonth(employeeId, yyyy_mm, db) {
  const settings = db?.settings || {};
  const attendance = Array.isArray(db?.attendance) ? db.attendance : [];
  const penalties = Array.isArray(db?.penalties) ? db.penalties : [];
  const employees = Array.isArray(db?.employees) ? db.employees : [];

  const employee = employees.find(e => e.id === employeeId);
  const rate = employee?.rate ? Number(employee.rate) : null;

  // Filter attendance for employee in month, sorted by date ascending
  const monthRecords = attendance
    .filter(r => r.employeeId === employeeId && r.date && r.date.startsWith(yyyy_mm))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Determine starting late count if cumulative, or 0 if monthly
  let currentLateCount = 0;
  if (settings.lateCounterReset === 'never') {
    // Count all previous lates before this month
    const startOfMonth = `${yyyy_mm}-01`;
    currentLateCount = countPreviousLates(attendance, employeeId, startOfMonth, settings);
  }

  const daysResults = [];
  let totalWorked = 0;
  let totalOtRaw = 0;
  let totalOt = 0;
  let totalLateDeductions = 0;
  let totalRegular = 0;
  let totalNetDays = 0;
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let leaveDays = 0;

  for (const record of monthRecords) {
    const status = record.status || 'present';
    let dayResult;

    if (status === 'present') {
      presentDays++;
      // Probe if late to assign correct sequential late number
      const probe = calcDay(record, settings, 1);
      if (probe.late > 0) {
        currentLateCount++;
        lateDays++;
        dayResult = calcDay(record, settings, currentLateCount);
      } else {
        dayResult = calcDay(record, settings, 0);
      }
    } else if (status === 'absent') {
      absentDays++;
      dayResult = calcDay(record, settings, 0);
    } else if (status === 'leave') {
      leaveDays++;
      dayResult = calcDay(record, settings, 0);
    }

    daysResults.push({
      ...record,
      calc: dayResult
    });

    totalWorked += dayResult.worked;
    totalOtRaw += dayResult.otRaw;
    totalOt += dayResult.ot;
    totalLateDeductions += dayResult.lateDeduction;
    totalRegular += dayResult.regular;
    totalNetDays += dayResult.net;
  }

  // Monthly Penalties
  const monthPenalties = penalties.filter(p => p.employeeId === employeeId && p.date && p.date.startsWith(yyyy_mm));
  const totalPenaltyDays = monthPenalties.reduce((sum, p) => sum + Number(p.days || 0), 0);
  const penaltyDeduction = Math.round(totalPenaltyDays * Number(settings.penaltyDayHours || 4) * 60);

  // Grand Net Minutes
  const netMonth = totalNetDays - penaltyDeduction;

  // Salary calculation
  const salary = rate !== null ? Math.round((netMonth / 60) * rate) : null;

  return {
    employeeId,
    month: yyyy_mm,
    employee,
    days: daysResults,
    counts: {
      present: presentDays,
      late: lateDays,
      absent: absentDays,
      leave: leaveDays,
      penaltyDays: totalPenaltyDays
    },
    totals: {
      worked: totalWorked,
      otRaw: totalOtRaw,
      ot: totalOt,
      lateDeductions: totalLateDeductions,
      penaltyDeductions: penaltyDeduction,
      regular: totalRegular,
      netMonth,
      salary
    }
  };
}
