/**
 * Workflow Engine
 * 
 * Manages workflow state transitions for the Sample Entry to Purchase workflow.
 * Validates transitions based on user roles and required data.
 * 
 * FIXED: Allow going back from FINAL_REVIEW to OWNER_FINANCIAL when new inventory (new lorry) is added
 */

const SampleEntry = require('../models/SampleEntry');
const SampleEntryAuditLog = require('../models/SampleEntryAuditLog');
const InventoryData = require('../models/InventoryData');

// Define all valid workflow transitions
const WORKFLOW_TRANSITIONS = [
  // Staff can move entry to QUALITY_CHECK (without quality params) - just sends to quality supervisor
  {
    fromStatus: 'STAFF_ENTRY',
    toStatus: 'QUALITY_CHECK',
    allowedRoles: ['staff', 'quality_supervisor', 'physical_supervisor', 'admin', 'manager', 'owner'],
    requiredData: []
  },
  // Quality Supervisor adds quality params and moves to next step
  {
    fromStatus: 'STAFF_ENTRY',
    toStatus: 'QUALITY_CHECK',
    allowedRoles: ['quality_supervisor', 'physical_supervisor', 'admin', 'manager', 'owner'],
    requiredData: ['qualityParameters']
  },
  {
    fromStatus: 'QUALITY_CHECK',
    toStatus: 'LOT_SELECTION',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'QUALITY_CHECK',
    toStatus: 'COOKING_REPORT',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'QUALITY_CHECK',
    toStatus: 'FINAL_REPORT',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'QUALITY_CHECK',
    toStatus: 'FAILED',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  // Re-sample: Allow self-transition QUALITY_CHECK → QUALITY_CHECK when FAIL decision re-enters
  {
    fromStatus: 'QUALITY_CHECK',
    toStatus: 'QUALITY_CHECK',
    allowedRoles: ['admin', 'manager', 'staff', 'quality_supervisor', 'physical_supervisor'],
    requiredData: []
  },
  {
    fromStatus: 'LOT_SELECTION',
    toStatus: 'COOKING_REPORT',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'LOT_SELECTION',
    toStatus: 'FINAL_REPORT',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'LOT_SELECTION',
    toStatus: 'QUALITY_CHECK',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'LOT_SELECTION',
    toStatus: 'FAILED',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  // Re-sample: Allow LOT_SELECTION → STAFF_ENTRY for resample workflow
  {
    fromStatus: 'LOT_SELECTION',
    toStatus: 'STAFF_ENTRY',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  // Re-sample: Allow FINAL_REPORT → STAFF_ENTRY for resample workflow
  {
    fromStatus: 'FINAL_REPORT',
    toStatus: 'STAFF_ENTRY',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'COOKING_REPORT',
    toStatus: 'LOT_SELECTION',
    allowedRoles: ['admin', 'manager'],
    requiredData: ['cookingReport']
  },
  {
    fromStatus: 'COOKING_REPORT',
    toStatus: 'FINAL_REPORT',
    allowedRoles: ['admin', 'manager'],
    requiredData: ['cookingReport']
  },
  {
    fromStatus: 'COOKING_REPORT',
    toStatus: 'FAILED',
    allowedRoles: ['admin', 'manager'],
    requiredData: ['cookingReport']
  },
  {
    fromStatus: 'FINAL_REPORT',
    toStatus: 'QUALITY_CHECK',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'FINAL_REPORT',
    toStatus: 'LOT_SELECTION',
    allowedRoles: ['admin', 'manager'],
    requiredData: ['cookingReport']
  },
  {
    fromStatus: 'FINAL_REPORT',
    toStatus: 'LOT_ALLOTMENT',
    allowedRoles: ['admin', 'manager', 'owner'],
    requiredData: ['offeringPrice']
  },
  {
    fromStatus: 'LOT_SELECTION',
    toStatus: 'LOT_ALLOTMENT',
    allowedRoles: ['admin', 'manager', 'owner'],
    requiredData: ['offeringPrice']
  },
  {
    fromStatus: 'LOT_ALLOTMENT',
    toStatus: 'PHYSICAL_INSPECTION',
    allowedRoles: ['physical_supervisor', 'manager', 'admin'],
    requiredData: ['lotAllotment']
  },
  {
    fromStatus: 'LOT_ALLOTMENT',
    toStatus: 'QUALITY_CHECK',
    allowedRoles: ['staff', 'quality_supervisor', 'physical_supervisor', 'admin', 'manager'],
    requiredData: []
  },
  {
    fromStatus: 'LOT_ALLOTMENT',
    toStatus: 'FAILED',
    allowedRoles: ['admin', 'manager', 'owner'],
    requiredData: []
  },
  {
    fromStatus: 'PHYSICAL_INSPECTION',
    toStatus: 'INVENTORY_ENTRY',
    allowedRoles: ['inventory_staff', 'admin', 'manager'],
    requiredData: ['physicalInspection']
  },
  // Allow physical supervisor to add more inspections while already in PHYSICAL_INSPECTION
  {
    fromStatus: 'PHYSICAL_INSPECTION',
    toStatus: 'PHYSICAL_INSPECTION',
    allowedRoles: ['physical_supervisor', 'manager', 'admin'],
    requiredData: []
  },
  // Manager can close a lot early (party didn't send all bags)
  {
    fromStatus: 'LOT_ALLOTMENT',
    toStatus: 'INVENTORY_ENTRY',
    allowedRoles: ['manager', 'admin'],
    requiredData: []
  },
  // First time: INVENTORY_ENTRY -> OWNER_FINANCIAL
  {
    fromStatus: 'INVENTORY_ENTRY',
    toStatus: 'OWNER_FINANCIAL',
    allowedRoles: ['admin', 'manager', 'owner'],
    requiredData: ['inventoryData']
  },
  {
    fromStatus: 'OWNER_FINANCIAL',
    toStatus: 'MANAGER_FINANCIAL',
    allowedRoles: ['manager', 'admin'],
    requiredData: ['ownerFinancialCalculations']
  },
  {
    fromStatus: 'MANAGER_FINANCIAL',
    toStatus: 'FINAL_REVIEW',
    allowedRoles: ['admin', 'manager'],
    requiredData: ['managerFinancialCalculations']
  },
  // KEY FIX: Allow going back when new inventory (new lorry) is added at any stage
  {
    fromStatus: 'OWNER_FINANCIAL',
    toStatus: 'OWNER_FINANCIAL',
    allowedRoles: ['admin', 'manager', 'owner', 'inventory_staff'],
    requiredData: []
  },
  {
    fromStatus: 'MANAGER_FINANCIAL',
    toStatus: 'OWNER_FINANCIAL',
    allowedRoles: ['admin', 'manager', 'owner', 'inventory_staff'],
    requiredData: []
  },
  {
    fromStatus: 'FINAL_REVIEW',
    toStatus: 'OWNER_FINANCIAL',
    allowedRoles: ['admin', 'manager', 'owner', 'inventory_staff'],
    requiredData: []
  },
  {
    fromStatus: 'FINAL_REVIEW',
    toStatus: 'COMPLETED',
    allowedRoles: ['admin', 'manager'],
    requiredData: []
  }
];

class WorkflowEngine {
  /**
   * Transition a sample entry to a new workflow status
   */
  async transitionTo(sampleEntryId, toStatus, userId, userRole, metadata = {}) {
    try {
      // Get the sample entry
      const sampleEntry = await SampleEntry.findByPk(sampleEntryId);

      if (!sampleEntry) {
        throw new Error('Sample entry not found');
      }

      const fromStatus = sampleEntry.workflowStatus;

      console.log(`[WORKFLOW] Attempting transition for entry ${sampleEntryId}: ${fromStatus} -> ${toStatus} (User: ${userId}, Role: ${userRole})`);

      // Check if transition is allowed
      if (!this.canTransition(fromStatus, toStatus, userRole)) {
        console.error(`[WORKFLOW] Transition REJECTED: ${fromStatus} -> ${toStatus} not allowed for role: ${userRole}`);
        // Log all allowed transitions for this status and role to help debug
        const allowed = this.getNextAllowedStatuses(fromStatus, userRole);
        console.error(`[WORKFLOW] Allowed next statuses for ${fromStatus} and ${userRole}: ${allowed.join(', ') || 'NONE'}`);

        throw new Error(`Transition from ${fromStatus} to ${toStatus} not allowed for role ${userRole}`);
      }

      // Update workflow status
      const oldStatus = sampleEntry.workflowStatus;
      sampleEntry.workflowStatus = toStatus;
      await sampleEntry.save();

      console.log(`Workflow transitioned successfully: ${oldStatus} -> ${toStatus}`);

      // Log the transition in audit trail
      await SampleEntryAuditLog.create({
        userId,
        recordId: sampleEntryId,
        tableName: 'sample_entries',
        actionType: 'WORKFLOW_TRANSITION',
        oldValues: { workflowStatus: oldStatus },
        newValues: { workflowStatus: toStatus },
        metadata: {
          ...metadata,
          transitionedAt: new Date(),
          userRole
        }
      });

      return sampleEntry;

    } catch (error) {
      console.error('Workflow transition error:', error);
      throw error;
    }
  }

  /**
   * Check if a transition is allowed
   */
  canTransition(currentStatus, toStatus, userRole) {
    const transition = WORKFLOW_TRANSITIONS.find(
      t => t.fromStatus === currentStatus && t.toStatus === toStatus
    );

    if (!transition) {
      return false;
    }

    return transition.allowedRoles.includes(userRole);
  }

  /**
   * Get next allowed statuses for current status and user role
   */
  getNextAllowedStatuses(currentStatus, userRole) {
    return WORKFLOW_TRANSITIONS
      .filter(t => t.fromStatus === currentStatus && t.allowedRoles.includes(userRole))
      .map(t => t.toStatus);
  }

  /**
   * Get all transitions
   */
  getAllTransitions() {
    return WORKFLOW_TRANSITIONS;
  }
}

module.exports = new WorkflowEngine();
