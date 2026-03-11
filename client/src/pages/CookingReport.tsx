import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

import { API_URL } from '../config/api';

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
  workflowStatus: string;
  entryType?: string;
  lorryNumber?: string;
  sampleCollectedBy?: string;
  lotSelectionDecision?: string;
  lotSelectionAt?: string;
  qualityReportAttempts?: number;
  qualityParameters?: {
    grainsCount?: number;
    reportedBy?: string;
    kandu?: number;
    oil?: number;
    mixKandu?: number;
    createdAt?: string;
    updatedAt?: string;
  };
  cookingReport?: {
    status: string;
    remarks: string;
    cookingDoneBy?: string;
    cookingApprovedBy?: string;
    history?: any[];
    updatedAt?: string;
  };
}

interface SupervisorUser {
  id: number;
  username: string;
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';
const getTimeValue = (value?: string | null) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const splitHistoryByResampleStart = (entry: SampleEntry, history: any[]) => {
  const startAt = getTimeValue(entry.lotSelectionAt);
  if (!startAt || !Array.isArray(history) || history.length === 0) {
    return { before: history || [], after: history || [], hasSplit: false };
  }

  const before = history.filter((item: any) => getTimeValue(item?.date) < startAt);
  const after = history.filter((item: any) => getTimeValue(item?.date) >= startAt);
  return { before, after, hasSplit: true };
};

const getSamplingLabel = (attemptNo: number) => {
  if (attemptNo <= 1) return 'First Sampling';
  return 'Second Sampling';
};

const isResolvedResampleEntry = (entry: SampleEntry) => {
  if (entry.lotSelectionDecision !== 'FAIL') return false;
  const history = Array.isArray(entry.cookingReport?.history) ? entry.cookingReport?.history || [] : [];
  const statusEntries = history.filter((item: any) => !!item?.status);
  if (statusEntries.length === 0 && !entry.cookingReport?.status) return false;

  const { after, hasSplit } = splitHistoryByResampleStart(entry, history);
  const cycleStatuses = (hasSplit ? after : history).filter((item: any) => !!item?.status);
  if (hasSplit && cycleStatuses.length === 0) return false;
  if (!hasSplit && statusEntries.length < 2) return false;
  const latest = (cycleStatuses.length > 0 ? cycleStatuses[cycleStatuses.length - 1] : statusEntries[statusEntries.length - 1]) || null;
  const key = String(latest?.status || entry.cookingReport?.status || '').toUpperCase();
  return ['PASS', 'MEDIUM', 'FAIL'].includes(key);
};

interface CookingReportProps {
  entryType?: string;
  excludeEntryType?: string;
}

const CookingReport: React.FC<CookingReportProps> = ({ entryType, excludeEntryType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const createEmptyCookingData = () => ({
    status: '',
    remarks: '',
    cookingDoneBy: '',
    cookingApprovedBy: ''
  });
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [cookingData, setCookingData] = useState(createEmptyCookingData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLocksRef = useRef<Set<string>>(new Set());
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [manualCookingName, setManualCookingName] = useState('');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [showRemarksInput, setShowRemarksInput] = useState(false);

  // --- HISTORY MODAL STATES ---
  const [historyModal, setHistoryModal] = useState<{ visible: boolean; title: string; content: React.ReactNode }>({ visible: false, title: '', content: null });

  // --- NEW RICE FEATURE STATES ---
  const [activeTab, setActiveTab] = useState<'PADDY_COOKING_REPORT' | 'RICE_COOKING_REPORT' | 'RESAMPLE_COOKING_REPORT'>(
    entryType === 'RICE_SAMPLE' ? 'RICE_COOKING_REPORT' : 'PADDY_COOKING_REPORT'
  );

  // Synchronize activeTab if props change (though unlikely in this app's routing)
  useEffect(() => {
    if (entryType === 'RICE_SAMPLE') {
      setActiveTab('RICE_COOKING_REPORT');
    } else if (excludeEntryType === 'RICE_SAMPLE') {
      setActiveTab('PADDY_COOKING_REPORT');
    }
  }, [entryType, excludeEntryType]);

  // Custom states for Admin/Manager 'Cooking Approved by' toggles
  const [approvalType, setApprovalType] = useState<'owner' | 'manager' | 'admin' | 'manual'>('owner');
  const [manualApprovalName, setManualApprovalName] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const isCookingStaffRole = user?.role === 'staff' || user?.role === 'quality_supervisor';

  const resetReportFormState = () => {
    setCookingData(createEmptyCookingData());
    setManualCookingName('');
    setUseManualEntry(false);
    setShowRemarksInput(false);
    setApprovalType('owner');
    setManualApprovalName('');
    setManualDate(new Date().toISOString().split('T')[0]);
  };

  const closeReportModal = () => {
    setShowModal(false);
    setSelectedEntry(null);
    resetReportFormState();
  };

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
  const canTakeAction = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff' || user?.role === 'quality_supervisor';

  useEffect(() => {
    loadEntries();
  }, [page, activeTab]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const acquireSubmissionLock = (key: string) => {
    if (submissionLocksRef.current.has(key)) return false;
    submissionLocksRef.current.add(key);
    return true;
  };

  const releaseSubmissionLock = (key: string) => {
    submissionLocksRef.current.delete(key);
  };

  useEffect(() => {
    loadSupervisors();
  }, []);

  const loadSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      // All paddy supervisors are allowed (mill + location staff).
      const response = await axios.get(`${API_URL}/sample-entries/paddy-supervisors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      const users = Array.isArray(data) ? data : (data.users || []);
      setSupervisors(users.filter((u: any) => u && u.username));
    } catch (error) {
      console.error('Error loading supervisors:', error);
    }
  };

  const loadEntries = async (fFrom?: string, fTo?: string, fBroker?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Always show entries that have finished cooking (or await final approval)
      const status = activeTab === 'RESAMPLE_COOKING_REPORT' ? 'RESAMPLE_COOKING_BOOK' : 'COOKING_BOOK';
      const params: any = { status, page, pageSize: PAGE_SIZE };

      const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
      const dTo = fTo !== undefined ? fTo : filterDateTo;
      const b = fBroker !== undefined ? fBroker : filterBroker;

      if (dFrom) params.startDate = dFrom;
      if (dTo) params.endDate = dTo;
      if (b) params.broker = b;
      if (entryType) params.entryType = entryType;
      if (excludeEntryType) params.excludeEntryType = excludeEntryType;

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

  const handleOpenModal = (entry: SampleEntry) => {
    setSelectedEntry(entry);
    setShowModal(true);
    // Always start with a clean form for a new report action.
    resetReportFormState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || isSubmitting) return;
    const lockKey = `cooking-submit-${selectedEntry.id}`;
    if (!acquireSubmissionLock(lockKey)) return;

    // Capitalize function
    const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    // Determine cookingDoneBy value (from form, fallback to existing, or clear if RECHECK)
    let finalCookingDoneBy = capitalize(useManualEntry ? manualCookingName.trim() : cookingData.cookingDoneBy);
    if (!finalCookingDoneBy && selectedEntry.cookingReport?.cookingDoneBy) {
      finalCookingDoneBy = selectedEntry.cookingReport.cookingDoneBy;
    }

    // On RECHECK, preserve the existing cookingDoneBy and cookingApprovedBy names
    // so they remain visible in the cooking report table

    // Determine cookingApprovedBy value (Admin/Manager overrides, staff preserves existing)
    let finalCookingApprovedBy = selectedEntry.cookingReport?.cookingApprovedBy || '';
    if (!isCookingStaffRole) {
      if (approvalType === 'owner') finalCookingApprovedBy = 'Harish';
      else if (approvalType === 'manager') finalCookingApprovedBy = 'Guru';
      else if (approvalType === 'admin') finalCookingApprovedBy = 'MK Subbu';
    }

    const finalRemarks = showRemarksInput ? cookingData.remarks : '';

    // Determine status (Staff cannot set status, and submitting a Recheck should reset it to Pending)
    let finalStatus = cookingData.status;
    if (isCookingStaffRole) {
      finalStatus = ''; // Staff submitting always resets the admin's status decision
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/cooking-report`,
        { ...cookingData, status: finalStatus, remarks: finalRemarks, cookingDoneBy: finalCookingDoneBy, cookingApprovedBy: finalCookingApprovedBy, manualDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Cooking report added successfully', 'success');
      closeReportModal();
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to add cooking report', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };

  const brokersList = useMemo(() => {
    const allBrokers = entries.map(e => e.brokerName);
    return Array.from(new Set(allBrokers)).filter(Boolean).sort();
  }, [entries]);

  const groupedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

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

  const handleOpenHistory = (entry: any, type: 'all' | 'cooking' | 'approval' | 'single-remark' = 'all', singleEventOverride: any = null) => {
    if (type === 'single-remark' && singleEventOverride) {
      setHistoryModal({
        visible: true,
        title: 'Remark Details',
        content: <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{singleEventOverride.remarks}</div>
      });
      return;
    }

    const cr = entry.cookingReport || {};
    let history = cr.history ? [...cr.history] : [];

    // Synthesize legacy history if missing
    const hasStaffHistory = history.some((h: any) => h.cookingDoneBy && !h.status);
    if (!hasStaffHistory && cr?.cookingDoneBy) {
      history = [{ cookingDoneBy: cr.cookingDoneBy, date: null }, ...history];
    }

    const hasAdminHistory = history.some((h: any) => h.approvedBy && h.status);
    if (!hasAdminHistory && cr?.cookingApprovedBy) {
      history.push({ approvedBy: cr.cookingApprovedBy, status: cr.status, date: null, remarks: cr.remarks });
    }

    // Add Sample Report Entry (Step 0) for Full History
    if (type === 'all' && entry.qualityParameters) {
      history.unshift({
        isSampleReportEvent: true,
        reportedBy: entry.qualityParameters.reportedBy || 'Unknown',
        date: entry.qualityParameters.createdAt || entry.createdAt || null,
        status: 'Sample Reported',
        remarks: entry.qualityParameters.remarks || 'Sample selected and initially reported.'
      });
    }

    let modalTitle = 'History';
    if (type === 'cooking') {
      history = history.filter((h: any) => h.cookingDoneBy && !h.status);
      modalTitle = 'Cooking History';
    } else if (type === 'approval') {
      history = history.filter((h: any) => h.approvedBy && h.status);
      modalTitle = 'Approval History';
    } else if (type === 'single-remark' && singleEventOverride) {
      history = [singleEventOverride];
      modalTitle = 'Remark Details';
    } else {
      modalTitle = 'Full History';
    }

    const statusMap: Record<string, { color: string; bg: string; label: string }> = {
      PASS: { color: '#27ae60', bg: '#e8f5e9', label: '✓ Pass' },
      FAIL: { color: '#e74c3c', bg: '#fdecea', label: '✕ Fail' },
      RECHECK: { color: '#e67e22', bg: '#fff3e0', label: '↻ Recheck' },
      MEDIUM: { color: '#f39c12', bg: '#ffe0b2', label: '◎ Medium' },
      'Sample Reported': { color: '#607d8b', bg: '#eceff1', label: '📝 Sample Reported' }
    };
    if (history.length > 0) {
      const histContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
          {history.map((h: any, i: number) => {
            const isStatusAction = !!h.status;
            let actionBy = isStatusAction ? (h.approvedBy || 'Unknown') : (h.cookingDoneBy || 'Unknown');

            if (h.isSampleReportEvent) {
              actionBy = h.reportedBy;
            }

            const sc = isStatusAction && h.status ? (statusMap[h.status] || { color: '#ffffff', bg: '#607d8b', label: h.status }) : null;

            return (
              <div key={i} style={{ padding: '10px', border: '1px solid #eee', borderRadius: '6px', backgroundColor: isStatusAction ? '#f8f9fa' : '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: isStatusAction ? '#1565c0' : '#6a1b9a', fontSize: '13px' }}>
                      {i + 1}. {actionBy}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {h.date ? new Date(h.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-'}
                    </div>
                  </div>
                  {isStatusAction && sc && (
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: sc.bg, color: sc.color }}>
                      {h.status}
                    </span>
                  )}
                </div>
                {h.remarks && (
                  <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: '#fff3e0', borderLeft: '3px solid #ff9800', fontSize: '12px', color: '#333' }}>
                    <span style={{ fontWeight: '600', color: '#e65100', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Remark:</span>
                    {h.remarks}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      );
      setHistoryModal({ visible: true, title: modalTitle, content: histContent });
    } else if (cr.remarks) {
      setHistoryModal({ visible: true, title: 'Remarks', content: <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{cr.remarks}</div> });
    } else {
      setHistoryModal({ visible: true, title: modalTitle, content: <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>No history for this entry.</div> });
    }
  };

  const getStatusBadge = (entry: SampleEntry) => {
    const normalizeStatus = (value?: string | null) => String(value || '').toUpperCase();
    const toStatusInfo = (statusKey?: string | null) => {
      const key = normalizeStatus(statusKey);
      if (key === 'PASS') return { color: '#27ae60', bg: '#e8f5e9', label: 'Pass' };
      if (key === 'MEDIUM') return { color: '#f39c12', bg: '#ffe0b2', label: 'Medium' };
      if (key === 'FAIL') return { color: '#e74c3c', bg: '#fdecea', label: 'Fail' };
      if (key === 'RECHECK') return { color: '#e67e22', bg: '#fff3e0', label: 'Recheck' };
      return { color: '#999', bg: '#f5f5f5', label: 'Pending' };
    };

    const cr = entry.cookingReport;
    const history = Array.isArray(cr?.history) ? cr.history : [];
    const staffHistory = history.filter((item: any) => !!item?.cookingDoneBy && !item?.status);
    const adminHistory = history.filter((item: any) => !!item?.status);
    const isWaitingForAdmin = staffHistory.length > adminHistory.length;
    const isResampleCase = activeTab === 'RESAMPLE_COOKING_REPORT' || entry.lotSelectionDecision === 'FAIL';
    const { before: historyBeforeResample, after: historyAfterResample, hasSplit: hasResampleSplit } =
      splitHistoryByResampleStart(entry, history);

    const firstAdminStatus = normalizeStatus(adminHistory[0]?.status || null);
    const lastAdminStatus = normalizeStatus(adminHistory[adminHistory.length - 1]?.status || cr?.status || null);

    const needsFreshCookingAttempt =
      entry.lotSelectionDecision === 'PASS_WITH_COOKING'
      && getTimeValue(entry.lotSelectionAt) > getTimeValue(cr?.updatedAt);

    if (!isResampleCase) {
      if (needsFreshCookingAttempt) {
        return <span style={{ color: '#e67e22', fontWeight: '700' }}>Pending</span>;
      }
      if (!cr) {
        return <span style={{ color: '#e67e22', fontWeight: '700' }}>Pending</span>;
      }

      let info = toStatusInfo(lastAdminStatus);
      if (isWaitingForAdmin) {
        info = { color: '#2980b9', bg: '#e3f2fd', label: 'Admin want to approve' };
      } else if (!lastAdminStatus && staffHistory.length > 0) {
        info = { color: '#2980b9', bg: '#e3f2fd', label: 'Admin want to approve' };
      }

      return (
        <span
          onClick={() => handleOpenHistory(entry, 'all')}
          style={{
            color: info.color,
            backgroundColor: info.bg,
            fontWeight: '700',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
          title="Click to see full history"
        >
          {info.label}
        </span>
      );
    }

    const pendingApprovalInfo = { color: '#2980b9', bg: '#e3f2fd', label: 'Admin want to approve' };

    // Re-sample should keep first sampling from pre-resample cycle and second sampling from current resample cycle.
    const beforeAdminHistory = historyBeforeResample.filter((item: any) => !!item?.status);
    const afterStaffHistory = historyAfterResample.filter((item: any) => !!item?.cookingDoneBy && !item?.status);
    const afterAdminHistory = historyAfterResample.filter((item: any) => !!item?.status);
    const lastAfterStaff = afterStaffHistory[afterStaffHistory.length - 1];
    const lastAfterAdmin = afterAdminHistory[afterAdminHistory.length - 1];
    const lastAfterStaffAt = getTimeValue(lastAfterStaff?.date);
    const lastAfterAdminAt = getTimeValue(lastAfterAdmin?.date);
    const waitingAdminAfterResample = !!lastAfterStaff && (!lastAfterAdmin || lastAfterStaffAt > lastAfterAdminAt);
    const baselineFirstStatus = normalizeStatus(
      beforeAdminHistory[beforeAdminHistory.length - 1]?.status
      || adminHistory[adminHistory.length - 1]?.status
      || cr?.status
      || null
    );

    const firstInfo = baselineFirstStatus
      ? toStatusInfo(baselineFirstStatus)
      : (isWaitingForAdmin && staffHistory.length > 0 ? pendingApprovalInfo : { color: '#e67e22', bg: '#fff3e0', label: 'Pending' });

    // Re-sample always shows two lines (1st + 2nd) for clarity.
    const showSecondLine = true;
    const latestSecondStatus = normalizeStatus(lastAfterAdmin?.status || null);
    let secondInfo = { color: '#e67e22', bg: '#fff3e0', label: 'Pending' };

    if (hasResampleSplit) {
      if (waitingAdminAfterResample) {
        secondInfo = pendingApprovalInfo;
      } else if (latestSecondStatus) {
        secondInfo = toStatusInfo(latestSecondStatus);
      }
    } else {
      // Legacy fallback for old records without reliable split timestamp.
      if (adminHistory.length >= 2 && normalizeStatus(adminHistory[adminHistory.length - 1]?.status || null)) {
        secondInfo = toStatusInfo(normalizeStatus(adminHistory[adminHistory.length - 1]?.status || null));
      } else if (staffHistory.length >= 2 && isWaitingForAdmin) {
        secondInfo = pendingApprovalInfo;
      } else if (isWaitingForAdmin && staffHistory.length > 1) {
        secondInfo = pendingApprovalInfo;
      }
    }

    const isSecondPendingState = ['PENDING', 'PENDING APPROVAL', 'ADMIN WANT TO APPROVE'].includes(
      String(secondInfo.label || '').toUpperCase()
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%', minWidth: 0 }}>
        <div
          onClick={() => handleOpenHistory(entry, 'all')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer', flexWrap: 'wrap', maxWidth: '100%' }}
          title="Click to see full history"
        >
          <span style={{ fontWeight: 700, color: '#555' }}>1st:</span>
          <span style={{ color: firstInfo.color, backgroundColor: firstInfo.bg, fontWeight: 700, padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
            {firstInfo.label}
          </span>
        </div>
        <div
          onClick={() => handleOpenHistory(entry, 'all')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '10px', cursor: 'pointer', maxWidth: '100%' }}
          title="Click to see full history"
        >
          <span style={{ color: '#7c2d12', backgroundColor: '#ffedd5', border: '1px solid #fdba74', fontWeight: '700', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', lineHeight: 1.1, textAlign: 'center' }}>
            Re-sample
          </span>
          {isSecondPendingState && (
            <span style={{ color: secondInfo.color, backgroundColor: secondInfo.bg, fontWeight: 700, padding: '1px 6px', borderRadius: '4px', fontSize: '10px', lineHeight: 1.1, textAlign: 'center' }}>
              {secondInfo.label}
            </span>
          )}
        </div>
        {showSecondLine && !isSecondPendingState && (
          <div
            onClick={() => handleOpenHistory(entry, 'all')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer', flexWrap: 'wrap', maxWidth: '100%' }}
            title="Click to see full history"
          >
            <span style={{ fontWeight: 700, color: '#555' }}>2nd:</span>
            <span style={{ color: secondInfo.color, backgroundColor: secondInfo.bg, fontWeight: 700, padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
              {secondInfo.label}
            </span>
          </div>
        )}
      </div>
    );
  };

  const canStaffAddCookingForEntry = (entry: SampleEntry) => {
    const normalizeStatus = (value?: string | null) => String(value || '').toUpperCase();
    const cr = entry.cookingReport;
    const history = Array.isArray(cr?.history) ? cr.history : [];
    const staffHistory = history.filter((item: any) => !!item?.cookingDoneBy && !item?.status);
    const adminHistory = history.filter((item: any) => !!item?.status);
    const waitingAdmin = staffHistory.length > adminHistory.length;
    const latestAdminStatus = normalizeStatus(adminHistory[adminHistory.length - 1]?.status || cr?.status || null);
    const isResampleCase = entry.lotSelectionDecision === 'FAIL' || activeTab === 'RESAMPLE_COOKING_REPORT';
    const needsFreshCookingAttempt =
      entry.lotSelectionDecision === 'PASS_WITH_COOKING'
      && getTimeValue(entry.lotSelectionAt) > getTimeValue(cr?.updatedAt);

    if (isResampleCase) {
      const assignedUser = String(entry.sampleCollectedBy || '').trim().toLowerCase();
      if (!assignedUser) return { canAdd: false, reason: 'Awaiting Assign' };
    }

    // Normal flow: one staff entry, then wait for admin.
    if (!isResampleCase) {
      if (waitingAdmin) return { canAdd: false, reason: 'Awaiting Admin' };
      if (needsFreshCookingAttempt || !cr || staffHistory.length === 0 || latestAdminStatus === 'RECHECK') {
        return { canAdd: true, reason: '' };
      }
      return { canAdd: false, reason: 'Locked' };
    }

    // Re-sample flow: only use history from current resample cycle (after lotSelectionAt).
    const { after: historyAfterResample, hasSplit: hasResampleSplit } = splitHistoryByResampleStart(entry, history);
    const currentCycleHistory = hasResampleSplit ? historyAfterResample : history;
    const currentCycleStaffHistory = currentCycleHistory.filter((item: any) => !!item?.cookingDoneBy && !item?.status);
    const currentCycleAdminHistory = currentCycleHistory.filter((item: any) => !!item?.status);
    const lastCurrentCycleStaff = currentCycleStaffHistory[currentCycleStaffHistory.length - 1];
    const lastCurrentCycleAdmin = currentCycleAdminHistory[currentCycleAdminHistory.length - 1];
    const lastCurrentCycleStaffAt = getTimeValue(lastCurrentCycleStaff?.date);
    const lastCurrentCycleAdminAt = getTimeValue(lastCurrentCycleAdmin?.date);
    const waitingAdminCurrentCycle = !!lastCurrentCycleStaff && (!lastCurrentCycleAdmin || lastCurrentCycleStaffAt > lastCurrentCycleAdminAt);
    const latestCurrentCycleAdminStatus = normalizeStatus(lastCurrentCycleAdmin?.status || null);
    const hasSecondSamplingStarted = currentCycleStaffHistory.length > 0;
    const needsSecondSampling = !hasSecondSamplingStarted;
    const needsRecheckRetry = latestCurrentCycleAdminStatus === 'RECHECK' && lastCurrentCycleAdminAt >= lastCurrentCycleStaffAt;

    if (waitingAdminCurrentCycle) return { canAdd: false, reason: 'Admin want to approve' };

    if (needsSecondSampling || needsRecheckRetry) {
      return { canAdd: true, reason: '' };
    }
    return { canAdd: false, reason: 'Locked' };
  };

  const renderSampleReportByWithDate = (entry: any) => {
    const qp = entry.qualityParameters;
    if (!qp || !qp.reportedBy) return '-';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
        <div style={{ fontWeight: '600', color: '#333', lineHeight: '1.2' }}>{toTitleCase(qp.reportedBy)}</div>
        {qp.remarks && (
          <div
            onClick={() => handleOpenHistory(entry, 'single-remark', {
              isSampleReportEvent: true,
              reportedBy: qp.reportedBy || 'Unknown',
              date: qp.createdAt || entry.createdAt || null,
              status: 'Sample Reported',
              remarks: qp.remarks
            })}
            style={{
              fontSize: '10.5px', color: '#558b2f', backgroundColor: '#ffffff',
              padding: '2px 6px', borderRadius: '4px', marginTop: '4px',
              border: '1px solid #c5e1a5', fontWeight: '700',
              cursor: 'pointer', display: 'inline-block', margin: '0 auto',
              transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
            Remarks 🔍
          </div>
        )}
      </div>
    );
  };

  const renderCookingDoneByWithDate = (entry: any, fallback: string) => {
    const cr = entry.cookingReport;
    let cookings = (cr?.history || []).filter((h: any) => h.cookingDoneBy && !h.status);

    if (cookings.length === 0 && cr?.cookingDoneBy) {
      cookings = [{ cookingDoneBy: cr.cookingDoneBy, date: null }];
    }

    if (cookings.length === 0) return <div>{fallback || '-'}</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {cookings.map((h: any, i: number) => {
          return (
            <div key={i} style={{ borderBottom: i < cookings.length - 1 ? '1px dashed #ccc' : 'none', paddingBottom: i < cookings.length - 1 ? '6px' : '0' }}>
              <div style={{ fontWeight: '600', color: '#6a1b9a', lineHeight: '1.2' }}>{i + 1}. {toTitleCase(h.cookingDoneBy)}</div>
              {h.date && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontWeight: 'normal', whiteSpace: 'normal', lineHeight: '1.2' }}>
                  {new Date(h.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderApprovedByWithDate = (entry: any) => {
    const cr = entry.cookingReport || {};
    let approvals = (cr?.history || []).filter((h: any) => h.approvedBy && h.status);

    if (approvals.length === 0 && cr?.cookingApprovedBy) {
      approvals = [{ approvedBy: cr.cookingApprovedBy, status: cr?.status, date: null, remarks: cr?.remarks }];
    }

    if (approvals.length === 0) return '-';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {approvals.map((h: any, i: number) => {
          return (
            <div key={i} style={{ borderBottom: i < approvals.length - 1 ? '1px dashed #ccc' : 'none', paddingBottom: i < approvals.length - 1 ? '6px' : '0' }}>
              <div style={{ fontWeight: '600', color: '#1565c0', lineHeight: '1.2' }}>{i + 1}. {toTitleCase(h.approvedBy)}</div>
              {h.date && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontWeight: 'normal', whiteSpace: 'normal', lineHeight: '1.2' }}>
                  {new Date(h.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              )}
              {h.remarks && (
                <div
                  onClick={() => handleOpenHistory(entry, 'single-remark', h)}
                  style={{
                    fontSize: '10.5px', color: '#e65100', backgroundColor: '#ffffff',
                    padding: '2px 6px', borderRadius: '4px', marginTop: '4px',
                    border: '1px solid #ffcc80', fontWeight: '700',
                    cursor: 'pointer', display: 'inline-block',
                    transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                  Remarks 🔍
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Filter entries to display
  // We want to display all fetched entries since we need both pending and completed ones
  const displayEntries = useMemo(() => {
    if (activeTab !== 'RESAMPLE_COOKING_REPORT') return entries;
    return entries.filter((entry) => !isResolvedResampleEntry(entry));
  }, [entries, activeTab]);

  const displayGrouped = useMemo(() => {
    const sorted = [...displayEntries].sort((a, b) => {
      const dateA = new Date(a.entryDate).getTime();
      const dateB = new Date(b.entryDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
      const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
      if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
  }, [displayEntries]);

  return (
    <div>
      <style>
        {`
        @media (max-width: 768px) {
          .cooking-table .responsive-table，
          .cooking-table .responsive-table thead,
          .cooking-table .responsive-table tbody,
          .cooking-table .responsive-table th,
          .cooking-table .responsive-table td,
          .cooking-table .responsive-table tr {
            display: block;
            width: 100% !important;
          }

          .cooking-table .responsive-table thead tr {
            position: absolute;
            top: -9999px;
            left: -9999px;
          }

          .cooking-table .responsive-table tr {
            border: 1px solid #ccc;
            margin-bottom: 0.5rem;
            padding: 0.2rem;
            border-radius: 8px;
            background: white !important;
          }

          .cooking-table .responsive-table td {
            border: none !important;
            border-bottom: 1px solid #eee !important;
            position: relative;
            padding-left: 45% !important;
            text-align: left !important;
            min-height: 40px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
          }
          
          .cooking-table .responsive-table td:before {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            left: 12px;
            width: 40%;
            padding-right: 10px;
            white-space: nowrap;
            text-align: left;
            font-weight: 600;
            color: #6b7280;
            font-size: 0.85rem;
          }

          .action-col {
             justify-content: flex-end;
             text-align: right;
          }

          /* Match columns mapping - Paddy Cooking */
          .cooking-table .responsive-table.has-type td:nth-of-type(1):before { content: "SL No"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(2):before { content: "Type"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(3):before { content: "Bags"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(4):before { content: "Pkg"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(5):before { content: "Party Name"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(6):before { content: "Location"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(7):before { content: "Variety"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(8):before { content: "Quality"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(9):before { content: "Sample Report By"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(10):before { content: "Grain"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(11):before { content: "Cooking Done by"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(12):before { content: "Cooking Apprvd By"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(13):before { content: "Status"; }
          .cooking-table .responsive-table.has-type td:nth-of-type(14):before { content: "Action"; }

          /* Match columns mapping - Rice Cooking */
          .cooking-table .responsive-table.no-type td:nth-of-type(1):before { content: "SL No"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(2):before { content: "Bags"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(3):before { content: "Pkg"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(4):before { content: "Party Name"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(5):before { content: "Location"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(6):before { content: "Variety"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(7):before { content: "Sample Report"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(8):before { content: "Cooking Done by"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(9):before { content: "Cooking Apprvd By"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(10):before { content: "Status"; }
          .cooking-table .responsive-table.no-type td:nth-of-type(11):before { content: "Action"; }
        }
        `}
      </style>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {(!entryType || entryType !== 'RICE_SAMPLE') && (
          <button
            onClick={() => setActiveTab('PADDY_COOKING_REPORT')}
            style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: '700', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'PADDY_COOKING_REPORT' ? '#1a237e' : '#e0e0e0',
              color: activeTab === 'PADDY_COOKING_REPORT' ? 'white' : '#555',
              boxShadow: activeTab === 'PADDY_COOKING_REPORT' ? '0 -2px 5px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            📖 PADDY SAMPLE COOKING
          </button>
        )}
        {(!entryType || entryType !== 'RICE_SAMPLE') && (
          <button
            onClick={() => setActiveTab('RESAMPLE_COOKING_REPORT')}
            style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: '700', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'RESAMPLE_COOKING_REPORT' ? '#c62828' : '#e0e0e0',
              color: activeTab === 'RESAMPLE_COOKING_REPORT' ? 'white' : '#555',
              boxShadow: activeTab === 'RESAMPLE_COOKING_REPORT' ? '0 -2px 5px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            🔄 RESAMPLE COOKING
          </button>
        )}
        {(!excludeEntryType || excludeEntryType !== 'RICE_SAMPLE') && (
          <button
            onClick={() => setActiveTab('RICE_COOKING_REPORT')}
            style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: '700', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
              backgroundColor: activeTab === 'RICE_COOKING_REPORT' ? '#d35400' : '#e0e0e0',
              color: activeTab === 'RICE_COOKING_REPORT' ? 'white' : '#555',
              boxShadow: activeTab === 'RICE_COOKING_REPORT' ? '0 -2px 5px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            🍚 RICE SAMPLE COOKING
          </button>
        )}
      </div>

      {(activeTab === 'PADDY_COOKING_REPORT' || activeTab === 'RESAMPLE_COOKING_REPORT') && (
        <>
          {/* Collapsible Filter Bar */}
          <div style={{ marginBottom: '0px' }}>
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
                    style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>To Date</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Broker</label>
                  <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
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
                    <button onClick={handleClearFilters}
                      style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto', backgroundColor: 'white' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
            ) : Object.keys(displayGrouped).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No cooking reports found</div>
            ) : (
              Object.entries(displayGrouped).map(([dateKey, brokerGroups]) => {
                // Filter brokers that have at least one Paddy entry
                const visibleBrokers = Object.entries(brokerGroups)
                  .map(([bName, bEntries]) => ({
                    name: bName,
                    entries: bEntries.filter((e: any) => entryType === 'RICE_SAMPLE' ? e.entryType === 'RICE_SAMPLE' : e.entryType !== 'RICE_SAMPLE')
                  }))
                  .filter(b => b.entries.length > 0)
                  .sort((a, b) => a.name.localeCompare(b.name));

                if (visibleBrokers.length === 0) return null;

                let brokerSeq = 0;
                return (
                  <div key={dateKey} style={{ marginBottom: '20px' }}>
                    {visibleBrokers.map((brokerGroup, vIdx) => {
                      brokerSeq++;
                      const { name: brokerName, entries: paddyEntries } = brokerGroup;
                      const orderedEntries = [...paddyEntries].sort((a, b) => {
                        const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                        const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                        if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                      });
                      return (
                        <div key={brokerName} style={{ marginBottom: '0px' }}>
                          {/* Date bar — only first visible broker */}
                          {vIdx === 0 && (
                            <div style={{
                              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                              color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                              textAlign: 'center', letterSpacing: '0.5px'
                            }}>
                              {(() => { const d = new Date(paddyEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                              &nbsp;&nbsp;{(activeTab as string) === 'RICE_COOKING_REPORT' ? 'Rice Sample Cooking' : 'Paddy Sample Cooking'}
                            </div>
                          )}
                          {/* Broker name bar */}
                          <div style={{
                            background: '#e8eaf6',
                            color: '#000', padding: '4px 10px', fontWeight: '700', fontSize: '13.5px',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                          </div>
                          <div className="table-container cooking-table">
                            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '3%' }}>SL No</th>
                                  {(activeTab as string) !== 'RICE_COOKING_REPORT' && (
                                    <th style={{ border: '1px solid #000', padding: '1px 3px', fontWeight: '600', fontSize: '12px', textAlign: 'center', width: '3%' }}>Type</th>
                                  )}
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '4%' }}>Bags</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '4%' }}>Pkg</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '11%' }}>Party Name</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '9%' }}>Location</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '7%' }}>Variety</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '4%' }}>Quality</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '6%' }}>Sample Report By</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '4%' }}>G C</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '6%' }}>Cooking Done by</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '7%' }}>Cooking Apprvd By</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '5%' }}>Status</th>
                                  {canTakeAction && (
                                    <th className="action-col" style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Action</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {orderedEntries.map((entry, idx) => {
                                  const slNo = entry.serialNo || (idx + 1);

                                  // Determine Quality Info (Pass)
                                  let objQuality: React.ReactNode = '-';
                                  if (entry.qualityParameters) {
                                    objQuality = <span style={{ color: '#2e7d32' }}>Pass</span>;
                                  }

                                  return (
                                    <tr key={entry.id} style={{ backgroundColor: entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff', }}>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{slNo}</td>
                                      {(activeTab as string) !== 'RICE_COOKING_REPORT' && (
                                        <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', verticalAlign: 'middle' }}>
                                          {entry.entryType === 'DIRECT_LOADED_VEHICLE' && <span style={{ color: 'white', backgroundColor: '#1565c0', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontWeight: '800' }}>RL</span>}
                                          {entry.entryType === 'LOCATION_SAMPLE' && <span style={{ color: 'white', backgroundColor: '#e67e22', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontWeight: '800' }}>LS</span>}
                                          {entry.entryType !== 'DIRECT_LOADED_VEHICLE' && entry.entryType !== 'LOCATION_SAMPLE' && <span style={{ color: '#333', backgroundColor: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontWeight: '800', border: '1px solid #ccc' }}>MS</span>}
                                        </td>
                                      )}
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'center' }}>{entry.packaging || '-'}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#1565c0' }}>
                                        {(() => {
                                          const party = (entry.partyName || '').trim();
                                          const lorry = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
                                          if (party) {
                                            return (
                                              <>
                                                {toTitleCase(party)}
                                                {entry.entryType === 'DIRECT_LOADED_VEHICLE' && lorry ? (
                                                  <div style={{ fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{lorry}</div>
                                                ) : null}
                                              </>
                                            );
                                          }
                                          return lorry || '-';
                                        })()}
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.location) || '-'}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.variety)}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '700' }}>{objQuality}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
                                        {renderSampleReportByWithDate(entry)}
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#333' }}>{entry.qualityParameters?.grainsCount ? `(${entry.qualityParameters.grainsCount})` : '-'}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6a1b9a' }}>
                                        {renderCookingDoneByWithDate(entry, '')}
                                      </td>

                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#1565c0' }}>
                                        {renderApprovedByWithDate(entry)}
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px' }}>
                                        {getStatusBadge(entry)}
                                      </td>
                                      {canTakeAction && (
                                        <td className="action-col" style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                                          {(() => {
                                            const actionState = canStaffAddCookingForEntry(entry);
                                            if (!isCookingStaffRole || actionState.canAdd) {
                                              return (
                                                <button
                                                  onClick={() => handleOpenModal(entry)}
                                                  style={{
                                                    fontSize: '9px', padding: '4px 10px',
                                                    backgroundColor: '#3498db', color: 'white', border: 'none',
                                                    borderRadius: '10px', cursor: 'pointer', fontWeight: '600'
                                                  }}
                                                >
                                                  {isCookingStaffRole ? 'Add Cooking Done By' : 'Add Report'}
                                                </button>
                                              );
                                            } else {
                                              return <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>{actionState.reason || 'Locked'}</span>;
                                            }
                                          })()}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div >
        </>
      )}

      {
        activeTab === 'RICE_COOKING_REPORT' && (
          <div style={{ overflowX: 'auto', backgroundColor: 'white' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
            ) : Object.keys(displayGrouped).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No rice samples found</div>
            ) : (
              Object.entries(displayGrouped).map(([dateKey, brokerGroups]) => {
                // Filter brokers that have at least one Rice entry
                const visibleBrokers = Object.entries(brokerGroups)
                  .map(([bName, bEntries]) => ({
                    name: bName,
                    entries: bEntries.filter(e => e.entryType === 'RICE_SAMPLE')
                  }))
                  .filter(b => b.entries.length > 0)
                  .sort((a, b) => a.name.localeCompare(b.name));

                if (visibleBrokers.length === 0) return null;

                let brokerSeq = 0;
                return (
                  <div key={dateKey} style={{ marginBottom: '20px' }}>
                    {visibleBrokers.map((brokerGroup, vIdx) => {
                      brokerSeq++;
                      const { name: brokerName, entries: riceEntries } = brokerGroup;
                      const orderedEntries = [...riceEntries].sort((a, b) => {
                        const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                        const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                        if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                      });
                      return (
                        <div key={brokerName} style={{ marginBottom: '0px' }}>
                          {/* Date bar — only first visible broker */}
                          {vIdx === 0 && (
                            <div style={{
                              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                              color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                              textAlign: 'center', letterSpacing: '0.5px'
                            }}>
                              {(() => { const d = new Date(riceEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                              &nbsp;&nbsp;Rice Sample Cooking
                            </div>
                          )}

                          {/* Broker name bar */}
                          <div style={{
                            background: '#e8eaf6',
                            color: '#000', padding: '4px 10px', fontWeight: '700', fontSize: '13.5px',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                          </div>

                          <div className="table-container cooking-table">
                            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#4a148c', color: 'white' }}>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '3%' }}>SL No</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '6%' }}>Bags</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '6%' }}>Pkg</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '16%' }}>Party Name</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '12%' }}>Location</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '8%' }}>Variety</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '10%' }}>Sample Report By</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '10%' }}>Cooking Done by</th>

                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '10%' }}>Cooking Apprvd By</th>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Status</th>

                                  {canTakeAction && (
                                    <th className="action-col" style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '9%' }}>Action</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {orderedEntries.map((entry, idx) => {
                                  const slNo = entry.serialNo || (idx + 1);
                                  return (
                                    <tr key={entry.id}>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{slNo}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '700', fontSize: '13px', color: '#1565c0' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '11px' }}>{(() => {
                                        let pkg = String(entry.packaging || '75');
                                        if (pkg.toLowerCase() === '0' || pkg.toLowerCase() === 'loose') return 'Loose';
                                        if (pkg.toLowerCase().includes('kg')) return pkg;
                                        if (pkg.toLowerCase().includes('tons')) return pkg;
                                        return `${pkg} kg`;
                                      })()}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#1565c0' }}>
                                        {(() => {
                                          const party = (entry.partyName || '').trim();
                                          const lorry = entry.lorryNumber ? entry.lorryNumber.toUpperCase() : '';
                                          if (party) return toTitleCase(party);
                                          return lorry || '-';
                                        })()}
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.location) || '-'}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.variety)}</td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
                                        {renderSampleReportByWithDate(entry)}
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6a1b9a' }}>
                                        {renderCookingDoneByWithDate(entry, '')}
                                      </td>

                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#1565c0' }}>
                                        {renderApprovedByWithDate(entry)}
                                      </td>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px' }}>
                                        {getStatusBadge(entry)}
                                      </td>
                                      {canTakeAction && (
                                        <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                                          {(() => {
                                            const actionState = canStaffAddCookingForEntry(entry);
                                            if (!isCookingStaffRole || actionState.canAdd) {
                                              return (
                                                <button
                                                  onClick={() => handleOpenModal(entry)}
                                                  style={{
                                                    fontSize: '9px', padding: '4px 10px',
                                                    backgroundColor: '#3498db', color: 'white', border: 'none',
                                                    borderRadius: '10px', cursor: 'pointer', fontWeight: '600'
                                                  }}
                                                >
                                                  {isCookingStaffRole ? 'Add Cooking Done By' : 'Add Report'}
                                                </button>
                                              );
                                            }
                                            return <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>{actionState.reason || 'Locked'}</span>;
                                          })()}
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )
      }

      {/* Cooking Report Modal */}
      {
        showModal && selectedEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px',
              border: '1px solid #999', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '16px 20px', color: 'white'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCookingStaffRole ? '🍳 Add Preparing for Cooking' : `🍳 Add ${selectedEntry.entryType === 'RICE_SAMPLE' ? 'Rice' : 'Paddy'} Cooking Report`}
                </h3>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4', opacity: 0.95, fontWeight: '500' }}>
                  <span style={{ fontWeight: '800' }}>Broker Name:</span> {selectedEntry.brokerName}<br />
                <span style={{ fontWeight: '800' }}>Party Name:</span> {(() => {
                  const party = (selectedEntry.partyName || '').trim();
                  const lorry = selectedEntry.lorryNumber ? selectedEntry.lorryNumber.toUpperCase() : '';
                  return party ? toTitleCase(party) : (lorry || '-');
                })()}<br />
                  <span style={{ fontWeight: '800' }}>Variety:</span> {selectedEntry.variety}<br />
                  <span style={{ fontWeight: '800' }}>Bags:</span> {selectedEntry.bags?.toLocaleString('en-IN')}
                </p>
              </div>

              <div style={{ padding: '20px' }}>

                {(!isCookingStaffRole && !selectedEntry.cookingReport?.cookingDoneBy) ? (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px', color: '#856404' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>⚠️ Action Required by Paddy Supervisor</p>
                    <p style={{ margin: '8px 0 0', fontSize: '13px' }}>The Paddy Supervisor must select "Cooking Done By" and save their details before an Admin or Manager can approve and set the Status.</p>
                    <div style={{ marginTop: '16px' }}>
                      <button type="button" onClick={closeReportModal}
                        style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #999', borderRadius: '3px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {/* Status & Date - Hidden for staff */}
                    {!isCookingStaffRole && (
                      <>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontWeight: '600', color: '#555', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                            Date
                          </label>
                          <input
                            type="date"
                            value={manualDate}
                            onChange={(e) => setManualDate(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px' }}
                            max={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ fontWeight: '600', color: '#555', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                            Status *
                          </label>
                          <select
                            value={cookingData.status}
                            onChange={(e) => setCookingData({ ...cookingData, status: e.target.value })}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px' }}
                            required
                          >
                            <option value="">-- Select Status --</option>
                            <option value="PASS">Pass</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="RECHECK">Recheck</option>
                            <option value="FAIL">Fail</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Cooking Done By - STRICTLY FOR STAFF */}
                    {isCookingStaffRole && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
                          Cooking Done by*
                        </label>
                        {!useManualEntry && (
                          <select
                            value={cookingData.cookingDoneBy}
                            onChange={(e) => {
                              setCookingData({ ...cookingData, cookingDoneBy: e.target.value });
                            }}
                            style={{
                              width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px',
                              backgroundColor: 'white', marginBottom: '6px'
                            }}
                          >
                            <option value="">-- Select from list --</option>
                            {supervisors.map(s => (
                              <option key={s.id} value={s.username}>{toTitleCase(s.username)}</option>
                            ))}
                          </select>
                        )}

                        {(!cookingData.cookingDoneBy) && (
                          <input
                            type="text"
                            placeholder="Or Type Name Manually"
                            value={manualCookingName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setManualCookingName(val);
                              setUseManualEntry(val.trim() !== '');
                            }}
                            style={{
                              width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px',
                              backgroundColor: 'white'
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Admin and Manager Block - Cooking Approved By & Remarks */}
                    {!isCookingStaffRole && (
                      <>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
                            Cooking Approved by*
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', marginBottom: '8px', fontSize: '13px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="approvalType"
                                checked={approvalType === 'owner'}
                                onChange={() => setApprovalType('owner')}
                              />
                              Harish
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="approvalType"
                                checked={approvalType === 'manager'}
                                onChange={() => setApprovalType('manager')}
                              />
                              Guru
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="approvalType"
                                checked={approvalType === 'admin'}
                                onChange={() => setApprovalType('admin')}
                              />
                              MK Subbu
                            </label>
                          </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>Remarks</span>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px', fontSize: '13px' }}>
                              <input
                                type="radio"
                                checked={!showRemarksInput}
                                onChange={() => setShowRemarksInput(false)}
                              /> No
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px', fontSize: '13px' }}>
                              <input
                                type="radio"
                                checked={showRemarksInput}
                                onChange={() => setShowRemarksInput(true)}
                              /> Yes
                            </label>
                          </div>

                          {showRemarksInput && (
                            <textarea
                              value={cookingData.remarks}
                              onChange={(e) => setCookingData({ ...cookingData, remarks: e.target.value })}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px', minHeight: '60px' }}
                              placeholder="Enter remarks..."
                            />
                          )}
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                      <button type="button" onClick={closeReportModal} disabled={isSubmitting}
                        style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: '1px solid #999', borderRadius: '3px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>
                        Cancel
                      </button>
                      <button type="submit" disabled={isSubmitting}
                        style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', backgroundColor: isSubmitting ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '3px', fontSize: '13px', fontWeight: '600' }}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* History Modal */}
      {
        historyModal.visible && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1100, padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '400px',
              border: '1px solid #999', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden'
            }}>
              <div style={{
                background: '#f8f9fa', padding: '12px 16px', borderBottom: '1px solid #e0e0e0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#333' }}>
                  {historyModal.title}
                </h3>
                <button
                  onClick={() => setHistoryModal({ visible: false, title: '', content: null })}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
                {historyModal.content}
              </div>
              <div style={{ padding: '12px 16px', background: '#f8f9fa', borderTop: '1px solid #e0e0e0', textAlign: 'right' }}>
                <button
                  onClick={() => setHistoryModal({ visible: false, title: '', content: null })}
                  style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

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
    </div >
  );
};

export default CookingReport;
