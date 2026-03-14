import { roomScheduleService } from './room-schedule.service.js';
import { validateDayQuery, validateMoveBody, validateRescheduleBody } from './room-schedule.validation.js';

export const roomScheduleController = {
  getRoomSchedule,
  getDailyAgenda,
  moveActivity,
  rescheduleLesson,
};

async function getRoomSchedule(req, res) {
  try {
    const { day } = req.query;

    // Validate day param
    let validated;
    try {
      validated = validateDayQuery({ day });
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }

    const result = await roomScheduleService.getRoomSchedule(validated.day, {
      context: {
        ...req.context,
        schoolYearId: req.schoolYear?._id?.toString() || req.context?.schoolYearId,
      },
    });

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error getting room schedule: ${err.message}`);
    if (err.message.includes('TENANT_GUARD')) {
      return res.status(403).json({ error: 'Tenant context required' });
    }
    res.status(500).json({ error: 'Failed to fetch room schedule' });
  }
}

async function getDailyAgenda(req, res) {
  try {
    // Auto-detect today's day of week (Israel timezone)
    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const day = req.query.day !== undefined ? Number(req.query.day) : israelTime.getDay();

    if (isNaN(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'Invalid day parameter (0-6)' });
    }

    const result = await roomScheduleService.getDailyAgenda(day, {
      context: {
        ...req.context,
        schoolYearId: req.schoolYear?._id?.toString() || req.context?.schoolYearId,
      },
    });

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error getting daily agenda: ${err.message}`);
    if (err.message.includes('TENANT_GUARD')) {
      return res.status(403).json({ error: 'Tenant context required' });
    }
    res.status(500).json({ error: 'Failed to fetch daily agenda' });
  }
}

async function moveActivity(req, res) {
  try {
    // Validate request body
    let validated;
    try {
      validated = validateMoveBody(req.body);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }

    const result = await roomScheduleService.moveActivity(validated, {
      context: {
        ...req.context,
        schoolYearId: req.schoolYear?._id?.toString() || req.context?.schoolYearId,
      },
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({
        error: 'Conflict detected',
        conflicts: err.conflictsWith,
      });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Activity not found' });
    }
    console.error(`Error moving activity: ${err.message}`);
    if (err.message.includes('TENANT_GUARD')) {
      return res.status(403).json({ error: 'Tenant context required' });
    }
    res.status(500).json({ error: 'Failed to move activity' });
  }
}

async function rescheduleLesson(req, res) {
  try {
    // Validate request body
    let validated;
    try {
      validated = validateRescheduleBody(req.body);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }

    const result = await roomScheduleService.rescheduleLesson(validated, {
      context: {
        ...req.context,
        schoolYearId: req.schoolYear?._id?.toString() || req.context?.schoolYearId,
      },
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({
        error: 'Conflict detected',
        conflicts: err.conflictsWith,
      });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    console.error(`Error rescheduling lesson: ${err.message}`, err.stack);
    if (err.message.includes('TENANT_GUARD')) {
      return res.status(403).json({ error: 'Tenant context required' });
    }
    res.status(500).json({ error: 'Failed to reschedule lesson', detail: err.message });
  }
}
