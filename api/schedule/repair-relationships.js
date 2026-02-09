import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Repair all relationships in the system
 * Simplified to only initialize missing student structures and validate consistency.
 */
export async function repairAllRelationships() {
  console.log('Starting comprehensive relationship repair...');

  try {
    const results = {
      studentsFixed: 0,
      errors: []
    };

    // Initialize missing arrays for students
    console.log('Step 1: Initializing student structures...');
    await initializeStudentStructures(results);

    console.log('Relationship repair completed!');
    console.log('Results:', results);

    return results;
  } catch (error) {
    console.error('Error during relationship repair:', error.message);
    throw error;
  }
}

async function initializeStudentStructures(results) {
  const studentCollection = await getCollection('student');

  const studentsWithoutStructure = await studentCollection.find({
    $or: [
      { teacherAssignments: { $exists: false } },
      { teacherAssignments: null }
    ]
  }).toArray();

  for (const student of studentsWithoutStructure) {
    try {
      await studentCollection.updateOne(
        { _id: student._id },
        {
          $set: {
            teacherAssignments: student.teacherAssignments || [],
            updatedAt: new Date()
          }
        }
      );
      results.studentsFixed++;
      console.log(`Fixed student structure: ${`${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim()}`);
    } catch (error) {
      results.errors.push(`Student ${student._id}: ${error.message}`);
    }
  }
}

/**
 * Validate schedule integrity by checking teacher-student consistency
 */
export async function validateScheduleIntegrity() {
  const teacherCollection = await getCollection('teacher');
  const studentCollection = await getCollection('student');

  const report = {
    totalTeachers: 0,
    totalStudents: 0,
    inconsistencies: []
  };

  const teachers = await teacherCollection.find({}).toArray();
  report.totalTeachers = teachers.length;

  const students = await studentCollection.find({}).toArray();
  report.totalStudents = students.length;

  for (const student of students) {
    const teacherAssignments = student.teacherAssignments || [];
    const activeAssignments = teacherAssignments.filter(a => a.isActive);
    const assignmentTeacherIds = [...new Set(activeAssignments.map(a => a.teacherId))];

    // Check that all referenced teachers exist
    for (const teacherId of assignmentTeacherIds) {
      const teacherExists = teachers.some(t => t._id.toString() === teacherId);
      if (!teacherExists) {
        report.inconsistencies.push({
          studentId: student._id,
          studentName: `${student.personalInfo?.firstName || ''} ${student.personalInfo?.lastName || ''}`.trim(),
          issue: 'Active assignment references non-existent teacher',
          teacherId
        });
      }
    }
  }

  return report;
}

/**
 * Repair a specific teacher-student relationship (generic utility)
 */
export async function repairTeacherStudentRelationship(teacherId, studentId) {
  try {
    const studentCollection = await getCollection('student');

    // Ensure teacherAssignment exists (single source of truth)
    const student = await studentCollection.findOne(
      { _id: ObjectId.createFromHexString(studentId) }
    );

    const hasAssignment = student?.teacherAssignments?.some(
      a => a.teacherId === teacherId && a.isActive
    );

    if (!hasAssignment) {
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        {
          $push: {
            teacherAssignments: {
              teacherId,
              scheduleSlotId: null,
              startDate: new Date(),
              endDate: null,
              isActive: true,
              notes: 'Repaired relationship',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          $set: { updatedAt: new Date() }
        }
      );
    }

    return { success: true, teacherId, studentId };
  } catch (error) {
    console.error(`Error repairing relationship: ${error.message}`);
    throw error;
  }
}
