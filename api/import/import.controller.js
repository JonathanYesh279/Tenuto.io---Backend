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
    const result = await importService.previewTeacherImport(req.file.buffer, { context: req.context });
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
    const result = await importService.previewStudentImport(req.file.buffer, { context: req.context });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function executeImport(req, res, next) {
  try {
    const { importLogId } = req.params;
    const userId = req.teacher?._id || null;
    const result = await importService.executeImport(importLogId, userId, { context: req.context });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
