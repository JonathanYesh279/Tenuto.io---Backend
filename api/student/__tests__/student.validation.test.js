// api/student/__tests__/student.validation.test.js
import { describe, it, expect } from 'vitest'
import { validateStudent, studentSchema, STUDENT_CONSTANTS } from '../student.validation.js'

describe('Student Validation', () => {
  describe('validateStudent', () => {
    it('should validate a valid student object', () => {
      // Setup
      const validStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student',
          phone: '0501234567',
          age: 15,
          address: 'Test Address',
          parentName: 'Parent Name',
          parentPhone: '0501234568',
          parentEmail: 'parent@example.com',
          studentEmail: 'student@example.com'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 3,
              isPrimary: true,
              tests: {
                stageTest: {
                  status: 'עבר/ה',
                  lastTestDate: new Date('2023-05-15'),
                  nextTestDate: null,
                  notes: 'Performed well'
                },
                technicalTest: {
                  status: 'עבר/ה',
                  lastTestDate: new Date('2023-06-10'),
                  nextTestDate: null,
                  notes: 'Good technique'
                }
              }
            }
          ],
          class: 'ט'
        },
        enrollments: {
          orchestraIds: ['orchestra1', 'orchestra2'],
          ensembleIds: ['ensemble1'],
          schoolYears: [
            {
              schoolYearId: 'year1',
              isActive: true
            }
          ]
        },
        isActive: true
      }

      // Execute
      const { error, value } = validateStudent(validStudent)

      // Assert
      expect(error).toBeUndefined()
      expect(value).toMatchObject({
        personalInfo: { firstName: 'Test', lastName: 'Student' },
        academicInfo: { instrumentProgress: expect.any(Array), class: 'ט' }
      })
    })

    it('should validate with default values for optional fields', () => {
      // Setup
      const minimalStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1,
              isPrimary: true
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error, value } = validateStudent(minimalStudent)

      // Assert
      expect(error).toBeUndefined()
      expect(value.personalInfo.firstName).toBe('Test')
      expect(value.personalInfo.lastName).toBe('Student')
      expect(value.academicInfo.instrumentProgress[0].instrumentName).toBe('חצוצרה')
      expect(value.academicInfo.instrumentProgress[0].currentStage).toBe(1)
      expect(value.academicInfo.class).toBe('א')
      expect(value.enrollments).toBeDefined()
      expect(value.enrollments.orchestraIds).toEqual([])
      expect(value.enrollments.ensembleIds).toEqual([])
      expect(value.enrollments.schoolYears).toEqual([])
      expect(value.isActive).toBe(true)
    })

    it('should require personalInfo', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        // Missing personalInfo
        academicInfo: {
          instrumentProgress: [
            { instrumentName: 'חצוצרה', currentStage: 1 }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo" is required')
    })

    it('should require academicInfo', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        }
        // Missing academicInfo
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo" is required')
    })

    it('should require firstName in personalInfo', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          // Missing firstName
          lastName: 'Student',
          phone: '0501234567'
        },
        academicInfo: {
          instrumentProgress: [
            { instrumentName: 'חצוצרה', currentStage: 1 }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.firstName" is required')
    })

    it('should validate phone number format', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student',
          phone: '12345678' // Invalid format
        },
        academicInfo: {
          instrumentProgress: [
            { instrumentName: 'חצוצרה', currentStage: 1 }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.phone" with value')
    })

    it('should validate email formats', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student',
          parentEmail: 'invalid-email', // Invalid format
          studentEmail: 'another-invalid-email' // Invalid format
        },
        academicInfo: {
          instrumentProgress: [
            { instrumentName: 'חצוצרה', currentStage: 1 }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"personalInfo.parentEmail" must be a valid email')
    })

    it('should require instrumentProgress in academicInfo', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          // Missing instrumentProgress
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.instrumentProgress" is required')
    })

    it('should validate instrument is in allowed list', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'Piano', // Not in allowed list
              currentStage: 1
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.instrumentProgress[0].instrumentName" must be one of')
    })

    it('should require currentStage in instrumentProgress', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה'
              // Missing currentStage
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.instrumentProgress[0].currentStage" is required')
    })

    it('should validate currentStage is in allowed range', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 10 // Outside allowed range
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      // Updated to match the actual error message
      expect(error.message).toContain('Current stage must be a number between 1 and 8')
    })

    it('should require class in academicInfo for regular users', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1
            }
          ]
          // Missing class
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent, false, false)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.class" is required')
    })

    it('should NOT require class in academicInfo for admin users', () => {
      // Setup
      const studentWithoutClass = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1
            }
          ]
          // Missing class - should be OK for admin
        }
      }

      // Execute
      const { error } = validateStudent(studentWithoutClass, false, true)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should NOT require class in academicInfo for update operations', () => {
      // Setup
      const studentWithoutClass = {
        personalInfo: {
          firstName: 'Test',
          lastName: 'Updated'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'קלרינט',
              currentStage: 2
            }
          ]
          // Missing class - should be OK for updates
        }
      }

      // Execute
      const { error } = validateStudent(studentWithoutClass, true, false)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should validate class is in allowed list', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1
            }
          ],
          class: 'invalid-class' // Not in allowed list
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"academicInfo.class" must be one of')
    })

    it('should validate test status values', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1,
              tests: {
                stageTest: {
                  status: 'invalid-status' // Invalid status
                }
              }
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('must be one of')
    })

    it('should validate school year entries', () => {
      // Setup
      const invalidStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1
            }
          ],
          class: 'א'
        },
        enrollments: {
          schoolYears: [
            {
              // Missing schoolYearId
              isActive: true
            }
          ]
        }
      }

      // Execute
      const { error } = validateStudent(invalidStudent)

      // Assert
      expect(error).toBeDefined()
      expect(error.message).toContain('"enrollments.schoolYears[0].schoolYearId" is required')
    })
  })

  describe('STUDENT_CONSTANTS', () => {
    it('should define valid classes', () => {
      // Assert
      expect(STUDENT_CONSTANTS.VALID_CLASSES).toEqual(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'אחר'])
    })

    it('should define valid stages', () => {
      // Assert
      expect(STUDENT_CONSTANTS.VALID_STAGES).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('should define valid test statuses', () => {
      // Assert
      expect(STUDENT_CONSTANTS.TEST_STATUSES).toEqual(['לא נבחן', 'עבר/ה', 'לא עבר/ה', 'עבר/ה בהצטיינות', 'עבר/ה בהצטיינות יתרה'])
    })
  })

  describe('studentSchema', () => {
    it('should be a valid Joi schema object', () => {
      // Assert
      expect(studentSchema).toBeDefined()
      expect(studentSchema.validate).toBeTypeOf('function')
    })

    it('should set default values correctly', () => {
      // Setup - Create a minimal valid student
      const minimalStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { value } = studentSchema.validate(minimalStudent)

      // Assert - Check default values
      expect(value.enrollments).toBeDefined()
      expect(value.enrollments.orchestraIds).toEqual([])
      expect(value.enrollments.ensembleIds).toEqual([])
      expect(value.enrollments.schoolYears).toEqual([])
      expect(value.isActive).toBe(true)
      expect(value.academicInfo.instrumentProgress[0].tests).toBeDefined()
    })

    it('should allow null for optional personalInfo fields', () => {
      // Setup
      const studentWithNulls = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student',
          phone: null,
          age: null,
          address: null,
          parentName: null,
          parentPhone: null,
          parentEmail: null,
          studentEmail: null
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(studentWithNulls)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should allow empty strings for notes fields', () => {
      // Setup
      const studentWithEmptyNotes = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Test',
          lastName: 'Student'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 1,
              tests: {
                stageTest: {
                  status: 'לא נבחן',
                  notes: ''
                },
                technicalTest: {
                  status: 'לא נבחן',
                  notes: ''
                }
              }
            }
          ],
          class: 'א'
        }
      }

      // Execute
      const { error } = validateStudent(studentWithEmptyNotes)

      // Assert
      expect(error).toBeUndefined()
    })

    it('should allow full student object with all properties', () => {
      // Setup
      const fullStudent = {
        tenantId: 'test-tenant-id',
        personalInfo: {
          firstName: 'Full Test',
          lastName: 'Student',
          phone: '0501234567',
          age: 16,
          address: 'Full Address',
          parentName: 'Full Parent Name',
          parentPhone: '0501234568',
          parentEmail: 'fullparent@example.com',
          studentEmail: 'fullstudent@example.com'
        },
        academicInfo: {
          instrumentProgress: [
            {
              instrumentName: 'חצוצרה',
              currentStage: 4,
              isPrimary: true,
              tests: {
                stageTest: {
                  status: 'עבר/ה',
                  lastTestDate: new Date('2023-05-15'),
                  nextTestDate: new Date('2024-05-15'),
                  notes: 'Full notes for stage test'
                },
                technicalTest: {
                  status: 'עבר/ה',
                  lastTestDate: new Date('2023-06-10'),
                  nextTestDate: new Date('2024-06-10'),
                  notes: 'Full notes for technical test'
                }
              }
            }
          ],
          class: 'י'
        },
        enrollments: {
          orchestraIds: ['orchestra1', 'orchestra2', 'orchestra3'],
          ensembleIds: ['ensemble1', 'ensemble2'],
          schoolYears: [
            {
              schoolYearId: 'year1',
              isActive: true
            },
            {
              schoolYearId: 'year2',
              isActive: false
            }
          ]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Execute
      const { error } = validateStudent(fullStudent)

      // Assert
      expect(error).toBeUndefined()
    })
  })
})
