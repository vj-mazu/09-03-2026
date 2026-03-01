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
    lotSelectionDecision: string;
    entryType?: string;
    qualityParameters?: any;
    cookingReport?: any;
    offering?: any;
    creator?: { username: string };
    sampleCollectedBy?: string;
    lorryNumber?: string;
    supervisorName?: string;
}

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{value || '-'}</div>
    </div>
);

const AdminSampleBook: React.FC = () => {
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
    const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
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

            const res = await axios.get('/sample-entries/tabs/sample-book', { params });
            const data = res.data as { entries: SampleEntry[]; total: number };
            setEntries(data.entries || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Error fetching sample book:', err);
        }
        setLoading(false);
    }, [page, filters]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const totalPages = Math.ceil(total / pageSize);

    const getStatusBadge = (status: string) => {
        const colors: Record<string, { bg: string; color: string; label: string }> = {
            STAFF_ENTRY: { bg: '#e3f2fd', color: '#1565c0', label: 'Sample Entry Done' },
            QUALITY_CHECK: { bg: '#fff3e0', color: '#e65100', label: 'Pending Quality Check' },
            LOT_SELECTION: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Pending Sample Selection' },
            COOKING_REPORT: { bg: '#fff8e1', color: '#f57f17', label: 'Pending Cooking Report' },
            FINAL_REPORT: { bg: '#e8eaf6', color: '#283593', label: 'Pending Final Pass' },
            LOT_ALLOTMENT: { bg: '#e0f7fa', color: '#006064', label: 'Pending Loading Lots' },
            PENDING_ALLOTTING_SUPERVISOR: { bg: '#fce4ec', color: '#880e4f', label: 'Pending Supervisor Allotment' },
            PHYSICAL_INSPECTION: { bg: '#fff3e0', color: '#bf360c', label: 'Physical Inspection' },
            INVENTORY_ENTRY: { bg: '#f1f8e9', color: '#33691e', label: 'Inventory Entry' },
            COMPLETED: { bg: '#c8e6c9', color: '#1b5e20', label: 'Completed' },
            FAILED: { bg: '#ffcdd2', color: '#b71c1c', label: 'Failed' },
        };
        const c = colors[status] || { bg: '#f5f5f5', color: '#666', label: status.replace(/_/g, ' ') };
        return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: c.bg, color: c.color }}>{c.label}</span>;
    };

    const getDecisionBadge = (decision: string) => {
        if (!decision) return '-';
        const map: Record<string, { label: string; bg: string; color: string }> = {
            PASS_WITH_COOKING: { label: 'Pass + Cooking', bg: '#fff3e0', color: '#e65100' },
            PASS_WITHOUT_COOKING: { label: 'Pass', bg: '#e8f5e9', color: '#2e7d32' },
            FAIL: { label: 'Fail', bg: '#ffcdd2', color: '#b71c1c' },
        };
        const d = map[decision] || { label: decision, bg: '#f5f5f5', color: '#666' };
        return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: d.bg, color: d.color }}>{d.label}</span>;
    };

    const statusCounts = {
        staff: entries.filter(e => e.workflowStatus === 'STAFF_ENTRY').length,
        quality: entries.filter(e => e.qualityParameters?.moisture != null).length,
        cooking: entries.filter(e => e.cookingReport?.status).length,
        passed: entries.filter(e => e.lotSelectionDecision?.includes('PASS')).length,
        offer: entries.filter(e => e.offering?.offerRate || e.offering?.offerBaseRateValue).length,
        final: entries.filter(e => e.offering?.finalPrice).length,
        completed: entries.filter(e => e.workflowStatus === 'COMPLETED').length,
    };

    return (
        <div>
            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: '#e3f2fd', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#1565c0', fontWeight: '600' }}>Staff Entry:</span> {statusCounts.staff}
                </div>
                <div style={{ background: '#c8e6c9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#2e7d32', fontWeight: '600' }}>Quality Done:</span> {statusCounts.quality}
                </div>
                <div style={{ background: '#fff3e0', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#e65100', fontWeight: '600' }}>Cooking:</span> {statusCounts.cooking}
                </div>
                <div style={{ background: '#e1bee7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#7b1fa2', fontWeight: '600' }}>Passed:</span> {statusCounts.passed}
                </div>
                <div style={{ background: '#b2dfdb', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#00695c', fontWeight: '600' }}>Offer:</span> {statusCounts.offer}
                </div>
                <div style={{ background: '#bbdefb', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#0d47a1', fontWeight: '600' }}>Final:</span> {statusCounts.final}
                </div>
                <div style={{ background: '#a5d6a7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#1b5e20', fontWeight: '600' }}>Completed:</span> {statusCounts.completed}
                </div>
            </div>

            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>Complete Sample Book — {total} entries</span>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ background: 'linear-gradient(135deg, #6c3483, #8e44ad)', color: 'white' }}>
                            {['SL', 'Date', 'Broker', 'Bags', 'Pkg', 'Party', 'Location', 'Variety', 'Staff', 'Quality', 'Decision', 'Cooking', 'Final ₹', 'Status', 'Action'].map(h => (
                                <th key={h} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: '600', whiteSpace: 'nowrap', fontSize: '10px' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={20} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={16} style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No entries in sample book</td></tr>
                        ) : entries.map((e, i) => {
                            const qp = e.qualityParameters;
                            const cr = e.cookingReport;
                            const offer = e.offering;
                            const hasQuality = qp && qp.moisture != null;
                            const hasCooking = cr && cr.status;

                            const hasFinal = offer && offer.finalPrice;
                            const needsFill = offer && (
                                (offer.suteEnabled === false && !parseFloat(offer.finalSute) && !parseFloat(offer.sute)) ||
                                (offer.moistureEnabled === false && !parseFloat(offer.moistureValue)) ||
                                (offer.hamaliEnabled === false && !parseFloat(offer.hamali)) ||
                                (offer.brokerageEnabled === false && !parseFloat(offer.brokerage)) ||
                                (offer.lfEnabled === false && !parseFloat(offer.lf))
                            );
                            return (
                                <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#faf5ff', borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', fontSize: '11px' }}>{(i + 1 + (page - 1) * pageSize)}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{new Date(e.entryDate).toLocaleDateString('en-IN')}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.brokerName}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', fontSize: '11px' }}>{e.bags}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.packaging || '75'}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.partyName}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.location}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '11px' }}>{e.variety}</td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontSize: '10px' }}>
                                        {e.creator?.username ? (
                                            <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 6px', borderRadius: '8px', fontSize: '10px' }}>
                                                {e.creator.username.substring(0, 4).toUpperCase()}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                        {hasQuality ? (
                                            <span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>✓ Done</span>
                                        ) : (
                                            <span style={{ background: '#ffcdd2', color: '#c62828', padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>Pending</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>{getDecisionBadge(e.lotSelectionDecision)}</td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                        {hasCooking ? (
                                            <span style={{ background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>✓</span>
                                        ) : (
                                            <span style={{ background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: (hasFinal || offer?.finalBaseRate || offer?.offerBaseRateValue) ? '#1565c0' : '#999' }}>
                                        {hasFinal ? `₹${offer.finalPrice}` : offer?.finalBaseRate ? `₹${offer.finalBaseRate}` : offer?.offerBaseRateValue ? `₹${offer.offerBaseRateValue}` : '-'}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                        <div style={{ marginBottom: hasFinal ? '4px' : '0' }}>{getStatusBadge(e.workflowStatus)}</div>
                                        {hasFinal && (
                                            <>
                                                <div style={{ marginBottom: '2px' }}>
                                                    <span style={{ padding: '2px 4px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', background: '#d4edda', color: '#155724', whiteSpace: 'nowrap', display: 'inline-block', border: '1px solid #c3e6cb' }}>
                                                        Admin Added ✅
                                                    </span>
                                                </div>
                                                <div>
                                                    <span style={{ padding: '2px 4px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', background: needsFill ? '#fff3cd' : '#d4edda', color: needsFill ? '#856404' : '#155724', whiteSpace: 'nowrap', display: 'inline-block', border: needsFill ? '1px solid #ffeeba' : '1px solid #c3e6cb' }}>
                                                        {needsFill ? 'Manager Missing ⏳' : 'Manager Added ✅✅'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </td>
                                    <td style={{ padding: '6px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => { setSelectedEntry(e); setShowDetailModal(true); }}
                                            style={{ padding: '4px 10px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}
                                        >
                                            👁 View
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
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

            {/* Detail Modal */}
            {showDetailModal && selectedEntry && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '95%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative' }}>
                        <div style={{ background: 'linear-gradient(135deg, #6c3483, #8e44ad)', padding: '16px 20px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '700' }}>📋 Complete Entry Details</h2>
                            <button onClick={() => { setShowDetailModal(false); setSelectedEntry(null); }} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', color: '#6c3483', fontWeight: '700', flexShrink: 0 }}>✕</button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            {/* Staff Entry Details */}
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#6c3483', borderBottom: '2px solid #6c3483', paddingBottom: '6px' }}>
                                    Staff Entry — {selectedEntry.creator?.username || 'Staff'}
                                    {selectedEntry.entryType && (
                                        <span style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: selectedEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e8f5e9' : selectedEntry.entryType === 'LOCATION_SAMPLE' ? '#fff3e0' : '#e3f2fd', color: selectedEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#2e7d32' : selectedEntry.entryType === 'LOCATION_SAMPLE' ? '#e65100' : '#1565c0', fontWeight: '600' }}>
                                            {selectedEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'Ready Lorry' : selectedEntry.entryType === 'LOCATION_SAMPLE' ? 'Location Sample' : 'Mill Sample'}
                                        </span>
                                    )}
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    <DetailItem label="Date" value={new Date(selectedEntry.entryDate).toLocaleDateString('en-IN')} />
                                    <DetailItem label="Broker Name" value={selectedEntry.brokerName} />
                                    <DetailItem label="Bags" value={String(selectedEntry.bags)} />
                                    <DetailItem label="Packaging" value={selectedEntry.packaging || '75 Kg'} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '10px' }}>
                                    <DetailItem label="Party Name" value={selectedEntry.partyName} />
                                    <DetailItem label="Paddy Location" value={selectedEntry.location} />
                                    <DetailItem label="Lorry Number" value={(selectedEntry as any).lorryNumber || '-'} />
                                    <DetailItem label="Variety" value={selectedEntry.variety} />
                                </div>
                            </div>

                            {/* Quality Parameters */}
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#2e7d32', borderBottom: '2px solid #2e7d32', paddingBottom: '6px' }}>
                                    Quality Parameters {selectedEntry.qualityParameters?.reportedBy && <span style={{ fontSize: '11px', color: '#666', fontWeight: '400' }}> — Reported by: {selectedEntry.qualityParameters.reportedBy}</span>}
                                </h3>
                                {selectedEntry.qualityParameters ? (
                                    <div>
                                        {/* Row 1: Moisture, Cutting, Bend, Grains Count */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                            <DetailItem label="Moisture" value={`${selectedEntry.qualityParameters.moisture}%`} />
                                            <DetailItem label="Cutting" value={`${selectedEntry.qualityParameters.cutting1}×${selectedEntry.qualityParameters.cutting2}`} />
                                            <DetailItem label="Bend" value={selectedEntry.qualityParameters.bend1 ? `${selectedEntry.qualityParameters.bend1}×${selectedEntry.qualityParameters.bend2}` : '-'} />
                                            <DetailItem label="Grains Count" value={String(selectedEntry.qualityParameters.grainsCount || '-')} />
                                        </div>
                                        {/* Row 2: Mix S, Mix L, Mix */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' }}>
                                            <DetailItem label="Mix S" value={selectedEntry.qualityParameters.mixS ? String(selectedEntry.qualityParameters.mixS) : '-'} />
                                            <DetailItem label="Mix L" value={selectedEntry.qualityParameters.mixL ? String(selectedEntry.qualityParameters.mixL) : '-'} />
                                            <DetailItem label="Mix" value={String(selectedEntry.qualityParameters.mix || '-')} />
                                        </div>
                                        {/* Row 3: Kandu, Oil, SK */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' }}>
                                            <DetailItem label="Kandu" value={String(selectedEntry.qualityParameters.kandu || '-')} />
                                            <DetailItem label="Oil" value={String(selectedEntry.qualityParameters.oil || '-')} />
                                            <DetailItem label="SK" value={String(selectedEntry.qualityParameters.sk || '-')} />
                                        </div>
                                        {/* Row 4: WB fields */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '10px' }}>
                                            <DetailItem label="WB (R)" value={selectedEntry.qualityParameters.wbR ? String(selectedEntry.qualityParameters.wbR) : '-'} />
                                            <DetailItem label="WB (BK)" value={selectedEntry.qualityParameters.wbBk ? String(selectedEntry.qualityParameters.wbBk) : '-'} />
                                            <DetailItem label="WB (T)" value={String(selectedEntry.qualityParameters.wbT || '-')} />
                                            <DetailItem label="Paddy WB" value={selectedEntry.qualityParameters.paddyWb ? String(selectedEntry.qualityParameters.paddyWb) : '-'} />
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: '#e74c3c', fontSize: '13px' }}>⚠️ Quality parameters not added yet</p>
                                )}
                            </div>

                            {/* Cooking Report */}
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#e65100', borderBottom: '2px solid #e65100', paddingBottom: '6px' }}>🍚 Cooking Report</h3>
                                {selectedEntry.cookingReport ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                        <DetailItem label="Status" value={selectedEntry.cookingReport.status === 'MEDIUM' ? 'PASS' : (selectedEntry.cookingReport.status || '-')} />
                                        <DetailItem label="Cooking Result" value={selectedEntry.cookingReport.cookingResult || '-'} />
                                        <DetailItem label="Recheck Count" value={selectedEntry.cookingReport.recheckCount ? String(selectedEntry.cookingReport.recheckCount) : '-'} />
                                    </div>
                                ) : (
                                    <p style={{ color: '#e74c3c', fontSize: '13px' }}>⚠️ Cooking report not added yet</p>
                                )}
                            </div>

                            {/* Final Rate Details */}
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0d47a1', borderBottom: '2px solid #0d47a1', paddingBottom: '6px' }}>💰 Final Rate</h3>
                                {selectedEntry.offering ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0' }}>
                                        {/* Rate Line */}
                                        <div style={{ background: '#e3f2fd', padding: '10px 14px', borderRadius: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>FINAL RATE: </span>
                                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#1565c0' }}>
                                                {selectedEntry.offering.finalPrice ? `₹${selectedEntry.offering.finalPrice}` : selectedEntry.offering.finalBaseRate ? `₹${selectedEntry.offering.finalBaseRate}` : selectedEntry.offering.offerBaseRateValue ? `₹${selectedEntry.offering.offerBaseRateValue}` : 'Not set'}
                                            </span>
                                            {selectedEntry.offering.baseRateType && (
                                                <span style={{ fontSize: '12px', color: '#555', marginLeft: '8px', fontWeight: '600' }}>
                                                    {selectedEntry.offering.baseRateType.replace(/_/g, '/')} | {selectedEntry.offering.baseRateUnit === 'per_quintal' ? 'Per Quintal' : selectedEntry.offering.baseRateUnit === 'per_ton' ? 'Per Ton' : 'Per Bag'}
                                                </span>
                                            )}
                                        </div>
                                        {/* All details in one compact column */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
                                            {(selectedEntry.offering.finalSute || selectedEntry.offering.sute) && (
                                                <DetailItem label="Sute" value={`${selectedEntry.offering.finalSute || selectedEntry.offering.sute} ${(selectedEntry.offering.finalSuteUnit || selectedEntry.offering.suteUnit) === 'per_ton' ? '/Ton' : (selectedEntry.offering.finalSuteUnit || selectedEntry.offering.suteUnit) === 'per_quintal' ? '/Qtl' : '/Bag'}`} />
                                            )}
                                            {selectedEntry.offering.moistureValue != null && parseFloat(selectedEntry.offering.moistureValue) > 0 && (
                                                <DetailItem label="Moisture" value={`${selectedEntry.offering.moistureValue}%`} />
                                            )}
                                            <DetailItem label="Hamali" value={selectedEntry.offering.hamali ? `${selectedEntry.offering.hamali} ${selectedEntry.offering.hamaliUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : selectedEntry.offering.hamaliEnabled === false ? '⏳ Manager to fill' : '-'} />
                                            <DetailItem label="Brokerage" value={selectedEntry.offering.brokerage ? `${selectedEntry.offering.brokerage} ${selectedEntry.offering.brokerageUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : selectedEntry.offering.brokerageEnabled === false ? '⏳ Manager to fill' : '-'} />
                                            <DetailItem label="LF" value={selectedEntry.offering.lf ? `${selectedEntry.offering.lf} ${selectedEntry.offering.lfUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : selectedEntry.offering.lfEnabled === false ? '⏳ Manager to fill' : '-'} />
                                            <DetailItem label="EGB" value={selectedEntry.offering.egbType === 'purchase' ? `${selectedEntry.offering.egbValue || '-'} (Purchase)` : (selectedEntry.offering.baseRateType || '').includes('LOOSE') ? '0 (Mill)' : '-'} />
                                            {selectedEntry.offering.customDivisor && <DetailItem label="Custom Divisor" value={String(selectedEntry.offering.customDivisor)} />}
                                            <DetailItem label="Finalized" value={selectedEntry.offering.isFinalized ? '✅ Yes' : '❌ No'} />
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: '#e74c3c', fontSize: '13px' }}>⚠️ Pricing not added yet</p>
                                )}
                            </div>

                            {/* Workflow Status */}
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#c62828', borderBottom: '2px solid #c62828', paddingBottom: '6px' }}>📊 Workflow Status</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    <DetailItem label="Current Status" value={selectedEntry.workflowStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())} />
                                    <DetailItem label="Lot Decision" value={selectedEntry.lotSelectionDecision?.replace(/_/g, ' ') || '-'} />
                                    <DetailItem label="Supervisor" value={(selectedEntry as any).supervisorName || '-'} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSampleBook;
