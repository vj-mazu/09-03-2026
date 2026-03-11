const { SampleEntry, User, QualityParameters, CookingReport, LotAllotment, PhysicalInspection, InventoryData, FinancialCalculation, Kunchinittu, Outturn } = require('../models');
const { Variety } = require('../models/Location');
const SampleEntryOffering = require('../models/SampleEntryOffering');
const { Op } = require('sequelize');
const { buildCursorQuery, formatCursorResponse } = require('../utils/cursorPagination');
const {
  SAMPLE_ENTRY_CURSOR_FIELDS,
  fetchHydratedSampleEntryPage,
  mergeWhereClauses
} = require('../utils/sampleEntryPagination');

class SampleEntryRepository {
  async create(entryData) {
    const entry = await SampleEntry.create(entryData);
    return entry.toJSON();
  }

  async findById(id, options = {}) {
    const include = [];

    if (options.includeQuality) {
      include.push({ model: QualityParameters, as: 'qualityParameters' });
    }
    if (options.includeCooking) {
      include.push({ model: CookingReport, as: 'cookingReport' });
    }
    if (options.includeAllotment) {
      include.push({
        model: LotAllotment,
        as: 'lotAllotment',
        include: options.includeInspection ? [
          {
            model: PhysicalInspection,
            as: 'physicalInspections',
            include: options.includeInventory ? [
              {
                model: InventoryData,
                as: 'inventoryData',
                include: [
                  ...(options.includeFinancial ? [{ model: FinancialCalculation, as: 'financialCalculation' }] : []),
                  { model: Kunchinittu, as: 'kunchinittu', required: false, include: [{ model: Variety, as: 'variety', attributes: ['id', 'name'] }] },
                  { model: Outturn, as: 'outturn', required: false }
                ]
              }
            ] : []
          },
          { model: User, as: 'supervisor', attributes: ['id', 'username'] }
        ] : []
      });
    }

    const entry = await SampleEntry.findByPk(id, { include });
    return entry ? entry.toJSON() : null;
  }

  async findByStatus(status, options = {}) {
    const queryOptions = {
      where: { workflowStatus: status },
      limit: options.limit || 50,
      offset: options.offset || 0,
      order: [[options.orderBy || 'createdAt', options.orderDir || 'DESC']]
    };

    const entries = await SampleEntry.findAll(queryOptions);
    return entries.map(entry => entry.toJSON());
  }

  /**
   * Build role-appropriate includes to avoid unnecessary JOINs
   * PERFORMANCE: Only load deep associations when the workflow status actually needs them
   */
  _buildIncludesForRole(role, status) {
    // Core includes - always lightweight
    const baseIncludes = [
      { model: User, as: 'creator', attributes: ['id', 'username'] }
    ];

    // Staff needs quality parameters for Sample Book tab (to show 100gms / quality badges)
    if (role === 'staff' && status !== 'COOKING_REPORT') {
      return [
        ...baseIncludes,
        {
          model: QualityParameters, as: 'qualityParameters', required: false,
          include: [{ model: User, as: 'reportedByUser', attributes: ['id', 'username'] }]
        }
      ];
    }

    // Quality supervisor needs quality parameters
    if (role === 'quality_supervisor') {
      return [
        ...baseIncludes,
        {
          model: QualityParameters, as: 'qualityParameters', required: false,
          include: [{ model: User, as: 'reportedByUser', attributes: ['id', 'username'] }]
        }
      ];
    }

    // Admin/Manager: include depth depends on the filtered status
    const lightStatuses = ['STAFF_ENTRY', 'QUALITY_CHECK', 'LOT_SELECTION', 'COOKING_REPORT', 'FINAL_REPORT'];
    const isLightQuery = status && lightStatuses.includes(status);

    if (isLightQuery) {
      const includes = [
        ...baseIncludes,
        {
          model: QualityParameters, as: 'qualityParameters', required: false,
          include: [{ model: User, as: 'reportedByUser', attributes: ['id', 'username'] }]
        },
        { model: User, as: 'lotSelectionByUser', attributes: ['id', 'username'] }
      ];

      // Add cooking report for COOKING_REPORT status
      if (status === 'COOKING_REPORT' || status === 'FINAL_REPORT') {
        includes.push({ model: CookingReport, as: 'cookingReport', required: false });
      }

      // Add offering for FINAL_REPORT
      if (status === 'FINAL_REPORT') {
        includes.push({ model: SampleEntryOffering, as: 'offering', required: false });
      }

      return includes;
    }

    // Full depth for LOT_ALLOTMENT, PHYSICAL_INSPECTION, INVENTORY_ENTRY, etc.
    return this._buildFullIncludes(role);
  }

