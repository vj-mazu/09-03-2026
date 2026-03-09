import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  packaging: string;
  workflowStatus: string;
  qualityParameters?: { id?: string; reportedBy?: string };
  cookingReport?: { id?: string; status?: string; remarks?: string };
  offering?: any;
  entryType?: string;
  lorryNumber?: string;
  sampleCollectedBy?: string;
  sampleCollectedHistory?: string[];
  qualityReportHistory?: string[];
  qualityAttemptDetails?: QualityAttemptDetail[];
  qualityReportAttempts?: number;
  lotSelectionDecision?: string;
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
    ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '-';
};
const toOptionalInputValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (Number.isFinite(num) && num === 0) return '';
  return String(value);
};
const isLooseRateType = (value?: string) => ['PD_LOOSE', 'MD_LOOSE'].includes(String(value || '').toUpperCase());
const formatPaymentCondition = (value: any, unit?: string) => {
  if (value == null || value === '') return '-';
  return `${value} ${unit === 'month' ? 'Month' : 'Days'}`;
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
const paddyColumnWidths = ['48px', '54px', '74px', '66px', '250px', '118px', '124px', '150px', '150px', '94px', '74px', '70px', '90px', '64px', '78px', '72px', '72px', '120px', '110px', '150px', '104px'];
const compactStatusText = (parts: string[]) => parts.filter(Boolean).join(' | ');
const normalizeCookingStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PASS' || normalized === 'MEDIUM') return 'Pass';
  if (normalized === 'FAIL') return 'Fail';
  if (normalized === 'RECHECK') return 'Recheck';
  return normalized ? toTitleCase(normalized.toLowerCase()) : 'Not Applicable';
};

