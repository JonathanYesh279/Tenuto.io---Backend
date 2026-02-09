import { exportService } from './export.service.js';

export const exportController = {
  getCompletionStatus,
  crossValidate,
  downloadFullReport,
};

async function getCompletionStatus(req, res, next) {
  try {
    const tenantId = req.context?.tenantId || null;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const status = await exportService.getCompletionStatus(tenantId, schoolYearId);
    res.json(status);
  } catch (err) {
    next(err);
  }
}

async function crossValidate(req, res, next) {
  try {
    const tenantId = req.context?.tenantId || null;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const validation = await exportService.crossValidate(tenantId, schoolYearId);
    res.json(validation);
  } catch (err) {
    next(err);
  }
}

async function downloadFullReport(req, res, next) {
  try {
    const tenantId = req.context?.tenantId || null;
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;
    const userId = req.teacher?._id || null;

    const { buffer, validation, snapshot } = await exportService.generateFullReport(
      tenantId,
      schoolYearId,
      userId
    );

    const filename = `ministry-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Validation-Warnings', JSON.stringify(validation.warnings.length));
    res.setHeader('X-Completion-Percentage', String(snapshot.completionPercentage));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
