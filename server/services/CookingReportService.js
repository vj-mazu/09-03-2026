const CookingReportRepository = require('../repositories/CookingReportRepository');
const AuditService = require('./AuditService');
const WorkflowEngine = require('./WorkflowEngine');

class CookingReportService {
  /**
   * Create cooking report
   * @param {Object} reportData - Cooking report data
   * @param {number} userId - User ID creating the report
   * @param {string} userRole - User role
   * @returns {Promise<Object>} Created cooking report
   */
  async createCookingReport(reportData, userId, userRole) {
    try {
      // Validate required fields
      if (!reportData.sampleEntryId) {
        throw new Error('Sample entry ID is required');
      }

      // Validate status
      const validStatuses = ['PASS', 'FAIL', 'RECHECK', 'MEDIUM'];
      if (reportData.status && !validStatuses.includes(reportData.status)) {
        throw new Error('Invalid cooking report status');
      }

      reportData.reviewedByUserId = userId;

      // Check if report already exists (Upsert logic)
      const existing = await CookingReportRepository.findBySampleEntryId(reportData.sampleEntryId);

      let report;
      let historyDate = new Date();
      if (reportData.manualDate) {
        const manual = new Date(reportData.manualDate);
        historyDate.setFullYear(manual.getFullYear(), manual.getMonth(), manual.getDate());
      }
      const historyEntry = {
        date: historyDate.toISOString(),
        status: reportData.status || null,
        cookingDoneBy: reportData.cookingDoneBy || null,
        approvedBy: reportData.cookingApprovedBy || null,
        remarks: reportData.remarks || null,
      };

      if (existing) {
        console.log(`[COOKING] Updating existing cooking report for sample entry: ${reportData.sampleEntryId}`);
        const updates = { ...reportData };
        if (!updates.status && existing.status) {
          delete updates.status;
        } else if (!updates.status) {
          updates.status = null;
        }

        // Append to existing history
        const currentHistory = Array.isArray(existing.history) ? existing.history : [];
        updates.history = [...currentHistory, historyEntry];

        report = await CookingReportRepository.update(existing.id, updates);
        await AuditService.logUpdate(userId, 'cooking_reports', report.id, existing, report);
      } else {
        console.log(`[COOKING] Creating new cooking report for sample entry: ${reportData.sampleEntryId}`);
        if (!reportData.status) {
          reportData.status = null;
        }
        reportData.history = [historyEntry];
        report = await CookingReportRepository.create(reportData);
        await AuditService.logCreate(userId, 'cooking_reports', report.id, report);
      }

      // Transition workflow based on status
      const currentStatus = reportData.status || null;
      if (currentStatus) {
        let nextStatus;
        if (currentStatus === 'PASS' || currentStatus === 'MEDIUM') {
          // PASS and MEDIUM both move to LOT_SELECTION (Final Pass Lots)
          nextStatus = 'LOT_SELECTION';
        } else if (currentStatus === 'FAIL') {
          nextStatus = 'FAILED';
        } else {
          // RECHECK - stay in COOKING_REPORT
          return report;
        }

        await WorkflowEngine.transitionTo(
          reportData.sampleEntryId,
          nextStatus,
          userId,
          userRole,
          { cookingReportId: report.id, cookingStatus: currentStatus }
        );
      }

      return report;

    } catch (error) {
      console.error('Error creating cooking report:', error);
      throw error;
    }
  }

  /**
   * Get cooking report by sample entry ID
   * @param {number} sampleEntryId - Sample entry ID
   * @returns {Promise<Object|null>} Cooking report or null
   */
  async getCookingReportBySampleEntry(sampleEntryId) {
    return await CookingReportRepository.findBySampleEntryId(sampleEntryId);
  }

  /**
   * Update cooking report
   * @param {number} id - Cooking report ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated cooking report or null
   */
  async updateCookingReport(id, updates, userId) {
    try {
      const current = await CookingReportRepository.findBySampleEntryId(updates.sampleEntryId);
      if (!current) {
        throw new Error('Cooking report not found');
      }

      const updated = await CookingReportRepository.update(id, updates);

      await AuditService.logUpdate(userId, 'cooking_reports', id, current, updated);

      return updated;

    } catch (error) {
      console.error('Error updating cooking report:', error);
      throw error;
    }
  }

  /**
   * Get cooking reports by status
   * @param {string} status - Cooking report status
   * @returns {Promise<Array>} Array of cooking reports
   */
  async getCookingReportsByStatus(status) {
    return await CookingReportRepository.findByStatus(status);
  }
}

module.exports = new CookingReportService();
