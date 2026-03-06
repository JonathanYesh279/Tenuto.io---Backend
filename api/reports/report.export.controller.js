/**
 * Report Export Controller
 *
 * Handles file-based exports (Excel, PDF) for reports.
 * Uses the report orchestrator for data generation (unpaginated)
 * and dedicated shapers for file formatting.
 */

import { ObjectId } from 'mongodb';
import { reportOrchestrator } from './report.orchestrator.js';
import { getGenerator } from './report.registry.js';
import { shapeExcel } from './report.excel-shaper.js';
import { shapePdf } from './report.pdf-shaper.js';
import { getCollection } from '../../services/mongoDB.service.js';
import { createLogger } from '../../services/logger.service.js';

const log = createLogger('report.export.controller');

export const reportExportController = {
  /**
   * GET /:reportId/export/excel
   *
   * Generates a full (unpaginated) report and returns it as a formatted .xlsx file.
   */
  async exportExcel(req, res, next) {
    try {
      const { reportId } = req.params;

      // Look up generator for metadata and export support check
      const generator = getGenerator(reportId);
      if (!generator) {
        return res.status(404).json({
          error: `Report "${reportId}" not found`,
          code: 'REPORT_NOT_FOUND',
        });
      }

      if (!generator.exports || !generator.exports.includes('excel')) {
        return res.status(400).json({
          error: 'Excel export not supported for this report',
          code: 'EXPORT_NOT_SUPPORTED',
        });
      }

      // Generate report with all rows (unpaginated)
      const result = await reportOrchestrator.generateReport(
        reportId,
        { ...req.query, limit: '99999', page: '1' },
        req.context
      );

      // Build generator output from the orchestrator result
      const generatorOutput = {
        columns: result.columns,
        rows: result.rows,
        summary: result.summary,
        columnGroups: result.columnGroups,
      };

      // Shape into Excel workbook
      const buffer = await shapeExcel(
        { id: generator.id, name: generator.name },
        generatorOutput
      );

      log.info({ reportId, rowCount: result.rows.length }, 'Excel export generated');

      // Send .xlsx response
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(generator.name)}.xlsx"`,
        'Content-Length': buffer.length,
      });

      return res.send(buffer);
    } catch (err) {
      log.error({ err: err.message, reportId: req.params.reportId }, 'Excel export failed');
      return next(err);
    }
  },

  /**
   * GET /:reportId/export/pdf
   *
   * Generates a full (unpaginated) report and returns it as a formatted PDF.
   */
  async exportPdf(req, res, next) {
    try {
      const { reportId } = req.params;

      // Look up generator for metadata and export support check
      const generator = getGenerator(reportId);
      if (!generator) {
        return res.status(404).json({
          error: `Report "${reportId}" not found`,
          code: 'REPORT_NOT_FOUND',
        });
      }

      if (!generator.exports || !generator.exports.includes('pdf')) {
        return res.status(400).json({
          error: 'PDF export not supported for this report',
          code: 'EXPORT_NOT_SUPPORTED',
        });
      }

      // Generate report with all rows (unpaginated)
      const result = await reportOrchestrator.generateReport(
        reportId,
        { ...req.query, limit: '99999', page: '1' },
        req.context
      );

      // Build generator output from the orchestrator result
      const generatorOutput = {
        columns: result.columns,
        rows: result.rows,
        summary: result.summary,
        columnGroups: result.columnGroups,
      };

      // Fetch conservatory name from tenant doc
      const tenant = await getCollection('tenant').findOne(
        { _id: new ObjectId(req.context.tenantId) },
        { projection: { name: 1 } }
      );

      const conservatoryName = tenant?.name || 'קונסרבטוריון';

      // Shape into PDF
      const buffer = await shapePdf(
        { id: generator.id, name: generator.name },
        generatorOutput,
        { conservatoryName, generatedAt: new Date() }
      );

      log.info({ reportId, rowCount: result.rows.length }, 'PDF export generated');

      // Send PDF response
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(generator.name)}.pdf"`,
        'Content-Length': buffer.length,
      });

      return res.send(buffer);
    } catch (err) {
      log.error({ err: err.message, reportId: req.params.reportId }, 'PDF export failed');
      return next(err);
    }
  },
};
