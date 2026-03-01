import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import BulkApprovalModal from './BulkApprovalModal';

const Nav = styled.nav`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 0.75rem 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1000;
`;

const NavContainer = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
`;

const Logo = styled(Link)`
  color: white;
  font-size: 1.25rem;
  margin: 0;
  font-weight: 700;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  
  &:hover {
    opacity: 0.9;
  }
`;

const HamburgerButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @media (max-width: 768px) {
    display: block;
  }
`;

const MobileOverlay = styled.div<{ $open: boolean }>`
  display: none;
  @media (max-width: 768px) {
    display: ${props => props.$open ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 999;
  }
`;

const NavLinks = styled.div<{ $mobileOpen?: boolean }>`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex: 1;
  justify-content: flex-end;

  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    right: ${props => props.$mobileOpen ? '0' : '-280px'};
    width: 280px;
    height: 100vh;
    background: linear-gradient(180deg, #10b981, #047857);
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 3.5rem 1rem 1rem;
    gap: 0.15rem;
    z-index: 1001;
    overflow-y: auto;
    transition: right 0.3s ease;
    box-shadow: ${props => props.$mobileOpen ? '-4px 0 20px rgba(0,0,0,0.3)' : 'none'};
  }
`;

const NavLink = styled(Link) <{ $active: boolean }>`
  color: white;
  text-decoration: none;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.85rem;
  background: ${props => props.$active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;

const DropdownWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownTrigger = styled.button<{ $active: boolean }>`
  color: white;
  text-decoration: none;
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.85rem;
  background: ${props => props.$active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  border: none;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  z-index: 2000;
  padding: 0.5rem 0;
  margin-top: 0;
  padding-top: 8px;
  border: 1px solid #e2e8f0;

  &::before {
    content: '';
    position: absolute;
    top: -8px;
    right: 20px;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid white;
  }
`;

const DropdownLink = styled(Link) <{ $active: boolean }>`
  display: block;
  padding: 0.6rem 1.2rem;
  color: ${props => props.$active ? '#10b981' : '#334155'};
  text-decoration: none;
  font-weight: ${props => props.$active ? '600' : '500'};
  font-size: 0.85rem;
  background: ${props => props.$active ? '#f0fdf4' : 'transparent'};
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    color: #10b981;
  }
`;

const DropdownDivider = styled.hr`
  border: none;
  border-top: 1px solid #f1f5f9;
  margin: 0.4rem 0;
`;

const NotificationBadge = styled.span`
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  margin-left: 4px;
`;

const UserInfo = styled.div`
  color: white;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 0.75rem;
  padding-left: 0.75rem;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  white-space: nowrap;
`;

const UserBadge = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  text-transform: capitalize;
  font-size: 0.75rem;
`;

