const express = require('express');
const PDFDocument = require('pdfkit');
const { auth, authorize } = require('../middleware/auth');
const Arrival = require('../models/Arrival');
const { Warehouse, Kunchinittu } = require('../models/Location');
const User = require('../models/User');

const router = express.Router();

// Export date-wise records to PDF (matching frontend exact format)
router.get('/pdf/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const { type } = req.query; // arrivals, purchase, shifting, stock

    // Fetch records for specific date
    const where = { date };
    if (type === 'purchase') {
      where.movementType = 'purchase';
    } else if (type === 'shifting') {
      where.movementType = 'shifting';
    } else if (type === 'stock') {
      where.movementType = { [Op.in]: ['production-shifting', 'for-production'] };
    }

    const records = await Arrival.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['username', 'role'] },
        { model: User, as: 'approver', attributes: ['username', 'role'] },
        { model: User, as: 'adminApprover', attributes: ['username', 'role'] },
        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },
        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'toWarehouse', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'fromWarehouse', attributes: ['name', 'code'] },
        { model: Warehouse, as: 'toWarehouseShift', attributes: ['name', 'code'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'No records found for this date' });
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=records_${date}_${type || 'all'}.pdf`);
      res.send(pdfData);
    });
    doc.on('error', (error) => {
      console.error('PDF generation error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate PDF' });
      }
    });

    // Header
    doc.fontSize(20).font('Helvetica-Bold').fillColor([0, 0, 0])
      .text('Mother India Stock Management', { align: 'center' });
    doc.moveDown(0.3);

    const typeLabel = type === 'purchase' ? 'Purchase Records' :
      type === 'shifting' ? 'Shifting Records' :
        type === 'stock' ? 'Paddy Stock Records' : 'All Arrivals';

    doc.fontSize(16).font('Helvetica-Bold')
      .text(typeLabel, { align: 'center' });
    doc.moveDown(0.3);

    doc.fontSize(12).font('Helvetica')
      .text(`Date: ${new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, { align: 'center' });
    doc.fontSize(10)
      .text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    doc.moveDown(1);

    // Define columns based on type - EXACT MATCH TO FRONTEND
    let headers, colWidths, getRowData;

    if (type === 'purchase') {
      // Purchase columns: 14 total (Portrait A4: ~535px available)
      headers = ['Date', 'Type', 'Broker', 'From', 'To', 'Variety', 'Bags', 'M%', 'Cut', 'WB', 'Gross', 'Tare', 'Net', 'Lorry'];
      colWidths = [35, 35, 44, 36, 64, 48, 28, 24, 22, 30, 34, 34, 34, 40]; // Total: 512px
      getRowData = (r) => [
        new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(/\s+/g, ''),
        'Purch.',
        r.broker || '-',
        r.fromLocation || '-',
        `${r.toKunchinittu?.code || ''}${r.toWarehouse?.name ? '-' + (r.toWarehouse?.name || '') : ''}`.trim(),
        r.variety || '-',
        r.bags || '-',
        r.moisture || '-',
        r.cutting || '-',
        r.wbNo || '-',
        Number(r.grossWeight || 0).toFixed(0),
        Number(r.tareWeight || 0).toFixed(0),
        Number(r.netWeight || 0).toFixed(0),
        r.lorryNumber || '-'
      ];
    } else if (type === 'shifting') {
      // Shifting columns: 15 total (Portrait A4: ~535px available)
      headers = ['Date', 'Type', 'From K', 'From W', 'To K', 'To W', 'Variety', 'Bags', 'M%', 'Cut', 'WB', 'Gross', 'Tare', 'Net', 'Lorry'];
      colWidths = [32, 32, 34, 44, 34, 44, 46, 28, 24, 22, 28, 32, 32, 32, 37]; // Total: 501px
      getRowData = (r) => [
        new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(/\s+/g, ''),
        'Shift.',
        r.fromKunchinittu?.code || '-',
        r.fromWarehouse?.name || '-',
        r.toKunchinittu?.code || '-',
        r.toWarehouseShift?.name || '-',
        r.variety || '-',
        r.bags || '-',
        r.moisture || '-',
        r.cutting || '-',
        r.wbNo || '-',
        Number(r.grossWeight || 0).toFixed(0),
        Number(r.tareWeight || 0).toFixed(0),
        Number(r.netWeight || 0).toFixed(0),
        r.lorryNumber || '-'
      ];
    } else if (type === 'stock') {
      // Stock - Special format like frontend (Opening Stock + Movements + Closing Stock)
      // Will be handled differently below
      headers = null;
      colWidths = null;
      getRowData = null;
    } else {
      // All Arrivals: 15 columns (Portrait A4: ~535px available) - NO Status
      headers = ['SL', 'Type', 'Broker', 'From', 'To K', 'To W', 'Variety', 'Bags', 'M%', 'Cut', 'WB', 'Gross', 'Tare', 'Net', 'Lorry'];
      colWidths = [24, 28, 34, 30, 28, 38, 40, 26, 22, 20, 26, 32, 32, 32, 35]; // Total: 497px
      getRowData = (r) => [
        r.slNo || '-',
        (r.movementType === 'production-shifting' || r.movementType === 'for-production') ? 'Prod.' : r.movementType === 'shifting' ? 'Shift' : 'Purch',
        r.broker || '-',
        r.movementType === 'purchase' ? (r.fromLocation || '-') : (r.fromKunchinittu?.code || '-'),
        r.toKunchinittu?.code || '-',
        r.movementType === 'purchase' ? (r.toWarehouse?.name || '-') : (r.toWarehouseShift?.name || '-'),
        r.variety || '-',
        r.bags || '-',
        r.moisture || '-',
        r.cutting || '-',
        r.wbNo || '-',
        Number(r.grossWeight || 0).toFixed(0),
        Number(r.tareWeight || 0).toFixed(0),
        Number(r.netWeight || 0).toFixed(0),
        r.lorryNumber || '-'
      ];
    }

    // Special handling for Stock type (different format)
    if (type === 'stock') {
      // Stock format: Opening + Movements + Closing (like frontend)
      let y = doc.y;

      // Group records by date to calculate opening/closing
      const totalBags = records.reduce((sum, r) => sum + Number(r.bags || 0), 0);

      // Opening Stock section (simplified - showing previous cumulative)
      doc.fontSize(11).font('Helvetica-Bold').fillColor([0, 0, 0])
        .text('Opening Stock', 30, y);
      y += 20;

      // Movement records with color coding
      records.forEach((record, idx) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        const isPurchase = record.movementType === 'purchase';
        const bgColor = isPurchase ? [212, 237, 218] : [226, 212, 237]; // green or purple

        doc.rect(30, y, 535, 22).fillAndStroke(bgColor, [200, 200, 200]);
        doc.fontSize(8).font('Helvetica').fillColor([0, 0, 0]);

        const bags = isPurchase ? `+${record.bags || 0}` : `+-${record.bags || 0}`;
        const dateVar = `${new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} ${record.variety || '-'}`;
        const broker = record.broker || '-';
        const location = isPurchase
          ? `${record.toKunchinittu?.code || ''} - ${record.toWarehouse?.name || ''}`
          : `${record.fromKunchinittu?.code || ''} - ${record.fromWarehouse?.name || ''} to ${record.toKunchinittu?.code || ''} - ${record.toWarehouseShift?.name || ''}`;

        doc.font('Helvetica-Bold').text(bags, 35, y + 6, { width: 60, ellipsis: true });
        doc.font('Helvetica').text(dateVar, 100, y + 6, { width: 120, ellipsis: true });
        doc.text(broker, 225, y + 6, { width: 90, ellipsis: true });
        doc.text(location, 320, y + 6, { width: 235, ellipsis: true });

        y += 22;
      });

      // Closing Stock section
      y += 10;
      doc.rect(30, y, 535, 2).fillAndStroke([0, 0, 0], [0, 0, 0]);
      y += 10;
      doc.fontSize(11).font('Helvetica-Bold').fillColor([0, 0, 0])
        .text(`${totalBags} Closing Stock`, 30, y);

      doc.end();
      return;
    }

    // Regular table rendering for other types
    const tableTop = doc.y;
    const tableLeft = 30;

    // Header background (dark blue like frontend)
    doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), 25)
      .fillAndStroke([46, 117, 182], [46, 117, 182]); // #2E75B6

    doc.fontSize(8).font('Helvetica-Bold').fillColor([255, 255, 255]);
    headers.forEach((header, i) => {
      const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(header, x + 3, tableTop + 8, {
        width: colWidths[i] - 6,
        align: 'center',
        ellipsis: true,
        lineBreak: false
      });
    });

    let y = tableTop + 25;

    // Table rows
    records.forEach((record, idx) => {
      // Check if we need a new page (portrait mode has more vertical space)
      if (y > 720) {
        doc.addPage();
        y = 50;

        // Repeat header on new page
        doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), 25)
          .fillAndStroke([46, 117, 182], [46, 117, 182]);
        doc.fontSize(8).font('Helvetica-Bold').fillColor([255, 255, 255]);
        headers.forEach((header, i) => {
          const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(header, x + 3, y + 8, {
            width: colWidths[i] - 6,
            align: 'center',
            ellipsis: true,
            lineBreak: false
          });
        });
        y += 25;
      }

      // Alternating row colors (light blue like frontend)
      const rowColor = idx % 2 === 0 ? [189, 215, 238] : [255, 255, 255]; // #BDD7EE or white
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), 18)
        .fillAndStroke(rowColor, [155, 194, 230]); // #9BC2E6 border

      doc.fontSize(7).font('Helvetica').fillColor([0, 0, 0]);
      const rowData = getRowData(record);

      rowData.forEach((val, i) => {
        const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        const cellWidth = colWidths[i] - 6;
        const text = String(val);

        // Use ellipsis: true to prevent text overflow
        doc.text(text, x + 3, y + 4, {
          width: cellWidth,
          align: 'center',
          ellipsis: true,
          lineBreak: false
        });
      });

      y += 18;
    });

    // Summary footer
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica-Bold').fillColor([0, 0, 0])
      .text(`Total Records: ${records.length}`, tableLeft, y + 10);

    const totalBags = records.reduce((sum, r) => sum + Number(r.bags || 0), 0);
    const totalNetWeight = records.reduce((sum, r) => sum + Number(r.netWeight || 0), 0);

    doc.text(`Total Bags: ${totalBags}`, tableLeft + 200, y + 10);
    doc.text(`Total Net Weight: ${totalNetWeight.toFixed(2)} kg`, tableLeft + 400, y + 10);

    doc.end();
  } catch (error) {
    console.error('Date-wise PDF export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

module.exports = router;
