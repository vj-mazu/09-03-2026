import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { sampleEntryApi } from '../utils/sampleEntryApi';
import type { SampleEntryWithDetails, SampleEntryFilters } from '../types/sampleEntry';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

import { API_URL } from '../config/api';

interface Broker {
  id: number;
  name: string;
}

interface Variety {
  id: number;
  name: string;
}

// Helper Component for Ledger Row with Sub-Row support
const EntryRow: React.FC<{
  entry: any;
  index: number;
  page: number;
  pageSize: number;
  isAdminOrManager: boolean;
  openEditModal: (entry: any) => void;
  cellStyle: React.CSSProperties;
}> = ({ entry, index, page, pageSize, isAdminOrManager, openEditModal, cellStyle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inspections = entry.lotAllotment?.physicalInspections || [];
  const hasMultipleLorries = inspections.length > 1;

  // Aggregate Data for Main Row
  const totalActualBags = inspections.reduce((sum: number, insp: any) => sum + Number(insp.bags || 0), 0);
  const lorryNumbers = inspections.map((insp: any) => insp.lorryNumber).filter(Boolean).join(', ');
  const allInventory = inspections.map((insp: any) => insp.inventoryData).filter(Boolean);
  const totalGrossWeight = allInventory.reduce((sum: number, inv: any) => sum + Number(inv.grossWeight || 0), 0);
  const totalTareWeight = allInventory.reduce((sum: number, inv: any) => sum + Number(inv.tareWeight || 0), 0);
  const totalNetWeight = allInventory.reduce((sum: number, inv: any) => sum + Number(inv.netWeight || 0), 0);

  const financialCalc = allInventory.find((inv: any) => inv.financialCalculation)?.financialCalculation;
  const totalAmount = allInventory.reduce((sum: number, inv: any) => sum + Number(inv.financialCalculation?.totalAmount || 0), 0);
  const avgRate = totalNetWeight > 0 ? (totalAmount / totalNetWeight * 100) : 0;

  const entryNumber = `A${String((page - 1) * pageSize + index + 1).padStart(2, '0')}`;

  const rateSummary = financialCalc ? (() => {
    const parts: string[] = [];
    if (financialCalc.suteRate && Number(financialCalc.suteRate) > 0) parts.push(`S: ${financialCalc.suteRate} ${financialCalc.suteType === 'PER_BAG' ? '/bag' : '/ton'}`);
    if (financialCalc.baseRateValue) parts.push(`BR: ₹${Number(financialCalc.baseRateValue).toLocaleString()} ${financialCalc.baseRateUnit === 'PER_BAG' ? '/bag' : '/Q'}`);
    if (financialCalc.brokerageRate && Number(financialCalc.brokerageRate) > 0) parts.push(`B: ${financialCalc.brokerageRate} ${financialCalc.brokerageUnit === 'PER_BAG' ? '/bag' : '/Q'}`);
    if (financialCalc.hamaliRate && Number(financialCalc.hamaliRate) > 0) parts.push(`H: ${financialCalc.hamaliRate} ${financialCalc.hamaliUnit === 'PER_BAG' ? '/bag' : '/Q'}`);
    if (financialCalc.lfinRate && Number(financialCalc.lfinRate) > 0) parts.push(`LF: ${financialCalc.lfinRate} ${financialCalc.lfinUnit === 'PER_BAG' ? '/bag' : '/Q'}`);
    if (financialCalc.egbRate && Number(financialCalc.egbRate) > 0) parts.push(`EGB: ${financialCalc.egbRate}/bag`);
    return parts.join('\n');
  })() : null;

  const rowBg = entry.workflowStatus === 'FAILED' ? '#fde8e8' : entry.workflowStatus === 'COMPLETED' ? '#f0f9ff' : (index % 2 === 0 ? '#f7f8fa' : '#ffffff');

  const fmt = (v: any, forceDecimal = false) => {
    if (v == null || v === '') return '-';
    const n = Number(v);
    if (isNaN(n) || n === 0) return '-';
    if (forceDecimal) return n.toFixed(1);
    return n % 1 === 0 ? String(Math.round(n)) : String(parseFloat(n.toFixed(2)));
  };

  return (
    <React.Fragment>
      <tr style={{ backgroundColor: rowBg, fontWeight: hasMultipleLorries ? 600 : 'normal' }}>
        <td style={{ ...cellStyle, textAlign: 'center', cursor: hasMultipleLorries ? 'pointer' : 'default', minWidth: '40px' }} onClick={() => hasMultipleLorries && setIsExpanded(!isExpanded)}>
          {hasMultipleLorries ? (isExpanded ? '▼ ' : '▶ ') : ''}{entryNumber}
        </td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
        <td style={cellStyle}>{entry.entryType}</td>
        <td style={cellStyle}>{entry.brokerName}</td>
        <td style={{ ...cellStyle, fontWeight: 700 }}>{entry.variety}</td>
        <td style={cellStyle}>{entry.partyName}</td>
        <td style={cellStyle}>{entry.location}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.bags?.toLocaleString('en-IN')}</td>
        <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontStyle: hasMultipleLorries ? 'italic' : 'normal' }}>
          {hasMultipleLorries ? `${inspections.length} trips` : (lorryNumbers || entry.lorryNumber || '-')}
        </td>
        <td style={cellStyle}>
          <span style={{
            padding: '1px 4px', borderRadius: '3px', fontWeight: 700, fontSize: '7px',
            backgroundColor: entry.workflowStatus === 'COMPLETED' ? '#d4edda' : entry.workflowStatus === 'FAILED' ? '#f8d7da' : '#cce5ff',
            color: entry.workflowStatus === 'COMPLETED' ? '#155724' : entry.workflowStatus === 'FAILED' ? '#721c24' : '#004085'
          }}>
            {entry.workflowStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </span>
        </td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.moisture)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.qualityParameters?.cutting1 && entry.qualityParameters?.cutting2 ? `${fmt(entry.qualityParameters.cutting1, true)}x${fmt(entry.qualityParameters.cutting2, true)}` : (fmt(entry.qualityParameters?.cutting1, true))}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.bend, true)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.mixS)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.mixL)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.mix)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.kandu)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.oil)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.sk)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{fmt(entry.qualityParameters?.grainsCount)}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.qualityParameters?.wbR || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.qualityParameters?.wbBk || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.qualityParameters?.wbT || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.qualityParameters?.paddyWb || '-'}</td>
        <td style={cellStyle}>{entry.qualityParameters?.reportedByUser?.username || '-'}</td>
        <td style={cellStyle}>{entry.cookingReport?.status || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{entry.lotSelectionDecision || '-'}</td>
        <td style={cellStyle}>{entry.lotSelectionByUser?.username || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>₹{entry.offeringPrice || '-'}</td>
        <td style={cellStyle}>{entry.priceType || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right', color: '#27ae60', fontWeight: 700 }}>₹{entry.finalPrice || '-'}</td>
        <td style={cellStyle}>{entry.lotAllotment?.supervisor?.username || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{totalActualBags?.toLocaleString('en-IN') || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>{totalGrossWeight || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>{totalTareWeight || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>{totalNetWeight || '-'}</td>
        <td style={{ ...cellStyle, fontSize: '7px', whiteSpace: 'pre-line' }}>{rateSummary || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>₹{financialCalc?.baseRateValue || '-'}</td>
        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 800, color: '#145a32' }}>₹{totalAmount.toLocaleString()}</td>
        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, color: '#145a32' }}>₹{avgRate.toFixed(2)}</td>
        <td style={cellStyle}>
          <div style={{ display: 'flex', gap: '2px' }}>
            <button onClick={() => window.open(`/final-review?id=${entry.id}`, '_blank')} style={{ fontSize: '7px', cursor: 'pointer', background: '#1e3a5f', color: 'white', border: 'none', padding: '2px 4px' }}>View</button>
            {isAdminOrManager && <button onClick={() => openEditModal(entry)} style={{ fontSize: '7px', cursor: 'pointer', background: '#e67e22', color: 'white', border: 'none', padding: '2px 4px' }}>Edit</button>}
          </div>
        </td>
      </tr>

      {isExpanded && hasMultipleLorries && inspections.map((trip: any, tIdx: number) => {
        const inv = trip.inventoryData;
        const fin = inv?.financialCalculation;

        const tripRateSummary = fin ? (() => {
          const parts: string[] = [];
          if (fin.suteRate && Number(fin.suteRate) > 0) parts.push(`S: ${fin.suteRate}`);
          if (fin.baseRateValue) parts.push(`BR: ₹${Number(fin.baseRateValue).toLocaleString()}`);
          if (fin.brokerageRate && Number(fin.brokerageRate) > 0) parts.push(`B: ${fin.brokerageRate}`);
          if (fin.hamaliRate && Number(fin.hamaliRate) > 0) parts.push(`H: ${fin.hamaliRate}`);
          if (fin.lfinRate && Number(fin.lfinRate) > 0) parts.push(`LF: ${fin.lfinRate}`);
          return parts.join(', ');
        })() : null;

        return (
          <tr key={trip.id} style={{ backgroundColor: '#f0f4f8' }}>
            <td style={{ ...cellStyle, textAlign: 'center', color: '#64748b' }}>└ Trip {tIdx + 1}</td>
            <td style={cellStyle}>{new Date(trip.inspectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
            <td style={cellStyle}>-</td>
            <td style={cellStyle}>-</td>
            <td style={cellStyle}>-</td>
            <td style={cellStyle}>-</td>
            <td style={cellStyle}>-</td>
            <td style={cellStyle}>-</td>
            <td style={{ ...cellStyle, fontWeight: 700 }}>{trip.lorryNumber}</td>
            <td style={cellStyle}>-</td>
            <td style={cellStyle}>-</td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{trip.cutting1 && trip.cutting2 ? `${trip.cutting1}x${trip.cutting2}` : (trip.cutting1 || '-')}</td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{trip.bend || '-'}</td>
            <td colSpan={19} style={{ ...cellStyle, textAlign: 'center', color: '#94a3b8', fontSize: '7px', fontStyle: 'italic' }}>Trip Details: {trip.remarks || 'No remarks'}</td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{trip.bags?.toLocaleString('en-IN')}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{inv?.grossWeight || '-'}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{inv?.tareWeight || '-'}</td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>{inv?.netWeight || '-'}</td>
            <td style={{ ...cellStyle, fontSize: '7px' }}>{tripRateSummary || '-'}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>₹{fin?.baseRateValue || '-'}</td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>₹{fin?.totalAmount?.toLocaleString() || '-'}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>₹{fin?.average ? Number(fin.average).toFixed(2) : '-'}</td>
            <td style={cellStyle}></td>
          </tr>
        );
      })}
    </React.Fragment>
  );
};

const SampleEntryLedger: React.FC = () => {
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager' || (user?.role as string) === 'owner';
  const [entries, setEntries] = useState<SampleEntryWithDetails[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<SampleEntryFilters>({
    startDate: '',
    endDate: '',
    broker: '',
    variety: '',
    party: '',
    location: '',
    status: undefined
  });

  useEffect(() => {
    loadBrokers();
    loadVarieties();
    loadLedger();
  }, []);

  const loadBrokers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/locations/brokers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBrokers((response.data as any).brokers || []);
    } catch (error: any) {
      console.error('Failed to load brokers:', error);
    }
  };

  const loadVarieties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/locations/varieties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVarieties((response.data as any).varieties || []);
    } catch (error: any) {
      console.error('Failed to load varieties:', error);
    }
  };

  const loadLedger = useCallback(async (currentPage = page, overridePageSize?: number) => {
    try {
      setLoading(true);
      const effectivePageSize = overridePageSize ?? pageSize;
      const response = await sampleEntryApi.getSampleEntryLedger({
        ...filters,
        page: currentPage,
        pageSize: effectivePageSize,
        excludeEntryType: 'RICE_SAMPLE'
      });
      // The API now returns { entries, total, page, pageSize }
      const data = response.data as any;
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error loading ledger:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const handleFilterChange = (field: keyof SampleEntryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    setPage(1); // Reset to first page on new filter application
    loadLedger(1);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      startDate: '',
      endDate: '',
      broker: '',
      variety: '',
      party: '',
      status: undefined,
      location: ''
    };
    setFilters(clearedFilters);
    setPage(1);
    loadLedger(1);
  };

  const openEditModal = (entry: any) => {
    const inspections = entry.lotAllotment?.physicalInspections || [];
    setEditEntry(entry);
    setEditForm({
      // Sample entry fields
      partyName: entry.partyName || '',
      brokerName: entry.brokerName || '',
      variety: entry.variety || '',
      location: entry.location || '',
      bags: entry.bags || '',
      lorryNumber: entry.lorryNumber || '',
      offeringPrice: entry.offeringPrice || '',
      finalPrice: entry.finalPrice || '',
      priceType: entry.priceType || '',
      // Quality parameters
      moisture: entry.qualityParameters?.moisture || '',
      cutting1: entry.qualityParameters?.cutting1 || '',
      cutting2: entry.qualityParameters?.cutting2 || '',
      bend: entry.qualityParameters?.bend || '',
      mixS: entry.qualityParameters?.mixS || '',
      mixL: entry.qualityParameters?.mixL || '',
      mix: (entry.qualityParameters as any)?.mix || '',
      kandu: (entry.qualityParameters as any)?.kandu || '',
      oil: (entry.qualityParameters as any)?.oil || '',
      sk: (entry.qualityParameters as any)?.sk || '',
      grainsCount: (entry.qualityParameters as any)?.grainsCount || '',
      wbR: (entry.qualityParameters as any)?.wbR || '',
      wbBk: (entry.qualityParameters as any)?.wbBk || '',
      wbT: (entry.qualityParameters as any)?.wbT || '',
      paddyWb: (entry.qualityParameters as any)?.paddyWb || '',
      // Physical inspections (edit each trip)
      physicalInspections: inspections.map((insp: any) => ({
        id: insp.id,
        inspectionDate: insp.inspectionDate ? insp.inspectionDate.split('T')[0] : '',
        lorryNumber: insp.lorryNumber || '',
        bags: insp.bags || '',
        cutting1: insp.cutting1 || '',
        cutting2: insp.cutting2 || '',
        bend: insp.bend || '',
        remarks: insp.remarks || ''
      }))
    });
  };

  const handleEditFormChange = (field: string, value: any) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleInspectionChange = (idx: number, field: string, value: any) => {
    setEditForm((prev: any) => {
      const updated = [...prev.physicalInspections];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, physicalInspections: updated };
    });
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // 1. Update sample entry basic fields
      await axios.put(`${API_URL}/sample-entries/${editEntry.id}`, {
        partyName: editForm.partyName,
        brokerName: editForm.brokerName,
        variety: editForm.variety,
        location: editForm.location,
        bags: Number(editForm.bags),
        lorryNumber: editForm.lorryNumber,
        offeringPrice: editForm.offeringPrice ? Number(editForm.offeringPrice) : null,
        finalPrice: editForm.finalPrice ? Number(editForm.finalPrice) : null,
        priceType: editForm.priceType || null
      }, { headers });

      // 2. Update quality parameters (if they exist)
      if (editEntry.qualityParameters) {
        await axios.put(`${API_URL}/sample-entries/${editEntry.id}/quality-parameters`, {
          moisture: editForm.moisture,
          cutting1: editForm.cutting1,
          cutting2: editForm.cutting2,
          bend: editForm.bend,
          mixS: editForm.mixS,
          mixL: editForm.mixL,
          mix: editForm.mix,
          kandu: editForm.kandu,
          oil: editForm.oil,
          sk: editForm.sk,
          grainsCount: editForm.grainsCount,
          wbR: editForm.wbR,
          wbBk: editForm.wbBk,
          wbT: editForm.wbT,
          paddyWb: editForm.paddyWb
        }, { headers });
      }

      // 3. Update each physical inspection
      for (const insp of editForm.physicalInspections || []) {
        if (insp.id) {
          await axios.put(`${API_URL}/sample-entries/${editEntry.id}/physical-inspection/${insp.id}`, {
            inspectionDate: insp.inspectionDate,
            lorryNumber: insp.lorryNumber,
            bags: Number(insp.bags),
            cutting1: Number(insp.cutting1),
            cutting2: Number(insp.cutting2),
            bend: Number(insp.bend),
            remarks: insp.remarks
          }, { headers });
        }
      }

      showNotification('All changes saved successfully!', 'success');
      setEditEntry(null);
      loadLedger(page);
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '12px 16px', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#2c3e50', fontWeight: 700 }}>Sample Entry Ledger</h2>

      {/* Filters */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '10px',
        borderRadius: '4px',
        marginBottom: '12px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>Start Date</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>End Date</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>Broker</label>
            <select
              value={filters.broker || ''}
              onChange={(e) => handleFilterChange('broker', e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            >
              <option value="">All Brokers</option>
              {brokers.map(broker => (
                <option key={broker.id} value={broker.name}>{broker.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>Variety</label>
            <select
              value={filters.variety || ''}
              onChange={(e) => handleFilterChange('variety', e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            >
              <option value="">All Varieties</option>
              {varieties.map(variety => (
                <option key={variety.id} value={variety.name}>{variety.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>Party</label>
            <input
              type="text"
              value={filters.party || ''}
              onChange={(e) => handleFilterChange('party', e.target.value)}
              placeholder="Search party..."
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>Location</label>
            <input
              type="text"
              value={filters.location || ''}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              placeholder="Search location..."
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px', color: '#495057', fontWeight: 500 }}>Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px' }}
            >
              <option value="">All</option>
              <option value="STAFF_ENTRY">Staff Entry</option>
              <option value="QUALITY_CHECK">Quality Check</option>
              <option value="LOT_SELECTION">Lot Selection</option>
              <option value="COOKING_REPORT">Cooking Report</option>
              <option value="FINAL_REPORT">Final Report</option>
              <option value="LOT_ALLOTMENT">Lot Allotment</option>
              <option value="PHYSICAL_INSPECTION">Physical Inspection</option>
              <option value="INVENTORY_ENTRY">Inventory Entry</option>
              <option value="OWNER_FINANCIAL">Owner Financial</option>
              <option value="MANAGER_FINANCIAL">Manager Financial</option>
              <option value="FINAL_REVIEW">Final Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
            <button
              onClick={applyFilters}
              style={{
                padding: '6px 15px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '3px'
              }}
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              style={{
                padding: '6px 15px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '3px'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '8px',
          border: '1px solid #bbb',
          fontFamily: "'Segoe UI', Tahoma, sans-serif"
        }}>
          <thead>
            {(() => {
              const thStyle: React.CSSProperties = {
                border: '1px solid #2a4a6b',
                padding: '5px 4px',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: '8.5px',
                textTransform: 'capitalize',
                letterSpacing: '0.4px',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: '#1e3a5f',
                textAlign: 'center'
              };
              return (
                <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
                  <th style={thStyle}>No</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Broker</th>
                  <th style={thStyle}>Variety</th>
                  <th style={thStyle}>Party</th>
                  <th style={thStyle}>Paddy Location</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Bags</th>
                  <th style={thStyle}>Lorry</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>M%</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Cut</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Bend</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Mix S</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Mix L</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Mix</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Kandu</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Oil</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>SK</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Grains</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>WB R</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>WB Bk</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>WB T</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Paddy WB</th>
                  <th style={thStyle}>Q.Supv</th>
                  <th style={thStyle}>Cook</th>
                  <th style={thStyle}>Decision</th>
                  <th style={thStyle}>By</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Offer ₹</th>
                  <th style={thStyle}>P.Type</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Final ₹</th>
                  <th style={thStyle}>Supervisor</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Act.Bags</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Gross</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tare</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Net Wt</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Rate Info</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Base Rate</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total Amt</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Avg Rate</th>
                  <th style={thStyle}></th>
                </tr>
              );
            })()}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={41} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  ⏳ Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={41} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  No entries found
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  page={page}
                  pageSize={pageSize}
                  isAdminOrManager={isAdminOrManager}
                  openEditModal={openEditModal}
                  cellStyle={{ border: '1px solid #ddd', padding: '3px 4px', verticalAlign: 'middle', fontSize: '9px', lineHeight: '1.3' }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #ddd',
        marginTop: '-1px'
      }}>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              setPageSize(newSize);
              setPage(1);
              loadLedger(1, newSize);
            }}
            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value={10}>10 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={500}>500 per page</option>
            <option value={1000}>1000 per page</option>
            <option value={2000}>2000 per page</option>
            <option value={5000}>5000 per page</option>
            <option value={99999}>All</option>
          </select>
          <button
            disabled={page === 1}
            onClick={() => { setPage(p => p - 1); loadLedger(page - 1); }}
            style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #ccc', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Page {page}</span>
          <button
            disabled={page * pageSize >= total}
            onClick={() => { setPage(p => p + 1); loadLedger(page + 1); }}
            style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #ccc', cursor: page * pageSize >= total ? 'not-allowed' : 'pointer' }}
          >
            Next
          </button>
        </div>
      </div >

      {/* Summary */}
      {
        entries.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '5px',
            fontSize: '12px'
          }}>
            <strong>Total Entries: {entries.length}</strong>
          </div>
        )
      }

      {/* Edit Modal */}
      {
        editEntry && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            paddingTop: '30px', overflowY: 'auto'
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '20px',
              width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>✏️ Admin Edit — {editEntry.partyName} ({editEntry.variety})</h3>
                <button onClick={() => setEditEntry(null)} style={{ fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>

              {/* Section 1: Sample Entry */}
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#1e3a5f', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>📋 Sample Entry Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[{ l: 'Party Name', f: 'partyName' }, { l: 'Broker', f: 'brokerName' }, { l: 'Variety', f: 'variety' }, { l: 'Location', f: 'location' }, { l: 'Bags', f: 'bags', t: 'number' }, { l: 'Lorry No.', f: 'lorryNumber' }, { l: 'Offering ₹', f: 'offeringPrice', t: 'number' }, { l: 'Final ₹', f: 'finalPrice', t: 'number' }, { l: 'Price Type', f: 'priceType' }].map(({ l, f, t }) => (
                    <div key={f}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#666', marginBottom: '2px' }}>{l}</label>
                      <input type={t || 'text'} value={editForm[f] || ''} onChange={e => handleEditFormChange(f, e.target.value)}
                        style={{ width: '100%', padding: '5px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Quality Parameters */}
              {editEntry.qualityParameters && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#8e44ad', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>🔬 Quality Parameters</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                    {[{ l: 'Moisture%', f: 'moisture' }, { l: 'Cut 1', f: 'cutting1' }, { l: 'Cut 2', f: 'cutting2' }, { l: 'Bend', f: 'bend' }, { l: 'Mix S', f: 'mixS' }, { l: 'Mix L', f: 'mixL' }, { l: 'Mix', f: 'mix' }, { l: 'Kandu', f: 'kandu' }, { l: 'Oil', f: 'oil' }, { l: 'SK', f: 'sk' }, { l: 'Grains', f: 'grainsCount' }, { l: 'WB R', f: 'wbR' }, { l: 'WB Bk', f: 'wbBk' }, { l: 'WB T', f: 'wbT' }, { l: 'Paddy WB', f: 'paddyWb' }].map(({ l, f }) => (
                      <div key={f}>
                        <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#666', marginBottom: '1px' }}>{l}</label>
                        <input type="number" step="0.01" value={editForm[f] || ''} onChange={e => handleEditFormChange(f, e.target.value)}
                          style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Physical Inspections */}
              {editForm.physicalInspections?.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#27ae60', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>🏗️ Physical Inspections ({editForm.physicalInspections.length} trip(s))</h4>
                  {editForm.physicalInspections.map((insp: any, idx: number) => (
                    <div key={insp.id || idx} style={{ backgroundColor: '#f8faf8', padding: '8px', borderRadius: '4px', marginBottom: '6px', border: '1px solid #e8e8e8' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', marginBottom: '4px' }}>Trip {idx + 1}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {[{ l: 'Date', f: 'inspectionDate', t: 'date' }, { l: 'Lorry', f: 'lorryNumber' }, { l: 'Bags', f: 'bags', t: 'number' }, { l: 'Cut 1', f: 'cutting1', t: 'number' }, { l: 'Cut 2', f: 'cutting2', t: 'number' }, { l: 'Bend', f: 'bend', t: 'number' }, { l: 'Remarks', f: 'remarks' }].map(({ l, f, t }) => (
                          <div key={f}>
                            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#666', marginBottom: '1px' }}>{l}</label>
                            <input type={t || 'text'} value={insp[f] || ''} onChange={e => handleInspectionChange(idx, f, e.target.value)}
                              style={{ width: '100%', padding: '4px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '2px solid #eee', paddingTop: '12px' }}>
                <button onClick={() => setEditEntry(null)} style={{ padding: '8px 20px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#f5f5f5' }}>
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={saving} style={{
                  padding: '8px 25px', fontSize: '13px', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer',
                  backgroundColor: saving ? '#95a5a6' : '#27ae60', color: 'white', fontWeight: 700
                }}>
                  {saving ? '⏳ Saving...' : '💾 Save All Changes'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default SampleEntryLedger;
