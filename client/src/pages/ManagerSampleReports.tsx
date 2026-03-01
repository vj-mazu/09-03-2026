import React, { useState } from 'react';
import AdminSampleBook from './AdminSampleBook';
import AssigningSupervisor from './AssigningSupervisor';
import AllottedSupervisors from './AllottedSupervisors';
import LoadingLots from './LoadingLots';
import CompletedLots from './CompletedLots';

interface TabConfig {
    id: string;
    label: string;
    icon: string;
}

const tabs: TabConfig[] = [
    { id: 'SAMPLE_BOOK', label: 'Sample Book', icon: '📒' },
    { id: 'LOADING_LOTS', label: 'Loading Lots', icon: '🚛' },
    { id: 'ALLOTTING', label: 'Pending Loading Lots (Allotting Supervisor)', icon: '👷' },
    { id: 'ALLOTTED', label: 'Allotted Loading Supervisors', icon: '✅' },
    { id: 'COMPLETED_LOTS', label: 'Completed Lots', icon: '🏁' },
];

const ManagerSampleReports: React.FC = () => {
    const [activeTab, setActiveTab] = useState('SAMPLE_BOOK');

    const renderTab = () => {
        switch (activeTab) {
            case 'SAMPLE_BOOK':
                return <AdminSampleBook />;
            case 'ALLOTTING':
                return <AssigningSupervisor />;
            case 'ALLOTTED':
                return <AllottedSupervisors />;
            case 'LOADING_LOTS':
                return <LoadingLots />;
            case 'COMPLETED_LOTS':
                return <CompletedLots />;
            default:
                return null;
        }
    };

    return (
        <div style={{ padding: '8px', width: '100%' }}>
            <div style={{
                background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
                padding: '16px 24px',
                borderRadius: '10px 10px 0 0',
                marginBottom: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <span style={{ fontSize: '22px' }}>📊</span>
                <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>
                    Manager Sample Reports
                </h2>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                backgroundColor: '#f5f5f5',
                borderBottom: '2px solid #e0e0e0',
                overflow: 'auto'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '10px 20px',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '3px solid #2c3e50' : '3px solid transparent',
                            backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                            color: activeTab === tab.id ? '#2c3e50' : '#666',
                            fontWeight: activeTab === tab.id ? '700' : '500',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{
                backgroundColor: 'white',
                padding: '16px',
                border: '1px solid #e0e0e0',
                borderTop: 'none',
                borderRadius: '0 0 10px 10px',
                minHeight: '400px'
            }}>
                {renderTab()}
            </div>
        </div>
    );
};

export default ManagerSampleReports;
