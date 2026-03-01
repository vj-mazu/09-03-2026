const express = require('express');
const { Parser } = require('@json2csv/plainjs');
const PDFDocument = require('pdfkit');
const { auth, authorize } = require('../middleware/auth');
const Arrival = require('../models/Arrival');
const { Warehouse, Kunchinittu } = require('../models/Location');
const User = require('../models/User');
const Outturn = require('../models/Outturn');
const PurchaseRate = require('../models/PurchaseRate');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

const router = express.Router();

// ============================================
// PDF HELPER FUNCTIONS
// ============================================

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Get week range string
const getWeekRange = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `Week: ${formatDate(monday)} to ${formatDate(sunday)}`;
};

// Draw table header
const drawTableHeader = (doc, columns, y, colors = { bg: '#4a90e2', text: '#ffffff' }) => {
  doc.fillColor(colors.bg).rect(40, y, 515, 20).fill();
  doc.fillColor(colors.text).fontSize(8).font('Helvetica-Bold');

  let x = 45;
  columns.forEach(col => {
    doc.text(col.label, x, y + 6, { width: col.width, align: 'center' });
    x += col.width;
  });

  return y + 20;
};

// Draw table row
const drawTableRow = (doc, columns, data, y, isAlternate = false) => {
  if (isAlternate) {
    doc.fillColor('#f8f9fa').rect(40, y, 515, 18).fill();
  }

  doc.fillColor('#333333').fontSize(7).font('Helvetica');

  let x = 45;
  columns.forEach(col => {
    const value = typeof col.value === 'function' ? col.value(data) : (data[col.value] || '-');
    doc.text(String(value).substring(0, 20), x, y + 5, { width: col.width - 2, align: 'left' });
    x += col.width;
  });

  return y + 18;
};

// Draw section header (date or week)
const drawSectionHeader = (doc, title, y) => {
  doc.fillColor('#1e40af').rect(40, y, 515, 22).fill();
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
  doc.text(`📅 ${title}`, 50, y + 6);
  return y + 22;
};

// Check if new page needed
const checkNewPage = (doc, currentY, requiredSpace = 100) => {
  if (currentY > 750) {
    doc.addPage();
    return 60;
  }
  return currentY;
};

