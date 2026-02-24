import Joi from 'joi';
import { SUPER_ADMIN_PERMISSIONS, SUBSCRIPTION_PLANS } from '../../config/constants.js';

export const superAdminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const createSuperAdminSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().trim().required(),
  permissions: Joi.array()
    .items(Joi.string().valid(...SUPER_ADMIN_PERMISSIONS))
    .min(1)
    .required(),
});

export const updateSuperAdminSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string().min(8),
  name: Joi.string().trim(),
  permissions: Joi.array()
    .items(Joi.string().valid(...SUPER_ADMIN_PERMISSIONS))
    .min(1),
  isActive: Joi.boolean(),
}).min(1);

export const updateSubscriptionSchema = Joi.object({
  plan: Joi.string().valid(...SUBSCRIPTION_PLANS),
  startDate: Joi.date(),
  endDate: Joi.date().allow(null),
  isActive: Joi.boolean(),
  maxTeachers: Joi.number().positive().integer(),
  maxStudents: Joi.number().positive().integer(),
}).min(1);

export const softDeleteTenantSchema = Joi.object({
  gracePeriodDays: Joi.number().integer().min(1).max(365).default(30),
  reason: Joi.string().trim().max(500).allow('').default(''),
});

export const purgeTenantSchema = Joi.object({
  confirmTenantName: Joi.string().required(),
});

export const reportingTenantDetailParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const impersonationStartSchema = Joi.object({
  tenantId: Joi.string().hex().length(24).required(),
});