  /**
   * Full depth includes for deep workflow statuses
   */
  _buildFullIncludes(role, userId) {
    return [
      { model: User, as: 'creator', attributes: ['id', 'username'] },
      {
        model: QualityParameters, as: 'qualityParameters', required: false,
        include: [{ model: User, as: 'reportedByUser', attributes: ['id', 'username'] }]
      },
      { model: User, as: 'lotSelectionByUser', attributes: ['id', 'username'] },
      { model: CookingReport, as: 'cookingReport', required: false },
      {
        model: LotAllotment,
        as: 'lotAllotment',
        required: role === 'physical_supervisor',
        where: (role === 'physical_supervisor' && userId) ? { allottedToSupervisorId: userId } : undefined,
        include: [
          { model: User, as: 'supervisor', attributes: ['id', 'username'] },
          {
            model: PhysicalInspection,
            as: 'physicalInspections',
            required: false,
            include: [
              { model: User, as: 'reportedBy', attributes: ['id', 'username'] },
              {
                model: InventoryData,
                as: 'inventoryData',
                required: false,
                include: [
                  { model: User, as: 'recordedBy', attributes: ['id', 'username'] },
                  {
                    model: FinancialCalculation,
                    as: 'financialCalculation',
                    required: false,
                    include: [
                      { model: User, as: 'owner', attributes: ['id', 'username'] },
                      { model: User, as: 'manager', attributes: ['id', 'username'] }
                    ]
                  },
                  { model: Kunchinittu, as: 'kunchinittu', required: false, include: [{ model: Variety, as: 'variety', attributes: ['id', 'name'] }] },
                  { model: Outturn, as: 'outturn', required: false }
                ]
              }
            ]
          }
        ]
      }
    ];
  }