const LoadingLots: React.FC<LoadingLotsProps> = ({ entryType, excludeEntryType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const isRiceMode = entryType === 'RICE_SAMPLE';
  const tableMinWidth = isRiceMode ? '100%' : '2100px';
  const pageSize = 100;

  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qualityHistoryModal, setQualityHistoryModal] = useState<{ open: boolean; entry: SampleEntry | null }>({ open: false, entry: null });
  const [managerData, setManagerData] = useState({
    sute: '', suteUnit: 'per_ton', moistureValue: '', hamali: '', hamaliUnit: 'per_bag',
    brokerage: '', brokerageUnit: 'per_bag', lf: '', lfUnit: 'per_bag',
    finalBaseRate: '', baseRateType: 'PD_LOOSE', egbValue: '', egbType: 'mill',
    cdValue: '', cdUnit: 'lumps', bankLoanValue: '', bankLoanUnit: 'lumps',
    paymentConditionEnabled: false,
    paymentConditionValue: '15', paymentConditionUnit: 'days'
  });

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

  const handleSaveValues = async () => {
    if (!selectedEntry || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const o = selectedEntry.offering || {};
      const isLooseType = isLooseRateType(managerData.baseRateType || o.baseRateType);
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
        lf: isLooseType ? (managerData.lf ? parseFloat(managerData.lf) : (o.lf ?? null)) : 0,
        lfUnit: managerData.lfUnit || o.lfUnit || 'per_bag',
        egbValue: isLooseType && managerData.egbType !== 'mill' ? (managerData.egbValue ? parseFloat(managerData.egbValue) : (o.egbValue ?? 0)) : 0,
        egbType: isLooseType ? (managerData.egbType || o.egbType || 'mill') : 'mill',
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

  const groupedByDateBroker: Record<string, Record<string, SampleEntry[]>> = {};
  entries.forEach((entry) => {
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

  const renderReportedByHistory = (entry: SampleEntry) => {
    const names = (entry.qualityReportHistory || []).filter(Boolean).length > 0
      ? (entry.qualityReportHistory || []).filter(Boolean)
      : (entry.qualityParameters?.reportedBy ? [entry.qualityParameters.reportedBy] : []);
    if (names.length === 0) return '-';
    return (
      <div style={{ lineHeight: '1.35' }}>
        {names.map((name, index) => (
          <div key={`${entry.id}-${index}`} style={{ fontWeight: 700, color: index === 0 ? '#1f2937' : '#4f83cc', whiteSpace: 'nowrap' }}>
            {index + 1}] {toTitleCase(name)}
          </div>
        ))}
        {(entry.qualityAttemptDetails || []).length > 0 && (
          <button
            type="button"
            onClick={() => setQualityHistoryModal({ open: true, entry })}
            style={{
              marginTop: '4px',
              border: '1px solid #f4d06f',
              background: '#fff8e1',
              color: '#8a6400',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            View Quality
          </button>
        )}
      </div>
    );
  };

  const renderCollectedByHistory = (entry: SampleEntry) => {
    const collectedBy = entry.sampleCollectedBy || (entry.sampleCollectedHistory || []).find(Boolean) || '';
    if (!collectedBy) return '-';
    return <div style={{ lineHeight: '1.35', fontWeight: 700, color: '#1f2937' }}>{toTitleCase(collectedBy)}</div>;
  };

  const qualityModalEntry = qualityHistoryModal.entry;
  const qualityAttemptDetails = qualityModalEntry?.qualityAttemptDetails || [];
  const formatAttemptValue = (value: any, suffix = '') => {
    if (value === null || value === undefined || value === '') return '-';
    return `${toNumberText(value)}${suffix}`;
  };

  const modalOffering = selectedEntry?.offering || {};
  const modalRateType = managerData.baseRateType || modalOffering.baseRateType || 'PD_LOOSE';
  const modalIsLooseType = isLooseRateType(modalRateType);
  const modalSuteMissing = !!selectedEntry && modalOffering.suteEnabled === false && !parseFloat(modalOffering.finalSute ?? '') && !parseFloat(modalOffering.sute ?? '');
  const modalMoistureMissing = !!selectedEntry && modalOffering.moistureEnabled === false && !parseFloat(modalOffering.moistureValue ?? '');
  const modalHamaliMissing = !!selectedEntry && modalOffering.hamaliEnabled === false && !parseFloat(modalOffering.hamali ?? '');
  const modalBrokerageMissing = !!selectedEntry && modalOffering.brokerageEnabled === false && !parseFloat(modalOffering.brokerage ?? '');
  const modalLfMissing = !!selectedEntry && modalIsLooseType && modalOffering.lfEnabled === false && !parseFloat(modalOffering.lf ?? '');
  const modalCdMissing = !!selectedEntry && !!modalOffering.cdEnabled && !parseFloat(modalOffering.cdValue ?? '');
  const modalBankLoanMissing = !!selectedEntry && !!modalOffering.bankLoanEnabled && !parseFloat(modalOffering.bankLoanValue ?? '');
  const modalPaymentMissing = !!selectedEntry && !!managerData.paymentConditionEnabled && !parseInt(modalOffering.paymentConditionValue ?? '', 10);
  const modalEgbMissing = !!selectedEntry && modalIsLooseType && modalOffering.egbType === 'purchase' && !parseFloat(modalOffering.egbValue ?? '');
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
      <div style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>Showing {entries.length} of {total} lots</span>
        <button onClick={() => setShowFilters(!showFilters)} style={{ padding: '6px 14px', fontSize: '13px', background: showFilters ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{showFilters ? 'Hide Filters' : 'Filters'}</button>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
          {(['broker', 'variety', 'party', 'location'] as const).map((key) => <input key={key} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }} />)}
          <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
          <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
          <button onClick={() => { setPage(1); fetchEntries(); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Apply</button>
          <button onClick={() => { setFilters({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' }); setPage(1); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '6px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div> : entries.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No loading lots found</div> : Object.entries(groupedByDateBroker).map(([dateStr, brokerGroups]) => {
          let brokerSeq = 0;
          return (
            <div key={dateStr}>
              {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
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
                          {(isRiceMode ? ['SL', 'Type', 'Bags', 'Pkg', 'Party Name', 'Rice Location', 'Variety', 'Final Rate', 'Sute', 'Mst%', 'Hamali', 'Bkrg', 'LF', 'Status', 'Action'] : ['SL No', 'Type', 'Bags', 'Pkg', 'Party Name', 'Paddy Location', 'Variety', 'Sample Collected By', 'Sample Report By', 'Final Rate', 'Sute', 'Moist', 'Brokerage', 'LF', 'Hamali', 'CD', 'EGB', 'Bank Loan', 'Payment', 'Status', 'Action']).map((header) => <th key={header} style={{ border: '1px solid #000', padding: '3px 4px', textAlign: ['Status', 'Action', 'EGB'].includes(header) ? 'center' : 'left', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '12px' }}>{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {brokerEntries.map((entry, index) => {
                          const o = entry.offering || {};
                          const isLooseType = isLooseRateType(o.baseRateType);
                          const suteMissing = o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute);
                          const mstMissing = o.moistureEnabled === false && !parseFloat(o.moistureValue);
                          const hamaliMissing = o.hamaliEnabled === false && !parseFloat(o.hamali);
                          const bkrgMissing = o.brokerageEnabled === false && !parseFloat(o.brokerage);
                          const lfMissing = isLooseType && o.lfEnabled === false && !parseFloat(o.lf);
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
                          const isResampleCase = (entry.qualityReportAttempts || 0) > 1;
                          const resampleQualityStatus = isResampleCase ? 'Pass' : '';
                          const resampleCookingStatus = !isResampleCase
                            ? ''
                            : entry.lotSelectionDecision === 'PASS_WITHOUT_COOKING'
                              ? 'Not Applicable'
                              : normalizeCookingStatus(entry.cookingReport?.status);
                          const resampleRemark = isResampleCase ? (entry.cookingReport?.remarks || '') : '';
                          const sc = ({ LOT_ALLOTMENT: { bg: '#e3f2fd', color: '#1565c0' }, PENDING_ALLOTTING_SUPERVISOR: { bg: '#fce4ec', color: '#880e4f' }, PHYSICAL_INSPECTION: { bg: '#ffe0b2', color: '#e65100' }, INVENTORY_ENTRY: { bg: '#e8f5e9', color: '#2e7d32' }, OWNER_FINANCIAL: { bg: '#f3e5f5', color: '#7b1fa2' }, MANAGER_FINANCIAL: { bg: '#e0f7fa', color: '#00695c' }, FINAL_REVIEW: { bg: '#fce4ec', color: '#c62828' } } as any)[entry.workflowStatus] || { bg: '#f5f5f5', color: '#333' };
                          const rowBg = entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff';
                          const typeCode = getEntryTypeCode(entry.entryType);
                          const partyLabel = toTitleCase(entry.partyName) || (entry.entryType === 'DIRECT_LOADED_VEHICLE' ? entry.lorryNumber?.toUpperCase() || '-' : '-');
                          const finalRateValue = o.finalBaseRate ?? o.offerBaseRateValue;
                          const finalRateUnit = unitLabel(o.baseRateUnit || 'per_bag');
                          const cellStyle = (missing: boolean): React.CSSProperties => ({ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', background: missing ? '#fff3cd' : rowBg, color: missing ? '#856404' : '#333', fontWeight: missing ? '700' : '400', fontSize: '12px' });

                          if (isRiceMode) {
                            return (
                              <tr key={entry.id} style={{ background: rowBg }}>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 600, fontSize: '14px' }}>{index + 1 + (page - 1) * pageSize}</td>
                                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', verticalAlign: 'middle' }}>{entry.entryType === 'DIRECT_LOADED_VEHICLE' ? <span style={{ color: 'white', backgroundColor: '#1565c0', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800 }}>RL</span> : entry.entryType === 'LOCATION_SAMPLE' ? <span style={{ color: 'white', backgroundColor: '#e67e22', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800 }}>LS</span> : <span style={{ color: '#333', backgroundColor: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800, border: '1px solid #ccc' }}>MS</span>}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 600, fontSize: '14px' }}>{entry.bags?.toLocaleString('en-IN')}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}>{entry.packaging || '-'}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px' }}><div style={{ fontWeight: 600, color: '#1565c0' }}>{partyLabel}</div>{entry.entryType === 'DIRECT_LOADED_VEHICLE' && entry.lorryNumber && entry.partyName && <div style={{ fontSize: '10px', color: '#1565c0', fontWeight: 600 }}>{entry.lorryNumber.toUpperCase()}</div>}</td>
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
                              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700 }}>{index + 1 + (page - 1) * pageSize}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}><span style={{ display: 'inline-block', minWidth: '28px', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: 800, color: typeCode === 'RL' || typeCode === 'LS' ? '#fff' : '#333', backgroundColor: typeCode === 'RL' ? '#1565c0' : typeCode === 'LS' ? '#e67e22' : '#fff', border: typeCode === 'MS' ? '1px solid #ccc' : 'none' }}>{typeCode}</span></td>
                              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>{entry.bags?.toLocaleString('en-IN') || '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '13px' }}>{entry.packaging || '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', lineHeight: '1.35', wordBreak: 'break-word' }}><div style={{ fontWeight: 700, color: '#1565c0' }}>{partyLabel}</div>{entry.entryType === 'DIRECT_LOADED_VEHICLE' && entry.lorryNumber && entry.partyName && <div style={{ fontSize: '10px', color: '#1565c0', fontWeight: 600 }}>{entry.lorryNumber.toUpperCase()}</div>}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', wordBreak: 'break-word' }}>{toTitleCase(entry.location) || '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', wordBreak: 'break-word' }}>{toTitleCase(entry.variety) || '-'}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', lineHeight: '1.35', wordBreak: 'break-word' }}>{renderCollectedByHistory(entry)}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontSize: '13px', lineHeight: '1.35', wordBreak: 'break-word' }}>{renderReportedByHistory(entry)}</td>
                              <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'center', fontSize: '13px' }}>{finalRateValue ? <div style={{ fontWeight: 700, color: '#2e7d32', lineHeight: '1.3' }}><div>Rs {toNumberText(finalRateValue)}</div><div style={{ fontSize: '10px', color: '#5f6368', fontWeight: 600 }}>{o.baseRateType?.replace(/_/g, '/') || finalRateUnit}</div></div> : '-'}</td>
                              <td style={cellStyle(suteMissing)}>{suteMissing ? 'Need' : fmtVal(o.finalSute ?? o.sute, o.finalSuteUnit ?? o.suteUnit)}</td>
                              <td style={cellStyle(mstMissing)}>{mstMissing ? 'Need' : (o.moistureValue != null ? `${toNumberText(o.moistureValue)}%` : '-')}</td>
                              <td style={cellStyle(bkrgMissing)}>{bkrgMissing ? 'Need' : fmtVal(o.brokerage, o.brokerageUnit)}</td>
                              <td style={cellStyle(lfMissing)}>{isLooseType ? (lfMissing ? 'Need' : fmtVal(o.lf, o.lfUnit)) : 'Hidden'}</td>
                              <td style={cellStyle(hamaliMissing)}>{hamaliMissing ? 'Need' : fmtVal(o.hamali || o.hamaliPerKg, o.hamaliUnit)}</td>
                              <td style={cellStyle(cdMissing)}>
                                {o.cdEnabled ? `${toNumberText(o.cdValue)} ${o.cdUnit === 'percentage' ? '%' : 'L'}` : '-'}
                              </td>
                              <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px' }}>
                                {isLooseType ? (o.egbType === 'mill' ? 'Mill' : (o.egbValue != null ? toNumberText(o.egbValue) : '-')) : 'Hidden'}
                              </td>
                              <td style={cellStyle(bankLoanMissing)}>
                                {o.bankLoanEnabled ? (o.bankLoanUnit === 'per_bag' ? `Rs ${formatIndianCurrency(o.bankLoanValue)} / Bag` : `Rs ${formatIndianCurrency(o.bankLoanValue)}`) : '-'}
                              </td>
                              <td style={cellStyle(paymentMissing)}>{formatPaymentCondition(o.paymentConditionValue, o.paymentConditionUnit)}</td>
                              <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', background: '#fafcff' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#155724', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px', padding: '2px 4px' }}>Admin Added</div>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: needsFill ? '#856404' : '#155724', background: needsFill ? '#fff3cd' : '#d4edda', border: needsFill ? '1px solid #ffeeba' : '1px solid #c3e6cb', borderRadius: '4px', padding: '2px 4px', lineHeight: '1.25' }}>
                                    {needsFill ? `Missing: ${compactStatusText(missingFieldLabels)}` : 'Manager Added'}
                                  </div>
                                  {isResampleCase && (
                                    <div style={{ textAlign: 'left', fontSize: '10px', lineHeight: '1.35', background: '#fff8e1', border: '1px solid #f4d06f', borderRadius: '4px', padding: '4px 5px', color: '#5d4037' }}>
                                      <div><span style={{ fontWeight: 800, color: '#8a6400' }}>Re-Sample Quality:</span> {resampleQualityStatus}</div>
                                      <div><span style={{ fontWeight: 800, color: '#8a6400' }}>Re-Sample Cooking:</span> {resampleCookingStatus}</div>
                                      {resampleRemark ? (
                                        <div style={{ marginTop: '2px' }}><span style={{ fontWeight: 800, color: '#8a6400' }}>Remark:</span> {resampleRemark}</div>
                                      ) : null}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '10px', fontWeight: 800, color: sc.color, background: sc.bg, borderRadius: '4px', padding: '2px 4px', lineHeight: '1.2' }}>
                                    {statusLabel(entry.workflowStatus)}
                                  </div>
                                </div>
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{isManagerOrOwner && <button onClick={() => handleUpdateClick(entry)} style={{ padding: '3px 8px', background: needsFill ? '#e67e22' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>{needsFill ? 'Fill Values' : 'View/Edit'}</button>}</td>
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

      {qualityHistoryModal.open && qualityModalEntry && (
        <div
          onClick={() => setQualityHistoryModal({ open: false, entry: null })}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '860px', maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 24px 60px rgba(0,0,0,0.32)', padding: '16px' }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937', marginBottom: '8px' }}>Quality Attempts</div>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
              Party: <b>{toTitleCase(qualityModalEntry.partyName) || '-'}</b> | Variety: <b>{toTitleCase(qualityModalEntry.variety) || '-'}</b> | Location: <b>{toTitleCase(qualityModalEntry.location) || '-'}</b>
            </div>

            {qualityAttemptDetails.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>No quality attempt history found.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {qualityAttemptDetails.map((attempt) => (
                  <div key={`${qualityModalEntry.id}-attempt-${attempt.attemptNo}`} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', background: attempt.attemptNo === 1 ? '#f8fafc' : '#fffdf3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>Attempt {attempt.attemptNo}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                        {attempt.reportedBy ? `Reported By: ${toTitleCase(attempt.reportedBy)}` : 'Reported By: -'}
                        {attempt.createdAt ? ` | ${new Date(attempt.createdAt).toLocaleString('en-IN')}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {[
                        ['Moisture', formatAttemptValue(attempt.moisture, '%')],
                        ['Dry Moisture', formatAttemptValue(attempt.dryMoisture, '%')],
                        ['Cutting', attempt.cutting1 || attempt.cutting2 ? `${formatAttemptValue(attempt.cutting1)} x ${formatAttemptValue(attempt.cutting2)}` : '-'],
                        ['Bend', attempt.bend1 || attempt.bend2 ? `${formatAttemptValue(attempt.bend1)} x ${formatAttemptValue(attempt.bend2)}` : '-'],
                        ['Mix', formatAttemptValue(attempt.mix)],
                        ['Kandu', formatAttemptValue(attempt.kandu)],
                        ['Oil', formatAttemptValue(attempt.oil)],
                        ['SK', formatAttemptValue(attempt.sk)],
                        ['Grains Count', formatAttemptValue(attempt.grainsCount)],
                        ['WB R', formatAttemptValue(attempt.wbR)],
                        ['WB BK', formatAttemptValue(attempt.wbBk)],
                        ['WB T', formatAttemptValue(attempt.wbT)],
                        ['Paddy WB', formatAttemptValue(attempt.paddyWb)],
                        ['Grams', attempt.gramsReport || '-']
                      ].map(([label, value]) => (
                        <div key={`${qualityModalEntry.id}-${attempt.attemptNo}-${label}`} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', background: '#ffffff' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>{label}</div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
              <div style={modalIsLooseType ? (modalLfMissing ? modalEditableCardStyle : modalCardStyle) : modalCardStyle}>
                <span style={modalTagStyle(modalIsLooseType && modalLfMissing)}>{modalIsLooseType ? (modalLfMissing ? 'Manager Add' : 'Admin Added') : 'Hidden'}</span>
                <label style={modalLabelStyle}>LF</label>
                <div style={modalMetaStyle}>{modalIsLooseType ? formatChargeUnitLabel(managerData.lfUnit || modalOffering.lfUnit) : 'WB types do not use LF'}</div>
                {modalIsLooseType ? (
                  modalLfMissing ? (
                    <input type="text" inputMode="decimal" value={managerData.lf} onChange={(e) => setManagerData({ ...managerData, lf: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter LF" />
                  ) : (
                    <div style={modalReadonlyValueStyle}>{hasValue(modalOffering.lf) ? fmtVal(modalOffering.lf, modalOffering.lfUnit) : 'No'}</div>
                  )
                ) : (
                  <div style={modalReadonlyValueStyle}>Hidden for WB types</div>
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
                    <input type="text" inputMode="decimal" value={managerData.cdValue} onChange={(e) => setManagerData({ ...managerData, cdValue: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter CD" />
                  ) : (
                    <div style={modalReadonlyValueStyle}>{modalOffering.cdEnabled ? (hasValue(modalOffering.cdValue) ? (modalOffering.cdUnit === 'percentage' ? `${toNumberText(modalOffering.cdValue)} %` : `${toNumberText(modalOffering.cdValue)} Lumps`) : 'Pending') : 'No'}</div>
                  )}
                </div>
                <div style={modalBankLoanMissing ? modalEditableCardStyle : modalCardStyle}>
                  <span style={modalTagStyle(modalBankLoanMissing)}>{modalBankLoanMissing ? 'Manager Add' : 'Admin Added'}</span>
                  <label style={modalLabelStyle}>Bank Loan</label>
                  <div style={modalMetaStyle}>{modalOffering.bankLoanEnabled ? formatChargeUnitLabel(managerData.bankLoanUnit || modalOffering.bankLoanUnit) : 'No'}</div>
                  {modalBankLoanMissing ? (
                    <input type="text" inputMode="decimal" value={managerData.bankLoanValue} onChange={(e) => setManagerData({ ...managerData, bankLoanValue: sanitizeAmountInput(e.target.value) })} style={modalInputStyle} placeholder="Enter bank loan" />
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
              <div style={modalIsLooseType && modalEgbMissing ? modalEditableCardStyle : modalCardStyle}>
                <span style={modalTagStyle(modalIsLooseType && modalEgbMissing)}>{modalIsLooseType ? (modalEgbMissing ? 'Manager Add' : 'Admin Added') : 'Hidden'}</span>
                <label style={modalLabelStyle}>EGB</label>
                <div style={modalMetaStyle}>
                  {!modalIsLooseType
                    ? 'WB types do not use EGB'
                    : modalOffering.egbType === 'purchase'
                      ? 'Purchase'
                      : 'Mill'}
                </div>
                {!modalIsLooseType ? (
                  <div style={modalReadonlyValueStyle}>Hidden for WB types</div>
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
    </div>
  );
};

export default LoadingLots;
