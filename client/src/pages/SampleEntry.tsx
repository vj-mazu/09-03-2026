import React, { useState, useEffect } from 'react';
import { sampleEntryApi } from '../utils/sampleEntryApi';
import type { SampleEntry, EntryType } from '../types/sampleEntry';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';

import { API_URL } from '../config/api';

const SampleEntryPage: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [showModal, setShowModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [entryType, setEntryType] = useState<EntryType>('CREATE_NEW');
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasExistingQualityData, setHasExistingQualityData] = useState(false);
  const [activeTab, setActiveTab] = useState<'MILL_SAMPLE' | 'LOCATION_SAMPLE' | 'SAMPLE_BOOK'>('MILL_SAMPLE');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showQualitySaveConfirm, setShowQualitySaveConfirm] = useState(false);
  const [pendingSubmitEvent, setPendingSubmitEvent] = useState<React.FormEvent | null>(null);
  const [editingEntry, setEditingEntry] = useState<SampleEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [smixEnabled, setSmixEnabled] = useState(false);
  const [lmixEnabled, setLmixEnabled] = useState(false);
  const [paddyWbEnabled, setPaddyWbEnabled] = useState(false);
  const [wbEnabled, setWbEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    uploadFile: null as File | null
  });

  // Auto-insert × symbol for cutting/bend - 1 digit before × and 4 digits after ×
  const handleCuttingInput = (value: string) => {
    // Allow digits and × for format like 1×4321 — only ONE × allowed
    let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
    // Only allow one × symbol
    const xCount = (clean.match(/×/g) || []).length;
    if (xCount > 1) {
      const idx = clean.indexOf('×');
      clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
    }
    // Enforce 1 digit before × and 4 digits after ×
    const parts = clean.split('×');
    const first = (parts[0] || '').substring(0, 1); // Only 1 digit before ×
    const second = (parts[1] || '').substring(0, 4); // 4 digits after ×
    clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
    setQualityData(prev => {
      return { ...prev, cutting: clean, cutting1: first, cutting2: second };
    });
  };

  const handleBendInput = (value: string) => {
    // Allow digits and × for format like 1×4321 — only ONE × allowed
    let clean = value.replace(/[^0-9.×xX]/g, '').replace(/[xX]/g, '×');
    // Only allow one × symbol
    const xCount = (clean.match(/×/g) || []).length;
    if (xCount > 1) {
      const idx = clean.indexOf('×');
      clean = clean.substring(0, idx + 1) + clean.substring(idx + 1).replace(/×/g, '');
    }
    // Enforce 1 digit before × and 4 digits after ×
    const parts = clean.split('×');
    const first = (parts[0] || '').substring(0, 1); // Only 1 digit before ×
    const second = (parts[1] || '').substring(0, 4); // 4 digits after ×
    clean = second !== undefined && clean.includes('×') ? `${first}×${second}` : first;
    setQualityData(prev => {
      return { ...prev, bend: clean, bend1: first, bend2: second };
    });
  };

  // Helper: restrict quality param value - 2 digits for moisture, 3 digits for others
  const handleQualityInput = (field: string, value: string) => {
    // Remove non-numeric except decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Check integer part based on field
    const parts = cleaned.split('.');
    if (field === 'moisture') {
      if (parts[0] && parts[0].length > 2) return; // block if > 2 digits for moisture
    } else {
      if (parts[0] && parts[0].length > 3) return; // block if > 3 digits for others
    }
    setQualityData(prev => ({ ...prev, [field]: cleaned }));
  };

  useEffect(() => {
    const wbR = wbEnabled ? (parseFloat(qualityData.wbR) || 0) : 0;
    const wbBk = wbEnabled ? (parseFloat(qualityData.wbBk) || 0) : 0;
    const wbT = (wbR + wbBk).toFixed(2);
    if (qualityData.wbT !== wbT && !hasExistingQualityData) {
      setQualityData(prev => ({ ...prev, wbT }));
    }
  }, [qualityData.wbR, qualityData.wbBk, wbEnabled]);

  useEffect(() => {
    loadEntries();
    loadDropdownData();
  }, [page]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const params: any = { page, pageSize: PAGE_SIZE };
      if (filterDateFrom) params.startDate = filterDateFrom;
      if (filterDateTo) params.endDate = filterDateTo;
      if (filterBroker) params.broker = filterBroker;
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
    loadEntries();
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
    } catch (error: any) {
      console.error('Failed to load dropdown data:', error);
    }
  };

  // Show save confirmation before actually saving
  const handleSubmitWithConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingSubmitEvent(e);
    setShowSaveConfirm(true);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

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
        brokerName: formData.brokerName.toUpperCase(),
        variety: formData.variety.toUpperCase(),
        partyName: formData.partyName.toUpperCase(),
        location: formData.location.toUpperCase(),
        bags: parseInt(formData.bags),
        lorryNumber: formData.lorryNumber ? formData.lorryNumber.toUpperCase() : undefined,
        entryType,
        packaging: formData.packaging as '75' | '40',
        sampleCollectedBy: formData.sampleCollectedBy ? formData.sampleCollectedBy.toUpperCase() : undefined,
        sampleGivenToOffice: formData.sampleGivenToOffice
      });
      
      // Close modal after successful save
      setShowModal(false);
      showNotification('Sample entry created successfully', 'success');
      setFormData({
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
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to create entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal for a staff entry
  const handleEditEntry = (entry: SampleEntry) => {
    setEditingEntry(entry);
    // Get bags value - handle both number and string types
    const bagsValue = typeof entry.bags === 'number' ? entry.bags.toString() : (entry.bags || '');
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
    setEntryType(entry.entryType);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/sample-entries/${editingEntry.id}`, {
        entryDate: formData.entryDate,
        brokerName: formData.brokerName.toUpperCase(),
        variety: formData.variety.toUpperCase(),
        partyName: formData.partyName.toUpperCase(),
        location: formData.location.toUpperCase(),
        bags: parseInt(formData.bags),
        lorryNumber: formData.lorryNumber ? formData.lorryNumber.toUpperCase() : null,
        packaging: formData.packaging,
        sampleCollectedBy: formData.sampleCollectedBy ? formData.sampleCollectedBy.toUpperCase() : null,
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
    }
  };



  // Auto-uppercase handler
  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value.toUpperCase() });
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
          const c1 = qp.cutting1?.toString() || '';
          const c2 = qp.cutting2?.toString() || '';
          const b1 = qp.bend1?.toString() || '';
          const b2 = qp.bend2?.toString() || '';
          setQualityData({
            moisture: qp.moisture?.toString() || '',
            cutting: c1 && c2 ? `${c1}×${c2}` : c1 || '',
            cutting1: c1,
            cutting2: c2,
            bend: b1 && b2 ? `${b1}×${b2}` : b1 || '',
            bend1: b1,
            bend2: b2,
            mixS: qp.mixS?.toString() || '',
            mixL: qp.mixL?.toString() || '',
            mix: qp.mix?.toString() || '',
            kandu: qp.kandu?.toString() || '',
            oil: qp.oil?.toString() || '',
            sk: qp.sk?.toString() || '',
            grainsCount: qp.grainsCount?.toString() || '',
            wbR: qp.wbR?.toString() || '',
            wbBk: qp.wbBk?.toString() || '',
            wbT: qp.wbT?.toString() || '',
            paddyWb: qp.paddyWb?.toString() || '',
            uploadFile: null
          });
          setHasExistingQualityData(true);
          // Auto-enable toggles based on existing data
          if (qp.mixS && parseFloat(qp.mixS) > 0) setSmixEnabled(true);
          if (qp.mixL && parseFloat(qp.mixL) > 0) setLmixEnabled(true);
          if (qp.paddyWb && parseFloat(qp.paddyWb) > 0) setPaddyWbEnabled(true);
          if (qp.wbR && parseFloat(qp.wbR) > 0) setWbEnabled(true);
          if (qp.wbBk && parseFloat(qp.wbBk) > 0) setWbEnabled(true);
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
          uploadFile: null
        });
        setHasExistingQualityData(false);
      }
    };

    fetchQualityParameters();
  };

  const handleSubmitQualityParametersWithConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setShowQualitySaveConfirm(true);
  };

  const handleSubmitQualityParameters = async () => {
    setShowQualitySaveConfirm(false);
    if (!selectedEntry) return;

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('moisture', qualityData.moisture);
      formDataToSend.append('cutting1', qualityData.cutting1);
      formDataToSend.append('cutting2', qualityData.cutting2);
      formDataToSend.append('bend1', qualityData.bend1);
      formDataToSend.append('bend2', qualityData.bend2);
      formDataToSend.append('mixS', smixEnabled ? qualityData.mixS || '0' : '0');
      formDataToSend.append('mixL', lmixEnabled ? qualityData.mixL || '0' : '0');
      formDataToSend.append('mix', qualityData.mix);
      formDataToSend.append('kandu', qualityData.kandu);
      formDataToSend.append('oil', qualityData.oil);
      formDataToSend.append('sk', qualityData.sk);
      formDataToSend.append('grainsCount', qualityData.grainsCount);
      formDataToSend.append('wbR', wbEnabled ? qualityData.wbR || '0' : '0');
      formDataToSend.append('wbBk', wbEnabled ? qualityData.wbBk || '0' : '0');
      formDataToSend.append('wbT', qualityData.wbT || '0');
      formDataToSend.append('paddyWb', paddyWbEnabled ? qualityData.paddyWb || '0' : '0');
      // reportedBy will be auto-filled by backend from logged-in user
      formDataToSend.append('reportedBy', user?.username || 'Unknown');

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
      showNotification('Quality parameters added successfully', 'success');
      setShowQualityModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to add quality parameters', 'error');
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
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg, #2e7d32, #43a047)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '1px' }}>🌾 NEW PADDY SAMPLE</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Mill Sample button - hidden for location staff */}
          {(user?.role !== 'staff' || user?.staffType !== 'location') && (
            <button
              onClick={() => {
                setEntryType('CREATE_NEW');
                setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '75', sampleCollectedBy: '', sampleGivenToOffice: false });
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
                setEntryType('DIRECT_LOADED_VEHICLE');
                setFormData({ entryDate: new Date().toISOString().split('T')[0], brokerName: '', variety: '', partyName: '', location: '', bags: '', lorryNumber: '', packaging: '75', sampleCollectedBy: '', sampleGivenToOffice: false });
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
                setEntryType('LOCATION_SAMPLE');
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
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '15px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        {(['MILL_SAMPLE', 'LOCATION_SAMPLE', 'SAMPLE_BOOK'] as const)
          .filter((tab) => {
            const staffType = (user as any)?.staffType;
            if (user?.role !== 'staff' || !staffType) return true; // non-staff see all
            if (staffType === 'mill') return tab === 'MILL_SAMPLE' || tab === 'SAMPLE_BOOK';
            if (staffType === 'location') return tab === 'LOCATION_SAMPLE' || tab === 'SAMPLE_BOOK';
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
              {tab === 'MILL_SAMPLE' ? 'MILL SAMPLE' : tab === 'LOCATION_SAMPLE' ? 'LOCATION SAMPLE' : 'SAMPLE BOOK'}
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
              <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterBroker(''); }}
                style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Entries Table */}
      <div style={{
        overflowX: 'auto',
        backgroundColor: 'white',
        border: '1px solid #ddd'
      }}>
        {(() => {
          const filteredEntries = entries.filter((entry) => {
            // Tab filter
            if (activeTab === 'LOCATION_SAMPLE') {
              if (entry.entryType !== 'LOCATION_SAMPLE') return false;
              if ((entry as any).sampleGivenToOffice) return false; // If given to Mill, hide from Location Sample tab
            }
            if (activeTab === 'MILL_SAMPLE') {
              // Exclude Location Samples unless they are marked as 'given to office'
              if (entry.entryType === 'LOCATION_SAMPLE' && !(entry as any).sampleGivenToOffice) {
                return false;
              }
            }
            // SAMPLE_BOOK shows all entries

            // Date filters
            if (filterDateFrom) {
              const entryDate = new Date(entry.entryDate).toISOString().split('T')[0];
              if (entryDate < filterDateFrom) return false;
            }
            if (filterDateTo) {
              const entryDate = new Date(entry.entryDate).toISOString().split('T')[0];
              if (entryDate > filterDateTo) return false;
            }
            // Broker filter
            if (filterBroker && entry.brokerName !== filterBroker) return false;
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

          let slNo = 0;
          return Object.entries(grouped).map(([dateKey, brokerGroups]) => (
            <div key={dateKey} style={{ marginBottom: '16px' }}>
              {Object.entries(brokerGroups).map(([brokerName, brokerEntries]) => (
                <div key={brokerName}>
                  {/* Merged Date + Broker Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    color: 'white',
                    padding: '8px 12px',
                    fontWeight: '700',
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    textAlign: 'center'
                  }}>
                    {dateKey} — {brokerName}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', width: '40px' }}>SL</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px' }}>Bags</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px' }}>Packaging</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px' }}>Party Name</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px' }}>Paddy Location</th>
                        {(entryType === 'DIRECT_LOADED_VEHICLE' || activeTab !== 'LOCATION_SAMPLE') && <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px' }}>Lorry No</th>}
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px' }}>Variety</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', fontSize: '11px', minWidth: '180px' }}>Sample Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokerEntries.map((entry, index) => {
                        slNo++;
                        const hasQuality = entry.workflowStatus !== 'STAFF_ENTRY';

                        const handleNextClick = () => {
                          handleViewEntry(entry);
                        };

                        return (
                          <tr key={entry.id} style={{
                            backgroundColor: entry.entryType === 'DIRECT_LOADED_VEHICLE'
                              ? (index % 2 === 0 ? '#e3f2fd' : '#bbdefb')  // Blue for Ready Lorry
                              : entry.entryType === 'LOCATION_SAMPLE'
                                ? (index % 2 === 0 ? '#f57c00' : '#ef6c00')  // Proper Orange for Location Sample
                                : (index % 2 === 0 ? '#f9f9f9' : 'white'),  // Default for New Paddy Sample
                            color: entry.entryType === 'LOCATION_SAMPLE' ? 'white' : 'inherit'
                          }}>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600' }}>
                              {slNo}
                              <div style={{ fontSize: '8px', fontWeight: '700', marginTop: '2px' }}>
                                {entry.entryType === 'DIRECT_LOADED_VEHICLE' && <span style={{ color: '#1565c0' }}>RL</span>}
                                {entry.entryType === 'LOCATION_SAMPLE' && <span style={{ color: '#e65100' }}>LOC</span>}
                                {entry.entryType !== 'DIRECT_LOADED_VEHICLE' && entry.entryType !== 'LOCATION_SAMPLE' && <span style={{ color: '#2e7d32' }}>MS</span>}
                              </div>
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600' }}>{entry.bags}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{(entry as any).packaging || '75'} Kg</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{entry.partyName}</td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{entry.location}</td>
                            {(entryType === 'DIRECT_LOADED_VEHICLE' || activeTab !== 'LOCATION_SAMPLE') && <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>{(entry as any).lorryNumber || '-'}</td>}
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', fontSize: '11px' }}>
                              {entry.variety}
                              {hasQuality && <span style={{ marginLeft: '4px', color: '#27ae60', fontSize: '10px' }} title="Quality Completed">✅</span>}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                                {hasQuality ? (
                                  <>
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '4px 8px',
                                      backgroundColor: '#e8f5e9',
                                      color: '#2e7d32',
                                      borderRadius: '3px',
                                      fontWeight: '700',
                                      border: '1px solid #c8e6c9'
                                    }}>
                                      ✓ Completed
                                    </span>
                                    <button
                                      onClick={() => handleViewEntry(entry)}
                                      title="Edit Quality Parameters"
                                      style={{
                                        fontSize: '10px',
                                        padding: '4px 8px',
                                        backgroundColor: '#3498db',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Edit Qlty
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleNextClick()}
                                    style={{
                                      fontSize: '10px',
                                      padding: '4px 10px',
                                      backgroundColor: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      fontWeight: '700'
                                    }}
                                  >
                                    Next →
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEditEntry(entry)}
                                  title="Edit Entry (Form + Quantity)"
                                  style={{
                                    fontSize: '10px',
                                    padding: '4px 8px',
                                    backgroundColor: '#2980b9',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ));
        })()}
      </div>

      {/* Modal - Full Screen */}
      {showModal && (
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
          zIndex: 1000,
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '900px',
            minHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid #ddd',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              background: entryType === 'CREATE_NEW' ? 'linear-gradient(135deg, #2ecc71, #27ae60)' :
                entryType === 'DIRECT_LOADED_VEHICLE' ? 'linear-gradient(135deg, #3498db, #2980b9)' :
                  'linear-gradient(135deg, #e67e22, #d35400)',
              padding: '16px 24px',
              borderRadius: '8px 8px 0 0',
              marginBottom: '20px',
              marginTop: '-40px',
              marginLeft: '-40px',
              marginRight: '-40px',
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '0.5px'
              }}>
                {entryType === 'CREATE_NEW' ? '🌾 NEW PADDY SAMPLE' : entryType === 'DIRECT_LOADED_VEHICLE' ? '🚛 READY LORRY' : '📍 LOCATION SAMPLE'}
              </h3>
            </div>
            <form onSubmit={handleSubmitWithConfirm}>
              {/* 1. Date */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Date</label>
                <input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px' }}
                  required
                />
              </div>

              {/* 2. Broker Name */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Broker Name</label>
                <select
                  value={formData.brokerName}
                  onChange={(e) => setFormData({ ...formData, brokerName: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer' }}
                  required
                >
                  <option value="">-- Select Broker --</option>
                  {brokers.map((broker, index) => (
                    <option key={index} value={broker}>{broker}</option>
                  ))}
                </select>
              </div>

              {/* Lorry Number (only for READY LORRY) — right after Broker Name */}
              {entryType === 'DIRECT_LOADED_VEHICLE' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Lorry Number</label>
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
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
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
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px' }}
                  required
                />
              </div>

              {/* 4. Packaging */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Packaging</label>
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
              </div>

              {/* 5. Party Name — NOT for Ready Lorry */}
              {entryType !== 'DIRECT_LOADED_VEHICLE' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Party Name</label>
                  <input
                    type="text"
                    value={formData.partyName}
                    onChange={(e) => handleInputChange('partyName', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', textTransform: 'capitalize' }}
                    required
                  />
                </div>
              )}

              {/* 6. Variety */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Variety</label>
                <select
                  value={formData.variety}
                  onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', backgroundColor: 'white', cursor: 'pointer' }}
                  required
                >
                  <option value="">-- Select Variety --</option>
                  {varieties.map((variety, index) => (
                    <option key={index} value={variety}>{variety}</option>
                  ))}
                </select>
              </div>

              {/* 7. Paddy Location */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Paddy Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', textTransform: 'uppercase' }}
                  required
                />
              </div>

              {/* 8. Sample Collected By — manual input for New Paddy Sample */}
              {entryType !== 'LOCATION_SAMPLE' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Sample Collected By</label>
                  <input
                    type="text"
                    value={formData.sampleCollectedBy}
                    onChange={(e) => handleInputChange('sampleCollectedBy', e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '13px', textTransform: 'capitalize' }}
                    placeholder="Enter name"
                  />
                </div>
              )}

              {/* Sample Given To — only for LOCATION SAMPLE */}
              {entryType === 'LOCATION_SAMPLE' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555', fontSize: '13px' }}>Sample Given To</label>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#555' }}>
                      <input
                        type="radio"
                        name="sampleGivenTo"
                        checked={!formData.sampleGivenToOffice}
                        onChange={() => setFormData({ ...formData, sampleGivenToOffice: false, sampleCollectedBy: user?.username || '' })}
                        style={{ accentColor: '#4a90e2', cursor: 'pointer' }}
                      />
                      Given to Staff
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
      )}

      {/* Quality Parameters Modal */}
      {showQualityModal && selectedEntry && (
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
          zIndex: 1000,
          padding: '80px 20px 20px 20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            border: '1px solid #ddd'
          }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: '15px',
              fontSize: '18px',
              fontWeight: '600',
              color: '#333',
              borderBottom: '2px solid #4a90e2',
              paddingBottom: '10px'
            }}>
              {hasExistingQualityData ? 'Edit Quality Parameters' : 'Add Quality Parameters'}
            </h3>

            {/* Entry Details */}
            <div style={{
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '15px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><strong>Broker:</strong> {selectedEntry.brokerName}</div>
                <div><strong>Variety:</strong> {selectedEntry.variety}</div>
                <div><strong>Party:</strong> {selectedEntry.partyName}</div>
                <div><strong>Bags:</strong> {selectedEntry.bags}</div>
              </div>
            </div>

            <form onSubmit={handleSubmitQualityParametersWithConfirm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* Moisture */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>
                    Moisture *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={qualityData.moisture}
                    onChange={(e) => handleQualityInput('moisture', e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                  />
                </div>

                {/* Cutting — single column with auto × symbol - 1x4 format */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>
                    Cutting *
                  </label>
                  <input
                    type="text"
                    required
                    value={qualityData.cutting}
                    onChange={(e) => handleCuttingInput(e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', textAlign: 'center' }}
                  />
                </div>

                {/* Bend — single column with auto × symbol - 1x4 format */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>
                    Bend *
                  </label>
                  <input
                    type="text"
                    value={qualityData.bend}
                    onChange={(e) => handleBendInput(e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', textAlign: 'center' }}
                  />
                </div>

                {/* Mix — always visible input */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Mix *</label>
                  <input type="number" step="0.01" required
                    value={qualityData.mix} onChange={(e) => handleQualityInput('mix', e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                </div>

                {/* SMix — radio Yes/No toggle */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>SMix</label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="smixEnabled" checked={smixEnabled} onChange={() => { setSmixEnabled(true); setQualityData({ ...qualityData, mixS: '' }); }} /> Yes
                    </label>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="smixEnabled" checked={!smixEnabled} onChange={() => { setSmixEnabled(false); setQualityData({ ...qualityData, mixS: '' }); }} /> No
                    </label>
                  </div>
                  {smixEnabled && (
                    <input type="number" step="0.01" value={qualityData.mixS}
                      onChange={(e) => handleQualityInput('mixS', e.target.value)}
                      style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  )}
                </div>

                {/* LMix — radio Yes/No toggle */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>LMix</label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="lmixEnabled" checked={lmixEnabled} onChange={() => { setLmixEnabled(true); setQualityData({ ...qualityData, mixL: '' }); }} /> Yes
                    </label>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="lmixEnabled" checked={!lmixEnabled} onChange={() => { setLmixEnabled(false); setQualityData({ ...qualityData, mixL: '' }); }} /> No
                    </label>
                  </div>
                  {lmixEnabled && (
                    <input type="number" step="0.01" value={qualityData.mixL}
                      onChange={(e) => handleQualityInput('mixL', e.target.value)}
                      style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  )}
                </div>

                {/* Kandu */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Kandu *</label>
                  <input type="number" step="0.01" required
                    value={qualityData.kandu} onChange={(e) => handleQualityInput('kandu', e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                </div>

                {/* Oil */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Oil *</label>
                  <input type="number" step="0.01" required
                    value={qualityData.oil} onChange={(e) => handleQualityInput('oil', e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                </div>

                {/* SK */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>SK *</label>
                  <input type="number" step="0.01" required
                    value={qualityData.sk} onChange={(e) => handleQualityInput('sk', e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                </div>

                {/* Grains Count */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Grains Count *</label>
                  <input type="number" required
                    value={qualityData.grainsCount} onChange={(e) => handleQualityInput('grainsCount', e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                </div>

                {/* WB(R) & WB(BK) — single shared Yes/No toggle */}
                <div style={{ gridColumn: '1 / -1', backgroundColor: '#f0f7ff', padding: '10px', borderRadius: '6px', border: '1px solid #d0e3f7' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: '#2c3e50', fontSize: '12px' }}>WB (R) & WB (BK)</label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="wbEnabled" checked={wbEnabled} onChange={() => { setWbEnabled(true); setQualityData({ ...qualityData, wbR: qualityData.wbR || '', wbBk: qualityData.wbBk || '' }); }} /> Yes
                    </label>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="wbEnabled" checked={!wbEnabled} onChange={() => { setWbEnabled(false); setQualityData({ ...qualityData, wbR: '', wbBk: '' }); }} /> No
                    </label>
                  </div>
                  {wbEnabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#555', fontSize: '11px' }}>WB (R)</label>
                        <input type="number" step="0.01" value={qualityData.wbR}
                          onChange={(e) => handleQualityInput('wbR', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '3px', fontWeight: '500', color: '#555', fontSize: '11px' }}>WB (BK)</label>
                        <input type="number" step="0.01" value={qualityData.wbBk}
                          onChange={(e) => handleQualityInput('wbBk', e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* WB(T) — auto-calculated, read-only */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>WB (T) — Auto</label>
                  <input type="number" step="0.01" readOnly value={qualityData.wbT}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', backgroundColor: '#e8f5e9', fontWeight: '700', cursor: 'not-allowed' }} />
                </div>

                {/* Paddy WB — radio Yes/No */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Paddy WB</label>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="paddyWbEnabled" checked={paddyWbEnabled} onChange={() => { setPaddyWbEnabled(true); setQualityData({ ...qualityData, paddyWb: '' }); }} /> Yes
                    </label>
                    <label style={{ fontSize: '11px', cursor: 'pointer' }}>
                      <input type="radio" name="paddyWbEnabled" checked={!paddyWbEnabled} onChange={() => { setPaddyWbEnabled(false); setQualityData({ ...qualityData, paddyWb: '' }); }} /> No
                    </label>
                  </div>
                  {paddyWbEnabled && (
                    <input type="number" step="0.01" value={qualityData.paddyWb}
                      onChange={(e) => handleQualityInput('paddyWb', e.target.value)}
                      style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  )}
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>
                  Upload Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setQualityData({ ...qualityData, uploadFile: e.target.files?.[0] || null })}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                />
              </div>

              {/* Reported By */}
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>
                  Reported By
                </label>
                <input
                  type="text"
                  readOnly
                  value={user?.username || 'Unknown'}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', backgroundColor: '#f5f5f5', fontWeight: '600', cursor: 'not-allowed' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowQualityModal(false);
                    setSelectedEntry(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '13px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: hasExistingQualityData ? '#3498db' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  {hasExistingQualityData ? 'Update Quality Parameters' : 'Submit Quality Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Confirmation Dialog - Main Form */}
      {showSaveConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
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
                style={{ padding: '8px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Dialog - Quality Data */}
      {showQualitySaveConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
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
                style={{ padding: '8px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {showEditModal && editingEntry && (
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
                <input value={formData.brokerName} onChange={(e) => handleInputChange('brokerName', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
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
                <input value={formData.variety} onChange={(e) => handleInputChange('variety', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
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
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '12px' }}>Sample Collected By</label>
                <input value={formData.sampleCollectedBy} onChange={(e) => handleInputChange('sampleCollectedBy', e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
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
              <button onClick={handleSaveEdit}
                style={{ padding: '8px 16px', backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                Save Changes
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

