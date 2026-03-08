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
}

interface OfferingData {
  offerRate: string;
  sute: string;
  suteUnit: string;
  baseRateType: string;
  baseRateUnit: string;
  offerBaseRateValue: string;
  hamaliEnabled: boolean;
  hamaliPerKg: string;
  hamaliPerQuintal: string;
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
  remarks: string;
}

interface FinalPriceFormData {
  finalSute: string;
  finalSuteUnit: string;
  finalBaseRate: string;
  baseRateType: string;
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
  finalPrice: string;
  remarks: string;
}

// Shared styles
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333', fontSize: '13px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' };
const radioLabelStyle: React.CSSProperties = { fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' };

const headerCellStyle: React.CSSProperties = { padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' };
const dataCellStyle: React.CSSProperties = { padding: '6px', fontSize: '11px', whiteSpace: 'nowrap' };

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
const toNumberText = (value: any, digits = 2) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits).replace(/\.00$/, '') : '-';
};
const cookingStatusLabel = (status?: string) => {
  const key = (status || '').toUpperCase();
  if (key === 'PASS') return 'Pass';
  if (key === 'MEDIUM') return 'Pass/Med';
  if (key === 'RECHECK') return 'Recheck';
  if (key === 'FAIL') return 'Fail';
  return '-';
};

interface FinalReportProps {
  entryType?: string;
  excludeEntryType?: string;
}

