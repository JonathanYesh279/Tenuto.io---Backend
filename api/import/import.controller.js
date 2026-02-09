import { importService } from './import.service.js';

export const importController = {
  previewTeacherImport,
  previewStudentImport,
  executeImport,
};

async function previewTeacherImport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'לא הועלה קובץ' });
    }
    const tenantId = req.context?.tenantId || null;
    const result = await importService.previewTeacherImport(req.file.buffer, tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function previewStudentImport(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'לא הועלה קובץ' });
    }
    const tenantId = req.context?.tenantId || null;
    const result = await importService.previewStudentImport(req.file.buffer, tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function executeImport(req, res, next) {
  try {
    const { importLogId } = req.params;
    const userId = req.teacher?._id || null;
    const tenantId = req.context?.tenantId || req.teacher?.tenantId || null;
    const result = await importService.executeImport(importLogId, userId, tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
