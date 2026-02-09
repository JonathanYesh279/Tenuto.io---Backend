import Joi from 'joi';
import { SUBSCRIPTION_PLANS } from '../../config/constants.js';

export const tenantSchema = Joi.object({
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Slug must contain only lowercase letters, numbers, and hyphens',
    }),
  name: Joi.string().trim().required(),
  city: Joi.string().trim().required(),

  director: Joi.object({
    name: Joi.string().allow(null, '').default(null),
    teacherId: Joi.string().allow(null).default(null),
  }).default({ name: null, teacherId: null }),

  ministryInfo: Joi.object({
    institutionCode: Joi.string().allow(null, '').default(null),
    districtName: Joi.string().allow(null, '').default(null),
  }).default({ institutionCode: null, districtName: null }),

  settings: Joi.object({
    lessonDurations: Joi.array().items(Joi.number().positive()).default([30, 45, 60]),
    schoolStartMonth: Joi.number().min(1).max(12).default(9),
  }).default({ lessonDurations: [30, 45, 60], schoolStartMonth: 9 }),

  subscription: Joi.object({
    plan: Joi.string()
      .valid(...SUBSCRIPTION_PLANS)
      .default('basic'),
    startDate: Joi.date().default(() => new Date()),
    endDate: Joi.date().allow(null).default(null),
    isActive: Joi.boolean().default(true),
    maxTeachers: Joi.number().positive().default(50),
    maxStudents: Joi.number().positive().default(500),
  }).default({
    plan: 'basic',
    isActive: true,
    maxTeachers: 50,
    maxStudents: 500,
  }),

  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date()),
});

export const tenantUpdateSchema = Joi.object({
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/),
  name: Joi.string().trim(),
  city: Joi.string().trim(),

  director: Joi.object({
    name: Joi.string().allow(null, ''),
    teacherId: Joi.string().allow(null),
  }),

  ministryInfo: Joi.object({
    institutionCode: Joi.string().allow(null, ''),
    districtName: Joi.string().allow(null, ''),
  }),

  settings: Joi.object({
    lessonDurations: Joi.array().items(Joi.number().positive()),
    schoolStartMonth: Joi.number().min(1).max(12),
  }),

  subscription: Joi.object({
    plan: Joi.string().valid(...SUBSCRIPTION_PLANS),
    startDate: Joi.date(),
    endDate: Joi.date().allow(null),
    isActive: Joi.boolean(),
    maxTeachers: Joi.number().positive(),
    maxStudents: Joi.number().positive(),
  }),

  isActive: Joi.boolean(),
  updatedAt: Joi.date().default(() => new Date()),
});

export function validateTenant(tenant, isUpdate = false) {
  const schema = isUpdate ? tenantUpdateSchema : tenantSchema;
  return schema.validate(tenant, { abortEarly: false });
}
