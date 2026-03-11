const SampleEntryRepository = require('../repositories/SampleEntryRepository');
const ValidationService = require('./ValidationService');
const AuditService = require('./AuditService');
const SampleEntryOffering = require('../models/SampleEntryOffering');

const OFFER_KEYS = ['offer1', 'offer2', 'offer3'];
const LF_RATE_TYPES = new Set(['PD_LOOSE', 'MD_LOOSE', 'PD_WB']);
const EGB_RATE_TYPES = new Set(['PD_LOOSE', 'MD_LOOSE']);
const hasLfForRateType = (value) => LF_RATE_TYPES.has(String(value || '').trim().toUpperCase());
const hasEgbForRateType = (value) => EGB_RATE_TYPES.has(String(value || '').trim().toUpperCase());

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
};

const normalizeRateUnit = (value, fallback = 'per_bag') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (['per_bag', 'per_quintal', 'per_kg'].includes(normalized)) return normalized;
  return fallback;
};

const normalizeSuteUnit = (value, fallback = 'per_ton') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (['per_bag', 'per_ton'].includes(normalized)) return normalized;
  return fallback;
};

const normalizeToggleUnit = (value, fallback = 'per_bag') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (['per_bag', 'per_quintal', 'lumps', 'percentage'].includes(normalized)) return normalized;
  return fallback;
};

const normalizePaymentUnit = (value, fallback = 'days') => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (['days', 'month', 'months'].includes(normalized)) {
    return normalized === 'months' ? 'month' : normalized;
  }
  return fallback;
};

const normalizePaymentValue = (value, fallback = 15) => {
  const parsed = toNumberOrDefault(value, fallback);
  return Math.max(0, parsed);
};

const getOfferLabel = (key) => `Offer ${OFFER_KEYS.indexOf(key) + 1}`;

const ensureOfferVersions = (source = {}) => {
  if (Array.isArray(source.offerVersions) && source.offerVersions.length > 0) {
    return source.offerVersions
      .filter((offer) => OFFER_KEYS.includes(offer?.key))
      .map((offer) => ({
        ...offer,
        key: offer.key,
        label: offer.label || getOfferLabel(offer.key)
      }));
  }

  if (
    source.offerBaseRateValue == null &&
    source.offerRate == null &&
    source.hamali == null &&
    source.brokerage == null &&
    source.lf == null &&
    source.egbValue == null
  ) {
    return [];
  }

  return [{
    key: 'offer1',
    label: 'Offer 1',
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
    offerRate: toNullableNumber(source.offerRate),
    sute: toNumberOrDefault(source.sute, 0),
    suteUnit: normalizeSuteUnit(source.suteUnit, 'per_ton'),
    baseRateType: source.baseRateType || 'PD_LOOSE',
    baseRateUnit: normalizeRateUnit(source.baseRateUnit, 'per_bag'),
    offerBaseRateValue: toNullableNumber(source.offerBaseRateValue),
    hamaliEnabled: toBoolean(source.hamaliEnabled, false),
    hamali: toNumberOrDefault(source.hamali, 0),
    hamaliUnit: normalizeToggleUnit(source.hamaliUnit, 'per_bag'),
    moistureValue: toNumberOrDefault(source.moistureValue, 0),
    brokerageEnabled: toBoolean(source.brokerageEnabled, false),
    brokerage: toNumberOrDefault(source.brokerage, 0),
    brokerageUnit: normalizeToggleUnit(source.brokerageUnit, 'per_bag'),
    lfEnabled: toBoolean(source.lfEnabled, false),
    lf: toNumberOrDefault(source.lf, 0),
    lfUnit: normalizeToggleUnit(source.lfUnit, 'per_bag'),
    egbType: source.egbType || 'mill',
    egbValue: toNumberOrDefault(source.egbValue, 0),
    customDivisor: toNullableNumber(source.customDivisor),
    cdEnabled: toBoolean(source.cdEnabled, false),
    cdValue: toNumberOrDefault(source.cdValue, 0),
    cdUnit: normalizeToggleUnit(source.cdUnit, 'lumps'),
    bankLoanEnabled: toBoolean(source.bankLoanEnabled, false),
    bankLoanValue: toNumberOrDefault(source.bankLoanValue, 0),
    bankLoanUnit: normalizeToggleUnit(source.bankLoanUnit, 'lumps'),
    paymentConditionValue: normalizePaymentValue(source.paymentConditionValue, 15),
    paymentConditionUnit: normalizePaymentUnit(source.paymentConditionUnit, 'days'),
    remarks: source.remarks || source.offeringRemarks || ''
  }];
};

