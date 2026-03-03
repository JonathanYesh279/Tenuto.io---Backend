import { roomScheduleService } from './room-schedule.service.js';
import { validateDayQuery } from './room-schedule.validation.js';

export const roomScheduleController = {
  getRoomSchedule,
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
