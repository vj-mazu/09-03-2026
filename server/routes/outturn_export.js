const express = require('express');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const { auth, authorize } = require('../middleware/auth');
const Arrival = require('../models/Arrival');
const { Kunchinittu } = require('../models/Location');
const User = require('../models/User');
const Outturn = require('../models/Outturn');
const ByProduct = require('../models/ByProduct');

const router = express.Router();

// Export Outturn Report to PDF
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch outturn details
    const outturn = await Outturn.findByPk(id, {
      include: [{ model: User, as: 'creator', attributes: ['username'] }]
    });

    if (!outturn) {
      return res.status(404).json({ error: 'Outturn not found' });
    }

    // Fetch production shifting records for this outturn
    const productionRecords = await Arrival.findAll({
      where: {
        movementType: { [Op.in]: ['production-shifting', 'for-production'] },
        outturnId: id
      },
      include: [
        { model: Kunchinittu, as: 'fromKunchinittu', attributes: ['name', 'code'] },
        { model: Kunchinittu, as: 'toKunchinittu', attributes: ['name', 'code'] },
        { model: User, as: 'creator', attributes: ['username'] }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']]
    });

    // Fetch by-products for this outturn
    const byProducts = await ByProduct.findAll({
      where: { outturnId: id },
      include: [{ model: User, as: 'creator', attributes: ['username'] }],
      order: [['date', 'DESC']]
    });

    // Create PDF
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=outturn_report_${outturn.code}_${new Date().toISOString().split('T')[0]}.pdf`);
      res.send(pdfData);
    });
    doc.on('error', (error) => {
      console.error('PDF generation error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate PDF' });
      }
    });

    // Header
    doc.fontSize(18).font('Helvetica-Bold').fillColor([0, 0, 0])
      .text('OUTTURN REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica')
      .text(`Outturn Code: ${outturn.code} | Allotted Variety: ${outturn.allottedVariety}`, { align: 'center' });
    doc.fontSize(10)
      .text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    doc.moveDown(1);

    // By-Products Table
    doc.fontSize(14).font('Helvetica-Bold').fillColor([0, 0, 0])
      .text('BY-PRODUCTS RECORD', { align: 'left' });
    doc.moveDown(0.5);

    if (byProducts.length > 0) {
      const tableTop = doc.y;
      // Fixed: 10 columns to match all by-product values including RJ Rice 1 and RJ Rice 2
      const colWidths = [50, 50, 40, 40, 45, 50, 50, 40, 45, 60]; // Total: 520px - fits A4 portrait
      const headers = ['Rice', 'Rej Rice', 'RJ Rice 1', 'RJ Rice 2', 'Broken', 'Rej Broken', 'Zero Broken', 'Faram', 'Bran', 'Date'];

      // Calculate table width and center it
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const tableStartX = (doc.page.width - tableWidth) / 2;

      // Table header with blue background
      doc.rect(tableStartX, tableTop, tableWidth, 25).fillAndStroke([74, 144, 226], [74, 144, 226]);
      doc.fontSize(7).font('Helvetica-Bold').fillColor([255, 255, 255]);
      headers.forEach((header, i) => {
        const x = tableStartX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(header, x + 2, tableTop + 8, { width: colWidths[i] - 4, align: 'center' });
      });

      let y = tableTop + 25;

      // Table rows
      byProducts.forEach((bp, idx) => {
        const rowColor = idx % 2 === 0 ? [255, 255, 255] : [240, 242, 245];
        doc.rect(tableStartX, y, tableWidth, 20).fillAndStroke(rowColor, [200, 200, 200]);

        doc.fontSize(7).font('Helvetica').fillColor([0, 0, 0]);
        const values = [
          parseFloat(bp.rice || 0).toFixed(2),
          parseFloat(bp.rejectionRice || 0).toFixed(2),
          parseFloat(bp.rjRice1 || 0).toFixed(2),
          parseFloat(bp.rjRice2 || 0).toFixed(2),
          parseFloat(bp.broken || 0).toFixed(2),
          parseFloat(bp.rejectionBroken || 0).toFixed(2),
          parseFloat(bp.zeroBroken || 0).toFixed(2),
          parseFloat(bp.faram || 0).toFixed(2),
          parseFloat(bp.bran || 0).toFixed(2),
          new Date(bp.date).toLocaleDateString('en-GB')
        ];

        values.forEach((val, i) => {
          const x = tableStartX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(val, x + 3, y + 5, { width: colWidths[i] - 6, align: i < 9 ? 'right' : 'center' });
        });

        y += 20;
      });

      doc.moveDown(2);
    } else {
      doc.fontSize(10).font('Helvetica').fillColor([107, 114, 128])
        .text('No by-products recorded', { align: 'center' });
      doc.moveDown(1);
    }

    // Yielding Rice Summary
    if (productionRecords.length > 0 && byProducts.length > 0) {
      // totalPaddyWeight is in stored units (1000 = 1 quintal)
      const totalPaddyWeightStored = productionRecords.reduce((sum, rec) => sum + parseFloat(rec.netWeight || 0), 0);
      // Convert to quintals for display and calculation
      const totalPaddyWeight = totalPaddyWeightStored / 1000;
      const byProductValues = {
        rice: byProducts.reduce((sum, bp) => sum + parseFloat(bp.rice || 0), 0),
        rejectionRice: byProducts.reduce((sum, bp) => sum + parseFloat(bp.rejectionRice || 0), 0),
        rjRice1: byProducts.reduce((sum, bp) => sum + parseFloat(bp.rjRice1 || 0), 0),
        rjRice2: byProducts.reduce((sum, bp) => sum + parseFloat(bp.rjRice2 || 0), 0),
        broken: byProducts.reduce((sum, bp) => sum + parseFloat(bp.broken || 0), 0),
        rejectionBroken: byProducts.reduce((sum, bp) => sum + parseFloat(bp.rejectionBroken || 0), 0),
        zeroBroken: byProducts.reduce((sum, bp) => sum + parseFloat(bp.zeroBroken || 0), 0),
        faram: byProducts.reduce((sum, bp) => sum + parseFloat(bp.faram || 0), 0),
        bran: byProducts.reduce((sum, bp) => sum + parseFloat(bp.bran || 0), 0)
      };
      const totalByProducts = Object.values(byProductValues).reduce((a, b) => a + b, 0);

      doc.fontSize(14).font('Helvetica-Bold').fillColor([0, 0, 0])
        .text('YIELDING RICE SUMMARY', { align: 'left' });
      doc.moveDown(0.5);

      const summaryTableTop = doc.y;
      const summaryTableWidth = 350; // Reduced width for portrait
      const summaryStartX = (doc.page.width - summaryTableWidth) / 2;

      doc.rect(summaryStartX, summaryTableTop, summaryTableWidth, 25).fillAndStroke([74, 144, 226], [74, 144, 226]);
      doc.fontSize(9).font('Helvetica-Bold').fillColor([255, 255, 255]);
      doc.text('Description', summaryStartX + 5, summaryTableTop + 8, { width: 180 });
      doc.text('Amount (Q)', summaryStartX + 185, summaryTableTop + 8, { width: 80, align: 'right' });
      doc.text('Percentage', summaryStartX + 265, summaryTableTop + 8, { width: 80, align: 'right' });

      let summaryY = summaryTableTop + 25;

      // Total Paddy Weight header
      doc.rect(summaryStartX, summaryY, summaryTableWidth, 20).fillAndStroke([235, 235, 235], [200, 200, 200]);
      doc.fontSize(9).font('Helvetica-Bold').fillColor([0, 0, 0]);
      doc.text('Total Paddy Weight', summaryStartX + 5, summaryY + 5, { width: 180 });
      doc.text(totalPaddyWeight.toFixed(2) + ' Q', summaryStartX + 185, summaryY + 5, { width: 80, align: 'right' });
      summaryY += 20;

      // Each by-product with percentage
      const byProductRows = [
        { label: 'Rice', value: byProductValues.rice },
        { label: 'Rejection Rice', value: byProductValues.rejectionRice },
        { label: 'RJ Rice 1', value: byProductValues.rjRice1 },
        { label: 'RJ Rice 2', value: byProductValues.rjRice2 },
        { label: 'Broken', value: byProductValues.broken },
        { label: 'Rejection Broken', value: byProductValues.rejectionBroken },
        { label: 'Zero broken', value: byProductValues.zeroBroken },
        { label: 'Faram', value: byProductValues.faram },
        { label: 'Bran', value: byProductValues.bran }
      ];

      byProductRows.forEach((row, idx) => {
        const rowColor = idx % 2 === 0 ? [255, 255, 255] : [240, 242, 245];
        doc.rect(summaryStartX, summaryY, summaryTableWidth, 20).fillAndStroke(rowColor, [200, 200, 200]);
        doc.fontSize(8).font('Helvetica').fillColor([0, 0, 0]);
        doc.text(row.label, summaryStartX + 5, summaryY + 5, { width: 180 });
        // row.value is in quintals, display as is
        doc.text(row.value.toFixed(2) + ' Q', summaryStartX + 185, summaryY + 5, { width: 80, align: 'right' });
        // CORRECT FORMULA: (By-Product in Quintals / Total Paddy Weight in Quintals) × 100
        // totalPaddyWeight is already in quintals
        const percentage = totalPaddyWeight > 0 ? (row.value / totalPaddyWeight * 100) : 0;
        doc.text(percentage.toFixed(2) + '%', summaryStartX + 265, summaryY + 5, { width: 80, align: 'right' });
        summaryY += 20;
      });

      // Total BY Products row
      doc.rect(summaryStartX, summaryY, summaryTableWidth, 20).fillAndStroke([74, 144, 226], [74, 144, 226]);
      doc.fontSize(9).font('Helvetica-Bold').fillColor([255, 255, 255]);
      doc.text('Total BY Products Weight', summaryStartX + 5, summaryY + 5, { width: 180 });
      // totalByProducts is in quintals, display as is
      doc.text(totalByProducts.toFixed(2) + ' Q', summaryStartX + 185, summaryY + 5, { width: 80, align: 'right' });
      // Calculate YY: (Total By-Products in Quintals / Total Net Weight in Quintals) × 100
      // totalPaddyWeight is already converted to quintals above
      const totalPercentage = totalPaddyWeight > 0 ? (totalByProducts / totalPaddyWeight * 100) : 0;
      doc.text(totalPercentage.toFixed(2) + '%', summaryStartX + 265, summaryY + 5, { width: 80, align: 'right' });
      summaryY += 20;

      // Add YY (Yield Percentage) row - highlighted
      doc.rect(summaryStartX, summaryY, summaryTableWidth, 25).fillAndStroke([16, 185, 129], [16, 185, 129]);
      doc.fontSize(11).font('Helvetica-Bold').fillColor([255, 255, 255]);
      doc.text('YY (Yield Percentage)', summaryStartX + 5, summaryY + 7, { width: 180 });
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(totalPercentage.toFixed(2) + '%', summaryStartX + 185, summaryY + 6, { width: 160, align: 'center' });

      doc.moveDown(2);
    }

    // Production Shifting Records
    if (doc.y > 450) doc.addPage();

    doc.fontSize(14).font('Helvetica-Bold').fillColor([0, 0, 0])
      .text('PRODUCTION SHIFTING RECORDS', { align: 'left' });
    doc.moveDown(0.5);

    if (productionRecords.length > 0) {
      const prodTableTop = doc.y;
      // Optimized column widths for A4 portrait (535px available width)
      const prodColWidths = [25, 40, 45, 35, 55, 55, 40, 30, 30, 25, 35, 40, 45]; // Total: 500px
      const prodHeaders = ['Sl', 'Date', 'Type', 'Broker', 'From', 'To', 'Variety', 'Bags', 'Moist.', 'Cut.', 'Wb No', 'Net Wt', 'Lorry'];

      // Calculate production table width and center it
      const prodTableWidth = prodColWidths.reduce((a, b) => a + b, 0);
      const prodStartX = (doc.page.width - prodTableWidth) / 2;

      // Table header
      doc.rect(prodStartX, prodTableTop, prodTableWidth, 25).fillAndStroke([74, 144, 226], [74, 144, 226]);
      doc.fontSize(7).font('Helvetica-Bold').fillColor([255, 255, 255]);
      prodHeaders.forEach((header, i) => {
        const x = prodStartX + prodColWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(header, x + 2, prodTableTop + 8, { width: prodColWidths[i] - 4, align: 'center' });
      });

      let prodY = prodTableTop + 25;

      productionRecords.forEach((rec, idx) => {
        if (prodY > 520) {
          doc.addPage();
          prodY = 40;
        }

        const rowColor = idx % 2 === 0 ? [255, 255, 255] : [240, 242, 245];
        doc.rect(prodStartX, prodY, prodTableWidth, 18).fillAndStroke(rowColor, [200, 200, 200]);

        doc.fontSize(6).font('Helvetica').fillColor([0, 0, 0]);
        const prodValues = [
          (idx + 1).toString(),
          new Date(rec.date).toLocaleDateString('en-GB'),
          'Production',
          rec.broker || '-',
          `${rec.fromKunchinittu?.code || ''}`.trim(),
          `${rec.toKunchinittu?.code || ''}`.trim(),
          rec.variety || '-',
          (rec.bags || 0).toString(),
          rec.moisture || '-',
          rec.cutting || '-',
          rec.wbNo || '-',
          parseFloat(rec.netWeight || 0).toFixed(2),
          rec.lorryNumber || '-'
        ];

        prodValues.forEach((val, i) => {
          const x = prodStartX + prodColWidths.slice(0, i).reduce((a, b) => a + b, 0);
          const align = (i === 0 || i === 7) ? 'center' : (i === 11 ? 'right' : 'center');
          doc.text(val.toString(), x + 2, prodY + 5, { width: prodColWidths[i] - 4, align });
        });

        prodY += 18;
      });

      // Add Total Net Weight Row
      if (prodY > 520) {
        doc.addPage();
        prodY = 40;
      }

      const totalNetWeight = productionRecords.reduce((sum, rec) => sum + parseFloat(rec.netWeight || 0), 0);

      // Draw total row background
      doc.rect(prodStartX, prodY, prodTableWidth, 20).fillAndStroke([74, 144, 226], [74, 144, 226]);

      // Draw "Total Net Weight:" label in cells 0-10 (right-aligned)
      doc.fontSize(7).font('Helvetica-Bold').fillColor([255, 255, 255]);
      const labelEndX = prodStartX + prodColWidths.slice(0, 11).reduce((a, b) => a + b, 0);
      doc.text('Total Net Weight:', prodStartX + 2, prodY + 6, {
        width: prodColWidths.slice(0, 11).reduce((a, b) => a + b, 0) - 4,
        align: 'right'
      });

      // Draw total value in cell 11 (Net Wt column) - centered
      const valueX = labelEndX;
      doc.text(totalNetWeight.toFixed(2), valueX + 2, prodY + 6, {
        width: prodColWidths[11] - 4,
        align: 'center'
      });

    } else {
      doc.fontSize(10).font('Helvetica').fillColor([107, 114, 128])
        .text('No production shifting records found', { align: 'center' });
    }

    doc.end();
  } catch (error) {
    console.error('Outturn PDF export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export outturn report PDF' });
    }
  }
});

module.exports = router;
