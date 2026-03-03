import { roomScheduleService } from './room-schedule.service.js';
import { validateDayQuery, validateMoveBody } from './room-schedule.validation.js';

export const roomScheduleController = {
  getRoomSchedule,
  moveActivity,
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
