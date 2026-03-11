import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface SampleEntry {
    id: string;
    serialNo?: number;
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

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => {
    const isBold = ['Grains Count', 'Paddy WB'].includes(label);
    return (
        <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px', fontWeight: '600', textTransform: 'capitalize' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: isBold ? '800' : '700', color: isBold ? '#000' : '#2c3e50' }}>{value || '-'}</div>
        </div>
    );
};

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';

const AdminSampleBook: React.FC = () => {
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' });
    const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailMode, setDetailMode] = useState<'full' | 'quick'>('full');
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
            QUALITY_CHECK: { bg: '#ffe0b2', color: '#e65100', label: 'Pending Quality Check' },
            LOT_SELECTION: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Pending Sample Selection' },
            COOKING_REPORT: { bg: '#fff8e1', color: '#f57f17', label: 'Pending Cooking Report' },
            FINAL_REPORT: { bg: '#e8eaf6', color: '#283593', label: 'Pending Final Pass' },
            LOT_ALLOTMENT: { bg: '#e0f7fa', color: '#006064', label: 'Pending Loading Lots' },
            PENDING_ALLOTTING_SUPERVISOR: { bg: '#fce4ec', color: '#880e4f', label: 'Pending Supervisor Allotment' },
            PHYSICAL_INSPECTION: { bg: '#ffe0b2', color: '#bf360c', label: 'Physical Inspection' },
            INVENTORY_ENTRY: { bg: '#f1f8e9', color: '#33691e', label: 'Inventory Entry' },
            COMPLETED: { bg: '#c8e6c9', color: '#1b5e20', label: 'Completed' },
            FAILED: { bg: '#ffcdd2', color: '#b71c1c', label: 'Failed' },
        };
        const c = colors[status] || { bg: '#f5f5f5', color: '#666', label: status.replace(/_/g, ' ') };
        return <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>;
    };

    const getDecisionBadge = (decision: string) => {
        if (!decision) return '-';
        const map: Record<string, { label: string; bg: string; color: string }> = {
            PASS_WITH_COOKING: { label: 'Pass + Cooking', bg: '#ffe0b2', color: '#e65100' },
            PASS_WITHOUT_COOKING: { label: 'Pass', bg: '#e8f5e9', color: '#2e7d32' },
            FAIL: { label: 'Fail', bg: '#ffcdd2', color: '#b71c1c' },
            SOLDOUT: { label: 'Sold Out', bg: '#800000', color: '#ffffff' },
        };
        const d = map[decision] || { label: decision, bg: '#f5f5f5', color: '#666' };
        return <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', background: d.bg, color: d.color, whiteSpace: 'nowrap' }}>{d.label}</span>;
    };

    const statusCounts = {
        staff: entries.filter(e => e.workflowStatus === 'STAFF_ENTRY').length,
        quality: entries.filter(e => e.qualityParameters?.moisture != null || (e.qualityParameters as any)?.dryMoisture != null).length,
        cooking: entries.filter(e => e.cookingReport?.status).length,
        passed: entries.filter(e => e.lotSelectionDecision?.includes('PASS')).length,
        offer: entries.filter(e => e.offering?.offerRate || e.offering?.offerBaseRateValue).length,
        final: entries.filter(e => e.offering?.finalPrice).length,
        completed: entries.filter(e => e.workflowStatus === 'COMPLETED').length,
    };

    return (
        <div>
            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '0px', flexWrap: 'wrap' }}>
                <div style={{ background: '#e3f2fd', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#1565c0', fontWeight: '600' }}>Staff Entry</span> {statusCounts.staff}
                </div>
                <div style={{ background: '#c8e6c9', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#2e7d32', fontWeight: '600' }}>Quality Done</span> {statusCounts.quality}
                </div>
                <div style={{ background: '#ffe0b2', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#e65100', fontWeight: '600' }}>Cooking</span> {statusCounts.cooking}
                </div>
                <div style={{ background: '#e1bee7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#7b1fa2', fontWeight: '600' }}>Passed</span> {statusCounts.passed}
                </div>
                <div style={{ background: '#b2dfdb', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#00695c', fontWeight: '600' }}>Offer</span> {statusCounts.offer}
                </div>
                <div style={{ background: '#e3f2fd', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#0d47a1', fontWeight: '600' }}>Final</span> {statusCounts.final}
                </div>
                <div style={{ background: '#a5d6a7', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#1b5e20', fontWeight: '600' }}>Completed</span> {statusCounts.completed}
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
                    <button onClick={() => { setPage(1); setTimeout(() => fetchEntries(), 0); }} style={{ padding: '6px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Apply Filters</button>
                    <button onClick={() => { setFilters({ broker: '', variety: '', party: '', location: '', startDate: '', endDate: '' }); setPage(1); }} style={{ padding: '6px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                </div>
            )}

            <div style={{ overflowX: 'auto', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', border: '1px solid #000' }}>
                    <thead>
                        <tr style={{ background: '#1a237e', color: 'white' }}>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>SL No</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bags</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Pkg</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '10px', textAlign: 'left', whiteSpace: 'nowrap', width: '5%' }}>Date</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '10px', textAlign: 'left', whiteSpace: 'nowrap', width: '7%' }}>Broker</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '10%' }}>Party Name</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '10%' }}>Location</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'left', whiteSpace: 'nowrap', width: '8%' }}>Variety</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '9%' }}>Sample Collected By</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '5%' }}>Quality</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '5%' }}>Decision</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '5%' }}>Cooking</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '5%' }}>Final ₹</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '5%' }}>Status</th>
                            <th style={{ border: '1px solid #000', padding: '4px 5px', fontWeight: '600', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={20} style={{ border: '1px solid #000', textAlign: 'left', padding: '30px', color: '#888' }}>Loading...</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={16} style={{ border: '1px solid #000', textAlign: 'left', padding: '30px', color: '#888' }}>No entries in sample book</td></tr>
                        ) : entries.map((e, i) => {
                            const qp = e.qualityParameters;
                            const cr = e.cookingReport;
                            const offer = e.offering;
                            const hasQuality = qp && (qp.moisture != null || (qp as any).dryMoisture != null);
                            const hasCooking = cr && cr.status;

                            const hasFinal = offer && offer.finalPrice;
                            const needsFill = offer && (
                                (offer.suteEnabled === false && !parseFloat(offer.finalSute) && !parseFloat(offer.sute)) ||
                                (offer.moistureEnabled === false && !parseFloat(offer.moistureValue)) ||
                                (offer.hamaliEnabled === false && !parseFloat(offer.hamali)) ||
                                (offer.brokerageEnabled === false && !parseFloat(offer.brokerage)) ||
                                (offer.lfEnabled === false && !parseFloat(offer.lf))
                            );
                            const isResampleActive = e.lotSelectionDecision === 'FAIL' && e.workflowStatus !== 'FAILED';
                            const isHardFail = e.workflowStatus === 'FAILED' || (cr && String(cr.status).toUpperCase() === 'FAIL');
                            return (
                                <tr key={e.id} style={{ background: e.lotSelectionDecision === 'SOLDOUT' ? '#fff0f0' : isHardFail ? '#fff0f0' : isResampleActive ? '#fff3e0' : e.workflowStatus === 'COMPLETED' ? '#f0fff0' : e.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : e.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff', borderLeft: isHardFail ? '4px solid #e74c3c' : isResampleActive ? '4px solid #f59e0b' : e.workflowStatus === 'COMPLETED' ? '4px solid #27ae60' : 'none' }}>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}>{(e as any).serialNo || (i + 1 + (page - 1) * pageSize)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '700', fontSize: '11px', whiteSpace: 'nowrap' }}>{e.bags || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>{Number(e.packaging) === 0 ? 'Loose' : `${e.packaging || '75'} kg`}</td>
                                    <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'left', fontSize: '9px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                        {new Date(e.entryDate).toLocaleDateString('en-IN')}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'left', fontSize: '9px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                        {e.brokerName || '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        {e.partyName ? (
                                            <span
                                                style={{ color: '#333', fontWeight: '600' }}
                                            >
                                                {toTitleCase(e.partyName)}
                                            </span>
                                        ) : '-'}
                                        {e.entryType === 'DIRECT_LOADED_VEHICLE' && e.lorryNumber ? <div style={{ fontSize: '10px', color: '#555', fontWeight: '600' }}>{e.lorryNumber.toUpperCase()}</div> : ''}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        {!e.partyName && e.location ? (
                                            <span
                                                style={{ color: '#555', fontWeight: '600' }}
                                            >
                                                {toTitleCase(e.location)}
                                            </span>
                                        ) : (toTitleCase(e.location) || '-')}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '11px', whiteSpace: 'nowrap' }}>{toTitleCase(e.variety)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        {e.sampleCollectedBy ? (
                                            <span style={{ fontSize: '11px', color: '#666' }}>
                                                {toTitleCase(e.sampleCollectedBy)}
                                            </span>
                                        ) : e.creator?.username ? (
                                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#1565c0' }}>
                                                {toTitleCase(e.creator.username)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        {hasQuality ? (
                                            <span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>✓ Done</span>
                                        ) : (
                                            <span style={{ background: '#ffccbc', color: '#d84315', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>⏳ No Qlty</span>
                                        )}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>{getDecisionBadge(e.lotSelectionDecision)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        {e.lotSelectionDecision === 'SOLDOUT' ? (
                                            <span style={{ background: '#800000', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>SOLD OUT</span>
                                        ) : hasCooking ? (
                                            cr.status === 'FAIL' || e.workflowStatus === 'FAILED' ? (
                                                <span style={{ background: '#ffcdd2', color: '#b71c1c', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>✕ Failed</span>
                                            ) : (
                                                <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>✓ Passed</span>
                                            )
                                        ) : (
                                            <span style={{ background: '#ffe0b2', color: '#e65100', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>⏳ Pending</span>
                                        )}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: (hasFinal || offer?.finalBaseRate || offer?.offerBaseRateValue) ? '#1565c0' : '#999', whiteSpace: 'nowrap' }}>
                                        {hasFinal ? `₹${offer.finalPrice}` : offer?.finalBaseRate ? `₹${offer.finalBaseRate}` : offer?.offerBaseRateValue ? `₹${offer.offerBaseRateValue}` : '-'}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        {getStatusBadge(e.workflowStatus)}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        <button
                                            onClick={() => { setSelectedEntry(e); setDetailMode('full'); setShowDetailModal(true); }}
                                            style={{ padding: '3px 8px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}
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

            {
                totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px' }}>
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: page <= 1 ? '#f5f5f5' : 'white' }}>← Prev</button>
                        <span style={{ padding: '6px 12px', fontSize: '13px', color: '#666' }}>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: page >= totalPages ? '#f5f5f5' : 'white' }}>Next →</button>
                    </div>
                )
            }

            {/* Detail Modal */}
            {
                showDetailModal && selectedEntry && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' }} onClick={() => { setShowDetailModal(false); setSelectedEntry(null); }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '95%', maxWidth: detailMode === 'full' ? '900px' : '500px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', marginTop: '30px' }} onClick={e => e.stopPropagation()}>
                            {/* Redesigned Header — Green Background, Aligned Items */}
                            <div style={{
                                background: selectedEntry.entryType === 'DIRECT_LOADED_VEHICLE'
                                    ? '#1565c0'
                                    : selectedEntry.entryType === 'LOCATION_SAMPLE'
                                        ? '#e67e22'
                                        : '#4caf50',
                                padding: '16px 20px', borderRadius: '8px 8px 0 0', color: 'white',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '800', opacity: 0.9 }}>
                                        {new Date(selectedEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </div>
                                    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '22px', fontWeight: '900', letterSpacing: '1.5px', whiteSpace: 'nowrap' }}>
                                        {selectedEntry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'Ready Lorry' : selectedEntry.entryType === 'LOCATION_SAMPLE' ? 'Location Sample' : 'Mill Sample'}
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '24px', fontWeight: '900', letterSpacing: '0.5px', marginTop: '2px',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%'
                                }}>
                                    {toTitleCase(selectedEntry.brokerName) || '-'}
                                </div>
                                <button onClick={() => { setShowDetailModal(false); setSelectedEntry(null); }} style={{
                                    position: 'absolute', top: '16px', right: '16px',
                                    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                                    width: '36px', height: '36px', cursor: 'pointer', fontSize: '18px',
                                    color: 'white', fontWeight: '900', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                }}>✕</button>
                            </div>

                            <div style={{ padding: '16px 20px' }}>
                                {/* Entry Details — Date, Bags, Pack, Variety, Party, Location, Lorry, Sample Collected By */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                    <DetailItem label="Date" value={new Date(selectedEntry.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                                    <DetailItem label="Bags" value={String(selectedEntry.bags)} />
                                    <DetailItem label="Packaging" value={`${selectedEntry.packaging || '75'} Kg`} />
                                    <DetailItem label="Variety" value={selectedEntry.variety} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '0px' }}>
                                    <DetailItem label="Party Name" value={selectedEntry.partyName || '-'} />
                                    <DetailItem label="Paddy Location" value={selectedEntry.location || '-'} />
                                    <DetailItem label="Lorry Number" value={(selectedEntry as any).lorryNumber || '-'} />
                                    <DetailItem label="Sample Collected By" value={(selectedEntry as any).sampleCollectedBy || '-'} />
                                </div>

                                {/* Quality Parameters — grouped rows, hide 0 values */}
                                <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#e67e22', borderBottom: '2px solid #e67e22', paddingBottom: '6px' }}>
                                    🔬 Quality Parameters
                                </h4>
                                {selectedEntry.qualityParameters ? (() => {
                                    const qp = selectedEntry.qualityParameters;
                                    const fmt = (v: any, forceDecimal = false, precision = 2) => {
                                        if (v == null || v === '') return null;
                                        const n = Number(v);
                                        if (isNaN(n) || n === 0) return null;
                                        if (forceDecimal) return n.toFixed(1);
                                        if (precision > 2) return String(parseFloat(n.toFixed(precision)));
                                        return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
                                    };
                                    const fmtB = (v: any, useBrackets = false) => {
                                        const f = fmt(v);
                                        return f && useBrackets ? `(${f})` : f;
                                    };
                                    // Row 1: Moisture, Cutting, Bend, Grains Count
                                    const row1: { label: string; value: React.ReactNode }[] = [];
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
                                    if (qp.cutting1 && qp.cutting2 && (Number(qp.cutting1) !== 0 || Number(qp.cutting2) !== 0)) row1.push({ label: 'Cutting', value: `${fmt(qp.cutting1) || '0'}×${fmt(qp.cutting2) || '0'}` });
                                    if (qp.bend1 && qp.bend2 && (Number(qp.bend1) !== 0 || Number(qp.bend2) !== 0)) row1.push({ label: 'Bend', value: `${fmt(qp.bend1) || '0'}×${fmt(qp.bend2) || '0'}` });
                                    if (fmtB(qp.grainsCount, true)) row1.push({ label: 'Grains Count', value: fmtB(qp.grainsCount, true)! });
                                    // Row 2: Mix, S Mix, L Mix, Oil
                                    const row2: { label: string; value: React.ReactNode }[] = [];
                                    if (fmt(qp.mix)) row2.push({ label: 'Mix', value: fmtB(qp.mix)! });
                                    if (fmt(qp.mixS)) row2.push({ label: 'S Mix', value: fmtB(qp.mixS)! });
                                    if (fmt(qp.mixL)) row2.push({ label: 'L Mix', value: fmtB(qp.mixL)! });
                                    if (fmt(qp.oil)) row2.push({ label: 'Oil', value: fmtB(qp.oil)! });
                                    // Row 3: SK, Kandu, WB (R+BK+T combined)
                                    const row3: { label: string; value: React.ReactNode }[] = [];
                                    if (fmt(qp.sk)) row3.push({ label: 'SK', value: fmtB(qp.sk)! });
                                    if (fmt(qp.kandu)) row3.push({ label: 'Kandu', value: fmtB(qp.kandu)! });
                                    // Combine WB R, BK, T into one value
                                    const wbParts: string[] = [];
                                    if (fmt(qp.wbR)) wbParts.push(`R:${fmt(qp.wbR)}`);
                                    if (fmt(qp.wbBk)) wbParts.push(`BK:${fmt(qp.wbBk)}`);
                                    if (fmt(qp.wbT)) wbParts.push(`T:${fmt(qp.wbT)}`);
                                    if (wbParts.length > 0) row3.push({ label: 'WB (R/BK/T)', value: wbParts.join(' | ') });
                                    const hasPaddyWb = fmt(qp.paddyWb);
                                    return (
                                        <div>
                                            {row1.length > 0 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                                    {row1.map(item => <DetailItem key={item.label} label={item.label} value={item.value} />)}
                                                </div>
                                            )}
                                            {row2.length > 0 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                                    {row2.map(item => <DetailItem key={item.label} label={item.label} value={item.value} />)}
                                                </div>
                                            )}
                                            {row3.length > 0 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                                    {row3.map(item => <DetailItem key={item.label} label={item.label} value={item.value} />)}
                                                </div>
                                            )}
                                            {hasPaddyWb && (
                                                <div style={{
                                                    marginTop: '10px',
                                                    background: Number(qp.paddyWb) < 50 ? '#fff5f5' : (Number(qp.paddyWb) <= 50.5 ? '#fff9f0' : '#e8f5e9'),
                                                    padding: '8px 10px',
                                                    borderRadius: '6px',
                                                    border: `1px solid ${Number(qp.paddyWb) < 50 ? '#feb2b2' : (Number(qp.paddyWb) <= 50.5 ? '#fbd38d' : '#c8e6c9')}`,
                                                    textAlign: 'center',
                                                    marginBottom: '8px',
                                                    maxWidth: '130px',
                                                    margin: '10px auto 8px'
                                                }}>
                                                    <div style={{ fontSize: '10px', color: Number(qp.paddyWb) < 50 ? '#c53030' : (Number(qp.paddyWb) <= 50.5 ? '#9c4221' : '#2e7d32'), marginBottom: '2px', fontWeight: '600' }}>Paddy WB</div>
                                                    <div style={{ fontSize: '13px', fontWeight: '800', color: Number(qp.paddyWb) < 50 ? '#d32f2f' : (Number(qp.paddyWb) <= 50.5 ? '#f39c12' : '#1b5e20') }}>{fmtB(qp.paddyWb)}</div>
                                                </div>
                                            )}
                                            {qp.reportedBy && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                                                    <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600' }}>Sample Collected By</div>
                                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c3e50' }}>{qp.reportedBy}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })() : (
                                    <p style={{ color: '#999', fontSize: '13px', fontStyle: 'italic' }}>Quality parameters not added yet</p>
                                )}

                                {/* Full mode: Cooking, Final Rate, Workflow */}
                                {detailMode === 'full' && (
                                    <>
                                        {/* Cooking Report */}
                                        <div style={{ marginTop: '16px' }}>
                                            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#e65100', borderBottom: '2px solid #e65100', paddingBottom: '6px' }}>🍚 Cooking Report</h4>
                                            {selectedEntry.cookingReport ? (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                                    <DetailItem label="Status" value={selectedEntry.cookingReport.status === 'MEDIUM' ? 'PASS' : (selectedEntry.cookingReport.status || '-')} />
                                                    <DetailItem label="Cooking Result" value={selectedEntry.cookingReport.cookingResult || '-'} />
                                                    <DetailItem label="Recheck Count" value={selectedEntry.cookingReport.recheckCount ? String(selectedEntry.cookingReport.recheckCount) : '-'} />
                                                </div>
                                            ) : (
                                                <p style={{ color: '#999', fontSize: '12px', fontStyle: 'italic' }}>Not added yet</p>
                                            )}
                                        </div>

                                        {/* Final Rate */}
                                        <div style={{ marginTop: '16px' }}>
                                            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#0d47a1', borderBottom: '2px solid #0d47a1', paddingBottom: '6px' }}>💰 Final Rate</h4>
                                            {selectedEntry.offering ? (
                                                <div>
                                                    <div style={{ background: '#e3f2fd', padding: '8px 12px', borderRadius: '6px', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>RATE: </span>
                                                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#1565c0' }}>
                                                            {selectedEntry.offering.finalPrice ? `₹${selectedEntry.offering.finalPrice}` : selectedEntry.offering.finalBaseRate ? `₹${selectedEntry.offering.finalBaseRate}` : selectedEntry.offering.offerBaseRateValue ? `₹${selectedEntry.offering.offerBaseRateValue}` : 'Not set'}
                                                        </span>
                                                        {selectedEntry.offering.baseRateType && (
                                                            <span style={{ fontSize: '11px', color: '#555', marginLeft: '6px' }}>
                                                                {selectedEntry.offering.baseRateType.replace(/_/g, '/')} | {selectedEntry.offering.baseRateUnit === 'per_quintal' ? 'Per Quintal' : selectedEntry.offering.baseRateUnit === 'per_ton' ? 'Per Ton' : 'Per Bag'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                                        {(selectedEntry.offering.finalSute || selectedEntry.offering.sute) && (
                                                            <DetailItem label="Sute" value={`${selectedEntry.offering.finalSute || selectedEntry.offering.sute} ${(selectedEntry.offering.finalSuteUnit || selectedEntry.offering.suteUnit) === 'per_ton' ? '/Ton' : (selectedEntry.offering.finalSuteUnit || selectedEntry.offering.suteUnit) === 'per_quintal' ? '/Qtl' : '/Bag'}`} />
                                                        )}
                                                        <DetailItem label="Hamali" value={selectedEntry.offering.hamali ? `${selectedEntry.offering.hamali} ${selectedEntry.offering.hamaliUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : '-'} />
                                                        <DetailItem label="Brokerage" value={selectedEntry.offering.brokerage ? `${selectedEntry.offering.brokerage} ${selectedEntry.offering.brokerageUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : '-'} />
                                                        <DetailItem label="LF" value={selectedEntry.offering.lf ? `${selectedEntry.offering.lf} ${selectedEntry.offering.lfUnit === 'per_quintal' ? '/Qtl' : '/Bag'}` : '-'} />
                                                        <DetailItem label="EGB" value={selectedEntry.offering.egbType === 'purchase' ? `${selectedEntry.offering.egbValue || '-'} (Purchase)` : (selectedEntry.offering.baseRateType || '').includes('LOOSE') ? '0 (Mill)' : '-'} />
                                                        <DetailItem label="Finalized" value={selectedEntry.offering.isFinalized ? '✅ Yes' : '❌ No'} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <p style={{ color: '#999', fontSize: '12px', fontStyle: 'italic' }}>Not added yet</p>
                                            )}
                                        </div>

                                        {/* Workflow Status */}
                                        <div style={{ marginTop: '16px' }}>
                                            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#c62828', borderBottom: '2px solid #c62828', paddingBottom: '6px' }}>📊 Workflow Status</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                                <DetailItem label="Current Status" value={selectedEntry.workflowStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())} />
                                                <DetailItem label="Lot Decision" value={selectedEntry.lotSelectionDecision?.replace(/_/g, ' ') || '-'} />
                                                <DetailItem label="Supervisor" value={(selectedEntry as any).supervisorName || '-'} />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Close button at bottom */}
                                <button onClick={() => { setShowDetailModal(false); setSelectedEntry(null); }}
                                    style={{ marginTop: '16px', width: '100%', padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AdminSampleBook;
