const express = require('express');
const router = express.Router();
const { auth: authenticateToken } = require('../middleware/auth');
const SampleEntryService = require('../services/SampleEntryService');
const QualityParametersService = require('../services/QualityParametersService');
const CookingReportService = require('../services/CookingReportService');
const LotAllotmentService = require('../services/LotAllotmentService');
const PhysicalInspectionService = require('../services/PhysicalInspectionService');
const InventoryDataService = require('../services/InventoryDataService');
const FinancialCalculationService = require('../services/FinancialCalculationService');
const WorkflowEngine = require('../services/WorkflowEngine');
const FileUploadService = require('../services/FileUploadService');
const SampleEntry = require('../models/SampleEntry');
const QualityParameters = require('../models/QualityParameters');
const SampleEntryOffering = require('../models/SampleEntryOffering');
const CookingReport = require('../models/CookingReport');
const SampleEntryAuditLog = require('../models/SampleEntryAuditLog');
const User = require('../models/User');
const { Op, col, where: sqlWhere } = require('sequelize');
const getWorkflowRole = (user) => user?.effectiveRole || user?.role;
const canLocationStaffEditQuality = async (sampleEntry, reqUser) => {
  const workflowRole = getWorkflowRole(reqUser);
  if (workflowRole !== 'physical_supervisor' || sampleEntry.entryType !== 'LOCATION_SAMPLE') {
    return true;
  }

  // Location staff can edit:
  // 1) entries they created (existing behavior)
  // 2) re-sample entries explicitly assigned to their username
  if (sampleEntry.createdBy === reqUser.userId) {
    return true;
  }

  let currentUsername = String(reqUser?.username || '').trim().toLowerCase();
  if (!currentUsername) {
    const currentUser = await User.findByPk(reqUser.userId, { attributes: ['username'], raw: true });
    currentUsername = String(currentUser?.username || '').trim().toLowerCase();
  }

  const assignedUsername = String(sampleEntry.sampleCollectedBy || '').trim().toLowerCase();
  const isAssignedCollector = !!assignedUsername
    && !!currentUsername
    && assignedUsername === currentUsername;

  return isAssignedCollector;
};

const invalidateSampleEntryTabCaches = () => {
  [
    'sample-entries/tabs/final-pass-lots',
    'sample-entries/tabs/loading-lots',
    'sample-entries/tabs/resample-assignments',
    'sample-entries/tabs/completed-lots',
    'sample-entries/by-role'
  ].forEach(invalidateCache);
};

// ─── Paddy Supervisors list (for Sample Collected By dropdown) ───
router.get('/paddy-supervisors', authenticateToken, async (req, res) => {
  try {
    const { staffType } = req.query;
    const whereClause = {
      role: 'staff',
      isActive: true
    };
    if (staffType) {
      whereClause.staffType = staffType;
    }
    const supervisors = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'staffType'],
      order: [['username', 'ASC']]
    });

    res.json({
      success: true,
      users: supervisors.map(u => ({ id: u.id, username: u.username, staffType: u.staffType || null }))
    });
  } catch (error) {
    console.error('Get paddy supervisors error:', error);
    res.status(500).json({ error: 'Failed to fetch paddy supervisors' });
  }
});

