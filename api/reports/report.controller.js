import { reportOrchestrator } from './report.orchestrator.js';
import { buildDashboard } from './report.dashboard.js';
import { buildReportScope } from './report.scope.js';
import { getCollection } from '../../services/mongoDB.service.js';

export const reportController = {
  getRegistry,
  getReport,
  getDashboard,
};

async function getRegistry(req, res, next) {
  try {
    const reports = reportOrchestrator.getAvailableReports(req.context);
    res.json({ reports });
  } catch (err) {
    next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const scope = buildReportScope(req.context);
    const schoolYearId = req.query.schoolYearId || req.context.schoolYearId;
    const { kpis, alerts } = await buildDashboard(scope, schoolYearId, {
      services: { getCollection },
    });
    res.json({ kpis, alerts });
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
