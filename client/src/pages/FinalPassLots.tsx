import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  serialNo?: number;
  entryDate: string;
  createdAt?: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  packaging?: string;
  workflowStatus: string;
  lotSelectionDecision?: string;
  entryType?: string;
  sampleCollectedBy?: string;
  offeringPrice?: number;
  lorryNumber?: string;
  offering?: any;
  priceType?: string;
  suit?: string;
  offerBaseRate?: string;
  perUnit?: string;
  hamali?: boolean;
  brokerage?: number;
  lf?: number;
  egb?: number;
  customDivisor?: number;
  finalPrice?: number;
  qualityParameters?: any;
  cookingReport?: any;
  creator?: { id: number; username: string };
  qualityReportAttempts?: number;
}

interface OfferingData {
  offerRate: string;
  sute: string;
  suteUnit: string;
  baseRateType: string;
  baseRateUnit: string;
  offerBaseRateValue: string;
  hamaliEnabled: boolean;
  hamaliValue: string;
  hamaliUnit: string;
  moistureValue: string;
  brokerageValue: string;
  brokerageEnabled: boolean;
  brokerageUnit: string;
  lfValue: string;
  lfEnabled: boolean;
  lfUnit: string;
  egbValue: string;
  egbType: 'mill' | 'purchase';
  customDivisor: string;
  cdEnabled: boolean;
  cdValue: string;
  cdUnit: 'lumps' | 'percentage';
  bankLoanEnabled: boolean;
  bankLoanValue: string;
  bankLoanUnit: 'per_bag' | 'lumps';
  paymentConditionEnabled: boolean;
  paymentConditionValue: string;
  paymentConditionUnit: 'days' | 'month';
  remarks: string;
}

interface FinalPriceFormData {
  finalSute: string;
  finalSuteUnit: string;
  finalBaseRate: string;
  baseRateType: string;
  baseRateUnit: string;
  suteEnabled: boolean;
  moistureEnabled: boolean;
  hamaliEnabled: boolean;
  brokerageEnabled: boolean;
  lfEnabled: boolean;
  moistureValue: string;
  hamali: string;
  hamaliUnit: string;
  brokerage: string;
  brokerageUnit: string;
  lf: string;
  lfUnit: string;
  egbValue: string;
  egbType: 'mill' | 'purchase';
  customDivisor: string;
  cdEnabled: boolean;
  cdValue: string;
  cdUnit: 'lumps' | 'percentage';
  bankLoanEnabled: boolean;
  bankLoanValue: string;
  bankLoanUnit: 'per_bag' | 'lumps';
  paymentConditionEnabled: boolean;
  paymentConditionValue: string;
  paymentConditionUnit: 'days' | 'month';
  finalPrice: string;
  remarks: string;
}

type OfferSlotKey = 'offer1' | 'offer2' | 'offer3';

interface OfferVersionData {
  key: OfferSlotKey;
  label?: string;
  offerBaseRateValue?: number | string;
  baseRateType?: string;
  baseRateUnit?: string;
  sute?: number | string;
  suteUnit?: string;
  hamaliEnabled?: boolean;
  hamali?: number | string;
  hamaliUnit?: string;
  moistureValue?: number | string;
  brokerageEnabled?: boolean;
  brokerage?: number | string;
  brokerageUnit?: string;
  lfEnabled?: boolean;
  lf?: number | string;
  lfUnit?: string;
  egbType?: 'mill' | 'purchase';
  egbValue?: number | string;
  customDivisor?: number | string | null;
  cdEnabled?: boolean;
  cdValue?: number | string;
  cdUnit?: 'lumps' | 'percentage';
  bankLoanEnabled?: boolean;
  bankLoanValue?: number | string;
  bankLoanUnit?: 'per_bag' | 'lumps';
  paymentConditionEnabled?: boolean;
  paymentConditionValue?: number | string;
  paymentConditionUnit?: 'days' | 'month';
  remarks?: string;
  updatedAt?: string;
}

