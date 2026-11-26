/**
 * Dawam - Calculation Engine (Pure functions)
 * Section 4: All calculations in minutes. No DOM, no store access.
 */

export function calcDay(record, settings, lateNo = 0) {
  // Stub for Phase 0 - will be fully implemented in Phase 2
  return {
    worked: 0,
    late: 0,
    lateNo: 0,
    ruleUsed: null,
    lateDeduction: 0,
    otRaw: 0,
    ot: 0,
    regular: 0,
    net: 0
  };
}

export function buildMonth(employeeId, yyyy_mm, db) {
  // Stub for Phase 0
  return {
    employeeId,
    month: yyyy_mm,
    days: [],
    netMonth: 0,
    salary: null
  };
}
