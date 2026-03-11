import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

/**
 * AdminSampleBook2 — Broker-Grouped Sample Book
 * Same data as AdminSampleBook but rendered in the staff-style
 * broker-grouped design (date bar → red broker bar → table).
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
    lotSelectionAt?: string;
    qualityReportAttempts?: number;
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
    offering?: {
        finalPrice?: number;
        offeringPrice?: number;
        offerBaseRateValue?: number;
        baseRateType?: string;
        baseRateUnit?: string;
        finalBaseRate?: number;
        finalSute?: number;
        finalSuteUnit?: string;
        sute?: number;
        suteUnit?: string;
        moistureValue?: number;
        hamali?: number;
        hamaliUnit?: string;
        brokerage?: number;
        brokerageUnit?: string;
        lf?: number;
        lfUnit?: string;
        egbType?: string;
        egbValue?: number;
        cdEnabled?: boolean;
        cdValue?: number;
        cdUnit?: string;
        bankLoanEnabled?: boolean;
        bankLoanValue?: number;
        bankLoanUnit?: string;
        paymentConditionValue?: number;
        paymentConditionUnit?: string;
    };
    creator?: { username: string };
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
const getPartyLabel = (entry: SampleEntry) => {
    const partyNameText = toTitleCase(entry.partyName || '').trim();
    const lorryText = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
    if (entry.entryType === 'DIRECT_LOADED_VEHICLE') return lorryText || partyNameText || '-';
    return partyNameText || lorryText || '-';
};
const toNumberText = (value: any, digits = 2) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits).replace(/\.00$/, '') : '-';
};
const formatIndianCurrency = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num)
        ? num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';
};
const formatRateUnitLabel = (value?: string) => value === 'per_quintal'
    ? 'Per Qtl'
    : value === 'per_ton'
        ? 'Per Ton'
        : value === 'per_kg'
            ? 'Per Kg'
            : 'Per Bag';
const formatToggleUnitLabel = (value?: string) => value === 'per_quintal'
    ? 'Per Qtl'
    : value === 'percentage'
        ? '%'
        : value === 'lumps'
            ? 'Lumps'
            : value === 'per_kg'
                ? 'Per Kg'
                : 'Per Bag';
const formatShortDateTime = (value?: string | null) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return '';
    }
};

const getResampleRoundLabel = (attempts: number) => {
    if (attempts <= 1) return '';
    return `Re-sample Round ${attempts}`;
};
const getSamplingLabel = (attemptNo: number) => {
    if (attemptNo <= 1) return '1st';
    return '2nd';
};

interface AdminSampleBook2Props {
    entryType?: string;
    excludeEntryType?: string;
}

type PricingDetailState = {
    entry: SampleEntry;
    mode: 'offer' | 'final';
};

const AdminSampleBook2: React.FC<AdminSampleBook2Props> = ({ entryType, excludeEntryType }) => {
    const isRiceBook = entryType === 'RICE_SAMPLE';
    const tableMinWidth = isRiceBook ? '100%' : '1500px';
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
    const [pricingDetail, setPricingDetail] = useState<PricingDetailState | null>(null);
    const [remarksPopup, setRemarksPopup] = useState<{ isOpen: boolean; text: string }>({ isOpen: false, text: '' });

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
            if (entryType) params.entryType = entryType;
            if (excludeEntryType) params.excludeEntryType = excludeEntryType;

            const response = await axios.get(`${API_URL}/sample-entries/ledger/all`, {
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
            const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
            const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
            if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
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
        const history = Array.isArray(cr?.history) ? cr!.history : [];
        const latestEvent = history.length > 0 ? history[history.length - 1] : null;
        const doneByFromHistory = [...history].reverse().find((h) => h?.cookingDoneBy)?.cookingDoneBy || '';
        const approvedByFromHistory = [...history].reverse().find((h) => h?.approvedBy)?.approvedBy || '';
        const doneBy = cr?.cookingDoneBy || doneByFromHistory || '';
        const approvedBy = cr?.cookingApprovedBy || approvedByFromHistory || '';
        const eventDate = formatShortDateTime((latestEvent as any)?.date || null);
        const hasRemarks = !!(cr?.remarks && String(cr.remarks).trim());
        const approvals = history.filter((h) => h?.status);
        const staffAttempts = history.filter((h) => h?.cookingDoneBy && !h?.status);
        const isResampleFlow = d === 'FAIL';
        const pendingStaff = staffAttempts.length > approvals.length;
        const cookingAttempts = staffAttempts.length;
        const currentAttempt = isResampleFlow
            ? Math.min(2, (pendingStaff ? Math.max(1, approvals.length + 1) : Math.max(1, approvals.length)))
            : 1;
        const isAttemptContext =
            isResampleFlow
            && (approvals.length > 1 || cookingAttempts > 1);

        if (!isRiceBook && isAttemptContext) {
            const mapStatus = (status?: string | null) => {
                const key = String(status || '').toLowerCase();
                if (key === 'pass' || key === 'ok') return 'Pass';
                if (key === 'medium') return 'Medium';
                if (key === 'fail') return 'Fail';
                if (key === 'recheck') return 'Recheck';
                return 'Pending';
            };
            const getStyle = (label: string) => {
                if (label === 'Pass') return { bg: '#e8f5e9', color: '#2e7d32' };
                if (label === 'Medium') return { bg: '#ffe0b2', color: '#f39c12' };
                if (label === 'Fail') return { bg: '#ffcdd2', color: '#b71c1c' };
                if (label === 'Recheck') return { bg: '#e3f2fd', color: '#1565c0' };
                return { bg: '#ffe0b2', color: '#e65100' };
            };

            const firstLabel = mapStatus(approvals[0]?.status || cr?.status || null);
            const secondLabel = pendingStaff ? 'Pending' : mapStatus(approvals[1]?.status || null);
            const firstStyle = getStyle(firstLabel);
            const secondStyle = getStyle(secondLabel);
            const firstRemark = String(approvals[0]?.remarks || cr?.remarks || '').trim();

            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' }}>
                    <span style={{ background: firstStyle.bg, color: firstStyle.color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                        {`${getSamplingLabel(1)}: ${firstLabel}`}
                    </span>
                    <span style={{ background: secondStyle.bg, color: secondStyle.color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                        {`${getSamplingLabel(2)}: ${secondLabel}`}
                    </span>
                    {firstRemark && (
                        <button
                            type="button"
                            onClick={() => setRemarksPopup({ isOpen: true, text: firstRemark })}
                            style={{ color: '#8e24aa', fontSize: '9px', fontWeight: '700', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                        >
                            Remarks
                        </button>
                    )}
                </div>
            );
        }

        // Pass Without Cooking = no cooking needed, show dash
        if (d === 'PASS_WITHOUT_COOKING') {
            return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
        }
        let result = '';
        let bg = '#f5f5f5';
        let color = '#666';
        let cleanLabel = 'Pending';
        const hasCookingOutcome = (d === 'PASS_WITH_COOKING' || d === 'SOLDOUT' || d === 'FAIL') && cr && cr.status;
        // Pass With Cooking + cooking report submitted = show actual result
        if (hasCookingOutcome) {
            result = cr.status.toLowerCase();
            if (result === 'pass' || result === 'ok') { bg = '#e8f5e9'; color = '#2e7d32'; cleanLabel = 'Pass'; }
            else if (result === 'medium') { bg = '#ffe0b2'; color = '#f39c12'; cleanLabel = 'Medium'; }
            else if (result === 'fail') { bg = '#ffcdd2'; color = '#b71c1c'; cleanLabel = 'Fail'; }
            else if (result === 'recheck') { bg = '#e3f2fd'; color = '#1565c0'; cleanLabel = 'Recheck'; }

            if (!isRiceBook) {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' }}>
                        <span style={{ background: bg, color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                            {isAttemptContext ? `${getSamplingLabel(currentAttempt)}: ${cleanLabel}` : cleanLabel}
                        </span>
                        {result === 'recheck' && cr.remarks && (
                            <button
                                type="button"
                                onClick={() => setRemarksPopup({ isOpen: true, text: String(cr.remarks || '') })}
                                style={{ color: '#8e24aa', fontSize: '9px', fontWeight: '700', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                            >
                                Remarks
                            </button>
                        )}
                    </div>
                );
            }

            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                    <span style={{ background: bg, color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                        {isAttemptContext ? `${getSamplingLabel(currentAttempt)}: ${cleanLabel}` : cleanLabel}
                    </span>
                    {doneBy && <span style={{ fontSize: '9px', color: '#4e342e', fontWeight: '700' }}>Done: {toTitleCase(doneBy)}</span>}
                    {approvedBy && <span style={{ fontSize: '9px', color: '#0d47a1', fontWeight: '700' }}>Appr: {toTitleCase(approvedBy)}</span>}
                    {eventDate && <span style={{ fontSize: '9px', color: '#616161' }}>{eventDate}</span>}
                    {hasRemarks && (
                        <button
                            type="button"
                            onClick={() => setRemarksPopup({ isOpen: true, text: String(cr.remarks || '') })}
                            style={{ color: '#8e24aa', fontSize: '9px', fontWeight: '700', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
                        >
                            Remarks
                        </button>
                    )}
                </div>
            );
        }
        if (false) {
            if (!isRiceBook) {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' }}>
                        <span style={{ background: bg, color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                            {isAttemptContext ? `${getSamplingLabel(currentAttempt)}: ${cleanLabel}` : cleanLabel}
                        </span>
                        {result === 'recheck' && cr.remarks && (
                            <span title={cr.remarks} style={{ color: '#8e24aa', fontSize: '9px', fontWeight: '700', cursor: 'help' }}>💬 Remarks</span>
                        )}
                    </div>
                );
            }

            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                    <span style={{ background: bg, color, padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>
                        {isAttemptContext ? `${getSamplingLabel(currentAttempt)}: ${cleanLabel}` : cleanLabel}
                    </span>
                    {doneBy && <span style={{ fontSize: '9px', color: '#4e342e', fontWeight: '700' }}>Done: {toTitleCase(doneBy)}</span>}
                    {approvedBy && <span style={{ fontSize: '9px', color: '#0d47a1', fontWeight: '700' }}>Appr: {toTitleCase(approvedBy)}</span>}
                    {eventDate && <span style={{ fontSize: '9px', color: '#616161' }}>{eventDate}</span>}
                    {hasRemarks && (
                        <span title={cr.remarks} style={{ color: '#8e24aa', fontSize: '9px', fontWeight: '700', cursor: 'help' }}>💬 Remarks</span>
                    )}
                </div>
            );
        }
        // Pass With Cooking but no cooking report yet = Pending
        if (d === 'PASS_WITH_COOKING' && (!cr || !cr.status)) {
            if (!isRiceBook) {
                const pendingLabel = isAttemptContext ? `${getSamplingLabel(currentAttempt)}: Pending` : 'Pending';
                return <span style={{ background: '#ffe0b2', color: '#e65100', padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>{pendingLabel}</span>;
            }
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                    <span style={{ background: '#ffe0b2', color: '#e65100', padding: '1px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>⏳ Pending</span>
                    {doneBy && <span style={{ fontSize: '9px', color: '#4e342e', fontWeight: '700' }}>Done: {toTitleCase(doneBy)}</span>}
                    {eventDate && <span style={{ fontSize: '9px', color: '#616161' }}>{eventDate}</span>}
                </div>
            );
        }
        // No lot decision yet
        return <span style={{ color: '#999', fontSize: '10px' }}>-</span>;
    };

    const statusBadge = (entry: SampleEntry) => {
        const s = entry.workflowStatus;
        const d = entry.lotSelectionDecision;
        const cr = entry.cookingReport;
        const resampleAttempts = Math.max(0, Number(entry.qualityReportAttempts || 0));
        const cookingStatusKey = String(cr?.status || '').toUpperCase();
        const isCookingPassed = cookingStatusKey === 'PASS' || cookingStatusKey === 'MEDIUM';
        const isResampleInProgress = d === 'FAIL' && s !== 'FAILED' && !isCookingPassed && !entry.offering?.finalPrice;
        const showResampleRound = resampleAttempts > 1 && isResampleInProgress;
        let label = 'Pending';
        let bg = '#ffe0b2';
        let color = '#e65100';
        // Resample in-progress only while current resample cycle is not yet passed/finalized
        if (d === 'SOLDOUT') { bg = '#800000'; color = '#ffffff'; label = 'Sold Out'; }
        else if (s === 'FAILED') { bg = '#ffcdd2'; color = '#b71c1c'; label = 'Fail'; }
        else if (isResampleInProgress) { bg = '#fff3e0'; color = '#e65100'; label = 'Re-sample Pending'; }
        else if ((d === 'PASS_WITH_COOKING' || d === 'SOLDOUT' || d === 'FAIL') && cr && cr.status) {
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
                bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass';
            }
        }
        else if (s === 'COMPLETED' && entry.offering?.finalPrice) { bg = '#800000'; color = '#ffffff'; label = 'Sold Out'; }
        else if (entry.offering?.finalPrice) { bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass'; }
        else if (d === 'PASS_WITHOUT_COOKING') { bg = '#e8f5e9'; color = '#2e7d32'; label = 'Pass'; }
        else { bg = '#ffe0b2'; color = '#e65100'; label = 'Pending'; }
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                {showResampleRound && (
                    <span
                        title={`This paddy lot reached quality attempt ${resampleAttempts}`}
                        style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', backgroundColor: '#ffedd5', color: '#7c2d12', fontWeight: '700', whiteSpace: 'nowrap' as const, border: '1px solid #fdba74' }}
                    >
                        {getResampleRoundLabel(resampleAttempts)}
                    </span>
                )}
                <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', backgroundColor: bg, color, fontWeight: '600', whiteSpace: 'nowrap' as const }}>{label}</span>
            </div>
        );
    };

    const qualityBadge = (entry: SampleEntry) => {
        const qp = entry.qualityParameters;
        const d = entry.lotSelectionDecision;
        if (qp && qp.moisture != null) {
            const isResampleAutoPass = Number(entry.qualityReportAttempts || 0) > 1;
            const qualityPassed = d === 'PASS_WITH_COOKING' || d === 'PASS_WITHOUT_COOKING' || d === 'SOLDOUT' || isResampleAutoPass;
            // Check if full quality params are filled (cutting, bend, mix etc.)
            const hasFullQuality = (qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0) || (qp.mixS && Number(qp.mixS) !== 0) || (qp.mixL && Number(qp.mixL) !== 0);
            if (hasFullQuality) {
                if (qualityPassed) {
                    return <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}><span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>✓ Done</span><span style={{ background: '#a5d6a7', color: '#1b5e20', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>Pass</span></div>;
                }
                return <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}><span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>✓ Done</span></div>;
            }
            // Only 100gms data (moisture + grains count) — show 100-Gms so user knows what's done
            if (qualityPassed) {
                return <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}><span style={{ background: '#fff8e1', color: '#f57f17', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>100-Gms</span><span style={{ background: '#a5d6a7', color: '#1b5e20', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '700' }}>Pass</span></div>;
            }
            return <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}><span style={{ background: '#fff8e1', color: '#f57f17', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>100-Gms</span></div>;
        }
        return <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}><span style={{ background: '#f5f5f5', color: '#c62828', padding: '2px 6px', borderRadius: '10px', fontSize: '9px' }}>Pending</span></div>;
    };

    const getChargeText = (value?: number, unit?: string) => {
        if (value === null || value === undefined || Number(value) === 0) return '-';
        return `${toNumberText(value)} / ${formatToggleUnitLabel(unit)}`;
    };

    const getOfferRateText = (offering?: SampleEntry['offering']) => {
        if (!offering) return '-';
        const rateValue = offering.offerBaseRateValue ?? offering.offeringPrice;
        if (!rateValue) return '-';
        const typeText = offering.baseRateType ? offering.baseRateType.replace(/_/g, '/') : '-';
        return `Rs ${toNumberText(rateValue)} / ${typeText} / ${formatRateUnitLabel(offering.baseRateUnit)}`;
    };

    const getFinalRateText = (offering?: SampleEntry['offering']) => {
        if (!offering) return '-';
        const rateValue = offering.finalPrice ?? offering.finalBaseRate;
        if (!rateValue) return '-';
        const typeText = offering.baseRateType ? offering.baseRateType.replace(/_/g, '/') : '-';
        return `Rs ${toNumberText(rateValue)} / ${typeText} / ${formatRateUnitLabel(offering.baseRateUnit)}`;
    };

    const getPricingRows = (offering: NonNullable<SampleEntry['offering']>, mode: 'offer' | 'final') => {
        const isFinalMode = mode === 'final';
        const suteValue = isFinalMode ? offering.finalSute : offering.sute;
        const suteUnit = isFinalMode ? offering.finalSuteUnit : offering.suteUnit;

        return [
            [isFinalMode ? 'Final Rate' : 'Offer Rate', isFinalMode ? getFinalRateText(offering) : getOfferRateText(offering)],
            ['Sute', suteValue ? `${toNumberText(suteValue)} / ${formatRateUnitLabel(suteUnit)}` : '-'],
            ['Moisture', offering.moistureValue ? `${toNumberText(offering.moistureValue)}%` : '-'],
            ['Hamali', getChargeText(offering.hamali, offering.hamaliUnit)],
            ['Brokerage', getChargeText(offering.brokerage, offering.brokerageUnit)],
            ['LF', getChargeText(offering.lf, offering.lfUnit)],
            ['EGB', offering.egbType === 'mill'
                ? '0 / Mill'
                : offering.egbType === 'purchase' && offering.egbValue !== undefined && offering.egbValue !== null
                    ? `${toNumberText(offering.egbValue)} / Purchase`
                    : '-'],
            ['CD', offering.cdEnabled
                ? offering.cdValue
                    ? `${toNumberText(offering.cdValue)} / ${formatToggleUnitLabel(offering.cdUnit)}`
                    : 'Pending'
                : '-'],
            ['Bank Loan', offering.bankLoanEnabled
                ? offering.bankLoanValue
                    ? `Rs ${formatIndianCurrency(offering.bankLoanValue)} / ${formatToggleUnitLabel(offering.bankLoanUnit)}`
                    : 'Pending'
                : '-'],
            ['Payment', offering.paymentConditionValue
                ? `${offering.paymentConditionValue} ${offering.paymentConditionUnit === 'month' ? 'Month' : 'Days'}`
                : '-']
        ];
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
                                    const orderedEntries = [...brokerEntries].sort((a, b) => {
                                        const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                                        const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                                        if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                                    });
                                    brokerSeq++;
                                    return (
                                        <div key={brokerName} style={{ marginBottom: '12px' }}>
                                            {/* Date + Paddy Sample bar — only first broker */}
                                            {brokerIdx === 0 && <div style={{
                                                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                                                color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                                                textAlign: 'center', letterSpacing: '0.5px', minWidth: tableMinWidth
                                            }}>
                                                {(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                                                &nbsp;&nbsp;{entryType === 'RICE_SAMPLE' ? 'Rice Sample' : 'Paddy Sample'}
                                            </div>}
                                            {/* Broker name bar */}
                                            <div style={{
                                                background: '#e8eaf6',
                                                color: '#000', padding: '3px 10px', fontWeight: '700', fontSize: '12px',
                                                display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #c5cae9', minWidth: tableMinWidth
                                            }}>
                                                <span style={{ fontSize: '12px', fontWeight: '800' }}>{brokerSeq}.</span> {toTitleCase(brokerName)}
                                            </div>
                                            {/* Table */}
                                            <table style={{ width: '100%', minWidth: tableMinWidth, borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', border: '1px solid #000' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: entryType === 'RICE_SAMPLE' ? '#4a148c' : '#1a237e', color: 'white' }}>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '3.5%' }}>SL No</th>
                                                        {!isRiceBook && <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Type</th>}
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Bags</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Pkg</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Party Name</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>{entryType === 'RICE_SAMPLE' ? 'Rice Location' : 'Paddy Location'}</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '9%' }}>Variety</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Sample Collected By</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '11%' }}>Quality Report</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: isRiceBook ? '12%' : '8.5%' }}>Cooking Report</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '7%' }}>Offer</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Final</th>
                                                        <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '8.5%' }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orderedEntries.map((entry, idx) => {
                                                        const qp = entry.qualityParameters;
                                                        const cr = entry.cookingReport;
                                                        const cookingFail = entry.lotSelectionDecision === 'PASS_WITH_COOKING' && cr && cr.status && cr.status.toLowerCase() === 'fail';
                                                        const cookingStatusKey = String(cr?.status || '').toUpperCase();
                                                        const isResampleRow =
                                                            entry.lotSelectionDecision === 'FAIL'
                                                            && entry.workflowStatus !== 'FAILED'
                                                            && !['PASS', 'MEDIUM'].includes(cookingStatusKey)
                                                            && !entry.offering?.finalPrice;
                                                        const rowBg = isResampleRow
                                                            ? '#fff3e0'
                                                            : cookingFail
                                                                ? '#fff0f0'
                                                                : entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff';

                                                        const fallback = entryType === 'RICE_SAMPLE' ? '--' : '-';
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
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '600', textAlign: 'center', whiteSpace: 'nowrap' }}>{entry.serialNo || (idx + 1)}</td>
                                                                {!isRiceBook && (
                                                                    <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                        {entry.entryType === 'LOCATION_SAMPLE' ? 'LS' : entry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'RL' : 'MS'}
                                                                    </td>
                                                                )}
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>{entry.bags || '0'}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap' }}>{Number(entry.packaging) === 0 ? 'Loose' : `${entry.packaging || '75'} kg`}</td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '14px', cursor: 'pointer', color: '#1565c0', fontWeight: '600', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                    onClick={() => setDetailEntry(entry)}>
                                                                    {getPartyLabel(entry)}
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
                                                                    textAlign: isRiceBook ? 'left' : 'center',
                                                                    whiteSpace: 'normal',
                                                                    lineHeight: '1.2',
                                                                    verticalAlign: 'middle',
                                                                    minWidth: isRiceBook ? undefined : '104px'
                                                                }}>
                                                                    {cookingBadge(entry)}
                                                                </td>
                                                                <td
                                                                    onClick={() => entry.offering?.offerBaseRateValue || entry.offering?.offeringPrice ? setPricingDetail({ entry, mode: 'offer' }) : null}
                                                                    style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '11px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: '116px', cursor: entry.offering?.offerBaseRateValue || entry.offering?.offeringPrice ? 'pointer' : 'default' }}
                                                                >
                                                                    {entry.offering?.offerBaseRateValue ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', width: '100%' }}>
                                                                            <span style={{ fontWeight: '700', color: '#1565c0', fontSize: '11px' }}>Rs {toNumberText(entry.offering.offerBaseRateValue)}</span>
                                                                            <span style={{ fontSize: '9px', color: '#5f6368', fontWeight: '700', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.2' }}>{(entry.offering.baseRateType || '').replace(/_/g, '/')} / {formatRateUnitLabel(entry.offering.baseRateUnit)}</span>
                                                                        </div>
                                                                    ) : entry.offering?.offeringPrice ? (
                                                                        <span style={{ fontWeight: '700', color: '#1565c0', fontSize: '11px' }}>Rs {toNumberText(entry.offering.offeringPrice)}</span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td
                                                                    onClick={() => entry.offering?.finalPrice || entry.offering?.finalBaseRate ? setPricingDetail({ entry, mode: 'final' }) : null}
                                                                    style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '11px', textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: '104px', cursor: entry.offering?.finalPrice || entry.offering?.finalBaseRate ? 'pointer' : 'default' }}
                                                                >
                                                                    {entry.offering?.finalPrice ? (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', width: '100%' }}>
                                                                            <span style={{ fontWeight: '700', color: '#2e7d32', fontSize: '11px' }}>Rs {toNumberText(entry.offering.finalPrice)}</span>
                                                                            <span style={{ fontSize: '9px', color: '#5f6368', fontWeight: '700', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.2' }}>{(entry.offering.baseRateType || '').replace(/_/g, '/')} / {formatRateUnitLabel(entry.offering.baseRateUnit)}</span>
                                                                        </div>
                                                                    ) : entry.offering?.finalBaseRate ? (
                                                                        <span style={{ fontWeight: '700', color: '#2e7d32', fontSize: '11px' }}>Rs {toNumberText(entry.offering.finalBaseRate)}</span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', whiteSpace: 'normal', minWidth: '108px' }}>{statusBadge(entry)}</td>
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
                                        ['Packaging', `${detailEntry.packaging || '75'} Kg`],
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
                                        ['Party Name', getPartyLabel(detailEntry)],
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

            {pricingDetail && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        padding: '16px'
                    }}
                    onClick={() => setPricingDetail(null)}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            width: '100%',
                            maxWidth: '720px',
                            borderRadius: '10px',
                            boxShadow: '0 16px 50px rgba(0,0,0,0.25)',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ background: pricingDetail.mode === 'offer' ? '#1565c0' : '#2e7d32', color: '#fff', padding: '14px 18px' }}>
                            <div style={{ fontSize: '18px', fontWeight: '800' }}>
                                {pricingDetail.mode === 'offer' ? 'Offer Details' : 'Final Details'}
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.95, marginTop: '4px' }}>
                                {getPartyLabel(pricingDetail.entry)} | {toTitleCase(pricingDetail.entry.variety)} | {toTitleCase(pricingDetail.entry.location)}
                            </div>
                        </div>
                        <div style={{ padding: '16px 18px 18px' }}>
                            {pricingDetail.entry.offering ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                                    {getPricingRows(pricingDetail.entry.offering, pricingDetail.mode).map(([label, value]) => (
                                        <div key={String(label)} style={{ background: '#f8f9fa', border: '1px solid #dfe3e8', borderRadius: '8px', padding: '10px 12px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#5f6368', marginBottom: '4px' }}>{label}</div>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1f2937' }}>{value as string}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ color: '#999', textAlign: 'center', padding: '12px' }}>No pricing data</div>
                            )}
                            <button
                                onClick={() => setPricingDetail(null)}
                                style={{
                                    marginTop: '16px',
                                    width: '100%',
                                    padding: '9px',
                                    backgroundColor: pricingDetail.mode === 'offer' ? '#1565c0' : '#2e7d32',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {remarksPopup.isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        padding: '16px'
                    }}
                    onClick={() => setRemarksPopup({ isOpen: false, text: '' })}
                >
                    <div
                        style={{ background: '#fff', width: '100%', maxWidth: '420px', borderRadius: '10px', boxShadow: '0 16px 50px rgba(0,0,0,0.25)', padding: '16px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#1f2937', marginBottom: '10px' }}>Remarks</div>
                        <div style={{ fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px' }}>
                            {remarksPopup.text || '-'}
                        </div>
                        <button
                            onClick={() => setRemarksPopup({ isOpen: false, text: '' })}
                            style={{ marginTop: '12px', width: '100%', padding: '9px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
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

export default AdminSampleBook2;



