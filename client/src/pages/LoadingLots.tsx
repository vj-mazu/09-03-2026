import React, { useState, useEffect, useCallback } from 'react';
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
    packaging: string;
    workflowStatus: string;
    qualityParameters?: any;
    offering?: any;
    creator?: { username: string };
    slNo?: number;
}

const unitLabel = (u: string) => {
    const map: Record<string, string> = { per_kg: '/Kg', per_ton: '/Ton', per_bag: '/Bag', per_quintal: '/Qtl' };
    return map[u] || u || '';
};

const fmtVal = (val: any, unit?: string) => {
    if (val == null || val === '') return '-';
    return unit ? `${val} ${unitLabel(unit)}` : `${val}`;
};

const LoadingLots: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
    const pageSize = 100;

    const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [managerData, setManagerData] = useState({
        sute: '', suteUnit: 'per_bag',
        moistureValue: '',
        hamali: '', hamaliUnit: 'per_bag',
        brokerage: '', brokerageUnit: 'per_bag',
        lf: '', lfUnit: 'per_bag',
        finalBaseRate: '', baseRateType: 'PD_LOOSE',
        egbValue: '', egbType: 'mill'
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

            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/sample-entries/tabs/loading-lots`, {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data as { entries: SampleEntry[]; total: number };
            setEntries(data.entries || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Error fetching loading lots:', err);
        }
        setLoading(false);
    }, [page, filters]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const handleUpdateClick = (entry: SampleEntry) => {
        const o = entry.offering || {};
        setSelectedEntry(entry);
        setManagerData({
            sute: o.finalSute?.toString() ?? o.sute?.toString() ?? '',
            suteUnit: o.finalSuteUnit || o.suteUnit || 'per_bag',
            moistureValue: o.moistureValue?.toString() ?? '',
            hamali: o.hamali?.toString() ?? '',
            hamaliUnit: o.hamaliUnit || 'per_bag',
            brokerage: o.brokerage?.toString() ?? '',
            brokerageUnit: o.brokerageUnit || 'per_bag',
            lf: o.lf?.toString() ?? '',
            lfUnit: o.lfUnit || 'per_bag',
            finalBaseRate: o.finalBaseRate?.toString() ?? o.offerBaseRateValue?.toString() ?? '',
            baseRateType: o.baseRateType || 'PD_LOOSE',
            egbValue: o.egbValue?.toString() ?? '',
            egbType: o.egbType || ((o.egbValue && parseFloat(o.egbValue) > 0) ? 'purchase' : 'mill')
        });
        setShowModal(true);
    };

    const handleSaveValues = async () => {
        if (!selectedEntry || isSubmitting) return;
        try {
            setIsSubmitting(true);
            const token = localStorage.getItem('token');
            const o = selectedEntry.offering || {};

            const payload: any = {
                finalSute: managerData.sute ? parseFloat(managerData.sute) : (o.finalSute ?? o.sute ?? null),
                finalSuteUnit: managerData.suteUnit || o.finalSuteUnit || o.suteUnit || 'per_bag',
                finalBaseRate: managerData.finalBaseRate ? parseFloat(managerData.finalBaseRate) : (o.finalBaseRate ?? o.offerBaseRateValue ?? null),
                suteEnabled: o.suteEnabled,
                moistureEnabled: o.moistureEnabled,
                hamaliEnabled: o.hamaliEnabled,
                brokerageEnabled: o.brokerageEnabled,
                lfEnabled: o.lfEnabled,
                moistureValue: managerData.moistureValue ? parseFloat(managerData.moistureValue) : (o.moistureValue ?? null),
                hamali: managerData.hamali ? parseFloat(managerData.hamali) : (o.hamali ?? null),
                hamaliUnit: managerData.hamaliUnit || o.hamaliUnit || 'per_bag',
                brokerage: managerData.brokerage ? parseFloat(managerData.brokerage) : (o.brokerage ?? null),
                brokerageUnit: managerData.brokerageUnit || o.brokerageUnit || 'per_bag',
                lf: managerData.lf ? parseFloat(managerData.lf) : (o.lf ?? null),
                lfUnit: managerData.lfUnit || o.lfUnit || 'per_bag',
                egbValue: managerData.egbType === 'mill' ? 0 : (managerData.egbValue ? parseFloat(managerData.egbValue) : (o.egbValue ?? 0)),
                egbType: managerData.egbType || o.egbType || 'mill',
                customDivisor: o.customDivisor ?? null,
                isFinalized: true
            };

            // No need for manager-override section since all fields are always editable now

            await axios.post(
                `${API_URL}/sample-entries/${selectedEntry.id}/final-price`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setShowModal(false);
            setSelectedEntry(null);
            fetchEntries();

            // Show success notification
            // Server-side /final-price endpoint already auto-transitions FINAL_REPORT → LOT_ALLOTMENT
            showNotification('✅ Values saved successfully! Lot moved to Pending Allotting Supervisor', 'success');
        } catch (error: any) {
            showNotification(error.response?.data?.error || 'Failed to save values', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    // Group entries by date + broker (matching staff-side pattern)
    const groupedByDateBroker: Record<string, Record<string, SampleEntry[]>> = {};
    entries.forEach(e => {
        const dt = new Date(e.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const broker = e.brokerName || 'Unknown';
        if (!groupedByDateBroker[dt]) groupedByDateBroker[dt] = {};
        if (!groupedByDateBroker[dt][broker]) groupedByDateBroker[dt][broker] = [];
        groupedByDateBroker[dt][broker].push(e);
    });

    const isManagerOrOwner = user?.role === 'manager' || user?.role === 'owner' || user?.role === 'admin';

    // Format workflow status to friendly name
    const statusLabel = (s: string) => {
        const map: Record<string, string> = {
            STAFF_ENTRY: 'Staff Entry',
            QUALITY_NEEDED: 'Quality Needed',
            PENDING_LOT_SELECTION: 'Pending Lot Selection',
            PENDING_COOKING_REPORT: 'Pending Cooking Report',
            PENDING_LOTS_PASSED: 'Pending Lots Passed',
            FINAL_REPORT: 'Pending Lots Passed',
            LOT_ALLOTMENT: 'Pending Loading Lots',
            PENDING_ALLOTTING_SUPERVISOR: 'Pending Allotting Supervisor',
            PHYSICAL_INSPECTION: 'Physical Inspection',
            INVENTORY_ENTRY: 'Inventory Entry',
            OWNER_FINANCIAL: 'Owner Financial',
            MANAGER_FINANCIAL: 'Manager Financial',
            FINAL_REVIEW: 'Final Review',
            COMPLETED: 'Completed'
        };
        return map[s] || s.replace(/_/g, ' ');
    };

    return (
        <div>
            {/* Filter Toggle */}
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>Showing {entries.length} of {total} lots</span>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{ padding: '6px 14px', fontSize: '13px', background: showFilters ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {showFilters ? '✕ Hide Filters' : '🔍 Filters'}
                </button>
            </div>

            {/* Filters */}
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

            {/* Table */}
            <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid #ddd' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</div>
                ) : entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No loading lots found</div>
                ) : Object.entries(groupedByDateBroker).map(([dateStr, brokerGroups]) => (
                    <div key={dateStr}>
                        {Object.entries(brokerGroups).map(([brokerName, brokerEntries]) => (
                            <div key={brokerName}>
                                {/* Date + Broker Group Header */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                                    color: 'white', padding: '8px 12px', fontWeight: '700',
                                    fontSize: '13px', letterSpacing: '0.5px', textAlign: 'center'
                                }}>
                                    📅 {dateStr} — {brokerName} ({brokerEntries.length} {brokerEntries.length === 1 ? 'lot' : 'lots'})
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'auto' }}>
                                    <thead>
                                        <tr style={{ background: 'linear-gradient(135deg, #2c3e50, #3498db)', color: 'white' }}>
                                            {['SL', 'Bags', 'Pkg', 'Party', 'Paddy Location', 'Variety', 'Final Rate', 'Sute', 'Mst%', 'Hamali', 'Bkrg', 'LF', 'Status', 'Actions'].map(h => (
                                                <th key={h} style={{ padding: '10px 6px', textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap', fontSize: '11px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {brokerEntries.map((e, i) => {
                                            const o = e.offering || {};
                                            // Check which fields the admin left blank (disabled) that need manager fill
                                            const suteMissing = o.suteEnabled === false && !parseFloat(o.finalSute) && !parseFloat(o.sute);
                                            const mstMissing = o.moistureEnabled === false && !parseFloat(o.moistureValue);
                                            const hamaliMissing = o.hamaliEnabled === false && !parseFloat(o.hamali);
                                            const bkrgMissing = o.brokerageEnabled === false && !parseFloat(o.brokerage);
                                            const lfMissing = o.lfEnabled === false && !parseFloat(o.lf);
                                            const needsFill = suteMissing || mstMissing || hamaliMissing || bkrgMissing || lfMissing;

                                            const cellStyle = (missing: boolean) => ({
                                                padding: '6px',
                                                textAlign: 'center' as const,
                                                background: missing ? '#fff3cd' : 'transparent',
                                                color: missing ? '#856404' : '#333',
                                                fontWeight: missing ? '700' : '400' as any,
                                                fontSize: '12px'
                                            });

                                            const statusColors: Record<string, { bg: string; color: string }> = {
                                                LOT_ALLOTMENT: { bg: '#e3f2fd', color: '#1565c0' },
                                                PENDING_ALLOTTING_SUPERVISOR: { bg: '#fce4ec', color: '#880e4f' },
                                                PHYSICAL_INSPECTION: { bg: '#fff3e0', color: '#e65100' },
                                                INVENTORY_ENTRY: { bg: '#e8f5e9', color: '#2e7d32' },
                                                OWNER_FINANCIAL: { bg: '#f3e5f5', color: '#7b1fa2' },
                                                MANAGER_FINANCIAL: { bg: '#e0f7fa', color: '#00695c' },
                                                FINAL_REVIEW: { bg: '#fce4ec', color: '#c62828' }
                                            };
                                            const sc = statusColors[e.workflowStatus] || { bg: '#f5f5f5', color: '#333' };

                                            return (
                                                <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700', fontSize: '12px' }}>{i + 1 + (page - 1) * pageSize}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', fontSize: '12px' }}>{e.bags}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '12px' }}>{e.packaging || '-'}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '12px' }}>{e.partyName}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '12px' }}>{e.location || '-'}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '12px' }}>{e.variety}</td>
                                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                                                        {o.finalBaseRate ?? o.offerBaseRateValue ? (
                                                            <div>
                                                                <div style={{ fontWeight: '700', fontSize: '12px', color: '#2c3e50' }}>
                                                                    ₹{o.finalBaseRate ?? o.offerBaseRateValue}
                                                                    <span style={{ fontSize: '10px', color: '#666' }}>{o.baseRateUnit === 'per_quintal' ? '/Qtl' : '/Bag'}</span>
                                                                </div>
                                                                <div style={{ fontSize: '9px', color: '#888', fontWeight: '500' }}>
                                                                    {o.baseRateType?.replace('_', '/') || ''}
                                                                </div>
                                                                {o.egbValue != null && o.egbValue > 0 && (
                                                                    <div style={{ fontSize: '9px', color: '#e67e22', fontWeight: '600' }}>EGB: {o.egbValue}</div>
                                                                )}
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                    <td style={cellStyle(suteMissing)}>
                                                        {suteMissing ? '⚠ Need' : fmtVal(o.finalSute ?? o.sute, o.finalSuteUnit ?? o.suteUnit)}
                                                    </td>
                                                    <td style={cellStyle(mstMissing)}>
                                                        {mstMissing ? '⚠ Need' : (o.moistureValue != null ? `${o.moistureValue}%` : '-')}
                                                    </td>
                                                    <td style={cellStyle(hamaliMissing)}>
                                                        {hamaliMissing ? '⚠ Need' : (o.hamali || o.hamaliPerKg ? `${o.hamali || o.hamaliPerKg} ${o.hamaliUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : o.hamaliEnabled === false ? '⏳' : '-')}
                                                    </td>
                                                    <td style={cellStyle(bkrgMissing)}>
                                                        {bkrgMissing ? '⚠ Need' : (o.brokerage ? `${o.brokerage} ${o.brokerageUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : o.brokerageEnabled === false ? '⏳' : '-')}
                                                    </td>
                                                    <td style={cellStyle(lfMissing)}>
                                                        {lfMissing ? '⚠ Need' : (o.lf ? `${o.lf} ${o.lfUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : o.lfEnabled === false ? '⏳' : '-')}
                                                    </td>
                                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                                        <div>
                                                            <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', background: '#d4edda', color: '#155724', whiteSpace: 'nowrap', display: 'inline-block', marginBottom: '2px', border: '1px solid #c3e6cb' }}>
                                                                Admin Added ✅
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '700', background: needsFill ? '#fff3cd' : '#d4edda', color: needsFill ? '#856404' : '#155724', whiteSpace: 'nowrap', display: 'inline-block', marginBottom: '2px', border: needsFill ? '1px solid #ffeeba' : '1px solid #c3e6cb' }}>
                                                                {needsFill ? 'Manager Missing ⏳' : 'Manager Added ✅✅'}
                                                            </span>
                                                        </div>
                                                        <span style={{ padding: '1px 4px', borderRadius: '8px', fontSize: '9px', fontWeight: '600', background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                                                            {statusLabel(e.workflowStatus)}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                                        {isManagerOrOwner && (
                                                            <button
                                                                onClick={() => handleUpdateClick(e)}
                                                                style={{
                                                                    padding: '4px 10px',
                                                                    background: needsFill ? '#e67e22' : '#3498db',
                                                                    color: 'white',
                                                                    border: 'none', borderRadius: '4px', fontSize: '11px',
                                                                    cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {needsFill ? '⚠ Fill Values' : '✏️ View/Edit'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px', alignItems: 'center' }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: page <= 1 ? '#f5f5f5' : 'white' }}>← Prev</button>
                    <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {totalPages} ({total} total)</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: page >= totalPages ? '#f5f5f5' : 'white' }}>Next →</button>
                </div>
            )}

            {/* Manager Values Modal */}
            {showModal && selectedEntry && (() => {
                const o = selectedEntry.offering || {};
                const hasDisabledFields = o.suteEnabled === false || o.moistureEnabled === false ||
                    o.hamaliEnabled === false || o.brokerageEnabled === false || o.lfEnabled === false;

                // Admin-set values to display as read-only context
                const adminValues = [
                    { label: 'Base Rate Type', value: (o.baseRateType || o.offerBaseRateType || '-').replace(/_/g, '/') },
                    { label: 'Base Rate', value: (o.finalBaseRate || o.offerBaseRateValue) ? (o.finalBaseRate || o.offerBaseRateValue) : '-' },
                    { label: 'EGB', value: (o.egbValue != null && o.egbValue !== 0) ? o.egbValue : '-' },
                    { label: 'Custom Divisor', value: o.customDivisor ? o.customDivisor : '-' },
                ];

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '10px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                            <h3 style={{ marginTop: 0, color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px', fontSize: '16px', textAlign: 'center' }}>
                                👤 {selectedEntry.brokerName}
                            </h3>

                            {/* Entry Info — one line */}
                            <div style={{ background: '#f8f9fa', padding: '8px 14px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                                <span style={{ fontSize: '12px', color: '#333' }}>
                                    Bags: <b>{selectedEntry.bags}</b> | Pkg: <b>{selectedEntry.packaging || '75'} Kg</b> | Party: <b>{selectedEntry.partyName}</b> | Paddy Location: <b>{selectedEntry.location || '-'}</b> | Variety: <b>{selectedEntry.variety}</b>
                                </span>
                            </div>

                            {/* Admin-Set Values (Read-Only) */}
                            <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '13px', color: '#7f8c8d', margin: '0 0 8px', textTransform: 'capitalize', letterSpacing: '1px' }}>
                                    🔒 Admin Set Values
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    {adminValues.map(av => (
                                        <div key={av.label} style={{ background: '#e8f5e9', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                                            <span style={{ color: '#666' }}>{av.label}: </span>
                                            <span style={{ fontWeight: '700', color: '#2e7d32' }}>{av.value}</span>
                                        </div>
                                    ))}
                                    {/* Show what admin enabled/disabled */}
                                    {[
                                        { key: 'Sute', enabled: o.suteEnabled, val: fmtVal(o.sute, o.suteUnit) },
                                        { key: 'Moisture', enabled: o.moistureEnabled, val: o.moistureValue != null ? `${o.moistureValue}%` : '-' },
                                        { key: 'Hamali', enabled: o.hamaliEnabled, val: fmtVal(o.hamali, o.hamaliUnit) },
                                        { key: 'Brokerage', enabled: o.brokerageEnabled, val: fmtVal(o.brokerage, o.brokerageUnit) },
                                        { key: 'LF', enabled: o.lfEnabled, val: fmtVal(o.lf, o.lfUnit) },
                                    ].map(item => (
                                        <div key={item.key} style={{
                                            background: item.enabled === false ? '#fff3cd' : '#e8f5e9',
                                            padding: '6px 10px', borderRadius: '4px', fontSize: '12px'
                                        }}>
                                            <span style={{ color: '#666' }}>{item.key}: </span>
                                            {item.enabled === false ? (
                                                <span style={{ fontWeight: '700', color: '#e67e22' }}>⚠ Manager to fill</span>
                                            ) : (
                                                <span style={{ fontWeight: '700', color: '#2e7d32' }}>{item.val}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Manager Edit Section — always show all fields */}
                            <div>
                                <h4 style={{ fontSize: '13px', color: '#2c3e50', margin: '0 0 10px', textTransform: 'capitalize', letterSpacing: '1px' }}>
                                    ✏️ Edit Values
                                </h4>
                                {/* Row 0: Final Base Rate */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>Final Base Rate</label>
                                        <input type="number" step="0.01" value={managerData.finalBaseRate}
                                            onChange={e => setManagerData({ ...managerData, finalBaseRate: e.target.value })}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} placeholder="Rate" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>Base Rate Type</label>
                                        <select value={managerData.baseRateType} onChange={e => setManagerData({ ...managerData, baseRateType: e.target.value })}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}>
                                            <option value="PD_LOOSE">PD/Loose</option>
                                            <option value="PD_WB">PD/WB</option>
                                            <option value="MD_WB">MD/WB</option>
                                            <option value="MD_LOOSE">MD/Loose</option>
                                        </select>
                                    </div>
                                </div>
                                {/* Row 1: Sute + Moisture */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>Sute</label>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input type="number" step="0.01" value={managerData.sute}
                                                onChange={e => setManagerData({ ...managerData, sute: e.target.value })}
                                                style={{ flex: 1, padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px' }} placeholder="Sute" />
                                            <select value={managerData.suteUnit} onChange={e => setManagerData({ ...managerData, suteUnit: e.target.value })}
                                                style={{ padding: '5px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '11px', minWidth: '70px' }}>
                                                <option value="per_bag">Per Bag</option>
                                                <option value="per_ton">Per Ton</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>Moisture %</label>
                                        <input type="number" step="0.01" value={managerData.moistureValue}
                                            onChange={e => setManagerData({ ...managerData, moistureValue: e.target.value })}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} placeholder="Moisture %" />
                                    </div>
                                </div>
                                {/* Row 2: Hamali + Brokerage + LF */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>Hamali</label>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input type="number" step="0.01" value={managerData.hamali}
                                                onChange={e => setManagerData({ ...managerData, hamali: e.target.value })}
                                                style={{ flex: 1, padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px', minWidth: 0 }} placeholder="Hamali" />
                                            <select value={managerData.hamaliUnit} onChange={e => setManagerData({ ...managerData, hamaliUnit: e.target.value })}
                                                style={{ padding: '5px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '11px', minWidth: '65px' }}>
                                                <option value="per_bag">/Bag</option>
                                                <option value="per_quintal">/Qtl</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>Brokerage</label>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input type="number" step="0.01" value={managerData.brokerage}
                                                onChange={e => setManagerData({ ...managerData, brokerage: e.target.value })}
                                                style={{ flex: 1, padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px', minWidth: 0 }} placeholder="Bkrg" />
                                            <select value={managerData.brokerageUnit} onChange={e => setManagerData({ ...managerData, brokerageUnit: e.target.value })}
                                                style={{ padding: '5px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '11px', minWidth: '65px' }}>
                                                <option value="per_bag">/Bag</option>
                                                <option value="per_quintal">/Qtl</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>LF</label>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <input type="number" step="0.01" value={managerData.lf}
                                                onChange={e => setManagerData({ ...managerData, lf: e.target.value })}
                                                style={{ flex: 1, padding: '5px 8px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '12px', minWidth: 0 }} placeholder="LF" />
                                            <select value={managerData.lfUnit} onChange={e => setManagerData({ ...managerData, lfUnit: e.target.value })}
                                                style={{ padding: '5px', border: '1px solid #3498db', borderRadius: '4px', fontSize: '11px', minWidth: '65px' }}>
                                                <option value="per_bag">/Bag</option>
                                                <option value="per_quintal">/Qtl</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                {/* Row 3: EGB */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '3px' }}>EGB</label>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
                                                <input type="radio" name="egbType" value="mill" checked={managerData.egbType === 'mill'}
                                                    onChange={() => setManagerData({ ...managerData, egbType: 'mill', egbValue: '0' })} />
                                                Mill
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
                                                <input type="radio" name="egbType" value="purchase" checked={managerData.egbType === 'purchase'}
                                                    onChange={() => setManagerData({ ...managerData, egbType: 'purchase' })} />
                                                Purchase
                                            </label>
                                            <input type="number" step="0.01" value={managerData.egbValue}
                                                onChange={e => setManagerData({ ...managerData, egbValue: e.target.value })}
                                                disabled={managerData.egbType === 'mill'}
                                                style={{ flex: 1, padding: '5px 8px', border: `1px solid ${managerData.egbType === 'mill' ? '#ccc' : '#3498db'}`, borderRadius: '4px', fontSize: '12px', backgroundColor: managerData.egbType === 'mill' ? '#f5f5f5' : 'white', minWidth: 0 }} placeholder="EGB" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '14px' }}>
                                <button onClick={() => setShowModal(false)} disabled={isSubmitting} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Cancel</button>
                                <button onClick={handleSaveValues} disabled={isSubmitting} style={{
                                    padding: '8px 24px', border: 'none', borderRadius: '6px',
                                    background: isSubmitting ? '#95a5a6' : 'linear-gradient(135deg, #27ae60, #2ecc71)',
                                    color: 'white', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '13px',
                                    boxShadow: isSubmitting ? 'none' : '0 2px 4px rgba(39, 174, 96, 0.3)'
                                }}>
                                    {isSubmitting ? 'Saving...' : '💾 Save Values'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default LoadingLots;
