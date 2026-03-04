import Joi from 'joi';
import { timeToMinutes } from '../../utils/timeUtils.js';

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const dayQuerySchema = Joi.object({
  day: Joi.number().integer().min(0).max(5).required()
    .messages({
      'number.base': 'day must be a number (0-5)',
      'number.integer': 'day must be an integer (0-5)',
      'number.min': 'day must be between 0 (Sunday) and 5 (Friday)',
      'number.max': 'day must be between 0 (Sunday) and 5 (Friday)',
      'any.required': 'day query parameter is required',
    }),
});

const moveBodySchema = Joi.object({
  activityId: Joi.string().required()
    .messages({ 'any.required': 'activityId is required' }),
  source: Joi.string().valid('timeBlock', 'rehearsal', 'theory').required()
    .messages({
      'any.only': 'source must be one of: timeBlock, rehearsal, theory',
      'any.required': 'source is required',
    }),
  targetRoom: Joi.string().required()
    .messages({ 'any.required': 'targetRoom is required' }),
  targetStartTime: Joi.string().pattern(TIME_PATTERN).required()
    .messages({
      'string.pattern.base': 'targetStartTime must be in HH:MM format',
      'any.required': 'targetStartTime is required',
    }),
  targetEndTime: Joi.string().pattern(TIME_PATTERN).required()
    .messages({
      'string.pattern.base': 'targetEndTime must be in HH:MM format',
      'any.required': 'targetEndTime is required',
    }),
  teacherId: Joi.string().when('source', {
    is: 'timeBlock',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({ 'any.required': 'teacherId is required for timeBlock source' }),
  blockId: Joi.string().when('source', {
    is: 'timeBlock',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({ 'any.required': 'blockId is required for timeBlock source' }),
});

/**
 * Validate day query parameter for room schedule endpoint.
 * @param {{ day: number|string }} query - The query object with day param
 * @returns {{ day: number }} Validated and coerced day value
 * @throws {Error} If validation fails
 */
export function validateDayQuery(query) {
  const { error, value } = dayQuerySchema.validate(
    { day: Number(query.day) },
    { abortEarly: false }
  );
  if (error) {
    const message = error.details.map(d => d.message).join('; ');
    throw new Error(message);
  }
  return value;
}

/**
 * Validate move request body.
 * @param {object} body - The request body
 * @returns {object} Validated body
 * @throws {Error} If validation fails (message includes details)
 */
export function validateMoveBody(body) {
  const { error, value } = moveBodySchema.validate(body, { abortEarly: false });
  if (error) {
    const message = error.details.map(d => d.message).join('; ');
    throw new Error(message);
  }

  // Custom validation: startTime must be before endTime
  if (timeToMinutes(value.targetStartTime) >= timeToMinutes(value.targetEndTime)) {
    throw new Error('targetStartTime must be before targetEndTime');
  }

  return value;
}

// ─── Reschedule Lesson Validation ─────────────────────────────────────────────

const rescheduleBodySchema = Joi.object({
  teacherId: Joi.string().required()
    .messages({ 'any.required': 'teacherId is required' }),
  sourceBlockId: Joi.string().required()
    .messages({ 'any.required': 'sourceBlockId is required' }),
  lessonId: Joi.string().required()
    .messages({ 'any.required': 'lessonId is required' }),
  targetRoom: Joi.string().required()
    .messages({ 'any.required': 'targetRoom is required' }),
  targetDay: Joi.number().integer().min(0).max(5).required()
    .messages({
      'number.base': 'targetDay must be a number (0-5)',
      'number.integer': 'targetDay must be an integer (0-5)',
      'number.min': 'targetDay must be between 0 (Sunday) and 5 (Friday)',
      'number.max': 'targetDay must be between 0 (Sunday) and 5 (Friday)',
      'any.required': 'targetDay is required',
    }),
  targetStartTime: Joi.string().pattern(TIME_PATTERN).required()
    .messages({
      'string.pattern.base': 'targetStartTime must be in HH:MM format',
      'any.required': 'targetStartTime is required',
    }),
  targetEndTime: Joi.string().pattern(TIME_PATTERN).required()
    .messages({
      'string.pattern.base': 'targetEndTime must be in HH:MM format',
      'any.required': 'targetEndTime is required',
    }),
});

/**
 * Validate reschedule-lesson request body.
 * @param {object} body - The request body
 * @returns {object} Validated body
 * @throws {Error} If validation fails
 */
export function validateRescheduleBody(body) {
  const { error, value } = rescheduleBodySchema.validate(body, { abortEarly: false });
  if (error) {
    const message = error.details.map(d => d.message).join('; ');
    throw new Error(message);
  }

  // Custom validation: startTime must be before endTime
  if (timeToMinutes(value.targetStartTime) >= timeToMinutes(value.targetEndTime)) {
    throw new Error('targetStartTime must be before targetEndTime');
  }

  return value;
}