// Staff-only: Move entry to QUALITY_CHECK without adding quality parameters
router.post('/:id/send-to-quality', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;

    // Only staff can use this endpoint
    if (req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Only staff can use this endpoint' });
    }

    // Get the entry to verify it exists
    const SampleEntry = require('../models/SampleEntry');
    const entry = await SampleEntry.findByPk(entryId);

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    // Check current status
    if (entry.workflowStatus !== 'STAFF_ENTRY') {
      return res.status(400).json({ error: 'Entry is not in STAFF_ENTRY status' });
    }

    // Transition to QUALITY_CHECK
    await WorkflowEngine.transitionTo(
      entryId,
      'QUALITY_CHECK',
      req.user.userId,
      getWorkflowRole(req.user),
      { sentByStaff: true }
    );

    res.json({ message: 'Entry sent to Quality Supervisor successfully' });
  } catch (error) {
    console.error('Error sending to quality:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create sample entry (Staff)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const entry = await SampleEntryService.createSampleEntry(req.body, req.user.userId);
    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating sample entry:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get sample entries by role
router.get('/by-role', authenticateToken, async (req, res) => {
  try {
    const { status, startDate, endDate, broker, variety, party, location, page, pageSize, cursor, entryType, excludeEntryType } = req.query;

    const filters = {
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      broker,
      variety,
      party,
      location,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
      cursor,
      staffType: req.user.staffType || null,
      entryType,
      excludeEntryType
    };

    // Keep sample-book visibility for all staff users (mill/location).
    // For listing endpoints, using effectiveRole (quality_supervisor/physical_supervisor)
    // applies strict workflow status filters and hides normal staff entries.
    const queryRole =
      req.user.role === 'staff'
        ? 'staff'
        : getWorkflowRole(req.user);

    const result = await SampleEntryService.getSampleEntriesByRole(queryRole, filters, req.user.userId);
    res.json(result);
  } catch (error) {
    console.error('Error getting sample entries:', error);
    res.status(500).json({ error: error.message });
  }
});

const { buildCursorQuery, formatCursorResponse } = require('../utils/cursorPagination');
const {
  SAMPLE_ENTRY_CURSOR_FIELDS,
  fetchHydratedSampleEntryPage
} = require('../utils/sampleEntryPagination');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');

// ─── TAB ROUTES (MUST be before /:id to avoid route shadowing) ───

const attachLoadingLotsHistories = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const pushHistoryValue = (list, value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (list.some((item) => String(item).toLowerCase() === lower)) return;
    list.push(normalized);
  };
  const buildQualityAttemptDetail = (source, fallbackCreatedAt) => {
    if (!source) return null;

    const reportedBy = typeof source.reportedBy === 'string' ? source.reportedBy.trim() : '';
    const detail = {
      reportedBy,
      createdAt: source.updatedAt || source.createdAt || fallbackCreatedAt || null,
      moisture: source.moisture ?? null,
      dryMoisture: source.dryMoisture ?? null,
      cutting1: source.cutting1 ?? null,
      cutting2: source.cutting2 ?? null,
      bend1: source.bend1 ?? null,
      bend2: source.bend2 ?? null,
      mix: source.mix ?? null,
      kandu: source.kandu ?? null,
      oil: source.oil ?? null,
      sk: source.sk ?? null,
      grainsCount: source.grainsCount ?? null,
      wbR: source.wbR ?? null,
      wbBk: source.wbBk ?? null,
      wbT: source.wbT ?? null,
      paddyWb: source.paddyWb ?? null,
      gramsReport: source.gramsReport ?? null
    };

    const hasData = Object.values(detail).some((value) => value !== null && value !== '' && value !== undefined);
    return hasData ? detail : null;
  };

  const sampleEntryIds = rows
    .map((row) => row?.id)
    .filter(Boolean);

  const qualityIds = rows
    .map((row) => row?.qualityParameters?.id)
    .filter(Boolean);

  if (sampleEntryIds.length === 0 && qualityIds.length === 0) return rows;

  const [sampleEntryLogs, qualityLogs] = await Promise.all([
    sampleEntryIds.length > 0
      ? SampleEntryAuditLog.findAll({
        where: {
          tableName: 'sample_entries',
          actionType: { [Op.in]: ['CREATE', 'UPDATE'] },
          recordId: { [Op.in]: sampleEntryIds }
        },
        attributes: ['recordId', 'newValues', 'createdAt'],
        order: [['createdAt', 'ASC']],
        raw: true
      })
      : [],
    qualityIds.length > 0
      ? SampleEntryAuditLog.findAll({
        where: {
          tableName: 'quality_parameters',
          actionType: { [Op.in]: ['CREATE', 'UPDATE'] },
          recordId: { [Op.in]: qualityIds }
        },
        attributes: ['recordId', 'newValues', 'createdAt'],
        order: [['createdAt', 'ASC']],
        raw: true
      })
      : []
  ]);

  const sampleCollectedHistoryByEntryId = new Map();
  sampleEntryLogs.forEach((log) => {
    const key = String(log.recordId);
    if (!sampleCollectedHistoryByEntryId.has(key)) sampleCollectedHistoryByEntryId.set(key, []);
    sampleCollectedHistoryByEntryId.get(key).push(log);
  });

  const qualityHistoryByQualityId = new Map();
  qualityLogs.forEach((log) => {
    const key = String(log.recordId);
    if (!qualityHistoryByQualityId.has(key)) qualityHistoryByQualityId.set(key, []);
    qualityHistoryByQualityId.get(key).push(log);
  });

  rows.forEach((row) => {
    const target = row?.dataValues || row;
    const sampleCollectedHistory = [];
    const sampleEntryAuditLogs = sampleCollectedHistoryByEntryId.get(String(row?.id)) || [];

    sampleEntryAuditLogs.forEach((log) => {
      const sampleCollectedBy = typeof log.newValues?.sampleCollectedBy === 'string'
        ? log.newValues.sampleCollectedBy.trim()
        : '';

      pushHistoryValue(sampleCollectedHistory, sampleCollectedBy);
    });

    const currentSampleCollectedBy = typeof row?.sampleCollectedBy === 'string'
      ? row.sampleCollectedBy.trim()
      : '';

    if (currentSampleCollectedBy) {
      pushHistoryValue(sampleCollectedHistory, currentSampleCollectedBy);
    }

    target.sampleCollectedHistory = sampleCollectedHistory;

    const qualityId = row?.qualityParameters?.id;
    if (!qualityId) {
      target.qualityReportHistory = [];
      target.qualityReportAttempts = 0;
      target.qualityAttemptDetails = [];
      return;
    }

    const history = [];
    const auditLogs = qualityHistoryByQualityId.get(String(qualityId)) || [];

    auditLogs.forEach((log) => {
      const reportedBy = typeof log.newValues?.reportedBy === 'string'
        ? log.newValues.reportedBy.trim()
        : '';
      pushHistoryValue(history, reportedBy);
    });

    const currentReportedBy = typeof row.qualityParameters?.reportedBy === 'string'
      ? row.qualityParameters.reportedBy.trim()
      : '';

    if (currentReportedBy) {
      pushHistoryValue(history, currentReportedBy);
    }

    // Determine if this is a resample case (max 2 attempts: 1st sample + resample)
    const isResampleCase = row?.lotSelectionDecision === 'FAIL';

    // Build attempt details: strictly 1 or 2 attempts only
    // Attempt 1 = FIRST audit log (original quality data)
    // Attempt 2 = CURRENT quality data (resample data) — only if lotSelectionDecision === 'FAIL'
    const qualityAttemptDetails = [];

    if (auditLogs.length > 0) {
      // Attempt 1: first audit log entry (original sample data)
      const firstDetail = buildQualityAttemptDetail(auditLogs[0].newValues, auditLogs[0].createdAt);
      if (firstDetail) {
        qualityAttemptDetails.push({ attemptNo: 1, ...firstDetail });
      }

      // Attempt 2: current quality data (resample) — only if actual resample
      if (isResampleCase && auditLogs.length > 1) {
        const currentDetail = buildQualityAttemptDetail(row.qualityParameters, row.qualityParameters?.updatedAt || row.qualityParameters?.createdAt);
        if (currentDetail) {
          qualityAttemptDetails.push({ attemptNo: 2, ...currentDetail });
        }
      }
    }

    // Fallback: if no audit logs, use current quality data as attempt 1
    if (qualityAttemptDetails.length === 0) {
      const fallbackDetail = buildQualityAttemptDetail(row.qualityParameters, row.createdAt);
      if (fallbackDetail) {
        qualityAttemptDetails.push({ attemptNo: 1, ...fallbackDetail });
      }
    }

    target.qualityReportHistory = history;
    // Cap attempts: 1 for normal, 2 for resample — never more
    target.qualityReportAttempts = isResampleCase ? 2 : 1;
    target.qualityAttemptDetails = qualityAttemptDetails;
  });

  return rows;
};

// ─── Loading Lots (passed lots in processing) ───
router.get('/tabs/loading-lots', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, cursor, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const where = {
      workflowStatus: {
        [Op.in]: ['LOT_ALLOTMENT', 'PHYSICAL_INSPECTION', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW', 'COMPLETED']
      }
    };
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate && endDate) where.entryDate = { [Op.between]: [startDate, endDate] };
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    // Use cursor pagination if cursor provided, else fallback to offset
    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        attributes: ['id', 'serialNo', 'entryDate', 'brokerName', 'variety', 'partyName', 'location', 'bags', 'packaging', 'workflowStatus', 'createdAt', 'sampleCollectedBy', 'entryType', 'lorryNumber', 'lotSelectionDecision', 'lotSelectionAt'],
        include: [
          {
            model: QualityParameters,
            as: 'qualityParameters',
            attributes: [
              'id', 'reportedBy', 'moisture', 'dryMoisture', 'cutting1', 'cutting2',
              'bend1', 'bend2', 'mix', 'kandu', 'oil', 'sk', 'grainsCount',
              'wbR', 'wbBk', 'wbT', 'paddyWb', 'gramsReport', 'createdAt', 'updatedAt'
            ],
            required: false
          },
          {
            model: CookingReport,
            as: 'cookingReport',
            attributes: ['id', 'status', 'remarks', 'cookingDoneBy', 'cookingApprovedBy', 'history', 'updatedAt', 'createdAt'],
            required: false
          },
          { model: SampleEntryOffering, as: 'offering' },
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ],
        subQuery: false
      }
    });

    await attachLoadingLotsHistories(result.entries);

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting loading lots:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ——— Resample Allotment (location resamples) ———
router.get('/tabs/resample-assignments', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const where = {
      lotSelectionDecision: 'FAIL',
      workflowStatus: { [Op.ne]: 'FAILED' }
    };
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate && endDate) where.entryDate = { [Op.between]: [startDate, endDate] };
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        attributes: [
          'id', 'serialNo', 'entryDate', 'brokerName', 'variety', 'partyName', 'location', 'bags',
          'packaging', 'workflowStatus', 'createdAt', 'sampleCollectedBy', 'entryType',
          'lorryNumber', 'lotSelectionDecision'
        ],
        include: [],
        subQuery: false
      }
    });

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting resample assignments:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Final Pass Lots (optimized for very large datasets) ───
router.get('/tabs/final-pass-lots', authenticateToken, cacheMiddleware(15), async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 100,
      broker,
      variety,
      party,
      location,
      startDate,
      endDate,
      entryType,
      excludeEntryType
    } = req.query;

    // Final Pass Lots should include:
    // 1) entries directly moved to FINAL_REPORT
    // 2) entries that went to cooking and came back to LOT_SELECTION with PASS/MEDIUM
    // 3) entries marked as resample from Final Lots (FAIL) which may already be in loading flow
    const cookingStatusPassOrMedium = sqlWhere(col('cookingReport.status'), { [Op.in]: ['PASS', 'MEDIUM'] });
    const conditionBlocks = [
      {
        [Op.or]: [
          { workflowStatus: 'FINAL_REPORT' },
          {
            [Op.and]: [
              { workflowStatus: 'LOT_SELECTION', lotSelectionDecision: 'PASS_WITH_COOKING' },
              cookingStatusPassOrMedium
            ]
          },
          {
            [Op.and]: [
              { lotSelectionDecision: 'FAIL' },
              {
                // Re-sample BEFORE final should stay visible in Final Pass Lots.
                // Re-sample AFTER final (already in loading workflow) must skip this tab.
                workflowStatus: {
                  [Op.in]: [
                    'STAFF_ENTRY',
                    'QUALITY_CHECK',
                    'COOKING_REPORT',
                    'LOT_SELECTION',
                    'FINAL_REPORT'
                  ]
                }
              }
            ]
          }
        ]
      }
    ];

    if (broker) conditionBlocks.push({ brokerName: { [Op.iLike]: `%${broker}%` } });
    if (variety) conditionBlocks.push({ variety: { [Op.iLike]: `%${variety}%` } });
    if (party) conditionBlocks.push({ partyName: { [Op.iLike]: `%${party}%` } });
    if (location) conditionBlocks.push({ location: { [Op.iLike]: `%${location}%` } });

    if (startDate && endDate) {
      conditionBlocks.push({ entryDate: { [Op.between]: [startDate, endDate] } });
    } else if (startDate) {
      conditionBlocks.push({ entryDate: { [Op.gte]: startDate } });
    } else if (endDate) {
      conditionBlocks.push({ entryDate: { [Op.lte]: endDate } });
    }

    if (entryType) {
      conditionBlocks.push({ entryType });
    } else if (excludeEntryType) {
      conditionBlocks.push({ entryType: { [Op.ne]: excludeEntryType } });
    }

    const include = [
      {
        model: QualityParameters,
        as: 'qualityParameters',
        attributes: [
          'id', 'moisture', 'dryMoisture', 'cutting1', 'cutting2', 'bend', 'bend1', 'bend2',
          'mixS', 'mixL', 'mix', 'kandu', 'oil', 'sk', 'grainsCount', 'wbR', 'wbBk', 'wbT',
          'paddyWb', 'gramsReport', 'reportedBy'
        ],
        required: false
      },
      {
        model: CookingReport,
        as: 'cookingReport',
        attributes: ['id', 'status', 'remarks', 'cookingDoneBy', 'cookingApprovedBy', 'history', 'updatedAt'],
        required: false
      },
      {
        model: SampleEntryOffering,
        as: 'offering',
        attributes: [
          'id', 'offerRate', 'sute', 'suteUnit', 'baseRateType', 'baseRateUnit',
          'offerBaseRateValue', 'hamaliEnabled', 'hamaliPerKg', 'hamaliPerQuintal',
          'hamaliUnit', 'moistureValue', 'brokerage', 'brokerageEnabled', 'brokerageUnit',
          'lf', 'lfEnabled', 'lfUnit', 'egbType', 'egbValue', 'customDivisor',
          'offerVersions', 'activeOfferKey', 'cdEnabled', 'cdValue', 'cdUnit',
          'bankLoanEnabled', 'bankLoanValue', 'bankLoanUnit',
          'paymentConditionValue', 'paymentConditionUnit',
          'finalBaseRate', 'finalSute', 'finalSuteUnit', 'finalPrice', 'isFinalized'
        ],
        required: false
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'username'],
        required: false
      }
    ];

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    if (paginationQuery.where && Object.keys(paginationQuery.where).length) {
      conditionBlocks.push(paginationQuery.where);
    }
    const mergedWhere = conditionBlocks.length === 1
      ? conditionBlocks[0]
      : { [Op.and]: conditionBlocks };

    const attributes = [
      'id', 'serialNo', 'entryDate', 'createdAt', 'workflowStatus', 'lotSelectionDecision',
      'brokerName', 'variety', 'partyName', 'location', 'bags', 'packaging',
      'entryType', 'sampleCollectedBy', 'offeringPrice', 'finalPrice', 'lorryNumber'
    ];

    if (paginationQuery.isCursor) {
      const rows = await SampleEntry.findAll({
        where: mergedWhere,
        attributes,
        include,
        order: paginationQuery.order,
        limit: paginationQuery.limit,
        subQuery: false
      });

      const response = formatCursorResponse(rows, paginationQuery.limit, null, {
        fields: SAMPLE_ENTRY_CURSOR_FIELDS
      });
      return res.json({ entries: response.data, pagination: response.pagination });
    }

    const { count, rows } = await SampleEntry.findAndCountAll({
      where: mergedWhere,
      attributes,
      include,
      order: paginationQuery.order,
      limit: paginationQuery.limit,
      offset: paginationQuery.offset,
      subQuery: false,
      distinct: true
    });

    return res.json({
      entries: rows,
      total: count,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      totalPages: Math.max(1, Math.ceil(count / Math.max(1, parseInt(pageSize, 10) || 100)))
    });
  } catch (error) {
    console.error('Error getting final pass lots:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─── Completed Lots (patti not yet added) ───
router.get('/tabs/completed-lots', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const where = { workflowStatus: 'COMPLETED' };
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate && endDate) where.entryDate = { [Op.between]: [startDate, endDate] };
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        include: [
          { model: QualityParameters, as: 'qualityParameters' },
          { model: SampleEntryOffering, as: 'offering' },
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ]
      }
    });

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting completed lots:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Sample Book (all entries from lot selection onwards) ───
router.get('/tabs/sample-book', authenticateToken, cacheMiddleware(30), async (req, res) => {
  try {
    const { page = 1, pageSize = 50, broker, variety, party, location, startDate, endDate, entryType, excludeEntryType } = req.query;

    const where = {};
    if (broker) where.brokerName = { [Op.iLike]: `%${broker}%` };
    if (variety) where.variety = { [Op.iLike]: `%${variety}%` };
    if (party) where.partyName = { [Op.iLike]: `%${party}%` };
    if (location) where.location = { [Op.iLike]: `%${location}%` };
    if (startDate && endDate) where.entryDate = { [Op.between]: [startDate, endDate] };
    if (entryType) where.entryType = entryType;
    if (excludeEntryType) where.entryType = { [Op.ne]: excludeEntryType };

    const paginationQuery = buildCursorQuery(req.query, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hydrateOptions: {
        include: [
          { model: QualityParameters, as: 'qualityParameters' },
          { model: CookingReport, as: 'cookingReport' },
          { model: SampleEntryOffering, as: 'offering' },
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ]
      }
    });

    if (result.pagination) {
      res.json({ entries: result.entries, pagination: result.pagination });
    } else {
      res.json({ entries: result.entries, total: result.total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) });
    }
  } catch (error) {
    console.error('Error getting sample book:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch get offering data for multiple entries (for performance)
// IMPORTANT: This must be BEFORE /:id route to avoid route shadowing
router.get('/offering-data-batch', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids parameter is required' });
    }

    const idList = ids.split(',');
    const offerings = await SampleEntryOffering.findAll({
      where: { sampleEntryId: idList }
    });

    // Convert to map
    const result = {};
    offerings.forEach(o => {
      result[o.sampleEntryId] = o;
    });

    res.json(result);
  } catch (error) {
    console.error('Error batch fetching offering data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get sample entry by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const entry = await SampleEntryService.getSampleEntryById(
      req.params.id, // Keep as UUID string
      {
        includeQuality: true,
        includeCooking: true,
        includeAllotment: true,
        includeInspection: true,
        includeInventory: true,
        includeFinancial: true
      }
    );

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Error getting sample entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update sample entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existingEntry = await SampleEntryService.getSampleEntryById(req.params.id);
    if (!existingEntry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    const updates = { ...req.body };
    const isResampleAssignmentUpdate =
      Object.prototype.hasOwnProperty.call(updates, 'sampleCollectedBy')
      && existingEntry.lotSelectionDecision === 'FAIL';

    if (isResampleAssignmentUpdate) {
      const workflowRole = getWorkflowRole(req.user);
      if (!['admin', 'manager', 'owner'].includes(workflowRole)) {
        return res.status(403).json({ error: 'Only admin/manager can assign resample supervisor' });
      }

      const assignedName = String(updates.sampleCollectedBy || '').trim();
      if (!assignedName) {
        return res.status(400).json({ error: 'Sample Collected By is required for resample assignment' });
      }

      const locationStaffUser = await User.findOne({
        where: {
          username: assignedName,
          role: 'staff',
          staffType: 'location',
          isActive: true
        },
        attributes: ['id', 'username']
      });

      if (!locationStaffUser) {
        return res.status(400).json({ error: 'Assigned user must be an active location staff' });
      }

      updates.sampleCollectedBy = locationStaffUser.username;
      updates.entryType = 'LOCATION_SAMPLE';
    }

    const entry = await SampleEntryService.updateSampleEntry(
      req.params.id, // Keep as UUID string
      updates,
      req.user.userId // Use userId from JWT token
    );

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Error updating sample entry:', error);
    res.status(400).json({ error: error.message });
  }
});

