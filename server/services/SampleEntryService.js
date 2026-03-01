const SampleEntryRepository = require('../repositories/SampleEntryRepository');
const ValidationService = require('./ValidationService');
const AuditService = require('./AuditService');
const SampleEntryOffering = require('../models/SampleEntryOffering');

class SampleEntryService {
  /**
   * Create a new sample entry
   * @param {Object} entryData - Sample entry data
   * @param {number} userId - User ID creating the entry
   * @returns {Promise<Object>} Created sample entry
   */
  async createSampleEntry(entryData, userId) {
    try {
      // Auto-fill date if not provided
      if (!entryData.date) {
        entryData.date = new Date();
      }

      // Validate input data
      const validation = ValidationService.validateSampleEntry(entryData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Set initial workflow status
      entryData.workflowStatus = 'STAFF_ENTRY';
      entryData.createdByUserId = userId;

      // Create sample entry
      const entry = await SampleEntryRepository.create(entryData);

      // Log audit trail
      await AuditService.logCreate(userId, 'sample_entries', entry.id, entry);

      return entry;

    } catch (error) {
      console.error('Error creating sample entry:', error);
      throw error;
    }
  }

  /**
   * Get sample entry by ID
   * @param {number} id - Sample entry ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Sample entry or null
   */
  async getSampleEntryById(id, options = {}) {
    return await SampleEntryRepository.findById(id, options);
  }

  /**
   * Get sample entries by workflow status
   * @param {string} status - Workflow status
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of sample entries
   */
  async getSampleEntriesByStatus(status, options = {}) {
    return await SampleEntryRepository.findByStatus(status, options);
  }

  /**
   * Get sample entries by user role with filters
   * @param {string} role - User role
   * @param {Object} filters - Filter options
   * @param {number} userId - User ID performing the query
   * @returns {Promise<Object>} Object with entries and total count
   */
  async getSampleEntriesByRole(role, filters = {}, userId) {
    return await SampleEntryRepository.findByRoleAndFilters(role, filters, userId);
  }

  /**
   * Update sample entry
   * @param {number} id - Sample entry ID
   * @param {Object} updates - Fields to update
   * @param {number} userId - User ID performing the update
   * @returns {Promise<Object|null>} Updated entry or null
   */
  async updateSampleEntry(id, updates, userId) {
    try {
      // Get current entry
      const currentEntry = await SampleEntryRepository.findById(id);
      if (!currentEntry) {
        throw new Error('Sample entry not found');
      }

      // Update entry
      const updatedEntry = await SampleEntryRepository.update(id, updates);

      // Log audit trail
      await AuditService.logUpdate(
        userId,
        'sample_entries',
        id,
        currentEntry,
        updatedEntry
      );

      return updatedEntry;

    } catch (error) {
      console.error('Error updating sample entry:', error);
      throw error;
    }
  }

  /**
   * Get sample entry ledger with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of complete sample entry records
   */
  async getSampleEntryLedger(filters = {}) {
    return await SampleEntryRepository.getLedger(filters);
  }

  /**
   * Update offering price — saves all offering fields to SampleEntryOffering table
   * @param {string} id - Sample entry ID (UUID)
   * @param {Object} priceData - All offering price data
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Updated offering record
   */
  async updateOfferingPrice(id, priceData, userId) {
    // Update the simple fields on SampleEntry for backward compatibility
    const sampleEntryUpdates = {
      offeringPrice: priceData.offerRate || priceData.offeringPrice,
      priceType: priceData.priceType,
      offeringRemarks: priceData.remarks
    };
    await this.updateSampleEntry(id, sampleEntryUpdates, userId);

    // Save detailed offering to SampleEntryOffering table
    const offeringData = {
      sampleEntryId: id,
      offerRate: priceData.offerRate || priceData.offeringPrice,
      sute: priceData.sute || 0,
      suteUnit: priceData.suteUnit || priceData.suit || 'per_kg',
      baseRateType: priceData.baseRateType || priceData.offerBaseRate,
      baseRateUnit: priceData.baseRateUnit || priceData.perUnit || 'per_bag',
      offerBaseRateValue: priceData.offerBaseRateValue || 0,
      hamaliEnabled: priceData.hamaliEnabled !== undefined ? priceData.hamaliEnabled : (priceData.hamali === true),
      hamali: priceData.hamaliValue || priceData.hamali || 0,
      hamaliPerKg: priceData.hamaliPerKg || 0,
      hamaliPerQuintal: priceData.hamaliPerQuintal || 0,
      hamaliUnit: priceData.hamaliUnit || priceData.baseRateUnit || 'per_bag',
      moistureValue: priceData.moistureValue || priceData.moisture || 0,
      brokerage: priceData.brokerageValue || priceData.brokerage || 0,
      brokerageEnabled: priceData.brokerageEnabled || false,
      brokerageUnit: priceData.brokerageUnit || priceData.baseRateUnit || 'per_bag',
      lf: priceData.lfValue || priceData.lf || 0,
      lfEnabled: priceData.lfEnabled || false,
      lfUnit: priceData.lfUnit || priceData.baseRateUnit || 'per_bag',
      egbValue: priceData.egbValue || priceData.egb || 0,
      egbType: priceData.egbType || 'mill',
      customDivisor: priceData.customDivisor || null,
      createdBy: userId,
      updatedBy: userId
    };

    // Find existing or create new
    let offering = await SampleEntryOffering.findOne({
      where: { sampleEntryId: id }
    });

    if (offering) {
      await offering.update(offeringData);
    } else {
      offering = await SampleEntryOffering.create(offeringData);
    }

    return offering;
  }

  /**
   * Set final price — separate from offering price
   * Admin sets hamali/brokerage yes/no toggles, manager fills values
   * @param {string} id - Sample entry ID (UUID)
   * @param {Object} finalData - Final price data
   * @param {number} userId - User ID
   * @param {string} userRole - User role (admin/manager)
   * @returns {Promise<Object>} Updated offering record
   */
  async setFinalPrice(id, finalData, userId, userRole) {
    let offering = await SampleEntryOffering.findOne({
      where: { sampleEntryId: id }
    });

    if (!offering) {
      throw new Error('Offering price must be set before adding final price');
    }

    const updates = { updatedBy: userId };

    if (userRole === 'admin' || userRole === 'owner') {
      // Admin sets toggles and can set final price
      if (finalData.hamaliEnabled !== undefined) updates.hamaliEnabled = finalData.hamaliEnabled;
      if (finalData.brokerageEnabled !== undefined) updates.brokerageEnabled = finalData.brokerageEnabled;
      if (finalData.lfEnabled !== undefined) updates.lfEnabled = finalData.lfEnabled;
      if (finalData.suteEnabled !== undefined) updates.suteEnabled = finalData.suteEnabled;
      if (finalData.moistureEnabled !== undefined) updates.moistureEnabled = finalData.moistureEnabled;
      if (finalData.finalPrice !== undefined) updates.finalPrice = finalData.finalPrice;
      if (finalData.finalBaseRate !== undefined) updates.finalBaseRate = finalData.finalBaseRate;
      if (finalData.finalSute !== undefined) updates.finalSute = finalData.finalSute;
      if (finalData.finalSuteUnit !== undefined) updates.finalSuteUnit = finalData.finalSuteUnit;
      // Admin editable values based on toggles
      if (finalData.hamali !== undefined) updates.hamali = finalData.hamali;
      if (finalData.hamaliUnit !== undefined) updates.hamaliUnit = finalData.hamaliUnit;
      if (finalData.brokerage !== undefined) updates.brokerage = finalData.brokerage;
      if (finalData.brokerageUnit !== undefined) updates.brokerageUnit = finalData.brokerageUnit;
      if (finalData.lf !== undefined) updates.lf = finalData.lf;
      if (finalData.lfUnit !== undefined) updates.lfUnit = finalData.lfUnit;
      if (finalData.moistureValue !== undefined) updates.moistureValue = finalData.moistureValue;
      if (finalData.egbValue !== undefined) updates.egbValue = finalData.egbValue;
      if (finalData.egbType !== undefined) updates.egbType = finalData.egbType;
      if (finalData.customDivisor !== undefined) updates.customDivisor = finalData.customDivisor;
      if (finalData.isFinalized !== undefined) updates.isFinalized = finalData.isFinalized;
    }

    if (userRole === 'manager') {
      // Manager fills fallback gap values
      if (finalData.hamali !== undefined) updates.hamali = finalData.hamali;
      if (finalData.hamaliUnit !== undefined) updates.hamaliUnit = finalData.hamaliUnit;
      if (finalData.brokerage !== undefined) updates.brokerage = finalData.brokerage;
      if (finalData.brokerageUnit !== undefined) updates.brokerageUnit = finalData.brokerageUnit;
      if (finalData.lf !== undefined) updates.lf = finalData.lf;
      if (finalData.lfUnit !== undefined) updates.lfUnit = finalData.lfUnit;
      if (finalData.finalPrice !== undefined) updates.finalPrice = finalData.finalPrice;
      if (finalData.finalSute !== undefined) updates.finalSute = finalData.finalSute;
      if (finalData.finalSuteUnit !== undefined) updates.finalSuteUnit = finalData.finalSuteUnit;
      if (finalData.moistureValue !== undefined) updates.moistureValue = finalData.moistureValue;
      if (finalData.egbValue !== undefined) updates.egbValue = finalData.egbValue;
      if (finalData.egbType !== undefined) updates.egbType = finalData.egbType;
      if (finalData.finalBaseRate !== undefined) updates.finalBaseRate = finalData.finalBaseRate;
      if (finalData.isFinalized !== undefined) updates.isFinalized = finalData.isFinalized;
    }

    await offering.update(updates);

    // Also update final price on SampleEntry
    if (updates.finalPrice !== undefined) {
      await this.updateSampleEntry(id, { finalPrice: updates.finalPrice }, userId);
    }

    return offering;
  }

  /**
   * Get offering data for a sample entry
   * @param {string} id - Sample entry ID (UUID)
   * @returns {Promise<Object|null>} Offering data or null
   */
  async getOfferingData(id) {
    return await SampleEntryOffering.findOne({
      where: { sampleEntryId: id }
    });
  }
}

module.exports = new SampleEntryService();
