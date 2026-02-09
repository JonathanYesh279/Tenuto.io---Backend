import Joi from 'joi';
import {
  ORCHESTRA_TYPES,
  ORCHESTRA_SUB_TYPES,
  PERFORMANCE_LEVELS,
} from '../../config/constants.js';

const VALID_LOCATIONS = [
  'אולם ערן',
  'סטודיו קאמרי 1',
  'סטודיו קאמרי 2',
  'אולפן הקלטות',
  'חדר חזרות 1',
  'חדר חזרות 2',
  'חדר מחשבים',
  'חדר 1',
  'חדר 2',
  'חדר חזרות',
  'חדר 5',
  'חדר 6',
  'חדר 7',
  'חדר 8',
  'חדר 9',
  'חדר 10',
  'חדר 11',
  'חדר 12',
  'חדר 13',
  'חדר 14',
  'חדר 15',
  'חדר 16',
  'חדר 17',
  'חדר 18',
  'חדר 19',
  'חדר 20',
  'חדר 21',
  'חדר 22',
  'חדר 23',
  'חדר 24',
  'חדר 25',
  'חדר 26',
  'חדר תאוריה א',
  'חדר תאוריה ב',
];

const ministryDataSchema = Joi.object({
  coordinationHours: Joi.number().min(0).max(50).allow(null).default(null),
  totalReportingHours: Joi.number().min(0).max(100).allow(null).default(null),
  ministryUseCode: Joi.number().allow(null).default(null),
}).default({
  coordinationHours: null,
  totalReportingHours: null,
  ministryUseCode: null,
});

export const orchestraSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().trim().required(),
  type: Joi.string()
    .valid(...ORCHESTRA_TYPES)
    .required(),
  subType: Joi.string()
    .valid(...ORCHESTRA_SUB_TYPES)
    .allow(null)
    .default(null),
  performanceLevel: Joi.string()
    .valid(...PERFORMANCE_LEVELS)
    .allow(null)
    .default(null),
  conductorId: Joi.string().required(),
  memberIds: Joi.array().items(Joi.string()).default([]),
  rehearsalIds: Joi.array().items(Joi.string()).default([]),
  schoolYearId: Joi.string().required(),
  location: Joi.string()
    .valid(...VALID_LOCATIONS)
    .default('חדר 1'),
  ministryData: ministryDataSchema,
  isActive: Joi.boolean().default(true),
});

export const orchestraUpdateSchema = Joi.object({
  tenantId: Joi.string().optional(),
  name: Joi.string().trim().optional(),
  type: Joi.string()
    .valid(...ORCHESTRA_TYPES)
    .optional(),
  subType: Joi.string()
    .valid(...ORCHESTRA_SUB_TYPES)
    .allow(null)
    .optional(),
  performanceLevel: Joi.string()
    .valid(...PERFORMANCE_LEVELS)
    .allow(null)
    .optional(),
  conductorId: Joi.string().optional(),
  memberIds: Joi.array().items(Joi.string()).optional(),
  rehearsalIds: Joi.array().items(Joi.string()).optional(),
  schoolYearId: Joi.string().optional(),
  location: Joi.string()
    .valid(...VALID_LOCATIONS)
    .optional(),
  ministryData: Joi.object({
    coordinationHours: Joi.number().min(0).max(50).allow(null),
    totalReportingHours: Joi.number().min(0).max(100).allow(null),
    ministryUseCode: Joi.number().allow(null),
  }).optional(),
  isActive: Joi.boolean().optional(),
});

export function validateOrchestra(orchestra, isUpdate = false) {
  const schema = isUpdate ? orchestraUpdateSchema : orchestraSchema;
  return schema.validate(orchestra, { abortEarly: false });
}

export const ORCHESTRA_CONSTANTS = {
  VALID_TYPES: ORCHESTRA_TYPES,
  VALID_LOCATIONS,
  ORCHESTRA_SUB_TYPES,
  PERFORMANCE_LEVELS,
};