const getLatestOffer = (versions = []) => {
  if (!versions.length) return null;

  return [...versions].sort((left, right) => {
    const leftDate = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightDate = new Date(right.updatedAt || right.createdAt || 0).getTime();
    if (leftDate !== rightDate) return rightDate - leftDate;
    return OFFER_KEYS.indexOf(right.key) - OFFER_KEYS.indexOf(left.key);
  })[0];
};

const getActiveOffer = (versions = [], activeOfferKey) => {
  if (!versions.length) return null;
  return versions.find((offer) => offer.key === activeOfferKey) || getLatestOffer(versions);
};

const buildOfferPayload = (priceData, existingOffer = {}, slotKey) => {
  const baseRateType = String(priceData.baseRateType || existingOffer.baseRateType || priceData.offerBaseRate || 'PD_LOOSE').trim().toUpperCase();
  const baseRateUnit = normalizeRateUnit(priceData.baseRateUnit || existingOffer.baseRateUnit || priceData.perUnit || 'per_bag');
  const hasLf = hasLfForRateType(baseRateType);
  const hasEgb = hasEgbForRateType(baseRateType);
  const egbType = hasEgb ? String(priceData.egbType || existingOffer.egbType || 'mill').trim().toLowerCase() : 'mill';
  const offerAmount = toNullableNumber(priceData.offerBaseRateValue ?? existingOffer.offerBaseRateValue ?? priceData.offerRate ?? existingOffer.offerRate);
  const hamaliAmount = toNullableNumber(priceData.hamali ?? priceData.hamaliValue ?? existingOffer.hamali);
  const brokerageAmount = toNullableNumber(priceData.brokerage ?? priceData.brokerageValue ?? existingOffer.brokerage);
  const lfAmount = hasLf ? toNullableNumber(priceData.lf ?? priceData.lfValue ?? existingOffer.lf) : 0;
  const customDivisor = (
    baseRateUnit === 'per_kg' ||
    baseRateType === 'MD_LOOSE'
  )
    ? toNullableNumber(priceData.customDivisor ?? existingOffer.customDivisor)
    : null;

  return {
    key: slotKey,
    label: getOfferLabel(slotKey),
    createdAt: existingOffer.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    offerRate: offerAmount,
    sute: toNumberOrDefault(priceData.sute ?? existingOffer.sute, 0),
    suteUnit: normalizeSuteUnit(priceData.suteUnit || existingOffer.suteUnit || priceData.suit || 'per_ton'),
    baseRateType,
    baseRateUnit,
    offerBaseRateValue: offerAmount,
    hamaliEnabled: toBoolean(priceData.hamaliEnabled, toBoolean(existingOffer.hamaliEnabled, false)),
    hamali: hamaliAmount,
    hamaliUnit: normalizeToggleUnit(priceData.hamaliUnit || existingOffer.hamaliUnit || baseRateUnit || 'per_bag', 'per_bag'),
    moistureValue: toNumberOrDefault(priceData.moistureValue ?? priceData.moisture ?? existingOffer.moistureValue, 0),
    brokerageEnabled: toBoolean(priceData.brokerageEnabled, toBoolean(existingOffer.brokerageEnabled, false)),
    brokerage: brokerageAmount,
    brokerageUnit: normalizeToggleUnit(priceData.brokerageUnit || existingOffer.brokerageUnit || 'per_bag', 'per_bag'),
    lfEnabled: hasLf ? toBoolean(priceData.lfEnabled, toBoolean(existingOffer.lfEnabled, false)) : false,
    lf: lfAmount,
    lfUnit: hasLf ? normalizeToggleUnit(priceData.lfUnit || existingOffer.lfUnit || 'per_bag', 'per_bag') : 'per_bag',
    egbType,
    egbValue: hasEgb && egbType === 'purchase'
      ? toNumberOrDefault(priceData.egbValue ?? priceData.egb ?? existingOffer.egbValue, 0)
      : 0,
    customDivisor,
    cdEnabled: toBoolean(priceData.cdEnabled, toBoolean(existingOffer.cdEnabled, false)),
    cdValue: toNumberOrDefault(priceData.cdValue ?? existingOffer.cdValue, 0),
    cdUnit: normalizeToggleUnit(priceData.cdUnit || existingOffer.cdUnit || 'lumps', 'lumps'),
    bankLoanEnabled: toBoolean(priceData.bankLoanEnabled, toBoolean(existingOffer.bankLoanEnabled, false)),
    bankLoanValue: toNumberOrDefault(priceData.bankLoanValue ?? existingOffer.bankLoanValue, 0),
    bankLoanUnit: normalizeToggleUnit(priceData.bankLoanUnit || existingOffer.bankLoanUnit || 'lumps', 'lumps'),
    paymentConditionValue: normalizePaymentValue(priceData.paymentConditionValue ?? existingOffer.paymentConditionValue, 15),
    paymentConditionUnit: normalizePaymentUnit(priceData.paymentConditionUnit || existingOffer.paymentConditionUnit || 'days', 'days'),
    remarks: priceData.remarks ?? existingOffer.remarks ?? ''
  };
};

