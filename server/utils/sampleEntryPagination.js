const { Op } = require('sequelize');
const { formatCursorResponse } = require('./cursorPagination');

const SAMPLE_ENTRY_CURSOR_FIELDS = [
  { name: 'entryDate', type: 'date' },
  { name: 'createdAt', type: 'date' },
  { name: 'id', type: 'string' }
];

const SAMPLE_ENTRY_LIST_ATTRIBUTES = ['id', 'entryDate', 'createdAt'];

function mergeWhereClauses(...clauses) {
  const filtered = clauses.filter((clause) => clause && Object.keys(clause).length > 0);

  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];

  return { [Op.and]: filtered };
}

function orderRowsByIds(rows, orderedIds) {
  const rowMap = new Map(rows.map((row) => [String(row.id), row]));
  return orderedIds.map((id) => rowMap.get(String(id))).filter(Boolean);
}

async function hydrateRowsByIds(model, ids, queryOptions = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const rows = await model.findAll({
    ...queryOptions,
    where: {
      id: {
        [Op.in]: ids
      }
    }
  });

  return orderRowsByIds(rows, ids);
}

async function fetchHydratedSampleEntryPage({
  model,
  baseWhere,
  paginationQuery,
  hydrateOptions = {},
  countWhere,
  page = 1,
  pageSize = 50,
  countOnPageOneOnly = false
}) {
  const mergedWhere = mergeWhereClauses(baseWhere, paginationQuery.where);

  const idRows = await model.findAll({
    where: mergedWhere,
    attributes: SAMPLE_ENTRY_LIST_ATTRIBUTES,
    order: paginationQuery.order,
    limit: paginationQuery.limit,
    ...(paginationQuery.isCursor ? {} : { offset: paginationQuery.offset })
  });

  if (paginationQuery.isCursor) {
    const response = formatCursorResponse(idRows, paginationQuery.limit, null, {
      fields: SAMPLE_ENTRY_CURSOR_FIELDS
    });
    const ids = response.data.map((row) => row.id);
    const rows = await hydrateRowsByIds(model, ids, hydrateOptions);

    return {
      entries: rows,
      pagination: response.pagination
    };
  }

  const shouldCount = !countOnPageOneOnly || page === 1;
  const total = shouldCount
    ? await model.count({
      where: countWhere || baseWhere,
      distinct: true,
      col: 'id'
    })
    : null;
  const ids = idRows.map((row) => row.id);
  const rows = await hydrateRowsByIds(model, ids, hydrateOptions);

  return {
    entries: rows,
    total,
    page,
    pageSize,
    totalPages: total === null ? null : Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  };
}

module.exports = {
  SAMPLE_ENTRY_CURSOR_FIELDS,
  SAMPLE_ENTRY_LIST_ATTRIBUTES,
  mergeWhereClauses,
  orderRowsByIds,
  hydrateRowsByIds,
  fetchHydratedSampleEntryPage
};
