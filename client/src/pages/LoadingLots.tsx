import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { API_URL } from '../config/api';
import ResampleAllotment from './ResampleAllotment';

interface SampleEntry {
  id: string;
  serialNo?: number;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  packaging: string;
  workflowStatus: string;
  qualityParameters?: {
    id?: string;
    reportedBy?: string;
    moisture?: number | string | null;
    dryMoisture?: number | string | null;
    cutting1?: number | string | null;
    bend1?: number | string | null;
    mix?: number | string | null;
    sk?: number | string | null;
    grainsCount?: number | string | null;
    updatedAt?: string;
    createdAt?: string;
  };
  cookingReport?: {
    id?: string;
    status?: string;
    remarks?: string;
    history?: CookingAttemptDetail[];
    updatedAt?: string;
    createdAt?: string;
  };
  offering?: any;
  entryType?: string;
  lorryNumber?: string;
  sampleCollectedBy?: string;
  sampleCollectedHistory?: string[];
  qualityReportHistory?: string[];
  qualityAttemptDetails?: QualityAttemptDetail[];
  qualityReportAttempts?: number;
  lotSelectionDecision?: string;
  lotSelectionAt?: string;
  finalPrice?: number;
}

interface QualityAttemptDetail {
  attemptNo: number;
  reportedBy?: string;
  createdAt?: string;
  moisture?: number | string | null;
  dryMoisture?: number | string | null;
  cutting1?: number | string | null;
  cutting2?: number | string | null;
  bend1?: number | string | null;
  bend2?: number | string | null;
  mix?: number | string | null;
  kandu?: number | string | null;
  oil?: number | string | null;
  sk?: number | string | null;
  grainsCount?: number | string | null;
  wbR?: number | string | null;
  wbBk?: number | string | null;
  wbT?: number | string | null;
  paddyWb?: number | string | null;
  gramsReport?: string | null;
}

interface CookingAttemptDetail {
  date?: string;
  status?: string | null;
  cookingDoneBy?: string | null;
  approvedBy?: string | null;
  remarks?: string | null;
}

interface LoadingLotsProps {
  entryType?: string;
  excludeEntryType?: string;
}

const unitLabel = (u: string) => ({ per_kg: '/Kg', per_ton: '/Ton', per_bag: '/Bag', per_quintal: '/Qtl' }[u] || u || '');
const fmtVal = (val: any, unit?: string) => (val == null || val === '' ? '-' : unit ? `${val} ${unitLabel(unit)}` : `${val}`);
const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, (c) => c.toUpperCase()) : '';
const toNumberText = (value: any, digits = 2) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits).replace(/\.00$/, '') : '-';
};
const formatIndianNumber = (value: any, digits = 2) => {
  const num = Number(value);
  return Number.isFinite(num)
    ? num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: digits })
    : '-';
};
const formatIndianCurrency = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num)
    ? num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '-';
};
const toOptionalInputValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isFinite(num) && num === 0) return '';
  return String(value);
};
const parseOptionalNumber = (value: string) => value === '' ? null : parseFloat(value);
const LF_RATE_TYPES = new Set(['PD_LOOSE', 'MD_LOOSE', 'PD_WB']);
const EGB_RATE_TYPES = new Set(['PD_LOOSE', 'MD_LOOSE']);
const hasLfForRateType = (value?: string) => LF_RATE_TYPES.has(String(value || '').toUpperCase());
const hasEgbForRateType = (value?: string) => EGB_RATE_TYPES.has(String(value || '').toUpperCase());
const formatPaymentCondition = (value: any, unit?: string) => {
  if (value == null || value === '') return '-';
  const num = Number(value);
  const intVal = Number.isFinite(num) ? Math.round(num) : value;
  return `${intVal} ${unit === 'month' ? 'Month' : 'Days'}`;
};
const formatRateTypeLabel = (value?: string) => {
  if (!value) return '-';
  return value.replace(/_/g, '/').replace('LOOSE', 'Loose').replace('WB', 'WB');
};
const formatSuteUnitLabel = (value?: string) => value === 'per_bag' ? 'Per Bag' : 'Per Ton';
const formatChargeUnitLabel = (value?: string) => value === 'per_quintal'
  ? 'Per Qtl'
  : value === 'percentage'
    ? 'Percent'
    : value === 'lumps'
      ? 'Lumps'
      : value === 'per_bag'
        ? 'Per Bag'
        : value === 'per_kg'
          ? 'Per Kg'
          : 'Amount';
const hasValue = (value: any) => value !== null && value !== undefined && value !== '';
const sanitizeMoistureInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [integerPartRaw, ...rest] = cleaned.split('.');
  const integerPart = integerPartRaw.slice(0, 2);

  if (rest.length === 0) return integerPart;

  const decimalPart = rest.join('').slice(0, 2);
  return `${integerPart}.${decimalPart}`.slice(0, 5);
};
const sanitizeAmountInput = (value: string, integerDigits = 5, decimalDigits = 2) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [integerPartRaw, ...rest] = cleaned.split('.');
  const integerPart = integerPartRaw.slice(0, integerDigits);

  if (rest.length === 0) return integerPart;

  const decimalPart = rest.join('').slice(0, decimalDigits);
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
};
const getEntryTypeCode = (entryTypeValue?: string) => entryTypeValue === 'DIRECT_LOADED_VEHICLE' ? 'RL' : entryTypeValue === 'LOCATION_SAMPLE' ? 'LS' : 'MS';
const paddyColumnWidths = ['48px', '54px', '74px', '66px', '250px', '118px', '124px', '180px', '180px', '120px', '120px', '94px', '74px', '70px', '90px', '64px', '78px', '72px', '72px', '120px', '110px', '150px', '104px'];
const compactStatusText = (parts: string[]) => parts.filter(Boolean).join(' | ');
const getAttemptLabel = (attemptNo: number) => {
  if (attemptNo <= 1) return '1st';
  return '2nd';
};
const getQualityAttemptLabel = (attemptNo: number) => {
  if (attemptNo <= 1) return '1st';
  return '2nd';
};
const formatAttemptValue = (value: any, suffix = '') => {
  if (value === null || value === undefined || value === '') return '-';
  return `${toNumberText(value)}${suffix}`;
};
const formatQualityMix = (attempt: QualityAttemptDetail) => {
  const rows = [
    attempt.mix != null && attempt.mix !== '' ? toNumberText(attempt.mix) : ''
  ].filter(Boolean);
  return rows.length ? rows.join(' | ') : '-';
};
const formatOilKandu = (attempt: QualityAttemptDetail) => {
  const rows = [
    attempt.oil != null && attempt.oil !== '' ? `Oil ${toNumberText(attempt.oil)}` : '',
    attempt.kandu != null && attempt.kandu !== '' ? `Kandu ${toNumberText(attempt.kandu)}` : ''
  ].filter(Boolean);
  return rows.length ? rows.join(' | ') : '-';
};
const formatCuttingPair = (attempt: QualityAttemptDetail) => {
  const c1 = attempt.cutting1;
  const c2 = attempt.cutting2;
  if ((c1 === null || c1 === undefined || c1 === '') && (c2 === null || c2 === undefined || c2 === '')) return '-';
  return `${toNumberText(c1)} x ${toNumberText(c2)}`;
};
const formatBendPair = (attempt: QualityAttemptDetail) => {
  const b1 = attempt.bend1;
  const b2 = attempt.bend2;
  if ((b1 === null || b1 === undefined || b1 === '') && (b2 === null || b2 === undefined || b2 === '')) return '-';
  return `${toNumberText(b1)} x ${toNumberText(b2)}`;
};
const formatWBRows = (attempt: QualityAttemptDetail) => {
  const rows = [
    attempt.wbR != null && attempt.wbR !== '' ? `R-${toNumberText(attempt.wbR)}` : '',
    attempt.wbBk != null && attempt.wbBk !== '' ? `BK-${toNumberText(attempt.wbBk)}` : '',
    attempt.wbT != null && attempt.wbT !== '' ? `T-${toNumberText(attempt.wbT)}` : ''
  ].filter(Boolean);
  return rows.length ? rows.join(' | ') : '-';
};
const isMeaningfulCellValue = (value: any) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  if (!text || text === '-') return false;
  if (/[A-Za-z]/.test(text)) return true;
  return /[1-9]/.test(text);
};
const normalizeCookingStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PASS') return 'Pass';
  if (normalized === 'MEDIUM') return 'Medium';
  if (normalized === 'FAIL') return 'Fail';
  if (normalized === 'RECHECK') return 'Recheck';
  return normalized ? toTitleCase(normalized.toLowerCase()) : 'Not Applicable';
};