const LogoutButton = styled.button`
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.2s;
  margin-left: 0.5rem;

  &:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }
`;

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [workflowDropdownOpen, setWorkflowDropdownOpen] = useState(false);
  const [ledgersDropdownOpen, setLedgersDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ledgersRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ledgersRef.current && !ledgersRef.current.contains(event.target as Node)) {
        setLedgersDropdownOpen(false);
      }
      if (workflowRef.current && !workflowRef.current.contains(event.target as Node)) {
        setWorkflowDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close all dropdowns + mobile menu on route change
  useEffect(() => {
    setLedgersDropdownOpen(false);
    setWorkflowDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user && (user.role === 'manager' || user.role === 'admin')) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/arrivals/pending-list');
      const data = response.data as { count: number };
      setPendingCount(data.count || 0);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleApprovalModalClose = () => {
    setShowApprovalModal(false);
    fetchPendingCount();
  };

  const isActive = (path: string) => location.pathname === path;

  const workflowPaths = [
    '/sample-entry', '/sample-entry-ledger', '/sample-workflow',
    '/inventory-entry', '/owner-financial', '/manager-financial',
    '/final-review', '/owner-sample-reports', '/allotting-supervisors',
    '/physical-inspection', '/pending-approvals', '/loading-lots'
  ];
  const ledgersPaths = ['/ledger', '/rice-ledger', '/sample-entry-ledger', '/hamali-book', '/egb-ledger'];

  const isWorkflowActive = workflowPaths.some(p => location.pathname === p);
  const isLedgersActive = ledgersPaths.some(p => location.pathname === p);

  return (
    <Nav>
      <NavContainer>
        <Logo to="/dashboard">Mother India Management</Logo>
        <HamburgerButton onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? '✕' : '☰'}
        </HamburgerButton>
        <MobileOverlay $open={mobileMenuOpen} onClick={() => setMobileMenuOpen(false)} />
        <NavLinks $mobileOpen={mobileMenuOpen}>
          {user?.role !== 'staff' && <NavLink to="/dashboard" $active={isActive('/dashboard')}>Dashboard</NavLink>}
          {user && user.role === 'staff' && (
            <NavLink to="/sample-entry" $active={isActive('/sample-entry')}>Sample Entry</NavLink>
          )}
          {user && user.role === 'manager' && (
            <>
              <NavLink to="/manager-sample-reports" $active={isActive('/manager-sample-reports')}>Loading Lots</NavLink>
              <NavLink to="/sample-entry-ledger" $active={isActive('/sample-entry-ledger')}>Sample Book</NavLink>
            </>
          )}
          {user && user.role === 'admin' && (
            <>
              <NavLink to="/owner-sample-reports" $active={isActive('/owner-sample-reports')}>Owner Sample Reports</NavLink>
              <NavLink to="/arrivals" $active={isActive('/arrivals')}>Arrivals</NavLink>
              <NavLink to="/records" $active={isActive('/records')}>Records</NavLink>
            </>
          )}

          {/* Ledgers Dropdown - for Manager and Admin */}
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <DropdownWrapper ref={ledgersRef}>
              <DropdownTrigger
                $active={isLedgersActive}
                onClick={() => {
                  setLedgersDropdownOpen(!ledgersDropdownOpen);
                  setWorkflowDropdownOpen(false);
                }}
              >Ledgers ▾</DropdownTrigger>
              {ledgersDropdownOpen && (
                <DropdownMenu>
                  <DropdownLink to="/sample-entry-ledger" $active={isActive('/sample-entry-ledger')}>Sample Book</DropdownLink>
                  {user?.role === 'admin' && (
                    <DropdownLink to="/owner-sample-reports" $active={isActive('/owner-sample-reports')}>Owner Sample Reports</DropdownLink>
                  )}
                  <DropdownLink to="/ledger" $active={isActive('/ledger')}>Kunchinittu Ledger</DropdownLink>
                  <DropdownLink to="/rice-ledger" $active={isActive('/rice-ledger')}>Rice Ledger</DropdownLink>
                  <DropdownLink to="/hamali-book" $active={isActive('/hamali-book')}>Hamali Book</DropdownLink>
                  <DropdownLink to="/egb-ledger" $active={isActive('/egb-ledger')}>EGB Ledger</DropdownLink>
                </DropdownMenu>
              )}
            </DropdownWrapper>
          )}

          {/* Show Arrivals/Records for staff too */}
          {user?.role === 'staff' && (
            <>
              <NavLink to="/arrivals" $active={isActive('/arrivals')}>Arrivals</NavLink>
              <NavLink to="/records" $active={isActive('/records')}>Records</NavLink>
            </>
          )}
          <NavLink to="/hamali" $active={isActive('/hamali')}>Hamali</NavLink>

          {/* Workflow Dropdown */}
          {user && (
            <DropdownWrapper ref={workflowRef}>
              <DropdownTrigger
                $active={isWorkflowActive}
                onClick={() => {
                  setWorkflowDropdownOpen(!workflowDropdownOpen);
                  setLedgersDropdownOpen(false);
                }}
              >
                Workflow ▾
                {pendingCount > 0 && (user.role === 'manager' || user.role === 'admin') && (
                  <NotificationBadge>{pendingCount}</NotificationBadge>
                )}
              </DropdownTrigger>
              {workflowDropdownOpen && (
                <DropdownMenu>
                  <DropdownLink to="/sample-entry" $active={isActive('/sample-entry')}>New Paddy Sample</DropdownLink>
                  {(user.role === 'manager' || user.role === 'admin') && (
                    <>
                      <DropdownLink to="/sample-workflow" $active={isActive('/sample-workflow')}>Workflow Board</DropdownLink>
                      <DropdownLink to="/pending-approvals" $active={isActive('/pending-approvals')}>
                        Pending Approvals {pendingCount > 0 ? `(${pendingCount})` : ''}
                      </DropdownLink>
                    </>
                  )}
                  {user.role !== 'staff' && <DropdownDivider />}
                  {(user.role === 'inventory_staff' || user.role === 'admin') && (
                    <DropdownLink to="/inventory-entry" $active={isActive('/inventory-entry')}>Inventory Entry</DropdownLink>
                  )}
                  {user.role === 'physical_supervisor' && (
                    <DropdownLink to="/physical-inspection" $active={isActive('/physical-inspection')}>Lots Allotted</DropdownLink>
                  )}
                  {user.role === 'admin' && (
                    <DropdownLink to="/owner-financial" $active={isActive('/owner-financial')}>Owner Financial</DropdownLink>
                  )}
                  {(user.role === 'manager' || user.role === 'admin') && (
                    <>
                      <DropdownDivider />
                      {user.role === 'admin' && (
                        <DropdownLink to="/manager-sample-reports" $active={isActive('/manager-sample-reports')}>Manager Sample Reports</DropdownLink>
                      )}
                      <DropdownLink to="/manager-financial" $active={isActive('/manager-financial')}>Manager Financial</DropdownLink>
                      <DropdownLink to="/final-review" $active={isActive('/final-review')}>Final Review</DropdownLink>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <>
                      <DropdownDivider />
                      <DropdownLink to="/owner-sample-reports" $active={isActive('/owner-sample-reports')}>Owner Sample Reports</DropdownLink>
                    </>
                  )}
                </DropdownMenu>
              )}
            </DropdownWrapper>
          )}

          {/* Admin Tools */}
          {user && user.role === 'admin' && (
            <>
              <NavLink to="/locations" $active={isActive('/locations')}>Locations</NavLink>
              <NavLink to="/admin/users" $active={isActive('/admin/users')}>Users</NavLink>
            </>
          )}

          <UserInfo>
            <UserBadge>{user?.role}</UserBadge>
            <span>{user?.username}</span>
          </UserInfo>
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
        </NavLinks>
      </NavContainer>

      <BulkApprovalModal
        isOpen={showApprovalModal}
        onClose={handleApprovalModalClose}
        onApprovalComplete={fetchPendingCount}
      />
    </Nav>
  );
};

export default Navbar;