const mirrorOfferToColumns = (offer) => {
  if (!offer) {
    return {
      offerRate: null,
      sute: 0,
      suteUnit: 'per_ton',
      baseRateType: 'PD_LOOSE',
      baseRateUnit: 'per_bag',
      offerBaseRateValue: null,
      hamaliEnabled: false,
      hamali: 0,
      hamaliPerKg: 0,
      hamaliPerQuintal: 0,
      hamaliUnit: 'per_bag',
      moistureValue: 0,
      brokerage: 0,
      brokerageEnabled: false,
      brokerageUnit: 'per_bag',
      lf: 0,
      lfEnabled: false,
      lfUnit: 'per_bag',
      egbValue: 0,
      egbType: 'mill',
      customDivisor: null,
      cdEnabled: false,
      cdValue: 0,
      cdUnit: 'lumps',
      bankLoanEnabled: false,
      bankLoanValue: 0,
      bankLoanUnit: 'lumps',
      paymentConditionValue: 15,
      paymentConditionUnit: 'days'
    };
  }

  const hamaliValue = toNumberOrDefault(offer.hamali, 0);
  const hasLf = hasLfForRateType(offer.baseRateType);
  const hasEgb = hasEgbForRateType(offer.baseRateType);

  return {
    offerRate: offer.offerBaseRateValue,
    sute: toNumberOrDefault(offer.sute, 0),
    suteUnit: normalizeSuteUnit(offer.suteUnit, 'per_ton'),
    baseRateType: offer.baseRateType || 'PD_LOOSE',
    baseRateUnit: normalizeRateUnit(offer.baseRateUnit, 'per_bag'),
    offerBaseRateValue: toNullableNumber(offer.offerBaseRateValue),
    hamaliEnabled: toBoolean(offer.hamaliEnabled, false),
    hamali: hamaliValue,
    hamaliPerKg: offer.hamaliUnit === 'per_kg' ? hamaliValue : 0,
    hamaliPerQuintal: offer.hamaliUnit === 'per_quintal' ? hamaliValue : 0,
    hamaliUnit: normalizeToggleUnit(offer.hamaliUnit, 'per_bag'),
    moistureValue: toNumberOrDefault(offer.moistureValue, 0),
    brokerage: toNumberOrDefault(offer.brokerage, 0),
    brokerageEnabled: toBoolean(offer.brokerageEnabled, false),
    brokerageUnit: normalizeToggleUnit(offer.brokerageUnit, 'per_bag'),
    lf: hasLf ? toNumberOrDefault(offer.lf, 0) : 0,
    lfEnabled: hasLf ? toBoolean(offer.lfEnabled, false) : false,
    lfUnit: hasLf ? normalizeToggleUnit(offer.lfUnit, 'per_bag') : 'per_bag',
    egbValue: hasEgb && offer.egbType === 'purchase' ? toNumberOrDefault(offer.egbValue, 0) : 0,
    egbType: hasEgb ? (offer.egbType || 'mill') : 'mill',
    customDivisor: toNullableNumber(offer.customDivisor),
    cdEnabled: toBoolean(offer.cdEnabled, false),
    cdValue: toNumberOrDefault(offer.cdValue, 0),
    cdUnit: normalizeToggleUnit(offer.cdUnit, 'lumps'),
    bankLoanEnabled: toBoolean(offer.bankLoanEnabled, false),
    bankLoanValue: toNumberOrDefault(offer.bankLoanValue, 0),
    bankLoanUnit: normalizeToggleUnit(offer.bankLoanUnit, 'lumps'),
    paymentConditionValue: normalizePaymentValue(offer.paymentConditionValue, 15),
    paymentConditionUnit: normalizePaymentUnit(offer.paymentConditionUnit, 'days'),
    finalRemarks: offer.finalRemarks || ''
  };
};

