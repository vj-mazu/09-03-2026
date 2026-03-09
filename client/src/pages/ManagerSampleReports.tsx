import React, { useState, useEffect } from 'react';
import AdminSampleBook2 from './AdminSampleBook2';
import AssigningSupervisor from './AssigningSupervisor';
import AllottedSupervisors from './AllottedSupervisors';
import LoadingLots from './LoadingLots';
import CompletedLots from './CompletedLots';
import SampleEntryPage from './SampleEntry';
import LotSelection from './LotSelection';
import CookingReport from './CookingReport';
type TabKey = 'paddy-samples' | 'pending-lots' | 'cooking-report' | 'loading-lots' | 'completed-lots' | 'sample-book-2' | 'assigning-supervisor' | 'allotted-supervisors';

interface TabConfig {
    key: TabKey;
    label: string;
    icon: string;
    color: string;
}

const tabs: TabConfig[] = [
    { key: 'paddy-samples', label: 'Paddy Sample Records', icon: '🌾', color: '#2e7d32' },
    { key: 'sample-book-2', label: 'Paddy Sample Book', icon: '📗', color: '#1565c0' },
    { key: 'pending-lots', label: 'Pending (Sample Selection)', icon: '📋', color: '#3498db' },
    { key: 'cooking-report', label: 'Cooking Book', icon: '🍚', color: '#e67e22' },
    { key: 'loading-lots', label: 'Loading Lots', icon: '🚚', color: '#f39c12' },
    { key: 'assigning-supervisor', label: 'Assigning (Loading)', icon: '👷', color: '#d35400' },
    { key: 'allotted-supervisors', label: 'Allotted Supervisors', icon: '💂', color: '#2980b9' },
    { key: 'completed-lots', label: 'Completed Lots', icon: '📦', color: '#e74c3c' },
];

const ManagerSampleReports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('paddy-samples');

    useEffect(() => {
        document.title = 'Manager Reports - Kushi Agro Foods';
    }, []);

    return (
        <div style={{
            padding: '0',
            backgroundColor: '#f0f2f5',
            minHeight: '100vh',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                padding: '16px 20px',
                color: 'white',
                marginBottom: '0'
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: '700',
                    letterSpacing: '0.5px'
                }}>
                    📊 MANAGER SAMPLE RECORDS
                </h2>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '0',
                backgroundColor: 'white',
                borderBottom: '2px solid #e0e0e0',
                overflowX: 'visible',
                padding: '0 8px',
                whiteSpace: 'normal',
                flexWrap: 'wrap',
                rowGap: '4px'
            }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                padding: '12px 16px',
                                fontSize: '13px',
                                fontWeight: isActive ? '700' : '500',
                                border: 'none',
                                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                                cursor: 'pointer',
                                backgroundColor: 'transparent',
                                color: isActive ? tab.color : '#666',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexShrink: 0
                            }}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div style={{
                padding: '16px 0',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {activeTab === 'paddy-samples' && <SampleEntryPage excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'pending-lots' && <LotSelection excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'cooking-report' && <CookingReport excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'loading-lots' && <LoadingLots excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'completed-lots' && <CompletedLots excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'sample-book-2' && <AdminSampleBook2 excludeEntryType="RICE_SAMPLE" />}
                {activeTab === 'assigning-supervisor' && <AssigningSupervisor />}
                {activeTab === 'allotted-supervisors' && <AllottedSupervisors />}
            </div>
        </div>
    );
};

export default ManagerSampleReports;