const FinalReport: React.FC<FinalReportProps> = ({ entryType, excludeEntryType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showFinalPriceModal, setShowFinalPriceModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [offeringCache, setOfferingCache] = useState<{ [key: string]: any }>({});
  const isAdmin = (user?.role as string) === 'admin' || (user?.role as string) === 'owner';
  const isManager = user?.role === 'manager';
  const isRiceMode = entryType === 'RICE_SAMPLE';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLocksRef = useRef<Set<string>>(new Set());

  const acquireSubmissionLock = (key: string) => {
    if (submissionLocksRef.current.has(key)) return false;
    submissionLocksRef.current.add(key);
    return true;
  };

  const releaseSubmissionLock = (key: string) => {
    submissionLocksRef.current.delete(key);
  };

  const [offerData, setOfferData] = useState<OfferingData>({
    offerRate: '',
    sute: '',
    suteUnit: 'per_bag',
    baseRateType: 'PD_LOOSE',
    baseRateUnit: 'per_bag',
    offerBaseRateValue: '',
    hamaliEnabled: false,
    hamaliPerKg: '',
    hamaliPerQuintal: '',
    hamaliUnit: 'per_bag',
    moistureValue: '',
    brokerageValue: '',
    brokerageEnabled: false,
    brokerageUnit: 'per_bag',
    lfValue: '',
    lfEnabled: false,
    lfUnit: 'per_bag',
    egbValue: '',
    egbType: 'mill' as 'mill' | 'purchase',
    customDivisor: '',
    remarks: ''
  });

  const [finalData, setFinalData] = useState<FinalPriceFormData>({
    finalSute: '',
    finalSuteUnit: 'per_bag',
    finalBaseRate: '',
    baseRateType: 'PD_LOOSE',
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
    egbValue: '',
    egbType: 'mill' as 'mill' | 'purchase',
    customDivisor: '',
    finalPrice: '',
    remarks: ''
  });

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
    const sorted = [...paginatedEntries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

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
    // Try to fetch existing offering data
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d: any = res.data;
      if (d && d.offerRate) {
        setOfferData({
          offerRate: d.offerRate?.toString() || '',
          sute: d.sute?.toString() || '',
          suteUnit: d.suteUnit || 'per_bag',
          baseRateType: d.baseRateType || 'PD_LOOSE',
          baseRateUnit: d.baseRateUnit || 'per_bag',
          offerBaseRateValue: d.offerBaseRateValue?.toString() || '',
          hamaliEnabled: d.hamaliEnabled || false,
          hamaliPerKg: d.hamaliPerKg?.toString() || '',
          hamaliPerQuintal: d.hamaliPerQuintal?.toString() || '',
          hamaliUnit: d.hamaliUnit || d.baseRateUnit || 'per_bag',
          moistureValue: d.moistureValue?.toString() || '',
          brokerageValue: d.brokerage?.toString() || '',
          brokerageEnabled: d.brokerageEnabled || false,
          brokerageUnit: d.brokerageUnit || d.baseRateUnit || 'per_bag',
          lfValue: d.lf?.toString() || '',
          lfEnabled: d.lfEnabled || false,
          lfUnit: d.lfUnit || d.baseRateUnit || 'per_bag',
          egbValue: d.egbValue?.toString() || '',
          egbType: (d.egbType as 'mill' | 'purchase') || ((d.egbValue && parseFloat(d.egbValue) > 0) ? 'purchase' : 'mill'),
          customDivisor: d.customDivisor?.toString() || '',
          remarks: ''
        });
      } else {
        resetOfferData(entry);
      }
    } catch {
      resetOfferData(entry);
    }
    setShowOfferModal(true);
  };

  const resetOfferData = (entry: SampleEntry) => {
    setOfferData({
      offerRate: entry.offeringPrice?.toString() || '',
      sute: '',
      suteUnit: entry.suit || 'per_bag',
      baseRateType: entry.offerBaseRate || 'PD_LOOSE',
      baseRateUnit: entry.perUnit || 'per_bag',
      offerBaseRateValue: '',
      hamaliEnabled: entry.hamali || false,
      hamaliPerKg: '',
      hamaliPerQuintal: '',
      hamaliUnit: entry.perUnit || 'per_bag',
      moistureValue: '',
      brokerageValue: entry.brokerage?.toString() || '',
      brokerageEnabled: false,
      brokerageUnit: entry.perUnit || 'per_bag',
      lfValue: entry.lf?.toString() || '',
      lfEnabled: false,
      lfUnit: entry.perUnit || 'per_bag',
      egbValue: entry.egb?.toString() || '',
      egbType: 'mill' as 'mill' | 'purchase',
      customDivisor: entry.customDivisor?.toString() || '',
      remarks: ''
    });
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
          offerRate: parseFloat(offerData.offerRate),
          sute: offerData.sute ? parseFloat(offerData.sute) : 0,
          suteUnit: offerData.suteUnit,
          baseRateType: offerData.baseRateType,
          baseRateUnit: offerData.baseRateUnit,
          offerBaseRateValue: offerData.offerBaseRateValue ? parseFloat(offerData.offerBaseRateValue) : 0,
          hamaliEnabled: offerData.hamaliEnabled,
          hamaliPerKg: offerData.hamaliPerKg ? parseFloat(offerData.hamaliPerKg) : 0,
          hamaliPerQuintal: offerData.hamaliPerQuintal ? parseFloat(offerData.hamaliPerQuintal) : 0,
          hamaliUnit: offerData.hamaliUnit,
          moistureValue: offerData.moistureValue ? parseFloat(offerData.moistureValue) : 0,
          brokerageValue: offerData.brokerageValue ? parseFloat(offerData.brokerageValue) : 0,
          brokerageEnabled: offerData.brokerageEnabled,
          brokerageUnit: offerData.brokerageUnit,
          lfValue: offerData.lfValue ? parseFloat(offerData.lfValue) : 0,
          lfEnabled: offerData.lfEnabled,
          lfUnit: offerData.lfUnit,
          egbValue: offerData.egbType === 'mill' ? 0 : (offerData.egbValue ? parseFloat(offerData.egbValue) : 0),
          egbType: offerData.egbType,
          customDivisor: offerData.customDivisor ? parseFloat(offerData.customDivisor) : null,
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
    // Fetch offering data to auto-populate
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d: any = res.data;
      if (d) {
        setFinalData({
          finalSute: d.finalSute?.toString() || d.sute?.toString() || '',
          finalSuteUnit: d.finalSuteUnit || d.suteUnit || 'per_bag',
          finalBaseRate: d.finalBaseRate?.toString() || d.offerBaseRateValue?.toString() || '',
          baseRateType: d.baseRateType || 'PD_LOOSE',
          suteEnabled: d.suteEnabled !== false,
          moistureEnabled: d.moistureEnabled !== false,
          hamaliEnabled: d.hamaliEnabled || false,
          brokerageEnabled: d.brokerageEnabled || false,
          lfEnabled: d.lfEnabled || false,
          moistureValue: d.moistureValue?.toString() || '',
          hamali: d.hamali?.toString() || d.hamaliPerKg?.toString() || d.hamaliPerQuintal?.toString() || '',
          hamaliUnit: d.hamaliUnit || d.baseRateUnit || 'per_bag',
          brokerage: d.brokerage?.toString() || '',
          brokerageUnit: d.brokerageUnit || d.baseRateUnit || 'per_bag',
          lf: d.lf?.toString() || '',
          lfUnit: d.lfUnit || d.baseRateUnit || 'per_bag',
          egbValue: d.egbValue?.toString() || '',
          egbType: (d.egbType as 'mill' | 'purchase') || ((d.egbValue && parseFloat(d.egbValue) > 0) ? 'purchase' : 'mill'),
          customDivisor: d.customDivisor?.toString() || '',
          finalPrice: d.finalPrice?.toString() || entry.finalPrice?.toString() || '',
          remarks: ''
        });
      }
    } catch {
      setFinalData({
        finalSute: '', finalSuteUnit: 'per_bag', finalBaseRate: '', baseRateType: 'PD_LOOSE',
        suteEnabled: true, moistureEnabled: true,
        hamaliEnabled: false, brokerageEnabled: false, lfEnabled: false,
        moistureValue: '', hamali: '', hamaliUnit: 'per_bag',
        brokerage: '', brokerageUnit: 'per_bag', lf: '', lfUnit: 'per_bag', egbValue: '', egbType: 'mill' as 'mill' | 'purchase', customDivisor: '',
        finalPrice: entry.finalPrice?.toString() || '', remarks: ''
      });
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
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/final-price`,
        {
          finalSute: finalData.finalSute ? parseFloat(finalData.finalSute) : null,
          finalSuteUnit: finalData.finalSuteUnit,
          finalBaseRate: finalData.finalBaseRate ? parseFloat(finalData.finalBaseRate) : null,
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
          finalPrice: finalData.finalPrice ? parseFloat(finalData.finalPrice) : null,
          isFinalized: true
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

  // Build summary text for offering
  const buildOfferSummary = () => {
    const parts: string[] = [];
    if (offerData.offerRate) parts.push(`₹${offerData.offerRate}`);
    if (offerData.sute) parts.push(`${offerData.sute} sute ${offerData.suteUnit === 'per_kg' ? 'per kg' : 'per ton'}`);
    if (offerData.offerBaseRateValue) {
      const typeLabel = offerData.baseRateType.replace('_', '/');
      const unitLabel = offerData.baseRateUnit === 'per_bag' ? 'per bag' : 'per quintal';
      parts.push(`${offerData.offerBaseRateValue} ${typeLabel} ${unitLabel}`);
    }
    return parts.join(', ') || 'No data entered';
  };

  // Is EGB visible? Not for PD/WB and MD/WB
  const isEgbVisible = offerData.baseRateType !== 'PD_WB' && offerData.baseRateType !== 'MD_WB';
  // Custom divisor visible only for MD/Loose
  const isCustomDivisorVisible = offerData.baseRateType === 'MD_LOOSE';

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
                  brokerSeq++;
                  return (
                    <div key={brokerName} style={{ marginBottom: '0px' }}>
                      {/* Date bar — only first broker */}
                      {brokerIdx === 0 && <div style={{
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                        textAlign: 'center', letterSpacing: '0.5px'
                      }}>
                        {(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                        &nbsp;&nbsp;{entryType === 'RICE_SAMPLE' ? 'Rice Sample' : 'Paddy Sample'}
                      </div>}
                      {/* Broker name bar */}
                      <div style={{
                        background: '#e8eaf6',
                        color: '#000', padding: '3px 10px', fontWeight: '700', fontSize: '12px',
                        display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #c5cae9'
                      }}>
                        <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', border: '1px solid #000' }}>
                        <thead>
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
                          {brokerEntries.map((entry, index) => {
                            const o = offeringCache[entry.id] || entry.offering;
                            const slNo = index + 1;
                            const rowType = entry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'RL' : entry.entryType === 'LOCATION_SAMPLE' ? 'LS' : 'MS';
                            const qp = entry.qualityParameters || {};
                            const cp = entry.cookingReport || {};
                            return (
                              <tr key={entry.id} style={{ backgroundColor: entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff' }}>
                                {isRiceMode ? (
                                  <>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }}>{slNo}</td>
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
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '600' }}>{slNo}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '700' }}>{rowType}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '600' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{entry.packaging || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', fontWeight: '600', color: '#0d47a1' }}>{toTitleCase(entry.partyName)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{toTitleCase(entry.location) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{toTitleCase(entry.variety) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{entry.sampleCollectedBy || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{qp.grainsCount ? `[${qp.grainsCount}]` : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`${toNumberText(qp.moisture)}${qp.dryMoisture ? ` | ${toNumberText(qp.dryMoisture)}` : ''}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`${toNumberText(qp.cutting1)} x ${toNumberText(qp.cutting2)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`${toNumberText(qp.bend1 || qp.bend)} x ${toNumberText(qp.bend2)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`S-${toNumberText(qp.mixS)} L-${toNumberText(qp.mixL)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`${toNumberText(qp.oil)} | ${toNumberText(qp.kandu)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{toNumberText(qp.sk)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{`R-${toNumberText(qp.wbR)} BK-${toNumberText(qp.wbBk)} T-${toNumberText(qp.wbT)}`}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{toNumberText(qp.paddyWb)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left' }}>{qp.reportedBy || entry.creator?.username || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      <div style={{ fontWeight: '700', color: '#00695c' }}>{cookingStatusLabel(cp.status)}</div>
                                      {cp.remarks ? <div style={{ fontSize: '10px', color: '#455a64' }}>{cp.remarks}</div> : null}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      {isAdmin ? (
                                        <button onClick={() => handleOpenOfferModal(entry)} style={{ fontSize: '10px', padding: '3px 7px', backgroundColor: o?.offerBaseRateValue ? '#3498db' : '#2196F3', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700' }}>
                                          {o?.offerBaseRateValue ? `Rs ${toNumberText(o.offerBaseRateValue)}` : 'Add Offer'}
                                        </button>
                                      ) : <span>{o?.offerBaseRateValue ? `Rs ${toNumberText(o.offerBaseRateValue)}` : '-'}</span>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>
                                      {(isAdmin || isManager) && (entry.offeringPrice || o) ? (
                                        <button onClick={() => handleOpenFinalModal(entry)} style={{ fontSize: '10px', padding: '3px 7px', backgroundColor: entry.finalPrice || o?.finalPrice ? '#27ae60' : '#e67e22', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700' }}>
                                          {entry.finalPrice || o?.finalPrice ? `Rs ${toNumberText(o?.finalPrice || entry.finalPrice)}` : 'Add Final'}
                                        </button>
                                      ) : <span>{o?.finalPrice || entry.finalPrice ? `Rs ${toNumberText(o?.finalPrice || entry.finalPrice)}` : '-'}</span>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: '700', color: entry.lotSelectionDecision === 'SOLDOUT' ? '#b71c1c' : '#444' }}>
                                      {entry.lotSelectionDecision === 'SOLDOUT' ? 'Sold Out' : '-'}
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

      {/* ==================== OFFERING PRICE MODAL ==================== */}
      {
        showOfferModal && selectedEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '24px', borderRadius: '12px',
              width: '100%', maxWidth: '800px', maxHeight: '90vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              overflowY: 'auto'
            }}>
              <h3 style={{
                marginTop: 0, marginBottom: '14px', fontSize: '18px', fontWeight: '700',
                color: '#2c3e50', borderBottom: '3px solid #3498db', paddingBottom: '10px',
                textAlign: 'center'
              }}>
                {selectedEntry.brokerName}
              </h3>

              {/* Entry Info - one line */}
              <div style={{
                backgroundColor: '#eaf2f8', padding: '8px 12px', borderRadius: '6px',
                marginBottom: '14px', fontSize: '12px', textAlign: 'center'
              }}>
                Bags: <b>{selectedEntry.bags?.toLocaleString('en-IN')}</b> | Pkg: <b>{selectedEntry.packaging || '75'} Kg</b> | Party: <b>{selectedEntry.partyName}</b> | <b>{selectedEntry.location}</b> | <b>{selectedEntry.variety}</b>
              </div>

              <form onSubmit={handleSubmitOffer}>
                {/* Row 1: Offer Rate + Sute + Moisture */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Offer Rate *</label>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <select value={offerData.baseRateType}
                        onChange={e => setOfferData({ ...offerData, baseRateType: e.target.value })}
                        style={{ ...inputStyle, flex: '0 0 100px', cursor: 'pointer', fontSize: '11px' }} required>
                        <option value="PD_LOOSE">PD/Loose</option>
                        <option value="PD_WB">PD/WB</option>
                        <option value="MD_WB">MD/WB</option>
                        <option value="MD_LOOSE">MD/Loose</option>
                      </select>
                      <input type="number" step="0.01" value={offerData.offerBaseRateValue}
                        onChange={e => setOfferData({ ...offerData, offerBaseRateValue: e.target.value })}
                        style={{ ...inputStyle, flex: '1' }} placeholder="Rate" />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}>
                        <input type="radio" name="baseRateUnit" checked={offerData.baseRateUnit === 'per_bag'}
                          onChange={() => setOfferData({ ...offerData, baseRateUnit: 'per_bag', hamaliUnit: 'per_bag', brokerageUnit: 'per_bag', lfUnit: 'per_bag' })} /> Per Bag
                      </label>
                      <label style={radioLabelStyle}>
                        <input type="radio" name="baseRateUnit" checked={offerData.baseRateUnit === 'per_quintal'}
                          onChange={() => setOfferData({ ...offerData, baseRateUnit: 'per_quintal', hamaliUnit: 'per_quintal', brokerageUnit: 'per_quintal', lfUnit: 'per_quintal' })} /> Per Qtl
                      </label>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Sute</label>
                    <input type="number" step="0.01" value={offerData.sute}
                      onChange={e => setOfferData({ ...offerData, sute: e.target.value })}
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
                  <div>
                    <label style={labelStyle}>Moisture (%)</label>
                    <input type="number" step="0.01" value={offerData.moistureValue}
                      onChange={e => setOfferData({ ...offerData, moistureValue: e.target.value })}
                      style={inputStyle} placeholder="Moisture %" />
                  </div>
                </div>

                {/* Row 2: Hamali + Brokerage + LF with Yes/No */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Hamali</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="offerHamaliEnabled" checked={offerData.hamaliEnabled}
                        onChange={() => setOfferData({ ...offerData, hamaliEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="offerHamaliEnabled" checked={!offerData.hamaliEnabled}
                        onChange={() => setOfferData({ ...offerData, hamaliEnabled: false, hamaliPerKg: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {offerData.hamaliEnabled && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" step="0.01" value={offerData.hamaliPerKg}
                          onChange={e => setOfferData({ ...offerData, hamaliPerKg: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={offerData.hamaliUnit} onChange={e => setOfferData({ ...offerData, hamaliUnit: e.target.value })}
                          style={{ ...inputStyle, width: '85px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Brokerage</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="offerBrokerageEnabled" checked={offerData.brokerageEnabled}
                        onChange={() => setOfferData({ ...offerData, brokerageEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="offerBrokerageEnabled" checked={!offerData.brokerageEnabled}
                        onChange={() => setOfferData({ ...offerData, brokerageEnabled: false, brokerageValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {offerData.brokerageEnabled && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" step="0.01" value={offerData.brokerageValue}
                          onChange={e => setOfferData({ ...offerData, brokerageValue: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={offerData.brokerageUnit} onChange={e => setOfferData({ ...offerData, brokerageUnit: e.target.value })}
                          style={{ ...inputStyle, width: '85px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>LF</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="offerLfEnabled" checked={offerData.lfEnabled}
                        onChange={() => setOfferData({ ...offerData, lfEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="offerLfEnabled" checked={!offerData.lfEnabled}
                        onChange={() => setOfferData({ ...offerData, lfEnabled: false, lfValue: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {offerData.lfEnabled && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" step="0.01" value={offerData.lfValue}
                          onChange={e => setOfferData({ ...offerData, lfValue: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={offerData.lfUnit} onChange={e => setOfferData({ ...offerData, lfUnit: e.target.value })}
                          style={{ ...inputStyle, width: '85px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: EGB + Custom Divisor (conditional) */}
                {(isEgbVisible || isCustomDivisorVisible) && (
                  <div style={{ display: 'grid', gridTemplateColumns: isCustomDivisorVisible ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '12px' }}>
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
                      <input type="number" step="0.01" value={offerData.egbType === 'mill' ? '0' : offerData.egbValue}
                        onChange={e => setOfferData({ ...offerData, egbValue: e.target.value })}
                        disabled={offerData.egbType === 'mill'}
                        style={{ ...inputStyle, backgroundColor: offerData.egbType === 'mill' ? '#f0f0f0' : '#fff', cursor: offerData.egbType === 'mill' ? 'not-allowed' : 'text' }} placeholder={offerData.egbType === 'mill' ? '0 (Mill - Own Bags)' : 'EGB value'} /></div>)}
                    {isCustomDivisorVisible && (<div><label style={labelStyle}>Custom Divisor</label>
                      <input type="number" step="0.01" value={offerData.customDivisor}
                        onChange={e => setOfferData({ ...offerData, customDivisor: e.target.value })}
                        style={inputStyle} placeholder="Divisor" /></div>)}
                  </div>
                )}

                {/* Summary */}
                <div style={{ backgroundColor: '#e8f5e9', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '11px', border: '1px solid #c8e6c9' }}>
                  <strong style={{ color: '#2e7d32' }}>Summary:</strong>
                  <span style={{ marginLeft: '6px', color: '#555' }}>{buildOfferSummary()}</span>
                </div>

                {/* Remarks */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Remarks</label>
                  <textarea value={offerData.remarks} onChange={e => setOfferData({ ...offerData, remarks: e.target.value })}
                    style={{ ...inputStyle, minHeight: '40px' }} placeholder="Enter remarks..." />
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
            zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '24px', borderRadius: '12px',
              width: '100%', maxWidth: '900px', maxHeight: '90vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              overflowY: 'auto'
            }}>
              <h3 style={{
                marginTop: 0, marginBottom: '14px', fontSize: '18px', fontWeight: '700',
                color: '#2c3e50', borderBottom: '3px solid #27ae60', paddingBottom: '10px',
                textAlign: 'center'
              }}>
                {selectedEntry.brokerName}
              </h3>

              {/* Entry Info - one line */}
              <div style={{
                backgroundColor: '#e8f8f5', padding: '8px 12px', borderRadius: '6px',
                marginBottom: '14px', fontSize: '12px', textAlign: 'center'
              }}>
                Bags: <b>{selectedEntry.bags?.toLocaleString('en-IN')}</b> | Pkg: <b>{selectedEntry.packaging || '75'} Kg</b> | Party: <b>{selectedEntry.partyName}</b> | <b>{selectedEntry.location}</b> | <b>{selectedEntry.variety}</b>
              </div>

              <form onSubmit={handleSubmitFinal}>
                {/* Row 1: Final Rate + Sute + Moisture */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Final Rate</label>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      <select value={finalData.baseRateType}
                        onChange={e => setFinalData({ ...finalData, baseRateType: e.target.value })}
                        style={{ ...inputStyle, flex: '0 0 100px', cursor: 'pointer', fontSize: '11px' }}>
                        <option value="PD_LOOSE">PD/Loose</option>
                        <option value="PD_WB">PD/WB</option>
                        <option value="MD_WB">MD/WB</option>
                        <option value="MD_LOOSE">MD/Loose</option>
                      </select>
                      <input type="number" step="0.01" value={finalData.finalBaseRate}
                        onChange={e => setFinalData({ ...finalData, finalBaseRate: e.target.value })}
                        style={{ ...inputStyle, flex: '1' }} placeholder="Rate" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Sute</label>
                    <input type="number" step="0.01" value={finalData.finalSute}
                      onChange={e => setFinalData({ ...finalData, finalSute: e.target.value })}
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
                  <div>
                    <label style={labelStyle}>Moisture (%)</label>
                    <input type="number" step="0.01" value={finalData.moistureValue}
                      onChange={e => setFinalData({ ...finalData, moistureValue: e.target.value, moistureEnabled: true })}
                      style={inputStyle} placeholder="Moisture %" />
                  </div>
                </div>

                {/* Row 2: Hamali + Brokerage + LF with Yes/No */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={labelStyle}>Hamali</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="finalHamaliEnabled" checked={finalData.hamaliEnabled}
                        onChange={() => setFinalData({ ...finalData, hamaliEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="finalHamaliEnabled" checked={!finalData.hamaliEnabled}
                        onChange={() => setFinalData({ ...finalData, hamaliEnabled: false, hamali: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {finalData.hamaliEnabled && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" step="0.01" value={finalData.hamali}
                          onChange={e => setFinalData({ ...finalData, hamali: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={finalData.hamaliUnit} onChange={e => setFinalData({ ...finalData, hamaliUnit: e.target.value })}
                          style={{ ...inputStyle, width: '85px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Brokerage</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="finalBrokerageEnabled" checked={finalData.brokerageEnabled}
                        onChange={() => setFinalData({ ...finalData, brokerageEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="finalBrokerageEnabled" checked={!finalData.brokerageEnabled}
                        onChange={() => setFinalData({ ...finalData, brokerageEnabled: false, brokerage: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {finalData.brokerageEnabled && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" step="0.01" value={finalData.brokerage}
                          onChange={e => setFinalData({ ...finalData, brokerage: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={finalData.brokerageUnit} onChange={e => setFinalData({ ...finalData, brokerageUnit: e.target.value })}
                          style={{ ...inputStyle, width: '85px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>LF</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
                      <label style={radioLabelStyle}><input type="radio" name="finalLfEnabled" checked={finalData.lfEnabled}
                        onChange={() => setFinalData({ ...finalData, lfEnabled: true })} /> <span style={{ color: '#27ae60', fontWeight: '600' }}>Yes</span></label>
                      <label style={radioLabelStyle}><input type="radio" name="finalLfEnabled" checked={!finalData.lfEnabled}
                        onChange={() => setFinalData({ ...finalData, lfEnabled: false, lf: '' })} /> <span style={{ color: '#e74c3c', fontWeight: '600' }}>No</span></label>
                    </div>
                    {finalData.lfEnabled && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="number" step="0.01" value={finalData.lf}
                          onChange={e => setFinalData({ ...finalData, lf: e.target.value })}
                          style={{ ...inputStyle, flex: 1 }} placeholder="Amount" />
                        <select value={finalData.lfUnit} onChange={e => setFinalData({ ...finalData, lfUnit: e.target.value })}
                          style={{ ...inputStyle, width: '85px', fontSize: '11px' }}>
                          <option value="per_bag">Per Bag</option>
                          <option value="per_quintal">Per Qtl</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 3: EGB + Custom Divisor (conditional) */}
                {(finalData.baseRateType === 'PD_LOOSE' || finalData.baseRateType === 'MD_LOOSE' ||
                  finalData.baseRateType === 'pd_loose' || finalData.baseRateType === 'md_loose') && (
                    <div style={{ display: 'grid', gridTemplateColumns: finalData.baseRateType === 'MD_LOOSE' || finalData.baseRateType === 'md_loose' ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
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
                        <input type="number" step="0.01" value={finalData.egbType === 'mill' ? '0' : finalData.egbValue}
                          onChange={e => setFinalData({ ...finalData, egbValue: e.target.value })}
                          disabled={finalData.egbType === 'mill'}
                          style={{ ...inputStyle, backgroundColor: finalData.egbType === 'mill' ? '#f0f0f0' : '#fff', cursor: finalData.egbType === 'mill' ? 'not-allowed' : 'text' }} placeholder={finalData.egbType === 'mill' ? '0 (Mill - Own Bags)' : 'EGB value'} />
                      </div>
                      {(finalData.baseRateType === 'MD_LOOSE' || finalData.baseRateType === 'md_loose') && (
                        <div>
                          <label style={labelStyle}>Custom Divisor</label>
                          <input type="number" step="0.01" value={finalData.customDivisor}
                            onChange={e => setFinalData({ ...finalData, customDivisor: e.target.value })}
                            style={inputStyle} placeholder="Divisor" />
                        </div>
                      )}
                    </div>
                  )}


                {/* Remarks */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Remarks</label>
                  <textarea value={finalData.remarks}
                    onChange={e => setFinalData({ ...finalData, remarks: e.target.value })}
                    style={{ ...inputStyle, minHeight: '40px' }} placeholder="Enter remarks..." />
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
          ← Prev
        </button>
        <span style={{ fontSize: '13px', color: '#666' }}>
          Page {currentPage} of {totalPages} &nbsp;({totalEntries} total)
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: currentPage >= totalPages ? '#eee' : '#fff', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          Next ←’
        </button>
      </div>
    </div >
  );
};

export default FinalReport;

