import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

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
  packaging?: string;
  workflowStatus: string;
  qualityParameters?: {
    moisture: number;
    cutting1: number;
    cutting2: number;
    bend: number;
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

const LotSelection: React.FC = () => {
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Detail popup
  const [detailEntry, setDetailEntry] = useState<SampleEntry | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEntries();
  }, [page]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = { status: 'QUALITY_CHECK', page, pageSize: PAGE_SIZE };
      if (filterDateFrom) params.startDate = filterDateFrom;
      if (filterDateTo) params.endDate = filterDateTo;
      if (filterBroker) params.broker = filterBroker;
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
    loadEntries();
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
    const sorted = [...entries].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

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

  let globalSlNo = 0;

  return (
    <div>
      {/* Collapsible Filter Bar */}
      <div style={{ marginBottom: '12px' }}>
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
                <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterBroker(''); setPage(1); setTimeout(loadEntries, 0); }}
                  style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #ddd' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries pending review</div>
        ) : (
          Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => (
            <div key={dateKey} style={{ marginBottom: '16px' }}>
              {Object.entries(brokerGroups).map(([brokerName, brokerEntries]) => (
                <div key={brokerName}>
                  {/* Merged Date + Broker Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    color: 'white', padding: '8px 12px', fontWeight: '700', fontSize: '13px',
                    letterSpacing: '0.5px', textAlign: 'center'
                  }}>
                    {dateKey} — {brokerName} ({brokerEntries.length})
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', width: '40px', whiteSpace: 'nowrap' }}>SL</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Bags</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Pkg</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Party</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Paddy Location</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Variety</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Grains</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Image</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Sample Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokerEntries.map((entry, index) => {
                        globalSlNo++;
                        return (
                          <tr key={entry.id} style={{
                            backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                          }}>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>{globalSlNo}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.bags}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.packaging || '75'} Kg</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', cursor: 'pointer', color: '#2980b9', fontWeight: '600', whiteSpace: 'nowrap' }}
                              onClick={() => setDetailEntry(entry)}>
                              {entry.partyName}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.location}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.variety}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                              {entry.qualityParameters?.grainsCount || '-'}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                              {entry.qualityParameters?.uploadFileUrl ? (
                                <a href={entry.qualityParameters.uploadFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4a90e2', textDecoration: 'none' }}>
                                  📷
                                </a>
                              ) : '-'}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => handleDecision(entry.id, 'PASS_WITHOUT_COOKING')}
                                  disabled={isSubmitting}
                                  style={{
                                    fontSize: '9px',
                                    padding: '4px 8px',
                                    backgroundColor: isSubmitting ? '#e0e0e0' : '#e67e22',
                                    color: isSubmitting ? '#999' : 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  {isSubmitting ? '...' : 'Pass without Cooking'}
                                </button>
                                <button
                                  onClick={() => handleDecision(entry.id, 'PASS_WITH_COOKING')}
                                  disabled={isSubmitting}
                                  style={{
                                    fontSize: '9px',
                                    padding: '4px 8px',
                                    backgroundColor: isSubmitting ? '#e0e0e0' : '#27ae60',
                                    color: isSubmitting ? '#999' : 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  {isSubmitting ? '...' : 'Pass with Cooking'}
                                </button>
                                <button
                                  onClick={() => handleDecision(entry.id, 'FAIL')}
                                  disabled={isSubmitting}
                                  style={{
                                    fontSize: '9px',
                                    padding: '4px 8px',
                                    backgroundColor: isSubmitting ? '#e0e0e0' : '#e74c3c',
                                    color: isSubmitting ? '#999' : 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  {isSubmitting ? '...' : 'Fail'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Detail Popup - shows all quality data when clicking party name */}
      {detailEntry && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setDetailEntry(null)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', padding: '0',
            width: '500px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
              padding: '16px 20px', borderRadius: '8px 8px 0 0', color: 'white',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                  Complete Entry Details
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.9 }}>
                  <span style={{ color: '#ffd700', fontWeight: '600' }}>{detailEntry.brokerName}</span> | {new Date(detailEntry.entryDate).toLocaleDateString('en-GB')}
                </p>
              </div>
              <button onClick={() => setDetailEntry(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '16px', color: 'white', fontWeight: '700' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {/* Staff Entry Section */}
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '6px' }}>👤 Staff Entry Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                {[
                  ['Date', new Date(detailEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                  ['Bags', detailEntry.bags],
                  ['Packaging', `${detailEntry.packaging || '75'} Kg`],
                  ['Party Name', detailEntry.partyName],
                  ['Paddy Location', detailEntry.location],
                  ['Lorry Number', (detailEntry as any).lorryNumber || '-'],
                  ['Variety', detailEntry.variety],
                  ['Sample Collected By', (detailEntry as any).sampleCollectedBy || '-'],
                ].map(([label, value], i) => (
                  <div key={i} style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{value || '-'}</div>
                  </div>
                ))}
              </div>

              {/* Quality Parameters Section */}
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#e67e22', borderBottom: '2px solid #e67e22', paddingBottom: '6px' }}>🔬 Quality Parameters {detailEntry.qualityParameters?.reportedBy && <span style={{ fontSize: '11px', color: '#666', fontWeight: '400' }}> — Reported by: {detailEntry.qualityParameters.reportedBy}</span>}</h4>
              {(() => {
                const qp = detailEntry.qualityParameters;
                const fmt = (v: any) => {
                  if (v == null || v === '') return '-';
                  const n = Number(v);
                  if (isNaN(n)) return String(v);
                  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
                };
                const QItem = ({ label, value }: { label: string; value: string }) => (
                  <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{value || '-'}</div>
                  </div>
                );
                return qp ? (
                  <div>
                    {/* Row 1: Moisture, Cutting, Bend, Grains Count */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                      <QItem label="Moisture" value={`${fmt(qp.moisture)}%`} />
                      <QItem label="Cutting" value={qp.cutting1 && qp.cutting2 ? `${fmt(qp.cutting1)}×${fmt(qp.cutting2)}` : '-'} />
                      <QItem label="Bend" value={fmt(qp.bend)} />
                      <QItem label="Grains Count" value={fmt(qp.grainsCount)} />
                    </div>
                    {/* Row 2: Mix, S Mix, L Mix, Kandu */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                      <QItem label="Mix" value={fmt(qp.mix)} />
                      <QItem label="S Mix" value={fmt(qp.mixS)} />
                      <QItem label="L Mix" value={fmt(qp.mixL)} />
                      <QItem label="Kandu" value={fmt(qp.kandu)} />
                    </div>
                    {/* Row 3: Oil */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                      <QItem label="Oil" value={fmt(qp.oil)} />
                    </div>
                    {/* Row 3: SK, WB(R), WB(BK), WB(T) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                      <QItem label="SK" value={fmt(qp.sk)} />
                      <QItem label="WB (R)" value={fmt(qp.wbR)} />
                      <QItem label="WB (BK)" value={fmt(qp.wbBk)} />
                      <QItem label="WB (T)" value={fmt(qp.wbT)} />
                    </div>
                    {/* Row 4: Paddy WB */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      <QItem label="Paddy WB" value={fmt(qp.paddyWb)} />
                    </div>
                  </div>
                ) : <div style={{ color: '#999', textAlign: 'center', padding: '12px' }}>No quality data available</div>;
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
    </div>
  );
};

export default LotSelection;
