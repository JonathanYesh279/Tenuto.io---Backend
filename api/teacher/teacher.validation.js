import Joi from 'joi';
import { ObjectId } from 'mongodb';
import {
  VALID_INSTRUMENTS,
  VALID_DAYS,
  TEACHER_ROLES,
  TEACHER_CLASSIFICATIONS,
  TEACHER_DEGREES,
  MANAGEMENT_ROLES,
  TEACHING_SUBJECTS,
} from '../../config/constants.js';

const VALID_DURATION = [30, 45, 60];
const VALID_AVAILABILITY_DURATION = [15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480];

// Schema for time block
const scheduleSlotSchema = Joi.object({
  _id: Joi.any().default(() => new ObjectId()),
  studentId: Joi.string().allow(null).default(null),
  day: Joi.string().valid(...VALID_DAYS).required(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  duration: Joi.alternatives()
    .try(
      Joi.number().min(15).max(480).positive().integer(),
      Joi.string().custom((value, helpers) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 15 || num > 480) {
          return helpers.error('any.invalid');
        }
        return num;
      })
    )
    .required()
    .messages({
      'any.invalid': 'Duration must be between 15 and 480 minutes',
      'any.required': 'Duration is required'
    }),
  isAvailable: Joi.boolean().default(true),
  location: Joi.string().allow('', null).default(null),
  notes: Joi.string().allow('', null).default(null),
  recurring: Joi.object({
    isRecurring: Joi.boolean().default(true),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    excludeDates: Joi.array().items(Joi.date()).default([]),
  }).default({ isRecurring: true, excludeDates: [] }),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date()),
});

// managementInfo sub-schema (new Ministry fields)
const managementInfoSchema = Joi.object({
  role: Joi.string().valid(...MANAGEMENT_ROLES).allow(null).default(null),
  managementHours: Joi.number().min(0).max(50).allow(null).default(null),
  accompHours: Joi.number().min(0).max(50).allow(null).default(null),
  ensembleCoordHours: Joi.number().min(0).max(50).allow(null).default(null),
  travelTimeHours: Joi.number().min(0).max(50).allow(null).default(null),
}).default({
  role: null,
  managementHours: null,
  accompHours: null,
  ensembleCoordHours: null,
  travelTimeHours: null,
});

// Original schema for creating new teachers
export const teacherSchema = Joi.object({
  tenantId: Joi.string().required(),

  personalInfo: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    phone: Joi.string()
      .pattern(/^05\d{8}$/)
      .required(),
    email: Joi.string().email().required(),
    address: Joi.string().required(),
    idNumber: Joi.string()
      .pattern(/^\d{9}$/)
      .allow(null, '')
      .default(null),
    birthYear: Joi.number()
      .integer()
      .min(1940)
      .max(2010)
      .allow(null)
      .default(null),
  }).required(),

  roles: Joi.array()
    .items(Joi.string().valid(...TEACHER_ROLES))
    .required(),

  professionalInfo: Joi.object({
    instrument: Joi.string().allow('', null).optional(),
    instruments: Joi.array()
      .items(Joi.string().valid(...VALID_INSTRUMENTS))
      .default([]),
    isActive: Joi.boolean().default(true),
    classification: Joi.string()
      .valid(...TEACHER_CLASSIFICATIONS)
      .allow(null)
      .default(null),
    degree: Joi.string()
      .valid(...TEACHER_DEGREES)
      .allow(null)
      .default(null),
    hasTeachingCertificate: Joi.boolean().allow(null).default(null),
    teachingExperienceYears: Joi.number()
      .integer()
      .min(0)
      .max(60)
      .allow(null)
      .default(null),
    isUnionMember: Joi.boolean().allow(null).default(null),
    teachingSubjects: Joi.array()
      .items(Joi.string().valid(...TEACHING_SUBJECTS))
      .default([]),
  }).required(),

  managementInfo: managementInfoSchema,

  teaching: Joi.object({
    timeBlocks: Joi.array()
      .items(scheduleSlotSchema)
      .default([]),
  }).required(),

  conducting: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()).default([]),
  }).default({}),

  ensemblesIds: Joi.array().items(Joi.string()).default([]),

  schoolYears: Joi.array()
    .items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    )
    .default([]),

  credentials: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().optional().allow(null, ''),
    invitationToken: Joi.string().optional(),
    invitationExpiry: Joi.date().optional(),
    isInvitationAccepted: Joi.boolean().default(false),
    invitedAt: Joi.date().optional(),
    invitedBy: Joi.string().optional(),
    passwordSetAt: Joi.date().optional(),
  }).required(),

  isActive: Joi.boolean().default(true),
}).custom((obj, helpers) => {
  if (obj.personalInfo.email !== obj.credentials.email) {
    return helpers.error('any.invalid', {
      message: 'Credentials email must match personal info email',
    });
  }
  return obj;
});

