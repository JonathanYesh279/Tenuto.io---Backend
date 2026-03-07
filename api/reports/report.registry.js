/**
 * Report Generator Registry
 *
 * Auto-discovers generator files from api/reports/generators/ on startup.
 * Provides a role-filtered catalog and individual generator lookup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createLogger('report.registry');

/** @type {Map<string, object>} */
let generators = new Map();
let loaded = false;

const REQUIRED_FIELDS = ['id', 'name', 'category', 'roles', 'generate'];

/**
 * Catalog categories map the 5 generator-level categories into 4 user-facing sections.
 * `generatorCategories` lists which generator.category values belong to each section.
 */
const CATALOG_CATEGORIES = [
  { id: 'teacher', label: 'מורים', icon: 'Users', generatorCategories: ['teacher'] },
  { id: 'student', label: 'תלמידים', icon: 'GraduationCap', generatorCategories: ['student'] },
  { id: 'institutional', label: 'מוסדי', icon: 'Building', generatorCategories: ['institutional'] },
  { id: 'department-schedule', label: 'מחלקות ולו"ז', icon: 'Grid', generatorCategories: ['department', 'schedule'] },
];

/**
 * Loads all generator files from the generators/ subdirectory.
 * Called once at startup. Idempotent — subsequent calls are no-ops.
 *
 * In production, skips files starting with '_' (e.g., _example.generator.js).
 */
export async function loadGenerators() {
  if (loaded) return;

  const generatorsDir = path.join(__dirname, 'generators');
  const isProduction = process.env.NODE_ENV === 'production';

  let files;
  try {
    files = fs.readdirSync(generatorsDir).filter(f => f.endsWith('.generator.js'));
  } catch (err) {
    log.error({ err: err.message, dir: generatorsDir }, 'Failed to read generators directory');
    loaded = true;
    return;
  }

  for (const file of files) {
    const baseName = path.basename(file, '.generator.js');

    // Skip underscore-prefixed files in production (dev/test stubs)
    if (isProduction && baseName.startsWith('_')) {
      log.debug({ file }, 'Skipping dev-only generator in production');
      continue;
    }

    try {
      const filePath = path.join(generatorsDir, file);
      const module = await import(`file://${filePath}`);
      const generator = module.default;

      // Validate required fields
      const missing = REQUIRED_FIELDS.filter(f =>
        f === 'generate' ? typeof generator[f] !== 'function' : !generator[f]
      );

      if (missing.length > 0) {
        log.warn({ file, missing }, 'Generator missing required fields, skipping');
        continue;
      }

      generators.set(generator.id, generator);
      log.debug({ id: generator.id, file }, 'Loaded generator');
    } catch (err) {
      log.error({ err: err.message, file }, 'Failed to load generator');
    }
  }

  loaded = true;
  log.info({ count: generators.size }, 'Report generators loaded');
}

/**
 * Returns an array of generator metadata objects filtered by the user's roles.
 * Generators are included if any of the user's roles appears in the generator's roles list.
 *
 * @param {string[]} userRoles - The requesting user's roles
 * @returns {object[]} Metadata objects sorted by category then name
 */
export function getRegistry(userRoles) {
  const results = [];

  for (const generator of generators.values()) {
    const hasAccess = generator.roles.some(role => userRoles.includes(role));
    if (!hasAccess) continue;

    results.push({
      id: generator.id,
      name: generator.name,
      description: generator.description,
      category: generator.category,
      icon: generator.icon,
      params: generator.params,
      columns: generator.columns,
      exports: generator.exports,
    });
  }

  // Sort by category, then by name within each category
  results.sort((a, b) => {
    const catCompare = (a.category || '').localeCompare(b.category || '');
    if (catCompare !== 0) return catCompare;
    return (a.name || '').localeCompare(b.name || '');
  });

  return results;
}

/**
 * Returns a categorized catalog of reports filtered by the user's roles.
 * Groups the flat registry into 4 user-facing categories. Categories with
 * no visible reports are omitted from the result.
 *
 * @param {string[]} userRoles - The requesting user's roles
 * @returns {Array<{id: string, label: string, icon: string, reports: object[]}>}
 */
export function getCatalog(userRoles) {
  const reports = getRegistry(userRoles);

  const categories = [];
  for (const cat of CATALOG_CATEGORIES) {
    const catReports = reports.filter(r => cat.generatorCategories.includes(r.category));
    if (catReports.length === 0) continue;
    categories.push({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      reports: catReports,
    });
  }

  return categories;
}

/**
 * Returns the full generator object by id, or null if not found.
 *
 * @param {string} reportId - The generator's id
 * @returns {object|null}
 */
export function getGenerator(reportId) {
  return generators.get(reportId) || null;
}

/**
 * Resets the registry (for testing only).
 */
export function _resetForTest() {
  generators = new Map();
  loaded = false;
}
