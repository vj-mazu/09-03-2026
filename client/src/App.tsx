import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { setNotificationCallback } from './utils/toast';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import './globalNotification.css';
import './App.css';

// Lazy-load all page components — each page downloads only when navigated to
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Arrivals = React.lazy(() => import('./pages/Arrivals'));
const Records = React.lazy(() => import('./pages/Records'));
const Locations = React.lazy(() => import('./pages/Locations'));
const KunchinintuLedger = React.lazy(() => import('./pages/KunchinintuLedger'));
const RiceLedger = React.lazy(() => import('./pages/RiceLedger'));
const Hamali = React.lazy(() => import('./pages/Hamali'));
const AddPurchaseRate = React.lazy(() => import('./pages/AddPurchaseRate'));
const HamaliBookSimple = React.lazy(() => import('./pages/HamaliBookSimple'));
const UserManagement = React.lazy(() => import('./pages/UserManagement'));
const PendingApprovals = React.lazy(() => import('./pages/PendingApprovals'));
const SampleEntry = React.lazy(() => import('./pages/SampleEntry'));
const RiceSampleEntry = React.lazy(() => import('./pages/RiceSampleEntry'));
const SampleEntryLedger = React.lazy(() => import('./pages/SampleEntryLedger'));
const OwnerSampleReports = React.lazy(() => import('./pages/OwnerSampleReports'));
const AssigningSupervisor = React.lazy(() => import('./pages/AssigningSupervisor'));
const AllottedSupervisors = React.lazy(() => import('./pages/AllottedSupervisors'));
const AllottingSupervisors = React.lazy(() => import('./pages/AllottingSupervisors'));
const PhysicalInspection = React.lazy(() => import('./pages/PhysicalInspection'));
const InventoryEntry = React.lazy(() => import('./pages/InventoryEntry'));
const OwnerFinancialPage = React.lazy(() => import('./pages/OwnerFinancialPage'));
const ManagerFinancialPage = React.lazy(() => import('./pages/ManagerFinancialPage'));
const FinalReviewPage = React.lazy(() => import('./pages/FinalReviewPage'));
const SampleWorkflow = React.lazy(() => import('./pages/SampleWorkflow'));
const ManagerSampleReports = React.lazy(() => import('./pages/ManagerSampleReports'));
const EGBLedger = React.lazy(() => import('./pages/EGBLedger'));
const CookingReportPage = React.lazy(() => import('./pages/CookingReport'));
const RiceSampleReports = React.lazy(() => import('./pages/RiceSampleReports'));
const ResampleAllotment = React.lazy(() => import('./pages/ResampleAllotment'));

// Lightweight loading spinner for page transitions
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
    <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ color: '#64748b', fontSize: '14px' }}>Loading...</span>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const AppContent: React.FC = () => {
  const notification = useNotification();

  useEffect(() => {
    // Connect our custom toast to the notification system
    setNotificationCallback({
      success: notification.success,
      error: notification.error,
      warning: notification.warning,
      info: notification.info
    });
  }, [notification]);

  return (
    <Router>
      <div className="App">
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/arrivals"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Arrivals />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/records"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Records />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/locations"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <Locations />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ledger"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <KunchinintuLedger />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rice-ledger"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RiceLedger />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hamali"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Hamali />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/records/purchase/:arrivalId/add-rate"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <AddPurchaseRate />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hamali-book"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <HamaliBookSimple />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Layout>
                      <UserManagement />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pending-approvals"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <PendingApprovals />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sample-entry"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SampleEntry />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rice-sample-entries"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RiceSampleEntry />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sample-entry-ledger"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SampleEntryLedger />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/paddy-sample-reports"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Layout>
                      <OwnerSampleReports />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route path="/owner-sample-reports" element={<Navigate to="/paddy-sample-reports" replace />} />
              <Route
                path="/manager-sample-reports"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <ManagerSampleReports />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rice-sample-reports"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <RiceSampleReports />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resample-allotment"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <ResampleAllotment excludeEntryType="RICE_SAMPLE" />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/allotting-supervisors"
                element={
                  <ProtectedRoute roles={['manager']}>
                    <Layout>
                      <AllottingSupervisors />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/physical-inspection"
                element={
                  <ProtectedRoute roles={['physical_supervisor']}>
                    <Layout>
                      <PhysicalInspection />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cooking-book"
                element={
                  <ProtectedRoute roles={['staff', 'manager', 'admin']}>
                    <Layout>
                      <CookingReportPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory-entry"
                element={
                  <ProtectedRoute roles={['inventory_staff', 'admin']}>
                    <Layout>
                      <InventoryEntry />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner-financial"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Layout>
                      <OwnerFinancialPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager-financial"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <ManagerFinancialPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/final-review"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <FinalReviewPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sample-workflow"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <SampleWorkflow />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/egb-ledger"
                element={
                  <ProtectedRoute roles={['manager', 'admin']}>
                    <Layout>
                      <EGBLedger />
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ErrorBoundary>
        </Suspense>
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </LocationProvider>
    </AuthProvider>
  );
}

export default App;
