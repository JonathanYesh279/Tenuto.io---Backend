import Joi from 'joi';

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