  async findByRoleAndFilters(role, filters = {}, userId) {
    const where = {};
    const normalizeStatusFilter = (status) => {
      const key = String(status || '').toUpperCase();
      const aliases = {
        QUALITY_NEEDED: 'QUALITY_CHECK',
        PENDING_LOT_SELECTION: 'LOT_SELECTION',
        PENDING_COOKING_REPORT: 'COOKING_REPORT',
        PENDING_LOTS_PASSED: 'FINAL_REPORT',
        PENDING_ALLOTTING_SUPERVISOR: 'LOT_ALLOTMENT'
      };
      return aliases[key] || key || null;
    };
    const requestedStatus = normalizeStatusFilter(filters.status);

    // Role-based filtering
    const roleStatusMap = {
      staff: null, // Allow Staff to see all of their past and completed entries
      quality_supervisor: ['STAFF_ENTRY', 'QUALITY_CHECK'],
      owner: null,
      admin: null,
      manager: null, // Manager sees all entries — same as admin
      physical_supervisor: ['LOT_ALLOTMENT', 'PHYSICAL_INSPECTION'],
      inventory_staff: ['PHYSICAL_INSPECTION', 'INVENTORY_ENTRY', 'OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW'],
      financial_account: ['OWNER_FINANCIAL', 'MANAGER_FINANCIAL', 'FINAL_REVIEW']
    };

    if (requestedStatus === 'COOKING_BOOK') {
      // Only show entries currently pending cooking reports (or in RECHECK which stays in COOKING_REPORT status)
      where.workflowStatus = 'COOKING_REPORT';
      where.lotSelectionDecision = { [Op.ne]: 'FAIL' };
    } else if (requestedStatus === 'RESAMPLE_COOKING_BOOK') {
      // Resamples appear immediately in cooking book to allow concurrent work
      where.workflowStatus = {
        [Op.in]: ['STAFF_ENTRY', 'QUALITY_CHECK', 'COOKING_REPORT', 'LOT_ALLOTMENT']
      };
      where.lotSelectionDecision = 'FAIL';
    } else if (requestedStatus) {
      // Special case for Rice Sample pending selection tab:
      // include QUALITY_CHECK + COOKING_REPORT + LOT_SELECTION so entries remain visible
      // after cooking PASS/MEDIUM transitions to LOT_SELECTION.
      if (requestedStatus === 'QUALITY_CHECK' && filters.entryType === 'RICE_SAMPLE') {
        where.workflowStatus = {
          [Op.in]: ['QUALITY_CHECK', 'COOKING_REPORT', 'LOT_SELECTION']
        };
      } else {
        where.workflowStatus = requestedStatus;
        // Paddy re-sample should skip Pending Sample Selection tab completely.
        if (requestedStatus === 'QUALITY_CHECK' && filters.entryType !== 'RICE_SAMPLE') {
          where[Op.or] = [
            { lotSelectionDecision: { [Op.ne]: 'FAIL' } },
            { lotSelectionDecision: { [Op.is]: null } }
          ];
        }
      }
    } else if (roleStatusMap[role] !== null && roleStatusMap[role]) {
      where.workflowStatus = roleStatusMap[role];
    }

    if (filters.entryType) {
      where.entryType = filters.entryType;
    } else if (filters.excludeEntryType) {
      where.entryType = { [Op.ne]: filters.excludeEntryType };
    }

    if (filters.startDate || filters.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate[Op.gte] = filters.startDate;
      if (filters.endDate) where.entryDate[Op.lte] = filters.endDate;
    }

    if (filters.broker) where.brokerName = { [Op.iLike]: `%${filters.broker}%` };
    if (filters.variety) where.variety = { [Op.iLike]: `%${filters.variety}%` };
    if (filters.party) where.partyName = { [Op.iLike]: `%${filters.party}%` };
    if (filters.location) where.location = { [Op.iLike]: `%${filters.location}%` };

    // PERFORMANCE: Build role-appropriate includes (avoids unnecessary JOINs)
    const activeStatus = requestedStatus || (roleStatusMap[role] && roleStatusMap[role].length === 1 ? roleStatusMap[role][0] : null);

    // Determine the actual statuses to query for include building
    const statusesToInclude = requestedStatus === 'COOKING_BOOK' || requestedStatus === 'RESAMPLE_COOKING_BOOK'
      ? ['COOKING_REPORT']
      : (requestedStatus === 'QUALITY_CHECK' && filters.entryType === 'RICE_SAMPLE' ? ['QUALITY_CHECK', 'COOKING_REPORT', 'LOT_SELECTION'] : (activeStatus ? [activeStatus] : []));

    const include = this._buildIncludesForRole(role, statusesToInclude.length > 0 ? statusesToInclude[0] : null);

    // Make sure cooking report is included for COOKING_BOOK or for RICE_SAMPLE in LOT_SELECTION (PENDING SELECTION) tab.
    if (requestedStatus === 'COOKING_BOOK' || requestedStatus === 'RESAMPLE_COOKING_BOOK' || (requestedStatus === 'QUALITY_CHECK' && filters.entryType === 'RICE_SAMPLE')) {
      const crInclude = include.find(i => i.as === 'cookingReport');
      if (!crInclude) {
        const { CookingReport } = require('../models');
        include.push({ model: CookingReport, as: 'cookingReport', required: false });
      }
    }

    // Fix includes for physical_supervisor userId filtering
    if (role === 'physical_supervisor' && userId) {
      const lotAllotmentInclude = include.find(i => i.as === 'lotAllotment');
      if (lotAllotmentInclude) {
        lotAllotmentInclude.where = { allottedToSupervisorId: userId };
        lotAllotmentInclude.required = true;
      }
    }

    // Removed: Location staff restriction moved to frontend so they can view the Sample Book

    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(filters.pageSize, 10) || 50);
    const paginationQuery = buildCursorQuery(filters, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const requiresJoinFiltering = include.some((item) => item.required || item.where);

    if (requiresJoinFiltering) {
      const queryOptions = {
        where: mergeWhereClauses(where, paginationQuery.where),
        include,
        limit: paginationQuery.limit,
        ...(paginationQuery.isCursor ? {} : { offset: paginationQuery.offset }),
        order: paginationQuery.order,
        distinct: true,
        subQuery: false
      };

      if (paginationQuery.isCursor) {
        const rows = await SampleEntry.findAll(queryOptions);
        const response = formatCursorResponse(rows, paginationQuery.limit, null, {
          fields: SAMPLE_ENTRY_CURSOR_FIELDS
        });
        return {
          entries: response.data.map((entry) => entry.toJSON()),
          pagination: response.pagination
        };
      }

      if (page === 1) {
        const { count, rows } = await SampleEntry.findAndCountAll(queryOptions);
        return {
          entries: rows.map((entry) => entry.toJSON()),
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize)
        };
      }

      const rows = await SampleEntry.findAll(queryOptions);
      return {
        entries: rows.map((entry) => entry.toJSON()),
        total: null, // Frontend should cache total from page 1
        page,
        pageSize,
        totalPages: null
      };
    }

    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      hydrateOptions: {
        include,
        subQuery: false
      },
      page,
      pageSize,
      countOnPageOneOnly: true
    });

    return {
      ...result,
      entries: result.entries.map((entry) => entry.toJSON())
    };
  }

  async update(id, updates) {
    const entry = await SampleEntry.findByPk(id);
    if (!entry) return null;

    await entry.update(updates);
    return entry.toJSON();
  }

  async getLedger(filters = {}) {
    const where = {};

    if (filters.startDate || filters.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate[Op.gte] = filters.startDate;
      if (filters.endDate) where.entryDate[Op.lte] = filters.endDate;
    }
    if (filters.broker) where.brokerName = filters.broker;
    if (filters.variety) where.variety = filters.variety;
    if (filters.party) where.partyName = { [Op.iLike]: `%${filters.party}%` };
    if (filters.location) where.location = { [Op.iLike]: `%${filters.location}%` };
    if (filters.status) where.workflowStatus = filters.status;
    if (filters.entryType) {
      where.entryType = filters.entryType;
    } else if (filters.excludeEntryType) {
      where.entryType = { [Op.ne]: filters.excludeEntryType };
    }

    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(filters.pageSize, 10) || 50);
    const paginationQuery = buildCursorQuery(filters, 'DESC', {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const include = [
      { model: User, as: 'creator', attributes: ['id', 'username'] },
      {
        model: QualityParameters, as: 'qualityParameters', required: false,
        include: [{ model: User, as: 'reportedByUser', attributes: ['id', 'username'] }]
      },
      { model: User, as: 'lotSelectionByUser', attributes: ['id', 'username'] },
      { model: CookingReport, as: 'cookingReport', required: false },
      { model: SampleEntryOffering, as: 'offering', required: false },
      {
        model: LotAllotment, as: 'lotAllotment', required: false,
        include: [
          { model: User, as: 'supervisor', attributes: ['id', 'username'] },
          {
            model: PhysicalInspection, as: 'physicalInspections', required: false,
            include: [
              { model: User, as: 'reportedBy', attributes: ['id', 'username'] },
              {
                model: InventoryData, as: 'inventoryData', required: false,
                include: [
                  { model: User, as: 'recordedBy', attributes: ['id', 'username'] },
                  {
                    model: FinancialCalculation, as: 'financialCalculation', required: false,
                    include: [
                      { model: User, as: 'owner', attributes: ['id', 'username'] },
                      { model: User, as: 'manager', attributes: ['id', 'username'] }
                    ]
                  },
                  { model: Kunchinittu, as: 'kunchinittu', required: false, include: [{ model: Variety, as: 'variety', attributes: ['id', 'name'] }] },
                  { model: Outturn, as: 'outturn', required: false }
                ]
              }
            ]
          }
        ]
      }
    ];

    const result = await fetchHydratedSampleEntryPage({
      model: SampleEntry,
      baseWhere: where,
      paginationQuery,
      hydrateOptions: {
        include,
        subQuery: false
      },
      page,
      pageSize,
      countOnPageOneOnly: true
    });

    return {
      ...result,
      entries: result.entries.map((entry) => entry.toJSON())
    };
  }
}

module.exports = new SampleEntryRepository();
