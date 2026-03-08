import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

import { useNotification } from '../contexts/NotificationContext';

import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  serialNo?: number;
  entryDate: string;
  createdAt: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  packaging?: string;
  lorryNumber?: string;
  entryType?: string;
  sampleCollectedBy?: string;
  workflowStatus: string;
  qualityParameters?: {
    moisture: number;
    cutting1: number;
    cutting2: number;
    bend: number;
    bend1: number;
    bend2: number;
    mixS: number;
    mixL: number;
    mix: number;
    kandu: number;
    oil: number;
    sk: number;
    grainsCount: number;
    wbR: number;
    wbBk: number;
    wbT: number;
    paddyWb: number;
    uploadFileUrl?: string;
    reportedBy: string;
  };
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';

interface LotSelectionProps {
  entryType?: string;
  excludeEntryType?: string;
}

const LotSelection: React.FC<LotSelectionProps> = ({ entryType, excludeEntryType }) => {
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailEntry, setDetailEntry] = useState<SampleEntry | null>(null);
  const [remarksModalData, setRemarksModalData] = useState<{ isOpen: boolean, text: string }>({ isOpen: false, text: '' });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 100;

  // Filters
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBroker, setFilterBroker] = useState('');



  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEntries();
  }, [page]);

  const loadEntries = async (fFrom?: string, fTo?: string, fBroker?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = { status: 'QUALITY_CHECK', page, pageSize: PAGE_SIZE };

      const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
      const dTo = fTo !== undefined ? fTo : filterDateTo;
      const b = fBroker !== undefined ? fBroker : filterBroker;

      if (dFrom) params.startDate = dFrom;
      if (dTo) params.endDate = dTo;
      if (b) params.broker = b;
      if (entryType) params.entryType = entryType;
      if (excludeEntryType) params.excludeEntryType = excludeEntryType;

      const response = await axios.get(`${API_URL}/sample-entries/by-role`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      setEntries(data.entries || []);
      if (data.total != null) {
        setTotal(data.total);
        setTotalPages(data.totalPages || Math.ceil(data.total / PAGE_SIZE));
      }
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
    setTimeout(() => {
      loadEntries();
    }, 0);
  };

  const handleClearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterBroker('');
    setPage(1);
    setTimeout(() => {
      loadEntries('', '', '');
    }, 0);
  };

  const handleDecision = async (entryId: string, decision: string) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/lot-selection`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let message = '';
      if (decision === 'PASS_WITHOUT_COOKING') {
        message = 'Entry passed and moved to Final Report';
      } else if (decision === 'PASS_WITH_COOKING') {
        message = 'Entry passed and moved to Cooking Report';
      } else if (decision === 'FAIL') {
        message = 'Entry marked as failed';
      } else if (decision === 'SOLDOUT') {
        message = 'Entry marked as sold out';
      }

      showNotification(message, 'success');
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to process decision', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique brokers for filter dropdown
  const brokersList = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.brokerName))).sort();
  }, [entries]);

  // Group entries by date then broker (no client-side filtering — filters are server-side now)
  const groupedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const dateA = new Date(a.entryDate).getTime();
      const dateB = new Date(b.entryDate).getTime();
      if (dateA !== dateB) return dateB - dateA; // Primary sort: Date DESC
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // Secondary sort: CreatedAt ASC for stable Sl No
    });

    const grouped: Record<string, Record<string, typeof sorted>> = {};
    sorted.forEach(entry => {
      const dateKey = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const brokerKey = entry.brokerName || 'Unknown';
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
      grouped[dateKey][brokerKey].push(entry);
    });
    return grouped;
  }, [entries]);



  return (
    <div>
      {/* Collapsible Filter Bar */}
      <div style={{ marginBottom: '0px' }}>
        <button
          onClick={() => setFiltersVisible(!filtersVisible)}
          style={{
            padding: '7px 16px',
            backgroundColor: filtersVisible ? '#e74c3c' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {filtersVisible ? '✕ Hide Filters' : '🔍 Filters'}
        </button>
        {filtersVisible && (
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            backgroundColor: '#fff',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid #e0e0e0'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>From Date</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>To Date</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Broker</label>
              <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                <option value="">All Brokers</option>
                {brokersList.map((b, i) => <option key={i} value={b}>{b}</option>)}
              </select>
            </div>
            {(filterDateFrom || filterDateTo || filterBroker) && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleApplyFilters}
                  style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', backgroundColor: '#3498db', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                  Apply Filters
                </button>
                <button onClick={handleClearFilters}
                  style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', backgroundColor: 'white' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries pending review</div>
        ) : (
          Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => {
            let brokerSeq = 0;
            return (
              <div key={dateKey} style={{ marginBottom: '20px' }}>
                {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                  brokerSeq++;
                  let slNo = 0;
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
                        color: '#000', padding: '4px 10px', fontWeight: '700', fontSize: '13.5px',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                        <thead>
                          {entryType !== 'RICE_SAMPLE' ? (
                            <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '2%' }}>SL No</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '2.5%' }}>Type</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Bags</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '2.5%' }}>Pkg</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '9%' }}>Party Name</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '7%' }}>Paddy Location</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '6%' }}>Variety</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '7%' }}>Sample Collected By</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Grain</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Moist</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Cutting</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bend</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3.5%' }}>Mix</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Oil/Kandu</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '2.5%' }}>SK</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>100 Gms</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3.5%' }}>Paddy WB</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '6%' }}>Sample Report By</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '8%' }}>Action</th>
                            </tr>
                          ) : (
                            <tr style={{ backgroundColor: '#4a148c', color: 'white' }}>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '2%' }}>SL No</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Bags</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '2.5%' }}>Pkg</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '9%' }}>Party Name</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '7%' }}>Rice Location</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '6%' }}>Variety</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '7%' }}>Sample Collected By</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Grain</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Moist</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Rice</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bendu</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3.5%' }}>Mix</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Oil</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Kandu</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>Broken</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '6%' }}>Sample Report By</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '5%' }}>Cooking Status</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Action</th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {brokerEntries.map((entry, index) => {
                            const displaySlNo = index + 1;
                            const qp = entry.qualityParameters;
                            const fmtVal = (v: any, forceDecimal = false, precision = 2) => {
                              const fallback = entryType === 'RICE_SAMPLE' ? '--' : '-';
                              if (v == null || v === '') return fallback;
                              const n = Number(v);
                              if (isNaN(n) || n === 0) return fallback;
                              if (forceDecimal) return n.toFixed(1);
                              if (precision > 2) return String(parseFloat(n.toFixed(precision)));
                              return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
                            };
                            const fallback = entryType === 'RICE_SAMPLE' ? '--' : '-';
                            const hasFullQuality = qp && ((qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0));
                            const has100Grams = qp && (qp.moisture != null || (qp as any).dryMoisture != null) && !hasFullQuality;
                            return (
                              <tr key={entry.id} style={{ backgroundColor: entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff' }}>
                                <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600', fontSize: '12px' }}>{displaySlNo}</td>
                                {entryType !== 'RICE_SAMPLE' ? (
                                  <>
                                    <td style={{ border: '1px solid #000', padding: '1px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                      {entry.entryType === 'DIRECT_LOADED_VEHICLE' && <span style={{ color: 'white', backgroundColor: '#1565c0', padding: '1px 3px', borderRadius: '3px', fontSize: '10px', fontWeight: '800' }}>RL</span>}
                                      {entry.entryType === 'LOCATION_SAMPLE' && <span style={{ color: 'white', backgroundColor: '#e67e22', padding: '1px 3px', borderRadius: '3px', fontSize: '10px', fontWeight: '800' }}>LS</span>}
                                      {entry.entryType !== 'DIRECT_LOADED_VEHICLE' && entry.entryType !== 'LOCATION_SAMPLE' && <span style={{ color: '#333', backgroundColor: '#fff', padding: '1px 3px', borderRadius: '3px', fontSize: '10px', fontWeight: '800', border: '1px solid #ccc' }}>MS</span>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600', fontSize: '12px' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'center' }}>
                                      {/^\d+$/.test(String(entry.packaging || '75')) ? `${entry.packaging || '75'} Kg` : entry.packaging || '75'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <div style={{ color: '#333', fontWeight: '600' }}>{toTitleCase(entry.partyName) || ''}</div>
                                      {entry.entryType === 'DIRECT_LOADED_VEHICLE' && entry.lorryNumber ? <div style={{ fontSize: '11px', color: '#555', fontWeight: '600' }}>{entry.lorryNumber.toUpperCase()}</div> : ''}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.location) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.variety)}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {entry.sampleCollectedBy ? toTitleCase(entry.sampleCollectedBy) : (entry as any).creator?.username ? toTitleCase((entry as any).creator.username) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', color: '#000' }}>{qp?.grainsCount ? `(${fmtVal(qp.grainsCount)})` : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && (fmtVal(qp.moisture) !== '-' || (qp as any).dryMoisture != null) ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          {fmtVal((qp as any).dryMoisture) !== '-' && <div style={{ fontSize: '10px', color: '#e67e22', fontWeight: '800' }}>{fmtVal((qp as any).dryMoisture, false, 3)}%</div>}
                                          <div>{fmtVal(qp.moisture, false, 3)}%</div>
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && (fmtVal(qp.cutting1) !== '-' || fmtVal(qp.cutting2) !== '-') ? `1×${fmtVal(qp.cutting2)}` : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && (fmtVal(qp.bend1) !== '-' || fmtVal(qp.bend2) !== '-') ? `1×${fmtVal(qp.bend2)}` : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '10px' }}>
                                      {qp && fmtVal(qp.mix) !== '-' ? (
                                        (fmtVal(qp.mixS) !== '-' || fmtVal(qp.mixL) !== '-') ? (
                                          <div style={{ display: 'inline-grid', gridTemplateColumns: '20px auto', alignItems: 'center', columnGap: '0px' }}>
                                            <div style={{ gridColumn: '2', fontSize: '11px', fontWeight: '600', color: '#555', textAlign: 'left' }}>{fmtVal(qp.mix)}</div>
                                            {fmtVal(qp.mixS) !== '-' && (
                                              <><div style={{ fontSize: '11px', color: '#000', textAlign: 'right', paddingRight: '2px' }}>S-</div><div style={{ fontSize: '11px', color: '#000', textAlign: 'left' }}>{fmtVal(qp.mixS)}</div></>
                                            )}
                                            {fmtVal(qp.mixL) !== '-' && (
                                              <><div style={{ fontSize: '11px', color: '#000', textAlign: 'right', paddingRight: '2px' }}>L-</div><div style={{ fontSize: '11px', color: '#000', textAlign: 'left' }}>{fmtVal(qp.mixL)}</div></>
                                            )}
                                          </div>
                                        ) : <span style={{ fontWeight: '600', color: '#555' }}>{fmtVal(qp.mix)}</span>
                                      ) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && (fmtVal(qp.oil) !== '-' || fmtVal(qp.kandu) !== '-') ? <div>{[fmtVal(qp.oil), fmtVal(qp.kandu)].filter(v => v !== '-').join(' | ')}</div> : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', fontWeight: '600' }}>{qp && fmtVal(qp.sk) !== '-' ? fmtVal(qp.sk) : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '10px', fontWeight: '600', color: '#555' }}>
                                      {qp && (fmtVal(qp.wbR) !== '-' || fmtVal(qp.wbBk) !== '-' || fmtVal(qp.wbT) !== '-') ? (
                                        <div style={{ display: 'inline-grid', gridTemplateColumns: '22px auto', alignItems: 'center', columnGap: '0px' }}>
                                          {fmtVal(qp.wbR) !== '-' && <><div style={{ textAlign: 'right', paddingRight: '2px' }}>R-</div><div style={{ textAlign: 'left' }}>{fmtVal(qp.wbR)}</div></>}
                                          {fmtVal(qp.wbBk) !== '-' && <><div style={{ textAlign: 'right', paddingRight: '2px' }}>BK-</div><div style={{ textAlign: 'left' }}>{fmtVal(qp.wbBk)}</div></>}
                                          {fmtVal(qp.wbT) !== '-' && <><div style={{ textAlign: 'right', paddingRight: '2px' }}>T-</div><div style={{ textAlign: 'left' }}>{fmtVal(qp.wbT)}</div></>}
                                        </div>
                                      ) : '-'}
                                    </td>
                                    <td style={{
                                      border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', fontWeight: '800',
                                      color: qp && fmtVal(qp.paddyWb) !== '-' ? (Number(qp.paddyWb) < 50 ? '#d32f2f' : (Number(qp.paddyWb) <= 50.5 ? '#f39c12' : '#2e7d32')) : '#000'
                                    }}>
                                      {qp && fmtVal(qp.paddyWb) !== '-' ? `${fmtVal(qp.paddyWb)} gms` : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {qp?.reportedBy ? toTitleCase(qp.reportedBy) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'stretch' }}>
                                        <button onClick={() => handleDecision(entry.id, 'PASS_WITH_COOKING')} disabled={isSubmitting} style={{ fontSize: '10px', padding: '4px 6px', backgroundColor: isSubmitting ? '#e0e0e0' : '#28a745', color: isSubmitting ? '#999' : 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '800', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                                          {isSubmitting ? '...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><span style={{ fontSize: '12px' }}>🍲</span> Pass for Cook</span>}
                                        </button>
                                        <button onClick={() => handleDecision(entry.id, 'PASS_WITHOUT_COOKING')} disabled={isSubmitting} style={{ fontSize: '10px', padding: '3px 6px', backgroundColor: isSubmitting ? '#e0e0e0' : '#f39c12', color: isSubmitting ? '#999' : 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '800', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
                                          {isSubmitting ? '...' : '✅ Pass'}
                                        </button>
                                        <button onClick={() => handleDecision(entry.id, 'FAIL')} disabled={isSubmitting} style={{ fontSize: '10px', padding: '3px 6px', backgroundColor: isSubmitting ? '#e0e0e0' : '#d9534f', color: isSubmitting ? '#999' : 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '800', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
                                          {isSubmitting ? '...' : '❌ Fail'}
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600', fontSize: '12px' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'center' }}>
                                      {/^\d+$/.test(String(entry.packaging || '26')) ? `${entry.packaging || '26'} Kg` : entry.packaging || '26'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <div style={{ color: '#333', fontWeight: '600' }}>{toTitleCase(entry.partyName) || ''}</div>
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.location) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.variety)}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {entry.sampleCollectedBy ? toTitleCase(entry.sampleCollectedBy) : (entry as any).creator?.username ? toTitleCase((entry as any).creator.username) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', color: '#000' }}>{qp?.grainsCount ? `(${fmtVal(qp.grainsCount)})` : fallback}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && (fmtVal(qp.moisture) !== fallback || (qp as any).dryMoisture != null) ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                          {fmtVal((qp as any).dryMoisture) !== fallback && <div style={{ fontSize: '10px', color: '#e67e22', fontWeight: '800' }}>{fmtVal((qp as any).dryMoisture, false, 3)}%</div>}
                                          <div>{fmtVal(qp.moisture, false, 3)}%</div>
                                        </div>
                                      ) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && fmtVal(qp.cutting1) !== fallback ? fmtVal(qp.cutting1) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && fmtVal(qp.bend1) !== fallback ? fmtVal(qp.bend1) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '10px' }}>
                                      {qp && fmtVal(qp.mix) !== fallback ? (
                                        (fmtVal(qp.mixS) !== fallback || fmtVal(qp.mixL) !== fallback) ? (
                                          <div style={{ display: 'inline-grid', gridTemplateColumns: '20px auto', alignItems: 'center', columnGap: '0px' }}>
                                            <div style={{ gridColumn: '2', fontSize: '11px', fontWeight: '600', color: '#555', textAlign: 'left' }}>{fmtVal(qp.mix)}</div>
                                            {fmtVal(qp.mixS) !== fallback && (
                                              <><div style={{ fontSize: '11px', color: '#000', textAlign: 'right', paddingRight: '2px' }}>S-</div><div style={{ fontSize: '11px', color: '#000', textAlign: 'left' }}>{fmtVal(qp.mixS)}</div></>
                                            )}
                                            {fmtVal(qp.mixL) !== fallback && (
                                              <><div style={{ fontSize: '11px', color: '#000', textAlign: 'right', paddingRight: '2px' }}>L-</div><div style={{ fontSize: '11px', color: '#000', textAlign: 'left' }}>{fmtVal(qp.mixL)}</div></>
                                            )}
                                          </div>
                                        ) : <span style={{ fontWeight: '600', color: '#555' }}>{fmtVal(qp.mix)}</span>
                                      ) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && fmtVal(qp.oil) !== fallback ? fmtVal(qp.oil) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {qp && fmtVal(qp.kandu) !== fallback ? fmtVal(qp.kandu) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '12px', fontWeight: '600' }}>{qp && fmtVal(qp.sk) !== fallback ? fmtVal(qp.sk) : fallback}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'left', verticalAlign: 'middle', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {qp?.reportedBy ? toTitleCase(qp.reportedBy) : fallback}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center', verticalAlign: 'middle', fontSize: '11px', fontWeight: '600' }}>
                                      {(() => {
                                        const cookingStatusData = (entry as any).cookingReport;
                                        const decision = (entry as any).lotSelectionDecision;

                                        if (decision === 'SOLDOUT') {
                                          return <span style={{ color: '#800000', fontWeight: '800' }}>SOLD OUT</span>;
                                        }

                                        if (!cookingStatusData) return <span style={{ color: '#f39c12' }}>Pending</span>;

                                        const status = (cookingStatusData.status || '').toUpperCase();
                                        if (!status) return <span style={{ color: '#f39c12' }}>Pending</span>;

                                        const badgeConfig = {
                                          'PASS': { color: '#27ae60', label: 'Passed', icon: '✅' },
                                          'FAIL': { color: '#c0392b', label: 'Failed', icon: '❌' },
                                          'RECHECK': { color: '#e67e22', label: 'Recheck', icon: '📝' },
                                          'MEDIUM': { color: '#2980b9', label: 'Medium', icon: '➖' },
                                        };
                                        const config = (badgeConfig as any)[status] || { color: '#7f8c8d', label: cookingStatusData.status || status, icon: '❔' };

                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                            <span style={{ color: config.color }}>{config.icon} {config.label}</span>
                                            {cookingStatusData.remarks && (
                                              <button
                                                type="button"
                                                onClick={() => setRemarksModalData({ isOpen: true, text: cookingStatusData.remarks })}
                                                style={{
                                                  marginTop: '2px',
                                                  fontSize: '9px',
                                                  padding: '2px 6px',
                                                  backgroundColor: '#f3e5f5',
                                                  color: '#4a148c',
                                                  border: '1px solid #ce93d8',
                                                  borderRadius: '10px',
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '2px',
                                                  fontWeight: '700'
                                                }}
                                                title="View Remarks"
                                              >
                                                💬 Remarks
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
                                        <button onClick={() => handleDecision(entry.id, 'PASS_WITHOUT_COOKING')} disabled={isSubmitting} style={{ fontSize: '10px', padding: '4px 6px', backgroundColor: isSubmitting ? '#e0e0e0' : '#28a745', color: isSubmitting ? '#999' : 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '800', width: '48%', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                                          {isSubmitting ? '...' : 'Pass'}
                                        </button>
                                        <button onClick={() => handleDecision(entry.id, 'FAIL')} disabled={isSubmitting} style={{ fontSize: '10px', padding: '4px 6px', backgroundColor: isSubmitting ? '#e0e0e0' : '#d9534f', color: isSubmitting ? '#999' : 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '800', width: '48%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                          {isSubmitting ? '...' : 'Fail'}
                                        </button>
                                        <button onClick={() => handleDecision(entry.id, 'SOLDOUT')} disabled={isSubmitting} style={{ fontSize: '10px', padding: '4px 6px', backgroundColor: isSubmitting ? '#e0e0e0' : '#800000', color: isSubmitting ? '#999' : 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '800', width: '100%', marginTop: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                          {isSubmitting ? '...' : 'Sold Out'}
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
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
          })
        )}
      </div>

      {/* Detail Popup - shows all quality data when clicking party name */}
      {
        detailEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999
          }} onClick={() => setDetailEntry(null)}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '0',
              width: '500px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', overflowX: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }} onClick={e => e.stopPropagation()}>
              {/* Redesigned Header — Green Background, Aligned Items */}
              <div style={{
                background: detailEntry.entryType === 'DIRECT_LOADED_VEHICLE'
                  ? '#1565c0'
                  : detailEntry.entryType === 'LOCATION_SAMPLE'
                    ? '#e67e22'
                    : '#4caf50',
                padding: '16px 20px', borderRadius: '8px 8px 0 0', color: 'white',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', opacity: 0.9 }}>
                    {new Date(detailEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '22px', fontWeight: '900', letterSpacing: '1.5px', whiteSpace: 'nowrap' }}>
                    {detailEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'Ready Lorry' : detailEntry.entryType === 'LOCATION_SAMPLE' ? 'Location Sample' : 'Mill Sample'}
                  </div>
                </div>
                <div style={{
                  fontSize: '24px', fontWeight: '900', letterSpacing: '0.5px', marginTop: '2px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%'
                }}>
                  {toTitleCase(detailEntry.brokerName) || '-'}
                </div>
                <button onClick={() => setDetailEntry(null)} style={{
                  position: 'absolute', top: '16px', right: '16px',
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                  width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px',
                  color: 'white', fontWeight: '900', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}>✕</button>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {/* Entry Details — Date, Bags, Pack, Variety, Party, Location, Lorry, Sample Collected By */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                  {[
                    ['Date', new Date(detailEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                    ['Bags', detailEntry.bags?.toLocaleString('en-IN')],
                    ['Packaging', `${detailEntry.packaging || '75'} Kg`],
                    ['Variety', detailEntry.variety],
                  ].map(([label, value], i) => (
                    <div key={i} style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{value || '-'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                  {[
                    ['Party Name', toTitleCase(detailEntry.partyName) || (detailEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? detailEntry.lorryNumber?.toUpperCase() : '')],
                    ['Paddy Location', detailEntry.location],
                    ['Sample Collected By', toTitleCase(detailEntry.sampleCollectedBy || '-')],
                  ].map(([label, value], i) => (
                    <div key={i} style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{value || '-'}</div>
                    </div>
                  ))}
                </div>

                {/* Quality Parameters — grouped rows, hide 0 values */}
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#e67e22', borderBottom: '2px solid #e67e22', paddingBottom: '6px' }}>🔬 Quality Parameters</h4>
                {(() => {
                  const qp = detailEntry.qualityParameters;
                  const fmt = (v: any, forceDecimal = false, precision = 2) => {
                    if (v == null || v === '') return null;
                    const n = Number(v);
                    if (isNaN(n) || n === 0) return null;
                    if (forceDecimal) return n.toFixed(1);
                    if (precision > 2) return String(parseFloat(n.toFixed(precision)));
                    return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
                  };
                  const fmtB = (v: any, useBrackets = false) => {
                    const formatted = fmt(v);
                    return formatted && useBrackets ? `(${formatted})` : formatted;
                  };
                  const QItem = ({ label, value }: { label: string; value: any }) => {
                    const isBold = ['Grains Count', 'Paddy WB'].includes(label);
                    return (
                      <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px', fontWeight: '600' }}>{label}</div>
                        <div style={{ fontSize: '13px', fontWeight: isBold ? '800' : '700', color: isBold ? '#000' : '#2c3e50' }}>{value || '-'}</div>
                      </div>
                    );
                  };
                  if (!qp) return <div style={{ color: '#999', textAlign: 'center', padding: '12px' }}>No quality data available</div>;
                  // Row 1: Moisture (with dry moisture), Cutting, Bend, Grains Count
                  const row1: { label: string; value: any }[] = [];
                  if (fmt(qp.moisture)) {
                    const dryVal = fmt((qp as any).dryMoisture, false, 3);
                    row1.push({
                      label: 'Moisture',
                      value: dryVal ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                          <span style={{ color: '#e67e22', fontWeight: '800', fontSize: '11px' }}>{dryVal}%</span>
                          <span>{fmt(qp.moisture, false, 3)}%</span>
                        </div>
                      ) : `${fmt(qp.moisture, false, 3)}%`
                    });
                  }
                  if (qp.cutting1 && qp.cutting2 && (Number(qp.cutting1) !== 0 || Number(qp.cutting2) !== 0)) row1.push({ label: 'Cutting', value: `${fmt(qp.cutting1)}×${fmt(qp.cutting2)}` });
                  if (qp.bend1 && qp.bend2 && (Number(qp.bend1) !== 0 || Number(qp.bend2) !== 0)) row1.push({ label: 'Bend', value: `${fmt(qp.bend1)}×${fmt(qp.bend2)}` });
                  if (fmtB(qp.grainsCount, true)) row1.push({ label: 'Grains Count', value: fmtB(qp.grainsCount, true)! });
                  // Row 2: Mix, S Mix, L Mix
                  const row2: { label: string; value: string }[] = [];
                  if (fmt(qp.mix)) row2.push({ label: 'Mix', value: fmtB(qp.mix)! });
                  if (fmt(qp.mixS)) row2.push({ label: 'S Mix', value: fmtB(qp.mixS)! });
                  if (fmt(qp.mixL)) row2.push({ label: 'L Mix', value: fmtB(qp.mixL)! });
                  // Row 3: Kandu, Oil, SK — fixed 3-column grid (keep positions even if one is missing)
                  const hasKandu = fmt(qp.kandu);
                  const hasOil = fmt(qp.oil);
                  const hasSK = fmt(qp.sk);
                  const showRow3 = hasKandu || hasOil || hasSK;
                  // Row 4: WB-R, WB-BK, WB-T
                  const row4: { label: string; value: string }[] = [];
                  if (fmt(qp.wbR)) row4.push({ label: 'WB-R', value: fmtB(qp.wbR)! });
                  if (fmt(qp.wbBk)) row4.push({ label: 'WB-BK', value: fmtB(qp.wbBk)! });
                  if (fmt(qp.wbT)) row4.push({ label: 'WB-T', value: fmtB(qp.wbT)! });
                  // Row 5: Paddy WB (own line)
                  const hasPaddyWb = fmt(qp.paddyWb);
                  return (
                    <div>
                      {row1.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row1.length}, 1fr)`, gap: '8px', marginBottom: '8px' }}>
                          {row1.map(item => <QItem key={item.label} label={item.label} value={item.value} />)}
                        </div>
                      )}
                      {row2.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row2.length}, 1fr)`, gap: '8px', marginBottom: '8px' }}>
                          {row2.map(item => <QItem key={item.label} label={item.label} value={item.value} />)}
                        </div>
                      )}
                      {showRow3 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                          {hasKandu ? <QItem label="Kandu" value={fmtB(qp.kandu)!} /> : <div />}
                          {hasOil ? <QItem label="Oil" value={fmtB(qp.oil)!} /> : <div />}
                          {hasSK ? <QItem label="SK" value={fmtB(qp.sk)!} /> : <div />}
                        </div>
                      )}
                      {row4.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row4.length}, 1fr)`, gap: '8px', marginBottom: '8px' }}>
                          {row4.map(item => <QItem key={item.label} label={item.label} value={item.value} />)}
                        </div>
                      )}
                      {hasPaddyWb && (
                        <div style={{
                          marginTop: '10px',
                          background: Number(qp.paddyWb) < 50 ? '#fff5f5' : (Number(qp.paddyWb) <= 50.5 ? '#fff9f0' : '#e8f5e9'),
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${Number(qp.paddyWb) < 50 ? '#feb2b2' : (Number(qp.paddyWb) <= 50.5 ? '#fbd38d' : '#c8e6c9')}`,
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '10px', color: Number(qp.paddyWb) < 50 ? '#c53030' : (Number(qp.paddyWb) <= 50.5 ? '#9c4221' : '#2e7d32'), marginBottom: '2px', fontWeight: '600' }}>Paddy WB</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: Number(qp.paddyWb) < 50 ? '#d32f2f' : (Number(qp.paddyWb) <= 50.5 ? '#f39c12' : '#1b5e20') }}>{fmtB(qp.paddyWb)}</div>
                        </div>
                      )}
                      {qp.reportedBy && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600' }}>Sample Reported By</div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{toTitleCase(qp.reportedBy)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Final Price Details Section */}
                {(() => {
                  const fp = (detailEntry as any).finalPriceData || (detailEntry as any).offering;
                  if (!fp?.finalPrice && !fp?.finalBaseRate) return null;
                  const unitLabel = (u: string) => u === 'per_bag' ? 'Per Bag' : u === 'per_quintal' ? 'Per Qtl' : u === 'per_ton' ? 'Per Ton' : '-';
                  return (
                    <>
                      <h4 style={{ margin: '16px 0 10px', fontSize: '13px', color: '#27ae60', borderBottom: '2px solid #27ae60', paddingBottom: '6px' }}>💰 Final Price Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>Final Rate</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>₹{fp.finalPrice || fp.finalBaseRate || '-'} {(fp.baseRateType || '').replace(/_/g, '/')} {unitLabel(fp.baseRateUnit || 'per_bag')}</div>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>Sute</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>{fp.finalSute || fp.sute || '-'} {unitLabel(fp.finalSuteUnit || fp.suteUnit || 'per_bag')}</div>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>Moisture</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>{fp.moistureValue || '-'}%</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>Hamali</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>{fp.hamaliEnabled !== false ? (fp.hamali || fp.hamaliPerKg || '-') : 'No'} {fp.hamaliEnabled !== false ? unitLabel(fp.hamaliUnit || 'per_bag') : ''}</div>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>Brokerage</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>{fp.brokerageEnabled !== false ? (fp.brokerage || '-') : 'No'} {fp.brokerageEnabled !== false ? unitLabel(fp.brokerageUnit || 'per_bag') : ''}</div>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>LF</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>{fp.lfEnabled !== false ? (fp.lf || '-') : 'No'} {fp.lfEnabled !== false ? unitLabel(fp.lfUnit || 'per_bag') : ''}</div>
                        </div>
                        <div style={{ background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' as const }}>EGB</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>{fp.egbValue || '-'}</div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <button onClick={() => setDetailEntry(null)}
                  style={{ marginTop: '16px', width: '100%', padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Remarks Modal */}
      {remarksModalData.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '380px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#333', fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              📝 Cooking Remarks
            </h3>
            <div style={{
              marginBottom: '20px',
              color: '#444',
              fontSize: '14px',
              lineHeight: '1.5',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '10px',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
              border: '1px solid #e0e0e0'
            }}>
              {remarksModalData.text}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRemarksModalData({ isOpen: false, text: '' })}
                style={{ padding: '8px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px 0', marginTop: '12px' }}>
        <button
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page <= 1 ? '#eee' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: '13px', color: '#666' }}>
          Page {page} of {totalPages} &nbsp;({total} total)
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page >= totalPages ? '#eee' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          Next →
        </button>
      </div>
    </div >
  );
};

export default LotSelection;
