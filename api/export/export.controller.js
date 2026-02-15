import { exportService } from './export.service.js';

export const exportController = {
  getCompletionStatus,
  crossValidate,
  downloadFullReport,
};

async function getCompletionStatus(req, res, next) {
  try {
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const status = await exportService.getCompletionStatus(schoolYearId, { context: req.context });
    res.json(status);
  } catch (err) {
    next(err);
  }
}

async function crossValidate(req, res, next) {
  try {
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;

    const validation = await exportService.crossValidate(schoolYearId, { context: req.context });
    res.json(validation);
  } catch (err) {
    next(err);
  }
}

async function downloadFullReport(req, res, next) {
  try {
    const schoolYearId = req.schoolYearId || req.query.schoolYearId || null;
    const userId = req.teacher?._id || null;

    const { buffer, validation, snapshot } = await exportService.generateFullReport(
      schoolYearId,
      userId,
      { context: req.context }
    );

    const conservatoryName = snapshot.conservatoryName || 'conservatory';
    const year = new Date().getFullYear();
    const filename = encodeURIComponent(`Mimshak_${conservatoryName}_${year}.xlsx`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Validation-Warnings', JSON.stringify(validation.warnings.length));
    res.setHeader('X-Completion-Percentage', String(snapshot.completionPercentage));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
