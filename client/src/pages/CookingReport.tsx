import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  cookingReport?: {
    status: string;
    remarks: string;
  };
}

const CookingReport: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [cookingData, setCookingData] = useState({
    status: '',
    remarks: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBroker, setFilterBroker] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 100;

  useEffect(() => {
    loadEntries();
  }, [page]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = { status: 'COOKING_REPORT', page, pageSize: PAGE_SIZE };
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

  const handleOpenModal = (entry: SampleEntry) => {
    setSelectedEntry(entry);
    setShowModal(true);
    setCookingData({ status: '', remarks: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/cooking-report`,
        cookingData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Cooking report added successfully', 'success');

      // If Medium is selected, auto-transition to Lots Passed
      if (cookingData.status === 'MEDIUM') {
        try {
          await axios.post(
            `${API_URL}/sample-entries/${selectedEntry.id}/transition`,
            { toStatus: 'LOT_SELECTION' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          showNotification('✅ Medium selected - Lot moved to Final Pass Lots!', 'success');
        } catch (transitionErr) {
          console.error('Error transitioning lot:', transitionErr);
        }
      }

      setShowModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to add cooking report', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const brokersList = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.brokerName))).sort();
  }, [entries]);

  // Group entries by date then broker (no client-side filtering — server-side)
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
            display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'flex-end', flexWrap: 'wrap',
            backgroundColor: '#fff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e0e0e0'
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
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries pending cooking report</div>
        ) : (
          Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => (
            <div key={dateKey} style={{ marginBottom: '16px' }}>
              {Object.entries(brokerGroups).map(([brokerName, brokerEntries]) => (
                <div key={brokerName}>
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
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Status</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Sample Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokerEntries.map((entry, index) => {
                        globalSlNo++;
                        let statusText = 'Pending';
                        let statusColor = '#999';
                        let statusBg = '#f5f5f5';
                        if (entry.cookingReport) {
                          const cr = entry.cookingReport;
                          if (cr.remarks && cr.remarks.toLowerCase().includes('yes')) {
                            statusText = 'Recheck';
                            statusColor = '#e74c3c';
                            statusBg = '#fdecea';
                          } else {
                            statusText = cr.status || 'Pending';
                            statusColor = cr.status === 'PASS' ? '#27ae60' : cr.status === 'FAIL' ? '#e74c3c' : cr.status === 'MEDIUM' ? '#e67e22' : '#999';
                            statusBg = cr.status === 'PASS' ? '#e8f5e9' : cr.status === 'FAIL' ? '#fdecea' : cr.status === 'MEDIUM' ? '#fff3e0' : '#f5f5f5';
                          }
                        }
                        return (
                          <tr key={entry.id} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>{globalSlNo}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.bags}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.packaging || '75'} Kg</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.partyName}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.location}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.variety}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                                backgroundColor: statusBg, color: statusColor, fontWeight: '700', fontSize: '10px'
                              }}>{statusText}</span>
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleOpenModal(entry)}
                                style={{
                                  fontSize: '9px', padding: '4px 10px',
                                  backgroundColor: '#3498db', color: 'white', border: 'none',
                                  borderRadius: '3px', cursor: 'pointer', fontWeight: '600'
                                }}
                              >
                                Add Report
                              </button>
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

      {/* Cooking Report Modal */}
      {showModal && selectedEntry && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px',
            border: '1px solid #ddd', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '16px 20px', color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>🍳 Add Cooking Report</h3>
              <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.8 }}>
                {selectedEntry.brokerName} — {selectedEntry.variety} — {selectedEntry.bags} bags
              </p>
            </div>

            <div style={{ padding: '20px' }}>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
                    Status *
                  </label>
                  <select
                    value={cookingData.status}
                    onChange={(e) => setCookingData({ ...cookingData, status: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px' }}
                    required
                  >
                    <option value="">-- Select Status --</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                    <option value="RECHECK">Recheck</option>
                    <option value="MEDIUM">Medium</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
                    Remarks
                  </label>
                  <textarea
                    value={cookingData.remarks}
                    onChange={(e) => setCookingData({ ...cookingData, remarks: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', minHeight: '80px' }}
                    placeholder="Enter remarks..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                  <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}
                    style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: '1px solid #ddd', borderRadius: '3px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', backgroundColor: isSubmitting ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '3px', fontSize: '13px', fontWeight: '600' }}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
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

export default CookingReport;