// Time block schema for updates
const scheduleSlotUpdateSchema = Joi.object({
  _id: Joi.any().optional(),
  studentId: Joi.string().allow(null).optional(),
  day: Joi.string().valid(...VALID_DAYS).optional(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  duration: Joi.alternatives()
    .try(
      Joi.number().min(15).max(480).positive().integer(),
      Joi.string().custom((value, helpers) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 15 || num > 480) {
          return helpers.error('any.invalid');
        }
        return num;
      })
    )
    .optional()
    .messages({
      'any.invalid': 'Duration must be between 15 and 480 minutes'
    }),
  isAvailable: Joi.boolean().optional(),
  location: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  recurring: Joi.object({
    isRecurring: Joi.boolean().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    excludeDates: Joi.array().items(Joi.date()).optional(),
  }).optional(),
  updatedAt: Joi.date().default(() => new Date()),
});

// managementInfo update sub-schema
const managementInfoUpdateSchema = Joi.object({
  role: Joi.string().valid(...MANAGEMENT_ROLES).allow(null),
  managementHours: Joi.number().min(0).max(50).allow(null),
  accompHours: Joi.number().min(0).max(50).allow(null),
  ensembleCoordHours: Joi.number().min(0).max(50).allow(null),
  travelTimeHours: Joi.number().min(0).max(50).allow(null),
}).optional();

// Schema for updating existing teachers
export const teacherUpdateSchema = Joi.object({
  tenantId: Joi.string().optional(),

  personalInfo: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    phone: Joi.string()
      .pattern(/^05\d{8}$/)
      .optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional(),
    idNumber: Joi.string()
      .pattern(/^\d{9}$/)
      .allow(null, '')
      .optional(),
    birthYear: Joi.number()
      .integer()
      .min(1940)
      .max(2010)
      .allow(null)
      .optional(),
  }).optional(),

  roles: Joi.array()
    .items(Joi.string().valid(...TEACHER_ROLES))
    .optional(),

  professionalInfo: Joi.object({
    instrument: Joi.string().allow('', null).optional(),
    instruments: Joi.array()
      .items(Joi.string().valid(...VALID_INSTRUMENTS))
      .optional(),
    isActive: Joi.boolean().optional(),
    classification: Joi.string()
      .valid(...TEACHER_CLASSIFICATIONS)
      .allow(null)
      .optional(),
    degree: Joi.string()
      .valid(...TEACHER_DEGREES)
      .allow(null)
      .optional(),
    hasTeachingCertificate: Joi.boolean().allow(null).optional(),
    teachingExperienceYears: Joi.number()
      .integer()
      .min(0)
      .max(60)
      .allow(null)
      .optional(),
    isUnionMember: Joi.boolean().allow(null).optional(),
    teachingSubjects: Joi.array()
      .items(Joi.string().valid(...TEACHING_SUBJECTS))
      .optional(),
  }).optional(),

  managementInfo: managementInfoUpdateSchema,

  teaching: Joi.object({
    timeBlocks: Joi.array()
      .items(scheduleSlotUpdateSchema)
      .optional(),
  }).optional(),

  conducting: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()).optional(),
  }).optional(),

  ensemblesIds: Joi.array().items(Joi.string()).optional(),

  schoolYears: Joi.array()
    .items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    )
    .optional(),

  credentials: Joi.object({
    email: Joi.string().email().optional(),
    password: Joi.string().allow('', null).optional(),
    invitationToken: Joi.string().optional(),
    invitationExpiry: Joi.date().optional(),
    isInvitationAccepted: Joi.boolean().optional(),
    invitedAt: Joi.date().optional(),
    invitedBy: Joi.string().optional(),
    passwordSetAt: Joi.date().optional(),
  }).optional(),

  isActive: Joi.boolean().optional(),
}).custom((obj, helpers) => {
  if (
    obj.personalInfo?.email &&
    obj.credentials?.email &&
    obj.personalInfo.email !== obj.credentials.email
  ) {
    return helpers.error('any.invalid', {
      message: 'Credentials email must match personal info email',
    });
  }
  return obj;
});

export function validateTeacher(teacher) {
  return teacherSchema.validate(teacher, { abortEarly: false });
}

export function validateTeacherUpdate(teacher) {
  return teacherUpdateSchema.validate(teacher, {
    abortEarly: false,
    allowUnknown: true,
  });
}

export const TEACHER_CONSTANTS = {
  VALID_RULES: TEACHER_ROLES,
  TEACHER_CLASSIFICATIONS,
  TEACHER_DEGREES,
  MANAGEMENT_ROLES,
  TEACHING_SUBJECTS,
};
