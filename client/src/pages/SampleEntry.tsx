import React, { useState, useEffect, useMemo, useRef } from 'react';
import { sampleEntryApi } from '../utils/sampleEntryApi';
import type { SampleEntry, EntryType } from '../types/sampleEntry';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';

import { API_URL } from '../config/api';

const SampleEntryPage: React.FC<{
  defaultTab?: 'MILL_SAMPLE' | 'LOCATION_SAMPLE' | 'SAMPLE_BOOK';
  filterEntryType?: string;
  excludeEntryType?: string;
}> = ({ defaultTab, filterEntryType, excludeEntryType }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType>('CREATE_NEW');
  useEffect(() => {
    if (selectedEntryType === 'RICE_SAMPLE') {
      setFormData(prev => ({ ...prev, packaging: '26 kg' }));
    } else {
      setFormData(prev => ({ ...prev, packaging: '75' }));
    }
  }, [selectedEntryType]);
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExistingQualityData, setHasExistingQualityData] = useState(false);
  const [qualityRecordExists, setQualityRecordExists] = useState(false);
  const [activeTab, setActiveTab] = useState<'MILL_SAMPLE' | 'LOCATION_SAMPLE' | 'SAMPLE_BOOK'>(defaultTab || 'MILL_SAMPLE');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showQualitySaveConfirm, setShowQualitySaveConfirm] = useState(false);
  const [pendingSubmitEvent, setPendingSubmitEvent] = useState<React.FormEvent | null>(null);
  const [editingEntry, setEditingEntry] = useState<SampleEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [smixEnabled, setSmixEnabled] = useState(false);
  const [lmixEnabled, setLmixEnabled] = useState(false);
  const [paddyWbEnabled, setPaddyWbEnabled] = useState(false);
  const [wbEnabled, setWbEnabled] = useState(false);
  const [dryMoistureEnabled, setDryMoistureEnabled] = useState(false);
  const [brokerSampleEnabled, setBrokerSampleEnabled] = useState(false);
  const [brokerSampleData, setBrokerSampleData] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [qualityUsers, setQualityUsers] = useState<string[]>([]);
  const submissionLocksRef = useRef<Set<string>>(new Set());

  // Sample Collected By — radio state
  const [sampleCollectType, setSampleCollectType] = useState<'broker' | 'supervisor'>('broker');
  const [paddySupervisors, setPaddySupervisors] = useState<{ id: number; username: string; staffType?: string | null }[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Title Case helper: first letter capital, rest small
  const toTitleCase = (str: string) => str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  const getTimeValue = (value?: string | null) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const isRiceQualityEntry = filterEntryType === 'RICE_SAMPLE' || selectedEntry?.entryType === 'RICE_SAMPLE';
  const riceReportedByOptions = useMemo(() => {
    if (!isRiceQualityEntry) {
      return [];
    }

    const rawNames = [
      ...(user?.role !== 'admin' && user?.username ? [user.username] : []),
      ...qualityUsers,
      ...paddySupervisors.map((supervisor) => supervisor.username)
    ];

    return Array.from(
      new Set(
        rawNames
          .map((name) => (name || '').trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [isRiceQualityEntry, paddySupervisors, qualityUsers, user?.role, user?.username]);
  const locationSupervisors = useMemo(
    () => paddySupervisors.filter((supervisor) => String(supervisor.staffType || '').toLowerCase() === 'location'),
    [paddySupervisors]
  );

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBroker, setFilterBroker] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Server-side Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const PAGE_SIZE = 100;

  const acquireSubmissionLock = (key: string) => {
    if (submissionLocksRef.current.has(key)) return false;
    submissionLocksRef.current.add(key);
    return true;
  };

  const releaseSubmissionLock = (key: string) => {
    submissionLocksRef.current.delete(key);
  };

  // Dropdown options
  const [brokers, setBrokers] = useState<string[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    brokerName: '',
    variety: '',
    partyName: '',
    location: '',
    bags: '',
    lorryNumber: '',
    packaging: '75',
    sampleCollectedBy: '',
    sampleGivenToOffice: false
  });

  // Quality parameters form — cutting & bend use single-column format: e.g. "32×24"
  const [qualityData, setQualityData] = useState({
    moisture: '',
    cutting: '', // single column: "32×24"
    cutting1: '',
    cutting2: '',
    bend: '', // single column: "12×8"
    bend1: '',
    bend2: '',
    mixS: '',
    mixL: '',
    mix: '',
    kandu: '',
    oil: '',
    sk: '',
    grainsCount: '',
    wbR: '',
    wbBk: '',
    wbT: '',
    paddyWb: '',
    dryMoisture: '',
    reportedBy: '',
    gramsReport: '10gms',
    uploadFile: null as File | null
  });

  // Auto-insert × symbol for cutting/bend - 1 digit before × and 4 digits after ×
  const handleCuttingInput = (value: string) => {
    // For Rice entries, allow manual entry with 5-digit limit and NO auto-prefix
    if (filterEntryType === 'RICE_SAMPLE' || selectedEntry?.entryType === 'RICE_SAMPLE') {
      const cleaned = value.replace(/[^0-9.]/g, '');
      if (cleaned.length > 5) return;
      setQualityData(prev => ({ ...prev, cutting: cleaned, cutting1: cleaned }));
      return;
    }

    // Existing Paddy logic with 1× prefix
    let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
    const xCount = (clean.match(/×/g) || []).length;
    if (xCount > 1) {
      const idx = clean.indexOf('×');
      clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
    }
    if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
      clean = clean + '×';
    }
    const parts = clean.split('×');
    const first = (parts[0] || '').substring(0, 1);
    const second = (parts[1] || '').substring(0, 4);
    clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
    setQualityData(prev => ({ ...prev, cutting: clean, cutting1: first, cutting2: second }));
  };

  const handleBendInput = (value: string) => {
    // For Rice entries, allow manual entry with 5-digit limit and NO auto-prefix
    if (filterEntryType === 'RICE_SAMPLE' || selectedEntry?.entryType === 'RICE_SAMPLE') {
      const cleaned = value.replace(/[^0-9.]/g, '');
      if (cleaned.length > 5) return;
      setQualityData(prev => ({ ...prev, bend: cleaned, bend1: cleaned }));
      return;
    }

    // Existing Paddy logic with 1× prefix
    let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
    const xCount = (clean.match(/×/g) || []).length;
    if (xCount > 1) {
      const idx = clean.indexOf('×');
      clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
    }
    if (clean.length === 1 && !clean.includes('×') && /^\d$/.test(clean)) {
      clean = clean + '×';
    }
    const parts = clean.split('×');
    const first = (parts[0] || '').substring(0, 1);
    const second = (parts[1] || '').substring(0, 4);
    clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
    setQualityData(prev => ({ ...prev, bend: clean, bend1: first, bend2: second }));
  };

  // Helper: restrict quality param value - 5 digits total for most, 3 digits for grains
  const handleQualityInput = (field: string, value: string) => {
    // Remove non-numeric except decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    const threeDigitFields = ['grainsCount'];
    if (threeDigitFields.includes(field)) {
      if (cleaned.length > 3) return;
    } else {
      // Limit to 5 digits for moisture and other fields
      if (cleaned.length > 5) return;
    }
    setQualityData(prev => ({ ...prev, [field]: cleaned }));
  };

  useEffect(() => {
    const wbR = wbEnabled ? (parseFloat(qualityData.wbR) || 0) : 0;
    const wbBk = wbEnabled ? (parseFloat(qualityData.wbBk) || 0) : 0;
    const wbT = (wbR + wbBk).toFixed(2);
    if (qualityData.wbT !== wbT) {
      setQualityData(prev => ({ ...prev, wbT }));
    }
  }, [qualityData.wbR, qualityData.wbBk, wbEnabled]);

  useEffect(() => {
    loadEntries();
    loadDropdownData();
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const handleClearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterBroker('');
    setPage(1);
    loadEntries('', '', '');
  };

  const loadEntries = async (fFrom?: string, fTo?: string, fBroker?: string) => {
    try {
      setLoading(true);
      const params: any = { page, pageSize: PAGE_SIZE };
      if (!filterEntryType && !excludeEntryType) {
        params.excludeEntryType = 'RICE_SAMPLE';
      }
      const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
      const dTo = fTo !== undefined ? fTo : filterDateTo;
      const b = fBroker !== undefined ? fBroker : filterBroker;

      if (dFrom) params.startDate = dFrom;
      if (dTo) params.endDate = dTo;
      if (b) params.broker = b;
      if (filterEntryType) params.entryType = filterEntryType;
      if (excludeEntryType) params.excludeEntryType = excludeEntryType;

      const response = await axios.get(`${API_URL}/sample-entries/by-role`, { params });
      const data = response.data as any;
      setEntries(data.entries);
      if (data.total != null) {
        setTotalEntries(data.total);
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

  const loadDropdownData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch varieties from locations API
      const varietiesResponse = await axios.get<{ varieties: Array<{ name: string }> }>(`${API_URL}/locations/varieties`, { headers });
      const varietyNames = varietiesResponse.data.varieties.map((v) => v.name);
      setVarieties(varietyNames);

      // Fetch brokers from locations API (new broker endpoint)
      const brokersResponse = await axios.get<{ brokers: Array<{ name: string }> }>(`${API_URL}/locations/brokers`, { headers });
      const brokerNames = brokersResponse.data.brokers.map((b) => b.name);
      setBrokers(brokerNames);

      // Fetch quality users (users who have qualityName set)
      try {
        const usersResponse = await axios.get<{ success: boolean, users: Array<{ qualityName: string | null, role?: string, isActive?: boolean }> }>(`${API_URL}/admin/users`, { headers });
        if (usersResponse.data.success) {
          const qNames = usersResponse.data.users
            .filter((u: any) => u.isActive !== false && u.qualityName && u.qualityName.trim() !== '')
            .map((u: any) => u.qualityName.trim())
            .sort((a: string, b: string) => a.localeCompare(b));
          setQualityUsers(Array.from(new Set(qNames)));
        }
      } catch (qErr) {
        console.log('Could not fetch quality users for dropdown');
      }

      // Fetch paddy supervisors (mill staff) for Sample Collected By dropdown
      try {
        const supervisorRes = await axios.get<{ success: boolean, users: Array<{ id: number, username: string, staffType?: string | null }> }>(`${API_URL}/sample-entries/paddy-supervisors`, { headers });
        if (supervisorRes.data.success) {
          setPaddySupervisors(supervisorRes.data.users);
        }
      } catch (psErr) {
        console.log('Could not fetch paddy supervisors for dropdown');
      }
    } catch (error: any) {
      console.error('Failed to load dropdown data:', error);
    }
  };

  // Show save confirmation before actually saving
  const handleSubmitWithConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setPendingSubmitEvent(e);
    setShowSaveConfirm(true);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const lockKey = 'entry-create';
    if (!acquireSubmissionLock(lockKey)) return;

    try {
      if (!user || !user.id) {
        showNotification('User not authenticated', 'error');
        return;
      }
      setIsSubmitting(true);

      // Close confirmation dialog
      setShowSaveConfirm(false);

      await sampleEntryApi.createSampleEntry({
        entryDate: formData.entryDate,
        brokerName: toTitleCase(formData.brokerName),
        variety: toTitleCase(formData.variety),
        partyName: toTitleCase(formData.partyName),
        location: toTitleCase(formData.location),
        bags: parseInt(formData.bags),
        lorryNumber: formData.lorryNumber ? formData.lorryNumber.toUpperCase() : undefined,
        entryType: selectedEntryType,
        packaging: formData.packaging as any,
        sampleCollectedBy: formData.sampleCollectedBy ? toTitleCase(formData.sampleCollectedBy) : undefined,
        sampleGivenToOffice: formData.sampleGivenToOffice
      });

      // Close modal after successful save
      setShowModal(false);
      showNotification('Sample entry created successfully', 'success');
      setSampleCollectType('broker');
      setFormData({
        entryDate: new Date().toISOString().split('T')[0],
        brokerName: '',
        variety: '',
        partyName: '',
        location: '',
        bags: '',
        lorryNumber: '',
        packaging: selectedEntryType === 'RICE_SAMPLE' ? '26 kg' : '75',
        sampleCollectedBy: 'Broker Office Sample',
        sampleGivenToOffice: false
      });
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to create entry', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };

  // Open edit modal for a staff entry
  const handleEditEntry = (entry: SampleEntry) => {
    setEditingEntry(entry);
    // Get bags value - handle both number and string types
    const bagsValue = typeof entry.bags === 'number' ? entry.bags.toString() : (entry.bags || '');

    // Determine sampleCollectType for edit form
    const isBroker = (entry as any).sampleCollectedBy === 'Broker Office Sample';
    setSampleCollectType(isBroker ? 'broker' : 'supervisor');

    setFormData({
      entryDate: entry.entryDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      brokerName: entry.brokerName || '',
      variety: entry.variety || '',
      partyName: entry.partyName || '',
      location: entry.location || '',
      bags: bagsValue,
      lorryNumber: entry.lorryNumber || '',
      packaging: (entry as any).packaging || '75',
      sampleCollectedBy: (entry as any).sampleCollectedBy || '',
      sampleGivenToOffice: (entry as any).sampleGivenToOffice || false
    });
    setSelectedEntryType(entry.entryType);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || isSubmitting) return;
    const lockKey = `entry-edit-${editingEntry.id}`;
    if (!acquireSubmissionLock(lockKey)) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/sample-entries/${editingEntry.id}`, {
        entryDate: formData.entryDate,
        brokerName: toTitleCase(formData.brokerName),
        variety: toTitleCase(formData.variety),
        partyName: toTitleCase(formData.partyName),
        location: toTitleCase(formData.location),
        bags: parseInt(formData.bags),
        lorryNumber: formData.lorryNumber ? formData.lorryNumber.toUpperCase() : null,
        packaging: formData.packaging,
        sampleCollectedBy: formData.sampleCollectedBy ? toTitleCase(formData.sampleCollectedBy) : null,
        sampleGivenToOffice: formData.sampleGivenToOffice
      }, { headers: { Authorization: `Bearer ${token}` } });
      showNotification('Entry updated successfully', 'success');
      setShowEditModal(false);
      setEditingEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to update entry', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };



  // Title case handler
  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: toTitleCase(value) });
  };

  const resetQualityForm = () => {
    setQualityData({
      moisture: '',
      cutting: '',
      cutting1: '',
      cutting2: '',
      bend: '',
      bend1: '',
      bend2: '',
      mixS: '',
      mixL: '',
      mix: '',
      kandu: '',
      oil: '',
      sk: '',
      grainsCount: '',
      wbR: '',
      wbBk: '',
      wbT: '',
      paddyWb: '',
      dryMoisture: '',
      reportedBy: '',
      gramsReport: '10gms',
      uploadFile: null
    });
    setHasExistingQualityData(false);
    setSmixEnabled(false);
    setLmixEnabled(false);
    setPaddyWbEnabled(false);
    setWbEnabled(false);
    setDryMoistureEnabled(false);
  };

  const handleViewEntry = (entry: SampleEntry) => {
    setSelectedEntry(entry);
    setShowQualityModal(true);
    // Fetch existing quality parameters if they exist
    const fetchQualityParameters = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get<any>(
          `${API_URL}/sample-entries/${entry.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );


        // If quality parameters exist, populate the form with saved data
        if (response.data.qualityParameters) {
          setQualityRecordExists(true);
          const resampleDecision = response.data?.lotSelectionDecision || entry.lotSelectionDecision;
          const resampleFlow = entry.entryType !== 'RICE_SAMPLE' && resampleDecision === 'FAIL';
          const lotSelectionAt = response.data?.lotSelectionAt || entry.lotSelectionAt;
          const qpUpdatedAt = response.data.qualityParameters?.updatedAt || response.data.qualityParameters?.createdAt;
          const resampleQualitySaved = resampleFlow
            && !!lotSelectionAt
            && getTimeValue(qpUpdatedAt) >= getTimeValue(lotSelectionAt);
          if (resampleFlow && (!lotSelectionAt || !resampleQualitySaved)) {
            resetQualityForm();
            return;
          }
          const qp = response.data.qualityParameters;
          // Helper: convert any zero variant to empty string so unfilled fields appear empty
          const zeroToEmpty = (v: any, forceDecimal = false) => {
            if (v === null || v === undefined || v === '') return '';
            const num = parseFloat(v);
            if (isNaN(num) || num === 0) return '';
            if (forceDecimal) return num.toFixed(1);
            return String(num); // strips trailing zeros: 1.00 → 1, 45.00 → 45
          };
          const c1 = zeroToEmpty(qp.cutting1, false);
          const c2 = zeroToEmpty(qp.cutting2, false);
          const b1 = zeroToEmpty(qp.bend1, false);
          const b2 = zeroToEmpty(qp.bend2, false);
          setQualityData({
            moisture: qp.moisture?.toString() || '',
            cutting: c1 && c2 ? `${c1}×${c2}` : c1 || '',
            cutting1: c1,
            cutting2: c2,
            bend: b1 && b2 ? `${b1}×${b2}` : b1 || '',
            bend1: b1,
            bend2: b2,
            mixS: zeroToEmpty(qp.mixS),
            mixL: zeroToEmpty(qp.mixL),
            mix: zeroToEmpty(qp.mix),
            kandu: zeroToEmpty(qp.kandu),
            oil: zeroToEmpty(qp.oil),
            sk: zeroToEmpty(qp.sk),
            grainsCount: zeroToEmpty(qp.grainsCount),
            wbR: zeroToEmpty(qp.wbR),
            wbBk: zeroToEmpty(qp.wbBk),
            wbT: zeroToEmpty(qp.wbT),
            paddyWb: zeroToEmpty(qp.paddyWb),
            dryMoisture: zeroToEmpty(qp.dryMoisture),
            reportedBy: qp.reportedBy?.toString() || '',
            gramsReport: qp.gramsReport || '10gms',
            uploadFile: null
          });
          setHasExistingQualityData(true);
          // Auto-enable toggles based on existing data
          if (qp.mixS && parseFloat(qp.mixS) > 0) setSmixEnabled(true);
          if (qp.mixL && parseFloat(qp.mixL) > 0) setLmixEnabled(true);
          if (qp.paddyWb && parseFloat(qp.paddyWb) > 0) setPaddyWbEnabled(true);
          if (qp.wbR && parseFloat(qp.wbR) > 0) setWbEnabled(true);
          if (qp.wbBk && parseFloat(qp.wbBk) > 0) setWbEnabled(true);
          if (qp.dryMoisture && parseFloat(qp.dryMoisture) > 0) setDryMoistureEnabled(true);
        } else {
          setQualityRecordExists(false);
          resetQualityForm();
        }
      } catch (error) {
        console.error('Error fetching quality parameters:', error);
        setQualityRecordExists(false);
        resetQualityForm();
      }
    };

    fetchQualityParameters();
  };

  const handleSubmitQualityParametersWithConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!qualityData.moisture) { showNotification('Moisture is required', 'error'); return; }

    if (selectedEntry?.entryType === 'RICE_SAMPLE') {
      // All fields mandatory for Rice except toggles
      if (!qualityData.grainsCount) { showNotification('Grains Count is required', 'error'); return; }
      if (!qualityData.mix) { showNotification('Broken is required', 'error'); return; }
      if (!qualityData.cutting1) { showNotification('Rice is required', 'error'); return; }
      if (!qualityData.bend1) { showNotification('Bend is required', 'error'); return; }
      if (!qualityData.sk) { showNotification('Mix is required', 'error'); return; }
      if (!qualityData.kandu) { showNotification('Kandu is required', 'error'); return; }
      if (!qualityData.oil) { showNotification('Oil is required', 'error'); return; }
      if (!qualityData.gramsReport) { showNotification('Grams Report is required', 'error'); return; }
    } else {
      // 100g save = moisture + grainsCount only for Paddy
      const has100g = !!(qualityData.moisture && qualityData.grainsCount);
      const qualityFields = !!(qualityData.cutting1 || qualityData.cutting2 || qualityData.bend1 || qualityData.bend2 || qualityData.mix || qualityData.kandu || qualityData.oil || qualityData.sk);
      const allQualityFilled = !!(qualityData.cutting1 && qualityData.cutting2 && qualityData.bend1 && qualityData.bend2 && qualityData.mix && qualityData.kandu && qualityData.oil && qualityData.sk && qualityData.grainsCount);
      if (qualityFields && !allQualityFilled) {
        if (!qualityData.cutting1) { showNotification('Cutting is required', 'error'); return; }
        if (!qualityData.bend1) { showNotification('Bend is required', 'error'); return; }
        if (!qualityData.mix) { showNotification('Mix is required', 'error'); return; }
        if (!qualityData.kandu) { showNotification('Kandu is required', 'error'); return; }
        if (!qualityData.oil) { showNotification('Oil is required', 'error'); return; }
        if (!qualityData.sk) { showNotification('SK is required', 'error'); return; }
        if (!qualityData.grainsCount) { showNotification('Grains Count is required', 'error'); return; }
      }
    }
    setShowQualitySaveConfirm(true);
  };

  const handleSubmitQualityParameters = async () => {
    if (!selectedEntry || isSubmitting) return;
    const lockKey = `quality-save-${selectedEntry.id}`;
    if (!acquireSubmissionLock(lockKey)) return;

    setShowQualitySaveConfirm(false);

    // 100g = ONLY moisture (and optionally dry moisture) entered, no other quality fields
    // Quality Complete = moisture + all other required fields filled
    const allQualityFieldsFilled = !!(qualityData.moisture && qualityData.cutting1 && qualityData.cutting2 && qualityData.bend1 && qualityData.bend2 && qualityData.mix && qualityData.kandu && qualityData.oil && qualityData.sk && qualityData.grainsCount);
    const is100GramsSave = selectedEntry.entryType === 'RICE_SAMPLE' ? false : !allQualityFieldsFilled;

    try {
      setIsSubmitting(true);
      const formDataToSend = new FormData();
      formDataToSend.append('moisture', qualityData.moisture);
      formDataToSend.append('cutting1', selectedEntry.entryType === 'RICE_SAMPLE' ? qualityData.cutting1 || '0' : qualityData.cutting1 || '0');
      formDataToSend.append('cutting2', selectedEntry.entryType === 'RICE_SAMPLE' ? qualityData.cutting2 || '0' : qualityData.cutting2 || '0');
      formDataToSend.append('bend1', selectedEntry.entryType === 'RICE_SAMPLE' ? qualityData.bend1 || '0' : qualityData.bend1 || '0');
      formDataToSend.append('bend2', selectedEntry.entryType === 'RICE_SAMPLE' ? qualityData.bend2 || '0' : qualityData.bend2 || '0');
      if (selectedEntry.entryType === 'RICE_SAMPLE' && qualityData.gramsReport) {
        formDataToSend.append('gramsReport', qualityData.gramsReport);
      }
      formDataToSend.append('mixS', smixEnabled ? qualityData.mixS || '0' : '0');
      formDataToSend.append('mixL', lmixEnabled ? qualityData.mixL || '0' : '0');
      formDataToSend.append('mix', qualityData.mix || '0');
      formDataToSend.append('kandu', qualityData.kandu || '0');
      formDataToSend.append('oil', qualityData.oil || '0');
      formDataToSend.append('sk', qualityData.sk || '0');
      formDataToSend.append('grainsCount', qualityData.grainsCount || '0');
      formDataToSend.append('wbR', wbEnabled ? qualityData.wbR || '0' : '0');
      formDataToSend.append('wbBk', wbEnabled ? qualityData.wbBk || '0' : '0');
      formDataToSend.append('wbT', qualityData.wbT || '0');
      formDataToSend.append('paddyWb', paddyWbEnabled ? qualityData.paddyWb || '0' : '0');
      formDataToSend.append('dryMoisture', dryMoistureEnabled ? qualityData.dryMoisture || '0' : '0');
      const reportedByValue = selectedEntry?.entryType === 'LOCATION_SAMPLE'
        ? (user?.username || 'Unknown')
        : isRiceQualityEntry
          ? (qualityData.reportedBy || riceReportedByOptions[0] || '')
          : (qualityData.reportedBy || qualityUsers[0] || '');
      formDataToSend.append('reportedBy', reportedByValue || 'Unknown');
      if (is100GramsSave) {
        formDataToSend.append('is100Grams', 'true');
      }

      if (qualityData.uploadFile) {
        formDataToSend.append('photo', qualityData.uploadFile);
      }

      const method = qualityRecordExists ? 'put' : 'post';
      await axios[method](
        `${API_URL}/sample-entries/${selectedEntry.id}/quality-parameters`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      showNotification(
        is100GramsSave ? '100 Grams Completed' : 'Quality parameters saved successfully',
        'success'
      );
      setShowQualityModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to save quality parameters', 'error');
    } finally {
      setIsSubmitting(false);
      releaseSubmissionLock(lockKey);
    }
  };

  const isPaddyResampleModal = !!selectedEntry
    && selectedEntry.entryType !== 'RICE_SAMPLE'
    && (selectedEntry.workflowStatus === 'QUALITY_CHECK' || selectedEntry.workflowStatus === 'LOT_ALLOTMENT')
    && selectedEntry.lotSelectionDecision === 'FAIL';
  const showQualityAsUpdate = hasExistingQualityData && !isPaddyResampleModal;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '15px',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', background: filterEntryType === 'RICE_SAMPLE' ? 'linear-gradient(135deg, #2e7d32, #43a047)' : 'linear-gradient(135deg, #2e7d32, #43a047)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>
          {filterEntryType === 'RICE_SAMPLE' ? '🍚 NEW RICE SAMPLE' : '🌾 NEW PADDY SAMPLE'}
        </h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {filterEntryType === 'RICE_SAMPLE' ? (
            <button
              onClick={() => {
                setSelectedEntryType('RICE_SAMPLE');
                setSampleCollectType('broker');
                setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '26 kg', sampleCollectedBy: 'Broker Office Sample', sampleGivenToOffice: false });
                setEditingEntry(null);
                setShowModal(true);
              }}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                backgroundColor: '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '0 2px 4px rgba(46,125,50,0.3)'
              }}
            >
              + New Rice Entry
            </button>
          ) : (
            <>
              {/* Mill Sample button - hidden for location staff */}
              {(user?.role !== 'staff' || user?.staffType !== 'location') && (
                <button
                  onClick={() => {
                    setSelectedEntryType('CREATE_NEW');
                    setSampleCollectType('broker');
                    setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '75', sampleCollectedBy: 'Broker Office Sample', sampleGivenToOffice: false });
                    setEditingEntry(null);
                    setShowModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(76,175,80,0.3)'
                  }}
                >
                  + New Mill Sample
                </button>
              )}
              {/* Ready Lorry button - hidden for location staff */}
              {(user?.role !== 'staff' || user?.staffType !== 'location') && (
                <button
                  onClick={() => {
                    setSelectedEntryType('DIRECT_LOADED_VEHICLE');
                    setSampleCollectType('broker');
                    setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '75', sampleCollectedBy: 'Broker Office Sample', sampleGivenToOffice: false });
                    setEditingEntry(null);
                    setShowModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(33,150,243,0.3)'
                  }}
                >
                  + Ready Lorry
                </button>
              )}
              {/* Location Sample button - hidden for mill staff */}
              {(user?.role !== 'staff' || user?.staffType !== 'mill') && (
                <button
                  onClick={() => {
                    setSelectedEntryType('LOCATION_SAMPLE');
                    setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '75', sampleCollectedBy: user?.username || '', sampleGivenToOffice: false });
                    setEditingEntry(null);
                    setShowModal(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(255,152,0,0.3)'
                  }}
                >
                  + Location Sample
                </button>
              )}
            </>
          )}
        </div>
      </div >

      {/* Filter Tabs */}
      < div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '15px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        {(['MILL_SAMPLE', 'LOCATION_SAMPLE', 'SAMPLE_BOOK'] as const)
          .filter((tab) => {
            // Rice Sample logic: No Location Sample tab
            if (filterEntryType === 'RICE_SAMPLE') return tab !== 'LOCATION_SAMPLE';

            const staffType = (user as any)?.staffType;
            if (user?.role !== 'staff' || !staffType) return true;
            // Mill staff: Mill Sample + Sample Book only (no Location Sample)
            if (staffType === 'mill') return tab === 'MILL_SAMPLE' || tab === 'SAMPLE_BOOK';
            // Location staff: all 3 tabs
            if (staffType === 'location') return true;
            return true;
          })
          .map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: activeTab === tab ? '3px solid #4a90e2' : '3px solid transparent',
                backgroundColor: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? '#4a90e2' : '#666',
                fontWeight: activeTab === tab ? '700' : '500',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px'
              }}
            >
              {filterEntryType === 'RICE_SAMPLE' ? (
                tab === 'MILL_SAMPLE' ? 'RICE SAMPLE' : tab === 'SAMPLE_BOOK' ? 'RICE SAMPLE BOOK' : tab
              ) : (
                tab === 'MILL_SAMPLE' ? 'MILL SAMPLE' : tab === 'LOCATION_SAMPLE' ? 'LOCATION SAMPLE' : 'PADDY SAMPLE BOOK'
              )}
            </button>
          ))}
      </div>

      {/* Collapsible Filter Bar */}
      <div style={{ marginBottom: '12px' }}>
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
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            backgroundColor: '#fff',
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid #e0e0e0'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>From Date</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>To Date</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Broker</label>
              <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                <option value="">All Brokers</option>
                {brokers.map((b, i) => <option key={i} value={b}>{b}</option>)}
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
      </div >

      {/* Entries Table */}
      <div className="table-container" style={{
        overflowX: 'auto',
        backgroundColor: 'white'
      }}>
        <style>{`
          .responsive-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            table-layout: fixed;
            border: 1px solid #000;
          }
          .responsive-table th, .responsive-table td {
            border: 1px solid #000;
            padding: 3px 4px;
          }
          @media (max-width: 768px) {
            .table-container {
               overflowX: 'visible';
            }
            .responsive-table, .responsive-table thead, .responsive-table tbody, .responsive-table th, .responsive-table td, .responsive-table tr { 
              display: block; 
            }
            .responsive-table thead tr { 
              position: absolute;
              top: -9999px;
              left: -9999px;
            }
            .responsive-table tr { border: 1px solid #ccc; margin-bottom: 10px; border-radius: 6px; overflow: hidden; }
            .responsive-table td { 
              border: none;
              border-bottom: 1px solid #eee; 
              position: relative;
              padding-left: 50% !important; 
              text-align: right !important;
              min-height: 28px;
            }
            .responsive-table td:before { 
              position: absolute;
              top: 4px;
              left: 6px;
              width: 45%; 
              padding-right: 10px; 
              white-space: nowrap;
              text-align: left;
              font-weight: 600;
              color: #555;
            }
            
            /* Label mapping for MS/RS/LS/RL variants */
            .responsive-table td:nth-of-type(1):before { content: "SL No"; }
            
             /* When "Type" column is present (Paddy) */
            .has-type-col td:nth-of-type(2):before { content: "Type"; }
            .has-type-col td:nth-of-type(3):before { content: "Bags"; }
            .has-type-col td:nth-of-type(4):before { content: "Pkg"; }
            .has-type-col td:nth-of-type(5):before { content: "Party Name"; }
            .has-type-col td:nth-of-type(6):before { content: "Location"; }
            .has-type-col td:nth-of-type(7):before { content: "Variety"; }
            .has-type-col td:nth-of-type(8):before { content: "Sample Reports"; }
            .has-type-col td:nth-of-type(9):before { content: "Collected By"; }

             /* When "Type" column is MISSING (Rice) */
            .no-type-col td:nth-of-type(2):before { content: "Bags"; }
            .no-type-col td:nth-of-type(3):before { content: "Pkg"; }
            .no-type-col td:nth-of-type(4):before { content: "Party Name"; }
            .no-type-col td:nth-of-type(5):before { content: "Location"; }
            .no-type-col td:nth-of-type(6):before { content: "Variety"; }
            .no-type-col td:nth-of-type(7):before { content: "Sample Reports"; }
            .no-type-col td:nth-of-type(8):before { content: "Collected By"; }
          }
        `}</style>
        {(() => {
          const filteredEntries = entries.filter((entry) => {
            // Tab filter
            if (activeTab === 'LOCATION_SAMPLE') {
              if (entry.entryType !== 'LOCATION_SAMPLE') return false;
              if ((entry as any).sampleGivenToOffice) return false; // If given to Mill, hide from Location Sample tab

              // Location staff only see their OWN entries OR entries assigned to them (resample)
              if (user?.role === 'physical_supervisor') {
                const isCreator = entry.createdByUserId === user?.id;
                const isAssigned = !!(entry.sampleCollectedBy && user?.username)
                  && entry.sampleCollectedBy.trim().toLowerCase() === user.username.trim().toLowerCase();
                if (!isCreator && !isAssigned) return false;
              }
            }
            if (activeTab === 'MILL_SAMPLE') {
              // Exclude Location Samples unless they are marked as 'given to office'
              if (entry.entryType === 'LOCATION_SAMPLE' && !(entry as any).sampleGivenToOffice) {
                return false;
              }

              if (filterEntryType === 'RICE_SAMPLE') {
                const qp = (entry as any).qualityParameters;
                const hasQuality = qp && qp.moisture != null && (
                  (qp.cutting1 && Number(qp.cutting1) !== 0) ||
                  (qp.bend1 && Number(qp.bend1) !== 0) ||
                  (qp.mix && Number(qp.mix) !== 0) ||
                  (qp.sk && Number(qp.sk) !== 0)
                );
                return !hasQuality;
              }

              // Hide if it's a resample that already has new quality saved
              const qp = (entry as any).qualityParameters;
              const resampleQualitySaved = filterEntryType !== 'RICE_SAMPLE' && entry.lotSelectionDecision === 'FAIL' && !!entry.lotSelectionAt && qp && getTimeValue(qp.updatedAt || qp.createdAt) >= getTimeValue(entry.lotSelectionAt);

              const isAssignedToCurrentStaff =
                user?.role !== 'staff'
                || (!!entry.sampleCollectedBy && !!user?.username && entry.sampleCollectedBy.trim().toLowerCase() === user.username.trim().toLowerCase());
              const isPendingPaddyResample = filterEntryType !== 'RICE_SAMPLE' && entry.lotSelectionDecision === 'FAIL' && entry.workflowStatus !== 'FAILED' && !resampleQualitySaved && !!entry.sampleCollectedBy && isAssignedToCurrentStaff;
              if (entry.workflowStatus !== 'STAFF_ENTRY' && !isPendingPaddyResample) return false;
            }
            if (activeTab === 'LOCATION_SAMPLE') {
              // Hide if it's a resample that already has new quality saved
              const qp = (entry as any).qualityParameters;
              const resampleQualitySaved = filterEntryType !== 'RICE_SAMPLE' && entry.lotSelectionDecision === 'FAIL' && !!entry.lotSelectionAt && qp && getTimeValue(qp.updatedAt || qp.createdAt) >= getTimeValue(entry.lotSelectionAt);
              // Also hide normal Location Samples once any quality is saved so they move to Sample Book
              const hasQuality = qp && qp.moisture != null;

              const isAssignedToCurrentStaff =
                user?.role !== 'staff'
                || (!!entry.sampleCollectedBy && !!user?.username && entry.sampleCollectedBy.trim().toLowerCase() === user.username.trim().toLowerCase());
              const isPendingPaddyResample = filterEntryType !== 'RICE_SAMPLE' && entry.lotSelectionDecision === 'FAIL' && entry.workflowStatus !== 'FAILED' && !resampleQualitySaved && !!entry.sampleCollectedBy && isAssignedToCurrentStaff;
              if (entry.workflowStatus !== 'STAFF_ENTRY' && !isPendingPaddyResample) return false;
              if (!isPendingPaddyResample && hasQuality) return false;
            }
            if (activeTab === 'SAMPLE_BOOK') {
              // Hide pending-resample entries from Sample Book — they should only appear in Location Sample tab
              // But always show genuinely FAILED entries (killed from Pending Selection) in Sample Book
              if (filterEntryType !== 'RICE_SAMPLE' && entry.lotSelectionDecision === 'FAIL' && entry.workflowStatus !== 'FAILED') {
                const qp = (entry as any).qualityParameters;
                const resampleQualitySaved = !!entry.lotSelectionAt && qp
                  && getTimeValue(qp.updatedAt || qp.createdAt) >= getTimeValue(entry.lotSelectionAt);
                if (!resampleQualitySaved) return false;
              }
              if (filterEntryType === 'RICE_SAMPLE') {
                // For Rice Book, only show items with some quality details filled (effectively hasQuality).
                // "Has quality" logic from below row rendering: moisture + (cutting or bend or mix)
                const qp = (entry as any).qualityParameters;
                const hasQuality = qp && qp.moisture != null && (
                  (qp.cutting1 && Number(qp.cutting1) !== 0) ||
                  (qp.bend1 && Number(qp.bend1) !== 0) ||
                  (qp.mix && Number(qp.mix) !== 0) ||
                  (qp.sk && Number(qp.sk) !== 0)
                );
                if (!hasQuality) return false;
              }
            }

            // Date and Broker filters are handled purely by the server-side API via loadEntries()
            return true;
          });

          // Group entries by date, then by broker within date
          const grouped: Record<string, Record<string, typeof filteredEntries>> = {};
          filteredEntries.forEach(entry => {
            const dateKey = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const brokerKey = entry.brokerName || 'Unknown';
            if (!grouped[dateKey]) grouped[dateKey] = {};
            if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
            grouped[dateKey][brokerKey].push(entry);
          });

          if (loading) {
            return <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>;
          }
          if (filteredEntries.length === 0) {
            return <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No entries found</div>;
          }


          return Object.entries(grouped).map(([dateKey, brokerGroups]) => {
            let brokerSeq = 0;
            return (
              <div key={dateKey} style={{ marginBottom: '20px' }}>
                {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                  brokerSeq++;
                  let slNo = 0;
                  return (
                    <div key={brokerName} style={{ marginBottom: '0px' }}>
                      {/* Date + Paddy Sample bar — only first broker */}
                      {brokerIdx === 0 && <div style={{
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        color: 'white',
                        padding: '6px 10px',
                        fontWeight: '700',
                        fontSize: '14px',
                        textAlign: 'center',
                        letterSpacing: '0.5px'
                      }}>
                        {(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                        &nbsp;&nbsp;{filterEntryType === 'RICE_SAMPLE' ? 'Rice Sample' : 'Paddy Sample'}
                      </div>}
                      {/* Broker name bar */}
                      <div style={{
                        background: '#e8eaf6',
                        color: '#000',
                        padding: '4px 10px',
                        fontWeight: '700',
                        fontSize: '13.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '800' }}>{brokerSeq}.</span> {toTitleCase(brokerName)}
                      </div>
                      <table className={`responsive-table ${filterEntryType === 'RICE_SAMPLE' ? 'no-type-col' : 'has-type-col'}`}>
                        <thead>
                          <tr style={{ backgroundColor: filterEntryType === 'RICE_SAMPLE' ? '#4a148c' : '#1a237e', color: 'white' }}>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>SL No</th>
                            {filterEntryType !== 'RICE_SAMPLE' && (
                              <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '4%' }}>Type</th>
                            )}
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Bags</th>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Pkg</th>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '16%' }}>Party Name</th>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '14%' }}>{filterEntryType === 'RICE_SAMPLE' ? 'Rice Location' : 'Paddy Location'}</th>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Variety</th>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '25%' }}>Sample Reports</th>
                            <th style={{ fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '14%' }}>Sample Collected By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...brokerEntries].sort((a, b) => {
                            const serialA = Number.isFinite(Number(a.serialNo)) ? Number(a.serialNo) : null;
                            const serialB = Number.isFinite(Number(b.serialNo)) ? Number(b.serialNo) : null;
                            if (serialA !== null && serialB !== null && serialA !== serialB) return serialA - serialB;
                            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                          }).map((entry, index) => {
                            slNo++;
                            const qp = (entry as any).qualityParameters;
                            const resampleAttempts = Math.max(0, Number((entry as any).qualityReportAttempts || 0));
                            const isPaddyResampleWorkflow =
                              filterEntryType !== 'RICE_SAMPLE'
                              && entry.lotSelectionDecision === 'FAIL'
                              && entry.workflowStatus !== 'FAILED';
                            const resampleQualitySaved =
                              isPaddyResampleWorkflow
                              && !!entry.lotSelectionAt
                              && qp
                              && getTimeValue(qp.updatedAt || qp.createdAt) >= getTimeValue(entry.lotSelectionAt);
                            const isPaddyResampleEntry = isPaddyResampleWorkflow && (!entry.lotSelectionAt || !resampleQualitySaved) && !!entry.sampleCollectedBy;
                            const hasQuality = qp && qp.moisture != null && ((qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0));
                            const has100Grams = entry.entryType !== 'RICE_SAMPLE' && qp && qp.moisture != null && !hasQuality;
                            const showResampleQualityCompleted = isPaddyResampleWorkflow && resampleQualitySaved && hasQuality;
                            const showResample100GramsCompleted = isPaddyResampleWorkflow && resampleQualitySaved && has100Grams;
                            const showDetailedQualityStatus = false;

                            // Location staff restriction: only the creator can enter/edit quality FOR LOCATION SAMPLES
                            const isLocationStaff = user?.role === 'physical_supervisor';
                            const isLocationSample = entry.entryType === 'LOCATION_SAMPLE';
                            const isEntryCreator = (entry as any).creator?.id === user?.id || (entry as any).createdByUserId === user?.id;
                            const isAssignedCollector = !!(entry.sampleCollectedBy && user?.username)
                              && entry.sampleCollectedBy.trim().toLowerCase() === user.username.trim().toLowerCase();
                            // Location staff can only edit Location Samples if they are the creator OR if it was assigned to them
                            const canEditQuality = !(isLocationStaff && isLocationSample) || isEntryCreator || isAssignedCollector;
                            const canAssignResample = ['admin', 'manager', 'owner'].includes(String(user?.role || '').toLowerCase());

                            const handleNextClick = () => {
                              handleViewEntry(entry);
                            };

                            return (
                              <tr key={entry.id} style={{ backgroundColor: isPaddyResampleWorkflow ? '#fff3e0' : entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffcc80' : '#ffffff', border: isPaddyResampleWorkflow ? '2px solid #f4a460' : undefined }}>
                                <td style={{ padding: '1px 4px', textAlign: 'center', fontWeight: '700', fontSize: '13px', verticalAlign: 'middle' }}>{slNo}</td>
                                {filterEntryType !== 'RICE_SAMPLE' && (
                                  <td style={{ padding: '1px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '700', lineHeight: '1.2', color: entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#1565c0' : entry.entryType === 'LOCATION_SAMPLE' ? '#e65100' : entry.entryType === 'RICE_SAMPLE' ? '#2e7d32' : '#333' }}>{entry.entryType === 'DIRECT_LOADED_VEHICLE' ? 'RL' : entry.entryType === 'LOCATION_SAMPLE' ? 'LS' : entry.entryType === 'RICE_SAMPLE' ? 'RS' : 'MS'}</td>
                                )}
                                <td style={{ padding: '1px 4px', textAlign: 'center', fontSize: '13px', fontWeight: '600', lineHeight: '1.2' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                <td style={{ padding: '1px 4px', textAlign: 'center', fontSize: '13px', lineHeight: '1.2' }}>{(() => {
                                  let pkg = String((entry as any).packaging || '75');
                                  if (pkg.toLowerCase() === '0' || pkg.toLowerCase() === 'loose') return 'Loose';
                                  if (pkg.toLowerCase().includes('kg')) return pkg;
                                  if (pkg.toLowerCase().includes('tons')) return pkg;
                                  return `${pkg} Kg`;
                                })()}</td>
                                <td style={{ padding: '1px 4px', textAlign: 'left', fontSize: '14px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {(() => {
                                    const party = (entry.partyName || '').trim();
                                    const lorry = (entry as any).lorryNumber ? String((entry as any).lorryNumber).toUpperCase() : '';
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
                                <td style={{ padding: '1px 4px', textAlign: 'left', fontSize: '14px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.location)}</td>

                                <td style={{ padding: '1px 4px', textAlign: 'left', fontSize: '14px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {toTitleCase(entry.variety)}
                                  {isPaddyResampleEntry && <span style={{ marginLeft: '3px', color: '#f59e0b', fontSize: '11px' }} title='Re-sample pending'>&#8634;</span>}
                                  {hasQuality && <span style={{ marginLeft: '3px', color: '#27ae60', fontSize: '11px' }} title="Quality Completed">✅</span>}
                                  {has100Grams && <span style={{ marginLeft: '3px', color: '#e65100', fontSize: '11px' }} title="100g Completed">⚡</span>}
                                </td>
                                <td style={{ padding: '0px 2px', textAlign: 'left', lineHeight: '1.1' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>

                                    {isPaddyResampleWorkflow && entry.lotSelectionDecision === 'FAIL' && !entry.sampleCollectedBy && canAssignResample ? (
                                      <div style={{ display: 'flex', gap: '4px', flexDirection: 'column', width: '100%', padding: '2px 0' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#c62828' }}>Assign Supervisor:</div>
                                        <select
                                          value={assignments[entry.id] ?? ''}
                                          onChange={(e) => setAssignments(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                          style={{ padding: '2px 4px', fontSize: '10px', borderRadius: '3px', border: '1px solid #ccc' }}
                                        >
                                          <option value="">Select Staff</option>
                                          {locationSupervisors.map(sup => <option key={sup.id} value={sup.username}>{sup.username}</option>)}
                                        </select>
                                        <button
                                          onClick={async () => {
                                            const selected = assignments[entry.id];
                                            if (!selected) {
                                              showNotification('Select a supervisor to assign', 'error');
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
                                              showNotification('Resample user assigned successfully', 'success');
                                              const res = await axios.get(`${API_URL}/sample-entries/sample-book`, {
                                                params: {
                                                  page,
                                                  pageSize: PAGE_SIZE,
                                                  ...(filterDateFrom && { startDate: filterDateFrom }),
                                                  ...(filterDateTo && { endDate: filterDateTo }),
                                                  ...(filterBroker && { broker: filterBroker })
                                                },
                                                headers: { Authorization: `Bearer ${token}` }
                                              });
                                              const data = res.data as any;
                                              setEntries(data.entries || []);
                                            } catch (error: any) {
                                              showNotification(error.response?.data?.error || 'Failed to assign user', 'error');
                                            }
                                          }}
                                          style={{
                                            padding: '3px',
                                            background: '#1976d2',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Assign
                                        </button>
                                      </div>
                                    ) : isPaddyResampleWorkflow && entry.lotSelectionDecision === 'FAIL' && !entry.sampleCollectedBy ? (
                                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#c62828' }}>Pending Supervisor Assignment</span>
                                    ) : isPaddyResampleEntry && canEditQuality ? (
                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-start' }}>
                                        <button
                                          onClick={() => handleNextClick()}
                                          style={{
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            backgroundColor: '#f4c542',
                                            color: '#4a3b00',
                                            border: '1px solid #c89d0e',
                                            borderRadius: '2px',
                                            cursor: 'pointer',
                                            fontWeight: '700'
                                          }}
                                        >
                                          Next {'>'}
                                        </button>
                                        <button
                                          onClick={() => handleEditEntry(entry)}
                                          title="Edit Entry"
                                          style={{
                                            fontSize: '9px',
                                            padding: '2px 5px',
                                            backgroundColor: '#2980b9',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                          }}
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    ) : has100Grams ? (
                                      <>
                                        <span
                                          onClick={() => canEditQuality ? setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id) : null}
                                          style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: showResample100GramsCompleted ? '#fff3cd' : '#ffeb3b', color: showResample100GramsCompleted ? '#8a4b00' : '#333', borderRadius: '3px', fontWeight: '700', border: showResample100GramsCompleted ? '1.5px solid #f0ad4e' : '1.5px solid #f9a825', cursor: canEditQuality ? 'pointer' : 'default' }}
                                        >⚡ 100-Gms Completed</span>
                                        {canEditQuality && expandedEntryId === entry.id && (
                                          <div style={{ width: '100%', display: 'flex', gap: '4px', marginTop: '2px', justifyContent: 'flex-start' }}>
                                            <button onClick={() => handleViewEntry(entry)} title="Edit Quality" style={{ fontSize: '10px', padding: '3px 6px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: '600' }}>Edit Qlty</button>
                                            <button onClick={() => handleEditEntry(entry)} title="Edit Entry" style={{ fontSize: '10px', padding: '3px 6px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: '600' }}>Edit</button>
                                          </div>
                                        )}
                                      </>
                                    ) : hasQuality ? (
                                      <>
                                        <div
                                          onClick={() => canEditQuality ? setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id) : null}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            gap: '2px',
                                            cursor: canEditQuality ? 'pointer' : 'default'
                                          }}
                                        >
                                          {showDetailedQualityStatus ? (
                                            qualityAttemptLabels.map((label: string, idx: number) => (
                                              <span
                                                key={`${entry.id}-quality-label-${idx}`}
                                                style={{
                                                  fontSize: '10px',
                                                  padding: '2px 6px',
                                                  backgroundColor: idx === 0 ? '#e8f5e9' : '#ccfbf1',
                                                  color: idx === 0 ? '#2e7d32' : '#115e59',
                                                  borderRadius: '10px',
                                                  fontWeight: '700',
                                                  border: idx === 0 ? '1.5px solid #66bb6a' : '1.5px solid #14b8a6',
                                                  whiteSpace: 'nowrap'
                                                }}
                                              >
                                                {label}
                                              </span>
                                            ))
                                          ) : (
                                            <span
                                              style={{
                                                fontSize: '11px',
                                                padding: '3px 8px',
                                                backgroundColor: showResampleQualityCompleted ? '#ccfbf1' : '#e8f5e9',
                                                color: showResampleQualityCompleted ? '#115e59' : '#2e7d32',
                                                borderRadius: '3px',
                                                fontWeight: '700',
                                                border: showResampleQualityCompleted ? '1.5px solid #14b8a6' : '1.5px solid #66bb6a'
                                              }}
                                            >
                                              ✓ Quality Completed
                                            </span>
                                          )}
                                        </div>

                                        {canEditQuality && expandedEntryId === entry.id && (
                                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-start' }}>
                                            <button
                                              onClick={() => handleViewEntry(entry)}
                                              title="Edit Quality Parameters"
                                              style={{
                                                fontSize: '9px',
                                                padding: '2px 5px',
                                                backgroundColor: '#e67e22',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              Edit Qlty
                                            </button>
                                            <button
                                              onClick={() => handleEditEntry(entry)}
                                              title="Edit Entry"
                                              style={{
                                                fontSize: '9px',
                                                padding: '2px 5px',
                                                backgroundColor: '#2980b9',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '2px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              Edit
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    ) : canEditQuality ? (
                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-start' }}>
                                        <button
                                          onClick={() => handleNextClick()}
                                          style={{
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            backgroundColor: '#c62828',
                                            color: 'white',
                                            border: '1px solid #8e0000',
                                            borderRadius: '2px',
                                            cursor: 'pointer',
                                            fontWeight: '700'
                                          }}
                                        >
                                          Next {'>'}
                                        </button>
                                        <button
                                          onClick={() => handleEditEntry(entry)}
                                          title="Edit Entry"
                                          style={{
                                            fontSize: '9px',
                                            padding: '2px 5px',
                                            backgroundColor: '#2980b9',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            cursor: 'pointer',
                                            fontWeight: '600'
                                          }}
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#f5f5f5', color: '#999', borderRadius: '3px', fontWeight: '600' }}>Pending</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '1px 8px', textAlign: 'left', fontSize: '11px', lineHeight: '1.2', verticalAlign: 'middle' }}>
                                  {entry.sampleCollectedBy ? toTitleCase(entry.sampleCollectedBy) : ((entry as any).creator?.username ? toTitleCase((entry as any).creator.username) : '-')}
                                </td>
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
        })()}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '15px',
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '6px 12px',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              backgroundColor: page === 1 ? '#eee' : '#3498db',
              color: page === 1 ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalEntries} entries)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '6px 12px',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              backgroundColor: page === totalPages ? '#eee' : '#3498db',
              color: page === totalPages ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Modal - Full Screen */}
      {
        showModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            zIndex: 9999,
            padding: '20px',
            overflowY: 'auto'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid #ddd',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                background: selectedEntryType === 'CREATE_NEW' ? 'linear-gradient(135deg, #2ecc71, #27ae60)' :
                  selectedEntryType === 'DIRECT_LOADED_VEHICLE' ? 'linear-gradient(135deg, #3498db, #2980b9)' :
                    'linear-gradient(135deg, #e67e22, #d35400)',
                padding: '10px 15px',
                borderRadius: '8px 8px 0 0',
                marginBottom: '10px',
                marginTop: '-15px',
                marginLeft: '-15px',
                marginRight: '-15px',
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '700',
                  color: 'white',
                  letterSpacing: '0.5px'
                }}>
                  {selectedEntryType === 'CREATE_NEW' ? '🌾 NEW PADDY SAMPLE' : selectedEntryType === 'DIRECT_LOADED_VEHICLE' ? '🚛 READY LORRY' : selectedEntryType === 'RICE_SAMPLE' ? '🍚 NEW RICE SAMPLE' : '📍 LOCATION SAMPLE'}
                </h3>
              </div>
              <form onSubmit={handleSubmitWithConfirm}>
                {/* 1. Date */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Date</label>
                  <input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                    required
                  />
                </div>

                {/* 2. Broker Name */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Broker Name</label>
                  <select
                    value={formData.brokerName}
                    onChange={(e) => setFormData({ ...formData, brokerName: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer' }}
                    required
                  >
                    <option value="">-- Select Broker --</option>
                    {brokers.map((broker, index) => (
                      <option key={index} value={broker}>{toTitleCase(broker)}</option>
                    ))}
                  </select>
                </div>

                {/* Lorry Number (only for READY LORRY) — right after Broker Name */}
                {selectedEntryType === 'DIRECT_LOADED_VEHICLE' && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Lorry Number</label>
                    <input
                      type="text"
                      value={formData.lorryNumber}
                      onChange={(e) => handleInputChange('lorryNumber', e.target.value)}
                      maxLength={11}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', textTransform: 'capitalize' }}
                    />
                  </div>
                )}

                {/* 3. Bags - validation based on packaging */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>
                    Bags
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.bags}
                    onChange={(e) => {
                      const maxDigits = formData.packaging === '75' ? 4 : 5;
                      const val = e.target.value.replace(/[^0-9]/g, '').substring(0, maxDigits);
                      setFormData({ ...formData, bags: val });
                    }}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                    required
                  />
                </div>

                {/* 4. Packaging - dynamic based on entryType */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Packaging</label>
                  {selectedEntryType === 'RICE_SAMPLE' ? (
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" name="packaging" value="26 kg" checked={formData.packaging === '26 kg'} onChange={() => {
                          setFormData({ ...formData, packaging: '26 kg' });
                        }} style={{ accentColor: '#4a90e2' }} />
                        26 Kg
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" name="packaging" value="50 kg" checked={formData.packaging === '50 kg'} onChange={() => {
                          setFormData({ ...formData, packaging: '50 kg' });
                        }} style={{ accentColor: '#4a90e2' }} />
                        50 Kg
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" name="packaging" value="Tons" checked={formData.packaging === 'Tons'} onChange={() => {
                          setFormData({ ...formData, packaging: 'Tons' });
                        }} style={{ accentColor: '#4a90e2' }} />
                        Tons
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" name="packaging" value="Loose" checked={formData.packaging === 'Loose'} onChange={() => {
                          setFormData({ ...formData, packaging: 'Loose' });
                        }} style={{ accentColor: '#4a90e2' }} />
                        Loose
                      </label>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" name="packaging" value="75" checked={formData.packaging === '75'} onChange={() => {
                          setFormData({ ...formData, packaging: '75', bags: formData.bags.substring(0, 4) });
                        }} style={{ accentColor: '#4a90e2' }} />
                        75 Kg
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" name="packaging" value="40" checked={formData.packaging === '40'} onChange={() => {
                          setFormData({ ...formData, packaging: '40' });
                        }} style={{ accentColor: '#4a90e2' }} />
                        40 Kg
                      </label>
                    </div>
                  )}
                </div>

                {/* 5. Variety — moved before Party Name */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Variety</label>
                  <select
                    value={formData.variety}
                    onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer' }}
                    required
                  >
                    <option value="">-- Select Variety --</option>
                    {varieties.map((variety, index) => (
                      <option key={index} value={variety}>{toTitleCase(variety)}</option>
                    ))}
                  </select>
                </div>

                {/* 6. Party Name — NOT for Ready Lorry */}
                {selectedEntryType !== 'DIRECT_LOADED_VEHICLE' && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Party Name</label>
                    <input
                      type="text"
                      value={formData.partyName}
                      onChange={(e) => handleInputChange('partyName', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', textTransform: 'capitalize' }}
                      required
                    />
                  </div>
                )}

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>{selectedEntryType === 'RICE_SAMPLE' ? 'Rice Location' : 'Paddy Location'}</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                    required
                  />
                </div>

                {/* 8. Sample Collected By — Radio UI for Mill Sample and Rice Sample */}
                {(selectedEntryType === 'CREATE_NEW' || selectedEntryType === 'RICE_SAMPLE') && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: '#333', fontSize: '13px' }}>
                      Sample Collected By
                    </label>
                    {/* Radio Options */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                        <input
                          type="radio"
                          name="sampleCollectType"
                          checked={sampleCollectType === 'broker'}
                          onChange={() => {
                            setSampleCollectType('broker');
                            setFormData(prev => ({ ...prev, sampleCollectedBy: 'Broker Office Sample' }));
                          }}
                          style={{ accentColor: '#e65100' }}
                        />
                        <span style={{ color: '#e65100', fontWeight: '700' }}>Broker</span>
                        <span style={{ color: '#e65100', fontWeight: '700' }}>Office</span>
                        <span style={{ color: '#e65100', fontWeight: '700' }}>Sample</span>
                      </label>
                    </div>

                    {/* Second option: Mill Gumasta / Paddy Supervisor — mutually exclusive */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                      <input
                        type="radio"
                        name="sampleCollectType"
                        checked={sampleCollectType === 'supervisor'}
                        onChange={() => {
                          setSampleCollectType('supervisor');
                          setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                        }}
                        style={{ accentColor: '#1565c0', marginTop: '4px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '4px', display: 'block' }}>Paddy Staff Name</label>

                        {/* Dropdown: Paddy Supervisor — hidden when manual text has been typed */}
                        {paddySupervisors.length > 0 && !(sampleCollectType === 'supervisor' && formData.sampleCollectedBy && !paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy)) && (
                          <select
                            value={sampleCollectType === 'supervisor' && paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy) ? formData.sampleCollectedBy : ''}
                            onChange={(e) => {
                              setSampleCollectType('supervisor');
                              setFormData(prev => ({ ...prev, sampleCollectedBy: e.target.value }));
                            }}
                            onFocus={() => {
                              if (sampleCollectType !== 'supervisor') {
                                setSampleCollectType('supervisor');
                                setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                              }
                            }}
                            disabled={sampleCollectType !== 'supervisor'}
                            style={{
                              width: '100%', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px',
                              backgroundColor: sampleCollectType === 'supervisor' ? 'white' : '#f5f5f5',
                              cursor: sampleCollectType === 'supervisor' ? 'pointer' : 'not-allowed',
                              marginBottom: '4px'
                            }}
                          >
                            <option value="">-- Select from list --</option>
                            {paddySupervisors.map(s => (
                              <option key={s.id} value={toTitleCase(s.username)}>{toTitleCase(s.username)}</option>
                            ))}
                          </select>
                        )}

                        {/* Manual text input — hidden when dropdown has a value selected */}
                        {!(sampleCollectType === 'supervisor' && paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy)) && (
                          <input
                            type="text"
                            value={sampleCollectType === 'supervisor' && !paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy) ? formData.sampleCollectedBy : ''}
                            onChange={(e) => {
                              setSampleCollectType('supervisor');
                              setFormData(prev => ({ ...prev, sampleCollectedBy: e.target.value }));
                            }}
                            onFocus={() => {
                              if (sampleCollectType !== 'supervisor') {
                                setSampleCollectType('supervisor');
                                setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                              }
                            }}
                            placeholder="Or type name manually"
                            disabled={sampleCollectType !== 'supervisor'}
                            style={{
                              width: '100%', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px',
                              backgroundColor: sampleCollectType === 'supervisor' ? 'white' : '#f5f5f5',
                              textTransform: 'capitalize'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Lorry Sample Collected By — Broker / Gumasta toggle for Ready Lorry */}
                {selectedEntryType === 'DIRECT_LOADED_VEHICLE' && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: '#333', fontSize: '13px' }}>
                      Lorry Sample Collected By
                    </label>
                    {/* Radio Options */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                        <input
                          type="radio"
                          name="readyLorrySampleCollectType"
                          checked={sampleCollectType === 'broker'}
                          onChange={() => {
                            setSampleCollectType('broker');
                            setFormData(prev => ({ ...prev, sampleCollectedBy: 'Broker Office Sample' }));
                          }}
                          style={{ accentColor: '#e65100' }}
                        />
                        <span style={{ color: '#e65100', fontWeight: '700' }}>Broker</span>
                        <span style={{ color: '#e65100', fontWeight: '700' }}>Office</span>
                        <span style={{ color: '#e65100', fontWeight: '700' }}>Sample</span>
                      </label>
                    </div>

                    {/* Second option: Mill Gumasta / Paddy Supervisor */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                      <input
                        type="radio"
                        name="readyLorrySampleCollectType"
                        checked={sampleCollectType === 'supervisor'}
                        onChange={() => {
                          setSampleCollectType('supervisor');
                          setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                        }}
                        style={{ accentColor: '#1565c0', marginTop: '4px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '4px', display: 'block' }}>Paddy Staff Name</label>

                        {/* Dropdown: Paddy Supervisor */}
                        {paddySupervisors.length > 0 && !(sampleCollectType === 'supervisor' && formData.sampleCollectedBy && !paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy)) && (
                          <select
                            value={sampleCollectType === 'supervisor' && paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy) ? formData.sampleCollectedBy : ''}
                            onChange={(e) => {
                              setSampleCollectType('supervisor');
                              setFormData(prev => ({ ...prev, sampleCollectedBy: e.target.value }));
                            }}
                            onFocus={() => {
                              if (sampleCollectType !== 'supervisor') {
                                setSampleCollectType('supervisor');
                                setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                              }
                            }}
                            disabled={sampleCollectType !== 'supervisor'}
                            style={{
                              width: '100%', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px',
                              backgroundColor: sampleCollectType === 'supervisor' ? 'white' : '#f5f5f5',
                              cursor: sampleCollectType === 'supervisor' ? 'pointer' : 'not-allowed',
                              marginBottom: '4px'
                            }}
                          >
                            <option value="">-- Select from list --</option>
                            {paddySupervisors.map(s => (
                              <option key={s.id} value={toTitleCase(s.username)}>{toTitleCase(s.username)}</option>
                            ))}
                          </select>
                        )}

                        {/* Manual text input */}
                        {!(sampleCollectType === 'supervisor' && paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy)) && (
                          <input
                            type="text"
                            value={sampleCollectType === 'supervisor' && !paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy) ? formData.sampleCollectedBy : ''}
                            onChange={(e) => {
                              setSampleCollectType('supervisor');
                              setFormData(prev => ({ ...prev, sampleCollectedBy: e.target.value }));
                            }}
                            onFocus={() => {
                              if (sampleCollectType !== 'supervisor') {
                                setSampleCollectType('supervisor');
                                setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                              }
                            }}
                            placeholder="Or type name manually"
                            disabled={sampleCollectType !== 'supervisor'}
                            style={{
                              width: '100%', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px',
                              backgroundColor: sampleCollectType === 'supervisor' ? 'white' : '#f5f5f5',
                              textTransform: 'capitalize'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sample Given To — only for LOCATION SAMPLE */}
                {selectedEntryType === 'LOCATION_SAMPLE' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Sample Collected By</label>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#555' }}>
                        <input
                          type="radio"
                          name="sampleGivenTo"
                          checked={!formData.sampleGivenToOffice}
                          onChange={() => setFormData({ ...formData, sampleGivenToOffice: false, sampleCollectedBy: user?.username || '' })}
                          style={{ accentColor: '#4a90e2', cursor: 'pointer' }}
                        />
                        Taken By
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#555' }}>
                        <input
                          type="radio"
                          name="sampleGivenTo"
                          checked={formData.sampleGivenToOffice === true}
                          onChange={() => setFormData({ ...formData, sampleGivenToOffice: true })}
                          style={{ accentColor: '#4a90e2', cursor: 'pointer' }}
                        />
                        Given to Office
                      </label>
                    </div>
                    {/* If Given to Staff — show Staff Name input */}
                    {!formData.sampleGivenToOffice && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Staff Name</label>
                        <input
                          type="text"
                          value={formData.sampleCollectedBy || user?.username || ''}
                          disabled
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', textTransform: 'uppercase', backgroundColor: '#f0f0f0', cursor: 'not-allowed', fontWeight: '600', color: '#333' }}
                        />
                      </div>
                    )}
                    {formData.sampleGivenToOffice && (
                      <p style={{ margin: '0', fontSize: '11px', color: '#4CAF50', fontWeight: '500' }}>
                        ✓ This entry will also appear in MILL SAMPLE tab
                      </p>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      border: '1px solid #ddd',
                      borderRadius: '3px',
                      backgroundColor: 'white',
                      fontSize: '13px',
                      color: '#666'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '13px'
                    }}
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Quality Parameters Modal */}
      {
        showQualityModal && selectedEntry && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '80px 20px 20px 20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '460px',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              border: '1px solid #e0e0e0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
            }}>
              <h3 style={{
                marginTop: 0,
                marginBottom: '10px',
                fontSize: '15px',
                fontWeight: '700',
                color: 'white',
                background: selectedEntry.entryType === 'RICE_SAMPLE' ? 'linear-gradient(135deg, #1565c0, #0d47a1)' : 'linear-gradient(135deg, #2e7d32, #1b5e20)',
                padding: '10px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {selectedEntry.entryType === 'RICE_SAMPLE'
                  ? (showQualityAsUpdate ? 'Edit Rice Quality Parameters' : 'Rice Quality Parameters')
                  : (isPaddyResampleModal ? 'Re-Sample Quality Parameters' : (showQualityAsUpdate ? 'Edit Quality Parameters' : 'Add Quality Parameters'))}
              </h3>

              {/* Entry Details */}
              <div style={{
                backgroundColor: '#e8eaf6',
                padding: '8px 10px',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '11px',
                border: '1px solid #c5cae9'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                  <div><strong style={{ color: '#1a237e' }}>Broker:</strong> {toTitleCase(selectedEntry.brokerName)}</div>
                  <div><strong style={{ color: '#1a237e' }}>Variety:</strong> {toTitleCase(selectedEntry.variety)}</div>
                  <div><strong style={{ color: '#1a237e' }}>Party:</strong> {toTitleCase(selectedEntry.partyName)}</div>
                  <div><strong style={{ color: '#1a237e' }}>Bags:</strong> {selectedEntry.bags?.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <form onSubmit={handleSubmitQualityParametersWithConfirm}>
                {selectedEntry.entryType === 'RICE_SAMPLE' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 10px', alignItems: 'start', marginBottom: '10px' }}>
                      {/* Row 1: Moisture, Grains Count, Broken (mix) */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Moisture <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" required value={qualityData.moisture}
                          onChange={(e) => handleQualityInput('moisture', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Grains Count <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" value={qualityData.grainsCount}
                          onChange={(e) => handleQualityInput('grainsCount', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Broken <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.mix}
                          onChange={(e) => handleQualityInput('mix', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>

                      {/* Row 2: Rice 1× (cutting), Bend 1×, Line Mix (sk) */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Rice <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="text" value={qualityData.cutting}
                          onChange={(e) => handleCuttingInput(e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Bend <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="text" value={qualityData.bend}
                          onChange={(e) => handleBendInput(e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Mix <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.sk}
                          onChange={(e) => handleQualityInput('sk', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>

                      {/* Row 3: SMix, LMix, Grams Report */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <label style={{ fontWeight: '600', color: '#333', fontSize: '11px', whiteSpace: 'nowrap' }}>SMix</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <input type="radio" name="smixEnabled" checked={smixEnabled} onChange={() => { setSmixEnabled(true); if (!qualityData.mixS) setQualityData(q => ({ ...q, mixS: '' })); }} style={{ margin: 0 }} /> Y
                            </label>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <input type="radio" name="smixEnabled" checked={!smixEnabled} onChange={() => { setSmixEnabled(false); setQualityData(q => ({ ...q, mixS: '' })); }} style={{ margin: 0 }} /> N
                            </label>
                          </div>
                        </div>
                        {smixEnabled && (
                          <input type="number" step="0.01" value={qualityData.mixS}
                            onChange={(e) => handleQualityInput('mixS', e.target.value)}
                            style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <label style={{ fontWeight: '600', color: '#333', fontSize: '11px', whiteSpace: 'nowrap' }}>LMix</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <input type="radio" name="lmixEnabled" checked={lmixEnabled} onChange={() => { setLmixEnabled(true); if (!qualityData.mixL) setQualityData(q => ({ ...q, mixL: '' })); }} style={{ margin: 0 }} /> Y
                            </label>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <input type="radio" name="lmixEnabled" checked={!lmixEnabled} onChange={() => { setLmixEnabled(false); setQualityData(q => ({ ...q, mixL: '' })); }} style={{ margin: 0 }} /> N
                            </label>
                          </div>
                        </div>
                        {lmixEnabled && (
                          <input type="number" step="0.01" value={qualityData.mixL}
                            onChange={(e) => handleQualityInput('mixL', e.target.value)}
                            style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px', whiteSpace: 'nowrap' }}>Grams Report <span style={{ color: '#e53935' }}>*</span></label>
                        <select
                          value={qualityData.gramsReport || '10gms'}
                          onChange={(e) => setQualityData({ ...qualityData, gramsReport: e.target.value })}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', backgroundColor: 'white' }}
                        >
                          <option value="10gms">10 gms</option>
                          <option value="5gms">5 gms</option>
                        </select>
                      </div>

                      {/* Row 4: Kandu, Oil */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Kandu <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.kandu}
                          onChange={(e) => handleQualityInput('kandu', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Oil <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.oil}
                          onChange={(e) => handleQualityInput('oil', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* ── All Fields in one 3-column grid ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 10px', alignItems: 'start', marginBottom: '10px' }}>
                      {/* Row 1: Moisture, Dry Moisture, Grains Count */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Moisture <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" required value={qualityData.moisture}
                          onChange={(e) => handleQualityInput('moisture', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                          <label style={{ fontWeight: '600', color: '#333', fontSize: '11px', whiteSpace: 'nowrap' }}>Dry Moisture</label>
                          <label style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="dryMoistureEnabled" checked={dryMoistureEnabled} onChange={() => { setDryMoistureEnabled(true); setQualityData({ ...qualityData, dryMoisture: '' }); }} style={{ margin: 0 }} /> Y
                          </label>
                          <label style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="dryMoistureEnabled" checked={!dryMoistureEnabled} onChange={() => { setDryMoistureEnabled(false); setQualityData({ ...qualityData, dryMoisture: '' }); }} style={{ margin: 0 }} /> N
                          </label>
                        </div>
                        <input type="number" step="0.01" value={qualityData.dryMoisture}
                          onChange={(e) => handleQualityInput('dryMoisture', e.target.value)}
                          disabled={!dryMoistureEnabled}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', visibility: dryMoistureEnabled ? 'visible' : 'hidden' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Grains Count <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" value={qualityData.grainsCount}
                          onChange={(e) => handleQualityInput('grainsCount', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>

                      {/* Row 2: Cutting, Bend, Mix */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Cutting <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="text" value={qualityData.cutting} placeholder="1×"
                          onFocus={() => { if (!qualityData.cutting) handleCuttingInput('1×'); }}
                          onChange={(e) => handleCuttingInput(e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', fontWeight: '700', letterSpacing: '1px', textAlign: 'center' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Bend <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="text" value={qualityData.bend} placeholder="1×"
                          onFocus={() => { if (!qualityData.bend) handleBendInput('1×'); }}
                          onChange={(e) => handleBendInput(e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', fontWeight: '700', letterSpacing: '1px', textAlign: 'center' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Mix <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.mix}
                          onChange={(e) => handleQualityInput('mix', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>

                      {/* Row 3: SMix, LMix, SK */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                          <label style={{ fontWeight: '600', color: '#333', fontSize: '11px', whiteSpace: 'nowrap' }}>SMix</label>
                          <label style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="smixEnabled" checked={smixEnabled} onChange={() => { setSmixEnabled(true); setQualityData({ ...qualityData, mixS: '' }); }} style={{ margin: 0 }} /> Y
                          </label>
                          <label style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="smixEnabled" checked={!smixEnabled} onChange={() => { setSmixEnabled(false); setQualityData({ ...qualityData, mixS: '' }); }} style={{ margin: 0 }} /> N
                          </label>
                        </div>
                        <input type="number" step="0.01" value={qualityData.mixS}
                          onChange={(e) => handleQualityInput('mixS', e.target.value)}
                          disabled={!smixEnabled}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', visibility: smixEnabled ? 'visible' : 'hidden' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                          <label style={{ fontWeight: '600', color: '#333', fontSize: '11px', whiteSpace: 'nowrap' }}>LMix</label>
                          <label style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="lmixEnabled" checked={lmixEnabled} onChange={() => { setLmixEnabled(true); setQualityData({ ...qualityData, mixL: '' }); }} style={{ margin: 0 }} /> Y
                          </label>
                          <label style={{ fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input type="radio" name="lmixEnabled" checked={!lmixEnabled} onChange={() => { setLmixEnabled(false); setQualityData({ ...qualityData, mixL: '' }); }} style={{ margin: 0 }} /> N
                          </label>
                        </div>
                        <input type="number" step="0.01" value={qualityData.mixL}
                          onChange={(e) => handleQualityInput('mixL', e.target.value)}
                          disabled={!lmixEnabled}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', visibility: lmixEnabled ? 'visible' : 'hidden' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>SK <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.sk}
                          onChange={(e) => handleQualityInput('sk', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>

                      {/* Row 4: Kandu, Oil */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Kandu <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.kandu}
                          onChange={(e) => handleQualityInput('kandu', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Oil <span style={{ color: '#e53935' }}>*</span></label>
                        <input type="number" step="0.01" value={qualityData.oil}
                          onChange={(e) => handleQualityInput('oil', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                      </div>
                      <div></div>
                    </div>

                    {/* ── Section 3: WB Parameters ── */}
                    <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f0f7ff', borderRadius: '6px', border: '1px solid #d0e3f7' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#1565c0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #bbdefb', paddingBottom: '4px' }}>WB Parameters</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 10px', alignItems: 'start' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '2px', fontWeight: '600', color: '#333', fontSize: '11px' }}>WB (R) & WB (BK)</label>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input type="radio" name="wbEnabled" checked={wbEnabled} onChange={() => { setWbEnabled(true); setQualityData({ ...qualityData, wbR: qualityData.wbR || '', wbBk: qualityData.wbBk || '' }); }} /> Yes
                            </label>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input type="radio" name="wbEnabled" checked={!wbEnabled} onChange={() => { setWbEnabled(false); setQualityData({ ...qualityData, wbR: '', wbBk: '' }); }} /> No
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', visibility: wbEnabled ? 'visible' : 'hidden' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '9px' }}>R</label>
                              <input type="number" step="0.01" value={qualityData.wbR}
                                onChange={(e) => handleQualityInput('wbR', e.target.value)}
                                disabled={!wbEnabled}
                                style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '9px' }}>BK</label>
                              <input type="number" step="0.01" value={qualityData.wbBk}
                                onChange={(e) => handleQualityInput('wbBk', e.target.value)}
                                disabled={!wbEnabled}
                                style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>WB (T) — Auto</label>
                          <input type="number" step="0.01" readOnly value={qualityData.wbT}
                            style={{ width: '100%', padding: '6px', border: '1px solid #a5d6a7', borderRadius: '4px', fontSize: '12px', backgroundColor: '#e8f5e9', fontWeight: '700', cursor: 'not-allowed', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Paddy WB</label>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input type="radio" name="paddyWbEnabled" checked={paddyWbEnabled} onChange={() => { setPaddyWbEnabled(true); setQualityData({ ...qualityData, paddyWb: '' }); }} /> Yes
                            </label>
                            <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <input type="radio" name="paddyWbEnabled" checked={!paddyWbEnabled} onChange={() => { setPaddyWbEnabled(false); setQualityData({ ...qualityData, paddyWb: '' }); }} /> No
                            </label>
                          </div>
                          <input type="number" step="0.01" value={qualityData.paddyWb}
                            onChange={(e) => handleQualityInput('paddyWb', e.target.value)}
                            disabled={!paddyWbEnabled}
                            style={{ width: '100%', padding: '5px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', visibility: paddyWbEnabled ? 'visible' : 'hidden' }} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {/* Upload & Sample Collected By */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>
                      Upload Photo <span style={{ color: '#999', fontWeight: '400' }}>(Optional)</span>
                    </label>
                    <input type="file" accept="image/*"
                      onChange={(e) => setQualityData({ ...qualityData, uploadFile: e.target.files?.[0] || null })}
                      style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>
                      Sample Reported By <span style={{ color: '#e53935' }}>*</span>
                    </label>
                    {selectedEntry?.entryType === 'LOCATION_SAMPLE' ? (
                      <input type="text" readOnly value={user?.username || 'Unknown'}
                        style={{ width: '100%', padding: '6px', border: '1.5px solid #ccc', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', backgroundColor: '#f5f5f5', fontWeight: '600', cursor: 'not-allowed' }} />
                    ) : (
                      <select
                        value={isRiceQualityEntry ? (qualityData.reportedBy || riceReportedByOptions[0] || '') : (qualityData.reportedBy || qualityUsers[0] || '')}
                        onChange={(e) => setQualityData({ ...qualityData, reportedBy: toTitleCase(e.target.value) })}
                        style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', fontWeight: '600' }}
                      >
                        {(isRiceQualityEntry ? riceReportedByOptions : qualityUsers).map((qName, idx) => (
                          <option key={idx} value={qName}>{toTitleCase(qName)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
                  <button type="button"
                    onClick={() => { setShowQualityModal(false); setSelectedEntry(null); }}
                    style={{ padding: '8px 18px', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}
                  >Cancel</button>
                  <button type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '8px 18px', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      backgroundColor: (() => {
                        const isRice = selectedEntry?.entryType === 'RICE_SAMPLE';
                        if (isSubmitting) return '#95a5a6';
                        if (isRice) return showQualityAsUpdate ? '#1565c0' : '#2e7d32';
                        const has100g = !!(qualityData.moisture && qualityData.grainsCount);
                        const allFilled = !!(has100g && qualityData.cutting1 && qualityData.cutting2 && qualityData.bend1 && qualityData.bend2 && qualityData.mix && qualityData.kandu && qualityData.oil && qualityData.sk);
                        if (allFilled) return showQualityAsUpdate ? '#1565c0' : '#2e7d32';
                        return '#e65100';
                      })(),
                      color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700'
                    }}
                  >
                    {(() => {
                      if (isSubmitting) return 'Saving...';
                      const isRice = selectedEntry?.entryType === 'RICE_SAMPLE';
                      const has100g = !!(qualityData.moisture && qualityData.grainsCount);
                      const allFilled = !!(has100g && qualityData.cutting1 && qualityData.cutting2 && qualityData.bend1 && qualityData.bend2 && qualityData.mix && qualityData.kandu && qualityData.oil && qualityData.sk);
                      if (allFilled || isRice) return showQualityAsUpdate ? 'Update Quality' : 'Submit Quality';
                      if (has100g) return showQualityAsUpdate ? 'Update 100g' : 'Save 100g';
                      return showQualityAsUpdate ? 'Update' : 'Save';
                    })()}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Save Confirmation Dialog - Main Form */}
      {
        showSaveConfirm && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '380px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', textAlign: 'center'
            }}>
              <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '16px' }}>Confirm Save</h3>
              <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>Are you sure you want to save this entry?</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowSaveConfirm(false)}
                  style={{ padding: '8px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', backgroundColor: isSubmitting ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Save Confirmation Dialog - Quality Data */}
      {
        showQualitySaveConfirm && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '380px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', textAlign: 'center'
            }}>
              <h3 style={{ marginBottom: '16px', color: '#333', fontSize: '16px' }}>Confirm Save Quality Data</h3>
              <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>Are you sure you want to save quality data?</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowQualitySaveConfirm(false)}
                  style={{ padding: '8px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitQualityParameters}
                  disabled={isSubmitting}
                  style={{ padding: '8px 20px', backgroundColor: isSubmitting ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Entry Modal */}
      {
        showEditModal && editingEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '20px', width: '90%', maxWidth: '600px',
              maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>Edit Entry</h3>
                <button onClick={() => { setShowEditModal(false); setEditingEntry(null); }}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Date</label>
                  <input type="date" value={formData.entryDate} onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Broker Name</label>
                  <select
                    value={formData.brokerName}
                    onChange={(e) => setFormData({ ...formData, brokerName: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer' }}
                    required
                  >
                    <option value="">-- Select Broker --</option>
                    {brokers.map((broker, index) => (
                      <option key={index} value={broker}>{toTitleCase(broker)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Bags</label>
                  <input type="number" value={formData.bags} onChange={(e) => setFormData({ ...formData, bags: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Packaging</label>
                  <select value={formData.packaging} onChange={(e) => setFormData({ ...formData, packaging: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                    <option value="75">75 Kg</option>
                    <option value="40">40 Kg</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Variety</label>
                  <select
                    value={formData.variety}
                    onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer' }}
                    required
                  >
                    <option value="">-- Select Variety --</option>
                    {varieties.map((variety, index) => (
                      <option key={index} value={variety}>{toTitleCase(variety)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Party Name</label>
                  <input value={formData.partyName} onChange={(e) => handleInputChange('partyName', e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Paddy Location</label>
                  <input value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333', fontSize: '13px' }}>
                    Sample Collected By
                  </label>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                      <input
                        type="radio"
                        name="editSampleCollectType"
                        checked={sampleCollectType === 'broker'}
                        onChange={() => {
                          setSampleCollectType('broker');
                          setFormData(prev => ({ ...prev, sampleCollectedBy: 'Broker Office Sample' }));
                        }}
                        style={{ accentColor: '#e65100' }}
                      />
                      <span style={{ color: '#e65100', fontWeight: '700' }}>Broker Office Sample</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <input
                      type="radio"
                      name="editSampleCollectType"
                      checked={sampleCollectType === 'supervisor'}
                      onChange={() => {
                        setSampleCollectType('supervisor');
                        setFormData(prev => ({ ...prev, sampleCollectedBy: '' }));
                      }}
                      style={{ accentColor: '#1565c0', marginTop: '4px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '4px', display: 'block' }}>Paddy Staff Name</label>
                      {paddySupervisors.length > 0 && !(sampleCollectType === 'supervisor' && formData.sampleCollectedBy && !paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy)) && (
                        <select
                          value={sampleCollectType === 'supervisor' && paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy) ? formData.sampleCollectedBy : ''}
                          onChange={(e) => {
                            setSampleCollectType('supervisor');
                            setFormData(prev => ({ ...prev, sampleCollectedBy: e.target.value }));
                          }}
                          disabled={sampleCollectType !== 'supervisor'}
                          style={{
                            width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px',
                            backgroundColor: sampleCollectType === 'supervisor' ? 'white' : '#f5f5f5',
                            cursor: sampleCollectType === 'supervisor' ? 'pointer' : 'not-allowed',
                            marginBottom: '6px'
                          }}
                        >
                          <option value="">-- Select from list --</option>
                          {paddySupervisors.map(s => (
                            <option key={s.id} value={toTitleCase(s.username)}>{toTitleCase(s.username)}</option>
                          ))}
                        </select>
                      )}
                      {!(sampleCollectType === 'supervisor' && paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy)) && (
                        <input
                          type="text"
                          value={sampleCollectType === 'supervisor' && !paddySupervisors.some(s => toTitleCase(s.username) === formData.sampleCollectedBy) ? formData.sampleCollectedBy : ''}
                          onChange={(e) => {
                            setSampleCollectType('supervisor');
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, sampleCollectedBy: toTitleCase(val) }));
                          }}
                          placeholder="Or type name manually"
                          disabled={sampleCollectType !== 'supervisor'}
                          style={{
                            width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px',
                            backgroundColor: sampleCollectType === 'supervisor' ? 'white' : '#f5f5f5'
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {editingEntry.entryType === 'DIRECT_LOADED_VEHICLE' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Lorry Number</label>
                    <input value={formData.lorryNumber} onChange={(e) => handleInputChange('lorryNumber', e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowEditModal(false); setEditingEntry(null); }}
                  style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={isSubmitting}
                  style={{ padding: '8px 16px', backgroundColor: isSubmitting ? '#95a5a6' : '#4a90e2', color: 'white', border: 'none', borderRadius: '4px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

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
          Page {page} of {totalPages} &nbsp;({totalEntries} total)
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page >= totalPages ? '#eee' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default SampleEntryPage;




