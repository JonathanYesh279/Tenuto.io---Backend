import { attendanceAlertService } from './attendanceAlert.service.js';

export const attendanceAlertController = {
  getAlertSettings,
  getFlaggedStudents,
  getDashboard,
  getStudentSummary,
};

/**
 * GET /api/attendance-alerts/settings
 * Returns tenant alert settings. Admin only.
 */
async function getAlertSettings(req, res, next) {
  try {
    const settings = await attendanceAlertService.getTenantAlertSettings(
      req.context.tenantId
    );
    res.status(200).json(settings);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    next(err);
  }
}

/**
 * GET /api/attendance-alerts/orchestra/:orchestraId/flagged
 * Returns flagged students for a specific orchestra.
 */
async function getFlaggedStudents(req, res, next) {
  try {
    const { orchestraId } = req.params;
    const flagged = await attendanceAlertService.evaluateFlaggedStudents(
      orchestraId,
      { context: req.context }
    );
    res.status(200).json(flagged);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    next(err);
  }
}

/**
 * GET /api/attendance-alerts/dashboard
 * Returns attendance dashboard with per-orchestra stats, trends, flagged students.
 * Admin only.
 */
async function getDashboard(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const dashboard = await attendanceAlertService.getAttendanceDashboard({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      context: req.context,
    });
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/attendance-alerts/student/:studentId/summary
 * Returns attendance summary for a specific student.
 */
async function getStudentSummary(req, res, next) {
  try {
    const { studentId } = req.params;
    const summary = await attendanceAlertService.getStudentAttendanceSummary(
      studentId,
      { context: req.context }
    );
    res.status(200).json(summary);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: err.message });
    }
    next(err);
  }
}
