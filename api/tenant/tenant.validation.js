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

  conservatoryProfile: Joi.object({
    code: Joi.string().allow(null, '').default(null),
    ownershipName: Joi.string().allow(null, '').default(null),
    status: Joi.string().allow(null, '').default(null),
    socialCluster: Joi.string().allow(null, '').default(null),
    businessNumber: Joi.string().allow(null, '').default(null),
    supportUnit: Joi.string().allow(null, '').default(null),
    mixedCityFactor: Joi.string().allow(null, '').default(null),
    stage: Joi.string().allow(null, '').default(null),
    stageDescription: Joi.string().allow(null, '').default(null),
    officePhone: Joi.string().allow(null, '').default(null),
    mobilePhone: Joi.string().allow(null, '').default(null),
    cityCode: Joi.string().allow(null, '').default(null),
    sizeCategory: Joi.string().allow(null, '').default(null),
    mainDepartment: Joi.string().allow(null, '').default(null),
    supervisionStatus: Joi.string().allow(null, '').default(null),
    email: Joi.string().allow(null, '').default(null),
    address: Joi.string().allow(null, '').default(null),
    managerName: Joi.string().allow(null, '').default(null),
    managerNotes: Joi.string().allow(null, '').default(null),
    district: Joi.string().allow(null, '').default(null),
  }).default({}),

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

  conservatoryProfile: Joi.object({
    code: Joi.string().allow(null, ''),
    ownershipName: Joi.string().allow(null, ''),
    status: Joi.string().allow(null, ''),
    socialCluster: Joi.string().allow(null, ''),
    businessNumber: Joi.string().allow(null, ''),
    supportUnit: Joi.string().allow(null, ''),
    mixedCityFactor: Joi.string().allow(null, ''),
    stage: Joi.string().allow(null, ''),
    stageDescription: Joi.string().allow(null, ''),
    officePhone: Joi.string().allow(null, ''),
    mobilePhone: Joi.string().allow(null, ''),
    cityCode: Joi.string().allow(null, ''),
    sizeCategory: Joi.string().allow(null, ''),
    mainDepartment: Joi.string().allow(null, ''),
    supervisionStatus: Joi.string().allow(null, ''),
    email: Joi.string().allow(null, ''),
    address: Joi.string().allow(null, ''),
    managerName: Joi.string().allow(null, ''),
    managerNotes: Joi.string().allow(null, ''),
    district: Joi.string().allow(null, ''),
  }),

  isActive: Joi.boolean(),
  updatedAt: Joi.date().default(() => new Date()),
});

export function validateTenant(tenant, isUpdate = false) {
  const schema = isUpdate ? tenantUpdateSchema : tenantSchema;
  return schema.validate(tenant, { abortEarly: false });
}
