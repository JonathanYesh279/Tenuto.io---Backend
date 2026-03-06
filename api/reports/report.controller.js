import { reportOrchestrator } from './report.orchestrator.js';

export const reportController = {
  getRegistry,
  getReport,
};

async function getRegistry(req, res, next) {
  try {
    const reports = reportOrchestrator.getAvailableReports(req.context);
    res.json({ reports });
  } catch (err) {
    next(err);
  }
}

async function getReport(req, res, next) {
  try {
    const { reportId } = req.params;
    const result = await reportOrchestrator.generateReport(reportId, req.query, req.context);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }
}
