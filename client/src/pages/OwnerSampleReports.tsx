import React, { useState, useEffect } from 'react';
import LotSelection from './LotSelection';
import CookingReport from './CookingReport';
import FinalReport from './FinalReport';
import LoadingLots from './LoadingLots';
import CompletedLots from './CompletedLots';
import AdminSampleBook from './AdminSampleBook';

type TabKey = 'pending-lots' | 'cooking-report' | 'lots-passed' | 'loading-lots' | 'completed-lots' | 'sample-book';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
  color: string;
}

const tabs: TabConfig[] = [
  { key: 'sample-book', label: 'Sample Book', icon: '📖', color: '#8e44ad' },
  { key: 'pending-lots', label: 'Pending (Sample Selection)', icon: '📋', color: '#3498db' },
  { key: 'cooking-report', label: 'Cooking Report', icon: '🍚', color: '#e67e22' },
  { key: 'lots-passed', label: 'Final Pass Lots', icon: '✅', color: '#27ae60' },
  { key: 'loading-lots', label: 'Loading Lots', icon: '🚚', color: '#f39c12' },
  { key: 'completed-lots', label: 'Completed Lots', icon: '📦', color: '#e74c3c' },
];

const OwnerSampleReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('sample-book');

  useEffect(() => {
    document.title = 'Sample Reports - Kushi Agro Foods';
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
          📊 OWNER SAMPLE REPORTS
        </h2>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        backgroundColor: 'white',
        borderBottom: '2px solid #e0e0e0',
        overflowX: 'auto',
        padding: '0 8px',
        whiteSpace: 'nowrap'
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
        {activeTab === 'pending-lots' && <LotSelection />}
        {activeTab === 'cooking-report' && <CookingReport />}
        {activeTab === 'lots-passed' && <FinalReport />}
        {activeTab === 'loading-lots' && <LoadingLots />}
        {activeTab === 'completed-lots' && <CompletedLots />}
        {activeTab === 'sample-book' && <AdminSampleBook />}
      </div>
    </div>
  );
};

export default OwnerSampleReports;
