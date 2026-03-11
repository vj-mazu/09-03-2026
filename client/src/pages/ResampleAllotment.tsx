import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNotification } from '../contexts/NotificationContext';
import { API_URL } from '../config/api';

interface ResampleEntry {
  id: string;
  serialNo?: number;
  entryDate: string;
  brokerName: string;
  partyName: string;
  lorryNumber?: string;
  location: string;
  variety: string;
  bags: number;
  packaging?: string;
  entryType?: string;
  sampleCollectedBy?: string;
  lotSelectionDecision?: string;
  workflowStatus?: string;
}

interface ResampleAllotmentProps {
  entryType?: string;
  excludeEntryType?: string;
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';

const ResampleAllotment: React.FC<ResampleAllotmentProps> = ({ entryType, excludeEntryType }) => {
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<ResampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBroker, setFilterBroker] = useState('');

  const [paddySupervisors, setPaddySupervisors] = useState<{ id: number; username: string; staffType?: string | null }[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const locationSupervisorSet = useMemo(
    () => new Set(paddySupervisors.map((item) => String(item.username || '').trim().toLowerCase()).filter(Boolean)),
    [paddySupervisors]
  );
  const isResampleAssigned = (entry: ResampleEntry) => {
    const assignedName = String(entry.sampleCollectedBy || '').trim().toLowerCase();
    const isLocationStaff = !!assignedName
      && assignedName !== 'broker office sample'
      && locationSupervisorSet.has(assignedName);
    return entry.lotSelectionDecision === 'FAIL' && entry.entryType === 'LOCATION_SAMPLE' && isLocationStaff;
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<{ success: boolean; users: Array<{ id: number; username: string; staffType?: string | null }> }>(
        `${API_URL}/sample-entries/paddy-supervisors`,
        {
          params: { staffType: 'location' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setPaddySupervisors(res.data?.users || []);
    } catch {
      setPaddySupervisors([]);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = { page, pageSize };
      if (filterDateFrom) params.startDate = filterDateFrom;
      if (filterDateTo) params.endDate = filterDateTo;
      if (filterBroker) params.broker = filterBroker;
      if (entryType) params.entryType = entryType;
      if (excludeEntryType) params.excludeEntryType = excludeEntryType;

      const res = await axios.get(`${API_URL}/sample-entries/tabs/resample-assignments`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data as any;
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load resample assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [page]);

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const groupedByDateBroker = useMemo(() => {
    const grouped: Record<string, Record<string, ResampleEntry[]>> = {};
    entries.forEach((entry) => {
      const dateKey = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const brokerKey = entry.brokerName || 'Unknown';
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
      grouped[dateKey][brokerKey].push(entry);
    });
    return grouped;
  }, [entries]);

  const handleAssign = async (entry: ResampleEntry) => {
    const assigned = isResampleAssigned(entry);
    const selected = assignments[entry.id] !== undefined
      ? assignments[entry.id]
      : (assigned ? (entry.sampleCollectedBy || '') : '');

    if (!selected) {
      showNotification('Select Sample Collected By', 'error');
      return;
    }

    if (assigned && selected === entry.sampleCollectedBy && entry.sampleCollectedBy !== null) {
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
      showNotification('Resample user assigned', 'success');
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to assign user', 'error');
    }
  };

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>Showing {entries.length} of {total} resample lots</span>
        <button onClick={() => setFiltersVisible(!filtersVisible)} style={{ padding: '6px 14px', fontSize: '13px', background: filtersVisible ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{filtersVisible ? 'Hide Filters' : 'Filters'}</button>
      </div>

      {filtersVisible && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
          <input placeholder="Broker" value={filterBroker} onChange={(e) => setFilterBroker(e.target.value)} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }} />
          <button onClick={() => { setPage(1); loadEntries(); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Apply</button>
          <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterBroker(''); setPage(1); setTimeout(() => loadEntries(), 0); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '6px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div> : entries.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No resample lots found</div> : Object.entries(groupedByDateBroker).map(([dateStr, brokerGroups]) => {
          let brokerSeq = 0;
          return (
            <div key={dateStr}>
              {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                brokerSeq++;
                return (
                  <div key={brokerName} style={{ marginBottom: 0 }}>
                    {brokerIdx === 0 && <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white', padding: '6px 10px', fontWeight: 700, fontSize: '14px', textAlign: 'center', letterSpacing: '0.5px' }}>{dateStr} Resample Assignments</div>}
                    <div style={{ background: '#e8eaf6', color: '#000', padding: '4px 10px', fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ fontSize: '13.5px', fontWeight: 800 }}>{brokerSeq}.</span> {brokerName}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #000' }}>
                      <thead style={{ position: 'sticky', top: 56, zIndex: 2 }}>
                        <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                          {['SL No', 'Type', 'Bags', 'Pkg', 'Party Name', 'Paddy Location', 'Variety', 'Current Sample Collected By', 'Assign User', 'Action'].map((header) => (
                            <th key={header} style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap', fontSize: '12px' }}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...brokerEntries]
                          .sort((a, b) => {
                            const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                            const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                            if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                            return new Date(a.entryDate || 0).getTime() - new Date(b.entryDate || 0).getTime();
                          })
                          .map((entry, index) => {
                          const assigned = isResampleAssigned(entry);
                          return (
                          <tr key={entry.id}>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: 700 }}>{entry.serialNo || (index + 1)}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{entry.entryType === 'LOCATION_SAMPLE' ? 'LS' : 'MS'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{entry.bags?.toLocaleString('en-IN') || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>{entry.packaging || '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>
                              {(() => {
                                const party = (entry.partyName || '').trim();
                                const lorry = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
                                if (party) return toTitleCase(party);
                                return lorry || '-';
                              })()}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>{toTitleCase(entry.location)}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>{toTitleCase(entry.variety)}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left' }}>{entry.sampleCollectedBy ? toTitleCase(entry.sampleCollectedBy) : '-'}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>
                              <select
                                value={assignments[entry.id] ?? (assigned ? (entry.sampleCollectedBy ?? '') : '')}
                                onChange={(e) => setAssignments(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                style={{ padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '160px' }}
                              >
                                <option value="">Select</option>
                                {paddySupervisors.map((supervisor) => (
                                  <option key={supervisor.id} value={supervisor.username}>{supervisor.username}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleAssign(entry)}
                                style={{ padding: '3px 8px', background: assigned ? '#f39c12' : '#27ae60', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                {assigned ? 'Re-assign' : 'Assign'}
                              </button>
                            </td>
                          </tr>
                        )})}
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
        <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {totalPages} ({total} total)</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '6px 12px', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: page >= totalPages ? '#f5f5f5' : 'white' }}>Next</button>
      </div>
    </div>
  );
};

export default ResampleAllotment;