class SampleEntryService {
  async assertPricingAccess(id, userId, userRole, mode) {
    const entry = await SampleEntryRepository.findById(id);

    if (!entry) {
      throw new Error('Sample entry not found');
    }

    if (mode === 'offer' && !['admin', 'owner'].includes(userRole)) {
      throw new Error('Only admin or owner can update offering price');
    }

    if (mode === 'final' && !['admin', 'owner', 'manager'].includes(userRole)) {
      throw new Error('Only admin, owner, or manager can update final price');
    }

    return entry;
  }

  formatOfferingPayload(offeringRecord) {
    if (!offeringRecord) return null;

    const plain = typeof offeringRecord.toJSON === 'function' ? offeringRecord.toJSON() : offeringRecord;
    const offerVersions = ensureOfferVersions(plain);
    const latestOffer = getLatestOffer(offerVersions);
    const activeOffer = getActiveOffer(offerVersions, plain.activeOfferKey);

    return {
      ...plain,
      offerVersions,
      offerCount: offerVersions.length,
      hasMultipleOffers: offerVersions.length > 1,
      activeOfferKey: activeOffer?.key || plain.activeOfferKey || null,
      activeOffer,
      latestOffer
    };
  }

  async createSampleEntry(entryData, userId) {
    try {
      if (!entryData.date) {
        entryData.date = new Date();
      }

      const validation = ValidationService.validateSampleEntry(entryData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      if (entryData.entryType === 'RICE_SAMPLE') {
        entryData.workflowStatus = 'COOKING_REPORT';
      } else {
        entryData.workflowStatus = 'STAFF_ENTRY';
      }
      entryData.createdByUserId = userId;

      const entry = await SampleEntryRepository.create(entryData);
      await AuditService.logCreate(userId, 'sample_entries', entry.id, entry);

      return entry;
    } catch (error) {
      console.error('Error creating sample entry:', error);
      throw error;
    }
  }

  async getSampleEntryById(id, options = {}) {
    return await SampleEntryRepository.findById(id, options);
  }

  async getSampleEntriesByStatus(status, options = {}) {
    return await SampleEntryRepository.findByStatus(status, options);
  }

  async getSampleEntriesByRole(role, filters = {}, userId) {
    return await SampleEntryRepository.findByRoleAndFilters(role, filters, userId);
  }

  async updateSampleEntry(id, updates, userId) {
    try {
      const currentEntry = await SampleEntryRepository.findById(id);
      if (!currentEntry) {
        throw new Error('Sample entry not found');
      }

      const updatedEntry = await SampleEntryRepository.update(id, updates);

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

  async getSampleEntryLedger(filters = {}) {
    return await SampleEntryRepository.getLedger(filters);
  }

  async updateOfferingPrice(id, priceData, userId, userRole) {
    await this.assertPricingAccess(id, userId, userRole, 'offer');

    let offering = await SampleEntryOffering.findOne({
      where: { sampleEntryId: id }
    });

    const existing = offering ? offering.toJSON() : {};
    const offerVersions = ensureOfferVersions(existing);
    const requestedSlot = OFFER_KEYS.includes(priceData.offerSlot) ? priceData.offerSlot : null;
    const slotKey = requestedSlot || OFFER_KEYS.find((key) => !offerVersions.some((offerItem) => offerItem.key === key)) || 'offer3';
    const existingOffer = offerVersions.find((offerItem) => offerItem.key === slotKey) || {};
    const nextOffer = buildOfferPayload(priceData, existingOffer, slotKey);
    const nextVersions = offerVersions.filter((offerItem) => offerItem.key !== slotKey);
    nextVersions.push(nextOffer);

    let activeOfferKey = existing.activeOfferKey || null;
    if (priceData.activeOfferKey && nextVersions.some((offerItem) => offerItem.key === priceData.activeOfferKey)) {
      activeOfferKey = priceData.activeOfferKey;
    }
    if (toBoolean(priceData.setAsActive, !activeOfferKey)) {
      activeOfferKey = slotKey;
    }

    const activeOffer = getActiveOffer(nextVersions, activeOfferKey);
    const mirroredOffer = mirrorOfferToColumns(activeOffer);
    const offeringData = {
      sampleEntryId: id,
      offerVersions: nextVersions,
      activeOfferKey: activeOffer?.key || activeOfferKey || null,
      ...mirroredOffer,
      createdBy: existing.createdBy || userId,
      updatedBy: userId
    };

    if (offering) {
      await offering.update(offeringData);
    } else {
      offering = await SampleEntryOffering.create(offeringData);
    }

    await this.updateSampleEntry(id, {
      offeringPrice: mirroredOffer.offerBaseRateValue,
      priceType: priceData.priceType,
      offeringRemarks: activeOffer?.remarks || priceData.remarks || null
    }, userId);

    return this.formatOfferingPayload(offering);
  }

  async setFinalPrice(id, finalData, userId, userRole) {
    await this.assertPricingAccess(id, userId, userRole, 'final');

    let offering = await SampleEntryOffering.findOne({
      where: { sampleEntryId: id }
    });

    if (!offering) {
      throw new Error('Offering price must be set before adding final price');
    }

    const updates = { updatedBy: userId };

    if (userRole === 'admin' || userRole === 'owner') {
      if (finalData.hamaliEnabled !== undefined) updates.hamaliEnabled = finalData.hamaliEnabled;
      if (finalData.brokerageEnabled !== undefined) updates.brokerageEnabled = finalData.brokerageEnabled;
      if (finalData.lfEnabled !== undefined) updates.lfEnabled = finalData.lfEnabled;
      if (finalData.suteEnabled !== undefined) updates.suteEnabled = finalData.suteEnabled;
      if (finalData.moistureEnabled !== undefined) updates.moistureEnabled = finalData.moistureEnabled;
      if (finalData.finalPrice !== undefined) updates.finalPrice = finalData.finalPrice;
      if (finalData.finalBaseRate !== undefined) updates.finalBaseRate = finalData.finalBaseRate;
      if (finalData.baseRateUnit !== undefined) updates.baseRateUnit = finalData.baseRateUnit;
      if (finalData.finalSute !== undefined) updates.finalSute = finalData.finalSute;
      if (finalData.finalSuteUnit !== undefined) updates.finalSuteUnit = finalData.finalSuteUnit;
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
      if (finalData.bankLoanEnabled !== undefined) updates.bankLoanEnabled = finalData.bankLoanEnabled;
      if (finalData.bankLoanValue !== undefined) updates.bankLoanValue = finalData.bankLoanValue;
      if (finalData.bankLoanUnit !== undefined) updates.bankLoanUnit = finalData.bankLoanUnit;
      if (finalData.cdEnabled !== undefined) updates.cdEnabled = finalData.cdEnabled;
      if (finalData.cdValue !== undefined) updates.cdValue = finalData.cdValue;
      if (finalData.cdUnit !== undefined) updates.cdUnit = finalData.cdUnit;
      if (finalData.paymentConditionValue !== undefined) updates.paymentConditionValue = finalData.paymentConditionValue;
      if (finalData.paymentConditionUnit !== undefined) updates.paymentConditionUnit = finalData.paymentConditionUnit;
      if (finalData.remarks !== undefined) updates.finalRemarks = finalData.remarks || null;
      if (finalData.isFinalized !== undefined) updates.isFinalized = finalData.isFinalized;
    }

    if (userRole === 'manager') {
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
      if (finalData.baseRateUnit !== undefined) updates.baseRateUnit = finalData.baseRateUnit;
      if (finalData.bankLoanEnabled !== undefined) updates.bankLoanEnabled = finalData.bankLoanEnabled;
      if (finalData.bankLoanValue !== undefined) updates.bankLoanValue = finalData.bankLoanValue;
      if (finalData.bankLoanUnit !== undefined) updates.bankLoanUnit = finalData.bankLoanUnit;
      if (finalData.cdEnabled !== undefined) updates.cdEnabled = finalData.cdEnabled;
      if (finalData.cdValue !== undefined) updates.cdValue = finalData.cdValue;
      if (finalData.cdUnit !== undefined) updates.cdUnit = finalData.cdUnit;
      if (finalData.paymentConditionValue !== undefined) updates.paymentConditionValue = finalData.paymentConditionValue;
      if (finalData.paymentConditionUnit !== undefined) updates.paymentConditionUnit = finalData.paymentConditionUnit;
      if (finalData.remarks !== undefined) updates.finalRemarks = finalData.remarks || null;
      if (finalData.isFinalized !== undefined) updates.isFinalized = finalData.isFinalized;
    }

    await offering.update(updates);

    if (updates.finalPrice !== undefined) {
      await this.updateSampleEntry(id, { finalPrice: updates.finalPrice }, userId);
    }

    return this.formatOfferingPayload(offering);
  }

  async getOfferingData(id) {
    const offering = await SampleEntryOffering.findOne({
      where: { sampleEntryId: id }
    });

    return this.formatOfferingPayload(offering);
  }
}

module.exports = new SampleEntryService();
