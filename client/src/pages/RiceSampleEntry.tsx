import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sampleEntryApi } from '../utils/sampleEntryApi';
import type { SampleEntry, EntryType } from '../types/sampleEntry';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';

import { API_URL } from '../config/api';

const RiceSampleEntry: React.FC<{ defaultTab?: 'RICE_SAMPLE' | 'RICE_BOOK' }> = ({ defaultTab }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [entryType, setEntryType] = useState<EntryType>('CREATE_NEW');
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExistingQualityData, setHasExistingQualityData] = useState(false);
  const [activeTab, setActiveTab] = useState<'RICE_SAMPLE' | 'RICE_BOOK'>(defaultTab || 'RICE_SAMPLE');
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
  const [paddySupervisors, setPaddySupervisors] = useState<{ id: number; username: string }[]>([]);

  // Title Case helper: first letter capital, rest small
  const toTitleCase = (str: string) => str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  const riceReportedByOptions = useMemo(() => {
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
  }, [paddySupervisors, qualityUsers, user?.role, user?.username]);

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

  // Dropdown options
  const [brokers, setBrokers] = useState<string[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);

  // Default form state for new entry
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
    sampleGivenToOffice: false,
    gramsReport: '10gms'
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
    gramsReport: '10gms',
    reportedBy: '',
    uploadFile: null as File | null
  });

  // References for auto-tabbing
  const bendRef = useRef<HTMLInputElement>(null);
  const mixRef = useRef<HTMLInputElement>(null);

  const handleCuttingInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.length > 5) return;
    setQualityData(prev => ({ ...prev, cutting: cleaned, cutting1: cleaned }));
  };

  const handleBendInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.length > 5) return;
    setQualityData(prev => ({ ...prev, bend: cleaned, bend1: cleaned }));
  };

  // Helper: restrict quality param value - 2 digits for moisture, 3 digits for others
  const handleQualityInput = (field: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const threeDigitFields = ['grainsCount'];
    if (threeDigitFields.includes(field)) {
      if (cleaned.length > 3) return;
    } else {
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

  // Keep pagination predictable when switching Rice Sample / Rice Book tabs
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
      const params: any = { page, pageSize: PAGE_SIZE, entryType: 'RICE_SAMPLE' };
      const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
      const dTo = fTo !== undefined ? fTo : filterDateTo;
      const b = fBroker !== undefined ? fBroker : filterBroker;

      if (dFrom) params.startDate = dFrom;
      if (dTo) params.endDate = dTo;
      if (b) params.broker = b;
      const response = await sampleEntryApi.getSampleEntriesByRole(params);
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
            .filter((u: any) => u.isActive !== false && u.role !== 'admin' && u.qualityName && u.qualityName.trim() !== '')
            .map((u: any) => u.qualityName.trim());
          setQualityUsers(Array.from(new Set(qNames)));
        }
      } catch (qErr) {
        console.log('Could not fetch quality users for dropdown');
      }

      // Fetch paddy supervisors (mill staff) for Sample Collected By dropdown
      try {
        const supervisorRes = await axios.get<{ success: boolean, users: Array<{ id: number, username: string }> }>(`${API_URL}/sample-entries/paddy-supervisors`, { headers });
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
        lorryNumber: formData.lorryNumber,
        entryType,
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
        packaging: '75',
        sampleCollectedBy: 'Broker Office Sample',
        sampleGivenToOffice: false,
        gramsReport: '10gms'
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
      packaging: (entry as any).packaging || '26 kg',
      sampleCollectedBy: (entry as any).sampleCollectedBy || '',
      sampleGivenToOffice: (entry as any).sampleGivenToOffice || false,
      gramsReport: (entry as any).gramsReport || '10gms'
    });
    setEntryType(entry.entryType);
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
        lorryNumber: formData.lorryNumber,
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
            gramsReport: qp.gramsReport || '10gms',
            reportedBy: qp.reportedBy?.toString() || '',
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
          // Reset quality data for new entry
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
            gramsReport: '10gms',
            reportedBy: '',
            uploadFile: null
          });
          setHasExistingQualityData(false);
        }
      } catch (error) {
        console.error('Error fetching quality parameters:', error);
        // Reset on error
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
          gramsReport: '10gms',
          reportedBy: '',
          uploadFile: null
        });
        setHasExistingQualityData(false);
      }
    };

    fetchQualityParameters();
  };

  const handleSubmitQualityParametersWithConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    // All fields mandatory for Rice except toggles (Moisture, Grains Count, Broken, Rice, Bend, Mix, Kandu, Oil, SK)
    if (!qualityData.moisture) { showNotification('Moisture is required', 'error'); return; }
    if (!qualityData.grainsCount) { showNotification('Grains Count is required', 'error'); return; }
    if (!qualityData.mix) { showNotification('Broken is required', 'error'); return; }
    if (!qualityData.cutting1) { showNotification('Rice is required', 'error'); return; }
    if (!qualityData.bend1) { showNotification('Bend is required', 'error'); return; }
    if (!qualityData.sk) { showNotification('Mix is required', 'error'); return; }
    if (!qualityData.kandu) { showNotification('Kandu is required', 'error'); return; }
    if (!qualityData.oil) { showNotification('Oil is required', 'error'); return; }
    if (!qualityData.gramsReport) { showNotification('Grams Report is required', 'error'); return; }

    setShowQualitySaveConfirm(true);
  };

  const handleSubmitQualityParameters = async () => {
    if (!selectedEntry || isSubmitting) return;
    const lockKey = `quality-save-${selectedEntry.id}`;
    if (!acquireSubmissionLock(lockKey)) return;

    setShowQualitySaveConfirm(false);

    // For Rice, is100GramsSave is always false as per user request (only full quality)
    const is100GramsSave = false;

    try {
      setIsSubmitting(true);
      const formDataToSend = new FormData();
      formDataToSend.append('moisture', qualityData.moisture);
      formDataToSend.append('cutting1', qualityData.cutting1 || '0');
      formDataToSend.append('cutting2', qualityData.cutting2 || '0');
      formDataToSend.append('bend1', qualityData.bend1 || '0');
      formDataToSend.append('bend2', qualityData.bend2 || '0');
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
      formDataToSend.append('reportedBy', qualityData.reportedBy || user?.username || 'Unknown');
      if (is100GramsSave) {
        formDataToSend.append('is100Grams', 'true');
      }

      if (qualityData.uploadFile) {
        formDataToSend.append('photo', qualityData.uploadFile);
      }

      const method = hasExistingQualityData ? 'put' : 'post';
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
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg, #2e7d32, #43a047)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>🍚 NEW RICE SAMPLE</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Rice Sample button - same access as Mill Sample */}
          <button
            onClick={() => {
              setEntryType('RICE_SAMPLE');
              setSampleCollectType('broker');
              setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '26 kg', sampleCollectedBy: 'Broker Office Sample', sampleGivenToOffice: false, gramsReport: '10gms' });
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
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '15px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        {(['RICE_SAMPLE', 'RICE_BOOK'] as const)
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
              {tab === 'RICE_SAMPLE' ? 'RICE SAMPLE' : 'RICE SAMPLE BOOK'}
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
      < div style={{
        overflowX: 'auto',
        backgroundColor: 'white'
      }}>
        {(() => {
          const filteredEntries = entries.filter((entry) => {
            const qp = (entry as any).qualityParameters;
            const hasQualityComp = qp && qp.moisture != null && (
              (qp.cutting1 && Number(qp.cutting1) !== 0) ||
              (qp.bend1 && Number(qp.bend1) !== 0) ||
              (qp.mix && Number(qp.mix) !== 0) ||
              (qp.sk && Number(qp.sk) !== 0)
            );
            const has100GramsComp = qp && qp.moisture != null && !hasQualityComp;

            // Tab filter
            if (activeTab === 'RICE_SAMPLE') {
              // Only pending entries (exclude those that have full quality completed)
              return !hasQualityComp;
            }
            if (activeTab === 'RICE_BOOK') {
              // Only completed entries (exclude 100g status)
              return hasQualityComp;
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
                        &nbsp;&nbsp;Rice Sample
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '3%' }}>SL No</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Bags</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', whiteSpace: 'nowrap', width: '6%' }}>Pkg</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '16%' }}>Party Name</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '14%' }}>Rice Location</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '12%' }}>Variety</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '25%' }}>Sample Reports</th>
                            <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap', width: '14%' }}>Sample Collected By</th>
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
                            const hasQuality = qp && qp.moisture != null && ((qp.cutting1 && Number(qp.cutting1) !== 0) || (qp.bend1 && Number(qp.bend1) !== 0) || (qp.mix && Number(qp.mix) !== 0));
                            const has100Grams = qp && qp.moisture != null && !hasQuality;

                            // Location staff restriction: only the creator can enter/edit quality
                            const isLocationStaff = user?.role === 'staff' && (user as any)?.staffType === 'location';
                            const isEntryCreator = (entry as any).creator?.id === user?.id || (entry as any).createdByUserId === user?.id;
                            const canEditQuality = !isLocationStaff || isEntryCreator;

                            const handleNextClick = () => {
                              handleViewEntry(entry);
                            };

                            return (
                              <tr key={entry.id} style={{ backgroundColor: entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffcc80' : '#ffffff' }}>
                                <td style={{ border: '1px solid #000', padding: '1px 4px', textAlign: 'center', fontWeight: '700', fontSize: '13px', verticalAlign: 'middle' }}>{slNo}</td>
                                <td style={{ border: '1px solid #000', padding: '1px 4px', textAlign: 'center', fontSize: '13px', fontWeight: '600', lineHeight: '1.2' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                <td style={{ border: '1px solid #000', padding: '1px 4px', textAlign: 'center', fontSize: '13px', lineHeight: '1.2' }}>{(() => {
                                  let pkg = String((entry as any).packaging || '75');
                                  if (pkg.toLowerCase() === '0' || pkg.toLowerCase() === 'loose') return 'Loose';
                                  if (pkg.toLowerCase().includes('kg')) return pkg;
                                  if (pkg.toLowerCase().includes('tons')) return pkg;
                                  return `${pkg} Kg`;
                                })()}</td>
                                <td style={{ border: '1px solid #000', padding: '1px 4px', textAlign: 'left', fontSize: '14px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.partyName)}</td>
                                <td style={{ border: '1px solid #000', padding: '1px 4px', textAlign: 'left', fontSize: '14px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(entry.location)}</td>

                                <td style={{ border: '1px solid #000', padding: '1px 4px', textAlign: 'left', fontSize: '14px', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {toTitleCase(entry.variety)}
                                  {hasQuality && <span style={{ marginLeft: '3px', color: '#27ae60', fontSize: '11px' }} title="Quality Completed">✅</span>}
                                  {has100Grams && <span style={{ marginLeft: '3px', color: '#e65100', fontSize: '11px' }} title="100g Completed">⚡</span>}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '0px 2px', textAlign: 'left', lineHeight: '1.1' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>

                                    {has100Grams ? (
                                      <>
                                        <span
                                          onClick={() => canEditQuality ? setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id) : null}
                                          style={{ fontSize: '11px', padding: '3px 8px', backgroundColor: '#ffeb3b', color: '#333', borderRadius: '3px', fontWeight: '700', border: '1.5px solid #f9a825', cursor: canEditQuality ? 'pointer' : 'default' }}
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
                                        <span
                                          onClick={() => canEditQuality ? setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id) : null}
                                          style={{
                                            fontSize: '11px',
                                            padding: '3px 8px',
                                            backgroundColor: '#e8f5e9',
                                            color: '#2e7d32',
                                            borderRadius: '3px',
                                            fontWeight: '700',
                                            border: '1.5px solid #66bb6a',
                                            cursor: canEditQuality ? 'pointer' : 'default'
                                          }}
                                        >
                                          ✓ Quality Completed
                                        </span>

                                        {canEditQuality && expandedEntryId === entry.id && (
                                          <>
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
                                          </>
                                        )}
                                      </>
                                    ) : canEditQuality ? (
                                      <>
                                        <button
                                          onClick={() => handleNextClick()}
                                          style={{
                                            fontSize: '10px',
                                            padding: '3px 8px',
                                            backgroundColor: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            cursor: 'pointer',
                                            fontWeight: '700'
                                          }}
                                        >
                                          Next →
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
                                      </>
                                    ) : (
                                      <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#f5f5f5', color: '#999', borderRadius: '3px', fontWeight: '600' }}>Pending</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: '1px 8px', textAlign: 'left', fontSize: '11px', lineHeight: '1.2', verticalAlign: 'middle' }}>
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
      </div >

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
                background: 'linear-gradient(135deg, #2e7d32, #43a047)',
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
                  🍚 NEW RICE SAMPLE
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



                {/* 3. Bags - validation based on packaging */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
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
                </div>

                {/* 4. Packaging */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Packaging</label>
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
                {entryType !== 'DIRECT_LOADED_VEHICLE' && (
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

                {/* 7. Rice Location */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '2px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Rice Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                    required
                  />
                </div>

                {/* 8. Sample Collected By — Radio UI for Rice Sample */}
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
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '4px', display: 'block' }}>Mill Gumasta Name</label>

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
                color: '#1a237e',
                borderBottom: '2px solid #1a237e',
                paddingBottom: '8px'
              }}>
                {hasExistingQualityData ? '✏️ Edit Rice Quality Parameters' : '📋 Rice Quality Parameters'}
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
                {/* ── All Fields in one 3-column grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 10px', alignItems: 'start', marginBottom: '10px' }}>
                  {/* Row 1: Moisture, Grains Count, Broken (mix) */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Moisture <span style={{ color: '#e53935' }}>*</span></label>
                    <input type="number" step="0.01" required value={qualityData.moisture}
                      onChange={(e) => {
                        handleQualityInput('moisture', e.target.value);
                      }}
                      style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Grains Count <span style={{ color: '#e53935' }}>*</span></label>
                    <input type="number" value={qualityData.grainsCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 3) {
                          handleQualityInput('grainsCount', val);
                        }
                      }}
                      style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '3px', fontWeight: '600', color: '#333', fontSize: '11px' }}>Broken <span style={{ color: '#e53935' }}>*</span></label>
                    <input type="number" step="0.01" value={qualityData.mix}
                      ref={mixRef}
                      onChange={(e) => {
                        handleQualityInput('mix', e.target.value);
                      }}
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
                      ref={bendRef}
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
                        value={qualityData.reportedBy || riceReportedByOptions[0] || ''}
                        onChange={(e) => setQualityData({ ...qualityData, reportedBy: toTitleCase(e.target.value) })}
                        style={{ width: '100%', padding: '6px', border: '1.5px solid #bbb', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', fontWeight: '600' }}
                      >
                        {riceReportedByOptions.map((qName, idx) => (
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
                        // Rice specific entry page, always use green/blue and Standard labels
                        if (isSubmitting) return '#95a5a6';
                        return hasExistingQualityData ? '#1565c0' : '#2e7d32';
                      })(),
                      color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700'
                    }}
                  >
                    {(() => {
                      // Rice specific entry page, always use Standard labels
                      if (isSubmitting) return 'Saving...';
                      return hasExistingQualityData ? 'Update Quality' : 'Submit Quality';
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '4px', display: 'block' }}>Mill Gumasta Name</label>
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
    </div >
  );
};

export default RiceSampleEntry;