// Shared styles
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '4px', fontWeight: '600', color: '#333', fontSize: '12px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box', backgroundColor: '#fff' };
const radioLabelStyle: React.CSSProperties = { fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' };

const headerCellStyle: React.CSSProperties = { padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' };
const dataCellStyle: React.CSSProperties = { padding: '6px', fontSize: '11px', whiteSpace: 'nowrap' };
const compactModalGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', marginBottom: '6px' };
const compactSplitInputStyle: React.CSSProperties = { display: 'flex', gap: '4px', flexWrap: 'wrap' };
const compactNarrowFieldStyle: React.CSSProperties = { maxWidth: '150px' };
const compactMiniFieldStyle: React.CSSProperties = { maxWidth: '132px' };

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
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
    ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '-';
};
const toPercentText = (value: any, digits = 2) => {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(digits).replace(/\.00$/, '')}%` : '-';
};
const formatRateTypeLabel = (value?: string) => String(value || '').replace(/_/g, '/');
const formatRateUnitLabel = (value?: string) => value === 'per_quintal'
  ? 'Per Quintal'
  : value === 'per_kg'
    ? 'Per Kg'
    : value === 'per_ton'
      ? 'Per Ton'
      : 'Per Bag';
const formatChargeUnitLabel = (value?: string) => value === 'per_quintal'
  ? 'Per Qtl'
  : value === 'percentage'
    ? 'Percent'
    : value === 'lumps'
      ? 'Lumps'
      : value === 'per_bag'
        ? 'Per Bag'
        : 'Per Bag';
const sanitizeMoistureInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [integerPartRaw, ...rest] = cleaned.split('.');
  const integerPart = integerPartRaw.slice(0, 2);
  const hasTrailingDot = cleaned.endsWith('.') && rest.length === 1 && rest[0] === '';

  if (rest.length === 0) {
    return integerPart;
  }

  const decimalPart = rest.join('').slice(0, 2);
  if (decimalPart) {
    return `${integerPart}.${decimalPart}`.slice(0, 5);
  }

  return hasTrailingDot ? `${integerPart}.` : integerPart;
};
const sanitizeAmountInput = (value: string, integerDigits = 5, decimalDigits = 2) => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [integerPartRaw, ...rest] = cleaned.split('.');
  const integerPart = integerPartRaw.slice(0, integerDigits);
  const hasTrailingDot = cleaned.endsWith('.') && rest.length === 1 && rest[0] === '';

  if (rest.length === 0) {
    return integerPart;
  }

  const decimalPart = rest.join('').slice(0, decimalDigits);
  if (decimalPart) {
    return `${integerPart}.${decimalPart}`;
  }

  return hasTrailingDot ? `${integerPart}.` : integerPart;
};
const sanitizeIntegerInput = (value: string, maxDigits = 5) => value.replace(/\D/g, '').slice(0, maxDigits);
const toOptionalInputValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isFinite(num) && num === 0) return '';
  return String(value);
};
const parseOptionalNumber = (value: string) => value === '' ? null : parseFloat(value);
const cookingStatusLabel = (status?: string) => {
  const key = (status || '').toUpperCase();
  if (key === 'PASS') return 'Pass';
  if (key === 'MEDIUM') return 'Medium';
  if (key === 'RECHECK') return 'Recheck';
  if (key === 'FAIL') return 'Fail';
  return '-';
};
const OFFER_KEYS: OfferSlotKey[] = ['offer1', 'offer2', 'offer3'];
const getOfferLabel = (key: OfferSlotKey) => key === 'offer1' ? 'Offer 1' : key === 'offer2' ? 'Offer 2' : 'Offer 3';
const DEFAULT_PADDY_OFFER: OfferingData = {
  offerRate: '',
  sute: '',
  suteUnit: 'per_bag',
  baseRateType: 'PD_LOOSE',
  baseRateUnit: 'per_bag',
  offerBaseRateValue: '',
  hamaliEnabled: false,
  hamaliValue: '',
  hamaliUnit: 'per_bag',
  moistureValue: '',
  brokerageValue: '',
  brokerageEnabled: false,
  brokerageUnit: 'per_bag',
  lfValue: '',
  lfEnabled: false,
  lfUnit: 'per_bag',
  egbValue: '0',
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
  remarks: ''
};
const DEFAULT_FINAL_DATA: FinalPriceFormData = {
  finalSute: '',
  finalSuteUnit: 'per_ton',
  finalBaseRate: '',
  baseRateType: 'PD_LOOSE',
  baseRateUnit: 'per_bag',
  suteEnabled: false,
  moistureEnabled: false,
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
  egbValue: '0',
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
};
const normalizeOfferVersions = (offering: any): OfferVersionData[] => {
  if (!offering?.offerVersions || !Array.isArray(offering.offerVersions)) return [];
  return offering.offerVersions
    .filter((offer: any) => OFFER_KEYS.includes(offer?.key))
    .sort((left: any, right: any) => {
      const leftIndex = OFFER_KEYS.indexOf(left.key);
      const rightIndex = OFFER_KEYS.indexOf(right.key);
      return leftIndex - rightIndex;
    });
};
const getLatestOffer = (offering: any): OfferVersionData | null => {
  const versions = normalizeOfferVersions(offering);
  if (!versions.length) return null;
  return [...versions].sort((left: any, right: any) => {
    const leftTime = new Date(left.updatedAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || 0).getTime();
    if (leftTime !== rightTime) return rightTime - leftTime;
    return OFFER_KEYS.indexOf(right.key) - OFFER_KEYS.indexOf(left.key);
  })[0];
};
const getActiveOffer = (offering: any): OfferVersionData | null => {
  const versions = normalizeOfferVersions(offering);
  if (!versions.length) return null;
  return versions.find((offer) => offer.key === offering?.activeOfferKey) || getLatestOffer(offering);
};
const LF_RATE_TYPES = new Set(['PD_LOOSE', 'MD_LOOSE', 'PD_WB']);
const EGB_RATE_TYPES = new Set(['PD_LOOSE', 'MD_LOOSE']);
const hasLfForRateType = (value?: string) => LF_RATE_TYPES.has(String(value || '').toUpperCase());
const hasEgbForRateType = (value?: string) => EGB_RATE_TYPES.has(String(value || '').toUpperCase());
const buildOfferFormData = (offer?: Partial<OfferVersionData> | null): OfferingData => ({
  ...DEFAULT_PADDY_OFFER,
  offerRate: offer?.offerBaseRateValue?.toString() || '',
  offerBaseRateValue: offer?.offerBaseRateValue?.toString() || '',
  sute: offer?.sute?.toString() || '',
  suteUnit: offer?.suteUnit || 'per_bag',
  baseRateType: offer?.baseRateType || 'PD_LOOSE',
  baseRateUnit: offer?.baseRateUnit || 'per_bag',
  hamaliEnabled: !!offer?.hamaliEnabled,
  hamaliValue: toOptionalInputValue(offer?.hamali),
  hamaliUnit: offer?.hamaliUnit || 'per_bag',
  moistureValue: offer?.moistureValue?.toString() || '',
  brokerageEnabled: !!offer?.brokerageEnabled,
  brokerageValue: toOptionalInputValue(offer?.brokerage),
  brokerageUnit: offer?.brokerageUnit || 'per_bag',
  lfEnabled: !!offer?.lfEnabled,
  lfValue: toOptionalInputValue(offer?.lf),
  lfUnit: offer?.lfUnit || 'per_bag',
  egbType: offer?.egbType || 'mill',
  egbValue: offer?.egbType === 'purchase' ? offer?.egbValue?.toString() || '' : '0',
  customDivisor: offer?.customDivisor?.toString() || '',
  cdEnabled: !!offer?.cdEnabled,
  cdValue: toOptionalInputValue(offer?.cdValue),
  cdUnit: offer?.cdUnit || 'lumps',
  bankLoanEnabled: !!offer?.bankLoanEnabled,
  bankLoanValue: toOptionalInputValue(offer?.bankLoanValue),
  bankLoanUnit: offer?.bankLoanUnit || 'lumps',
  paymentConditionEnabled: offer?.paymentConditionEnabled != null
    ? !!offer.paymentConditionEnabled
    : true,
  paymentConditionValue: offer?.paymentConditionValue?.toString() || '15',
  paymentConditionUnit: offer?.paymentConditionUnit || 'days',
  remarks: offer?.remarks || ''
});
const formatOfferBadge = (offering: any) => {
  const latestOffer = getLatestOffer(offering);
  const versions = normalizeOfferVersions(offering);
  if (!latestOffer?.offerBaseRateValue) return 'Add Offer';
  const icon = versions.length > 1 ? ' 👀' : '';
  return `Rs ${toNumberText(latestOffer.offerBaseRateValue)}${icon}`;
};

interface FinalPassLotsProps {
  entryType?: string;
  excludeEntryType?: string;
}

const FinalPassLots: React.FC<FinalPassLotsProps> = ({ entryType, excludeEntryType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showFinalPriceModal, setShowFinalPriceModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [remarksPopup, setRemarksPopup] = useState<{ isOpen: boolean; title: string; text: string }>({ isOpen: false, title: '', text: '' });
  const [offeringCache, setOfferingCache] = useState<{ [key: string]: any }>({});
  const isAdmin = (user?.role as string) === 'admin' || (user?.role as string) === 'owner';
  const isManager = user?.role === 'manager';
  const isRiceMode = entryType === 'RICE_SAMPLE';
  const tableMinWidth = isRiceMode ? '100%' : '1800px';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offerVersions, setOfferVersions] = useState<OfferVersionData[]>([]);
  const [currentOfferKey, setCurrentOfferKey] = useState<OfferSlotKey>('offer1');
  const [activeOfferKey, setActiveOfferKey] = useState<OfferSlotKey>('offer1');
  const submissionLocksRef = useRef<Set<string>>(new Set());

  const acquireSubmissionLock = (key: string) => {
    if (submissionLocksRef.current.has(key)) return false;
    submissionLocksRef.current.add(key);
    return true;
  };

  const releaseSubmissionLock = (key: string) => {
    submissionLocksRef.current.delete(key);
  };

  const [offerData, setOfferData] = useState<OfferingData>(DEFAULT_PADDY_OFFER);

  const [finalData, setFinalData] = useState<FinalPriceFormData>(DEFAULT_FINAL_DATA);
  const [finalResample, setFinalResample] = useState(false);
  const [resampleCollectedBy, setResampleCollectedBy] = useState('');
  const [paddySupervisors, setPaddySupervisors] = useState<{ id: number; username: string; staffType?: string | null }[]>([]);

  // Filters
  const [filterBroker, setFilterBroker] = useState('');
  const [filterVariety, setFilterVariety] = useState('');
  // removed party filter
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Server-side Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Unique broker/variety lists for dropdowns
  const brokersList = useMemo(() => Array.from(new Set(entries.map(e => e.brokerName))).sort(), [entries]);
  const varietiesList = useMemo(() => Array.from(new Set(entries.map(e => e.variety))).sort(), [entries]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEntries();
  }, [currentPage]);

  const loadEntries = async (fB?: string, fV?: string, fFrom?: string, fTo?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = { page: currentPage, pageSize };

      const b = fB !== undefined ? fB : filterBroker;
      const v = fV !== undefined ? fV : filterVariety;
      const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
      const dTo = fTo !== undefined ? fTo : filterDateTo;

      if (b) params.broker = b;
      if (v) params.variety = v;
      if (dFrom) params.startDate = dFrom;
      if (dTo) params.endDate = dTo;
      if (entryType) params.entryType = entryType;
      if (excludeEntryType) params.excludeEntryType = excludeEntryType;

      const response = await axios.get(`${API_URL}/sample-entries/tabs/final-pass-lots`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      const loadedEntries = data.entries || [];
      setEntries(loadedEntries);
      const cache: { [key: string]: any } = {};
      loadedEntries.forEach((entry: SampleEntry) => {
        if (entry.offering) cache[entry.id] = entry.offering;
      });
      setOfferingCache(cache);
      if (data.total != null) {
        setTotalEntries(data.total);
        setTotalPages(data.totalPages || Math.ceil(data.total / pageSize));
      } else {
        setTotalEntries(loadedEntries.length);
        setTotalPages(loadedEntries.length < pageSize ? currentPage : currentPage + 1);
      }
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    loadEntries();
  };

  const handleClearFilters = () => {
    setFilterBroker('');
    setFilterVariety('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
    setTimeout(() => {
      loadEntries('', '', '', '');
    }, 0);
  };

  // Entries are now server-side filtered, no client-side filtering needed
  const paginatedEntries = entries;

  // Group entries by date then broker
  const groupedEntries = useMemo(() => {
    const sorted = [...paginatedEntries].sort((a, b) => {
      const dateCompare = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
      if (dateCompare !== 0) return dateCompare;
      const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
      const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
      if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    const grouped: Record<string, Record<string, typeof sorted>> = {};
    sorted.forEach(entry => {
      const dateKey = entry.entryDate ? new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown Date';
      const brokerKey = entry.brokerName || 'Unknown';
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
      grouped[dateKey][brokerKey].push(entry);
    });
    return grouped;
  }, [paginatedEntries]);

  // ===== OFFERING PRICE MODAL =====
  const handleOpenOfferModal = async (entry: SampleEntry) => {
    setSelectedEntry(entry);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d: any = res.data;
      const versions = normalizeOfferVersions(d);
      const latestOffer = getLatestOffer(d);
      const activeOffer = getActiveOffer(d);

      if (versions.length > 0) {
        setOfferVersions(versions);
        setCurrentOfferKey((latestOffer?.key || versions[0].key) as OfferSlotKey);
        setActiveOfferKey((activeOffer?.key || latestOffer?.key || versions[0].key) as OfferSlotKey);
        setOfferData(buildOfferFormData(latestOffer));
      } else {
        resetOfferData(entry);
      }
    } catch {
      resetOfferData(entry);
    }
    setShowOfferModal(true);
  };

  const resetOfferData = (entry: SampleEntry) => {
    const firstOffer = buildOfferFormData({
      key: 'offer1',
      offerBaseRateValue: entry.offeringPrice,
      baseRateType: entry.offerBaseRate || 'PD_LOOSE',
      baseRateUnit: entry.perUnit || 'per_bag'
    });
    setOfferVersions([]);
    setCurrentOfferKey('offer1');
    setActiveOfferKey('offer1');
    setOfferData(firstOffer);
  };

  const handleSelectOfferSlot = (slotKey: OfferSlotKey) => {
    const slotOffer = offerVersions.find((offer) => offer.key === slotKey);
    setCurrentOfferKey(slotKey);
    setOfferData(buildOfferFormData(slotOffer));
  };

  const handleAddOfferSlot = () => {
    const nextSlot = OFFER_KEYS.find((slotKey) => !offerVersions.some((offer) => offer.key === slotKey) && slotKey !== currentOfferKey);
    if (!nextSlot) return;
    setCurrentOfferKey(nextSlot);
    setOfferData({ ...offerData });
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || isSubmitting) return;
    const lockKey = `offer-submit-${selectedEntry.id}`;
    if (!acquireSubmissionLock(lockKey)) return;

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/offering-price`,
        {
          offerSlot: currentOfferKey,
          activeOfferKey,
          setAsActive: activeOfferKey === currentOfferKey,
          offerRate: offerData.offerBaseRateValue ? parseFloat(offerData.offerBaseRateValue) : 0,
          sute: offerData.sute ? parseFloat(offerData.sute) : 0,
          suteUnit: offerData.suteUnit,
          baseRateType: offerData.baseRateType,
          baseRateUnit: offerData.baseRateUnit,
          offerBaseRateValue: offerData.offerBaseRateValue ? parseFloat(offerData.offerBaseRateValue) : 0,
          hamaliEnabled: offerData.hamaliEnabled,
          hamali: parseOptionalNumber(offerData.hamaliValue),
          hamaliUnit: offerData.hamaliUnit,
          moistureValue: offerData.moistureValue ? parseFloat(offerData.moistureValue) : 0,
          brokerageValue: parseOptionalNumber(offerData.brokerageValue),
          brokerageEnabled: offerData.brokerageEnabled,
          brokerageUnit: offerData.brokerageUnit,
          lfValue: parseOptionalNumber(offerData.lfValue),
          lfEnabled: offerData.lfEnabled,
          lfUnit: offerData.lfUnit,
          egbValue: offerData.egbType === 'mill' ? 0 : (offerData.egbValue ? parseFloat(offerData.egbValue) : 0),
          egbType: offerData.egbType,
          customDivisor: offerData.customDivisor ? parseFloat(offerData.customDivisor) : null,
          cdEnabled: offerData.cdEnabled,
          cdValue: parseOptionalNumber(offerData.cdValue),
          cdUnit: offerData.cdUnit,
          bankLoanEnabled: offerData.bankLoanEnabled,
          bankLoanValue: parseOptionalNumber(offerData.bankLoanValue),
          bankLoanUnit: offerData.bankLoanUnit,
          paymentConditionValue: offerData.paymentConditionEnabled && offerData.paymentConditionValue ? parseFloat(offerData.paymentConditionValue) : null,
          paymentConditionUnit: offerData.paymentConditionUnit,
          remarks: offerData.remarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Offering price saved successfully', 'success');
      setShowOfferModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to save offering price', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };

  // ===== FINAL PRICE MODAL =====
  const handleOpenFinalModal = async (entry: SampleEntry) => {
    setSelectedEntry(entry);
    setFinalResample(false);
    setResampleCollectedBy(entry.sampleCollectedBy || '');
    // Fetch offering data to auto-populate
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d: any = res.data;
      if (d) {
        const activeOffer = getActiveOffer(d);
        setFinalData({
          finalSute: d.finalSute?.toString() || d.sute?.toString() || '',
          finalSuteUnit: d.finalSuteUnit || d.suteUnit || 'per_ton',
          finalBaseRate: d.finalBaseRate?.toString() || d.offerBaseRateValue?.toString() || '',
          baseRateType: d.baseRateType || 'PD_LOOSE',
          baseRateUnit: d.baseRateUnit || 'per_bag',
          suteEnabled: d.suteEnabled !== false,
          moistureEnabled: d.moistureEnabled !== false,
          hamaliEnabled: d.hamaliEnabled || false,
          brokerageEnabled: d.brokerageEnabled || false,
          lfEnabled: d.lfEnabled || false,
          moistureValue: d.moistureValue?.toString() || '',
          hamali: toOptionalInputValue(d.hamali ?? activeOffer?.hamali),
          hamaliUnit: d.hamaliUnit || d.baseRateUnit || 'per_bag',
          brokerage: toOptionalInputValue(d.brokerage),
          brokerageUnit: d.brokerageUnit || d.baseRateUnit || 'per_bag',
          lf: toOptionalInputValue(d.lf),
          lfUnit: d.lfUnit || d.baseRateUnit || 'per_bag',
          egbValue: d.egbValue?.toString() || '',
          egbType: (d.egbType as 'mill' | 'purchase') || ((d.egbValue && parseFloat(d.egbValue) > 0) ? 'purchase' : 'mill'),
          customDivisor: d.customDivisor?.toString() || '',
          cdEnabled: d.cdEnabled || false,
          cdValue: toOptionalInputValue(d.cdValue),
          cdUnit: d.cdUnit || 'lumps',
          bankLoanEnabled: d.bankLoanEnabled || false,
          bankLoanValue: toOptionalInputValue(d.bankLoanValue),
          bankLoanUnit: d.bankLoanUnit || 'lumps',
          paymentConditionEnabled: d.paymentConditionEnabled != null
            ? !!d.paymentConditionEnabled
            : true,
          paymentConditionValue: d.paymentConditionValue?.toString() || '15',
          paymentConditionUnit: d.paymentConditionUnit || 'days',
          finalPrice: d.finalPrice?.toString() || entry.finalPrice?.toString() || '',
          remarks: d.finalRemarks || ''
        });
      }
    } catch {
      setFinalData({
        ...DEFAULT_FINAL_DATA,
        suteEnabled: true,
        moistureEnabled: true,
        finalPrice: entry.finalPrice?.toString() || ''
      });
    }
    try {
      const token = localStorage.getItem('token');
      const supervisorRes = await axios.get<{ success: boolean; users: Array<{ id: number; username: string; staffType?: string | null }> }>(
        `${API_URL}/sample-entries/paddy-supervisors`,
        {
          params: { staffType: 'location' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (supervisorRes.data?.users) {
        setPaddySupervisors(supervisorRes.data.users);
      }
    } catch {
      setPaddySupervisors([]);
    }
    setShowFinalPriceModal(true);
  };

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || isSubmitting) return;
    const lockKey = `final-submit-${selectedEntry.id}`;
    if (!acquireSubmissionLock(lockKey)) return;

    try {
      setIsSubmitting(true);
      if (finalResample && selectedEntry.entryType === 'LOCATION_SAMPLE' && !resampleCollectedBy) {
        showNotification('Select Sample Collected By for resample.', 'error');
        setIsSubmitting(false);
        releaseSubmissionLock(lockKey);
        return;
      }
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/final-price`,
        {
          finalSute: finalData.finalSute ? parseFloat(finalData.finalSute) : null,
          finalSuteUnit: finalData.finalSuteUnit,
          finalBaseRate: finalData.finalBaseRate ? parseFloat(finalData.finalBaseRate) : null,
          baseRateUnit: finalData.baseRateUnit,
          suteEnabled: finalData.suteEnabled,
          moistureEnabled: finalData.moistureEnabled,
          hamaliEnabled: finalData.hamaliEnabled,
          brokerageEnabled: finalData.brokerageEnabled,
          lfEnabled: finalData.lfEnabled,
          moistureValue: finalData.moistureValue ? parseFloat(finalData.moistureValue) : null,
          hamali: finalData.hamali ? parseFloat(finalData.hamali) : null,
          hamaliUnit: finalData.hamaliUnit,
          brokerage: finalData.brokerage ? parseFloat(finalData.brokerage) : null,
          brokerageUnit: finalData.brokerageUnit,
          lf: finalData.lf ? parseFloat(finalData.lf) : null,
          lfUnit: finalData.lfUnit,
          egbValue: finalData.egbType === 'mill' ? 0 : (finalData.egbValue ? parseFloat(finalData.egbValue) : null),
          egbType: finalData.egbType,
          customDivisor: finalData.customDivisor ? parseFloat(finalData.customDivisor) : null,
          cdEnabled: finalData.cdEnabled,
          cdValue: finalData.cdValue ? parseFloat(finalData.cdValue) : null,
          cdUnit: finalData.cdUnit,
          bankLoanEnabled: finalData.bankLoanEnabled,
          bankLoanValue: finalData.bankLoanValue ? parseFloat(finalData.bankLoanValue) : null,
          bankLoanUnit: finalData.bankLoanUnit,
          paymentConditionValue: finalData.paymentConditionEnabled && finalData.paymentConditionValue ? parseFloat(finalData.paymentConditionValue) : null,
          paymentConditionUnit: finalData.paymentConditionUnit,
          finalPrice: finalData.finalPrice ? parseFloat(finalData.finalPrice) : null,
          remarks: finalData.remarks,
          isFinalized: true,
          resampleAfterFinal: finalResample,
          resampleCollectedBy: finalResample ? resampleCollectedBy : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Final price saved successfully', 'success');
      setShowFinalPriceModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to save final price', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };

  const handleLotAction = async (entryId: string, decision: 'SOLDOUT' | 'FAIL') => {
    if (isSubmitting) return;
    const lockKey = `lot-action-${entryId}-${decision}`;
    if (!acquireSubmissionLock(lockKey)) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/lot-selection`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotification(
        decision === 'SOLDOUT'
          ? 'Entry marked as Sold Out and removed from Final Pass Lots'
          : isRiceMode
            ? 'Entry marked as Re-sample and removed from Final Pass Lots'
            : 'Entry sent back to Paddy Sample Entry for quality re-sample',
        'success'
      );
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to update entry action', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };

  // Build summary text for offering
  const buildOfferSummary = () => {
    const parts: string[] = [];
    if (offerData.offerBaseRateValue) parts.push(`₹${offerData.offerBaseRateValue}`);
    if (offerData.sute) parts.push(`${offerData.sute} sute ${offerData.suteUnit === 'per_bag' ? 'per bag' : 'per ton'}`);
    if (offerData.offerBaseRateValue) {
      const typeLabel = offerData.baseRateType.replace('_', '/');
      const unitLabel = offerData.baseRateUnit === 'per_bag'
        ? 'per bag'
        : offerData.baseRateUnit === 'per_quintal'
          ? 'per quintal'
          : 'per kg';
      parts.push(`${offerData.offerBaseRateValue} ${typeLabel} ${unitLabel}`);
    }
    if (offerData.cdEnabled && offerData.cdValue) parts.push(`CD ${offerData.cdValue} ${offerData.cdUnit}`);
    if (offerData.bankLoanEnabled && offerData.bankLoanValue) parts.push(`BL ${offerData.bankLoanValue} ${offerData.bankLoanUnit}`);
    return parts.join(', ') || 'No data entered';
  };

  const isEgbVisible = hasEgbForRateType(offerData.baseRateType);
  const isLfVisible = hasLfForRateType(offerData.baseRateType);
  const isCustomDivisorVisible = offerData.baseRateUnit === 'per_kg';
  const isFinalEgbVisible = hasEgbForRateType(finalData.baseRateType);
  const isFinalLfVisible = hasLfForRateType(finalData.baseRateType);
  const isFinalCustomDivisorVisible = finalData.baseRateUnit === 'per_kg';
  const visibleOfferKeys = OFFER_KEYS.filter((slotKey) => offerVersions.some((offer) => offer.key === slotKey) || slotKey === currentOfferKey);
  const canAddMoreOffers = OFFER_KEYS.some((slotKey) => !visibleOfferKeys.includes(slotKey));
  const offerSummaryRows: Array<{ label: string; value: string }> = [
    { label: 'Offer Slot', value: getOfferLabel(currentOfferKey) },
    { label: 'Final Rate Uses', value: getOfferLabel(activeOfferKey) },
    { label: 'Rate Type', value: formatRateTypeLabel(offerData.baseRateType) },
    { label: 'Rate Uses', value: formatRateUnitLabel(offerData.baseRateUnit) }
  ];

  if (offerData.offerBaseRateValue) offerSummaryRows.push({ label: 'Offer Rate', value: `Rs ${formatIndianNumber(offerData.offerBaseRateValue)}` });
  if (offerData.sute) offerSummaryRows.push({ label: 'Sute', value: `${toNumberText(offerData.sute)} ${formatRateUnitLabel(offerData.suteUnit)}` });
  if (offerData.moistureValue) offerSummaryRows.push({ label: 'Moisture', value: `${offerData.moistureValue}%` });
  if (offerData.hamaliEnabled && offerData.hamaliValue) offerSummaryRows.push({ label: 'Hamali', value: `Rs ${formatIndianNumber(offerData.hamaliValue)} / ${offerData.hamaliUnit === 'per_quintal' ? 'Qtl' : 'Bag'}` });
  if (offerData.brokerageEnabled && offerData.brokerageValue) offerSummaryRows.push({ label: 'Brokerage', value: `Rs ${formatIndianNumber(offerData.brokerageValue)} / ${offerData.brokerageUnit === 'per_quintal' ? 'Qtl' : 'Bag'}` });
  if (isLfVisible && offerData.lfEnabled && offerData.lfValue) offerSummaryRows.push({ label: 'LF', value: `Rs ${formatIndianNumber(offerData.lfValue)} / ${offerData.lfUnit === 'per_quintal' ? 'Qtl' : 'Bag'}` });
  if (offerData.cdEnabled && offerData.cdValue) offerSummaryRows.push({ label: 'CD', value: offerData.cdUnit === 'percentage' ? `${offerData.cdValue}%` : `${formatIndianNumber(offerData.cdValue)} Lumps` });
  if (offerData.bankLoanEnabled && offerData.bankLoanValue) offerSummaryRows.push({ label: 'Bank Loan', value: offerData.bankLoanUnit === 'per_bag' ? `Rs ${formatIndianCurrency(offerData.bankLoanValue)} / Bag` : `Rs ${formatIndianCurrency(offerData.bankLoanValue)}` });
  if (offerData.paymentConditionEnabled && offerData.paymentConditionValue) offerSummaryRows.push({ label: 'Payment', value: `${offerData.paymentConditionValue} ${offerData.paymentConditionUnit === 'month' ? 'Month' : 'Days'}` });
  if (isEgbVisible) offerSummaryRows.push({ label: 'EGB', value: offerData.egbType === 'mill' ? 'Mill Ledger' : 'Purchase / Patti Use' });
  if (isEgbVisible && offerData.egbType === 'purchase' && offerData.egbValue) offerSummaryRows.push({ label: 'EGB Value', value: `Rs ${formatIndianNumber(offerData.egbValue)}` });
  if (isCustomDivisorVisible && offerData.customDivisor) offerSummaryRows.push({ label: 'Custom Divisor', value: toNumberText(offerData.customDivisor) });
  const offerSummaryInlineParts = [
    offerData.offerBaseRateValue ? `OfferRate ${formatIndianNumber(offerData.offerBaseRateValue)} / ${formatRateTypeLabel(offerData.baseRateType)} / ${formatRateUnitLabel(offerData.baseRateUnit)}` : '',
    offerData.sute ? `Sute ${toNumberText(offerData.sute)} / ${formatRateUnitLabel(offerData.suteUnit)}` : '',
    offerData.moistureValue ? `Moisture ${offerData.moistureValue}%` : '',
    offerData.hamaliEnabled && offerData.hamaliValue ? `Hamali ${formatIndianNumber(offerData.hamaliValue)} / ${formatChargeUnitLabel(offerData.hamaliUnit)}` : '',
    offerData.brokerageEnabled && offerData.brokerageValue ? `Brokerage ${formatIndianNumber(offerData.brokerageValue)} / ${formatChargeUnitLabel(offerData.brokerageUnit)}` : '',
    isLfVisible && offerData.lfEnabled && offerData.lfValue ? `LF ${formatIndianNumber(offerData.lfValue)} / ${formatChargeUnitLabel(offerData.lfUnit)}` : '',
    offerData.cdEnabled && offerData.cdValue ? `CD ${formatIndianNumber(offerData.cdValue)} / ${formatChargeUnitLabel(offerData.cdUnit)}` : '',
    offerData.bankLoanEnabled && offerData.bankLoanValue ? `Bank Loan ${formatIndianCurrency(offerData.bankLoanValue)} / ${formatChargeUnitLabel(offerData.bankLoanUnit)}` : '',
    offerData.paymentConditionEnabled && offerData.paymentConditionValue ? `Payment ${offerData.paymentConditionValue} ${offerData.paymentConditionUnit === 'month' ? 'Month' : 'Days'}` : '',
    isEgbVisible ? `EGB ${offerData.egbType === 'mill' ? 'Mill Ledger' : `Purchase / ${formatIndianNumber(offerData.egbValue || 0)}`}` : '',
    isCustomDivisorVisible && offerData.customDivisor ? `Divisor ${toNumberText(offerData.customDivisor)}` : ''
  ].filter(Boolean);

  return (
    <div>
      {/* Collapsible Filters */}
      <div style={{ marginBottom: '0px' }}>
        <button
          onClick={() => setFiltersVisible(!filtersVisible)}
          style={{
            padding: '7px 16px',
            backgroundColor: filtersVisible ? '#e74c3c' : '#3498db',
            color: 'white', border: 'none', borderRadius: '4px',
            fontSize: '12px', fontWeight: '600', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          {filtersVisible ? '✕ Hide Filters' : 'Filters'}
        </button>
        {filtersVisible && (
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '12px 16px',
            borderRadius: '6px',
            marginTop: '8px',
            border: '1px solid #e0e0e0',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'flex-end'
          }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '3px' }}>Date From</label>
              <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '3px' }}>Date To</label>
              <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '3px' }}>Broker</label>
              <select value={filterBroker} onChange={e => { setFilterBroker(e.target.value); setCurrentPage(1); }}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                <option value="">All Brokers</option>
                {brokersList.map((b, i) => <option key={i} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#555', display: 'block', marginBottom: '3px' }}>Variety</label>
              <select value={filterVariety} onChange={e => { setFilterVariety(e.target.value); setCurrentPage(1); }}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                <option value="">All Varieties</option>
                {varietiesList.map((v, i) => <option key={i} value={v}>{v}</option>)}
              </select>
            </div>

            {(filterBroker || filterVariety || filterDateFrom || filterDateTo) && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleApplyFilters}
                  style={{ padding: '4px 12px', border: 'none', borderRadius: '3px', backgroundColor: '#3498db', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                  Apply Filters
                </button>
                <button onClick={handleClearFilters}
                  style={{ padding: '4px 12px', border: '1px solid #e74c3c', borderRadius: '3px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table grouped by Date then Broker */}
      <div style={{ overflowX: 'auto', backgroundColor: 'white' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries pending final report</div>
        ) : (
          Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => {
            let brokerSeq = 0; // Initialize broker sequence for each date
            return (
              <div key={dateKey} style={{ marginBottom: '20px' }}>
                {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                  const orderedEntries = [...brokerEntries].sort((a, b) => {
                    const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                    const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                    if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                  });
                  brokerSeq++;
                  return (
                    <div key={brokerName} style={{ marginBottom: '0px' }}>
                      {/* Date bar — only first broker */}
                      {brokerIdx === 0 && <div style={{
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                        textAlign: 'center', letterSpacing: '0.5px', minWidth: tableMinWidth
                      }}>
                        {(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                        &nbsp;&nbsp;{entryType === 'RICE_SAMPLE' ? 'Rice Sample' : 'Paddy Sample'}
                      </div>}
                      {/* Broker name bar */}
                      <div style={{
                        background: '#e8eaf6',
                        color: '#000', padding: '3px 10px', fontWeight: '700', fontSize: '12px',
                        display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #c5cae9', minWidth: tableMinWidth
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                      </div>
                      <table style={{ width: '100%', minWidth: tableMinWidth, borderCollapse: 'collapse', fontSize: '11px', tableLayout: isRiceMode ? 'fixed' : 'auto', border: '1px solid #000' }}>
                        <thead style={{ position: 'sticky', top: 56, zIndex: 2 }}>
                          <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                            {isRiceMode ? (
                              <>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>SL No</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Type</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bags</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Pkg</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Party Name</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Rice Location</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '9%' }}>Variety</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '22%' }}>Offering Details</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '22%' }}>Final Price</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '8%' }}>Action</th>
                              </>
                            ) : (
                              <>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>SL No</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Bags</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Pkg</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Party Name</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Paddy Location</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Variety</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Sample Collected By</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Grain</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Moist</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Cutting</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Bend</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Mix</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Oil/Kandu</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>SK</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>100 Gms</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Paddy WB</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Sample Report By</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Cooking</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Offer Rate</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Final Rate</th>
                                <th style={{ border: '1px solid #000', padding: '3px', fontWeight: '700', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {orderedEntries.map((entry, index) => {
                            const o = offeringCache[entry.id] || entry.offering;
                            const slNo = index + 1;
                            const rowType = entry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'RL' : entry.entryType === 'LOCATION_SAMPLE' ? 'LS' : 'MS';
                            const qp = entry.qualityParameters || {};
                            const cp = entry.cookingReport || {};
                            const isResampleActive = entry.lotSelectionDecision === 'FAIL';
                            const rowBgColor = isResampleActive
                              ? '#fff7e6'
                              : entry.entryType === 'DIRECT_LOADED_VEHICLE'
                                ? '#e3f2fd'
                                : entry.entryType === 'LOCATION_SAMPLE'
                                  ? '#ffe0b2'
                                  : '#ffffff';
                            return (
                              <tr key={entry.id} style={{ backgroundColor: rowBgColor }}>
                                {isRiceMode ? (
                                  <>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        {slNo}
                                        {Math.max(0, Number(entry.qualityReportAttempts || 0)) > 1 && (
                                          <span style={{ fontSize: '9px', backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>Re-sample</span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '700', whiteSpace: 'nowrap' }}>{rowType}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>{entry.packaging || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#1565c0', whiteSpace: 'nowrap' }}>{toTitleCase(entry.partyName)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>{toTitleCase(entry.location) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap' }}>{toTitleCase(entry.variety) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '11px', whiteSpace: 'nowrap' }}>{o?.offerBaseRateValue ? `Rs ${toNumberText(o.offerBaseRateValue)}` : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '11px', whiteSpace: 'nowrap' }}>{o?.finalPrice || entry.finalPrice ? `Rs ${toNumberText(o?.finalPrice || entry.finalPrice)}` : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                        {isAdmin && (
                                          <button onClick={() => handleOpenOfferModal(entry)} style={{ fontSize: '10px', padding: '3px 8px', backgroundColor: o?.offerBaseRateValue ? '#3498db' : '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                            {o?.offerBaseRateValue ? 'Edit Offer' : 'Add Offer'}
                                          </button>
                                        )}
                                        {(isAdmin || isManager) && (entry.offeringPrice || o) && (
                                          <button onClick={() => handleOpenFinalModal(entry)} style={{ fontSize: '10px', padding: '3px 8px', backgroundColor: entry.finalPrice || o?.finalPrice ? '#27ae60' : '#e67e22', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                            {entry.finalPrice || o?.finalPrice ? 'Edit Final' : 'Add Final'}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '600' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        {slNo}
                                        {Math.max(0, Number(entry.qualityReportAttempts || 0)) > 1 && (
                                          <span style={{ fontSize: '9px', backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Re-sample</span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '700' }}>{rowType}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '600' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{entry.packaging || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontWeight: '600', color: '#0d47a1' }}>{toTitleCase(entry.partyName)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{toTitleCase(entry.location) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{toTitleCase(entry.variety) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{entry.sampleCollectedBy || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{qp.grainsCount ? `(${qp.grainsCount})` : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', lineHeight: '1.2' }}>
                                      {Number(qp.dryMoisture) ? (
                                        <div style={{ color: '#e67e22', fontWeight: 700 }}>{toPercentText(qp.dryMoisture)}</div>
                                      ) : null}
                                      {Number(qp.moisture) ? (
                                        <div style={{ color: '#1f2937', fontWeight: 600 }}>{toPercentText(qp.moisture)}</div>
                                      ) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`${toNumberText(qp.cutting1)} x ${toNumberText(qp.cutting2)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`${toNumberText(qp.bend1 || qp.bend)} x ${toNumberText(qp.bend2)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', lineHeight: '1.2', fontWeight: 600 }}>
                                      {(() => {
                                        const mixRows = [
                                          Number(qp.mix) ? toNumberText(qp.mix) : '',
                                          Number(qp.mixS) ? `S ${toNumberText(qp.mixS)}` : '',
                                          Number(qp.mixL) ? `L ${toNumberText(qp.mixL)}` : ''
                                        ].filter(Boolean);

                                        if (mixRows.length === 0) return '-';

                                        return mixRows.map((mixRow) => (
                                          <div key={mixRow}>{mixRow}</div>
                                        ));
                                      })()}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      {(() => {
                                        const oilKanduRows = [
                                          Number(qp.oil) ? toNumberText(qp.oil) : '',
                                          Number(qp.kandu) ? toNumberText(qp.kandu) : ''
                                        ].filter(Boolean);
                                        return oilKanduRows.length ? oilKanduRows.join(' | ') : '-';
                                      })()}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{toNumberText(qp.sk)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', lineHeight: '1.2', fontWeight: 600 }}>
                                      {(() => {
                                        const wbRows = [
                                          Number(qp.wbR) ? `R-${toNumberText(qp.wbR)}` : '',
                                          Number(qp.wbBk) ? `BK-${toNumberText(qp.wbBk)}` : '',
                                          Number(qp.wbT) ? `T-${toNumberText(qp.wbT)}` : ''
                                        ].filter(Boolean);

                                        if (!wbRows.length) return '-';

                                        return wbRows.map((wbRow) => (
                                          <div key={wbRow}>{wbRow}</div>
                                        ));
                                      })()}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', color: Number(qp.paddyWb) > 0 && Number(qp.paddyWb) <= 50 ? '#c62828' : '#1f2937', fontWeight: Number(qp.paddyWb) > 0 && Number(qp.paddyWb) <= 50 ? 800 : 600 }}>
                                      {Number(qp.paddyWb) ? `${toNumberText(qp.paddyWb)} gms` : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{qp.reportedBy || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      <div style={{ fontWeight: '700', color: '#00695c' }}>{cookingStatusLabel(cp.status)}</div>
                                      {cp.remarks ? (
                                        <button
                                          onClick={() => setRemarksPopup({ isOpen: true, title: `Cooking Remark - ${toTitleCase(entry.partyName)}`, text: cp.remarks })}
                                          style={{ marginTop: '3px', fontSize: '10px', padding: '2px 8px', backgroundColor: '#455a64', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                                        >
                                          🔍 Remarks
                                        </button>
                                      ) : null}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      {isAdmin ? (
                                        <button onClick={() => handleOpenOfferModal(entry)} style={{ fontSize: '10px', padding: '3px 7px', backgroundColor: o?.offerBaseRateValue ? '#3498db' : '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700' }}>
                                          {formatOfferBadge(o)}
                                        </button>
                                      ) : <span>{o?.offerBaseRateValue ? `Rs ${toNumberText(o.offerBaseRateValue)}` : '-'}</span>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      {(isAdmin || isManager) ? (
                                        <button onClick={() => handleOpenFinalModal(entry)} style={{ fontSize: '10px', padding: '3px 7px', backgroundColor: entry.finalPrice || o?.finalPrice ? '#27ae60' : '#e67e22', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700' }}>
                                          {entry.finalPrice || o?.finalPrice ? `Rs ${toNumberText(o?.finalPrice || entry.finalPrice)}` : 'Add Final'}
                                        </button>
                                      ) : <span>{o?.finalPrice || entry.finalPrice ? `Rs ${toNumberText(o?.finalPrice || entry.finalPrice)}` : '-'}</span>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      {(isAdmin || isManager) && entry.lotSelectionDecision !== 'FAIL' && (
                                        isRiceMode
                                          ? entry.workflowStatus === 'LOT_SELECTION'
                                          : ['LOT_SELECTION', 'FINAL_REPORT'].includes(entry.workflowStatus)
                                      ) ? (
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                          <button
                                            onClick={() => handleLotAction(entry.id, 'SOLDOUT')}
                                            style={{ fontSize: '10px', padding: '3px 7px', backgroundColor: '#c62828', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700' }}
                                          >
                                            Sold Out
                                          </button>
                                          <button
                                            onClick={() => handleLotAction(entry.id, 'FAIL')}
                                            style={{ fontSize: '10px', padding: '3px 7px', backgroundColor: '#ef6c00', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700' }}
                                          >
                                            Re-sample
                                          </button>
                                        </div>
                                      ) : (
                                        entry.lotSelectionDecision === 'FAIL' ? (
                                          (() => {
                                            const resampleCookingDone = ['PASS', 'MEDIUM'].includes(String(cp.status || '').toUpperCase());
                                            const resampleQualityDone = !!(qp.reportedBy || qp.id);
                                            const resampleReadyForFinal = ['LOT_SELECTION', 'FINAL_REPORT'].includes(entry.workflowStatus) && resampleQualityDone && resampleCookingDone;
                                            return (
                                              <span
                                                style={{
                                                  display: 'inline-block',
                                                  padding: '2px 8px',
                                                  borderRadius: '10px',
                                                  fontSize: '10px',
                                                  fontWeight: 800,
                                                  background: resampleReadyForFinal ? '#e8f5e9' : '#fff3cd',
                                                  color: resampleReadyForFinal ? '#2e7d32' : '#8a6400',
                                                  border: resampleReadyForFinal ? '1px solid #c8e6c9' : '1px solid #f4d06f'
                                                }}
                                              >
                                                {resampleReadyForFinal ? 'Ready for Loading' : 'Resample'}
                                              </span>
                                            );
                                          })()
                                        ) : (
                                          <span
                                            style={{
                                              fontWeight: 700,
                                              color: entry.lotSelectionDecision === 'SOLDOUT' ? '#b71c1c' : '#6b7280'
                                            }}
                                          >
                                            {entry.lotSelectionDecision === 'SOLDOUT' ? 'Sold Out' : '-'}
                                          </span>
                                        )
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}</tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div >

      {remarksPopup.isOpen && (
        <div
          onClick={() => setRemarksPopup({ isOpen: false, title: '', text: '' })}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '10px', boxShadow: '0 14px 40px rgba(0,0,0,0.3)', padding: '16px' }}
          >
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#1f2937', marginBottom: '8px' }}>{remarksPopup.title || 'Cooking Remark'}</div>
            <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#374151', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', whiteSpace: 'pre-wrap' }}>
              {remarksPopup.text}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                onClick={() => setRemarksPopup({ isOpen: false, title: '', text: '' })}
                style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: '#374151', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== OFFERING PRICE MODAL ==================== */}
      {
        showOfferModal && selectedEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '12px'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '10px', borderRadius: '12px',
              width: '100%', maxWidth: '520px', maxHeight: '90vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              overflowY: 'auto'
            }}>
              <h3 style={{
                marginTop: 0, marginBottom: '8px', fontSize: '16px', fontWeight: '700',
                color: '#2c3e50', borderBottom: '3px solid #3498db', paddingBottom: '8px',
                textAlign: 'center'
              }}>
                {selectedEntry.brokerName}
              </h3>

              {/* Entry Info - one line */}
              <div style={{
                backgroundColor: '#eaf2f8', padding: '6px 8px', borderRadius: '6px',
                marginBottom: '6px', fontSize: '10px', textAlign: 'center', lineHeight: '1.4'
              }}>
                Bags: <b>{selectedEntry.bags?.toLocaleString('en-IN')}</b> | Pkg: <b>{selectedEntry.packaging || '75'} Kg</b> | Party: <b>{selectedEntry.partyName}</b> | <b>{selectedEntry.location}</b> | <b>{selectedEntry.variety}</b>
              </div>

              {!isRiceMode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {visibleOfferKeys.map((slotKey) => {
                      const slotOffer = offerVersions.find((offer) => offer.key === slotKey);
                      return (
                        <button
                          key={slotKey}
                          type="button"
                          onClick={() => handleSelectOfferSlot(slotKey)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '999px',
                            border: currentOfferKey === slotKey ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                            backgroundColor: currentOfferKey === slotKey ? '#dbeafe' : '#fff',
                            color: '#1e293b',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}
                        >
                          {getOfferLabel(slotKey)}
                          {slotOffer?.offerBaseRateValue ? ` • ₹${toNumberText(slotOffer.offerBaseRateValue)}` : ''}
                          {activeOfferKey === slotKey ? ' ✓' : ''}
                        </button>
                      );
                    })}
                    {canAddMoreOffers && (
                      <button
                        type="button"
                        onClick={handleAddOfferSlot}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '999px',
                          border: '1px dashed #94a3b8',
                          backgroundColor: '#f8fafc',
                          color: '#0f172a',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}
                      >
                        + Add Offer
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                    <span style={{ color: '#475569', fontWeight: '600' }}>Final Rate Uses</span>
                    <select
                      value={activeOfferKey}
                      onChange={(e) => setActiveOfferKey(e.target.value as OfferSlotKey)}
                      style={{ ...inputStyle, width: '120px', padding: '6px 8px', fontSize: '11px' }}
                    >
                      {visibleOfferKeys.map((slotKey) => (
                        <option key={slotKey} value={slotKey}>{getOfferLabel(slotKey)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitOffer}>
                {/* Row 1: Offer Rate + Sute + Moisture */}
                <div style={compactModalGridStyle}>
                  <div style={{ minWidth: 0 }}>
                    <label style={labelStyle}>Offer Rate *</label>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <select value={offerData.baseRateType}
                        onChange={e => setOfferData({ ...offerData, baseRateType: e.target.value })}
                        style={{ ...inputStyle, flex: '0 0 120px', width: '120px', minWidth: '120px', cursor: 'pointer', fontSize: '11px' }} required>
                        <option value="PD_LOOSE">PD/Loose</option>
                        <option value="PD_WB">PD/WB</option>
                        <option value="MD_WB">MD/WB</option>
                        <option value="MD_LOOSE">MD/Loose</option>
                      </select>
                      <input type="text" inputMode="decimal" value={offerData.offerBaseRateValue}
                        onChange={e => setOfferData({ ...offerData, offerBaseRateValue: sanitizeAmountInput(e.target.value) })}
                        style={{ ...inputStyle, flex: '1 1 180px', minWidth: '160px' }} placeholder="Rate" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                        <label style={radioLabelStyle}>
                          <input type="radio" name="baseRateUnit" checked={offerData.baseRateUnit === 'per_bag'}
                            onChange={() => setOfferData({ ...offerData, baseRateUnit: 'per_bag', hamaliUnit: 'per_bag', brokerageUnit: 'per_bag', lfUnit: 'per_bag', customDivisor: '' })} /> Per Bag
                        </label>
                        <label style={radioLabelStyle}>
                          <input type="radio" name="baseRateUnit" checked={offerData.baseRateUnit === 'per_quintal'}
                            onChange={() => setOfferData({ ...offerData, baseRateUnit: 'per_quintal', hamaliUnit: 'per_quintal', brokerageUnit: 'per_quintal', lfUnit: 'per_quintal', customDivisor: '' })} /> Per Qtl
                        </label>
                        {!isRiceMode && (
                          <label style={radioLabelStyle}>
                            <input type="radio" name="baseRateUnit" checked={offerData.baseRateUnit === 'per_kg'}
                              onChange={() => setOfferData({ ...offerData, baseRateUnit: 'per_kg' })} /> Per Kg
                          </label>
                        )}
                      </div>
                      {isCustomDivisorVisible && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Divisor</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={offerData.customDivisor}
                            onChange={e => setOfferData({ ...offerData, customDivisor: sanitizeAmountInput(e.target.value) })}
                            style={{ ...inputStyle, width: '92px', padding: '6px 8px', fontSize: '11px' }}
                            placeholder="Divisor"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>Sute</label>
                    <input type="text" inputMode="decimal" value={offerData.sute}
                      onChange={e => setOfferData({ ...offerData, sute: sanitizeAmountInput(e.target.value) })}
                      style={inputStyle} placeholder="Sute value" />
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginTop: '4px' }}>
                      <label style={radioLabelStyle}>
                        <input type="radio" name="suteUnit" checked={offerData.suteUnit === 'per_bag'}
                          onChange={() => setOfferData({ ...offerData, suteUnit: 'per_bag' })} /> Per Bag
                      </label>
                      <label style={radioLabelStyle}>
                        <input type="radio" name="suteUnit" checked={offerData.suteUnit === 'per_ton'}
                          onChange={() => setOfferData({ ...offerData, suteUnit: 'per_ton' })} /> Per Ton
                      </label>
                    </div>
                  </div>
                  <div style={compactMiniFieldStyle}>
                    <label style={labelStyle}>Moisture (%)</label>
                    <input type="text" inputMode="decimal" value={offerData.moistureValue}
                      onChange={e => setOfferData({ ...offerData, moistureValue: sanitizeMoistureInput(e.target.value) })}
                      style={inputStyle} placeholder="Moisture %" />
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>Max 5 chars, one decimal point only</div>
                  </div>
                </div>

                {/* Row 2: Hamali + Brokerage + LF with Yes/No */}
                <div style={compactModalGridStyle}>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>Hamali</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="offerHamaliEnabled" checked={offerData.hamaliEnabled}
                        onChange={() => setOfferData({ ...offerData, hamaliEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="offerHamaliEnabled" checked={!offerData.hamaliEnabled}
                        onChange={() => setOfferData({ ...offerData, hamaliEnabled: false, hamaliValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {offerData.hamaliEnabled && (
                      <div style={compactSplitInputStyle}>
                        <input type="text" inputMode="decimal" value={offerData.hamaliValue}
                          onChange={e => setOfferData({ ...offerData, hamaliValue: sanitizeAmountInput(e.target.value) })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={offerData.hamaliUnit} onChange={e => setOfferData({ ...offerData, hamaliUnit: e.target.value })}
                          style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>Brokerage</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="offerBrokerageEnabled" checked={offerData.brokerageEnabled}
                        onChange={() => setOfferData({ ...offerData, brokerageEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="offerBrokerageEnabled" checked={!offerData.brokerageEnabled}
                        onChange={() => setOfferData({ ...offerData, brokerageEnabled: false, brokerageValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {offerData.brokerageEnabled && (
                      <div style={compactSplitInputStyle}>
                        <input type="text" inputMode="decimal" value={offerData.brokerageValue}
                          onChange={e => setOfferData({ ...offerData, brokerageValue: sanitizeAmountInput(e.target.value) })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={offerData.brokerageUnit} onChange={e => setOfferData({ ...offerData, brokerageUnit: e.target.value })}
                          style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>LF</label>
                    {isLfVisible ? (
                      <>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                          <label style={radioLabelStyle}><input type="radio" name="offerLfEnabled" checked={offerData.lfEnabled}
                            onChange={() => setOfferData({ ...offerData, lfEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                          <label style={radioLabelStyle}><input type="radio" name="offerLfEnabled" checked={!offerData.lfEnabled}
                            onChange={() => setOfferData({ ...offerData, lfEnabled: false, lfValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                        </div>
                        {offerData.lfEnabled && (
                          <div style={compactSplitInputStyle}>
                            <input type="text" inputMode="decimal" value={offerData.lfValue}
                              onChange={e => setOfferData({ ...offerData, lfValue: sanitizeAmountInput(e.target.value) })}
                              style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                            <select value={offerData.lfUnit} onChange={e => setOfferData({ ...offerData, lfUnit: e.target.value })}
                              style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                              <option value="per_bag">Per Bag</option>
                              <option value="per_quintal">Per Qtl</option>
                            </select>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b', fontSize: '12px' }}>Not Applicable for MD/WB</div>
                    )}
                  </div>
                </div>

                {!isRiceMode && (
                  <div style={compactModalGridStyle}>
                    <div style={compactNarrowFieldStyle}>
                      <label style={labelStyle}>CD</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                        <label style={radioLabelStyle}><input type="radio" name="offerCdEnabled" checked={offerData.cdEnabled}
                          onChange={() => setOfferData({ ...offerData, cdEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                        <label style={radioLabelStyle}><input type="radio" name="offerCdEnabled" checked={!offerData.cdEnabled}
                          onChange={() => setOfferData({ ...offerData, cdEnabled: false, cdValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                      </div>
                      {offerData.cdEnabled && (
                        <div style={compactSplitInputStyle}>
                          <input type="text" inputMode="decimal" value={offerData.cdValue}
                            onChange={e => setOfferData({ ...offerData, cdValue: sanitizeAmountInput(e.target.value, 8) })}
                            style={{ ...inputStyle, flex: 1, minWidth: '120px' }} placeholder="CD value" />
                          <select value={offerData.cdUnit} onChange={e => setOfferData({ ...offerData, cdUnit: e.target.value as 'lumps' | 'percentage' })}
                            style={{ ...inputStyle, width: '98px', fontSize: '11px' }}>
                            <option value="lumps">Lumps</option>
                            <option value="percentage">Percent</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={compactNarrowFieldStyle}>
                      <label style={labelStyle}>Bank Loan</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                        <label style={radioLabelStyle}><input type="radio" name="offerBankLoanEnabled" checked={offerData.bankLoanEnabled}
                          onChange={() => setOfferData({ ...offerData, bankLoanEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                        <label style={radioLabelStyle}><input type="radio" name="offerBankLoanEnabled" checked={!offerData.bankLoanEnabled}
                          onChange={() => setOfferData({ ...offerData, bankLoanEnabled: false, bankLoanValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                      </div>
                      {offerData.bankLoanEnabled && (
                        <div style={compactSplitInputStyle}>
                          <input type="text" inputMode="decimal" value={offerData.bankLoanValue}
                            onChange={e => setOfferData({ ...offerData, bankLoanValue: sanitizeAmountInput(e.target.value, 8) })}
                            style={{ ...inputStyle, flex: 1, minWidth: '120px' }} placeholder="Bank loan" />
                          <select value={offerData.bankLoanUnit} onChange={e => setOfferData({ ...offerData, bankLoanUnit: e.target.value as 'per_bag' | 'lumps' })}
                            style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                            <option value="lumps">Lumps</option>
                            <option value="per_bag">Per Bag</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={compactNarrowFieldStyle}>
                      <label style={labelStyle}>Payment Condition</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                        <label style={radioLabelStyle}><input type="radio" name="offerPaymentConditionEnabled" checked={offerData.paymentConditionEnabled}
                          onChange={() => setOfferData({ ...offerData, paymentConditionEnabled: true, paymentConditionValue: offerData.paymentConditionValue || '15' })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                        <label style={radioLabelStyle}><input type="radio" name="offerPaymentConditionEnabled" checked={!offerData.paymentConditionEnabled}
                          onChange={() => setOfferData({ ...offerData, paymentConditionEnabled: false, paymentConditionValue: '15' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                      </div>
                      {offerData.paymentConditionEnabled && (
                        <div style={compactSplitInputStyle}>
                          <input type="text" inputMode="decimal" value={offerData.paymentConditionValue}
                            onChange={e => setOfferData({ ...offerData, paymentConditionValue: sanitizeAmountInput(e.target.value) })}
                            style={{ ...inputStyle, flex: 1 }} placeholder="15" />
                          <select value={offerData.paymentConditionUnit} onChange={e => setOfferData({ ...offerData, paymentConditionUnit: e.target.value as 'days' | 'month' })}
                            style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                            <option value="days">Days</option>
                            <option value="month">Month</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 3: EGB */}
                {isEgbVisible && (
                  <div style={{ marginBottom: '8px' }}>
                    {isEgbVisible && (<div><label style={labelStyle}>EGB</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '11px' }}>
                        <label style={{ ...radioLabelStyle, padding: '4px 10px', borderRadius: '4px', border: offerData.egbType === 'mill' ? '2px solid #27ae60' : '1px solid #ddd', backgroundColor: offerData.egbType === 'mill' ? '#e8f5e9' : 'transparent' }}>
                          <input type="radio" name="offerEgbType" checked={offerData.egbType === 'mill'}
                            onChange={() => setOfferData({ ...offerData, egbType: 'mill', egbValue: '0' })} />
                          <span style={{ fontWeight: '600', color: '#2e7d32' }}>Mill</span>
                        </label>
                        <label style={{ ...radioLabelStyle, padding: '4px 10px', borderRadius: '4px', border: offerData.egbType === 'purchase' ? '2px solid #e67e22' : '1px solid #ddd', backgroundColor: offerData.egbType === 'purchase' ? '#ffe0b2' : 'transparent' }}>
                          <input type="radio" name="offerEgbType" checked={offerData.egbType === 'purchase'}
                            onChange={() => setOfferData({ ...offerData, egbType: 'purchase', egbValue: '' })} />
                          <span style={{ fontWeight: '600', color: '#e67e22' }}>Purchase</span>
                        </label>
                      </div>
                      <input type="text" inputMode="decimal" value={offerData.egbType === 'mill' ? '0' : offerData.egbValue}
                        onChange={e => setOfferData({ ...offerData, egbValue: sanitizeAmountInput(e.target.value) })}
                        disabled={offerData.egbType === 'mill'}
                        style={{ ...inputStyle, backgroundColor: offerData.egbType === 'mill' ? '#f0f0f0' : '#fff', cursor: offerData.egbType === 'mill' ? 'not-allowed' : 'text', maxWidth: '240px' }} placeholder="EGB value" />
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>
                        {offerData.egbType === 'mill' ? 'Mill entries go to EGB ledger with bags and date.' : 'Purchase EGB is used in patti only.'}
                      </div>
                    </div>)}
                  </div>
                )}

                {/* Summary */}
                <div style={{ backgroundColor: '#e8f5e9', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px', fontSize: '11px', border: '1px solid #c8e6c9' }}>
                  <div style={{ color: '#2e7d32', fontWeight: '700', marginBottom: '6px' }}>{getOfferLabel(currentOfferKey)}</div>
                  {offerSummaryInlineParts.length > 0 ? (
                    <div style={{ color: '#334155', display: 'flex', flexWrap: 'wrap', gap: '4px 10px', lineHeight: '1.45' }}>
                      {offerSummaryInlineParts.map((part) => (
                        <span key={part} style={{ wordBreak: 'break-word' }}>({part})</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b' }}>No data entered</div>
                  )}
                </div>

                {/* Remarks */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>Remarks</label>
                  <textarea value={offerData.remarks} onChange={e => setOfferData({ ...offerData, remarks: e.target.value })}
                    style={{ ...inputStyle, minHeight: '34px' }} placeholder="Enter remarks..." />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <button type="button" onClick={() => setShowOfferModal(false)} disabled={isSubmitting}
                    style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>Cancel</button>
                  <button type="submit" disabled={isSubmitting}
                    style={{ padding: '8px 20px', cursor: isSubmitting ? 'not-allowed' : 'pointer', backgroundColor: isSubmitting ? '#95a5a6' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600' }}>
                    {isSubmitting ? 'Saving...' : 'Save Offering Price'}
                  </button>
                </div>
              </form>
            </div>
          </div >
        )
      }

      {/* ==================== FINAL PRICE MODAL ==================== */}
      {
        showFinalPriceModal && selectedEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '12px'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '10px', borderRadius: '12px',
              width: '100%', maxWidth: '520px', maxHeight: '90vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              overflowY: 'auto'
            }}>
              <h3 style={{
                marginTop: 0, marginBottom: '8px', fontSize: '16px', fontWeight: '700',
                color: '#2c3e50', borderBottom: '3px solid #27ae60', paddingBottom: '8px',
                textAlign: 'center'
              }}>
                {selectedEntry.brokerName}
              </h3>

              {/* Entry Info - one line */}
              <div style={{
                backgroundColor: '#e8f8f5', padding: '6px 8px', borderRadius: '6px',
                marginBottom: '6px', fontSize: '10px', textAlign: 'center', lineHeight: '1.4'
              }}>
                Bags: <b>{selectedEntry.bags?.toLocaleString('en-IN')}</b> | Pkg: <b>{selectedEntry.packaging || '75'} Kg</b> | Party: <b>{selectedEntry.partyName}</b> | <b>{selectedEntry.location}</b> | <b>{selectedEntry.variety}</b>
              </div>

              <form onSubmit={handleSubmitFinal}>
                {/* Row 1: Final Rate + Sute + Moisture */}
                <div style={compactModalGridStyle}>
                  <div style={{ minWidth: 0 }}>
                    <label style={labelStyle}>Final Rate</label>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <select value={finalData.baseRateType}
                        onChange={e => setFinalData({ ...finalData, baseRateType: e.target.value })}
                        style={{ ...inputStyle, flex: '0 0 120px', width: '120px', minWidth: '120px', cursor: 'pointer', fontSize: '11px' }}>
                        <option value="PD_LOOSE">PD/Loose</option>
                        <option value="PD_WB">PD/WB</option>
                        <option value="MD_WB">MD/WB</option>
                        <option value="MD_LOOSE">MD/Loose</option>
                      </select>
                      <input type="text" inputMode="decimal" value={finalData.finalBaseRate}
                        onChange={e => setFinalData({ ...finalData, finalBaseRate: sanitizeAmountInput(e.target.value) })}
                        style={{ ...inputStyle, flex: '1 1 180px', minWidth: '160px' }} placeholder="Rate" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                        <label style={radioLabelStyle}>
                          <input type="radio" name="finalBaseRateUnit" checked={finalData.baseRateUnit === 'per_bag'}
                            onChange={() => setFinalData({ ...finalData, baseRateUnit: 'per_bag', hamaliUnit: 'per_bag', brokerageUnit: 'per_bag', lfUnit: 'per_bag', customDivisor: '' })} /> Per Bag
                        </label>
                        <label style={radioLabelStyle}>
                          <input type="radio" name="finalBaseRateUnit" checked={finalData.baseRateUnit === 'per_quintal'}
                            onChange={() => setFinalData({ ...finalData, baseRateUnit: 'per_quintal', hamaliUnit: 'per_quintal', brokerageUnit: 'per_quintal', lfUnit: 'per_quintal', customDivisor: '' })} /> Per Qtl
                        </label>
                        {!isRiceMode && (
                          <label style={radioLabelStyle}>
                            <input type="radio" name="finalBaseRateUnit" checked={finalData.baseRateUnit === 'per_kg'}
                              onChange={() => setFinalData({ ...finalData, baseRateUnit: 'per_kg' })} /> Per Kg
                          </label>
                        )}
                      </div>
                      {isFinalCustomDivisorVisible && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Divisor</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={finalData.customDivisor}
                            onChange={e => setFinalData({ ...finalData, customDivisor: sanitizeAmountInput(e.target.value) })}
                            style={{ ...inputStyle, width: '92px', padding: '6px 8px', fontSize: '11px' }}
                            placeholder="Divisor"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>Sute</label>
                    <input type="text" inputMode="decimal" value={finalData.finalSute}
                      onChange={e => setFinalData({ ...finalData, finalSute: sanitizeAmountInput(e.target.value) })}
                      style={{ ...inputStyle, backgroundColor: '#f9f9f9', opacity: finalData.suteEnabled ? 1 : 0.6 }}
                      readOnly={!finalData.suteEnabled && !isManager} placeholder="Sute" />
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginTop: '4px' }}>
                      <label style={radioLabelStyle}>
                        <input type="radio" name="finalSuteUnit" checked={finalData.finalSuteUnit === 'per_bag'}
                          onChange={() => setFinalData({ ...finalData, finalSuteUnit: 'per_bag' })} /> Per Bag
                      </label>
                      <label style={radioLabelStyle}>
                        <input type="radio" name="finalSuteUnit" checked={finalData.finalSuteUnit === 'per_ton'}
                          onChange={() => setFinalData({ ...finalData, finalSuteUnit: 'per_ton' })} /> Per Ton
                      </label>
                    </div>
                  </div>
                  <div style={compactMiniFieldStyle}>
                    <label style={labelStyle}>Moisture (%)</label>
                    <input type="text" inputMode="decimal" value={finalData.moistureValue}
                      onChange={e => setFinalData({ ...finalData, moistureValue: sanitizeMoistureInput(e.target.value), moistureEnabled: true })}
                      style={inputStyle} placeholder="Moisture %" />
                    <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>Max 5 chars, one decimal point only</div>
                  </div>
                </div>

                {/* Row 2: Hamali + Brokerage + LF with Yes/No */}
                <div style={compactModalGridStyle}>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>Hamali</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="finalHamaliEnabled" checked={finalData.hamaliEnabled}
                        onChange={() => setFinalData({ ...finalData, hamaliEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="finalHamaliEnabled" checked={!finalData.hamaliEnabled}
                        onChange={() => setFinalData({ ...finalData, hamaliEnabled: false, hamali: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {finalData.hamaliEnabled && (
                      <div style={compactSplitInputStyle}>
                        <input type="text" inputMode="decimal" value={finalData.hamali}
                          onChange={e => setFinalData({ ...finalData, hamali: sanitizeAmountInput(e.target.value) })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={finalData.hamaliUnit} onChange={e => setFinalData({ ...finalData, hamaliUnit: e.target.value })}
                          style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>Brokerage</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="finalBrokerageEnabled" checked={finalData.brokerageEnabled}
                        onChange={() => setFinalData({ ...finalData, brokerageEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="finalBrokerageEnabled" checked={!finalData.brokerageEnabled}
                        onChange={() => setFinalData({ ...finalData, brokerageEnabled: false, brokerage: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {finalData.brokerageEnabled && (
                      <div style={compactSplitInputStyle}>
                        <input type="text" inputMode="decimal" value={finalData.brokerage}
                          onChange={e => setFinalData({ ...finalData, brokerage: sanitizeAmountInput(e.target.value) })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={finalData.brokerageUnit} onChange={e => setFinalData({ ...finalData, brokerageUnit: e.target.value })}
                          style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={compactNarrowFieldStyle}>
                    <label style={labelStyle}>LF</label>
                    {isFinalLfVisible ? (
                      <>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                          <label style={radioLabelStyle}><input type="radio" name="finalLfEnabled" checked={finalData.lfEnabled}
                            onChange={() => setFinalData({ ...finalData, lfEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                          <label style={radioLabelStyle}><input type="radio" name="finalLfEnabled" checked={!finalData.lfEnabled}
                            onChange={() => setFinalData({ ...finalData, lfEnabled: false, lf: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                        </div>
                        {finalData.lfEnabled && (
                          <div style={compactSplitInputStyle}>
                            <input type="text" inputMode="decimal" value={finalData.lf}
                              onChange={e => setFinalData({ ...finalData, lf: sanitizeAmountInput(e.target.value) })}
                              style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                            <select value={finalData.lfUnit} onChange={e => setFinalData({ ...finalData, lfUnit: e.target.value })}
                              style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                              <option value="per_bag">Per Bag</option>
                              <option value="per_quintal">Per Qtl</option>
                            </select>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ ...inputStyle, backgroundColor: '#f8fafc', color: '#64748b', fontSize: '12px' }}>Not Applicable for MD/WB</div>
                    )}
                  </div>
                </div>

                {!isRiceMode && (
                  <div style={compactModalGridStyle}>
                    <div style={compactNarrowFieldStyle}>
                      <label style={labelStyle}>CD</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                        <label style={radioLabelStyle}><input type="radio" name="finalCdEnabled" checked={finalData.cdEnabled}
                          onChange={() => setFinalData({ ...finalData, cdEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                        <label style={radioLabelStyle}><input type="radio" name="finalCdEnabled" checked={!finalData.cdEnabled}
                          onChange={() => setFinalData({ ...finalData, cdEnabled: false, cdValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                      </div>
                      {finalData.cdEnabled && (
                        <div style={compactSplitInputStyle}>
                          <input type="text" inputMode="decimal" value={finalData.cdValue}
                            onChange={e => setFinalData({ ...finalData, cdValue: sanitizeAmountInput(e.target.value, 8) })}
                            style={{ ...inputStyle, flex: 1, minWidth: '120px' }} placeholder="CD value" />
                          <select value={finalData.cdUnit} onChange={e => setFinalData({ ...finalData, cdUnit: e.target.value as 'lumps' | 'percentage' })}
                            style={{ ...inputStyle, width: '98px', fontSize: '11px' }}>
                            <option value="lumps">Lumps</option>
                            <option value="percentage">Percent</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={compactNarrowFieldStyle}>
                      <label style={labelStyle}>Bank Loan</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                        <label style={radioLabelStyle}><input type="radio" name="finalBankLoanEnabled" checked={finalData.bankLoanEnabled}
                          onChange={() => setFinalData({ ...finalData, bankLoanEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                        <label style={radioLabelStyle}><input type="radio" name="finalBankLoanEnabled" checked={!finalData.bankLoanEnabled}
                          onChange={() => setFinalData({ ...finalData, bankLoanEnabled: false, bankLoanValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                      </div>
                      {finalData.bankLoanEnabled && (
                        <div style={compactSplitInputStyle}>
                          <input type="text" inputMode="decimal" value={finalData.bankLoanValue}
                            onChange={e => setFinalData({ ...finalData, bankLoanValue: sanitizeAmountInput(e.target.value, 8) })}
                            style={{ ...inputStyle, flex: 1, minWidth: '120px' }} placeholder="Bank loan" />
                          <select value={finalData.bankLoanUnit} onChange={e => setFinalData({ ...finalData, bankLoanUnit: e.target.value as 'per_bag' | 'lumps' })}
                            style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                            <option value="lumps">Lumps</option>
                            <option value="per_bag">Per Bag</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div style={compactNarrowFieldStyle}>
                      <label style={labelStyle}>Payment Condition</label>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                        <label style={radioLabelStyle}><input type="radio" name="finalPaymentConditionEnabled" checked={finalData.paymentConditionEnabled}
                          onChange={() => setFinalData({ ...finalData, paymentConditionEnabled: true, paymentConditionValue: finalData.paymentConditionValue || '15' })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                        <label style={radioLabelStyle}><input type="radio" name="finalPaymentConditionEnabled" checked={!finalData.paymentConditionEnabled}
                          onChange={() => setFinalData({ ...finalData, paymentConditionEnabled: false, paymentConditionValue: '15' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                      </div>
                      {finalData.paymentConditionEnabled && (
                        <div style={compactSplitInputStyle}>
                          <input type="text" inputMode="decimal" value={finalData.paymentConditionValue}
                            onChange={e => setFinalData({ ...finalData, paymentConditionValue: sanitizeAmountInput(e.target.value) })}
                            style={{ ...inputStyle, flex: 1 }} placeholder="15" />
                          <select value={finalData.paymentConditionUnit} onChange={e => setFinalData({ ...finalData, paymentConditionUnit: e.target.value as 'days' | 'month' })}
                            style={{ ...inputStyle, width: '92px', fontSize: '11px' }}>
                            <option value="days">Days</option>
                            <option value="month">Month</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 3: EGB */}
                {isFinalEgbVisible && (
                  <div style={{ marginBottom: '8px' }}>
                    {isFinalEgbVisible && <div>
                      <label style={labelStyle}>EGB</label>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '11px' }}>
                        <label style={{ ...radioLabelStyle, padding: '4px 10px', borderRadius: '4px', border: finalData.egbType === 'mill' ? '2px solid #27ae60' : '1px solid #ddd', backgroundColor: finalData.egbType === 'mill' ? '#e8f5e9' : 'transparent' }}>
                          <input type="radio" name="finalEgbType" checked={finalData.egbType === 'mill'}
                            onChange={() => setFinalData({ ...finalData, egbType: 'mill', egbValue: '0' })} />
                          <span style={{ fontWeight: '600', color: '#2e7d32' }}>Mill</span>
                        </label>
                        <label style={{ ...radioLabelStyle, padding: '4px 10px', borderRadius: '4px', border: finalData.egbType === 'purchase' ? '2px solid #e67e22' : '1px solid #ddd', backgroundColor: finalData.egbType === 'purchase' ? '#ffe0b2' : 'transparent' }}>
                          <input type="radio" name="finalEgbType" checked={finalData.egbType === 'purchase'}
                            onChange={() => setFinalData({ ...finalData, egbType: 'purchase', egbValue: '' })} />
                          <span style={{ fontWeight: '600', color: '#e67e22' }}>Purchase</span>
                        </label>
                      </div>
                      <input type="text" inputMode="decimal" value={finalData.egbType === 'mill' ? '0' : finalData.egbValue}
                        onChange={e => setFinalData({ ...finalData, egbValue: sanitizeAmountInput(e.target.value) })}
                        disabled={finalData.egbType === 'mill'}
                        style={{ ...inputStyle, backgroundColor: finalData.egbType === 'mill' ? '#f0f0f0' : '#fff', cursor: finalData.egbType === 'mill' ? 'not-allowed' : 'text', maxWidth: '240px' }} placeholder="EGB value" />
                      <div style={{ marginTop: '4px', fontSize: '10px', color: '#64748b' }}>
                        {finalData.egbType === 'mill' ? 'Mill entries go to EGB ledger with bags and date.' : 'Purchase EGB is used in patti only.'}
                      </div>
                    </div>}
                  </div>
                )}

                {!isRiceMode && (
                  <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#1f2937' }}>
                      <input
                        type="checkbox"
                        checked={finalResample}
                        onChange={(e) => setFinalResample(e.target.checked)}
                      />
                      Add Final + Resample
                    </label>
                    {finalResample && selectedEntry?.entryType === 'LOCATION_SAMPLE' && (
                      <select
                        value={resampleCollectedBy}
                        onChange={(e) => setResampleCollectedBy(e.target.value)}
                        style={{ ...inputStyle, width: '220px', padding: '6px 8px', fontSize: '11px' }}
                      >
                        <option value="">Select Sample Collected By</option>
                        {paddySupervisors.map((supervisor) => (
                          <option key={supervisor.id} value={supervisor.username}>
                            {supervisor.username}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Remarks */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>Remarks</label>
                  <textarea value={finalData.remarks}
                    onChange={e => setFinalData({ ...finalData, remarks: e.target.value })}
                    style={{ ...inputStyle, minHeight: '34px' }} placeholder="Enter remarks..." />
                </div>


                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <button type="button" onClick={() => setShowFinalPriceModal(false)} disabled={isSubmitting}
                    style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>Cancel</button>
                  <button type="submit" disabled={isSubmitting}
                    style={{ padding: '8px 20px', cursor: isSubmitting ? 'not-allowed' : 'pointer', backgroundColor: isSubmitting ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600' }}>
                    {isSubmitting ? 'Saving...' : 'Save Final Price'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px 0', marginTop: '12px' }}>
        <button
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: currentPage <= 1 ? '#eee' : '#fff', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          {'<- Prev'}
        </button>
        <span style={{ fontSize: '13px', color: '#666' }}>
          Page {currentPage} of {totalPages} &nbsp;({totalEntries} total)
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: currentPage >= totalPages ? '#eee' : '#fff', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          {'Next ->'}
        </button>
      </div>
    </div>
  );
};

export default FinalPassLots;
