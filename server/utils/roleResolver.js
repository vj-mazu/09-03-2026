/**
 * Resolve workflow-specific effective role from user role + staffType.
 *
 * Rule:
 * - staff + mill => quality_supervisor
 * - staff + location => physical_supervisor
 * - otherwise keep original role
 */
function resolveEffectiveRole(user = {}) {
  const role = user.role;
  const staffType = typeof user.staffType === 'string' ? user.staffType.toLowerCase() : null;

  if (role !== 'staff') {
    return role;
  }

  if (staffType === 'mill') {
    return 'quality_supervisor';
  }

  if (staffType === 'location') {
    return 'physical_supervisor';
  }

  return role;
}

module.exports = { resolveEffectiveRole };
