import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

/**
 * RiceSampleBook - broker-grouped Rice Sample Book screen.
 * Dedicated rice implementation so paddy sample book logic remains isolated.
 */

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
    lotSelectionDecision?: string;
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
        reportedBy: string;
        uploadFileUrl?: string;
    };
    cookingReport?: {
        status: string;
        cookingResult: string;
        recheckCount?: number;
        remarks?: string;
        cookingDoneBy?: string;
        cookingApprovedBy?: string;
        history?: Array<{
            date?: string | null;
            status?: string | null;
            cookingDoneBy?: string | null;
            approvedBy?: string | null;
            remarks?: string | null;
        }>;
    };
    offering?: { finalPrice?: number; offeringPrice?: number; offerBaseRateValue?: number; baseRateType?: string };
    creator?: { username: string };
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
const formatPackagingLabel = (packaging?: string | number | null) => {
    const raw = String(packaging ?? '').trim();
    if (!raw) return '75 kg';

    const lower = raw.toLowerCase();
    if (lower === '0' || lower === 'loose' || lower.startsWith('loose')) return 'Loose';
    if (lower.includes('kg') || lower.includes('ton')) return raw;
    return `${raw} kg`;
};

const RiceSampleBook: React.FC = () => {
    const isRiceBook = true;
    const [entries, setEntries] = useState<SampleEntry[]>([]);
    const [loading, setLoading] = useState(false);

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

    useEffect(() => {
        loadEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    const loadEntries = async (fFrom?: string, fTo?: string, fBroker?: string) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const params: any = { page, pageSize: PAGE_SIZE };

            const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
            const dTo = fTo !== undefined ? fTo : filterDateTo;
            const b = fBroker !== undefined ? fBroker : filterBroker;

            if (dFrom) params.startDate = dFrom;
            if (dTo) params.endDate = dTo;
            if (b) params.broker = b;
            params.entryType = 'RICE_SAMPLE';

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
        } catch (error) {
            console.error('Failed to load entries', error);
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

    // Get unique brokers
    const brokersList = useMemo(() => {
        return Array.from(new Set(entries.map(e => e.brokerName))).sort();
    }, [entries]);

    // Group entries by date then broker
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

    // Status badge helper
    const cookingBadge = (entry: SampleEntry) => {
        const cr = entry.cookingReport;
        const d = entry.lotSelectionDecision;
        const result = cr?.status?.toLowerCase();

        if (result) {
            let label = cr!.status;
            let bg = '#f5f5f5';
            let color = '#666';
            if (result === 'pass' || result === 'ok') { label = 'Pass'; bg = '#e8f5e9'; color = '#2e7d32'; }
            else if (result === 'fail') { label = 'Fail'; bg = '#ffcdd2'; color = '#b71c1c'; }
            else if (result === 'recheck') { label = 'Recheck'; bg = '#e3f2fd'; color = '#1565c0'; }
            else if (result === 'medium') { label = 'Medium'; bg = '#fff8e1'; color = '#ef6c00'; }
            return <span style={{ background: bg, color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>{label}</span>;
        }

        if (d === 'PASS_WITH_COOKING') {
            return <span style={{ background: '#ffe0b2', color: '#e65100', padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>Pending</span>;
        }

        return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
    };

    const statusBadge = (entry: SampleEntry) => {
        const s = entry.workflowStatus;
        const d = entry.lotSelectionDecision;
        const cr = entry.cookingReport;
        let label = 'Pending';
        let bg = '#ffe0b2';
        let color = '#e65100';
        if (d === 'SOLDOUT') { bg = '#800000'; color = '#ffffff'; label = 'Sold Out'; }
        else if (s === 'FAILED' || d === 'FAIL') { bg = '#ffcdd2'; color = '#b71c1c'; label = 'Fail'; }
        else if (d === 'PASS_WITH_COOKING' && cr && cr.status) {
            const result = cr.status.toLowerCase();
            if (result === 'pass' || result === 'ok') {
                // Check if only 100-Gms quality data — show "100-Gms Passed"
                const qp = entry.qualityParameters;
                const hasFullQuality = qp && ((qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0) || (qp.mixS && Number(qp.mixS) !== 0) || (qp.mixL && Number(qp.mixL) !== 0));
                if (qp && qp.moisture != null && !hasFullQuality) { bg = '#e8f5e9'; color = '#2e7d32'; label = '100-Gms/Pass'; }
                else { bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass'; }
            }
            else if (result === 'fail') { bg = '#ffcdd2'; color = '#b71c1c'; label = 'Fail'; }
            else if (result === 'recheck') { bg = '#ffe0b2'; color = '#e65100'; label = 'Pending'; }
            else if (result === 'medium') {
                const qp = entry.qualityParameters;
                const hasFullQuality = qp && ((qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0) || (qp.mixS && Number(qp.mixS) !== 0) || (qp.mixL && Number(qp.mixL) !== 0));
                if (qp && qp.moisture != null && !hasFullQuality) { bg = '#e8f5e9'; color = '#2e7d32'; label = '100-Gms/Pass'; }
                else { bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass'; }
            }
        }
        else if (s === 'COMPLETED' && entry.offering?.finalPrice) { bg = '#800000'; color = '#ffffff'; label = 'Sold Out'; }
        else if (entry.offering?.finalPrice) { bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass'; }
        else if (d === 'PASS_WITHOUT_COOKING') { bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass'; }
        else { bg = '#ffe0b2'; color = '#e65100'; label = 'Pending'; }
        return <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', backgroundColor: bg, color, fontWeight: '600', whiteSpace: 'nowrap' as const }}>{label}</span>;
    };

    const qualityBadge = (entry: SampleEntry) => {
        const qp = entry.qualityParameters;
        const d = entry.lotSelectionDecision;
        const hasAnyQuality = !!(
            qp && (
                (qp.moisture != null && Number(qp.moisture) !== 0) ||
                (qp.grainsCount != null && Number(qp.grainsCount) !== 0) ||
                (qp.cutting1 && Number(qp.cutting1) !== 0) ||
                (qp.cutting2 && Number(qp.cutting2) !== 0) ||
                (qp.bend1 && Number(qp.bend1) !== 0) ||
                (qp.bend2 && Number(qp.bend2) !== 0) ||
                (qp.mix && Number(qp.mix) !== 0) ||
                (qp.mixS && Number(qp.mixS) !== 0) ||
                (qp.mixL && Number(qp.mixL) !== 0) ||
                (qp.kandu && Number(qp.kandu) !== 0) ||
                (qp.oil && Number(qp.oil) !== 0) ||
                (qp.sk && Number(qp.sk) !== 0) ||
                (qp.wbR && Number(qp.wbR) !== 0) ||
                (qp.wbBk && Number(qp.wbBk) !== 0) ||
                (qp.wbT && Number(qp.wbT) !== 0) ||
                (qp.paddyWb && Number(qp.paddyWb) !== 0)
            )
        );

        const lotPassed = d === 'PASS_WITH_COOKING' || d === 'PASS_WITHOUT_COOKING';
        const showDone = hasAnyQuality;
        const showPass = hasAnyQuality && lotPassed;

        if (!showDone && !showPass) {
            return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
        }

        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                {showDone && (
                    <span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', whiteSpace: 'nowrap' }}>Done</span>
                )}
                {showPass && (
                    <span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700', whiteSpace: 'nowrap' }}>Pass</span>
                )}
            </div>
        );
    };

    return (
        <div>
            {/* Filter Bar */}
            <div style={{ marginBottom: '0px' }}>
                <button onClick={() => setFiltersVisible(!filtersVisible)}
                    style={{ padding: '7px 16px', backgroundColor: filtersVisible ? '#e74c3c' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {filtersVisible ? '✕ Hide Filters' : '🔍 Filters'}
                </button>
                {filtersVisible && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'flex-end', flexWrap: 'wrap', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>From Date</label>
                            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>To Date</label>
                            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Broker</label>
                            <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                                <option value="">All Brokers</option>
                                {brokersList.map((b, i) => <option key={i} value={b}>{b}</option>)}
                            </select>
                        </div>
                        {(filterDateFrom || filterDateTo || filterBroker) && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleApplyFilters} style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', backgroundColor: '#3498db', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Apply</button>
                                <button onClick={handleClearFilters}
                                    style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Entries grouped by Date → Broker */}
            <div style={{ overflowX: 'auto', backgroundColor: 'white', border: '1px solid #ddd' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
                ) : Object.keys(groupedEntries).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries found</div>
                ) : (
                    Object.entries(groupedEntries).map(([dateKey, brokerGroups]) => {
                        let brokerSeq = 0;
                        return (
                            <div key={dateKey} style={{ marginBottom: '20px' }}>
                                {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                                    brokerSeq++;
                                    return (
                                        <div key={brokerName} style={{ marginBottom: '12px' }}>
                                            {/* Date + Paddy Sample bar — only first broker */}
                                            {brokerIdx === 0 && <div style={{
                                                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                                                color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                                                textAlign: 'left', letterSpacing: '0.5px'
                                            }}>
                                                {(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                                                &nbsp;&nbsp;{'Rice Sample'}
                                            </div>}
                                            {/* Broker name bar */}
                                            <div style={{
                                                background: '#e8eaf6',
                                                color: '#000', padding: '3px 10px', fontWeight: '700', fontSize: '12px',
                                                display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #c5cae9'
                                            }}>
                                                <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerSeq}.</span> {toTitleCase(brokerName)}
                                            </div>
                                            {/* Table */}
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', border: '1px solid #000' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#4a148c', color: 'white' }}>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '3.5%' }}>SL No</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bags</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Pkg</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Party Name</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>{'Rice Location'}</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '9%' }}>Variety</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Sample Collected By</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '11%' }}>Quality Report</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: isRiceBook ? '8%' : '6%' }}>Cooking Report</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '5.5%' }}>Offer</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '5.5%' }}>Final</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '7%' }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {brokerEntries.map((entry, idx) => {
                                                        const qp = entry.qualityParameters;
                                                        const cr = entry.cookingReport;
                                                        const cookingFail = entry.lotSelectionDecision === 'PASS_WITH_COOKING' && cr && cr.status && cr.status.toLowerCase() === 'fail';
                                                        const rowBg = entry.workflowStatus === 'FAILED' || entry.lotSelectionDecision === 'FAIL' || cookingFail
                                                            ? '#fff0f0'
                                                            : entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff';

                                                        const fallback = '--';
                                                        const fmtVal = (v: any, forceDecimal = false, precision = 2) => {
                                                            if (v == null || v === '') return fallback;
                                                            const n = Number(v);
                                                            if (isNaN(n) || n === 0) return fallback;
                                                            if (forceDecimal) return n.toFixed(1);
                                                            if (precision > 2) return String(parseFloat(n.toFixed(precision)));
                                                            return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
                                                        };
                                                        const hasFullQuality = qp && ((qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0) || (qp.mixS && Number(qp.mixS) !== 0) || (qp.mixL && Number(qp.mixL) !== 0));
                                                        return (
                                                            <tr key={entry.id} style={{ backgroundColor: rowBg }}>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '600', textAlign: 'center', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>{entry.bags || '0'}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>{formatPackagingLabel(entry.packaging)}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '14px', cursor: 'pointer', color: '#1565c0', fontWeight: '600', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                    onClick={() => setDetailEntry(entry)}>
                                                                    {toTitleCase(entry.partyName) || ''}
                                                                    {entry.entryType === 'DIRECT_LOADED_VEHICLE' && entry.lorryNumber ? <div style={{ fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{entry.lorryNumber.toUpperCase()}</div> : ''}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                                    {toTitleCase(entry.location) || '-'}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap' }}>{toTitleCase(entry.variety)}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                                    {entry.sampleCollectedBy ? (<span style={{ color: '#333', fontSize: '13px', fontWeight: '600' }}>{toTitleCase(entry.sampleCollectedBy)}</span>) : entry.creator?.username ? (<span style={{ fontWeight: '600', color: '#1565c0', fontSize: '13px' }}>{toTitleCase(entry.creator.username)}</span>) : '-'}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', whiteSpace: 'nowrap' }}>{qualityBadge(entry)}</td>
                                                                <td style={{
                                                                    border: '1px solid #000',
                                                                    padding: '3px 4px',
                                                                    fontSize: '11px',
                                                                    textAlign: 'center',
                                                                    whiteSpace: isRiceBook ? 'normal' : 'nowrap',
                                                                    lineHeight: isRiceBook ? '1.2' : '1',
                                                                    verticalAlign: isRiceBook ? 'top' : 'middle'
                                                                }}>
                                                                    {cookingBadge(entry)}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                    {entry.offering?.offerBaseRateValue ? (
                                                                        <span style={{ fontWeight: '700', color: '#1565c0', fontSize: '11px' }}>₹{entry.offering.offerBaseRateValue}</span>
                                                                    ) : entry.offering?.offeringPrice ? (
                                                                        <span style={{ fontWeight: '700', color: '#1565c0', fontSize: '11px' }}>₹{entry.offering.offeringPrice}</span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                    {entry.offering?.finalPrice ? (
                                                                        <span style={{ fontWeight: '700', color: '#2e7d32', fontSize: '11px' }}>₹{entry.offering.finalPrice}</span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>{statusBadge(entry)}</td>
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

            {/* Detail Popup — same design as AdminSampleBook */}
            {
                detailEntry && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
                        onClick={() => setDetailEntry(null)}>
                        <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '500px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                            onClick={e => e.stopPropagation()}>
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
                                }}>✕</button>
                            </div>
                            <div style={{ padding: '16px 20px' }}>
                                {/* Entry Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                    {[
                                        ['Date', new Date(detailEntry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
                                        ['Bags', detailEntry.bags?.toLocaleString('en-IN')],
                                        ['Packaging', formatPackagingLabel(detailEntry.packaging)],
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

                                {/* Quality Parameters — hide 0 values */}
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
                                        const f = fmt(v);
                                        return f && useBrackets ? `(${f})` : f;
                                    };
                                    const QItem = ({ label, value }: { label: string; value: React.ReactNode }) => {
                                        const isBold = ['Grains Count', 'Paddy WB'].includes(label);
                                        return (
                                            <div style={{ background: '#f8f9fa', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: '600' }}>{label}</div>
                                                <div style={{ fontSize: '13px', fontWeight: isBold ? '800' : '700', color: isBold ? '#000' : '#2c3e50' }}>{value || '-'}</div>
                                            </div>
                                        );
                                    };
                                    if (!qp) return <div style={{ color: '#999', textAlign: 'center', padding: '12px' }}>No quality data</div>;
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
                                    const row2: { label: string; value: React.ReactNode }[] = [];
                                    if (fmt(qp.mix)) row2.push({ label: 'Mix', value: fmtB(qp.mix)! });
                                    if (fmt(qp.mixS)) row2.push({ label: 'S Mix', value: fmtB(qp.mixS)! });
                                    if (fmt(qp.mixL)) row2.push({ label: 'L Mix', value: fmtB(qp.mixL)! });
                                    // Row 3: Kandu, Oil, SK — fixed 3-column grid
                                    const hasKandu = fmt(qp.kandu);
                                    const hasOil = fmt(qp.oil);
                                    const hasSK = fmt(qp.sk);
                                    const showRow3 = hasKandu || hasOil || hasSK;
                                    // Row 4: WB-R, WB-BK, WB-T
                                    const row4: { label: string; value: React.ReactNode }[] = [];
                                    if (fmt(qp.wbR)) row4.push({ label: 'WB-R', value: fmtB(qp.wbR)! });
                                    if (fmt(qp.wbBk)) row4.push({ label: 'WB-BK', value: fmtB(qp.wbBk)! });
                                    if (fmt(qp.wbT)) row4.push({ label: 'WB-T', value: fmtB(qp.wbT)! });
                                    const hasPaddyWb = fmt(qp.paddyWb);
                                    return (
                                        <div>
                                            {row1.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row1.length}, 1fr)`, gap: '8px', marginBottom: '8px' }}>{row1.map(item => <QItem key={item.label} label={item.label} value={item.value} />)}</div>}
                                            {row2.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row2.length}, 1fr)`, gap: '8px', marginBottom: '8px' }}>{row2.map(item => <QItem key={item.label} label={item.label} value={item.value} />)}</div>}
                                            {showRow3 && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                                    {hasKandu ? <QItem label="Kandu" value={fmtB(qp.kandu)!} /> : <div />}
                                                    {hasOil ? <QItem label="Oil" value={fmtB(qp.oil)!} /> : <div />}
                                                    {hasSK ? <QItem label="SK" value={fmtB(qp.sk)!} /> : <div />}
                                                </div>
                                            )}
                                            {row4.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row4.length}, 1fr)`, gap: '8px', marginBottom: '8px' }}>{row4.map(item => <QItem key={item.label} label={item.label} value={item.value} />)}</div>}
                                            {hasPaddyWb && (
                                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', marginTop: '10px' }}>
                                                    <div style={{
                                                        background: Number(qp.paddyWb) < 50 ? '#fff5f5' : (Number(qp.paddyWb) <= 50.5 ? '#fff9f0' : '#e8f5e9'),
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${Number(qp.paddyWb) < 50 ? '#feb2b2' : (Number(qp.paddyWb) <= 50.5 ? '#fbd38d' : '#c8e6c9')}`,
                                                        textAlign: 'center',
                                                        width: '32%'
                                                    }}>
                                                        <div style={{ fontSize: '10px', color: Number(qp.paddyWb) < 50 ? '#c53030' : (Number(qp.paddyWb) <= 50.5 ? '#9c4221' : '#2e7d32'), marginBottom: '2px', fontWeight: '600' }}>Paddy WB</div>
                                                        <div style={{ fontSize: '13px', fontWeight: '800', color: Number(qp.paddyWb) < 50 ? '#d32f2f' : (Number(qp.paddyWb) <= 50.5 ? '#f39c12' : '#1b5e20') }}>{fmtB(qp.paddyWb)}</div>
                                                    </div>
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

                                <button onClick={() => setDetailEntry(null)}
                                    style={{ marginTop: '16px', width: '100%', padding: '8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px 0', marginTop: '12px' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                    style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page <= 1 ? '#eee' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                    ← Prev
                </button>
                <span style={{ fontSize: '13px', color: '#666' }}>Page {page} of {totalPages} &nbsp;({total} total)</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page >= totalPages ? '#eee' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                    Next →
                </button>
            </div>
        </div >
    );
};

export default RiceSampleBook;



