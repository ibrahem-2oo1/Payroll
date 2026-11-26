/**
 * Dawam - Monthly Report & Payroll Screen Controller
 * Adheres strictly to docs/PLAN.md (Phase 5).
 * All metrics computed via calc.js buildMonth / buildMonthReport.
 * Includes Excel export (SheetJS 0.20.3) and clean print layout.
 */

import { t, getLang } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ui from '../core/ui.js';
import { toLocalDate, formatHoursMinutes, minToHoursLabel } from '../core/dates.js';
import { buildMonth, buildMonthReport } from '../engine/calc.js';
import { createEmployeeSearch } from '../core/employee-search.js';

const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

export function mount(container) {
  let currentMonth = toLocalDate().slice(0, 7); // "YYYY-MM"
  let filterEmployeeId = null;
  let filterDepartment = '';
  let activeView = 'summary'; // 'summary' | 'breakdown'
  let breakdownEmployeeId = null;
  let empSearchInstance = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatIQD(num) {
    if (num === null || num === undefined) return '—';
    return Number(num).toLocaleString() + ' د.ع';
  }

  function getWeekdayName(weekdayNum, lang = 'ar') {
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return lang === 'ar' ? (daysAr[weekdayNum] || '') : (daysEn[weekdayNum] || '');
  }

  function getStatusLabel(status, isWeekend, lang = 'ar') {
    if (status === 'present') return lang === 'ar' ? 'حاضر' : 'Present';
    if (status === 'absent') return lang === 'ar' ? 'غائب' : 'Absent';
    if (status === 'leave') return lang === 'ar' ? 'إجازة' : 'Leave';
    if (status === 'weekend' || isWeekend) return lang === 'ar' ? 'عطلة' : 'Weekend';
    return lang === 'ar' ? 'بدون تسجيل' : 'No record';
  }

  function stepMonth(delta) {
    const [yStr, mStr] = currentMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    if (m > 12) {
      m = 1;
      y++;
    } else if (m < 1) {
      m = 12;
      y--;
    }
    currentMonth = `${y}-${String(m).padStart(2, '0')}`;
    render();
  }

  async function exportToExcel() {
    const exportBtn = container.querySelector('#btn-export-excel');
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = `⏳ ${t('common.loading')}...`;
    }

    try {
      const XLSX = await loadSheetJS();
      const db = store.getDB();
      const reportData = buildMonthReport(currentMonth, db, filterEmployeeId, filterDepartment);
      const lang = getLang();

      // Sheet 1: الملخص (Summary)
      const summaryHeaders = [
        t('employees.badge') || 'الرقم الوظيفي',
        t('employees.name') || 'اسم الموظف',
        t('report.department') || 'القسم',
        t('common.status') || 'الحالة',
        t('report.rate') || 'سعر الساعة (د.ع)',
        t('report.daysPresent') || 'أيام الحضور',
        t('report.latesCount') || 'مرات التأخير',
        t('report.absences') || 'أيام الغياب',
        t('report.leaves') || 'أيام الإجازة',
        t('report.regularHours') || 'الدوام النظامي (س)',
        t('report.otCounted') || 'إضافي معتمد (س)',
        t('report.lateDeductions') || 'خصومات التأخير (س)',
        t('report.absenceDeductions') || 'خصومات الغياب (س)',
        t('report.penalties') + ' (أيام)',
        t('report.penalties') + ' (س)',
        t('report.netHours') || 'صافي الساعات',
        t('report.salary') || 'الراتب المستحق (د.ع)'
      ];

      const summaryRows = [summaryHeaders];

      for (const rep of reportData.employeesReport) {
        const emp = rep.employee || {};
        const salaryText = rep.totals.salary !== null ? rep.totals.salary : '—';

        summaryRows.push([
          emp.badge || '',
          emp.name || '',
          emp.department || '',
          emp.active === false ? (lang === 'ar' ? 'معطل' : 'Inactive') : (lang === 'ar' ? 'نشط' : 'Active'),
          emp.rate || '—',
          rep.counts.present,
          rep.counts.late,
          rep.counts.absent,
          rep.counts.leave,
          formatHoursMinutes(rep.totals.regular),
          formatHoursMinutes(rep.totals.ot),
          formatHoursMinutes(rep.totals.lateDeductions),
          formatHoursMinutes(rep.totals.absenceDeductions),
          rep.counts.penaltyDays,
          formatHoursMinutes(rep.totals.penaltyDeductions),
          formatHoursMinutes(rep.totals.netMonth),
          salaryText
        ]);
      }

      // Grand Totals Row
      const gt = reportData.grandTotals;
      summaryRows.push([
        t('report.totals') || 'الإجمالي العام',
        `${gt.employeeCount} ${t('common.employee') || 'موظف'}`,
        '—',
        '—',
        '—',
        gt.presentDays,
        gt.lateDays,
        gt.absentDays,
        gt.leaveDays,
        formatHoursMinutes(gt.regular),
        formatHoursMinutes(gt.ot),
        formatHoursMinutes(gt.lateDeductions),
        formatHoursMinutes(gt.absenceDeductions),
        gt.penaltyDays,
        formatHoursMinutes(gt.penaltyDeductions),
        formatHoursMinutes(gt.netMonth),
        gt.totalSalary
      ]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!views'] = [{ RTL: true }];

      // Sheet 2: التفاصيل (Daily Details)
      const detailHeaders = [
        t('employees.badge') || 'الرقم الوظيفي',
        t('employees.name') || 'اسم الموظف',
        t('report.department') || 'القسم',
        t('report.date') || 'التاريخ',
        t('report.weekday') || 'اليوم',
        t('attendance.clockIn') || 'وقت الحضور',
        t('attendance.clockOut') || 'وقت الانصراف',
        t('common.status') || 'الحالة',
        'رقم التأخير',
        'قاعدة التأخير',
        'مبلغ القاعدة (د)',
        'الخصم الإضافي (د)',
        'إضافي فعلي (د)',
        'إضافي معتمد (د)',
        'صافي اليوم (س)',
        'الجزاءات (أيام)'
      ];

      const detailRows = [detailHeaders];

      for (const rep of reportData.employeesReport) {
        const emp = rep.employee || {};
        for (const day of rep.calendarDays) {
          const rec = day.record;
          const calc = day.calc;
          const statusText = getStatusLabel(day.status, day.isWeekend, lang);

          detailRows.push([
            emp.badge || '',
            emp.name || '',
            emp.department || '',
            day.date,
            getWeekdayName(day.weekday, lang),
            rec?.in || '—',
            rec?.out || '—',
            statusText,
            calc?.lateNo ? `#${calc.lateNo}` : '—',
            calc?.ruleUsed?.label || calc?.ruleUsed?.type || '—',
            calc?.ruleAmount ? `${calc.ruleAmount} د` : '—',
            calc?.lateDeduction ? `${calc.lateDeduction} د` : '—',
            calc?.otRaw ? `${calc.otRaw} د` : '—',
            calc?.ot ? `${calc.ot} د` : '—',
            calc ? formatHoursMinutes(calc.net) : '—',
            day.hasPenalty ? `${day.penaltyDays} يوم` : '—'
          ]);
        }
      }

      const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
      wsDetails['!views'] = [{ RTL: true }];

      // Build Workbook
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, wsSummary, t('report.sheetSummary') || 'الملخص');
      XLSX.utils.book_append_sheet(wb, wsDetails, t('report.sheetDetails') || 'التفاصيل');

      // Trigger Download
      XLSX.writeFile(wb, `dawam-report-${currentMonth}.xlsx`);
      ui.toast(t('report.excelExportSuccess') || 'تم تصدير ملف Excel بنجاح', 'success');
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      ui.toast(t('report.excelLoadError') || 'تعذر تحميل مكتبة Excel. يرجى التحقق من اتصالك بالإنترنت.', 'error');
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = `📊 <span data-i18n="report.exportExcel">${t('report.exportExcel')}</span>`;
      }
    }
  }

  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SHEETJS_URL;
      script.async = true;
      script.onload = () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error('SheetJS XLSX global not found'));
      };
      script.onerror = () => reject(new Error('Failed to load SheetJS from CDN'));
      document.head.appendChild(script);
    });
  }

  function renderSummaryView() {
    const db = store.getDB();
    const lang = getLang();
    const reportData = buildMonthReport(currentMonth, db, filterEmployeeId, filterDepartment);
    const employees = store.list('employees');
    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
    const gt = reportData.grandTotals;

    return `
      <!-- Top Actions & Controls Bar -->
      <div class="report-filters-bar mb-3">
        <!-- Month Stepper -->
        <div class="report-controls-group">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-prev-month" title="الشهر السابق">◀</button>
          <input type="month" class="input input-sm font-num" id="input-report-month" value="${currentMonth}" style="width: auto;">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-next-month" title="الشهر التالي">▶</button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-current-month">${t('report.currentMonth') || 'الشهر الحالي'}</button>
        </div>

        <!-- Filters (Employee Search & Department) -->
        <div class="report-controls-group" style="flex: 1; max-width: 480px; min-width: 260px;">
          <div id="report-emp-search-mount" style="flex: 1;"></div>
          <select class="input input-sm" id="select-dept-filter" style="width: auto; min-width: 140px;">
            <option value="">${t('report.allDepartments') || 'جميع الأقسام'}</option>
            ${departments.map(d => `
              <option value="${escapeHtml(d)}" ${filterDepartment === d ? 'selected' : ''}>${escapeHtml(d)}</option>
            `).join('')}
          </select>
        </div>

        <!-- Export & Print Actions -->
        <div class="report-controls-group no-print">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-export-excel">
            📊 <span data-i18n="report.exportExcel">${t('report.exportExcel')}</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-print-report">
            🖨️ <span data-i18n="report.printReport">${t('report.printReport')}</span>
          </button>
        </div>
      </div>

      <!-- Grand Totals Overview Bar (Always visible) -->
      <div class="penalties-summary-bar mb-3">
        <div class="card p-2 text-center" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <small class="text-muted">${t('common.employee') || 'الموظفون'}</small>
          <strong class="font-num text-cyan" style="font-size: 1.15rem;">${gt.employeeCount}</strong>
        </div>
        <div class="card p-2 text-center" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <small class="text-muted">${t('report.daysPresent') || 'حضور'}</small>
          <strong class="font-num text-green" style="font-size: 1.15rem;">${gt.presentDays}</strong>
        </div>
        <div class="card p-2 text-center" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <small class="text-muted">${t('report.latesCount') || 'تأخير'}</small>
          <strong class="font-num text-amber" style="font-size: 1.15rem;">${gt.lateDays}</strong>
        </div>
        <div class="card p-2 text-center" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <small class="text-muted">${t('report.absences') || 'غياب'}</small>
          <strong class="font-num text-red" style="font-size: 1.15rem;">${gt.absentDays}</strong>
        </div>
        <div class="card p-2 text-center" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <small class="text-muted">${t('report.netHours') || 'صافي الساعات'}</small>
          <strong class="font-num ${gt.netMonth < 0 ? 'text-negative' : 'text-cyan'}" style="font-size: 1.15rem;">${formatHoursMinutes(gt.netMonth)}</strong>
        </div>
        <div class="card p-2 text-center" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <small class="text-muted">${t('report.salary') || 'مجموع الرواتب'}</small>
          <strong class="font-num text-magenta" style="font-size: 1.15rem;">${formatIQD(gt.totalSalary)}</strong>
        </div>
      </div>

      <!-- DESKTOP VIEW: Table with Sticky Header & First Column -->
      <div class="report-desktop-view">
        <div class="report-table-wrapper">
          <table class="table report-table">
            <thead>
              <tr>
                <th class="col-sticky-emp" style="min-width: 170px;">${t('employees.name') || 'الموظف'}</th>
                <th style="text-align: center;">${t('report.daysPresent') || 'حضور'}</th>
                <th style="text-align: center;">${t('report.latesCount') || 'تأخير'}</th>
                <th style="text-align: center;">${t('report.absences') || 'غياب'}</th>
                <th style="text-align: center;">${t('report.leaves') || 'إجازة'}</th>
                <th style="text-align: center;">${t('report.regularHours') || 'نظامي'}</th>
                <th style="text-align: center;">${t('report.otCounted') || 'إضافي'}</th>
                <th style="text-align: center;">${t('report.lateDeductions') || 'خصم تأخير'}</th>
                <th style="text-align: center;">${t('report.absenceDeductions') || 'خصم غياب'}</th>
                <th style="text-align: center;">${t('report.penaltiesDaysHours') || 'الجزاءات'}</th>
                <th style="text-align: center;">${t('report.netHours') || 'صافي الساعات'}</th>
                <th style="text-align: end; min-width: 130px;">${t('report.salary') || 'الراتب'}</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.employeesReport.length === 0 ? `
                <tr>
                  <td colspan="12" class="text-center text-muted p-4">لا توجد سجلات مطابقة لهذا الشهر أو معايير التصفية</td>
                </tr>
              ` : reportData.employeesReport.map(rep => {
                const emp = rep.employee || {};
                const isInactive = emp.active === false;
                const isNegative = rep.totals.netMonth < 0;

                return `
                  <tr class="clickable-row btn-drilldown" data-emp-id="${emp.id}" title="اضغط لعرض تفاصيل أيام الشهر">
                    <td class="col-sticky-emp">
                      <div style="display: flex; flex-direction: column; gap: 0.15rem;">
                        <strong>${escapeHtml(emp.name)}</strong>
                        <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem;">
                          <span class="badge font-num">${escapeHtml(emp.badge)}</span>
                          <span class="text-muted">${escapeHtml(emp.department || '')}</span>
                          ${isInactive ? `<span class="badge badge-absent" style="font-size: 0.65rem;">معطل</span>` : ''}
                        </div>
                      </div>
                    </td>
                    <td class="font-num text-center text-green">${rep.counts.present}</td>
                    <td class="font-num text-center ${rep.counts.late > 0 ? 'text-amber' : 'text-muted'}">${rep.counts.late}</td>
                    <td class="font-num text-center ${rep.counts.absent > 0 ? 'text-red' : 'text-muted'}">${rep.counts.absent}</td>
                    <td class="font-num text-center ${rep.counts.leave > 0 ? 'text-cyan' : 'text-muted'}">${rep.counts.leave}</td>
                    <td class="font-num text-center">${formatHoursMinutes(rep.totals.regular)}</td>
                    <td class="font-num text-center ${rep.totals.ot > 0 ? 'text-cyan' : 'text-muted'}">${formatHoursMinutes(rep.totals.ot)}</td>
                    <td class="font-num text-center ${rep.totals.lateDeductions > 0 ? 'text-amber' : 'text-muted'}">${formatHoursMinutes(rep.totals.lateDeductions)}</td>
                    <td class="font-num text-center ${rep.totals.absenceDeductions > 0 ? 'text-red' : 'text-muted'}">${formatHoursMinutes(rep.totals.absenceDeductions)}</td>
                    <td class="font-num text-center ${rep.counts.penaltyDays > 0 ? 'text-red' : 'text-muted'}">
                      ${rep.counts.penaltyDays > 0 ? `${rep.counts.penaltyDays}ي / ${formatHoursMinutes(rep.totals.penaltyDeductions)}` : '0'}
                    </td>
                    <td class="font-num text-center ${isNegative ? 'text-negative' : 'text-cyan'}" style="font-weight: 700;">
                      ${formatHoursMinutes(rep.totals.netMonth)}
                    </td>
                    <td class="font-num text-end">
                      ${isNegative ? `
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                          <span class="text-red">0 د.ع</span>
                          <span class="badge badge-absent" style="font-size: 0.65rem;">${t('report.negativeHours') || 'ساعات سالبة'}</span>
                        </div>
                      ` : `
                        <span>${formatIQD(rep.totals.salary)}</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="row-totals">
                <td class="col-sticky-emp">
                  <div style="font-weight: 700; color: var(--neon-cyan);">
                    ${t('report.totals') || 'الإجمالي العام'} (${gt.employeeCount})
                  </div>
                </td>
                <td class="font-num text-center text-green">${gt.presentDays}</td>
                <td class="font-num text-center text-amber">${gt.lateDays}</td>
                <td class="font-num text-center text-red">${gt.absentDays}</td>
                <td class="font-num text-center text-cyan">${gt.leaveDays}</td>
                <td class="font-num text-center">${formatHoursMinutes(gt.regular)}</td>
                <td class="font-num text-center">${formatHoursMinutes(gt.ot)}</td>
                <td class="font-num text-center">${formatHoursMinutes(gt.lateDeductions)}</td>
                <td class="font-num text-center">${formatHoursMinutes(gt.absenceDeductions)}</td>
                <td class="font-num text-center">
                  ${gt.penaltyDays > 0 ? `${gt.penaltyDays}ي / ${formatHoursMinutes(gt.penaltyDeductions)}` : '0'}
                </td>
                <td class="font-num text-center ${gt.netMonth < 0 ? 'text-negative' : 'text-cyan'}">
                  ${formatHoursMinutes(gt.netMonth)}
                </td>
                <td class="font-num text-end text-magenta">
                  ${formatIQD(gt.totalSalary)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- MOBILE VIEW: Interactive Summary Cards -->
      <div class="report-mobile-view">
        ${reportData.employeesReport.length === 0 ? `
          <div class="card p-4 text-center text-muted">لا توجد سجلات مطابقة لهذا الشهر أو معايير التصفية</div>
        ` : reportData.employeesReport.map(rep => {
          const emp = rep.employee || {};
          const isNegative = rep.totals.netMonth < 0;

          return `
            <div class="report-card-mobile btn-drilldown" data-emp-id="${emp.id}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div>
                  <h4 style="margin: 0; font-size: 1rem;">${escapeHtml(emp.name)}</h4>
                  <div style="display: flex; align-items: center; gap: 0.35rem; margin-top: 0.2rem;">
                    <span class="badge font-num">${escapeHtml(emp.badge)}</span>
                    <span class="text-muted" style="font-size: 0.75rem;">${escapeHtml(emp.department || '')}</span>
                  </div>
                </div>
                <div style="text-align: end;">
                  <div class="font-num ${isNegative ? 'text-negative' : 'text-cyan'}" style="font-size: 1.15rem; font-weight: 700;">
                    ${formatHoursMinutes(rep.totals.netMonth)}
                  </div>
                  <small class="text-muted">${t('report.netHours') || 'صافي'}</small>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; margin-bottom: 0.5rem; text-align: center; background: rgba(0,0,0,0.2); padding: 0.4rem; border-radius: var(--radius-sm);">
                <div>
                  <small class="text-muted" style="font-size: 0.7rem;">حضور</small>
                  <div class="font-num text-green" style="font-size: 0.85rem;">${rep.counts.present}</div>
                </div>
                <div>
                  <small class="text-muted" style="font-size: 0.7rem;">تأخير</small>
                  <div class="font-num ${rep.counts.late > 0 ? 'text-amber' : 'text-muted'}" style="font-size: 0.85rem;">${rep.counts.late}</div>
                </div>
                <div>
                  <small class="text-muted" style="font-size: 0.7rem;">غياب</small>
                  <div class="font-num ${rep.counts.absent > 0 ? 'text-red' : 'text-muted'}" style="font-size: 0.85rem;">${rep.counts.absent}</div>
                </div>
                <div>
                  <small class="text-muted" style="font-size: 0.7rem;">إجازة</small>
                  <div class="font-num ${rep.counts.leave > 0 ? 'text-cyan' : 'text-muted'}" style="font-size: 0.85rem;">${rep.counts.leave}</div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding-top: 0.35rem; border-top: 1px solid var(--border-subtle);">
                <div>
                  <span class="text-muted">${t('report.salary') || 'الراتب'}: </span>
                  <strong class="font-num ${isNegative ? 'text-red' : 'text-magenta'}">${isNegative ? '0 د.ع' : formatIQD(rep.totals.salary)}</strong>
                  ${isNegative ? `<span class="badge badge-absent" style="font-size: 0.65rem;">ساعات سالبة</span>` : ''}
                </div>
                <span class="text-cyan" style="font-size: 0.8rem;">عرض التفاصيل ◀</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderBreakdownView() {
    const db = store.getDB();
    const lang = getLang();
    const rep = buildMonth(breakdownEmployeeId, currentMonth, db);
    const emp = rep.employee || {};
    const isNegative = rep.totals.netMonth < 0;

    return `
      <!-- Breakdown Navigation Bar -->
      <div class="report-filters-bar mb-3">
        <button type="button" class="btn btn-secondary btn-sm" id="btn-back-to-summary">
          ◀ <span data-i18n="report.backToSummary">${t('report.backToSummary') || 'العودة للملخص'}</span>
        </button>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.1rem; color: var(--neon-cyan);">
            ${escapeHtml(emp.name)} (${escapeHtml(emp.badge)})
          </h3>
          <span class="badge font-num">${currentMonth}</span>
        </div>

        <button type="button" class="btn btn-secondary btn-sm no-print" id="btn-print-breakdown">
          🖨️ <span data-i18n="report.printBreakdown">${t('report.printBreakdown') || 'طباعة تفاصيل الموظف'}</span>
        </button>
      </div>

      <!-- Employee Monthly Totals Banner -->
      <div class="card card-neon mb-3 p-3">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="text-cyan mb-1" style="font-size: 1.35rem;">${escapeHtml(emp.name)}</h2>
            <div style="display: flex; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted);">
              <span>${t('employees.badge') || 'الرقم'}: <strong class="font-num text-white">${escapeHtml(emp.badge)}</strong></span>
              <span>${t('report.department') || 'القسم'}: <strong class="text-white">${escapeHtml(emp.department || '—')}</strong></span>
              <span>${t('report.rate') || 'سعر الساعة'}: <strong class="font-num text-white">${formatIQD(emp.rate)}</strong></span>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; align-items: center; text-align: end;">
            <div>
              <div class="font-num ${isNegative ? 'text-negative' : 'text-cyan'}" style="font-size: 1.4rem; font-weight: 700;">
                ${formatHoursMinutes(rep.totals.netMonth)}
              </div>
              <small class="text-muted">${t('report.netHours') || 'صافي الساعات'}</small>
            </div>
            <div>
              <div class="font-num ${isNegative ? 'text-red' : 'text-magenta'}" style="font-size: 1.4rem; font-weight: 700;">
                ${isNegative ? '0 د.ع' : formatIQD(rep.totals.salary)}
              </div>
              <small class="text-muted">
                ${t('report.salary') || 'الراتب'}
                ${isNegative ? `<span class="badge badge-absent" style="font-size: 0.65rem;">ساعات سالبة</span>` : ''}
              </small>
            </div>
          </div>
        </div>
      </div>

      <!-- Daily Breakdown Table -->
      <div class="table-container report-table-wrapper">
        <table class="table report-table">
          <thead>
            <tr>
              <th style="min-width: 105px;">${t('report.date') || 'التاريخ'}</th>
              <th>${t('report.weekday') || 'اليوم'}</th>
              <th style="text-align: center;">${t('attendance.clockIn') || 'الحضور'}</th>
              <th style="text-align: center;">${t('attendance.clockOut') || 'الانصراف'}</th>
              <th style="text-align: center;">${t('common.status') || 'الحالة'}</th>
              <th style="text-align: center;">تأخير #</th>
              <th>قاعدة التأخير</th>
              <th style="text-align: center;">مبلغ القاعدة</th>
              <th style="text-align: center;">خصم إضافي</th>
              <th style="text-align: center;">إضافي (فعلي ← معتمد)</th>
              <th style="text-align: center;">${t('report.netDay') || 'صافي اليوم'}</th>
              <th style="text-align: center;">الجزاءات</th>
            </tr>
          </thead>
          <tbody>
            ${rep.calendarDays.map(day => {
              const rec = day.record;
              const calc = day.calc;
              const isWeekend = day.isWeekend;
              const status = day.status;

              let statusBadgeHtml = '';
              let rowStyle = '';

              if (status === 'present') {
                statusBadgeHtml = calc?.late > 0 
                  ? `<span class="badge badge-late">متأخر (${calc.late}د)</span>`
                  : `<span class="badge badge-present">حاضر</span>`;
              } else if (status === 'absent') {
                statusBadgeHtml = `<span class="badge badge-absent">غائب</span>`;
              } else if (status === 'leave') {
                statusBadgeHtml = `<span class="badge badge-leave">إجازة</span>`;
              } else if (status === 'weekend' || isWeekend) {
                statusBadgeHtml = `<span class="text-muted status-weekend-dim">عطلة أسبوعية</span>`;
                rowStyle = 'opacity: 0.6;';
              } else {
                statusBadgeHtml = `<span class="badge badge-norecord">بدون تسجيل</span>`;
                rowStyle = 'background: rgba(136, 153, 181, 0.05);';
              }

              return `
                <tr style="${rowStyle}">
                  <td class="font-num"><strong>${day.date}</strong></td>
                  <td class="text-secondary">${getWeekdayName(day.weekday, lang)}</td>
                  <td class="font-num text-center">${rec?.in || '—'}</td>
                  <td class="font-num text-center">${rec?.out || '—'}</td>
                  <td class="text-center">${statusBadgeHtml}</td>
                  <td class="font-num text-center ${calc?.lateNo ? 'text-amber' : 'text-muted'}">
                    ${calc?.lateNo ? `#${calc.lateNo}` : '—'}
                  </td>
                  <td>
                    ${calc?.ruleUsed ? `<span class="badge badge-leave" style="font-size: 0.72rem;">${escapeHtml(calc.ruleUsed.label || calc.ruleUsed.type)}</span>` : '<span class="text-muted">—</span>'}
                  </td>
                  <td class="font-num text-center ${calc?.ruleAmount > 0 ? 'text-amber' : 'text-muted'}">
                    ${calc?.ruleAmount ? `${calc.ruleAmount} د` : '—'}
                  </td>
                  <td class="font-num text-center ${calc?.lateDeduction > 0 ? 'text-red' : 'text-muted'}">
                    ${calc?.lateDeduction ? `${calc.lateDeduction} د` : '—'}
                  </td>
                  <td class="font-num text-center">
                    ${calc?.otRaw > 0 ? `<span class="text-cyan">${calc.otRaw}د ← ${calc.ot}د</span>` : '<span class="text-muted">—</span>'}
                  </td>
                  <td class="font-num text-center" style="font-weight: 700;">
                    ${calc ? `
                      <span class="${calc.net < 0 ? 'text-negative' : 'text-cyan'}">
                        ${formatHoursMinutes(calc.net)}
                      </span>
                    ` : '<span class="text-muted">—</span>'}
                  </td>
                  <td class="font-num text-center">
                    ${day.hasPenalty ? `<span class="badge badge-absent">⚠️ ${day.penaltyDays} يوم</span>` : '<span class="text-muted">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function render() {
    container.innerHTML = `
      <div class="page-header mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h2 class="page-title text-cyan" data-i18n="report.title" style="font-size: 1.5rem;">📊 ${t('report.title')}</h2>
          <p class="text-muted" style="font-size: 0.875rem;">كشوفات الدوام الشهري، ساعات العمل والرواتب والتصدير إلى Excel والطباعة</p>
        </div>
      </div>

      <div id="report-view-mount">
        ${activeView === 'summary' ? renderSummaryView() : renderBreakdownView()}
      </div>
    `;

    attachEventListeners();
  }

  function attachEventListeners() {
    if (activeView === 'summary') {
      // Month navigation
      container.querySelector('#btn-prev-month')?.addEventListener('click', () => stepMonth(-1));
      container.querySelector('#btn-next-month')?.addEventListener('click', () => stepMonth(1));
      container.querySelector('#btn-current-month')?.addEventListener('click', () => {
        currentMonth = toLocalDate().slice(0, 7);
        render();
      });
      container.querySelector('#input-report-month')?.addEventListener('change', (e) => {
        if (e.target.value) {
          currentMonth = e.target.value;
          render();
        }
      });

      // Mount Employee Search
      const empSearchMount = container.querySelector('#report-emp-search-mount');
      if (empSearchMount) {
        empSearchInstance = createEmployeeSearch(empSearchMount, {
          placeholder: t('common.search') + '...',
          filterActiveOnly: false,
          onSelect: (emp) => {
            filterEmployeeId = emp ? emp.id : null;
            render();
          },
          onClear: () => {
            filterEmployeeId = null;
            render();
          }
        });

        if (filterEmployeeId) {
          const emp = store.get('employees', filterEmployeeId);
          if (emp) empSearchInstance.setEmployee(emp);
        }
      }

      // Department Filter
      container.querySelector('#select-dept-filter')?.addEventListener('change', (e) => {
        filterDepartment = e.target.value;
        render();
      });

      // Export Excel & Print
      container.querySelector('#btn-export-excel')?.addEventListener('click', exportToExcel);
      container.querySelector('#btn-print-report')?.addEventListener('click', () => window.print());

      // Drilldown into Employee Month Details
      container.querySelectorAll('.btn-drilldown').forEach(el => {
        el.addEventListener('click', () => {
          breakdownEmployeeId = el.dataset.empId;
          activeView = 'breakdown';
          render();
        });
      });
    } else {
      // Breakdown View handlers
      container.querySelector('#btn-back-to-summary')?.addEventListener('click', () => {
        activeView = 'summary';
        render();
      });
      container.querySelector('#btn-print-breakdown')?.addEventListener('click', () => window.print());
    }
  }

  render();

  // Listen for datachange
  const handleDataChange = () => render();
  window.addEventListener('dawam:datachange', handleDataChange);

  return () => {
    window.removeEventListener('dawam:datachange', handleDataChange);
    if (empSearchInstance?.destroy) empSearchInstance.destroy();
  };
}
