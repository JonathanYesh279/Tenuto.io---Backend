import { hoursSummaryService } from './hours-summary.service.js';

export const hoursSummaryController = {
  getHoursSummary,
  getTeacherHours,
  calculateTeacherHours,
  calculateAllHours,
};

async function getHoursSummary(req, res, next) {
  try {
    const tenantId = req.context?.tenantId || null;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const summaries = await hoursSummaryService.getHoursSummary(tenantId, schoolYearId);
    res.json(summaries);
  } catch (err) {
    next(err);
  }
}

async function getTeacherHours(req, res, next) {
  try {
    const { teacherId } = req.params;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const summary = await hoursSummaryService.getHoursSummaryByTeacher(teacherId, schoolYearId);
    if (!summary) {
      return res.status(404).json({ error: 'Hours summary not found for this teacher' });
    }
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function calculateTeacherHours(req, res, next) {
  try {
    const { teacherId } = req.params;
    const tenantId = req.context?.tenantId || null;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const summary = await hoursSummaryService.calculateTeacherHours(teacherId, schoolYearId, tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function calculateAllHours(req, res, next) {
  try {
    const tenantId = req.context?.tenantId || null;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const result = await hoursSummaryService.calculateAllTeacherHours(tenantId, schoolYearId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
