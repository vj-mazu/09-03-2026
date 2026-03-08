import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
    qualityParameters?: any;
    offering?: any;
    creator?: { username: string };
    entryType?: string;
    lorryNumber?: string;
}

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

interface CompletedLotsProps {
    entryType?: string;
    excludeEntryType?: string;
}

const CompletedLots: React.FC<CompletedLotsProps> = ({ entryType, excludeEntryType }) => {
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
    const pageSize = 100;

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

            const res = await axios.get('/sample-entries/tabs/completed-lots', { params });
            const data = res.data as { entries: SampleEntry[]; total: number };
            setEntries(data.entries || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Error fetching completed lots:', err);
        }
        setLoading(false);
    }, [page, filters]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>Showing {entries.length} of {total} completed lots (Patti pending)</span>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{ padding: '6px 14px', fontSize: '13px', background: showFilters ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {showFilters ? '✕ Hide Filters' : '🔍 Filters'}
                </button>
            </div>

            {showFilters && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                    {(['broker', 'variety', 'party', 'location'] as const).map(key => (
                        <input key={key} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} value={filters[key]}
                            onChange={e => setFilters({ ...filters, [key]: e.target.value })}
                            style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }} />
                    ))}
                    <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <button onClick={() => { setPage(1); fetchEntries(); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Apply</button>
                    <button onClick={() => { setFilters({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' }); setPage(1); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                </div>
            )}

            <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid #ddd' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ background: 'linear-gradient(135deg, #e67e22, #f39c12)', color: 'white' }}>
                            {['Date', 'SL No', 'Broker', 'Bags', 'Pkg', 'Variety', 'Party', entryType === 'RICE_SAMPLE' ? 'Rice Location' : 'Location', 'Status', 'Offer Rate', 'Final Price'].map(h => (
                                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No completed lots with pending patti</td></tr>
                        ) : entries.map((e, i) => (
                            <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#fef9f0', borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px' }}>{new Date(e.entryDate).toLocaleDateString('en-IN')}</td>
                                <td style={{ padding: '8px', fontWeight: '600' }}>{(i + 1 + (page - 1) * pageSize)}</td>
                                <td style={{ padding: '8px' }}>{e.brokerName}</td>
                                <td style={{ padding: '8px' }}>{e.bags?.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '8px' }}>{e.packaging || '75'}</td>
                                <td style={{ padding: '8px' }}>{e.variety}</td>
                                <td style={{ padding: '8px' }}>
                                    <div style={{ fontWeight: '600', color: '#1565c0' }}>{toTitleCase(e.partyName) || (e.entryType === 'DIRECT_LOADED_VEHICLE' ? e.lorryNumber?.toUpperCase() : '')}</div>
                                    {e.entryType === 'DIRECT_LOADED_VEHICLE' && e.lorryNumber && e.partyName && <div style={{ fontSize: '10px', color: '#1565c0', fontWeight: '600' }}>{e.lorryNumber.toUpperCase()}</div>}
                                </td>
                                <td style={{ padding: '8px' }}>{e.location}</td>
                                <td style={{ padding: '8px' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: '#fff3cd', color: '#856404' }}>
                                        Patti Pending
                                    </span>
                                </td>
                                <td style={{ padding: '8px' }}>{e.offering?.offerRate || '-'}</td>
                                <td style={{ padding: '8px', fontWeight: '600', color: '#27ae60' }}>{e.offering?.finalPrice || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px' }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: page <= 1 ? '#f5f5f5' : 'white' }}>← Prev</button>
                    <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: page >= totalPages ? '#f5f5f5' : 'white' }}>Next →</button>
                </div>
            )}
        </div>
    );
};

export default CompletedLots;
