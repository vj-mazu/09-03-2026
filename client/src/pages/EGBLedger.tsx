import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface EGBEntry {
    id: string;
    entryDate: string;
    brokerName: string;
    variety: string;
    partyName: string;
    location: string;
    bags: number;
    packaging: string;
    offering?: {
        egbValue: number;
        egbType: string;
        finalPrice: number;
        finalBaseRate: number;
        baseRateType: string;
        baseRateUnit: string;
        offerBaseRateValue: number;
        isFinalized: boolean;
    };
}

const EGBLedger: React.FC = () => {
    const [entries, setEntries] = useState<EGBEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ broker: '', variety: '', startDate: '', endDate: '', egbType: '' });
    const pageSize = 100;

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
            if (filters.broker) params.broker = filters.broker;
            if (filters.variety) params.variety = filters.variety;
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.egbType) params.egbType = filters.egbType;

            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/sample-entries/tabs/sample-book`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data as { entries: EGBEntry[]; total: number };
            // Filter entries that have offering data with EGB info
            const egbEntries = (data.entries || []).filter(e =>
                e.offering && e.offering.isFinalized
            );
            setEntries(egbEntries);
            setTotal(egbEntries.length);
        } catch (err) {
            console.error('Error fetching EGB ledger:', err);
        }
        setLoading(false);
    }, [page, filters]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const totalPages = Math.ceil(total / pageSize);

    // Group by date for date headers  
    const grouped: Record<string, EGBEntry[]> = {};
    entries.forEach(e => {
        const dt = new Date(e.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (!grouped[dt]) grouped[dt] = [];
        grouped[dt].push(e);
    });

    // Stats
    const millCount = entries.filter(e => e.offering?.egbType === 'mill' || (!e.offering?.egbType && (!e.offering?.egbValue || e.offering.egbValue === 0))).length;
    const purchaseCount = entries.filter(e => e.offering?.egbType === 'purchase' || (!e.offering?.egbType && e.offering?.egbValue && e.offering.egbValue > 0)).length;
    const totalEgbValue = entries.reduce((sum, e) => sum + (parseFloat(String(e.offering?.egbValue ?? '0')) || 0), 0);
    const totalBags = entries.reduce((sum, e) => sum + e.bags, 0);

    let globalSlNo = 0;

    return (
        <div style={{ padding: '16px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', color: '#2c3e50', fontWeight: '700' }}>
                📦 EGB Ledger (Empty Gunny Bags)
            </h2>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ background: '#e3f2fd', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', minWidth: '120px' }}>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '600', textTransform: 'capitalize' }}>Total Entries</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#1565c0' }}>{total}</div>
                </div>
                <div style={{ background: '#e8f5e9', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', minWidth: '120px' }}>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '600', textTransform: 'capitalize' }}>Mill (Own Bags)</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#2e7d32' }}>{millCount}</div>
                </div>
                <div style={{ background: '#fff3e0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', minWidth: '120px' }}>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '600', textTransform: 'capitalize' }}>Purchase</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#e65100' }}>{purchaseCount}</div>
                </div>
                <div style={{ background: '#f3e5f5', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', minWidth: '120px' }}>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '600', textTransform: 'capitalize' }}>Total EGB Value</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#7b1fa2' }}>₹{totalEgbValue.toFixed(2)}</div>
                </div>
                <div style={{ background: '#fce4ec', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', minWidth: '120px' }}>
                    <div style={{ fontSize: '10px', color: '#666', fontWeight: '600', textTransform: 'capitalize' }}>Total Bags</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#c62828' }}>{totalBags}</div>
                </div>
            </div>

            {/* Filter Toggle */}
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>Date-wise EGB entries</span>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{ padding: '6px 14px', fontSize: '13px', background: showFilters ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {showFilters ? '✕ Hide Filters' : '🔍 Filters'}
                </button>
            </div>

            {showFilters && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                    <input placeholder="Broker" value={filters.broker} onChange={e => setFilters({ ...filters, broker: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }} />
                    <input placeholder="Variety" value={filters.variety} onChange={e => setFilters({ ...filters, variety: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }} />
                    <select value={filters.egbType} onChange={e => setFilters({ ...filters, egbType: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', width: '140px', backgroundColor: 'white' }}>
                        <option value="">All EGB Types</option>
                        <option value="mill">Mill (Own Bags)</option>
                        <option value="purchase">Purchase</option>
                    </select>
                    <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' }} />
                    <button onClick={() => { setPage(1); fetchEntries(); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Apply</button>
                    <button onClick={() => { setFilters({ broker: '', variety: '', startDate: '', endDate: '', egbType: '' }); setPage(1); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #ddd' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div>
                ) : entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No EGB entries found</div>
                ) : Object.entries(grouped).map(([dateStr, dateEntries]) => (
                    <div key={dateStr}>
                        {/* Date Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                            color: 'white', padding: '8px 14px', fontWeight: '700',
                            fontSize: '13px', letterSpacing: '0.5px'
                        }}>
                            📅 {dateStr} — {dateEntries.length} {dateEntries.length === 1 ? 'entry' : 'entries'}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(135deg, #6c3483, #8e44ad)', color: 'white' }}>
                                    {['SL', 'Broker', 'Party', 'Location', 'Variety', 'Bags', 'Pkg', 'EGB Type', 'EGB Value', 'Final Rate', 'Base Rate'].map(h => (
                                        <th key={h} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap', fontSize: '10px' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {dateEntries.map((e, i) => {
                                    globalSlNo++;
                                    const o = e.offering || {} as any;
                                    const isMillType = o.egbType === 'mill' || (!o.egbType && (!o.egbValue || o.egbValue === 0));
                                    const isPurchase = o.egbType === 'purchase' || (!o.egbType && o.egbValue && o.egbValue > 0);

                                    // Filter by egbType from filters
                                    if (filters.egbType) {
                                        if (filters.egbType === 'mill' && !isMillType) return null;
                                        if (filters.egbType === 'purchase' && !isPurchase) return null;
                                    }

                                    return (
                                        <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#faf5ff', borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', fontSize: '11px' }}>{globalSlNo}</td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.brokerName}</td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.partyName}</td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.location || '-'}</td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.variety}</td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', fontSize: '11px' }}>{e.bags}</td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.packaging || '75'}</td>
                                            <td style={{ padding: '6px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700',
                                                    background: isMillType ? '#e8f5e9' : '#fff3e0',
                                                    color: isMillType ? '#2e7d32' : '#e65100'
                                                }}>
                                                    {isMillType ? '🏭 Mill' : '🛒 Purchase'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px', color: isPurchase ? '#e65100' : '#2e7d32' }}>
                                                {isPurchase ? `₹${o.egbValue || 0}` : '0 (Own)'}
                                            </td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px', color: '#1565c0' }}>
                                                {o.finalPrice ? `₹${o.finalPrice}` : '-'}
                                            </td>
                                            <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                                                {o.finalBaseRate || o.offerBaseRateValue ? (
                                                    <span>₹{o.finalBaseRate || o.offerBaseRateValue} <span style={{ fontSize: '9px', color: '#888' }}>{(o.baseRateType || '').replace(/_/g, '/')}</span></span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            {/* Pagination */}
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

export default EGBLedger;