const LoadingLots: React.FC<LoadingLotsProps> = ({ entryType, excludeEntryType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const isRiceMode = entryType === 'RICE_SAMPLE';
  const tableMinWidth = isRiceMode ? '100%' : '2400px';
  const pageSize = 100;

  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showOfferEditModal, setShowOfferEditModal] = useState(false);
  const [showFinalEditModal, setShowFinalEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qualityHistoryModal, setQualityHistoryModal] = useState<{ open: boolean; entry: SampleEntry | null }>({ open: false, entry: null });
  const [remarksPopup, setRemarksPopup] = useState<{ isOpen: boolean; title: string; text: string }>({ isOpen: false, title: '', text: '' });
  const [offerEditData, setOfferEditData] = useState({
    offerBaseRateValue: '',
    baseRateType: 'PD_LOOSE',
    baseRateUnit: 'per_bag',
    sute: '',
    suteUnit: 'per_bag',
    moistureValue: '',
    hamaliEnabled: false,
    hamaliValue: '',
    hamaliUnit: 'per_bag',
    brokerageEnabled: false,
    brokerageValue: '',
    brokerageUnit: 'per_bag',
    lfEnabled: false,
    lfValue: '',
    lfUnit: 'per_bag',
    cdEnabled: false,
    cdValue: '',
    cdUnit: 'lumps',
    bankLoanEnabled: false,
    bankLoanValue: '',
    bankLoanUnit: 'lumps',
    paymentConditionEnabled: true,
    paymentConditionValue: '15',
    paymentConditionUnit: 'days',
    egbType: 'mill',
    egbValue: '0',
    customDivisor: '',
    remarks: ''
  });
  const [finalEditData, setFinalEditData] = useState({
    finalSute: '',
    finalSuteUnit: 'per_ton',
    finalBaseRate: '',
    baseRateUnit: 'per_bag',
    suteEnabled: true,
    moistureEnabled: true,
    hamaliEnabled: false,
    brokerageEnabled: false,
    lfEnabled: false,
    moistureValue: '',
    hamali: '',
    hamaliUnit: 'per_bag',
    brokerage: '',
    brokerageUnit: 'per_bag',
    lf: '',
    lfUnit: 'per_bag',
    egbValue: '',
    egbType: 'mill',
    customDivisor: '',
    cdEnabled: false,
    cdValue: '',
    cdUnit: 'lumps',
    bankLoanEnabled: false,
    bankLoanValue: '',
    bankLoanUnit: 'lumps',
    paymentConditionEnabled: true,
    paymentConditionValue: '15',
    paymentConditionUnit: 'days',
    finalPrice: '',
    remarks: ''
  });
  const [managerData, setManagerData] = useState({
    sute: '', suteUnit: 'per_ton', moistureValue: '', hamali: '', hamaliUnit: 'per_bag',
    brokerage: '', brokerageUnit: 'per_bag', lf: '', lfUnit: 'per_bag',
    finalBaseRate: '', baseRateType: 'PD_LOOSE', egbValue: '', egbType: 'mill',
    cdValue: '', cdUnit: 'lumps', bankLoanValue: '', bankLoanUnit: 'lumps',
    paymentConditionEnabled: false,
    paymentConditionValue: '15', paymentConditionUnit: 'days'
  });

  const [paddySupervisors, setPaddySupervisors] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loadingView, setLoadingView] = useState<'FINAL_LOADING' | 'RESAMPLE_ALLOTMENT'>('FINAL_LOADING');
  const isAdminOrOwner = ['admin', 'owner'].includes(String(user?.role || '').toLowerCase());

  const fetchSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_URL}/sample-entries/paddy-supervisors`,
        {
          params: { staffType: 'location' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = res.data as any;
      setPaddySupervisors(data.users || []);
    } catch {
      setPaddySupervisors([]);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  useEffect(() => {
    if (isRiceMode) {
      setLoadingView('FINAL_LOADING');
    }
  }, [isRiceMode]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (filters.broker) params.broker = filters.broker;
      if (filters.variety) params.variety = filters.variety;
      if (filters.party) params.party = filters.party;
      if (filters.location) params.location = filters.location;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (entryType) params.entryType = entryType;
      if (excludeEntryType) params.excludeEntryType = excludeEntryType;
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/sample-entries/tabs/loading-lots`, { params, headers: { Authorization: `Bearer ${token}` } });
      const data = res.data as { entries: SampleEntry[]; total: number };
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching loading lots:', err);
    }
    setLoading(false);
  }, [page, filters, entryType, excludeEntryType]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleUpdateClick = (entry: SampleEntry) => {
    if (entry.entryType !== 'RICE_SAMPLE' && !entry.qualityParameters?.id && !entry.qualityParameters?.reportedBy) {
      showNotification('Add quality report before filling manager values.', 'error');
      return;
    }
    const o = entry.offering || {};
    setSelectedEntry(entry);
    setManagerData({
      sute: o.finalSute?.toString() ?? o.sute?.toString() ?? '',
      suteUnit: o.finalSuteUnit || o.suteUnit || 'per_ton',
      moistureValue: o.moistureValue?.toString() ?? '',
      hamali: toOptionalInputValue(o.hamali),
      hamaliUnit: o.hamaliUnit || 'per_bag',
      brokerage: toOptionalInputValue(o.brokerage),
      brokerageUnit: o.brokerageUnit || 'per_bag',
      lf: toOptionalInputValue(o.lf),
      lfUnit: o.lfUnit || 'per_bag',
      finalBaseRate: o.finalBaseRate?.toString() ?? o.offerBaseRateValue?.toString() ?? '',
      baseRateType: o.baseRateType || 'PD_LOOSE',
      egbValue: o.egbValue?.toString() ?? '',
      egbType: o.egbType || ((o.egbValue && parseFloat(o.egbValue) > 0) ? 'purchase' : 'mill'),
      cdValue: toOptionalInputValue(o.cdValue),
      cdUnit: o.cdUnit || 'lumps',
      bankLoanValue: toOptionalInputValue(o.bankLoanValue),
      bankLoanUnit: o.bankLoanUnit || 'lumps',
      paymentConditionEnabled: !(o.paymentConditionValue == null || o.paymentConditionValue === ''),
      paymentConditionValue: o.paymentConditionValue?.toString() ?? '15',
      paymentConditionUnit: o.paymentConditionUnit || 'days'
    });
    setShowModal(true);
  };

  const handleOpenOfferEdit = (entry: SampleEntry) => {
    const o = entry.offering || {};
    setSelectedEntry(entry);
    setShowModal(false);
    setShowFinalEditModal(false);
    setOfferEditData({
      offerBaseRateValue: o.offerBaseRateValue != null ? String(o.offerBaseRateValue) : '',
      baseRateType: o.baseRateType || 'PD_LOOSE',
      baseRateUnit: o.baseRateUnit || 'per_bag',
      sute: o.sute != null ? String(o.sute) : '',
      suteUnit: o.suteUnit || 'per_bag',
      moistureValue: o.moistureValue != null ? String(o.moistureValue) : '',
      hamaliEnabled: !!o.hamaliEnabled,
      hamaliValue: toOptionalInputValue(o.hamali),
      hamaliUnit: o.hamaliUnit || 'per_bag',
      brokerageEnabled: !!o.brokerageEnabled,
      brokerageValue: toOptionalInputValue(o.brokerage),
      brokerageUnit: o.brokerageUnit || 'per_bag',
      lfEnabled: !!o.lfEnabled,
      lfValue: toOptionalInputValue(o.lf),
      lfUnit: o.lfUnit || 'per_bag',
      cdEnabled: !!o.cdEnabled,
      cdValue: toOptionalInputValue(o.cdValue),
      cdUnit: o.cdUnit || 'lumps',
      bankLoanEnabled: !!o.bankLoanEnabled,
      bankLoanValue: toOptionalInputValue(o.bankLoanValue),
      bankLoanUnit: o.bankLoanUnit || 'lumps',
      paymentConditionEnabled: o.paymentConditionEnabled != null ? !!o.paymentConditionEnabled : true,
      paymentConditionValue: o.paymentConditionValue != null ? String(o.paymentConditionValue) : '15',
      paymentConditionUnit: o.paymentConditionUnit || 'days',
      egbType: o.egbType || 'mill',
      egbValue: o.egbType === 'purchase' ? (o.egbValue != null ? String(o.egbValue) : '') : '0',
      customDivisor: o.customDivisor != null ? String(o.customDivisor) : '',
      remarks: o.remarks || ''
    });
    setShowOfferEditModal(true);
  };

  const handleOpenFinalEdit = (entry: SampleEntry) => {
    const o = entry.offering || {};
    setSelectedEntry(entry);
    setShowModal(false);
    setShowOfferEditModal(false);
    setFinalEditData({
      finalSute: o.finalSute != null ? String(o.finalSute) : '',
      finalSuteUnit: o.finalSuteUnit || 'per_ton',
      finalBaseRate: o.finalBaseRate != null ? String(o.finalBaseRate) : (o.offerBaseRateValue != null ? String(o.offerBaseRateValue) : ''),
      baseRateUnit: o.baseRateUnit || 'per_bag',
      suteEnabled: o.suteEnabled != null ? !!o.suteEnabled : true,
      moistureEnabled: o.moistureEnabled != null ? !!o.moistureEnabled : true,
      hamaliEnabled: !!o.hamaliEnabled,
      brokerageEnabled: !!o.brokerageEnabled,
      lfEnabled: !!o.lfEnabled,
      moistureValue: o.moistureValue != null ? String(o.moistureValue) : '',
      hamali: toOptionalInputValue(o.hamali),
      hamaliUnit: o.hamaliUnit || 'per_bag',
      brokerage: toOptionalInputValue(o.brokerage),
      brokerageUnit: o.brokerageUnit || 'per_bag',
      lf: toOptionalInputValue(o.lf),
      lfUnit: o.lfUnit || 'per_bag',
      egbValue: o.egbValue != null ? String(o.egbValue) : '',
      egbType: o.egbType || ((o.egbValue && Number(o.egbValue) > 0) ? 'purchase' : 'mill'),
      customDivisor: o.customDivisor != null ? String(o.customDivisor) : '',
      cdEnabled: !!o.cdEnabled,
      cdValue: toOptionalInputValue(o.cdValue),
      cdUnit: o.cdUnit || 'lumps',
      bankLoanEnabled: !!o.bankLoanEnabled,
      bankLoanValue: toOptionalInputValue(o.bankLoanValue),
      bankLoanUnit: o.bankLoanUnit || 'lumps',
      paymentConditionEnabled: o.paymentConditionEnabled != null ? !!o.paymentConditionEnabled : true,
      paymentConditionValue: o.paymentConditionValue != null ? String(o.paymentConditionValue) : '15',
      paymentConditionUnit: o.paymentConditionUnit || 'days',
      finalPrice: o.finalPrice != null ? String(o.finalPrice) : (entry.finalPrice != null ? String(entry.finalPrice) : ''),
      remarks: o.finalRemarks || ''
    });
    setShowFinalEditModal(true);
  };

  const handleSaveOfferEdit = async () => {
    if (!selectedEntry || isSubmitting) return;
    const rateValue = offerEditData.offerBaseRateValue ? parseFloat(offerEditData.offerBaseRateValue) : 0;
    if (!rateValue) {
      showNotification('Enter a valid offer rate.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const activeKey = selectedEntry.offering?.activeOfferKey || 'offer1';
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/offering-price`,
        {
          offerSlot: activeKey,
          activeOfferKey: activeKey,
          baseRateType: offerEditData.baseRateType,
          baseRateUnit: offerEditData.baseRateUnit,
          offerBaseRateValue: rateValue,
          offerRate: rateValue,
          sute: offerEditData.sute ? parseFloat(offerEditData.sute) : 0,
          suteUnit: offerEditData.suteUnit,
          hamaliEnabled: offerEditData.hamaliEnabled,
          hamali: parseOptionalNumber(offerEditData.hamaliValue),
          hamaliUnit: offerEditData.hamaliUnit,
          moistureValue: offerEditData.moistureValue ? parseFloat(offerEditData.moistureValue) : 0,
          brokerageValue: parseOptionalNumber(offerEditData.brokerageValue),
          brokerageEnabled: offerEditData.brokerageEnabled,
          brokerageUnit: offerEditData.brokerageUnit,
          lfValue: parseOptionalNumber(offerEditData.lfValue),
          lfEnabled: offerEditData.lfEnabled,
          lfUnit: offerEditData.lfUnit,
          egbValue: offerEditData.egbType === 'mill' ? 0 : (offerEditData.egbValue ? parseFloat(offerEditData.egbValue) : 0),
          egbType: offerEditData.egbType,
          customDivisor: offerEditData.customDivisor ? parseFloat(offerEditData.customDivisor) : null,
          cdEnabled: offerEditData.cdEnabled,
          cdValue: parseOptionalNumber(offerEditData.cdValue),
          cdUnit: offerEditData.cdUnit,
          bankLoanEnabled: offerEditData.bankLoanEnabled,
          bankLoanValue: parseOptionalNumber(offerEditData.bankLoanValue),
          bankLoanUnit: offerEditData.bankLoanUnit,
          paymentConditionValue: offerEditData.paymentConditionEnabled && offerEditData.paymentConditionValue ? parseFloat(offerEditData.paymentConditionValue) : null,
          paymentConditionUnit: offerEditData.paymentConditionUnit,
          remarks: offerEditData.remarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Offer rate updated', 'success');
      setShowOfferEditModal(false);
      setSelectedEntry(null);
      fetchEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to update offer rate', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveFinalEdit = async () => {
    if (!selectedEntry || isSubmitting) return;
    const rateValue = finalEditData.finalBaseRate ? parseFloat(finalEditData.finalBaseRate) : 0;
    if (!rateValue) {
      showNotification('Enter a valid final rate.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/final-price`,
        {
          finalSute: finalEditData.finalSute ? parseFloat(finalEditData.finalSute) : null,
          finalSuteUnit: finalEditData.finalSuteUnit,
          finalBaseRate: rateValue,
          baseRateUnit: finalEditData.baseRateUnit,
          suteEnabled: finalEditData.suteEnabled,
          moistureEnabled: finalEditData.moistureEnabled,
          hamaliEnabled: finalEditData.hamaliEnabled,
          brokerageEnabled: finalEditData.brokerageEnabled,
          lfEnabled: finalEditData.lfEnabled,
          moistureValue: finalEditData.moistureValue ? parseFloat(finalEditData.moistureValue) : null,
          hamali: finalEditData.hamali ? parseFloat(finalEditData.hamali) : null,
          hamaliUnit: finalEditData.hamaliUnit,
          brokerage: finalEditData.brokerage ? parseFloat(finalEditData.brokerage) : null,
          brokerageUnit: finalEditData.brokerageUnit,
          lf: finalEditData.lf ? parseFloat(finalEditData.lf) : null,
          lfUnit: finalEditData.lfUnit,
          egbValue: finalEditData.egbType === 'mill' ? 0 : (finalEditData.egbValue ? parseFloat(finalEditData.egbValue) : null),
          egbType: finalEditData.egbType,
          customDivisor: finalEditData.customDivisor ? parseFloat(finalEditData.customDivisor) : null,
          cdEnabled: finalEditData.cdEnabled,
          cdValue: finalEditData.cdValue ? parseFloat(finalEditData.cdValue) : null,
          cdUnit: finalEditData.cdUnit,
          bankLoanEnabled: finalEditData.bankLoanEnabled,
          bankLoanValue: finalEditData.bankLoanValue ? parseFloat(finalEditData.bankLoanValue) : null,
          bankLoanUnit: finalEditData.bankLoanUnit,
          paymentConditionValue: finalEditData.paymentConditionEnabled && finalEditData.paymentConditionValue ? parseFloat(finalEditData.paymentConditionValue) : null,
          paymentConditionUnit: finalEditData.paymentConditionUnit,
          finalPrice: finalEditData.finalPrice ? parseFloat(finalEditData.finalPrice) : rateValue,
          remarks: finalEditData.remarks,
          isFinalized: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification('Final rate updated', 'success');
      setShowFinalEditModal(false);
      setSelectedEntry(null);
      fetchEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to update final rate', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleSaveValues = async () => {
    if (!selectedEntry || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const o = selectedEntry.offering || {};
      const hasLf = hasLfForRateType(managerData.baseRateType || o.baseRateType);
      const hasEgb = hasEgbForRateType(managerData.baseRateType || o.baseRateType);
      const cdEnabled = !!managerData.cdValue || !!o.cdEnabled;
      const bankLoanEnabled = !!managerData.bankLoanValue || !!o.bankLoanEnabled;
      const payload: any = {
        finalSute: managerData.sute ? parseFloat(managerData.sute) : (o.finalSute ?? o.sute ?? null),
        finalSuteUnit: managerData.suteUnit || o.finalSuteUnit || o.suteUnit || 'per_ton',
        finalBaseRate: managerData.finalBaseRate ? parseFloat(managerData.finalBaseRate) : (o.finalBaseRate ?? o.offerBaseRateValue ?? null),
        suteEnabled: o.suteEnabled, moistureEnabled: o.moistureEnabled, hamaliEnabled: o.hamaliEnabled, brokerageEnabled: o.brokerageEnabled, lfEnabled: o.lfEnabled,
        moistureValue: managerData.moistureValue ? parseFloat(managerData.moistureValue) : (o.moistureValue ?? null),
        hamali: managerData.hamali ? parseFloat(managerData.hamali) : (o.hamali ?? null),
        hamaliUnit: managerData.hamaliUnit || o.hamaliUnit || 'per_bag',
        brokerage: managerData.brokerage ? parseFloat(managerData.brokerage) : (o.brokerage ?? null),
        brokerageUnit: managerData.brokerageUnit || o.brokerageUnit || 'per_bag',
        lf: hasLf ? (managerData.lf ? parseFloat(managerData.lf) : (o.lf ?? null)) : 0,
        lfUnit: managerData.lfUnit || o.lfUnit || 'per_bag',
        egbValue: hasEgb && managerData.egbType !== 'mill' ? (managerData.egbValue ? parseFloat(managerData.egbValue) : (o.egbValue ?? 0)) : 0,
        egbType: hasEgb ? (managerData.egbType || o.egbType || 'mill') : 'mill',
        customDivisor: o.customDivisor ?? null,
        cdEnabled,
        cdValue: managerData.cdValue ? parseFloat(managerData.cdValue) : (o.cdValue ?? null),
        cdUnit: managerData.cdUnit || o.cdUnit || 'lumps',
        bankLoanEnabled,
        bankLoanValue: managerData.bankLoanValue ? parseFloat(managerData.bankLoanValue) : (o.bankLoanValue ?? null),
        bankLoanUnit: managerData.bankLoanUnit || o.bankLoanUnit || 'lumps',
        paymentConditionValue: managerData.paymentConditionEnabled && managerData.paymentConditionValue ? parseInt(managerData.paymentConditionValue, 10) : null,
        paymentConditionUnit: managerData.paymentConditionUnit || o.paymentConditionUnit || 'days',
        isFinalized: true
      };
      await axios.post(`${API_URL}/sample-entries/${selectedEntry.id}/final-price`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setShowModal(false);
      setSelectedEntry(null);
      fetchEntries();
      showNotification('Values saved successfully. Lot moved to Pending Allotting Supervisor', 'success');
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to save values', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignResample = async (entry: SampleEntry) => {
    const selected = assignments[entry.id] !== undefined ? assignments[entry.id] : (entry.sampleCollectedBy || '');

    if (!selected) {
      showNotification('Select Sample Collected By', 'error');
      return;
    }

    if (selected === entry.sampleCollectedBy && entry.sampleCollectedBy !== null) {
      showNotification('No changes made to supervisor assignment', 'info');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload: any = {
        sampleCollectedBy: selected
      };
      if (entry.entryType !== 'LOCATION_SAMPLE') {
        payload.entryType = 'LOCATION_SAMPLE';
      }
      await axios.put(`${API_URL}/sample-entries/${entry.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showNotification('Resample user assigned successfully', 'success');
      fetchEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to assign user', 'error');
    }
  };

  const groupedByDateBroker: Record<string, Record<string, SampleEntry[]>> = {};

  const filteredEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dateA = new Date(a.entryDate).getTime();
      const dateB = new Date(b.entryDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      const brokerCmp = String(a.brokerName || '').localeCompare(String(b.brokerName || ''));
      if (brokerCmp !== 0) return brokerCmp;
      const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
      const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
      if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [entries]);

  filteredEntries.forEach((entry) => {
    const dt = new Date(entry.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const broker = entry.brokerName || 'Unknown';
    if (!groupedByDateBroker[dt]) groupedByDateBroker[dt] = {};
    if (!groupedByDateBroker[dt][broker]) groupedByDateBroker[dt][broker] = [];
    groupedByDateBroker[dt][broker].push(entry);
  });

  const isManagerOrOwner = user?.role === 'manager' || user?.role === 'owner' || user?.role === 'admin';
  const totalPages = Math.ceil(total / pageSize);
  const statusLabel = (status: string) => ({
    STAFF_ENTRY: 'Staff Entry', QUALITY_NEEDED: 'Quality Needed', PENDING_LOT_SELECTION: 'Pending Lot Selection',
    PENDING_COOKING_REPORT: 'Pending Cooking Report', PENDING_LOTS_PASSED: 'Pending Lots Passed', FINAL_REPORT: 'Pending Lots Passed',
    LOT_ALLOTMENT: 'Pending Loading Lots', PENDING_ALLOTTING_SUPERVISOR: 'Pending Allotting Supervisor', PHYSICAL_INSPECTION: 'Physical Inspection',
    INVENTORY_ENTRY: 'Inventory Entry', OWNER_FINANCIAL: 'Owner Financial', MANAGER_FINANCIAL: 'Manager Financial', FINAL_REVIEW: 'Final Review', COMPLETED: 'Completed'
  }[status] || status.replace(/_/g, ' '));

  const renderCollectedByHistory = (entry: SampleEntry) => {
    const names = (entry.sampleCollectedHistory || []).filter(Boolean).length > 0
      ? (entry.sampleCollectedHistory || []).filter(Boolean)
      : (entry.sampleCollectedBy ? [entry.sampleCollectedBy] : []);
    const uniqueNames: string[] = [];
    names.forEach((name) => {
      const normalized = String(name).trim();
      if (!normalized) return;
      if (uniqueNames.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) return;
      uniqueNames.push(normalized);
    });
    if (uniqueNames.length === 0) return '-';
    const hasQualityHistory = (entry.qualityAttemptDetails || []).length > 0;
    return (
      <div style={{ lineHeight: '1.35' }}>
        {uniqueNames.map((name, index) => (
          <div
            key={`${entry.id}-collected-${index}`}
            style={{ fontWeight: 700, color: index === 0 ? '#1f2937' : '#4f83cc', whiteSpace: 'nowrap', fontSize: '13px', cursor: hasQualityHistory ? 'pointer' : 'default', textDecoration: hasQualityHistory ? 'underline' : 'none' }}
            onClick={() => hasQualityHistory && setQualityHistoryModal({ open: true, entry })}
          >
            {index + 1}] {toTitleCase(name)}
          </div>
        ))}
      </div>
    );
  };

  const qualityModalEntry = qualityHistoryModal.entry;
  const qualityAttemptDetails = qualityModalEntry?.qualityAttemptDetails || [];

  const modalOffering = selectedEntry?.offering || {};
  const modalRateType = managerData.baseRateType || modalOffering.baseRateType || 'PD_LOOSE';
  const modalHasLf = hasLfForRateType(modalRateType);
  const modalHasEgb = hasEgbForRateType(modalRateType);
  const modalSuteMissing = !!selectedEntry && modalOffering.suteEnabled === false && !parseFloat(modalOffering.finalSute ?? '') && !parseFloat(modalOffering.sute ?? '');
  const modalMoistureMissing = !!selectedEntry && modalOffering.moistureEnabled === false && !parseFloat(modalOffering.moistureValue ?? '');
  const modalHamaliMissing = !!selectedEntry && modalOffering.hamaliEnabled === false && !parseFloat(modalOffering.hamali ?? '');
  const modalBrokerageMissing = !!selectedEntry && modalOffering.brokerageEnabled === false && !parseFloat(modalOffering.brokerage ?? '');
  const modalLfMissing = !!selectedEntry && modalHasLf && modalOffering.lfEnabled === false && !parseFloat(modalOffering.lf ?? '');
  const modalCdMissing = !!selectedEntry && !!modalOffering.cdEnabled && !parseFloat(modalOffering.cdValue ?? '');
  const modalBankLoanMissing = !!selectedEntry && !!modalOffering.bankLoanEnabled && !parseFloat(modalOffering.bankLoanValue ?? '');
  const modalPaymentMissing = !!selectedEntry && !!managerData.paymentConditionEnabled && !parseInt(modalOffering.paymentConditionValue ?? '', 10);
  const modalEgbMissing = !!selectedEntry && modalHasEgb && modalOffering.egbType === 'purchase' && !parseFloat(modalOffering.egbValue ?? '');
  const modalMissingFields = [
    modalSuteMissing ? 'Sute' : '',
    modalMoistureMissing ? 'Moisture' : '',
    modalHamaliMissing ? 'Hamali' : '',
    modalBrokerageMissing ? 'Brokerage' : '',
    modalLfMissing ? 'LF' : '',
    modalCdMissing ? 'CD' : '',
    modalBankLoanMissing ? 'Bank Loan' : '',
    modalPaymentMissing ? 'Payment' : '',
    modalEgbMissing ? 'EGB' : ''
  ].filter(Boolean);
  const modalCardStyle: React.CSSProperties = { borderRadius: '8px', padding: '10px', border: '1px solid #d7e1ea', background: '#f8fafc', minWidth: 0 };
  const modalEditableCardStyle: React.CSSProperties = { ...modalCardStyle, border: '1px solid #f5c542', background: '#fffdf3' };
  const modalLabelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '6px' };
  const modalMetaStyle: React.CSSProperties = { fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '6px' };
  const modalReadonlyValueStyle: React.CSSProperties = { minHeight: '34px', borderRadius: '6px', border: '1px solid #d0d7de', background: '#eef2f7', padding: '7px 9px', fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', fontWeight: 600 };
  const modalInputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #3498db', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', background: '#fff' };
  const modalTagStyle = (editable: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', marginBottom: '6px', background: editable ? '#fff3cd' : '#dbeafe', color: editable ? '#8a6400' : '#1d4ed8' });

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          type="button"
          onClick={() => setLoadingView('FINAL_LOADING')}
          style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 700, border: 'none', borderRadius: '4px', background: loadingView === 'FINAL_LOADING' ? '#1565c0' : '#90a4ae', color: 'white', cursor: 'pointer' }}
        >
          Final Loading Lots
        </button>
        {!isRiceMode && (
          <button
            type="button"
            onClick={() => setLoadingView('RESAMPLE_ALLOTMENT')}
            style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 700, border: 'none', borderRadius: '4px', background: loadingView === 'RESAMPLE_ALLOTMENT' ? '#ef6c00' : '#90a4ae', color: 'white', cursor: 'pointer' }}
          >
            Resample Allotment
          </button>
        )}
      </div>

      {!isRiceMode && loadingView === 'RESAMPLE_ALLOTMENT' ? (
        <ResampleAllotment entryType={entryType} excludeEntryType={excludeEntryType || 'RICE_SAMPLE'} />
      ) : (
        <>
          <div style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#666' }}>Showing {filteredEntries.length} lots (of {total} total passed lots)</span>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowFilters(!showFilters)} style={{ padding: '6px 14px', fontSize: '13px', background: showFilters ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {showFilters ? 'Hide Filters' : 'Filters'} ▾
              </button>
              {showFilters && (
                <div style={{ position: 'absolute', right: 0, top: '38px', zIndex: 5, display: 'flex', gap: '8px', flexWrap: 'nowrap', overflowX: 'auto', padding: '10px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e0e0e0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: '90vw' }}>
                  <select
                    value={filters.broker}
                    onChange={(e) => setFilters({ ...filters, broker: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }}
                  >
                    <option value="">Broker</option>
                    {Array.from(new Set(entries.map((entry) => entry.brokerName))).sort().map((broker) => (
                      <option key={broker} value={broker}>{broker}</option>
                    ))}
                  </select>
                  <select
                    value={filters.variety}
                    onChange={(e) => setFilters({ ...filters, variety: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }}
                  >
                    <option value="">Variety</option>
                    {Array.from(new Set(entries.map((entry) => entry.variety))).sort().map((variety) => (
                      <option key={variety} value={variety}>{variety}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Party"
                    value={filters.party}
                    onChange={(e) => setFilters({ ...filters, party: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }}
                  />
                  <input
                    placeholder="Location"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }}
                  />
                  <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                  <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                  <button onClick={() => { setPage(1); fetchEntries(); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Apply</button>
                  <button onClick={() => { setFilters({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' }); setPage(1); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '6px' }}>
            {loading ? <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div> : filteredEntries.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No loading lots found in this tab</div> : Object.entries(groupedByDateBroker).map(([dateStr, brokerGroups]) => {
              let brokerSeq = 0;
              return (
                <div key={dateStr}>
                  {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                    const orderedEntries = [...brokerEntries].sort((a, b) => {
                      const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                      const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                      if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    });
                    brokerSeq++;
                    return (
                      <div key={brokerName} style={{ marginBottom: 0 }}>
                        {brokerIdx === 0 && <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white', padding: '6px 10px', fontWeight: 700, fontSize: '14px', textAlign: 'center', letterSpacing: '0.5px', minWidth: tableMinWidth }}>{(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}&nbsp;&nbsp;{isRiceMode ? 'Rice Sample' : 'Paddy Sample'}</div>}
                        <div style={{ background: '#e8eaf6', color: '#000', padding: '4px 10px', fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '4px', minWidth: tableMinWidth }}><span style={{ fontSize: '13.5px', fontWeight: 800 }}>{brokerSeq}.</span> {brokerName}</div>
                        <table style={{ width: '100%', minWidth: tableMinWidth, borderCollapse: 'collapse', fontSize: '12px', tableLayout: isRiceMode ? 'fixed' : 'fixed', border: '1px solid #000' }}>
                          {!isRiceMode && (
                            <colgroup>
                              {paddyColumnWidths.map((width, widthIndex) => (
                                <col key={`${brokerName}-col-${widthIndex}`} style={{ width }} />
                              ))}
                            </colgroup>
                          )}
                          <thead style={{ position: 'sticky', top: 56, zIndex: 2 }}>
                            <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                              {(isRiceMode ? ['SL', 'Type', 'Bags', 'Pkg', 'Party Name', 'Rice Location', 'Variety', 'Final Rate', 'Sute', 'Mst%', 'Hamali', 'Bkrg', 'LF', 'Status', 'Action'] : ['SL No', 'Type', 'Bags', 'Pkg', 'Party Name', 'Paddy Location', 'Variety', 'Sample Collected By', 'Sample Report By', 'Quality Report', 'Cooking Report', 'Final Rate', 'Sute', 'Moist', 'Brokerage', 'LF', 'Hamali', 'CD', 'EGB', 'Bank Loan', 'Payment', 'Status', 'Action']).map((header) => (
                                <th
                                  key={header}
                                  style={{
                                    border: '1px solid #000',
                                    padding: '3px 4px',
                                    textAlign: ['Status', 'Action', 'EGB', 'Sute', 'Moist', 'Mst%'].includes(header) ? 'center' : 'left',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    fontSize: '12px'
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {orderedEntries.map((entry, index) => {
                              const o = entry.offering || {};
                              const hasLf = hasLfForRateType(o.baseRateType);
                              const hasEgb = hasEgbForRateType(o.baseRateType);
                              const suteMissing = o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute);
                              const mstMissing = o.moistureEnabled === false && !parseFloat(o.moistureValue);
                              const hamaliMissing = o.hamaliEnabled === false && !parseFloat(o.hamali);
                              const bkrgMissing = o.brokerageEnabled === false && !parseFloat(o.brokerage);
                              const lfMissing = hasLf && o.lfEnabled === false && !parseFloat(o.lf);
                              const cdMissing = !!o.cdEnabled && !parseFloat(o.cdValue);
                              const bankLoanMissing = !!o.bankLoanEnabled && !parseFloat(o.bankLoanValue);
                              const paymentMissing = !(o.paymentConditionValue == null || o.paymentConditionValue === '') && !parseInt(o.paymentConditionValue, 10);
                              const needsFill = suteMissing || mstMissing || hamaliMissing || bkrgMissing || lfMissing || cdMissing || bankLoanMissing || paymentMissing;
                              const missingFieldLabels = [
                                suteMissing ? 'Sute' : '',
                                mstMissing ? 'Moist' : '',
                                bkrgMissing ? 'Bkrg' : '',
                                lfMissing ? 'LF' : '',
                                hamaliMissing ? 'Hamali' : '',
                                cdMissing ? 'CD' : '',
                                bankLoanMissing ? 'BL' : '',
                                paymentMissing ? 'Payment' : ''
                              ].filter(Boolean);
                              const qualityData = entry.qualityParameters || {};
                              const hasQualityReport = !!entry.qualityParameters?.id || !!entry.qualityParameters?.reportedBy;
                              const toTs = (value?: string | null) => {
                                if (!value) return 0;
                                const time = new Date(value).getTime();
                                return Number.isFinite(time) ? time : 0;
                              };
                              const lotSelectionTs = toTs(entry.lotSelectionAt);
                              const qualityAttemptsBase = [...(entry.qualityAttemptDetails || [])].sort((a, b) => (a.attemptNo || 0) - (b.attemptNo || 0));
                              const resampleAttempts = Math.max(qualityAttemptsBase.length, Number(entry.qualityReportAttempts || 0));
                              const isResampleCase = entry.lotSelectionDecision === 'FAIL' || resampleAttempts > 1;
                              let qualityAttempts = [...qualityAttemptsBase];
                              if (isResampleCase && qualityAttempts.length < 2 && hasQualityReport) {
                                const qualityCurrentTs = toTs(qualityData.updatedAt || qualityData.createdAt);
                                const qualityHistoryCount = (entry.qualityReportHistory || []).filter(Boolean).length;
                                const hasSecondQualityFromCurrent =
                                  (lotSelectionTs > 0 && qualityCurrentTs >= lotSelectionTs)
                                  || (lotSelectionTs === 0 && qualityHistoryCount >= 2);
                                if (hasSecondQualityFromCurrent) {
                                  qualityAttempts = [
                                    ...qualityAttempts.filter((item) => item.attemptNo !== 2),
                                    {
                                      attemptNo: 2,
                                      reportedBy: qualityData.reportedBy,
                                      createdAt: qualityData.updatedAt || qualityData.createdAt,
                                      moisture: qualityData.moisture,
                                      dryMoisture: qualityData.dryMoisture,
                                      cutting1: qualityData.cutting1,
                                      bend1: qualityData.bend1,
                                      mix: qualityData.mix,
                                      sk: qualityData.sk,
                                      grainsCount: qualityData.grainsCount
                                    }
                                  ].sort((a, b) => (a.attemptNo || 0) - (b.attemptNo || 0));
                                }
                              }
                              const historyReportedNames = (entry.qualityReportHistory || [])
                                .filter(Boolean)
                                .map((name) => String(name).trim());
                              const sampleReportNames = qualityAttempts.length > 0
                                ? qualityAttempts
                                  .sort((a, b) => (a.attemptNo || 0) - (b.attemptNo || 0))
                                  .map((attempt, idx) => String(attempt.reportedBy || historyReportedNames[idx] || qualityData.reportedBy || '').trim())
                                  .filter(Boolean)
                                : (historyReportedNames.length > 0
                                  ? historyReportedNames.map((name) => String(name || qualityData.reportedBy || '').trim()).filter(Boolean)
                                  : (entry.qualityParameters?.reportedBy ? [String(entry.qualityParameters.reportedBy).trim()] : []));
                              const isResamplePendingAdminAssign = entry.lotSelectionDecision === 'FAIL' && !entry.sampleCollectedBy;
                              const cookingHistoryRaw = Array.isArray(entry.cookingReport?.history) ? entry.cookingReport?.history || [] : [];
                              const cookingHistory = [...cookingHistoryRaw].sort((a, b) => toTs(a?.date || '') - toTs(b?.date || ''));
                              const firstAttemptEvents = isResampleCase && lotSelectionTs > 0
                                ? cookingHistory.filter((item) => toTs(item?.date || '') < lotSelectionTs)
                                : cookingHistory;
                              const secondAttemptEvents = isResampleCase && lotSelectionTs > 0
                                ? cookingHistory.filter((item) => toTs(item?.date || '') >= lotSelectionTs)
                                : [];

                              const deriveCookingAttempt = (
                                events: CookingAttemptDetail[],
                                attemptNo: number,
                                fallback?: { status?: string; remarks?: string; updatedAt?: string; createdAt?: string },
                                forcePendingIfEmpty = false
                              ) => {
                                const staffEvents = events.filter((item) => !!item?.cookingDoneBy && !item?.status);
                                const approvedEvents = events.filter((item) => !!item?.status);
                                const lastStaff = staffEvents[staffEvents.length - 1] || null;
                                const lastApproved = approvedEvents[approvedEvents.length - 1] || null;
                                const lastStaffTs = toTs(lastStaff?.date || '');
                                const lastApprovedTs = toTs(lastApproved?.date || fallback?.updatedAt || fallback?.createdAt || '');

                                if (lastStaff && (!lastApproved || lastStaffTs > lastApprovedTs)) {
                                  return { attemptNo, status: 'Pending', remarks: '', date: lastStaff?.date || '' };
                                }
                                if (lastApproved) {
                                  return {
                                    attemptNo,
                                    status: normalizeCookingStatus(lastApproved?.status || undefined),
                                    remarks: lastApproved?.remarks || '',
                                    date: lastApproved?.date || ''
                                  };
                                }
                                if (fallback?.status) {
                                  return {
                                    attemptNo,
                                    status: normalizeCookingStatus(fallback.status),
                                    remarks: fallback.remarks || '',
                                    date: fallback.updatedAt || fallback.createdAt || ''
                                  };
                                }
                                if (forcePendingIfEmpty) {
                                  return { attemptNo, status: 'Pending', remarks: '', date: '' };
                                }
                                return null;
                              };

                              const firstCookingAttempt = deriveCookingAttempt(
                                firstAttemptEvents,
                                1,
                                !isResampleCase ? entry.cookingReport : undefined,
                                !isResampleCase
                              );
                              const secondCookingAttempt = isResampleCase
                                ? deriveCookingAttempt(secondAttemptEvents, 2, undefined, true)
                                : null;
                              const cookingAttempts = [firstCookingAttempt, secondCookingAttempt].filter(Boolean) as Array<{ attemptNo: number; status: string; remarks: string; date: string }>;
                              const cookingMap = new Map<number, { attemptNo: number; status: string; remarks: string; date: string }>();
                              cookingAttempts.forEach((attempt) => cookingMap.set(attempt.attemptNo, attempt));
                              const hasSecondQuality = qualityAttempts.some((attempt) => attempt.attemptNo === 2);
                              const secondCookingStatus = cookingMap.get(2)?.status;
                              const secondCookingResolved = entry.lotSelectionDecision === 'PASS_WITHOUT_COOKING'
                                ? true
                                : !!secondCookingStatus && secondCookingStatus !== 'Pending' && secondCookingStatus !== '-';
                              const resampleComplete = isResampleCase && hasSecondQuality && secondCookingResolved;
                              const isResampleActive = isResampleCase && !resampleComplete;
                              const failedCookingAttempt = [...cookingAttempts]
                                .reverse()
                                .find((attempt) => attempt.status === 'Fail');
                              const failedCookingLabel = failedCookingAttempt
                                ? `Cooking Failed - ${getAttemptLabel(failedCookingAttempt.attemptNo)}`
                                : '';
                              const adjustedAttemptCount = isResampleCase ? 2 : 1;
                              const sc = ({ LOT_ALLOTMENT: { bg: '#e3f2fd', color: '#1565c0' }, PENDING_ALLOTTING_SUPERVISOR: { bg: '#fce4ec', color: '#880e4f' }, PHYSICAL_INSPECTION: { bg: '#ffe0b2', color: '#e65100' }, INVENTORY_ENTRY: { bg: '#e8f5e9', color: '#2e7d32' }, OWNER_FINANCIAL: { bg: '#f3e5f5', color: '#7b1fa2' }, MANAGER_FINANCIAL: { bg: '#e0f7fa', color: '#00695c' }, FINAL_REVIEW: { bg: '#fce4ec', color: '#c62828' } } as any)[entry.workflowStatus] || { bg: '#f5f5f5', color: '#333' };
                              const rowBg = entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff';
                              const typeCode = getEntryTypeCode(entry.entryType);
                              const partyNameText = toTitleCase(entry.partyName || '').trim();
                              const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
                              const partyLabel = entry.entryType === 'DIRECT_LOADED_VEHICLE'
                                ? (lorryText || partyNameText || '-')
                                : (partyNameText || lorryText || '-');
                              const finalRateValue = o.finalBaseRate ?? o.offerBaseRateValue;
                              const finalRateUnit = unitLabel(o.baseRateUnit || 'per_bag');
                              const cellStyle = (missing: boolean): React.CSSProperties => ({ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', background: missing ? '#fff3cd' : rowBg, color: missing ? '#856404' : '#333', fontWeight: missing ? '700' : '400', fontSize: '12px' });

                              if (isRiceMode) {
                                return (
                                  <tr key={entry.id} style={{ background: rowBg }}>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 600, fontSize: '14px' }}>{entry.serialNo || (index + 1)}</td>
                                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', verticalAlign: 'middle' }}>{entry.entryType === 'DIRECT_LOADED_VEHICLE' ? <span style={{ color: 'white', backgroundColor: '#1565c0', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800 }}>RL</span> : entry.entryType === 'LOCATION_SAMPLE' ? <span style={{ color: 'white', backgroundColor: '#e67e22', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800 }}>LS</span> : <span style={{ color: '#333', backgroundColor: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800, border: '1px solid #ccc' }}>MS</span>}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 600, fontSize: '14px' }}>{entry.bags?.toLocaleString('en-IN')}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}>{entry.packaging || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}><div style={{ fontWeight: 600, color: '#1565c0' }}>{partyLabel}</div></td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}>{entry.location || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}>{entry.variety}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}>{finalRateValue ? <div><div style={{ fontWeight: 700, fontSize: '14px', color: '#2c3e50' }}>Rs {finalRateValue}<span style={{ fontSize: '10px', color: '#666' }}>{finalRateUnit}</span></div><div style={{ fontSize: '9px', color: '#888', fontWeight: 500 }}>{o.baseRateType?.replace('_', '/') || ''}</div>{o.egbValue != null && o.egbValue > 0 && <div style={{ fontSize: '9px', color: '#e67e22', fontWeight: 600 }}>EGB: {o.egbValue}</div>}</div> : '-'}</td>
                                    <td style={cellStyle(suteMissing)}>{suteMissing ? 'Need' : fmtVal(o.finalSute ?? o.sute, o.finalSuteUnit ?? o.suteUnit)}</td>
                                    <td style={cellStyle(mstMissing)}>{mstMissing ? 'Need' : (o.moistureValue != null ? `${o.moistureValue}%` : '-')}</td>
                                    <td style={cellStyle(hamaliMissing)}>{hamaliMissing ? 'Need' : (o.hamali || o.hamaliPerKg ? `${o.hamali || o.hamaliPerKg} ${o.hamaliUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : o.hamaliEnabled === false ? 'Pending' : '-')}</td>
                                    <td style={cellStyle(bkrgMissing)}>{bkrgMissing ? 'Need' : (o.brokerage ? `${o.brokerage} ${o.brokerageUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : o.brokerageEnabled === false ? 'Pending' : '-')}</td>
                                    <td style={cellStyle(lfMissing)}>{lfMissing ? 'Need' : (o.lf ? `${o.lf} ${o.lfUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : o.lfEnabled === false ? 'Pending' : '-')}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}><div><span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#d4edda', color: '#155724', whiteSpace: 'nowrap', display: 'inline-block', marginBottom: '2px', border: '1px solid #c3e6cb' }}>Admin Added</span></div><div><span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: needsFill ? '#fff3cd' : '#d4edda', color: needsFill ? '#856404' : '#155724', whiteSpace: 'nowrap', display: 'inline-block', marginBottom: '2px', border: needsFill ? '1px solid #ffeeba' : '1px solid #c3e6cb' }}>{needsFill ? 'Manager Missing' : 'Manager Added'}</span></div><span style={{ padding: '1px 4px', borderRadius: '8px', fontSize: '9px', fontWeight: 600, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>{statusLabel(entry.workflowStatus)}</span></td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{isManagerOrOwner && <button onClick={() => handleUpdateClick(entry)} style={{ padding: '3px 4px', background: needsFill ? '#e67e22' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>{needsFill ? 'Fill Values' : 'View/Edit'}</button>}</td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={entry.id} style={{ background: rowBg }}>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700 }}>{entry.serialNo || (index + 1)}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: '28px', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800, color: typeCode === 'RL' || typeCode === 'LS' ? '#fff' : '#333', backgroundColor: typeCode === 'RL' ? '#1565c0' : typeCode === 'LS' ? '#e67e22' : '#fff', border: typeCode === 'MS' ? '1px solid #ccc' : 'none' }}>{typeCode}</span></td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>{entry.bags?.toLocaleString('en-IN') || '-'}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '13px' }}>{entry.packaging || '-'}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', lineHeight: '1.35', wordBreak: 'break-word' }}><div style={{ fontWeight: 700, color: '#1565c0' }}>{partyLabel}</div></td>
                                  <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', wordBreak: 'break-word' }}>{toTitleCase(entry.location) || '-'}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', wordBreak: 'break-word' }}>{toTitleCase(entry.variety) || '-'}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', lineHeight: '1.35', wordBreak: 'break-word' }}>{renderCollectedByHistory(entry)}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', lineHeight: '1.35', wordBreak: 'break-word' }}>
                                    {sampleReportNames.length === 0 ? '-' : (
                                      <div style={{ lineHeight: '1.35' }}>
                                        {sampleReportNames.map((name, idx) => {
                                          const hasQualityHistory = (entry.qualityAttemptDetails || []).length > 0;
                                          return (
                                            <div
                                              key={`${entry.id}-reported-${idx}`}
                                              style={{
                                                fontWeight: 700,
                                                color: idx === 0 ? '#1f2937' : '#4f83cc',
                                                whiteSpace: 'nowrap',
                                                fontSize: '13px',
                                                cursor: hasQualityHistory ? 'pointer' : 'default',
                                                textDecoration: hasQualityHistory ? 'underline' : 'none'
                                              }}
                                              onClick={() => hasQualityHistory && setQualityHistoryModal({ open: true, entry })}
                                            >
                                              {idx + 1}] {toTitleCase(name)}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'left', fontSize: '10px', lineHeight: '1.2' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      {Array.from({ length: adjustedAttemptCount }, (_, idx) => idx + 1).map((attemptNo) => {
                                        const attempt = qualityAttempts.find((item) => item.attemptNo === attemptNo);
                                        const isLatestAttempt = attemptNo === adjustedAttemptCount;
                                        const stateLabel = attempt ? 'Done' : (isLatestAttempt ? 'Pending' : '-');
                                        const stateStyle = stateLabel === 'Done'
                                          ? { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }
                                          : stateLabel === 'Pending'
                                              ? { background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }
                                              : { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
                                        return (
                                          <div key={`${entry.id}-quality-${attemptNo}`} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                                            <span style={{ fontWeight: 700, color: '#1f2937' }}>{getQualityAttemptLabel(attemptNo)}</span>
                                            <span style={{ ...stateStyle, padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{stateLabel}</span>
                                          </div>
                                        );
                                      })}
                                      {isResamplePendingAdminAssign && (
                                        <div style={{ marginTop: '3px', padding: '5px', background: '#fff8e1', borderRadius: '4px', border: '1px solid #f4d06f' }}>
                                          <div style={{ fontWeight: 800, color: '#8a6400', marginBottom: '3px' }}>Assign Resample User</div>
                                          <select
                                            value={assignments[entry.id] ?? entry.sampleCollectedBy ?? ''}
                                            onChange={(e) => setAssignments(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                            style={{ width: '100%', padding: '3px', fontSize: '10px', border: '1px solid #ccc', borderRadius: '3px', marginBottom: '4px' }}
                                          >
                                            <option value="">Select Staff</option>
                                            {paddySupervisors.map((sup) => <option key={sup.id} value={sup.username}>{sup.username}</option>)}
                                          </select>
                                          <button
                                            onClick={() => handleAssignResample(entry)}
                                            style={{ width: '100%', padding: '3px 6px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                                          >
                                            Assign
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '4px 5px', textAlign: 'left', fontSize: '10px', lineHeight: '1.2' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      {entry.lotSelectionDecision === 'PASS_WITHOUT_COOKING' ? (
                                        <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', alignSelf: 'flex-start' }}>Not Applicable</span>
                                      ) : (
                                        Array.from({ length: adjustedAttemptCount }, (_, idx) => idx + 1).map((attemptNo) => {
                                          const attempt = cookingMap.get(attemptNo);
                                          const statusText = attempt?.status || (attemptNo === adjustedAttemptCount ? 'Pending' : '-');
                                          const statusStyle = statusText === 'Pass'
                                            ? { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }
                                            : statusText === 'Medium'
                                              ? { background: '#ffe0b2', color: '#f39c12', border: '1px solid #ffd699' }
                                            : statusText === 'Fail'
                                              ? { background: '#fce4ec', color: '#c62828', border: '1px solid #f8bbd0' }
                                              : statusText === 'Recheck'
                                                ? { background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }
                                                : statusText === 'Pending'
                                                  ? { background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }
                                                  : { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
                                          return (
                                            <div key={`${entry.id}-cooking-${attemptNo}`}>
                                              <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                                                <span style={{ fontWeight: 700, color: '#1f2937' }}>{getAttemptLabel(attemptNo)}</span>
                                                <span style={{ ...statusStyle, padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{statusText}</span>
                                              </div>
                                              {attempt?.remarks ? (
                                                <div
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRemarksPopup({
                                                      isOpen: true,
                                                      title: `Cooking Remark - ${getAttemptLabel(attemptNo)}`,
                                                      text: attempt.remarks || ''
                                                    });
                                                  }}
                                                  style={{ marginTop: '2px', fontSize: '10px', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700 }}
                                                >
                                                  View Remark
                                                </div>
                                              ) : null}
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'center', fontSize: '13px' }}>{finalRateValue ? <div style={{ fontWeight: 700, color: '#2e7d32', lineHeight: '1.3' }}><div>Rs {toNumberText(finalRateValue)}</div><div style={{ fontSize: '10px', color: '#5f6368', fontWeight: 600 }}>{o.baseRateType?.replace(/_/g, '/') || finalRateUnit}</div></div> : '-'}</td>
                                  <td style={{ ...cellStyle(suteMissing), textAlign: 'center' }}>{suteMissing ? 'Need' : fmtVal(o.finalSute ?? o.sute, o.finalSuteUnit ?? o.suteUnit)}</td>
                                  <td style={{ ...cellStyle(mstMissing), textAlign: 'center' }}>{mstMissing ? 'Need' : (o.moistureValue != null ? `${toNumberText(o.moistureValue)}%` : '-')}</td>
                                  <td style={cellStyle(bkrgMissing)}>{bkrgMissing ? 'Need' : fmtVal(o.brokerage, o.brokerageUnit)}</td>
                                  <td style={cellStyle(lfMissing)}>{hasLf ? (lfMissing ? 'Need' : fmtVal(o.lf, o.lfUnit)) : 'Not Applicable'}</td>
                                  <td style={cellStyle(hamaliMissing)}>{hamaliMissing ? 'Need' : fmtVal(o.hamali || o.hamaliPerKg, o.hamaliUnit)}</td>
                                  <td style={cellStyle(cdMissing)}>
                                    {o.cdEnabled ? `${Math.round(Number(o.cdValue) || 0)} ${o.cdUnit === 'percentage' ? '%' : 'L'}` : '-'}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px' }}>
                                    {hasEgb ? (o.egbType === 'mill' ? 'Mill' : (o.egbValue != null ? toNumberText(o.egbValue) : '-')) : 'Not Applicable'}
                                  </td>
                                  <td style={cellStyle(bankLoanMissing)}>
                                    {o.bankLoanEnabled ? (o.bankLoanUnit === 'per_bag' ? `Rs ${formatIndianCurrency(o.bankLoanValue)} / Bag` : `Rs ${formatIndianCurrency(o.bankLoanValue)}`) : '-'}
                                  </td>
                                  <td style={cellStyle(paymentMissing)}>{formatPaymentCondition(o.paymentConditionValue, o.paymentConditionUnit)}</td>
                                  {false && (<td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', background: '#fffaf0' }}>
                                    {isResampleCase ? (
                                      <div style={{ textAlign: 'left', fontSize: '10px', lineHeight: '1.35', background: '#fff8e1', border: '1px solid #f4d06f', borderRadius: '4px', padding: '4px 5px', color: '#5d4037' }}>
                                        {resampleLabel && (
                                          <div style={{ fontWeight: 800, color: '#8a6400', marginBottom: '2px' }}>{resampleLabel}</div>
                                        )}
                                        {isResamplePendingAdminAssign ? (
                                          <div style={{ marginTop: '4px', padding: '4px', background: '#ffe4e1', borderRadius: '4px', border: '1px solid #ffb6c1' }}>
                                            <div style={{ fontWeight: 800, color: '#c62828', marginBottom: '2px' }}>Action Required:</div>
                                            <div>Allocated to:</div>
                                            <select
                                              value={assignments[entry.id] ?? entry.sampleCollectedBy ?? ''}
                                              onChange={(e) => setAssignments(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                              style={{ padding: '2px', fontSize: '10px', width: '100%', marginBottom: '4px', border: '1px solid #ccc', borderRadius: '2px' }}
                                            >
                                              <option value="">Select Staff</option>
                                              {paddySupervisors.map(sup => <option key={sup.id} value={sup.username}>{sup.username}</option>)}
                                            </select>
                                            <button
                                              onClick={() => handleAssignResample(entry)}
                                              style={{ padding: '3px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '2px', width: '100%', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}
                                            >
                                              Re-assign
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <div><span style={{ fontWeight: 800, color: '#8a6400' }}>Quality:</span> {resampleQualityStatus}</div>
                                            <div><span style={{ fontWeight: 800, color: '#8a6400' }}>Cooking:</span> {resampleCookingStatus}</div>
                                            {isResamplePass && (
                                              <div style={{ marginTop: '2px' }}>
                                                <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }}>
                                                  Re-sample Passed
                                                </span>
                                              </div>
                                            )}
                                            {resampleRemark ? (
                                              <div style={{ marginTop: '4px' }}>
                                                <div
                                                  onClick={(e) => { e.stopPropagation(); setRemarksPopup({ isOpen: true, title: 'Resample Remark', text: resampleRemark }); }}
                                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ffe082', color: '#ff8f00', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', border: '1px solid #ffca28' }}
                                                >
                                                  <span role="img" aria-label="search">🔍</span> Remark
                                                </div>
                                              </div>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700 }}>-</span>
                                    )}
                                  </td>)}
                                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', background: '#fafcff' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch' }}>
                                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#155724', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', padding: '2px 4px' }}>Admin Added</div>
                                      <div style={{ fontSize: '10px', fontWeight: 700, color: needsFill ? '#856404' : '#155724', background: needsFill ? '#fff3cd' : '#d4edda', border: needsFill ? '1px solid #ffeeba' : '1px solid #c3e6cb', borderRadius: '4px', padding: '2px 4px', lineHeight: '1.25' }}>
                                        {needsFill ? `Missing: ${compactStatusText(missingFieldLabels)}` : 'Manager Added'}
                                      </div>
                                      {isResampleActive && (
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#8a6400', background: '#fff8e1', border: '1px solid #f4d06f', borderRadius: '4px', padding: '2px 4px', lineHeight: '1.2' }}>
                                          Re-sample Active
                                        </div>
                                      )}
                                      {failedCookingAttempt && (
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#b71c1c', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '4px', padding: '2px 4px', lineHeight: '1.2' }}>
                                          {failedCookingLabel}
                                        </div>
                                      )}
                                      <div style={{ fontSize: '10px', fontWeight: 800, color: sc.color, background: sc.bg, borderRadius: '4px', padding: '2px 4px', lineHeight: '1.2' }}>
                                        {statusLabel(entry.workflowStatus)}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                      {isManagerOrOwner && (
                                        <button
                                          onClick={() => handleUpdateClick(entry)}
                                          disabled={!hasQualityReport}
                                          style={{
                                            padding: '3px 8px',
                                            background: !hasQualityReport ? '#b0bec5' : (needsFill ? '#e67e22' : '#3498db'),
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            cursor: !hasQualityReport ? 'not-allowed' : 'pointer',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {!hasQualityReport ? 'Quality Pending' : (needsFill ? 'Fill Values' : 'View/Edit')}
                                        </button>
                                      )}
                                      {isAdminOrOwner && (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                          <button
                                            onClick={() => handleOpenOfferEdit(entry)}
                                            style={{ padding: '3px 6px', background: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 700 }}
                                          >
                                            Edit Offer
                                          </button>
                                          <button
                                            onClick={() => handleOpenFinalEdit(entry)}
                                            style={{ padding: '3px 6px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 700 }}
                                          >
                                            Edit Final
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px', alignItems: 'center' }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '6px 12px', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: page <= 1 ? '#f5f5f5' : 'white' }}>Prev</button>
            <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {Math.max(1, totalPages)} ({total} total)</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '6px 12px', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: page >= totalPages ? '#f5f5f5' : 'white' }}>Next</button>
          </div>
        </>
      )}

      {qualityHistoryModal.open && qualityModalEntry && (
        <div
          onClick={() => setQualityHistoryModal({ open: false, entry: null })}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '860px', maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 24px 60px rgba(0,0,0,0.32)', padding: '16px' }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937', marginBottom: '8px' }}>Quality Sampling History</div>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
              Party: <b>{toTitleCase(qualityModalEntry.partyName) || '-'}</b> | Variety: <b>{toTitleCase(qualityModalEntry.variety) || '-'}</b> | Location: <b>{toTitleCase(qualityModalEntry.location) || '-'}</b>
            </div>

            {qualityAttemptDetails.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>No quality attempt history found.</div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #d1d5db', borderRadius: '10px' }}>
                <table style={{ width: '100%', minWidth: `${Math.max(680, 180 + qualityAttemptDetails.length * 160)}px`, borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                      <th style={{ border: '1px solid #1e40af', padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Parameter</th>
                      {qualityAttemptDetails.map((attempt) => (
                        <th key={`${qualityModalEntry.id}-attempt-head-${attempt.attemptNo}`} style={{ border: '1px solid #1e40af', padding: '8px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {getAttemptLabel(attempt.attemptNo)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Reported By', value: (attempt: QualityAttemptDetail) => attempt.reportedBy ? toTitleCase(attempt.reportedBy) : '-' },
                      { label: 'Reported At', value: (attempt: QualityAttemptDetail) => attempt.createdAt ? new Date(attempt.createdAt).toLocaleString('en-IN') : '-' },
                      { label: 'Moisture', value: (attempt: QualityAttemptDetail) => formatAttemptValue(attempt.moisture, '%') },
                      { label: 'Dry Moisture', value: (attempt: QualityAttemptDetail) => formatAttemptValue(attempt.dryMoisture, '%') },
                      { label: 'Cutting', value: (attempt: QualityAttemptDetail) => formatCuttingPair(attempt) },
                      { label: 'Bend', value: (attempt: QualityAttemptDetail) => formatBendPair(attempt) },
                      { label: 'Mix', value: (attempt: QualityAttemptDetail) => formatQualityMix(attempt) },
                      { label: 'Oil/Kandu', value: (attempt: QualityAttemptDetail) => formatOilKandu(attempt) },
                      { label: 'SK', value: (attempt: QualityAttemptDetail) => formatAttemptValue(attempt.sk) },
                      { label: 'Grain', value: (attempt: QualityAttemptDetail) => formatAttemptValue(attempt.grainsCount) },
                      { label: '100 Gms', value: (attempt: QualityAttemptDetail) => formatWBRows(attempt) },
                      { label: 'Paddy WB', value: (attempt: QualityAttemptDetail) => attempt.paddyWb != null && attempt.paddyWb !== '' ? `${toNumberText(attempt.paddyWb)} gms` : '-' },
                      { label: 'Grams', value: (attempt: QualityAttemptDetail) => attempt.gramsReport || '-' }
                    ].filter((row) => qualityAttemptDetails.some((attempt) => isMeaningfulCellValue(row.value(attempt))))
                      .map((row, rowIndex) => (
                      <tr key={`${qualityModalEntry.id}-quality-row-${row.label}`} style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ border: '1px solid #e5e7eb', padding: '7px 8px', fontWeight: 700, color: '#1f2937', whiteSpace: 'nowrap' }}>{row.label}</td>
                        {qualityAttemptDetails.map((attempt) => (
                          <td key={`${qualityModalEntry.id}-quality-row-${row.label}-${attempt.attemptNo}`} style={{ border: '1px solid #e5e7eb', padding: '7px 8px', color: '#111827' }}>
                            {row.value(attempt)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setQualityHistoryModal({ open: false, entry: null })}
                style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#334155', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {remarksPopup.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee', color: '#1f2937', fontSize: '16px' }}>
              <span role="img" aria-label="remark">💬</span> {remarksPopup.title}
            </h3>
            <div style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.5', minHeight: '60px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {remarksPopup.text}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setRemarksPopup({ isOpen: false, title: '', text: '' })}
                style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedEntry && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '14px', borderRadius: '12px', width: '92%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px', fontSize: '16px', textAlign: 'center' }}>{selectedEntry.brokerName}</h3>
            <div style={{ background: '#f8f9fa', padding: '8px 14px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #e0e0e0', textAlign: 'center', fontSize: '12px', color: '#333' }}>
              Bags: <b>{selectedEntry.bags}</b> | Pkg: <b>{selectedEntry.packaging || '75'} Kg</b> | Party: <b>{toTitleCase(selectedEntry.partyName) || (selectedEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? selectedEntry.lorryNumber?.toUpperCase() : '')}</b> | Paddy Location: <b>{selectedEntry.location || '-'}</b> | Variety: <b>{selectedEntry.variety}</b>
            </div>
            <div style={{ marginBottom: '12px', background: modalMissingFields.length > 0 ? '#fff7db' : '#e8f5e9', border: modalMissingFields.length > 0 ? '1px solid #f3d37b' : '1px solid #c8e6c9', borderRadius: '8px', padding: '9px 10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: modalMissingFields.length > 0 ? '#8a6400' : '#2e7d32', marginBottom: '4px' }}>
                {modalMissingFields.length > 0 ? 'Manager Missing Fields' : 'All Values Already Added'}
              </div>
              <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                {modalMissingFields.length > 0 ? modalMissingFields.join('  |  ') : 'This lot already has all manager-side values.'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(2, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div style={modalCardStyle}>
                <span style={modalTagStyle(false)}>Admin Added</span>
                <label style={modalLabelStyle}>Final Rate</label>
                <div style={modalMetaStyle}>{formatRateTypeLabel(modalRateType)} | {unitLabel(modalOffering.baseRateUnit || 'per_bag')}</div>
                <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.finalBaseRate ?? modalOffering.offerBaseRateValue) ? `Rs ${toNumberText(modalOffering.finalBaseRate ?? modalOffering.offerBaseRateValue)}` : '-'}</div>
              </div>
              <div style={modalSuteMissing ? modalEditableCardStyle : modalCardStyle}>
                <span style={modalTagStyle(modalSuteMissing)}>{modalSuteMissing ? 'Manager Add' : 'Admin Added'}</span>
                <label style={modalLabelStyle}>Sute</label>
                <div style={modalMetaStyle}>{formatSuteUnitLabel(managerData.suteUnit || modalOffering.finalSuteUnit || modalOffering.suteUnit)}</div>
                {modalSuteMissing ? (
                  <input type="text" inputMode="decimal" value={managerData.sute} onChange={(e) => setManagerData({ ...managerData, sute: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter sute" />
                ) : (
                  <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.finalSute ?? modalOffering.sute) ? toNumberText(modalOffering.finalSute ?? modalOffering.sute) : 'No'}</div>
                )}
              </div>
              <div style={modalMoistureMissing ? modalEditableCardStyle : modalCardStyle}>
                <span style={modalTagStyle(modalMoistureMissing)}>{modalMoistureMissing ? 'Manager Add' : 'Admin Added'}</span>
                <label style={modalLabelStyle}>Moisture</label>
                <div style={modalMetaStyle}>Percent</div>
                {modalMoistureMissing ? (
                  <input type="text" inputMode="decimal" value={managerData.moistureValue} onChange={(e) => setManagerData({ ...managerData, moistureValue: sanitizeMoistureInput(e.target.value) })} style={modalInputStyle} placeholder="Enter moisture" />
                ) : (
                  <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.moistureValue) ? `${toNumberText(modalOffering.moistureValue)}%` : 'No'}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
              <div style={modalHamaliMissing ? modalEditableCardStyle : modalCardStyle}>
                <span style={modalTagStyle(modalHamaliMissing)}>{modalHamaliMissing ? 'Manager Add' : 'Admin Added'}</span>
                <label style={modalLabelStyle}>Hamali</label>
                <div style={modalMetaStyle}>{modalOffering.hamaliEnabled === false ? 'Pending from manager' : formatChargeUnitLabel(managerData.hamaliUnit || modalOffering.hamaliUnit)}</div>
                {modalHamaliMissing ? (
                  <input type="text" inputMode="decimal" value={managerData.hamali} onChange={(e) => setManagerData({ ...managerData, hamali: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter hamali" />
                ) : (
                  <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.hamali || modalOffering.hamaliPerKg) ? fmtVal(modalOffering.hamali || modalOffering.hamaliPerKg, modalOffering.hamaliUnit) : 'No'}</div>
                )}
              </div>
              <div style={modalBrokerageMissing ? modalEditableCardStyle : modalCardStyle}>
                <span style={modalTagStyle(modalBrokerageMissing)}>{modalBrokerageMissing ? 'Manager Add' : 'Admin Added'}</span>
                <label style={modalLabelStyle}>Brokerage</label>
                <div style={modalMetaStyle}>{modalOffering.brokerageEnabled === false ? 'Pending from manager' : formatChargeUnitLabel(managerData.brokerageUnit || modalOffering.brokerageUnit)}</div>
                {modalBrokerageMissing ? (
                  <input type="text" inputMode="decimal" value={managerData.brokerage} onChange={(e) => setManagerData({ ...managerData, brokerage: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter brokerage" />
                ) : (
                  <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.brokerage) ? fmtVal(modalOffering.brokerage, modalOffering.brokerageUnit) : 'No'}</div>
                )}
              </div>
              <div style={modalHasLf ? (modalLfMissing ? modalEditableCardStyle : modalCardStyle) : modalCardStyle}>
                <span style={modalTagStyle(modalHasLf && modalLfMissing)}>{modalHasLf ? (modalLfMissing ? 'Manager Add' : 'Admin Added') : 'Not Applicable'}</span>
                <label style={modalLabelStyle}>LF</label>
                <div style={modalMetaStyle}>{modalHasLf ? formatChargeUnitLabel(managerData.lfUnit || modalOffering.lfUnit) : 'Not applicable for MD/WB'}</div>
                {modalHasLf ? (
                  modalLfMissing ? (
                    <input type="text" inputMode="decimal" value={managerData.lf} onChange={(e) => setManagerData({ ...managerData, lf: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter LF" />
                  ) : (
                    <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.lf) ? fmtVal(modalOffering.lf, modalOffering.lfUnit) : 'No'}</div>
                  )
                ) : (
                  <div style={modalReadonlyValueStyle}>Not Applicable</div>
                )}
              </div>
            </div>

            {!isRiceMode && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <div style={modalCdMissing ? modalEditableCardStyle : modalCardStyle}>
                  <span style={modalTagStyle(modalCdMissing)}>{modalCdMissing ? 'Manager Add' : 'Admin Added'}</span>
                  <label style={modalLabelStyle}>CD</label>
                  <div style={modalMetaStyle}>{modalOffering.cdEnabled ? formatChargeUnitLabel(managerData.cdUnit || modalOffering.cdUnit) : 'No'}</div>
                  {modalCdMissing ? (
                    <input type="text" inputMode="decimal" value={managerData.cdValue} onChange={(e) => setManagerData({ ...managerData, cdValue: sanitizeAmountInput(e.target.value, 8) })} style={modalInputStyle} placeholder="Enter CD" />
                  ) : (
                    <div style={modalReadonlyValueStyle}>{modalOffering.cdEnabled ? (hasValue(modalOffering.cdValue) ? (modalOffering.cdUnit === 'percentage' ? `${toNumberText(modalOffering.cdValue)} %` : `${toNumberText(modalOffering.cdValue)} Lumps`) : 'Pending') : 'No'}</div>
                  )}
                </div>
                <div style={modalBankLoanMissing ? modalEditableCardStyle : modalCardStyle}>
                  <span style={modalTagStyle(modalBankLoanMissing)}>{modalBankLoanMissing ? 'Manager Add' : 'Admin Added'}</span>
                  <label style={modalLabelStyle}>Bank Loan</label>
                  <div style={modalMetaStyle}>{modalOffering.bankLoanEnabled ? formatChargeUnitLabel(managerData.bankLoanUnit || modalOffering.bankLoanUnit) : 'No'}</div>
                  {modalBankLoanMissing ? (
                    <input type="text" inputMode="decimal" value={managerData.bankLoanValue} onChange={(e) => setManagerData({ ...managerData, bankLoanValue: sanitizeAmountInput(e.target.value, 8) })} style={modalInputStyle} placeholder="Enter bank loan" />
                  ) : (
                    <div style={modalReadonlyValueStyle}>{modalOffering.bankLoanEnabled ? (hasValue(modalOffering.bankLoanValue) ? (modalOffering.bankLoanUnit === 'per_bag' ? `Rs ${formatIndianCurrency(modalOffering.bankLoanValue)} / Bag` : `Rs ${formatIndianCurrency(modalOffering.bankLoanValue)}`) : 'Pending') : 'No'}</div>
                  )}
                </div>
                <div style={modalPaymentMissing ? modalEditableCardStyle : modalCardStyle}>
                  <span style={modalTagStyle(modalPaymentMissing)}>{modalPaymentMissing ? 'Manager Add' : 'Admin Added'}</span>
                  <label style={modalLabelStyle}>Payment Condition</label>
                  <div style={modalMetaStyle}>{managerData.paymentConditionEnabled ? (managerData.paymentConditionUnit === 'month' ? 'Month' : 'Days') : 'No'}</div>
                  {modalPaymentMissing ? (
                    <input type="text" inputMode="numeric" value={managerData.paymentConditionValue} onChange={(e) => setManagerData({ ...managerData, paymentConditionValue: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} style={modalInputStyle} placeholder="Enter payment" />
                  ) : (
                    <div style={modalReadonlyValueStyle}>{managerData.paymentConditionEnabled ? formatPaymentCondition(modalOffering.paymentConditionValue ?? managerData.paymentConditionValue, managerData.paymentConditionUnit) : 'No'}</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={modalHasEgb && modalEgbMissing ? modalEditableCardStyle : modalCardStyle}>
                <span style={modalTagStyle(modalHasEgb && modalEgbMissing)}>{modalHasEgb ? (modalEgbMissing ? 'Manager Add' : 'Admin Added') : 'Not Applicable'}</span>
                <label style={modalLabelStyle}>EGB</label>
                <div style={modalMetaStyle}>
                  {!modalHasEgb
                    ? 'Not applicable for WB types'
                    : modalOffering.egbType === 'purchase'
                      ? 'Purchase'
                      : 'Mill'}
                </div>
                {!modalHasEgb ? (
                  <div style={modalReadonlyValueStyle}>Not Applicable</div>
                ) : modalOffering.egbType === 'purchase' && modalEgbMissing ? (
                  <input type="text" inputMode="decimal" value={managerData.egbValue} onChange={(e) => setManagerData({ ...managerData, egbValue: sanitizeAmountInput(e.target.value), egbType: 'purchase' })} style={modalInputStyle} placeholder="Enter EGB" />
                ) : (
                  <div style={modalReadonlyValueStyle}>
                    {modalOffering.egbType === 'mill'
                      ? '0 (Mill ledger)'
                      : hasValue(modalOffering.egbValue)
                        ? toNumberText(modalOffering.egbValue)
                        : 'Pending'}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowModal(false)} disabled={isSubmitting} style={{ padding: '8px 16px', borderRadius: '6px', background: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSaveValues} disabled={isSubmitting} style={{ padding: '8px 24px', border: 'none', borderRadius: '6px', background: isSubmitting ? '#95a5a6' : 'linear-gradient(135deg, #27ae60, #2ecc71)', color: 'white', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '13px' }}>{isSubmitting ? 'Saving...' : 'Save Values'}</button>
            </div>
          </div>
        </div>
      )}

      {showOfferEditModal && selectedEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '14px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '10px' }}>Edit Offer Rate</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <select
                value={offerEditData.baseRateType}
                onChange={(e) => setOfferEditData({ ...offerEditData, baseRateType: e.target.value })}
                style={{ flex: '0 0 120px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
              >
                <option value="PD_LOOSE">PD/Loose</option>
                <option value="PD_WB">PD/WB</option>
                <option value="MD_WB">MD/WB</option>
                <option value="MD_LOOSE">MD/Loose</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={offerEditData.offerBaseRateValue}
                onChange={(e) => setOfferEditData({ ...offerEditData, offerBaseRateValue: sanitizeAmountInput(e.target.value) })}
                placeholder="Offer Rate"
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="radio" name="offerEditUnit" checked={offerEditData.baseRateUnit === 'per_bag'} onChange={() => setOfferEditData({ ...offerEditData, baseRateUnit: 'per_bag' })} />
                Per Bag
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="radio" name="offerEditUnit" checked={offerEditData.baseRateUnit === 'per_quintal'} onChange={() => setOfferEditData({ ...offerEditData, baseRateUnit: 'per_quintal' })} />
                Per Qtl
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="radio" name="offerEditUnit" checked={offerEditData.baseRateUnit === 'per_kg'} onChange={() => setOfferEditData({ ...offerEditData, baseRateUnit: 'per_kg' })} />
                Per Kg
              </label>
            </div>
            {offerEditData.baseRateUnit === 'per_kg' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '11px' }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>Custom Divisor</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={offerEditData.customDivisor}
                  onChange={(e) => setOfferEditData({ ...offerEditData, customDivisor: sanitizeAmountInput(e.target.value) })}
                  style={{ flex: '0 0 120px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                  placeholder="Divisor"
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Sute</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={offerEditData.sute}
                  onChange={(e) => setOfferEditData({ ...offerEditData, sute: sanitizeAmountInput(e.target.value) })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                  placeholder="Sute"
                />
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="radio" name="offerEditSuteUnit" checked={offerEditData.suteUnit === 'per_bag'} onChange={() => setOfferEditData({ ...offerEditData, suteUnit: 'per_bag' })} />
                    Per Bag
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="radio" name="offerEditSuteUnit" checked={offerEditData.suteUnit === 'per_ton'} onChange={() => setOfferEditData({ ...offerEditData, suteUnit: 'per_ton' })} />
                    Per Ton
                  </label>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Moisture (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={offerEditData.moistureValue}
                  onChange={(e) => setOfferEditData({ ...offerEditData, moistureValue: sanitizeMoistureInput(e.target.value) })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                  placeholder="Moisture"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Hamali</label>
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                  <label><input type="radio" name="offerEditHamali" checked={offerEditData.hamaliEnabled} onChange={() => setOfferEditData({ ...offerEditData, hamaliEnabled: true })} /> Yes</label>
                  <label><input type="radio" name="offerEditHamali" checked={!offerEditData.hamaliEnabled} onChange={() => setOfferEditData({ ...offerEditData, hamaliEnabled: false, hamaliValue: '' })} /> No</label>
                </div>
                {offerEditData.hamaliEnabled && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" inputMode="decimal" value={offerEditData.hamaliValue} onChange={(e) => setOfferEditData({ ...offerEditData, hamaliValue: sanitizeAmountInput(e.target.value) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                    <select value={offerEditData.hamaliUnit} onChange={(e) => setOfferEditData({ ...offerEditData, hamaliUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                      <option value="per_bag">Per Bag</option>
                      <option value="per_quintal">Per Qtl</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Brokerage</label>
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                  <label><input type="radio" name="offerEditBrokerage" checked={offerEditData.brokerageEnabled} onChange={() => setOfferEditData({ ...offerEditData, brokerageEnabled: true })} /> Yes</label>
                  <label><input type="radio" name="offerEditBrokerage" checked={!offerEditData.brokerageEnabled} onChange={() => setOfferEditData({ ...offerEditData, brokerageEnabled: false, brokerageValue: '' })} /> No</label>
                </div>
                {offerEditData.brokerageEnabled && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" inputMode="decimal" value={offerEditData.brokerageValue} onChange={(e) => setOfferEditData({ ...offerEditData, brokerageValue: sanitizeAmountInput(e.target.value) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                    <select value={offerEditData.brokerageUnit} onChange={(e) => setOfferEditData({ ...offerEditData, brokerageUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                      <option value="per_bag">Per Bag</option>
                      <option value="per_quintal">Per Qtl</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>LF</label>
                {hasLfForRateType(offerEditData.baseRateType) ? (
                  <>
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                      <label><input type="radio" name="offerEditLf" checked={offerEditData.lfEnabled} onChange={() => setOfferEditData({ ...offerEditData, lfEnabled: true })} /> Yes</label>
                      <label><input type="radio" name="offerEditLf" checked={!offerEditData.lfEnabled} onChange={() => setOfferEditData({ ...offerEditData, lfEnabled: false, lfValue: '' })} /> No</label>
                    </div>
                    {offerEditData.lfEnabled && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="text" inputMode="decimal" value={offerEditData.lfValue} onChange={(e) => setOfferEditData({ ...offerEditData, lfValue: sanitizeAmountInput(e.target.value) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                        <select value={offerEditData.lfUnit} onChange={(e) => setOfferEditData({ ...offerEditData, lfUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94a3b8', padding: '6px 0' }}>Not Applicable</div>
                )}
              </div>
            </div>

            {!isRiceMode && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>CD</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <label><input type="radio" name="offerEditCd" checked={offerEditData.cdEnabled} onChange={() => setOfferEditData({ ...offerEditData, cdEnabled: true })} /> Yes</label>
                    <label><input type="radio" name="offerEditCd" checked={!offerEditData.cdEnabled} onChange={() => setOfferEditData({ ...offerEditData, cdEnabled: false, cdValue: '' })} /> No</label>
                  </div>
                  {offerEditData.cdEnabled && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" inputMode="decimal" value={offerEditData.cdValue} onChange={(e) => setOfferEditData({ ...offerEditData, cdValue: sanitizeAmountInput(e.target.value, 8) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="CD" />
                      <select value={offerEditData.cdUnit} onChange={(e) => setOfferEditData({ ...offerEditData, cdUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="lumps">Lumps</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Bank Loan</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <label><input type="radio" name="offerEditBankLoan" checked={offerEditData.bankLoanEnabled} onChange={() => setOfferEditData({ ...offerEditData, bankLoanEnabled: true })} /> Yes</label>
                    <label><input type="radio" name="offerEditBankLoan" checked={!offerEditData.bankLoanEnabled} onChange={() => setOfferEditData({ ...offerEditData, bankLoanEnabled: false, bankLoanValue: '' })} /> No</label>
                  </div>
                  {offerEditData.bankLoanEnabled && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" inputMode="decimal" value={offerEditData.bankLoanValue} onChange={(e) => setOfferEditData({ ...offerEditData, bankLoanValue: sanitizeAmountInput(e.target.value, 8) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                      <select value={offerEditData.bankLoanUnit} onChange={(e) => setOfferEditData({ ...offerEditData, bankLoanUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="lumps">Lumps</option>
                        <option value="per_bag">Per Bag</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Payment</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <label><input type="radio" name="offerEditPayment" checked={offerEditData.paymentConditionEnabled} onChange={() => setOfferEditData({ ...offerEditData, paymentConditionEnabled: true, paymentConditionValue: offerEditData.paymentConditionValue || '15' })} /> Yes</label>
                    <label><input type="radio" name="offerEditPayment" checked={!offerEditData.paymentConditionEnabled} onChange={() => setOfferEditData({ ...offerEditData, paymentConditionEnabled: false, paymentConditionValue: '15' })} /> No</label>
                  </div>
                  {offerEditData.paymentConditionEnabled && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" inputMode="numeric" value={offerEditData.paymentConditionValue} onChange={(e) => setOfferEditData({ ...offerEditData, paymentConditionValue: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Days" />
                      <select value={offerEditData.paymentConditionUnit} onChange={(e) => setOfferEditData({ ...offerEditData, paymentConditionUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="days">Days</option>
                        <option value="month">Month</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasEgbForRateType(offerEditData.baseRateType) && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>EGB</label>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '4px' }}>
                  <label><input type="radio" name="offerEditEgb" checked={offerEditData.egbType === 'mill'} onChange={() => setOfferEditData({ ...offerEditData, egbType: 'mill', egbValue: '0' })} /> Mill</label>
                  <label><input type="radio" name="offerEditEgb" checked={offerEditData.egbType === 'purchase'} onChange={() => setOfferEditData({ ...offerEditData, egbType: 'purchase' })} /> Purchase</label>
                </div>
                {offerEditData.egbType === 'purchase' && (
                  <input type="text" inputMode="decimal" value={offerEditData.egbValue} onChange={(e) => setOfferEditData({ ...offerEditData, egbValue: sanitizeAmountInput(e.target.value) })} style={{ width: '160px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="EGB value" />
                )}
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Remarks</label>
              <textarea
                value={offerEditData.remarks}
                onChange={(e) => setOfferEditData({ ...offerEditData, remarks: e.target.value })}
                rows={2}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowOfferEditModal(false)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveOfferEdit} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', background: '#2196F3', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Save Offer</button>
            </div>
          </div>
        </div>
      )}

      {showFinalEditModal && selectedEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '14px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '10px' }}>Edit Final Rate</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Final Rate</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={finalEditData.finalBaseRate}
                  onChange={(e) => setFinalEditData({ ...finalEditData, finalBaseRate: sanitizeAmountInput(e.target.value) })}
                  placeholder="Final Rate"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Rate Unit</label>
                <select
                  value={finalEditData.baseRateUnit}
                  onChange={(e) => setFinalEditData({ ...finalEditData, baseRateUnit: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                >
                  <option value="per_bag">Per Bag</option>
                  <option value="per_quintal">Per Qtl</option>
                  <option value="per_kg">Per Kg</option>
                  <option value="per_ton">Per Ton</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Final Price</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={finalEditData.finalPrice}
                  onChange={(e) => setFinalEditData({ ...finalEditData, finalPrice: sanitizeAmountInput(e.target.value) })}
                  placeholder="Final Price"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Final Sute</label>
                <input type="text" inputMode="decimal" value={finalEditData.finalSute} onChange={(e) => setFinalEditData({ ...finalEditData, finalSute: sanitizeAmountInput(e.target.value) })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Sute" />
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginTop: '4px' }}>
                  <label><input type="radio" name="finalEditSuteUnit" checked={finalEditData.finalSuteUnit === 'per_bag'} onChange={() => setFinalEditData({ ...finalEditData, finalSuteUnit: 'per_bag' })} /> Per Bag</label>
                  <label><input type="radio" name="finalEditSuteUnit" checked={finalEditData.finalSuteUnit === 'per_ton'} onChange={() => setFinalEditData({ ...finalEditData, finalSuteUnit: 'per_ton' })} /> Per Ton</label>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Moisture (%)</label>
                <input type="text" inputMode="decimal" value={finalEditData.moistureValue} onChange={(e) => setFinalEditData({ ...finalEditData, moistureValue: sanitizeMoistureInput(e.target.value) })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Moisture" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Hamali</label>
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                  <label><input type="radio" name="finalEditHamali" checked={finalEditData.hamaliEnabled} onChange={() => setFinalEditData({ ...finalEditData, hamaliEnabled: true })} /> Yes</label>
                  <label><input type="radio" name="finalEditHamali" checked={!finalEditData.hamaliEnabled} onChange={() => setFinalEditData({ ...finalEditData, hamaliEnabled: false, hamali: '' })} /> No</label>
                </div>
                {finalEditData.hamaliEnabled && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" inputMode="decimal" value={finalEditData.hamali} onChange={(e) => setFinalEditData({ ...finalEditData, hamali: sanitizeAmountInput(e.target.value) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                    <select value={finalEditData.hamaliUnit} onChange={(e) => setFinalEditData({ ...finalEditData, hamaliUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                      <option value="per_bag">Per Bag</option>
                      <option value="per_quintal">Per Qtl</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Brokerage</label>
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                  <label><input type="radio" name="finalEditBrokerage" checked={finalEditData.brokerageEnabled} onChange={() => setFinalEditData({ ...finalEditData, brokerageEnabled: true })} /> Yes</label>
                  <label><input type="radio" name="finalEditBrokerage" checked={!finalEditData.brokerageEnabled} onChange={() => setFinalEditData({ ...finalEditData, brokerageEnabled: false, brokerage: '' })} /> No</label>
                </div>
                {finalEditData.brokerageEnabled && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" inputMode="decimal" value={finalEditData.brokerage} onChange={(e) => setFinalEditData({ ...finalEditData, brokerage: sanitizeAmountInput(e.target.value) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                    <select value={finalEditData.brokerageUnit} onChange={(e) => setFinalEditData({ ...finalEditData, brokerageUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                      <option value="per_bag">Per Bag</option>
                      <option value="per_quintal">Per Qtl</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>LF</label>
                {hasLfForRateType(selectedEntry?.offering?.baseRateType || 'PD_LOOSE') ? (
                  <>
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                      <label><input type="radio" name="finalEditLf" checked={finalEditData.lfEnabled} onChange={() => setFinalEditData({ ...finalEditData, lfEnabled: true })} /> Yes</label>
                      <label><input type="radio" name="finalEditLf" checked={!finalEditData.lfEnabled} onChange={() => setFinalEditData({ ...finalEditData, lfEnabled: false, lf: '' })} /> No</label>
                    </div>
                    {finalEditData.lfEnabled && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="text" inputMode="decimal" value={finalEditData.lf} onChange={(e) => setFinalEditData({ ...finalEditData, lf: sanitizeAmountInput(e.target.value) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                        <select value={finalEditData.lfUnit} onChange={(e) => setFinalEditData({ ...finalEditData, lfUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94a3b8', padding: '6px 0' }}>Not Applicable</div>
                )}
              </div>
            </div>

            {!isRiceMode && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>CD</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <label><input type="radio" name="finalEditCd" checked={finalEditData.cdEnabled} onChange={() => setFinalEditData({ ...finalEditData, cdEnabled: true })} /> Yes</label>
                    <label><input type="radio" name="finalEditCd" checked={!finalEditData.cdEnabled} onChange={() => setFinalEditData({ ...finalEditData, cdEnabled: false, cdValue: '' })} /> No</label>
                  </div>
                  {finalEditData.cdEnabled && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" inputMode="decimal" value={finalEditData.cdValue} onChange={(e) => setFinalEditData({ ...finalEditData, cdValue: sanitizeAmountInput(e.target.value, 8) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="CD" />
                      <select value={finalEditData.cdUnit} onChange={(e) => setFinalEditData({ ...finalEditData, cdUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="lumps">Lumps</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Bank Loan</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <label><input type="radio" name="finalEditBankLoan" checked={finalEditData.bankLoanEnabled} onChange={() => setFinalEditData({ ...finalEditData, bankLoanEnabled: true })} /> Yes</label>
                    <label><input type="radio" name="finalEditBankLoan" checked={!finalEditData.bankLoanEnabled} onChange={() => setFinalEditData({ ...finalEditData, bankLoanEnabled: false, bankLoanValue: '' })} /> No</label>
                  </div>
                  {finalEditData.bankLoanEnabled && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" inputMode="decimal" value={finalEditData.bankLoanValue} onChange={(e) => setFinalEditData({ ...finalEditData, bankLoanValue: sanitizeAmountInput(e.target.value, 8) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Amount" />
                      <select value={finalEditData.bankLoanUnit} onChange={(e) => setFinalEditData({ ...finalEditData, bankLoanUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="lumps">Lumps</option>
                        <option value="per_bag">Per Bag</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Payment</label>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '4px' }}>
                    <label><input type="radio" name="finalEditPayment" checked={finalEditData.paymentConditionEnabled} onChange={() => setFinalEditData({ ...finalEditData, paymentConditionEnabled: true, paymentConditionValue: finalEditData.paymentConditionValue || '15' })} /> Yes</label>
                    <label><input type="radio" name="finalEditPayment" checked={!finalEditData.paymentConditionEnabled} onChange={() => setFinalEditData({ ...finalEditData, paymentConditionEnabled: false, paymentConditionValue: '15' })} /> No</label>
                  </div>
                  {finalEditData.paymentConditionEnabled && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input type="text" inputMode="numeric" value={finalEditData.paymentConditionValue} onChange={(e) => setFinalEditData({ ...finalEditData, paymentConditionValue: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="Days" />
                      <select value={finalEditData.paymentConditionUnit} onChange={(e) => setFinalEditData({ ...finalEditData, paymentConditionUnit: e.target.value })} style={{ width: '90px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}>
                        <option value="days">Days</option>
                        <option value="month">Month</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasEgbForRateType(selectedEntry?.offering?.baseRateType || 'PD_LOOSE') && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>EGB</label>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginBottom: '4px' }}>
                  <label><input type="radio" name="finalEditEgb" checked={finalEditData.egbType === 'mill'} onChange={() => setFinalEditData({ ...finalEditData, egbType: 'mill', egbValue: '' })} /> Mill</label>
                  <label><input type="radio" name="finalEditEgb" checked={finalEditData.egbType === 'purchase'} onChange={() => setFinalEditData({ ...finalEditData, egbType: 'purchase' })} /> Purchase</label>
                </div>
                {finalEditData.egbType === 'purchase' && (
                  <input type="text" inputMode="decimal" value={finalEditData.egbValue} onChange={(e) => setFinalEditData({ ...finalEditData, egbValue: sanitizeAmountInput(e.target.value) })} style={{ width: '160px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }} placeholder="EGB value" />
                )}
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#1f2937', marginBottom: '4px', display: 'block' }}>Remarks</label>
              <textarea
                value={finalEditData.remarks}
                onChange={(e) => setFinalEditData({ ...finalEditData, remarks: e.target.value })}
                rows={2}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowFinalEditModal(false)} style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveFinalEdit} style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', background: '#27ae60', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Save Final</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoadingLots;