// ============================================
// CSV Export
// ============================================
router.get('/csv/arrivals', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, movementType } = req.query;
    const where = { status: 'approved' };
    if (movementType) where.movementType = movementType;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    }

    const arrivals = await Arrival.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['username'] },
        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name'] },
        { model: Warehouse, as: 'toWarehouse', attributes: ['name'] }
      ],
      order: [['date', 'DESC']]
    });

    const fields = [
      { label: 'SL No', value: 'slNo' },
      { label: 'Date', value: 'date' },
      { label: 'Movement Type', value: 'movementType' },
      { label: 'Broker', value: 'broker' },
      { label: 'Variety', value: row => row.variety || '' },
      { label: 'Bags', value: 'bags' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(arrivals);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=arrivals_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// ============================================
// PDF Export - All Arrivals
// ============================================
router.get('/pdf/arrivals', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, grouping } = req.query;
    const isWeekly = grouping === 'week';
    const where = { status: 'approved' };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    } else {
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      where.date = { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] };
    }

    const arrivals = await Arrival.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['username'] },
        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },
        { model: Outturn, as: 'outturn', attributes: ['code'], required: false }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: 1000
    });

    // Grouping logic
    const sections = {};
    arrivals.forEach(a => {
      const key = isWeekly ? getWeekRange(a.date) : formatDate(a.date);
      if (!sections[key]) sections[key] = [];
      sections[key].push(a);
    });

    // Create PDF - A4 Portrait
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: 'Arrivals Report',
        Author: 'Manjunath Mill'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=arrivals_${grouping || 'daily'}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#1e3a8a').fontSize(20).font('Helvetica-Bold');
    doc.text('MOTHER INDIA PADDY & RICE MILL', 40, 40, { align: 'center' });
    doc.fillColor('#475569').fontSize(14).text('ALL ARRIVALS REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | View: ${isWeekly ? 'Weekly' : 'Daily'}`, { align: 'center' });
    doc.text(`Total Records: ${arrivals.length}`, { align: 'center' });
    doc.moveDown(0.8);

    // Table columns - Optimized for A4 Portrait (515pt total width)
    const columns = [
      { label: 'SL', width: 25, value: (r, i) => i + 1 },
      { label: 'Date', width: 55, value: r => formatDate(r.date) },
      { label: 'Type', width: 50, value: 'movementType' },
      { label: 'WB No', width: 45, value: 'wbNo' },
      { label: 'Broker', width: 60, value: 'broker' },
      { label: 'Variety', width: 65, value: 'variety' },
      { label: 'Bags', width: 40, value: 'bags' },
      { label: 'Net Wt', width: 50, value: r => r.netWeight ? (r.netWeight / 1000).toFixed(2) : '-' },
      { label: 'Location', width: 75, value: r => r.toKunchinittu?.name || r.toWarehouse?.name || '-' },
      { label: 'Outturn', width: 50, value: r => r.outturn?.code || '-' }
    ];

    let y = doc.y + 10;
    let slNo = 1;

    // Render each section
    for (const [title, sectionRecords] of Object.entries(sections)) {
      y = checkNewPage(doc, y, 60);

      // Section header
      const sectionTotalBags = sectionRecords.reduce((sum, r) => sum + (r.bags || 0), 0);
      const sectionTotalQtl = sectionRecords.reduce((sum, r) => sum + (r.netWeight || 0), 0) / 1000;
      y = drawSectionHeader(doc, `${title} (${sectionRecords.length} entries, ${sectionTotalBags} bags, ${sectionTotalQtl.toFixed(2)} Q)`, y);

      // Table header
      y = drawTableHeader(doc, columns, y);

      // Rows
      dayRecords.forEach((record, idx) => {
        y = checkNewPage(doc, y);
        if (y === 60) {
          y = drawTableHeader(doc, columns, y);
        }
        y = drawTableRow(doc, columns, { ...record.toJSON(), slNo }, y, idx % 2 === 1);
        slNo++;
      });

      y += 10;
    }

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica');
      doc.text(`Manjunath Mill - Page ${i + 1} of ${pageCount}`, 40, 810, { align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ============================================
// PDF Export - Purchase Records
// ============================================
router.get('/pdf/purchase', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, grouping } = req.query;
    const isWeekly = grouping === 'week';
    const where = {
      status: 'approved',
      movementType: 'purchase'
    };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    }

    const arrivals = await Arrival.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['username'] },
        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },
        { model: Outturn, as: 'outturn', attributes: ['code'], required: false },
        { model: PurchaseRate, as: 'purchaseRate', attributes: ['totalAmount', 'averageRate'], required: false }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: 1000
    });

    // Grouping logic
    const sections = {};
    arrivals.forEach(a => {
      const key = isWeekly ? getWeekRange(a.date) : formatDate(a.date);
      if (!sections[key]) sections[key] = [];
      sections[key].push(a);
    });

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=purchase_${grouping || 'daily'}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#059669').fontSize(20).font('Helvetica-Bold');
    doc.text('MOTHER INDIA PADDY & RICE MILL', 40, 40, { align: 'center' });
    doc.fillColor('#475569').fontSize(14).text('PURCHASE RECORDS REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | View: ${isWeekly ? 'Weekly' : 'Daily'}`, { align: 'center' });
    doc.text(`Total Records: ${arrivals.length}`, { align: 'center' });
    doc.moveDown(0.8);

    // Columns for purchase - Optimized for A4 Portrait (515pt total width)
    const columns = [
      { label: 'SL', width: 25, value: (r, i) => i + 1 },
      { label: 'Date', width: 55, value: r => formatDate(r.date) },
      { label: 'WB No', width: 45, value: 'wbNo' },
      { label: 'Broker', width: 65, value: 'broker' },
      { label: 'Variety', width: 70, value: 'variety' },
      { label: 'Bags', width: 40, value: 'bags' },
      { label: 'Net Wt', width: 50, value: r => r.netWeight ? (r.netWeight / 1000).toFixed(2) : '-' },
      { label: 'Outturn', width: 55, value: r => r.outturn?.code || '-' },
      { label: 'Amount', width: 65, value: r => r.purchaseRate?.totalAmount ? `₹${parseFloat(r.purchaseRate.totalAmount).toLocaleString()}` : '-' },
      { label: 'Rate', width: 45, value: r => r.purchaseRate?.averageRate ? `₹${parseFloat(r.purchaseRate.averageRate).toFixed(0)}` : '-' }
    ];

    let y = doc.y + 10;
    let slNo = 1;

    for (const [title, sectionRecords] of Object.entries(sections)) {
      y = checkNewPage(doc, y, 60);

      const sectionTotalBags = sectionRecords.reduce((sum, r) => sum + (r.bags || 0), 0);
      const sectionAmount = sectionRecords.reduce((sum, r) => sum + (parseFloat(r.purchaseRate?.totalAmount) || 0), 0);

      y = drawSectionHeader(doc, `${title} (${sectionRecords.length} entries, ${sectionTotalBags} bags, ₹${sectionAmount.toLocaleString()})`, y);
      y = drawTableHeader(doc, columns, y, { bg: '#059669', text: '#ffffff' });

      sectionRecords.forEach((record, idx) => {
        y = checkNewPage(doc, y);
        if (y === 60) y = drawTableHeader(doc, columns, y, { bg: '#059669', text: '#ffffff' });
        y = drawTableRow(doc, columns, { ...record.toJSON(), slNo }, y, idx % 2 === 1);
        slNo++;
      });

      y += 10;
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ============================================
// PDF Export - Shifting Records
// ============================================
router.get('/pdf/shifting', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, grouping } = req.query;
    const isWeekly = grouping === 'week';
    const where = {
      status: 'approved',
      movementType: { [Op.in]: ['shifting', 'production-shifting', 'for-production'] }
    };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    }

    const arrivals = await Arrival.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['username'] },
        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] },
        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] },
        { model: Outturn, as: 'outturn', attributes: ['code'], required: false }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: 1000
    });

    // Grouping logic
    const sections = {};
    arrivals.forEach(a => {
      const key = isWeekly ? getWeekRange(a.date) : formatDate(a.date);
      if (!sections[key]) sections[key] = [];
      sections[key].push(a);
    });

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=shifting_${grouping || 'daily'}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#7c3aed').fontSize(20).font('Helvetica-Bold');
    doc.text('MOTHER INDIA PADDY & RICE MILL', 40, 40, { align: 'center' });
    doc.fillColor('#475569').fontSize(14).text('SHIFTING RECORDS REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | View: ${isWeekly ? 'Weekly' : 'Daily'}`, { align: 'center' });
    doc.text(`Total Records: ${arrivals.length}`, { align: 'center' });
    doc.moveDown(0.8);

    // Columns - Optimized for A4 Portrait (515pt total width)
    const columns = [
      { label: 'SL', width: 25, value: (r, i) => i + 1 },
      { label: 'Date', width: 55, value: r => formatDate(r.date) },
      { label: 'Type', width: 60, value: 'movementType' },
      { label: 'From Source', width: 85, value: r => r.fromWarehouse?.name || r.fromKunchinittu?.name || '-' },
      { label: 'To Destination', width: 85, value: r => r.toWarehouseShift?.name || '-' },
      { label: 'Variety', width: 65, value: 'variety' },
      { label: 'Bags', width: 40, value: 'bags' },
      { label: 'Net Wt', width: 50, value: r => r.netWeight ? (r.netWeight / 1000).toFixed(2) : '-' },
      { label: 'Outturn', width: 50, value: r => r.outturn?.code || '-' }
    ];

    let y = doc.y + 10;
    let slNo = 1;

    for (const [title, sectionRecords] of Object.entries(sections)) {
      y = checkNewPage(doc, y, 60);

      const sectionTotalBags = sectionRecords.reduce((sum, r) => sum + (r.bags || 0), 0);
      const sectionTotalQtl = sectionRecords.reduce((sum, r) => sum + (r.netWeight || 0), 0) / 1000;
      y = drawSectionHeader(doc, `${title} (${sectionRecords.length} entries, ${sectionTotalBags} bags, ${sectionTotalQtl.toFixed(2)} Q)`, y);
      y = drawTableHeader(doc, columns, y, { bg: '#7c3aed', text: '#ffffff' });

      sectionRecords.forEach((record, idx) => {
        y = checkNewPage(doc, y);
        if (y === 60) y = drawTableHeader(doc, columns, y, { bg: '#7c3aed', text: '#ffffff' });
        y = drawTableRow(doc, columns, { ...record.toJSON(), slNo }, y, idx % 2 === 1);
        slNo++;
      });

      y += 10;
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ============================================
// PDF Export - Paddy Stock
// ============================================
router.get('/pdf/stock', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, month, grouping } = req.query;
    const isWeekly = grouping === 'week';
    const where = {
      status: 'approved',
      adminApprovedBy: { [Op.not]: null },
      movementType: { [Op.ne]: 'loose' }
    };

    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];
      where.date = { [Op.gte]: startDate, [Op.lte]: endDate };
    } else if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date[Op.gte] = dateFrom;
      if (dateTo) where.date[Op.lte] = dateTo;
    }

    const arrivals = await Arrival.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['username'] },
        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },
        { model: Outturn, as: 'outturn', attributes: ['code', 'allottedVariety'], required: false }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit: 1000
    });

    // Grouping logic
    const sections = {};
    arrivals.forEach(a => {
      const key = isWeekly ? getWeekRange(a.date) : formatDate(a.date);
      if (!sections[key]) sections[key] = [];
      sections[key].push(a);
    });

    // Calculate totals
    const totalBags = arrivals.reduce((sum, a) => sum + (a.bags || 0), 0);
    const totalWeight = arrivals.reduce((sum, a) => sum + (a.netWeight || 0), 0);

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=paddy_stock_${grouping || 'daily'}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#dc2626').fontSize(20).font('Helvetica-Bold');
    doc.text('MOTHER INDIA PADDY & RICE MILL', 40, 40, { align: 'center' });
    doc.fillColor('#475569').fontSize(14).text('PADDY STOCK REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | View: ${isWeekly ? 'Weekly' : 'Daily'}`, { align: 'center' });
    doc.moveDown(0.5);

    // Summary box
    doc.fillColor('#fef2f2').roundedRect(140, 95, 315, 35, 8).fill();
    doc.fillColor('#dc2626').fontSize(12).font('Helvetica-Bold');
    doc.text(`Total Stock: ${totalBags.toLocaleString()} bags | ${(totalWeight / 100).toFixed(2)} quintals`, 40, 107, { align: 'center' });
    doc.moveDown(1.5);

    // Columns - Optimized for A4 Portrait (515pt total width)
    const columns = [
      { label: 'SL', width: 25, value: (r, i) => i + 1 },
      { label: 'Date', width: 55, value: r => formatDate(r.date) },
      { label: 'Type', width: 55, value: 'movementType' },
      { label: 'Outturn', width: 60, value: r => r.outturn?.code || '-' },
      { label: 'Variety', width: 70, value: 'variety' },
      { label: 'Location', width: 85, value: r => r.toKunchinittu?.name || r.toWarehouse?.name || '-' },
      { label: 'Bags', width: 45, value: 'bags' },
      { label: 'Net Wt', width: 55, value: r => r.netWeight ? (r.netWeight / 1000).toFixed(2) : '-' },
      { label: 'User', width: 45, value: r => r.creator?.username?.substring(0, 8) || '-' }
    ];

    let y = doc.y + 10;
    let slNo = 1;

    for (const [title, sectionRecords] of Object.entries(sections)) {
      y = checkNewPage(doc, y, 60);

      const sectionTotalBags = sectionRecords.reduce((sum, r) => sum + (r.bags || 0), 0);
      const sectionTotalQtl = sectionRecords.reduce((sum, r) => sum + (r.netWeight || 0), 0) / 1000;
      y = drawSectionHeader(doc, `${title} (${sectionRecords.length} entries, ${sectionTotalBags} bags, ${sectionTotalQtl.toFixed(2)} Q)`, y);
      y = drawTableHeader(doc, columns, y, { bg: '#dc2626', text: '#ffffff' });

      sectionRecords.forEach((record, idx) => {
        y = checkNewPage(doc, y);
        if (y === 60) y = drawTableHeader(doc, columns, y, { bg: '#dc2626', text: '#ffffff' });
        y = drawTableRow(doc, columns, { ...record.toJSON(), slNo }, y, idx % 2 === 1);
        slNo++;
      });

      y += 10;
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ============================================
// PDF Export - Rice Stock Movements
// ============================================
router.get('/pdf/rice-stock-movements', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, productType, movementType, grouping } = req.query;
    const isWeekly = grouping === 'week';

    // Build query with parameterized values (SQL injection safe)
    const whereParts = ["status = 'approved'"];
    const replacements = {};
    if (dateFrom) { whereParts.push('date >= :dateFrom'); replacements.dateFrom = dateFrom; }
    if (dateTo) { whereParts.push('date <= :dateTo'); replacements.dateTo = dateTo; }
    if (productType) { whereParts.push('product_type = :productType'); replacements.productType = productType; }
    if (movementType) { whereParts.push('movement_type = :movementType'); replacements.movementType = movementType; }
    const whereClause = 'WHERE ' + whereParts.join(' AND ');

    const result = await sequelize.query(`
      SELECT 
        rsm.id, rsm.date, rsm.movement_type, rsm.product_type, rsm.variety,
        rsm.bags, rsm.bag_size_kg, rsm.quantity_quintals, rsm.location_code,
        rsm.from_location, rsm.to_location, rsm.bill_number, rsm.lorry_number,
        rsm.party_name, rsm.rate_per_bag, rsm.total_amount,
        p1."brandName" as packaging_brand,
        u.username as created_by_username
      FROM rice_stock_movements rsm
      LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
      LEFT JOIN users u ON rsm.created_by = u.id
      ${whereClause}
      ORDER BY rsm.date DESC, rsm.id DESC
      LIMIT 2000
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    // Grouping logic
    const sections = {};
    result.forEach(r => {
      const key = isWeekly ? getWeekRange(r.date) : formatDate(r.date);
      if (!sections[key]) sections[key] = [];
      sections[key].push(r);
    });

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rice_movements_${grouping || 'daily'}.pdf`);
    doc.pipe(res);

    // Header
    doc.fillColor('#4a90e2').fontSize(20).font('Helvetica-Bold');
    doc.text('MOTHER INDIA PADDY & RICE MILL', 40, 40, { align: 'center' });
    doc.fillColor('#475569').fontSize(14).text('RICE STOCK MOVEMENT REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | View: ${isWeekly ? 'Weekly' : 'Daily'}`, { align: 'center' });
    doc.text(`Total Records: ${result.length}`, { align: 'center' });
    doc.moveDown(0.8);

    // Columns - Optimized for A4 Portrait (515pt total width)
    const columns = [
      { label: 'SL', width: 22, value: (r, i) => i + 1 },
      { label: 'Date', width: 52, value: r => formatDate(r.date) },
      { label: 'Type', width: 48, value: 'movement_type' },
      { label: 'Product', width: 55, value: 'product_type' },
      { label: 'Variety', width: 55, value: 'variety' },
      { label: 'Bags', width: 35, value: 'bags' },
      { label: 'Size', width: 30, value: 'bag_size_kg' },
      { label: 'Qtl', width: 45, value: r => parseFloat(r.quantity_quintals || 0).toFixed(2) },
      { label: 'Pkg', width: 60, value: 'packaging_brand' },
      { label: 'Loc', width: 50, value: 'location_code' },
      { label: 'Party', width: 63, value: r => (r.party_name || '-').substring(0, 15) }
    ];

    let y = doc.y + 10;
    let slNo = 1;

    for (const [title, sectionRecords] of Object.entries(sections)) {
      y = checkNewPage(doc, y, 60);

      const sectionTotalBags = sectionRecords.reduce((sum, r) => sum + (parseInt(r.bags) || 0), 0);
      const sectionTotalQtl = sectionRecords.reduce((sum, r) => sum + (parseFloat(r.quantity_quintals) || 0), 0);
      y = drawSectionHeader(doc, `${title} (${sectionRecords.length} entries, ${sectionTotalBags} bags, ${sectionTotalQtl.toFixed(2)} Q)`, y);
      y = drawTableHeader(doc, columns, y, { bg: '#4a90e2', text: '#ffffff' });

      sectionRecords.forEach((record, idx) => {
        y = checkNewPage(doc, y);
        if (y === 60) y = drawTableHeader(doc, columns, y, { bg: '#4a90e2', text: '#ffffff' });
        y = drawTableRow(doc, columns, { ...record, slNo }, y, idx % 2 === 1);
        slNo++;
      });

      y += 10;
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// ============================================
// PDF Export - Rice Stock Summary
// ============================================
router.get('/pdf/rice-stock', auth, async (req, res) => {
  try {
    const { dateFrom, dateTo, productType, locationCode } = req.query;

    // Build query with parameterized values (SQL injection safe)
    const whereParts = ["status = 'approved'"];
    const replacements = {};
    if (dateFrom) { whereParts.push('date >= :dateFrom'); replacements.dateFrom = dateFrom; }
    if (dateTo) { whereParts.push('date <= :dateTo'); replacements.dateTo = dateTo; }
    if (productType) { whereParts.push('product_type = :productType'); replacements.productType = productType; }
    if (locationCode) { whereParts.push('location_code = :locationCode'); replacements.locationCode = locationCode; }
    const whereClause = 'WHERE ' + whereParts.join(' AND ');

    // Get stock summary grouped by product type and packaging
    const stockResult = await sequelize.query(`
      SELECT 
        product_type, variety, location_code,
        p."brandName" as packaging_brand,
        p."allottedKg" as bag_size_kg,
        SUM(CASE 
          WHEN movement_type IN ('production', 'purchase') THEN bags
          WHEN movement_type = 'sale' THEN -bags
          WHEN movement_type = 'palti' THEN bags
          ELSE 0
        END) as total_bags,
        SUM(CASE 
          WHEN movement_type IN ('production', 'purchase') THEN quantity_quintals
          WHEN movement_type = 'sale' THEN -quantity_quintals
          WHEN movement_type = 'palti' THEN quantity_quintals
          ELSE 0
        END) as total_quintals
      FROM rice_stock_movements rsm
      LEFT JOIN packagings p ON rsm.packaging_id = p.id
      ${whereClause}
      GROUP BY product_type, variety, location_code, p."brandName", p."allottedKg"
      HAVING SUM(CASE 
        WHEN movement_type IN ('production', 'purchase') THEN bags
        WHEN movement_type = 'sale' THEN -bags
        WHEN movement_type = 'palti' THEN bags
        ELSE 0
      END) > 0
      ORDER BY product_type, variety, location_code
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=rice_stock_summary.pdf');
    doc.pipe(res);

    // Header
    doc.fillColor('#10b981').fontSize(22).font('Helvetica-Bold');
    doc.text('MOTHER INDIA PADDY & RICE MILL', 40, 40, { align: 'center' });
    doc.fillColor('#374151').fontSize(16).text('RICE STOCK SUMMARY', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    doc.moveDown(0.5);

    // Calculate totals
    const totalBags = stockResult.reduce((sum, r) => sum + (parseInt(r.total_bags) || 0), 0);
    const totalQtl = stockResult.reduce((sum, r) => sum + (parseFloat(r.total_quintals) || 0), 0);

    // Summary box
    doc.fillColor('#ecfdf5').roundedRect(120, 100, 355, 40, 8).fill();
    doc.fillColor('#059669').fontSize(14).font('Helvetica-Bold');
    doc.text(`Total Available Stock: ${totalBags.toLocaleString()} bags | ${totalQtl.toFixed(2)} quintals`, 40, 114, { align: 'center' });
    doc.moveDown(2);

    // Columns - Optimized for A4 Portrait (515pt total width)
    const columns = [
      { label: 'SL', width: 30, value: (r, i) => i + 1 },
      { label: 'Product Type', width: 90, value: 'product_type' },
      { label: 'Variety', width: 90, value: 'variety' },
      { label: 'Packaging Brand', width: 100, value: 'packaging_brand' },
      { label: 'Location Code', width: 80, value: 'location_code' },
      { label: 'Bags', width: 60, value: r => parseInt(r.total_bags || 0).toLocaleString() },
      { label: 'Quintals', width: 65, value: r => parseFloat(r.total_quintals || 0).toFixed(2) }
    ];

    let y = doc.y + 10;
    y = drawTableHeader(doc, columns, y, { bg: '#10b981', text: '#ffffff' });

    stockResult.forEach((record, idx) => {
      y = checkNewPage(doc, y);
      if (y === 60) y = drawTableHeader(doc, columns, y, { bg: '#10b981', text: '#ffffff' });
      y = drawTableRow(doc, columns, { ...record, slNo: idx + 1 }, y, idx % 2 === 1);
    });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;

