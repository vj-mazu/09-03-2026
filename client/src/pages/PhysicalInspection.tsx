import React, { useState, useEffect } from 'react';
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
  workflowStatus: string;
  offeringPrice?: number;
  priceType?: string;
  finalPrice?: number;
}

interface PreviousInspection {
  id: string;
  inspectionDate: string;
  lorryNumber: string;
  bags: number;
  cutting1: number;
  cutting2: number;
  bend: number;
  reportedBy: {
    username: string;
  };
}

interface InspectionProgress {
  totalBags: number;
  inspectedBags: number;
  remainingBags: number;
  progressPercentage: number;
  previousInspections: PreviousInspection[];
}

const PhysicalInspection: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [inspectionProgress, setInspectionProgress] = useState<{ [key: string]: InspectionProgress }>({});

  // Inspection form data
  const [inspectionData, setInspectionData] = useState<{
    [key: string]: {
      inspectionDate: string;
      lorryNumber: string;
      actualBags: number;
      cutting: string;
      bend: string;
      halfLorryImage: File | null;
      fullLorryImage: File | null;
      remarks: string;
    }
  }>({});

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Query for multiple statuses - LOT_ALLOTMENT, PHYSICAL_INSPECTION, INVENTORY_ENTRY, OWNER_FINANCIAL, MANAGER_FINANCIAL, FINAL_REVIEW, COMPLETED
      // This ensures lots don't disappear after first save or after completion
      const [lotAllotmentResponse, physicalInspectionResponse, inventoryEntryResponse, ownerFinancialResponse, managerFinancialResponse, finalReviewResponse, completedResponse] = await Promise.all([
        axios.get(`${API_URL}/sample-entries/by-role?status=LOT_ALLOTMENT`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=PHYSICAL_INSPECTION`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=INVENTORY_ENTRY`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=OWNER_FINANCIAL`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=MANAGER_FINANCIAL`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=FINAL_REVIEW`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/sample-entries/by-role?status=COMPLETED`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const lotAllotmentEntries = (lotAllotmentResponse.data as any).entries || [];
      const physicalInspectionEntries = (physicalInspectionResponse.data as any).entries || [];
      const inventoryEntryEntries = (inventoryEntryResponse.data as any).entries || [];
      const ownerFinancialEntries = (ownerFinancialResponse.data as any).entries || [];
      const managerFinancialEntries = (managerFinancialResponse.data as any).entries || [];
      const finalReviewEntries = (finalReviewResponse.data as any).entries || [];
      const completedEntries = (completedResponse.data as any).entries || [];

      // Combine all lists and remove duplicates
      const allMap = new Map();
      [...lotAllotmentEntries, ...physicalInspectionEntries, ...inventoryEntryEntries, ...ownerFinancialEntries, ...managerFinancialEntries, ...finalReviewEntries, ...completedEntries].forEach(entry => {
        allMap.set(entry.id, entry);
      });
      const allEntries = Array.from(allMap.values());
      setEntries(allEntries);

      // Load inspection progress for each entry
      for (const entry of allEntries) {
        await loadInspectionProgress(entry.id);
      }
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadInspectionProgress = async (entryId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<InspectionProgress>(`${API_URL}/sample-entries/${entryId}/inspection-progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: response.data as InspectionProgress
      }));
    } catch (error: any) {
      console.error('Failed to load inspection progress:', error);
      console.error('Error response:', error.response?.data);
      // Set default progress if API fails
      setInspectionProgress(prev => ({
        ...prev,
        [entryId]: {
          totalBags: 0,
          inspectedBags: 0,
          remainingBags: 0,
          progressPercentage: 0,
          previousInspections: []
        }
      }));
    }
  };

  const handleInputChange = (entryId: string, field: string, value: string | number) => {
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value
      }
    }));
  };

  const handleFileChange = (entryId: string, field: 'halfLorryImage' | 'fullLorryImage', file: File | null) => {
    setInspectionData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: file
      }
    }));
  };

  const handleSubmitInspection = async (entryId: string) => {
    const data = inspectionData[entryId];
    const progress = inspectionProgress[entryId];

    if (!data || !data.inspectionDate || !data.lorryNumber || !data.actualBags ||
      !data.cutting || !data.bend) {
      showNotification('Please fill all required fields', 'error');
      return;
    }

    // Parse cutting: e.g. "12x20" → cutting1=12, cutting2=20
    const cuttingParts = data.cutting.split(/[xX×]/);
    const cutting1 = parseFloat(cuttingParts[0]?.trim()) || 0;
    const cutting2 = cuttingParts.length > 1 ? (parseFloat(cuttingParts[1]?.trim()) || 0) : 0;

    // Parse bend: e.g. "32x24" → bend value = 32 (or full string)
    const bendParts = data.bend.split(/[xX×]/);
    const bendValue = parseFloat(bendParts[0]?.trim()) || 0;

    // Validate bags don't exceed remaining
    if (progress && data.actualBags > progress.remainingBags) {
      showNotification(`Cannot inspect ${data.actualBags} bags. Only ${progress.remainingBags} bags remaining.`, 'error');
      return;
    }

    // Validate bags is not zero or negative
    if (!data.actualBags || data.actualBags <= 0) {
      showNotification('Please enter valid number of bags', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('inspectionDate', data.inspectionDate);
      formData.append('lorryNumber', data.lorryNumber);
      formData.append('actualBags', data.actualBags.toString());
      formData.append('cutting1', cutting1.toString());
      formData.append('cutting2', cutting2.toString());
      formData.append('bend', bendValue.toString());
      if (data.remarks) formData.append('remarks', data.remarks);

      // Add images if selected
      if (data.halfLorryImage) {
        formData.append('halfLorryImage', data.halfLorryImage);
      }
      if (data.fullLorryImage) {
        formData.append('fullLorryImage', data.fullLorryImage);
      }

      await axios.post(
        `${API_URL}/sample-entries/${entryId}/physical-inspection`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      showNotification('Physical inspection submitted successfully', 'success');
      setSelectedEntry(null);
      setInspectionData(prev => {
        const newData = { ...prev };
        delete newData[entryId];
        return newData;
      });

      // Reload entries and progress
      await loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to submit inspection', 'error');
    }
  };

  const initializeInspectionData = (entryId: string) => {
    const progress = inspectionProgress[entryId];
    if (!inspectionData[entryId]) {
      setInspectionData(prev => ({
        ...prev,
        [entryId]: {
          inspectionDate: new Date().toISOString().split('T')[0],
          lorryNumber: '',
          actualBags: progress?.remainingBags || 0,
          cutting: '',
          bend: '',
          halfLorryImage: null,
          fullLorryImage: null,
          remarks: ''
        }
      }));
    }
    setSelectedEntry(entryId);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#4CAF50';
    if (percentage >= 50) return '#FFC107';
    return '#2196F3';
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: '600', color: '#333' }}>
        Lots Allotted - Physical Inspection
      </h2>
      <p style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
        Reported by: {user?.username || 'Unknown'} (Automatic)
      </p>

      <div style={{
        overflowX: 'auto',
        backgroundColor: 'white',
        border: '1px solid #ddd'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'left', width: '80px' }}>Date</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'left', width: '80px' }}>Broker</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'left', width: '80px' }}>Variety</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'left', width: '100px' }}>Party</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'left', width: '80px' }}>Location</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'right', width: '80px' }}>Total</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'right', width: '80px' }}>Loading</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'right', width: '80px' }}>Balance</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'center', width: '120px' }}>Progress</th>
              <th style={{ border: '1px solid #357abd', padding: '8px', fontWeight: '600', fontSize: '11px', textAlign: 'center', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No lots allotted for inspection</td></tr>
            ) : (
              entries.map((entry, index) => {
                const progress = inspectionProgress[entry.id];
                const progressPercentage = progress?.progressPercentage || 0;

                // Check if this is a new lot (different from previous)
                const prevEntry = entries[index - 1];
                const isNewLot = !prevEntry || prevEntry.id !== entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    {/* Add visual gap between different lots */}
                    {isNewLot && index > 0 && (
                      <tr>
                        <td colSpan={10} style={{
                          height: '15px',
                          backgroundColor: '#e0e0e0',
                          borderLeft: '3px solid #4a90e2',
                          borderRight: '3px solid #4a90e2'
                        }}>
                          <div style={{
                            fontSize: '10px',
                            color: '#666',
                            padding: '0 10px',
                            fontWeight: '600'
                          }}>
                            📦 New Lot: {entry.partyName} - {entry.variety} ({entry.bags} bags)
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                      <td style={{ border: '1px solid #ddd', padding: '6px', fontSize: '11px', textAlign: 'left' }}>
                        {new Date(entry.entryDate).toLocaleDateString()}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', fontSize: '11px', textAlign: 'left' }}>{entry.brokerName}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', fontSize: '11px', textAlign: 'left' }}>{entry.variety}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', fontSize: '11px', textAlign: 'left' }}>{entry.partyName}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', fontSize: '11px', textAlign: 'left' }}>{entry.location}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', fontSize: '11px', fontWeight: '600' }}>
                        {progress?.totalBags || entry.bags}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', fontSize: '11px', color: '#4CAF50', fontWeight: '600' }}>
                        {progress?.inspectedBags || 0}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', fontSize: '11px', color: '#FF9800', fontWeight: '600' }}>
                        {progress?.remainingBags || entry.bags}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{
                            flex: 1,
                            height: '20px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '10px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${progressPercentage}%`,
                              backgroundColor: getProgressColor(progressPercentage),
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: '600', minWidth: '35px' }}>
                            {progressPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                        <button
                          onClick={() => initializeInspectionData(entry.id)}
                          disabled={progressPercentage >= 100}
                          style={{
                            fontSize: '10px',
                            padding: '4px 8px',
                            backgroundColor: progressPercentage >= 100 ? '#ccc' : (selectedEntry === entry.id ? '#FF9800' : '#4CAF50'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: progressPercentage >= 100 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {progressPercentage >= 100 ? 'Complete' : (selectedEntry === entry.id ? 'Editing...' : 'Add Inspection')}
                        </button>
                      </td>
                    </tr>

                    {/* Show previous inspections history */}
                    {progress && progress.previousInspections && progress.previousInspections.length > 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: '10px', backgroundColor: '#f0f8ff', border: '1px solid #ddd' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: '#333' }}>
                            📋 Previous Inspections ({progress.previousInspections.length})
                          </div>
                          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#e3f2fd' }}>
                                <th style={{ border: '1px solid #ddd', padding: '4px' }}>Date</th>
                                <th style={{ border: '1px solid #ddd', padding: '4px' }}>Lorry Number</th>
                                <th style={{ border: '1px solid #ddd', padding: '4px' }}>Bags</th>
                                <th style={{ border: '1px solid #ddd', padding: '4px' }}>Cutting</th>
                                <th style={{ border: '1px solid #ddd', padding: '4px' }}>Bend</th>
                                <th style={{ border: '1px solid #ddd', padding: '4px' }}>Inspected By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {progress.previousInspections.map((inspection, idx) => (
                                <tr key={inspection.id} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                                  <td style={{ border: '1px solid #ddd', padding: '4px' }}>
                                    {new Date(inspection.inspectionDate).toLocaleDateString()}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '4px' }}>{inspection.lorryNumber}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right', fontWeight: '600' }}>
                                    {inspection.bags}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{inspection.cutting1} x {inspection.cutting2}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right' }}>{inspection.bend}</td>
                                  <td style={{ border: '1px solid #ddd', padding: '4px' }}>{inspection.reportedBy.username}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}

                    {/* Inspection form */}
                    {selectedEntry === entry.id && (
                      <tr>
                        <td colSpan={10} style={{ padding: '15px', backgroundColor: '#fff3e0', border: '1px solid #ddd' }}>
                          <div style={{ maxWidth: '900px' }}>
                            <h3 style={{ marginBottom: '15px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                              Add New Inspection - Remaining Bags: {progress?.remainingBags || entry.bags}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                              <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                  Inspection date *
                                </label>
                                <input
                                  type="date"
                                  value={inspectionData[entry.id]?.inspectionDate || ''}
                                  onChange={(e) => handleInputChange(entry.id, 'inspectionDate', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                  Lorry number *
                                </label>
                                <input
                                  type="text"
                                  value={inspectionData[entry.id]?.lorryNumber || ''}
                                  onChange={(e) => handleInputChange(entry.id, 'lorryNumber', e.target.value.toUpperCase())}
                                  placeholder="Enter lorry number"
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    textTransform: 'uppercase'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                  Actual bags (this lorry) *
                                </label>
                                <input
                                  type="number"
                                  value={inspectionData[entry.id]?.actualBags || ''}
                                  onChange={(e) => handleInputChange(entry.id, 'actualBags', Number(e.target.value))}
                                  placeholder={`Max: ${progress?.remainingBags || entry.bags}`}
                                  max={progress?.remainingBags || entry.bags}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                              <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                      Cutting *
                                    </label>
                                    <input
                                      type="text"
                                      value={inspectionData[entry.id]?.cutting || ''}
                                      onChange={(e) => handleInputChange(entry.id, 'cutting', e.target.value)}
                                      placeholder="e.g. 12x20"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        fontSize: '11px',
                                        border: '1px solid #ddd',
                                        borderRadius: '3px'
                                      }}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                      Bend *
                                    </label>
                                    <input
                                      type="text"
                                      value={inspectionData[entry.id]?.bend || ''}
                                      onChange={(e) => handleInputChange(entry.id, 'bend', e.target.value)}
                                      placeholder="e.g. 32"
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        fontSize: '11px',
                                        border: '1px solid #ddd',
                                        borderRadius: '3px'
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                  Half lorry image (optional)
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange(entry.id, 'halfLorryImage', e.target.files?.[0] || null)}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                  Full lorry image (optional)
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange(entry.id, 'fullLorryImage', e.target.files?.[0] || null)}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px'
                                  }}
                                />
                              </div>
                              <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', fontWeight: '600' }}>
                                  Remarks
                                </label>
                                <textarea
                                  value={inspectionData[entry.id]?.remarks || ''}
                                  onChange={(e) => handleInputChange(entry.id, 'remarks', e.target.value)}
                                  placeholder="Enter any remarks"
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    border: '1px solid #ddd',
                                    borderRadius: '3px',
                                    resize: 'vertical'
                                  }}
                                />
                              </div>
                            </div>
                            <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                              <button
                                onClick={() => handleSubmitInspection(entry.id)}
                                style={{
                                  fontSize: '11px',
                                  padding: '6px 12px',
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                Submit Inspection
                              </button>
                              <button
                                onClick={() => setSelectedEntry(null)}
                                style={{
                                  fontSize: '11px',
                                  padding: '6px 12px',
                                  backgroundColor: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PhysicalInspection;
