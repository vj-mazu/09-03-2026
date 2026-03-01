import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface SampleEntry {
  id: string;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  workflowStatus: string;
  lotAllotment?: {
    id: string;
    supervisor: {
      id: number;
      username: string;
    };
  };
}

interface Supervisor {
  id: number;
  username: string;
}

const AssigningSupervisor: React.FC = () => {
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupervisors, setSelectedSupervisors] = useState<{ [key: string]: number }>({});
  const [offeringCache, setOfferingCache] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  // Removed fallback modal state - handled in Loading Lots tab now

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadEntries();
    loadSupervisors();
  }, [page]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch ONLY entries with LOT_ALLOTMENT status that don't have supervisor assigned yet
      const response = await axios.get(`${API_URL}/sample-entries/by-role?status=LOT_ALLOTMENT&page=${page}&pageSize=${pageSize}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data as any;
      const allPendingEntries = data.entries || [];
      setTotal(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));

      // Filter out entries that already have supervisor assigned
      const entriesWithoutSupervisor = allPendingEntries.filter((entry: SampleEntry) => !entry.lotAllotment);

      // Load offering data for each entry
      const offerCache: { [key: string]: any } = {};

      // Batch load offering data - make single call with multiple IDs
      if (entriesWithoutSupervisor.length > 0) {
        try {
          const ids = entriesWithoutSupervisor.map((e: SampleEntry) => e.id).join(',');
          const offerRes = await axios.get(`${API_URL}/sample-entries/offering-data-batch?ids=${ids}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (offerRes.data) {
            Object.assign(offerCache, offerRes.data);
          }
        } catch {
          // Fallback to individual calls
          for (const entry of entriesWithoutSupervisor) {
            try {
              const offerRes = await axios.get(`${API_URL}/sample-entries/${entry.id}/offering-data`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              offerCache[entry.id] = offerRes.data || {};
            } catch { /* skip */ }
          }
        }
      }

      setEntries(entriesWithoutSupervisor);
      setOfferingCache(offerCache);

    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/physical-supervisors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const physicalSupervisors = (response.data as any).users || [];
      setSupervisors(physicalSupervisors);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load supervisors', 'error');
    }
  };

  const handleSupervisorChange = (entryId: string, supervisorId: number) => {
    setSelectedSupervisors(prev => ({
      ...prev,
      [entryId]: supervisorId
    }));
  };

  const handleAssignClick = (entry: SampleEntry) => {
    const o = offeringCache[entry.id] || {};
    const supervisorId = selectedSupervisors[entry.id];

    // Safety check - shouldn't happen due to UI disabled state, but just in case
    const needsFill = (o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute)) ||
      (o.moistureEnabled === false && !parseFloat(o.moistureValue)) ||
      (o.hamaliEnabled === false && !parseFloat(o.hamali)) ||
      (o.brokerageEnabled === false && !parseFloat(o.brokerage)) ||
      (o.lfEnabled === false && !parseFloat(o.lf));

    if (needsFill) {
      showNotification('Please fill missing financial values in the Loading Lots tab first.', 'error');
      return;
    }

    if (!supervisorId) {
      showNotification('Please select a physical supervisor', 'error');
      return;
    }

    // Assign directly
    handleAssign(entry.id);
  };

  const handleAssign = async (entryId: string) => {
    if (isSubmitting) return;
    const supervisorId = selectedSupervisors[entryId];

    if (!supervisorId) {
      showNotification('Please select a physical supervisor', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');

      // Server-side LotAllotmentService auto-transitions LOT_ALLOTMENT → PHYSICAL_INSPECTION
      await axios.post(
        `${API_URL}/sample-entries/${entryId}/lot-allotment`,
        {
          physicalSupervisorId: supervisorId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Physical supervisor assigned successfully! Entry moved to Physical Inspection.', 'success');

      // Clear the selected supervisor for this entry
      setSelectedSupervisors(prev => {
        const updated = { ...prev };
        delete updated[entryId];
        return updated;
      });

      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to assign supervisor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group entries by date + broker
  const groupedEntries: Record<string, Record<string, SampleEntry[]>> = {};
  entries.forEach(entry => {
    const dateKey = entry.entryDate
      ? new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'No Date';
    const brokerKey = entry.brokerName || 'Unknown';
    if (!groupedEntries[dateKey]) groupedEntries[dateKey] = {};
    if (!groupedEntries[dateKey][brokerKey]) groupedEntries[dateKey][brokerKey] = [];
    groupedEntries[dateKey][brokerKey].push(entry);
  });

  return (
    <div>
      <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #ddd' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries pending supervisor assignment</div>
        ) : (
          Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => (
            <div key={dateKey}>
              {Object.entries(brokerGroups).map(([brokerName, brokerEntries]) => (
                <div key={brokerName}>
                  {/* Date + Broker Header — matching staff-side style */}
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
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>SL</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Bags</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Pkg</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Party</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Paddy Location</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Variety</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Select Supervisor</th>
                        <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokerEntries.map((entry, index) => {
                        const o = offeringCache[entry.id] || {};

                        const needsFill = (o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute)) ||
                          (o.moistureEnabled === false && !parseFloat(o.moistureValue)) ||
                          (o.hamaliEnabled === false && !parseFloat(o.hamali)) ||
                          (o.brokerageEnabled === false && !parseFloat(o.brokerage)) ||
                          (o.lfEnabled === false && !parseFloat(o.lf));

                        return (
                          <tr key={entry.id} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>{index + 1}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.bags}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>75 Kg</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.partyName}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.location}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{entry.variety}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px' }}>
                              {needsFill ? (
                                <div style={{ textAlign: 'center' }}>
                                  <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', background: '#fff3cd', color: '#856404', whiteSpace: 'nowrap', display: 'inline-block', marginBottom: '3px', border: '1px solid #ffeeba' }}>
                                    Manager Missing ⏳
                                  </span>
                                  <div style={{ fontSize: '9px', color: '#e74c3c', fontStyle: 'italic' }}>
                                    Fill values in Loading Lots first
                                  </div>
                                </div>
                              ) : user?.role !== 'manager' ? (
                                <div style={{ fontSize: '11px', color: '#7f8c8d', fontStyle: 'italic' }}>
                                  Manager action only
                                </div>
                              ) : (
                                <select
                                  value={selectedSupervisors[entry.id] || ''}
                                  onChange={(e) => handleSupervisorChange(entry.id, Number(e.target.value))}
                                  style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px' }}
                                >
                                  <option value="">-- Select Supervisor --</option>
                                  {supervisors.map(supervisor => (
                                    <option key={supervisor.id} value={supervisor.id}>
                                      {supervisor.username}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleAssignClick(entry)}
                                disabled={needsFill || !selectedSupervisors[entry.id] || user?.role !== 'manager' || isSubmitting}
                                style={{
                                  fontSize: '10px', padding: '4px 8px',
                                  backgroundColor: (!needsFill && selectedSupervisors[entry.id] && user?.role === 'manager' && !isSubmitting) ? '#4CAF50' : '#ccc',
                                  color: 'white', border: 'none', borderRadius: '3px',
                                  cursor: (!needsFill && selectedSupervisors[entry.id] && user?.role === 'manager' && !isSubmitting) ? 'pointer' : 'not-allowed'
                                }}
                              >
                                {isSubmitting ? '...' : 'Assign'}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px', alignItems: 'center' }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', background: page === 1 ? '#f5f5f5' : 'white' }}>First</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', background: page === 1 ? '#f5f5f5' : 'white' }}>Prev</button>
          <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {totalPages} ({total} total)</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', background: page === totalPages ? '#f5f5f5' : 'white' }}>Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', background: page === totalPages ? '#f5f5f5' : 'white' }}>Last</button>
        </div>
      )}

      {/* Fallback modal removed as logic is now in Loading Lots */}
    </div>
  );
};

export default AssigningSupervisor;