// Add quality parameters (Quality Supervisor)
router.post('/:id/quality-parameters', authenticateToken, async (req, res) => {
  try {
    // Use multer to handle multipart/form-data (for photo upload)
    const upload = FileUploadService.getUploadMiddleware();

    upload.single('photo')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        // Helper function to safely parse float - returns 0 for empty/invalid values
        const parseFloatSafe = (value) => {
          if (value === undefined || value === null || value === '') return 0;
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        };

        // Helper function to safely parse int - returns 0 for empty/invalid values
        const parseIntSafe = (value) => {
          if (value === undefined || value === null || value === '') return 0;
          const parsed = parseInt(value);
          return isNaN(parsed) ? 0 : parsed;
        };

        const normalizeGramsReport = (value) => value === '5gms' ? '5gms' : '10gms';

        // --- Authorization Check for Location Staff ---
        const userRole = getWorkflowRole(req.user);
        const sampleEntry = await SampleEntry.findByPk(req.params.id);
        
        if (!sampleEntry) {
          return res.status(404).json({ error: 'Sample entry not found' });
        }
        
        // Location staff can edit own LOCATION_SAMPLE entries OR assigned resample lots.
        if (userRole === 'physical_supervisor' && sampleEntry.entryType === 'LOCATION_SAMPLE') {
          const canEdit = await canLocationStaffEditQuality(sampleEntry, req.user);
          if (!canEdit) {
            return res.status(403).json({
              error: 'You do not have permission to edit this lot. Only the assigned location staff or creator can edit quality parameters.'
            });
          }
        }
        // --------------------------------------------

        // Convert string values from FormData to numbers (with safe parsing)
        const qualityData = {
          sampleEntryId: req.params.id,
          moisture: parseFloatSafe(req.body.moisture),
          dryMoisture: parseFloatSafe(req.body.dryMoisture),
          cutting1: parseFloatSafe(req.body.cutting1),
          cutting2: parseFloatSafe(req.body.cutting2),
          bend: parseFloatSafe(req.body.bend || req.body.bend1), // Support both bend and bend1
          bend1: parseFloatSafe(req.body.bend1),
          bend2: parseFloatSafe(req.body.bend2),
          mixS: parseFloatSafe(req.body.mixS),
          mixL: parseFloatSafe(req.body.mixL),
          mix: parseFloatSafe(req.body.mix),
          kandu: parseFloatSafe(req.body.kandu),
          oil: parseFloatSafe(req.body.oil),
          sk: parseFloatSafe(req.body.sk),
          grainsCount: parseIntSafe(req.body.grainsCount),
          wbR: parseFloatSafe(req.body.wbR),
          wbBk: parseFloatSafe(req.body.wbBk),
          wbT: parseFloatSafe(req.body.wbT),
          paddyWb: parseFloatSafe(req.body.paddyWb),
          gramsReport: normalizeGramsReport(req.body.gramsReport),
          reportedBy: req.body.reportedBy || 'Quality Supervisor',
          smixEnabled: !!(req.body.mixS && parseFloat(req.body.mixS) > 0),
          lmixEnabled: !!(req.body.mixL && parseFloat(req.body.mixL) > 0),
          paddyWbEnabled: !!(req.body.paddyWb && parseFloat(req.body.paddyWb) > 0)
        };

        // Handle photo upload if present
        if (req.file) {
          const uploadResult = await FileUploadService.uploadFile(req.file, { compress: true });
          qualityData.uploadFileUrl = uploadResult.fileUrl;
        }

        const quality = await QualityParametersService.addQualityParameters(
          qualityData,
          req.user.userId,
          getWorkflowRole(req.user)
        );

        res.status(201).json(quality);
      } catch (error) {
        console.error('Error adding quality parameters:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error setting up file upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quality parameters (Admin/Manager edit)
router.put('/:id/quality-parameters', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.single('photo')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const sampleEntryId = req.params.id;

        // --- Authorization Check for Location Staff ---
        const userRole = getWorkflowRole(req.user);
        const sampleEntry = await SampleEntry.findByPk(sampleEntryId);
        
        if (!sampleEntry) {
          return res.status(404).json({ error: 'Sample entry not found' });
        }
        
        // Location staff can edit own LOCATION_SAMPLE entries OR assigned resample lots.
        if (userRole === 'physical_supervisor' && sampleEntry.entryType === 'LOCATION_SAMPLE') {
          const canEdit = await canLocationStaffEditQuality(sampleEntry, req.user);
          if (!canEdit) {
            return res.status(403).json({
              error: 'You do not have permission to edit this lot. Only the assigned location staff or creator can edit quality parameters.'
            });
          }
        }
        // --------------------------------------------

        // Get existing quality parameters for this entry
        const existing = await QualityParametersService.getQualityParametersBySampleEntry(sampleEntryId);
        if (!existing) {
          return res.status(404).json({ error: 'Quality parameters not found for this entry' });
        }

        const parseFloatSafe = (value, fallback) => {
          if (value === undefined || value === null) return fallback;
          if (value === '') return 0; // Empty string submitted via FormData means cleared/zero
          const parsed = parseFloat(value);
          return isNaN(parsed) ? fallback : parsed;
        };

        const parseIntSafe = (value, fallback) => {
          if (value === undefined || value === null) return fallback;
          if (value === '') return 0;
          const parsed = parseInt(value);
          return isNaN(parsed) ? fallback : parsed;
        };

        const normalizeGramsReport = (value, fallback) => {
          if (value === undefined) return fallback;
          return value === '5gms' ? '5gms' : '10gms';
        };

        // Prepare update data
        const updates = {
          sampleEntryId,
          is100Grams: req.body.is100Grams === 'true' || req.body.is100Grams === true,
          moisture: parseFloatSafe(req.body.moisture, existing.moisture),
          dryMoisture: parseFloatSafe(req.body.dryMoisture, existing.dryMoisture),
          cutting1: parseFloatSafe(req.body.cutting1, existing.cutting1),
          cutting2: parseFloatSafe(req.body.cutting2, existing.cutting2),
          bend1: parseFloatSafe(req.body.bend1, existing.bend1),
          bend2: parseFloatSafe(req.body.bend2, existing.bend2),
          bend: parseFloatSafe(req.body.bend || req.body.bend1, existing.bend),
          mixS: parseFloatSafe(req.body.mixS, existing.mixS),
          mixL: parseFloatSafe(req.body.mixL, existing.mixL),
          mix: parseFloatSafe(req.body.mix, existing.mix),
          kandu: parseFloatSafe(req.body.kandu, existing.kandu),
          oil: parseFloatSafe(req.body.oil, existing.oil),
          sk: parseFloatSafe(req.body.sk, existing.sk),
          grainsCount: parseIntSafe(req.body.grainsCount, existing.grainsCount),
          wbR: parseFloatSafe(req.body.wbR, existing.wbR),
          wbBk: parseFloatSafe(req.body.wbBk, existing.wbBk),
          wbT: parseFloatSafe(req.body.wbT, existing.wbT),
          paddyWb: parseFloatSafe(req.body.paddyWb, existing.paddyWb),
          gramsReport: normalizeGramsReport(req.body.gramsReport, existing.gramsReport),
          reportedBy: req.body.reportedBy || existing.reportedBy,
          reportedByUserId: req.user.userId
        };

        // Handle photo upload if present
        if (req.file) {
          const uploadResult = await FileUploadService.uploadFile(req.file, { compress: true });
          updates.uploadFileUrl = uploadResult.fileUrl;
        }

        const updated = await QualityParametersService.updateQualityParameters(
          existing.id,
          updates,
          req.user.userId,
          getWorkflowRole(req.user)
        );

        res.json(updated);
      } catch (innerError) {
        console.error('Error in quality parameters update logic:', innerError);
        res.status(400).json({ error: innerError.message });
      }
    });
  } catch (error) {
    console.error('Error setting up file upload or updating quality parameters:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update physical inspection (Admin/Manager edit)
router.put('/:id/physical-inspection/:inspectionId', authenticateToken, async (req, res) => {
  try {
    const { inspectionId } = req.params;

    const updates = {};
    if (req.body.inspectionDate !== undefined) updates.inspectionDate = req.body.inspectionDate;
    if (req.body.lorryNumber !== undefined) updates.lorryNumber = req.body.lorryNumber;
    if (req.body.bags !== undefined) updates.bags = parseInt(req.body.bags);
    if (req.body.cutting1 !== undefined) updates.cutting1 = parseFloat(req.body.cutting1);
    if (req.body.cutting2 !== undefined) updates.cutting2 = parseFloat(req.body.cutting2);
    if (req.body.bend !== undefined) updates.bend = parseFloat(req.body.bend);
    if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;

    const updated = await PhysicalInspectionService.updatePhysicalInspection(
      inspectionId,
      updates,
      req.user.userId
    );

    if (!updated) {
      return res.status(404).json({ error: 'Physical inspection not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating physical inspection:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/lot-selection', authenticateToken, async (req, res) => {
  try {
    let { decision } = req.body; // 'PASS_WITHOUT_COOKING', 'PASS_WITH_COOKING', 'FAIL'
    const entry = await SampleEntry.findByPk(req.params.id, {
      attributes: ['id', 'entryType', 'workflowStatus', 'lotSelectionDecision']
    });

    if (!entry) {
      return res.status(404).json({ error: 'Sample entry not found' });
    }

    // In re-sample workflow, pending selection is always treated as pass-with-cooking.
    if (entry.lotSelectionDecision === 'FAIL' && decision === 'PASS_WITHOUT_COOKING') {
      decision = 'PASS_WITH_COOKING';
    }

    let nextStatus;
    if (decision === 'PASS_WITHOUT_COOKING') {
      nextStatus = 'FINAL_REPORT';
    } else if (decision === 'PASS_WITH_COOKING') {
      nextStatus = 'COOKING_REPORT';
    } else if (decision === 'FAIL') {
      if (entry.entryType === 'RICE_SAMPLE') {
        nextStatus = 'FAILED';
      } else if (entry.lotSelectionDecision === 'FAIL') {
        // If a re-sample is failed again, close it as complete failure.
        nextStatus = 'FAILED';
      } else {
        nextStatus = 'QUALITY_CHECK';
      }
    } else if (decision === 'SOLDOUT') {
      nextStatus = 'FAILED';
    } else {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    await WorkflowEngine.transitionTo(
      req.params.id, // Keep as UUID string, don't parse to int
      nextStatus,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user),
      { lotSelectionDecision: decision }
    );

    // Explicitly update the lot selection fields on the SampleEntry
    await SampleEntryService.updateSampleEntry(
      req.params.id,
      {
        lotSelectionDecision: decision,
        lotSelectionByUserId: req.user.userId,
        lotSelectionAt: new Date()
      },
      req.user.userId
    );

    invalidateSampleEntryTabCaches();

    // Auto-skip Final Pass Lots for resample entries that already have offering/final price
    // Scenario 2: PASS_WITHOUT_COOKING goes to FINAL_REPORT, but if price exists, skip to LOT_ALLOTMENT
    if (nextStatus === 'FINAL_REPORT') {
      try {
        const SampleEntryOffering = require('../models/SampleEntryOffering');
        const offering = await SampleEntryOffering.findOne({
          where: { sampleEntryId: req.params.id },
          attributes: ['id', 'finalPrice', 'isFinalized', 'offerBaseRateValue'],
          raw: true
        });

        // If offering exists with a finalized price, this is Scenario 2 — auto-skip to LOT_ALLOTMENT
        if (offering && (offering.finalPrice || offering.isFinalized)) {
          console.log(`[LOT-SELECTION] Auto-skipping Final Pass Lots for resample entry ${req.params.id} — offering already exists`);
          await WorkflowEngine.transitionTo(
            req.params.id,
            'LOT_ALLOTMENT',
            req.user.userId,
            getWorkflowRole(req.user),
            { autoSkipFinalPassLots: true, resample: true }
          );
        }
      } catch (skipErr) {
        console.log(`[LOT-SELECTION] Auto-skip note: ${skipErr.message}`);
      }
    }

    res.json({ message: 'Workflow transitioned successfully', nextStatus });
  } catch (error) {
    console.error('Error transitioning workflow:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create cooking report (Owner/Admin)
router.post('/:id/cooking-report', authenticateToken, async (req, res) => {
  try {
    const workflowRole = getWorkflowRole(req.user);
    const reportData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };
    // Staff/quality supervisor should only submit "Cooking Done By".
    // They cannot set final cooking status transitions.
    if (['staff', 'quality_supervisor'].includes(workflowRole)) {
      reportData.status = null;
      reportData.cookingApprovedBy = null;
    }

    const report = await CookingReportService.createCookingReport(
      reportData,
      req.user.userId, // Use userId from JWT token
      workflowRole
    );

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating cooking report:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update offering price (Owner/Admin)
router.post('/:id/offering-price', authenticateToken, async (req, res) => {
  try {
    if (!['admin', 'owner'].includes(getWorkflowRole(req.user))) {
      return res.status(403).json({ error: 'Only admin or owner can update offering price' });
    }

    const entry = await SampleEntryService.updateOfferingPrice(
      req.params.id, // Keep as UUID string
      req.body,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.json(entry);
  } catch (error) {
    console.error('Error updating offering price:', error);
    res.status(400).json({ error: error.message });
  }
});

// Set final price (Admin sets toggles, Manager fills values)
router.post('/:id/final-price', authenticateToken, async (req, res) => {
  try {
    console.log(`[FINAL-PRICE] ===== START =====`);
    console.log(`[FINAL-PRICE] Entry ID: ${req.params.id}`);
    console.log(`[FINAL-PRICE] User role: ${getWorkflowRole(req.user)}, baseRole: ${req.user.role}, userId: ${req.user.userId}`);
    console.log(`[FINAL-PRICE] isFinalized: ${req.body.isFinalized}`);
    console.log(`[FINAL-PRICE] finalPrice: ${req.body.finalPrice}`);

    const result = await SampleEntryService.setFinalPrice(
      req.params.id,
      req.body,
      req.user.userId,
      getWorkflowRole(req.user)
    );

    console.log(`[FINAL-PRICE] setFinalPrice succeeded. isFinalized in body: ${req.body.isFinalized}`);

    if (req.body.resampleAfterFinal) {
      const resampleUpdate = {
        lotSelectionDecision: 'FAIL',
        lotSelectionByUserId: req.user.userId,
        lotSelectionAt: new Date(),
        entryType: 'LOCATION_SAMPLE'
      };
      if (req.body.resampleCollectedBy) {
        resampleUpdate.sampleCollectedBy = req.body.resampleCollectedBy;
      }
      await SampleEntryService.updateSampleEntry(req.params.id, resampleUpdate, req.user.userId);
      console.log(`[FINAL-PRICE] Resample flagged for ${req.params.id}`);
    }

    // After updating the final price, ALWAYS check if we can transition to LOT_ALLOTMENT
    if (req.body.isFinalized) {
      try {
        const entry = await SampleEntryService.getSampleEntryById(req.params.id);
        console.log(`[FINAL-PRICE] Entry found: ${!!entry}, workflowStatus: ${entry ? entry.workflowStatus : 'N/A'}`);

        if (entry && ['FINAL_REPORT', 'LOT_SELECTION'].includes(entry.workflowStatus)) {
          console.log(`[FINAL-PRICE] Transitioning ${req.params.id} to LOT_ALLOTMENT (Loading Lots) (Triggered by ${getWorkflowRole(req.user)})`);
          await WorkflowEngine.transitionTo(
            req.params.id,
            'LOT_ALLOTMENT',
            req.user.userId,
            getWorkflowRole(req.user),
            { finalPriceSet: true }
          );
          console.log(`[FINAL-PRICE] ✅ Transition to LOT_ALLOTMENT (Loading Lots) SUCCEEDED!`);
        } else if (entry && entry.workflowStatus === 'LOT_ALLOTMENT' && req.body.resampleAfterFinal) {
          // Resample on an entry already at LOT_ALLOTMENT — stay at LOT_ALLOTMENT.
          // Offering price already exists, so it skips Final Lots and goes directly to Loading Lots.
          console.log(`[FINAL-PRICE] ✅ Entry ${req.params.id} already at LOT_ALLOTMENT (resample) — staying at Loading Lots`);
        } else {
          console.log(`[FINAL-PRICE] ⚠️ Skipped transition - entry status is: ${entry ? entry.workflowStatus : 'NOT FOUND'}`);
        }
      } catch (transitionError) {
        console.error(`[FINAL-PRICE] ❌ Transition FAILED:`, transitionError.message);
      }
    } else {
      console.log(`[FINAL-PRICE] ⚠️ isFinalized is false/undefined - no transition attempted`);
    }

    invalidateSampleEntryTabCaches();
    console.log(`[FINAL-PRICE] ===== END =====`);
    res.json(result);
  } catch (error) {
    console.error('[FINAL-PRICE] ❌ FATAL ERROR:', error.message);
    console.error('[FINAL-PRICE] Stack:', error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Transition workflow status (Manager can move lot to next stage)
router.post('/:id/transition', authenticateToken, async (req, res) => {
  try {
    const { toStatus } = req.body;
    if (!toStatus) {
      return res.status(400).json({ error: 'toStatus is required' });
    }

    const result = await WorkflowEngine.transitionTo(
      req.params.id,
      toStatus,
      req.user.userId,
      getWorkflowRole(req.user),
      {}
    );

    invalidateSampleEntryTabCaches();
    res.json({ success: true, message: `Transitioned to ${toStatus}`, result });
  } catch (error) {
    console.error('[TRANSITION] Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// offering-data-batch route moved above /:id to prevent route shadowing

// Get offering data for auto-population in final price modal
router.get('/:id/offering-data', authenticateToken, async (req, res) => {
  try {
    const offering = await SampleEntryService.getOfferingData(req.params.id);
    res.json(offering || {});
  } catch (error) {
    console.error('Error fetching offering data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create lot allotment (Manager)
router.post('/:id/lot-allotment', authenticateToken, async (req, res) => {
  try {
    // Server-side enforcement: block supervisor assignment if manager fields are still missing
    const entry = await SampleEntryService.getSampleEntryById(req.params.id);
    if (entry && entry.offering) {
      const o = entry.offering;
      const missingFields = [];
      if (o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute)) missingFields.push('Sute');
      if (o.moistureEnabled === false && !parseFloat(o.moistureValue)) missingFields.push('Moisture');
      if (o.hamaliEnabled === false && !parseFloat(o.hamali)) missingFields.push('Hamali');
      if (o.brokerageEnabled === false && !parseFloat(o.brokerage)) missingFields.push('Brokerage');
      if (o.lfEnabled === false && !parseFloat(o.lf)) missingFields.push('LF');
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Manager must fill missing fields before assigning supervisor: ${missingFields.join(', ')}. Update in Loading Lots tab first.`
        });
      }
    }

    const allotmentData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const allotment = await LotAllotmentService.createLotAllotment(
      allotmentData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(allotment);
  } catch (error) {
    console.error('Error creating lot allotment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update lot allotment (Manager - for reassigning supervisor)
router.put('/:id/lot-allotment', authenticateToken, async (req, res) => {
  try {
    const sampleEntryId = req.params.id;
    const { physicalSupervisorId } = req.body;

    if (!physicalSupervisorId) {
      return res.status(400).json({ error: 'Physical supervisor ID is required' });
    }

    // Get existing lot allotment
    const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(sampleEntryId);

    if (!existingAllotment) {
      return res.status(404).json({ error: 'Lot allotment not found for this entry' });
    }

    // Update the supervisor assignment
    const updated = await LotAllotmentService.updateLotAllotment(
      existingAllotment.id,
      { allottedToSupervisorId: physicalSupervisorId },
      req.user.userId
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating lot allotment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Close lot (Manager - when party doesn't send all bags)
router.post('/:id/close-lot', authenticateToken, async (req, res) => {
  try {
    const sampleEntryId = req.params.id;
    const { reason } = req.body;

    // Only manager/admin can close lots
    if (!['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only manager or admin can close lots' });
    }

    // Get existing lot allotment
    const existingAllotment = await LotAllotmentService.getLotAllotmentBySampleEntry(sampleEntryId);
    if (!existingAllotment) {
      return res.status(404).json({ error: 'Lot allotment not found for this entry' });
    }

    // Get inspection progress to know how many bags were inspected
    const progress = await PhysicalInspectionService.getInspectionProgress(sampleEntryId);
    const inspectedBags = progress.inspectedBags || 0;

    // Update lot allotment with close info
    await LotAllotmentService.updateLotAllotment(
      existingAllotment.id,
      {
        closedAt: new Date(),
        closedByUserId: req.user.userId,
        closedReason: reason || `Lot closed by manager. ${inspectedBags} of ${progress.totalBags} bags inspected. Party did not send remaining ${progress.remainingBags} bags.`,
        inspectedBags: inspectedBags
      },
      req.user.userId
    );

    // Transition workflow to INVENTORY_ENTRY (skipping remaining bags)
    await WorkflowEngine.transitionTo(
      sampleEntryId,
      'INVENTORY_ENTRY',
      req.user.userId,
      getWorkflowRole(req.user),
      {
        closedByManager: true,
        inspectedBags,
        totalAllottedBags: progress.totalBags,
        remainingBags: progress.remainingBags,
        reason: reason || 'Party did not send remaining bags'
      }
    );

    res.json({
      message: 'Lot closed successfully',
      inspectedBags,
      totalBags: progress.totalBags,
      remainingBags: progress.remainingBags
    });
  } catch (error) {
    console.error('Error closing lot:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create physical inspection (Physical Supervisor)
router.post('/:id/physical-inspection', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.fields([
      { name: 'halfLorryImage', maxCount: 1 },
      { name: 'fullLorryImage', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        // Parse FormData values to correct types
        const inspectionData = {
          sampleEntryId: req.params.id, // Keep as UUID string
          inspectionDate: req.body.inspectionDate,
          lorryNumber: req.body.lorryNumber,
          actualBags: Number.parseInt(req.body.actualBags),
          cutting1: Number.parseFloat(req.body.cutting1),
          cutting2: Number.parseFloat(req.body.cutting2),
          bend: req.body.bend1 ? Number.parseFloat(req.body.bend1) : Number.parseFloat(req.body.bend),
          bend1: req.body.bend1 ? Number.parseFloat(req.body.bend1) : Number.parseFloat(req.body.bend),
          bend2: req.body.bend2 ? Number.parseFloat(req.body.bend2) : 0,
          remarks: req.body.remarks || null
        };

        const inspection = await PhysicalInspectionService.createPhysicalInspection(
          inspectionData,
          req.user.userId, // Use userId from JWT token
          getWorkflowRole(req.user)
        );

        // Upload images if provided (optional - don't fail if images not provided)
        if (req.files && (req.files.halfLorryImage || req.files.fullLorryImage)) {
          try {
            await PhysicalInspectionService.uploadInspectionImages(
              inspection.id,
              req.files,
              req.user.userId
            );
          } catch (imageError) {
            console.error('Error uploading images (non-critical):', imageError);
            // Continue without images - they are optional
          }
        }

        res.status(201).json(inspection);
      } catch (error) {
        console.error('Error creating physical inspection:', error);
        res.status(400).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Error in physical inspection route:', error);
    res.status(400).json({ error: error.message });
  }
});

// Upload inspection images
router.post('/:id/inspection-images', authenticateToken, async (req, res) => {
  try {
    const upload = FileUploadService.getUploadMiddleware();

    upload.fields([
      { name: 'halfLorryImage', maxCount: 1 },
      { name: 'fullLorryImage', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const inspection = await PhysicalInspectionService.uploadInspectionImages(
        req.params.id, // Keep as UUID string
        req.files,
        req.user.userId // Use userId from JWT token
      );

      res.json(inspection);
    });
  } catch (error) {
    console.error('Error uploading inspection images:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create inventory data (Inventory Staff)
router.post('/:id/inventory-data', authenticateToken, async (req, res) => {
  try {
    const inventoryData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const inventory = await InventoryDataService.createInventoryData(
      inventoryData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(inventory);
  } catch (error) {
    console.error('Error creating inventory data:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create financial calculation (Owner/Admin)
router.post('/:id/financial-calculation', authenticateToken, async (req, res) => {
  try {
    const calculationData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const calculation = await FinancialCalculationService.createFinancialCalculation(
      calculationData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(calculation);
  } catch (error) {
    console.error('Error creating financial calculation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create manager financial calculation (Manager)
router.post('/:id/manager-financial-calculation', authenticateToken, async (req, res) => {
  try {
    const calculationData = {
      ...req.body,
      sampleEntryId: req.params.id // Keep as UUID string
    };

    const calculation = await FinancialCalculationService.createManagerFinancialCalculation(
      calculationData,
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    res.status(201).json(calculation);
  } catch (error) {
    console.error('Error creating manager financial calculation:', error);
    res.status(400).json({ error: error.message });
  }
});

// Complete workflow (Final Review -> Completed) + Auto-create Arrival records
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    // CHECK: Get inspection progress to see if all bags are inspected
    const progress = await PhysicalInspectionService.getInspectionProgress(req.params.id);
    const remainingBags = progress.remainingBags || 0;

    if (remainingBags > 0) {
      return res.status(400).json({
        error: `Cannot complete this lot! There are still ${remainingBags} bags remaining to be inspected. Please have the Physical Supervisor add the remaining bags first.`,
        remainingBags,
        inspectedBags: progress.inspectedBags,
        totalBags: progress.totalBags
      });
    }

    await WorkflowEngine.transitionTo(
      req.params.id, // Keep as UUID string
      'COMPLETED',
      req.user.userId, // Use userId from JWT token
      getWorkflowRole(req.user)
    );

    // ═══════════════════════════════════════════════════════════════════════
    // AUTO-CREATE ARRIVAL RECORDS from completed workflow data
    // This ensures data flows into kunchinittu ledger, outturn stock, paddy stock
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const SampleEntry = require('../models/SampleEntry');
      const LotAllotment = require('../models/LotAllotment');
      const PhysicalInspection = require('../models/PhysicalInspection');
      const InventoryData = require('../models/InventoryData');
      const Arrival = require('../models/Arrival');
      const { Kunchinittu } = require('../models/Location');

      // Fetch the full sample entry with all associations
      const sampleEntry = await SampleEntry.findByPk(req.params.id, {
        include: [
          {
            model: LotAllotment,
            as: 'lotAllotment',
            include: [
              {
                model: PhysicalInspection,
                as: 'physicalInspections',
                include: [
                  {
                    model: InventoryData,
                    as: 'inventoryData',
                    required: false
                  }
                ]
              }
            ]
          },
          {
            model: require('../models/QualityParameters'),
            as: 'qualityParameters',
            required: false
          }
        ]
      });

      if (sampleEntry && sampleEntry.lotAllotment && sampleEntry.lotAllotment.physicalInspections) {
        const inspections = sampleEntry.lotAllotment.physicalInspections;
        let arrivalsCreated = 0;

        for (const inspection of inspections) {
          const invData = inspection.inventoryData;
          if (!invData) continue; // Skip inspections without inventory data

          // Generate SL No for each arrival
          const lastArrival = await Arrival.findOne({
            order: [['createdAt', 'DESC']],
            attributes: ['slNo']
          });
          let slNo = 'A01';
          if (lastArrival && lastArrival.slNo) {
            const lastNumber = parseInt(lastArrival.slNo.substring(1));
            slNo = `A${(lastNumber + 1).toString().padStart(2, '0')}`;
          }

          // Determine movementType and destination based on inventoryData.location
          let movementType = 'purchase';
          let toKunchinintuId = invData.kunchinittuId || null;
          let toWarehouseId = null;
          let outturnId = null;

          if (invData.location === 'DIRECT_OUTTURN_PRODUCTION') {
            // For production — goes to outturn
            outturnId = invData.outturnId || null;
            toKunchinintuId = null;
          } else if (toKunchinintuId) {
            // Normal purchase — get warehouse from kunchinittu
            const kunchinittu = await Kunchinittu.findByPk(toKunchinintuId, {
              attributes: ['id', 'warehouseId']
            });
            if (kunchinittu) {
              toWarehouseId = kunchinittu.warehouseId || null;
            }
          }

          const grossWeight = parseFloat(invData.grossWeight) || 0;
          const tareWeight = parseFloat(invData.tareWeight) || 0;
          const netWeight = grossWeight - tareWeight;

          // Create the Arrival record — auto-approved since it comes from completed workflow
          await Arrival.create({
            slNo,
            date: invData.entryDate || sampleEntry.entryDate,
            movementType,
            broker: sampleEntry.brokerName || null,
            variety: invData.variety ? invData.variety.trim().toUpperCase() : (sampleEntry.variety ? sampleEntry.variety.trim().toUpperCase() : null),
            bags: invData.bags || sampleEntry.bags || 0,
            fromLocation: sampleEntry.location || null,
            toKunchinintuId,
            toWarehouseId,
            outturnId,
            moisture: invData.moisture || null,
            cutting: (sampleEntry.qualityParameters?.cutting1 && sampleEntry.qualityParameters?.cutting2)
              ? `${sampleEntry.qualityParameters.cutting1} x ${sampleEntry.qualityParameters.cutting2}`
              : (sampleEntry.qualityParameters?.cutting1 || sampleEntry.qualityParameters?.cutting2 || null),
            wbNo: invData.wbNumber || 'N/A',
            grossWeight,
            tareWeight,
            netWeight,
            lorryNumber: inspection.lorryNumber || sampleEntry.lorryNumber || 'N/A',
            status: 'approved',
            createdBy: req.user.userId,
            approvedBy: req.user.userId,
            approvedAt: new Date(),
            adminApprovedBy: req.user.userId,
            adminApprovedAt: new Date(),
            remarks: `Auto-created from completed sample entry #${sampleEntry.id}`
          });

          arrivalsCreated++;
          console.log(`✅ Arrival ${slNo} created from sample entry ${sampleEntry.id} (inspection ${inspection.id})`);
        }

        console.log(`✅ Workflow COMPLETED: ${arrivalsCreated} arrival(s) auto-created for sample entry ${sampleEntry.id}`);
      }
    } catch (arrivalError) {
      // Log but don't fail the completion — arrival creation is secondary
      console.error('⚠️ Error auto-creating arrivals (workflow still completed):', arrivalError);
    }

    res.json({ message: 'Sample entry completed successfully' });
  } catch (error) {
    console.error('Error completing sample entry:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get sample entry ledger
router.get('/ledger/all', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, broker, variety, party, location, status, limit, page, pageSize, cursor, entryType, excludeEntryType } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      broker,
      variety,
      party,
      location,
      status,
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 100,
      cursor,
      entryType,
      excludeEntryType
    };

    const ledger = await SampleEntryService.getSampleEntryLedger(filters);

    if (Array.isArray(ledger?.entries)) {
      ledger.entries = await attachLoadingLotsHistories(ledger.entries);
    } else if (Array.isArray(ledger)) {
      await attachLoadingLotsHistories(ledger);
    }

    res.json(ledger);
  } catch (error) {
    console.error('Error getting sample entry ledger:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get inspection progress for a sample entry
router.get('/:id/inspection-progress', authenticateToken, async (req, res) => {
  try {
    const progress = await PhysicalInspectionService.getInspectionProgress(req.params.id);
    res.json(progress);
  } catch (error) {
    console.error('Error getting inspection progress:', error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
