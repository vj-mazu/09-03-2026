import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import axios from 'axios';
import { toast } from '../utils/toast';
import { NotificationMessages } from '../utils/notificationMessages';
import { useAuth } from '../contexts/AuthContext';
import EditArrivalModal from '../components/EditArrivalModal';
import InlineHamaliForm from '../components/InlineHamaliForm';
import InlineRiceHamaliForm from '../components/InlineRiceHamaliForm';
import InlinePaltiForm from '../components/InlinePaltiForm';

import AddPaddyHamaliModal from '../components/AddPaddyHamaliModal';
import EnhancedPaltiModal from '../components/EnhancedPaltiModal';
import SimplePurchaseModal from '../components/SimplePurchaseModal';
import SimpleSaleModal from '../components/SimpleSaleModal';
import {
  generateArrivalsPDF,
  generatePurchasePDF,
  generateShiftingPDF,
  generatePaddyStockPDF,
  generateRiceStockPDF,
  generateRiceMovementsPDF,
  generateOutturnReportPDF
} from '../utils/recordsPdfGenerator';
import PaginationControls from '../components/PaginationControls';

const Container = styled.div`
`;

const Title = styled.h1`
  color: #ffffff;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
`;

const TabContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e5e7eb;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 1rem 2rem;
  border: none;
  background: ${props => props.$active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#6b7280'};
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.$active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#f3f4f6'};
    color: ${props => props.$active ? 'white' : '#374151'};
  }
`;

const FilterSection = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
`;

const FilterRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: end;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
`;

const InfoText = styled.p`
  color: #6b7280;
  font-size: 0.85rem;
  margin: 0;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &.primary {
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
    color: white;
  }

  &.success {
    background: #10b981;
    color: white;
  }

  &.secondary {
    background: #6b7280;
    color: white;
  }

  &.danger {
    background: #ef4444;
    color: white;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const RecordsContainer = styled.div`
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
`;

const DateGroup = styled.div<{ expanded: boolean }>`
  border-bottom: 1px solid #e5e7eb;
  
  &:last-child {
    border-bottom: none;
  }
`;

const DateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #f3f4f6;
  }
`;

const DateTitle = styled.h3`
  color: #1f2937;
  font-size: 1.1rem;
  margin: 0;
`;

const RecordCount = styled.span`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
`;

const TableContainer = styled.div`
  overflow-x: auto;
  width: 100%;
  margin: 0;
  padding: 0;
  
  /* Ensure table extends to edges */
  table {
    margin: 0;
    border-left: none;
    border-right: none;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  background: #f8fafc;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  font-size: 0.9rem;
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  color: #6b7280;
  text-transform: uppercase;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch (props.status) {
      case 'pending':
        return 'background: #fef3c7; color: #d97706;';
      case 'approved':
        return 'background: #d1fae5; color: #059669;';
      case 'rejected':
        return 'background: #fee2e2; color: #dc2626;';
      default:
        return 'background: #e5e7eb; color: #6b7280;';
    }
  }}
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const IconButton = styled.button`
  padding: 0.5rem;
  border: none;
  background: #f3f4f6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #e5e7eb;
  }

  &.edit:hover {
    background: #fef3c7;
    color: #f59e0b;
  }

  &.delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  &.approve:hover {
    background: #d1fae5;
    color: #059669;
  }
`;

const PendingAlert = styled.div`
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left: 4px solid #f59e0b;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);

  .count {
    background: #f59e0b;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 50%;
    font-weight: 700;
    font-size: 1.2rem;
    min-width: 50px;
    text-align: center;
  }

  .text {
    flex: 1;
    font-weight: 600;
    color: #92400e;
  }
`;

const VarietyCell = styled.td<{ hasLocation?: boolean; isPurple?: boolean }>`
  background: ${props => props.hasLocation ? (props.isPurple ? '#e2d4ed !important' : '#d4edda !important') : 'inherit'};
  font-weight: ${props => props.hasLocation ? '600' : 'normal'};
  color: ${props => props.hasLocation ? (props.isPurple ? '#6b21a8' : '#155724') : 'inherit'};
`;

const LocationCell = styled.td<{ hasLocation?: boolean; isPurple?: boolean }>`
  background: ${props => props.hasLocation ? (props.isPurple ? '#e2d4ed !important' : '#d4edda !important') : 'inherit'};
  font-weight: ${props => props.hasLocation ? '600' : 'normal'};
  color: ${props => props.hasLocation ? (props.isPurple ? '#6b21a8' : '#155724') : 'inherit'};
`;

const ExcelTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: 'Calibri', 'Arial', sans-serif;
  font-size: 10pt;
  background: white;

  thead {
    background: #4472c4;
    color: white;
    font-weight: bold;
  }

  th, td {
    border: 1px solid #d0d0d0;
    padding: 4px 6px;
    text-align: left;
  }

  th {
    font-weight: bold;
    white-space: nowrap;
    font-size: 9pt;
  }

  tbody tr:nth-child(even) {
    background: #f8f9fa;
  }

  tbody tr:hover {
    background: #e8f4f8;
  }
`;

const PurchaseRow = styled.tr`
  background: #d4edda !important;
  
  &:hover {
    background: #c3e6cb !important;
  }
`;

const ShiftingRow = styled.tr`
  background: #e2d4ed !important;
  
  &:hover {
    background: #d4c3e6 !important;
  }
`;

const StockSection = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const StockDate = styled.h3`
  background: #4472c4;
  color: white;
  padding: 0.75rem 1rem;
  margin: -1.5rem -1.5rem 1rem;
  border-radius: 8px 8px 0 0;
  font-size: 1.1rem;
  font-weight: bold;
`;

const StockSummary = styled.div`
  background: #fff3cd;
  border: 2px solid #ffc107;
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 6px;
  font-weight: bold;
  font-size: 1.1rem;

  &.opening {
    background: #d1f2eb;
    border-color: #28a745;
  }

  &.closing {
    background: #f8d7da;
    border-color: #dc3545;
  }
`;

const EmptyState = styled.div`
  padding: 3rem;
  text-align: center;
  color: #6b7280;
`;

const PDFButton = styled.button<{ $variant?: 'all' | 'filtered' }>`
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  background: ${props => props.$variant === 'filtered'
    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'};
  color: white;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px ${props => props.$variant === 'filtered'
    ? 'rgba(16, 185, 129, 0.3)'
    : 'rgba(220, 38, 38, 0.3)'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  background: #f8fafc;
`;

const PageButton = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  background: ${props => props.$active ? '#f59e0b' : 'white'};
  color: ${props => props.$active ? 'white' : '#374151'};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: ${props => props.$active ? '#f59e0b' : '#fef3c7'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Rice Stock Styled Components
const RiceStockSection = styled.div`
  background: white;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  overflow: hidden;
`;

const RiceStockDateHeader = styled.div`
  background: #4a90e2;
  color: white;
  padding: 1rem 1.5rem;
  font-size: 1.2rem;
  font-weight: bold;
`;

const RiceStockContent = styled.div`
  padding: 1rem 1.5rem;
`;

const RiceStockItem = styled.div`
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const RiceStockTotal = styled.div`
  font-weight: bold;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  
  &.opening {
    border-bottom: 2px solid #ddd;
  }
  
  &.closing {
    border-top: 2px solid #ddd;
  }
`;

const RiceStockQuantity = styled.span`
  font-weight: bold;
  min-width: 80px;
  color: #10b981;
`;

const RiceStockDetails = styled.span`
  min-width: 200px;
  font-weight: 600;
`;

const InlineRateForm = styled.tr`
  background: #f8f9fa !important;
`;

const RateFormCell = styled.td`
  padding: 2rem !important;
  border: 2px solid #10b981 !important;
`;

const RateFormContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;

const RateFormTitle = styled.h3`
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  font-size: 1.2rem;
  border-bottom: 2px solid #10b981;
  padding-bottom: 0.5rem;
`;

const RateFormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const RateFormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const RateLabel = styled.label`
  font-weight: 600;
  color: #374151;
  font-size: 0.8rem;
`;

const RateInput = styled.input`
  padding: 0.4rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 0.85rem;

  &:focus {
    outline: none;
    border-color: #10b981;
  }
`;

const RateRadioGroup = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
`;

const RateRadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #4b5563;
  cursor: pointer;
  white-space: nowrap;

  input[type="radio"] {
    cursor: pointer;
  }
`;

const RateCalculationBox = styled.div`
  background: #f0fdf4;
  border: 1px solid #10b981;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  display: flex;
  gap: 2rem;
  align-items: center;
`;

const RateCalcRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
`;

const RateCalcLabel = styled.span`
  color: #065f46;
  font-weight: 600;
`;

const RateCalcValue = styled.span`
  color: #047857;
  font-weight: 700;
`;

const RateButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`;

interface MonthOption {
  month: string; // Format: YYYY-MM
  month_label: string; // Format: "January 2024"
}

interface PaginationData {
  currentMonth: string | null;
  availableMonths: MonthOption[];
  totalRecords: number;
  recordsReturned?: number;
  totalPages?: number;
  truncated?: boolean;
  limit?: number;
  page?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface RecordsResponse {
  records: { [date: string]: Arrival[] };
  pagination: PaginationData;
  closedKunchinittus?: any[]; // Added for kunchinittu closure logic
  performance?: {
    responseTime: string;
    recordsReturned: number;
  };
}

interface Arrival {
  id: number;
  slNo: string;
  date: string;
  movementType: string;
  broker?: string;
  variety?: string; // Changed to string (text field)
  bags?: number;
  fromLocation?: string;
  toKunchinintuId?: number;
  toKunchinittu?: { name: string; code?: string };
  toWarehouse?: { name: string; code?: string };
  fromKunchinittu?: { name: string; code?: string };
  fromWarehouse?: { name: string; code?: string };
  toWarehouseShift?: { name: string; code?: string };
  outturnId?: number;
  outturn?: { code: string; allottedVariety?: string; isCleared?: boolean; clearedAt?: string };
  moisture?: number;
  cutting?: string;
  wbNo: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  lorryNumber: string;
  status: string;
  creator?: { username: string };
  approver?: { username: string; role: string };
  adminApprover?: { username: string; role: string };
  adminApprovedBy?: number;
  purchaseRate?: {
    amountFormula: string;
    totalAmount: number | string;
    averageRate: number | string;
  };
}

// Helper function to get week range string
const getWeekRange = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (dt: Date) => {
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  return `Week: ${formatDate(monday)} to ${formatDate(sunday)}`;
};

// Helper function to get week key for grouping
const getWeekKey = (date: string): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

const Records: React.FC = () => {
  const { user } = useAuth();

  // Month navigation functions for paddy stock
  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentMonth = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = currentMonth.split('-').map(Number);

    let newYear = year;
    let newMonth = month;

    if (direction === 'prev') {
      newMonth -= 1;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
    } else {
      newMonth += 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
    }

    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setSelectedMonth(newMonthStr);
    setPage(1); // Reset page for other tabs

    // Show loading message
    toast.info(`Loading ${new Date(newYear, newMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} paddy stock...`);
  };

  const getCurrentMonthLabel = () => {
    if (!selectedMonth) return 'Current Month';
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  const [activeTab, setActiveTab] = useState<'arrivals' | 'purchase' | 'shifting' | 'stock' | 'outturn-report' | 'rice-outturn-report' | 'rice-stock'>('arrivals');
  const [records, setRecords] = useState<{ [key: string]: Arrival[] }>({});
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'date' | 'week'>('week'); // Default to week grouping
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Debounced for API calls
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSubmittingByProducts, setIsSubmittingByProducts] = useState(false);
  const [isSubmittingRiceProduction, setIsSubmittingRiceProduction] = useState(false);

  // Historical opening balance - fetched from API when date filters are applied
  // This ensures accurate opening stock calculation for filtered date ranges
  const [historicalOpeningBalance, setHistoricalOpeningBalance] = useState<{
    warehouseBalance: { [key: string]: { variety: string; location: string; bags: number } };
    productionBalance: { [key: string]: { variety: string; outturn: string; bags: number } };
  } | null>(null);

  // Closed kunchinittus data from API
  const [closedKunchinittus, setClosedKunchinittus] = useState<any[]>([]);

  // Month-wise pagination state
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [lastToastMessage, setLastToastMessage] = useState<string>(''); // Prevent duplicate toasts
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAdminCount, setPendingAdminCount] = useState(0);
  const [editingRecord, setEditingRecord] = useState<Arrival | null>(null);
  const [expandedHamaliRecordId, setExpandedHamaliRecordId] = useState<number | null>(null);
  const [expandedRiceHamaliRecordId, setExpandedRiceHamaliRecordId] = useState<string | null>(null);
  // FIXED: Separate state for paddy and rice hamali to avoid data structure conflicts
  const [paddyHamaliEntries, setPaddyHamaliEntries] = useState<{ [key: number]: any }>({});
  const [riceHamaliEntries, setRiceHamaliEntries] = useState<{ [key: string]: any[] }>({});
  const [showPaddyHamaliModal, setShowPaddyHamaliModal] = useState(false); // Kept for compatibility if needed, but unused for inline
  const [selectedArrivalForHamali, setSelectedArrivalForHamali] = useState<any>(null);

  const [expandedRateRecordId, setExpandedRateRecordId] = useState<number | null>(null);
  const [expandedPaltiRecordId, setExpandedPaltiRecordId] = useState<number | null>(null);
  const [rateFormData, setRateFormData] = useState<any>({
    sute: '0',
    suteCalculationMethod: 'per_bag',
    baseRate: '',
    baseRateCalculationMethod: 'per_bag', // Default to per_bag
    rateType: 'CDL',
    h: '0',
    b: '0',
    bCalculationMethod: 'per_bag',
    lf: '0',
    lfCalculationMethod: 'per_bag',
    egb: '0'
  });
  const [savingRate, setSavingRate] = useState(false);

  // Business Date logic - show only today's records by default (6 AM cutoff)
  const [showAllRecords, setShowAllRecords] = useState(false);

  // Date-wise PDF export state
  const [singleDatePdf, setSingleDatePdf] = useState<string>('');

  // Rice Movement Edit State - for editing rice stock movement entries
  const [editingRiceMovement, setEditingRiceMovement] = useState<any>(null);

  // Get business date (if before 6 AM, use previous day)
  const getBusinessDate = () => {
    const now = new Date();
    const hours = now.getHours();

    if (hours < 6) {
      // Before 6 AM, use previous day
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }

    return now.toISOString().split('T')[0];
  };

  // Handle tab change with month filter reset
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);

    // For paddy stock, initialize with current month; for others, reset month filter
    if (tab === 'stock') {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(currentMonth);
    } else {
      setSelectedMonth(''); // Reset month filter for other tabs
    }

    setRecords({});
    setPage(1); // Reset page
  };

  // Outturn Report state
  const [outturns, setOutturns] = useState<any[]>([]);
  const [selectedOutturnId, setSelectedOutturnId] = useState('');
  const [outturnSearch, setOutturnSearch] = useState('');
  const [riceReportSearch, setRiceReportSearch] = useState('');
  const [availableBags, setAvailableBags] = useState<number>(0);
  const [isOutturnCleared, setIsOutturnCleared] = useState<boolean>(false);
  const [showClearOutturnDialog, setShowClearOutturnDialog] = useState(false);
  const [clearOutturnDate, setClearOutturnDate] = useState<string>('');
  const [productionRecords, setProductionRecords] = useState<any[]>([]);
  const [byProducts, setByProducts] = useState<any[]>([]);
  const [byProductDate, setByProductDate] = useState<Date | null>(new Date());
  const [rice, setRice] = useState('');
  const [rejectionRice, setRejectionRice] = useState('');
  const [broken, setBroken] = useState('');
  const [rejectionBroken, setRejectionBroken] = useState('');
  const [zeroBroken, setZeroBroken] = useState('');
  const [faram, setFaram] = useState('');
  const [bran, setBran] = useState('');

  // Rice Production Entry Form state
  const [packagings, setPackagings] = useState<any[]>([]);
  const [locationsData, setLocationsData] = useState<any[]>([]);
  const [riceStockLocations, setRiceStockLocations] = useState<any[]>([]);
  const [productionDate, setProductionDate] = useState('');
  const [productionDateInput, setProductionDateInput] = useState('');
  const [productType, setProductType] = useState('');
  const [bags, setBags] = useState('');
  const [packagingId, setPackagingId] = useState('');
  const [quantityQuintals, setQuantityQuintals] = useState(0);
  const [paddyBagsDeducted, setPaddyBagsDeducted] = useState(0);
  const [movementType, setMovementType] = useState<'kunchinittu' | 'loading'>('kunchinittu');
  const [locationCode, setLocationCode] = useState('');
  const [lorryNumber, setLorryNumber] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [paddyDate, setPaddyDate] = useState('');

  // Rice Stock state
  const [riceStockData, setRiceStockData] = useState<any[]>([]);

  // Rice Stock filter state - Unified with main dateFrom/dateTo
  const [riceStockProductType, setRiceStockProductType] = useState<string>('');
  const [riceStockLocationCode, setRiceStockLocationCode] = useState<string>('');

  // Rice Productions for paddy stock (to show outturn deductions)
  const [allRiceProductions, setAllRiceProductions] = useState<any[]>([]);

  // Rice Stock Management states (Purchase/Sale modals removed - data display only)
  const [riceStockMovements, setRiceStockMovements] = useState<any[]>([]);
  const [riceStockPage, setRiceStockPage] = useState(1);
  const [riceStockTotalPages, setRiceStockTotalPages] = useState(1);
  const [riceStockTotalRecords, setRiceStockTotalRecords] = useState(0);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  // Palti and Approval states
  const [showPaltiModal, setShowPaltiModal] = useState(false);
  const [paltiDate, setPaltiDate] = useState(new Date().toISOString().split('T')[0]); // Shared date for palti operations and hierarchical view
  const [hierarchicalRefreshTrigger, setHierarchicalRefreshTrigger] = useState(0); // Trigger to refresh hierarchical component
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [pendingMovements, setPendingMovements] = useState<any[]>([]);
  const [showPendingMovements, setShowPendingMovements] = useState(false);
  const [selectedMovementIds, setSelectedMovementIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Helper function to navigate to outturn
  const navigateToOutturn = (outturnCode: string) => {
    // Switch to outturn-report tab
    setActiveTab('outturn-report');

    // Find the outturn by code and select it
    const outturn = outturns.find((o: any) =>
      (o.code === outturnCode) ||
      (o.outturnNumber === outturnCode)
    );

    if (outturn) {
      setSelectedOutturnId(outturn.id.toString());
      toast.success(`Navigated to outturn: ${outturnCode}`);
    } else {
      toast.warning(`Outturn ${outturnCode} not found`);
    }
  };

  // Pagination and filtering for by-products
  const [byProductSearch, setByProductSearch] = useState('');
  const [byProductPage, setByProductPage] = useState(1);
  const byProductsPerPage = 10;

  // Filtered and paginated by-products - MEMOIZED for performance
  const filteredByProducts = useMemo(() => {
    return byProducts.filter((bp: any) => {
      if (!byProductSearch) return true;
      const searchLower = byProductSearch.toLowerCase();
      const dateStr = new Date(bp.date).toLocaleDateString('en-GB').toLowerCase();
      return dateStr.includes(searchLower);
    });
  }, [byProducts, byProductSearch]);

  const totalByProductPages = useMemo(() =>
    Math.ceil(filteredByProducts.length / byProductsPerPage),
    [filteredByProducts.length, byProductsPerPage]
  );

  const paginatedByProducts = useMemo(() =>
    filteredByProducts.slice(
      (byProductPage - 1) * byProductsPerPage,
      byProductPage * byProductsPerPage
    ),
    [filteredByProducts, byProductPage, byProductsPerPage]
  );

  // Debounce search input for performance with 10 lakh records
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // 500ms delay before API call

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // If date filters are modified, wait for complete format (DD-MM-YYYY) before fetching
    const isDateFromPartial = dateFrom && (dateFrom.length !== 10 || dateFrom.split('-').length !== 3);
    const isDateToPartial = dateTo && (dateTo.length !== 10 || dateTo.split('-').length !== 3);

    if (isDateFromPartial || isDateToPartial) {
      console.log('⏳ Waiting for complete date range before fetching...');
      return;
    }

    fetchRecords();
  }, [activeTab, page, dateFrom, dateTo, debouncedSearch, showAllRecords, selectedMonth]);

  // Auto-fetch when month changes for paddy stock
  useEffect(() => {
    if (activeTab === 'stock' && selectedMonth) {
      fetchRecords();
    }
  }, [selectedMonth, activeTab]);

  // Auto-refresh at 6 AM daily
  useEffect(() => {
    const checkTimeAndRefresh = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // At 6:00 AM, refresh the records
      if (hours === 6 && minutes === 0) {
        fetchRecords();
      }
    };

    // Check every minute
    const interval = setInterval(checkTimeAndRefresh, 60000);

    return () => clearInterval(interval);
  }, [activeTab, showAllRecords]);

  useEffect(() => {
    if (activeTab === 'outturn-report') {
      fetchOutturns();
      fetchPackagings();
      fetchLocationsData();
      fetchRiceStockLocations();
    } else if (activeTab === 'rice-outturn-report' || activeTab === 'rice-stock') {
      fetchRiceStock();
      fetchPackagings();
      fetchRiceStockLocations();
      fetchOutturns(); // Fetch outturns for hyperlinks to work
    } else if (activeTab === 'stock') {
      fetchAllRiceProductions();
      fetchOutturns(); // Fetch outturns for hyperlinks to work
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchOpeningBalance();
    }
  }, [activeTab, dateFrom, selectedMonth]);

  // Refetch rice stock when month or filters change (using month-based filtering only)
  useEffect(() => {
    if (activeTab === 'rice-stock' || activeTab === 'rice-outturn-report') {
      fetchRiceStock();
    }
  }, [riceStockProductType, riceStockLocationCode, riceStockPage, selectedMonth]);

  useEffect(() => {
    if (selectedOutturnId) {
      fetchProductionRecords();
      fetchByProducts();

      // Set paddy date - let user manually select production date
      const selectedOutturn = outturns.find(o => o.id === parseInt(selectedOutturnId));
      if (selectedOutturn && selectedOutturn.paddyDate) {
        setPaddyDate(selectedOutturn.paddyDate);
        // Don't auto-set production date - let user choose
        setProductionDate('');
        setProductionDateInput('');
      }
    }
  }, [selectedOutturnId, outturns]);

  // Fetch available bags when outturn is selected
  useEffect(() => {
    const fetchAvailableBags = async () => {
      if (selectedOutturnId) {
        try {
          const response = await axios.get<{
            availableBags: number;
            isCleared?: boolean;
            clearedAt?: string;
            remainingBags?: number;
          }>(`/rice-productions/outturn/${selectedOutturnId}/available-bags`);
          setAvailableBags(response.data.availableBags);
          setIsOutturnCleared(response.data.isCleared || false);
        } catch (error) {
          console.error('Error fetching available bags:', error);
          setAvailableBags(0);
          setIsOutturnCleared(false);
        }
      } else {
        setAvailableBags(0);
        setIsOutturnCleared(false);
      }
    };
    fetchAvailableBags();
  }, [selectedOutturnId]);

  const fetchOpeningBalance = async () => {
    // Only fetch for stock tab when we have some date/month filter
    if (activeTab !== 'stock' || (!dateFrom && !selectedMonth)) {
      setHistoricalOpeningBalance(null);
      return;
    }

    // Determine the most restrictive start date (Intersection)
    let startLimit = dateFrom ? convertDateFormat(dateFrom) : '1970-01-01';
    if (selectedMonth) {
      const [year, monthNum] = selectedMonth.split('-');
      const monthStart = `${year}-${monthNum.padStart(2, '0')}-01`;
      startLimit = startLimit > monthStart ? startLimit : monthStart;
    }

    // If startLimit is still 1970, we don't need historical opening (it's from beginning)
    if (startLimit === '1970-01-01') {
      setHistoricalOpeningBalance(null);
      return;
    }

    try {
      const beforeDate = startLimit;
      console.log(`📊 Fetching opening balance before ${beforeDate}...`);
      const response = await axios.get<{
        warehouseBalance: { [key: string]: { variety: string; location: string; bags: number } };
        productionBalance: { [key: string]: { variety: string; outturn: string; bags: number } };
      }>('/arrivals/opening-balance', {
        params: { beforeDate }
      });

      if (response.data) {
        // STANDARDIZE KEYS: Use | instead of - to avoid hyphen bugs
        const standardizedWarehouse: any = {};
        const standardizedProduction: any = {};

        if (response.data.warehouseBalance) {
          Object.values(response.data.warehouseBalance).forEach((item: any) => {
            const key = `${item.variety}|${item.location}`;
            standardizedWarehouse[key] = { ...item };
          });
        }

        if (response.data.productionBalance) {
          Object.values(response.data.productionBalance).forEach((item: any) => {
            const key = `${item.variety}|${item.outturn}`;
            standardizedProduction[key] = { ...item };
          });
        }

        setHistoricalOpeningBalance({
          warehouseBalance: standardizedWarehouse,
          productionBalance: standardizedProduction
        });

        console.log('✅ Opening balance fetched and standardized:', {
          warehouseEntries: Object.keys(standardizedWarehouse).length,
          productionEntries: Object.keys(standardizedProduction).length
        });
      }
    } catch (error) {
      console.error('Error fetching opening balance:', error);
      setHistoricalOpeningBalance(null);
    }
  };

  // Fetch historical opening balance when stock tab is active and filters change
  useEffect(() => {
    fetchOpeningBalance();
  }, [activeTab, dateFrom, selectedMonth]);


  // Helper function to calculate paddy bags deducted from rice quintals
  const calculatePaddyBagsDeducted = (quintals: number, productType: string): number => {
    // No deduction for Bran, Farm Bran, Faram, and Farm
    const noDeductionProducts = ['Bran', 'Farm Bran', 'Faram', 'Farm'];
    if (noDeductionProducts.includes(productType)) {
      return 0;
    }

    // For all other products: quintals ÷ 0.47
    const result = quintals / 0.47;

    // Rounding: < 0.5 round down, >= 0.5 round up
    return Math.round(result);
  };

  // Calculate quintals and paddy bags when bags or packaging changes
  useEffect(() => {
    if (bags && packagingId) {
      const bagsNum = parseFloat(bags) || 0;
      const packaging = packagings.find(p => p.id === parseInt(packagingId));
      console.log('Selected packaging:', packaging);
      console.log('Bags:', bagsNum);
      if (packaging && packaging.allottedKg && bagsNum > 0) {
        const kgPerBag = parseFloat(packaging.allottedKg);
        // Calculate quintals: (bags × kg_per_bag) / 100
        const quintals = (bagsNum * kgPerBag) / 100;
        console.log('Calculated quintals:', quintals);
        setQuantityQuintals(quintals);

        // Calculate paddy deduction using new formula
        const paddyDeduction = calculatePaddyBagsDeducted(quintals, productType);
        console.log('Paddy bags deducted:', paddyDeduction);
        setPaddyBagsDeducted(paddyDeduction);
      } else {
        setQuantityQuintals(0);
        setPaddyBagsDeducted(0);
      }
    } else {
      setQuantityQuintals(0);
      setPaddyBagsDeducted(0);
    }
  }, [bags, packagingId, packagings, productType]);

  // Pre-fill form when selecting a date that has existing data
  useEffect(() => {
    if (byProductDate && byProducts.length > 0) {
      const selectedDateStr = byProductDate.toISOString().split('T')[0];
      const existingData = byProducts.find((bp: any) => bp.date === selectedDateStr);

      if (existingData) {
        // Pre-fill with existing data
        setRice(existingData.rice > 0 ? existingData.rice.toString() : '');
        setRejectionRice(existingData.rejectionRice > 0 ? existingData.rejectionRice.toString() : '');
        setBroken(existingData.broken > 0 ? existingData.broken.toString() : '');
        setRejectionBroken(existingData.rejectionBroken > 0 ? existingData.rejectionBroken.toString() : '');
        setZeroBroken(existingData.zeroBroken > 0 ? existingData.zeroBroken.toString() : '');
        setFaram(existingData.faram > 0 ? existingData.faram.toString() : '');
        setBran(existingData.bran > 0 ? existingData.bran.toString() : '');
      } else {
        // Clear form for new date
        setRice('');
        setRejectionRice('');
        setBroken('');
        setRejectionBroken('');
        setZeroBroken('');
        setFaram('');
        setBran('');
      }
    }
  }, [byProductDate, byProducts]);

  // Helper function to convert DD-MM-YYYY to YYYY-MM-DD
  const convertDateFormat = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const fetchHamaliEntries = async (arrivalIds: number[], riceMovementIds: string[] = []) => {
    try {
      // Fetch paddy hamali entries (OLD system - object structure)
      if (arrivalIds.length > 0) {
        const token = localStorage.getItem('token');
        const response = await axios.post<{ entries: { [key: number]: any } }>(
          '/hamali-entries/batch',
          { arrivalIds },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.entries) {
          setPaddyHamaliEntries(response.data.entries);
          console.log('🔍 DEBUG - Paddy hamali entries (OLD system):', response.data.entries);
          console.log('🔍 DEBUG - Sample paddy entry structure:', Object.values(response.data.entries)[0]);
        }
      }

      // Fetch rice hamali entries (NEW system - array structure)
      if (riceMovementIds.length > 0) {
        // Extract rice production IDs and stock movement IDs
        const riceProductionIds: number[] = [];
        const stockMovementIds: number[] = [];

        riceMovementIds.forEach(id => {
          if (typeof id === 'string' && id.startsWith('movement-')) {
            // Extract stock movement ID from "movement-123" format
            const stockId = parseInt(id.replace('movement-', ''));
            if (!isNaN(stockId)) {
              stockMovementIds.push(stockId);
            }
          } else if (typeof id === 'string' && (id.startsWith('purchase-') || id.startsWith('sale-') || id.startsWith('palti-'))) {
            // Extract stock movement ID from "purchase-123", "sale-123", "palti-123" format
            const stockId = parseInt(id.split('-')[1]);
            if (!isNaN(stockId)) {
              stockMovementIds.push(stockId);
            }
          } else if (typeof id === 'number') {
            // Direct rice production ID
            riceProductionIds.push(id);
          }
        });

        console.log('🔍 Fetching rice hamali entries for:', { riceProductionIds, stockMovementIds });

        // Use the NEW SIMPLIFIED endpoint that doesn't have PostgreSQL function issues
        try {
          const token = localStorage.getItem('token');
          const riceHamaliResponse = await axios.post<{ success: boolean; data: { entries: { [key: string]: any[] } } }>(
            '/rice-hamali-entries-simple/batch',
            { riceProductionIds, stockMovementIds },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (riceHamaliResponse.data.success && riceHamaliResponse.data.data.entries) {
            setRiceHamaliEntries(riceHamaliResponse.data.data.entries);
            console.log('✅ Rice hamali entries (NEW system) fetched successfully:', riceHamaliResponse.data.data.entries);
            console.log('🔍 DEBUG - Sample rice entry structure:', Object.values(riceHamaliResponse.data.data.entries)[0]);
          } else {
            console.log('⚠️ Rice hamali response not successful:', riceHamaliResponse.data);
          }
        } catch (riceHamaliError) {
          console.error('❌ Rice hamali fetching failed:', riceHamaliError);
          // Try fallback to original endpoint
          try {
            console.log('🔄 Trying fallback endpoint...');
            const token = localStorage.getItem('token');
            const fallbackResponse = await axios.post<{ entries: { [key: string]: any[] } }>(
              '/rice-hamali-entries/batch',
              { riceProductionIds, stockMovementIds },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (fallbackResponse.data.entries) {
              setRiceHamaliEntries(fallbackResponse.data.entries);
              console.log('✅ Rice hamali entries fetched via fallback');
            }
          } catch (fallbackError) {
            console.error('❌ Fallback rice hamali fetching also failed:', fallbackError);
            // Don't throw error - just log it so paddy hamali still works
          }
        }
      }
    } catch (error) {
      console.error('Error fetching hamali entries:', error);
    }
  };



  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: any = {};

      // Special handling for paddy stock - ALWAYS fetch all allowed data for accurate calculation
      if (activeTab === 'stock') {
        // We fetching ALL approved data to ensure local calculations (opening/closing/variety lookups) are correct
        // even if the user filters the UI to a specific date range.
        params.showAll = true;

        // Always filter for approved records only (required for accurate stock)
        params.status = 'approved';
        // Request higher limit for stock calculation
        params.limit = 5000;

        if (dateFrom || dateTo) {
          console.log(`📊 Stock tab: Fetching all records for calculation, UI will be filtered locally from ${dateFrom} to ${dateTo}`);
        } else {
          console.log(`📊 Stock tab: No date filter - requesting ALL data`);
        }
        console.log(`📊 Stock tab API params:`, params);
      } else {
        // For other tabs, use regular pagination
        params.page = page;
        params.limit = 250; // Always load 250 records per page

        // OPTIMIZED: Support combined month and date range filters
        if (dateFrom) params.dateFrom = convertDateFormat(dateFrom);
        if (dateTo) params.dateTo = convertDateFormat(dateTo);
        if (selectedMonth) params.month = selectedMonth;

        // If no filters are provided, handle the default state
        if (!dateFrom && !dateTo && !selectedMonth) {
          if (showAllRecords) {
            // "Show All" is active - no date filters sent to API (defaults to backend limit)
            params.showAll = true;
          } else {
            // Default to today's records (Business Date)
            const businessDate = getBusinessDate();
            params.dateFrom = businessDate;
            params.dateTo = businessDate;
          }
        }
      }

      if (debouncedSearch) params.search = debouncedSearch;

      const endpoint = activeTab === 'arrivals' ? '/records/arrivals' :
        activeTab === 'purchase' ? '/records/purchase' :
          activeTab === 'shifting' ? '/records/shifting' : '/records/stock';

      const response = await axios.get(endpoint, { params });
      const data = response.data as RecordsResponse;

      // Group records by week if needed (for arrivals, purchase, shifting tabs only)
      let processedRecords = data.records || {};
      if (groupBy === 'week' && activeTab !== 'stock' && activeTab !== 'outturn-report') {
        const weekGrouped: { [key: string]: Arrival[] } = {};

        Object.entries(processedRecords).forEach(([date, dateRecords]) => {
          const weekKey = getWeekKey(date);
          if (!weekGrouped[weekKey]) {
            weekGrouped[weekKey] = [];
          }
          weekGrouped[weekKey].push(...dateRecords);
        });

        processedRecords = weekGrouped;
      }

      setRecords(processedRecords);
      setClosedKunchinittus(data.closedKunchinittus || []); // Store closed kunchinittus
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalRecords(data.pagination?.totalRecords || 0);

      // Removed pagination toast notifications to prevent repeated toasts causing page scroll
      // The pagination info is visible in the UI

      // Check for truncated data (legacy support)
      if (data.pagination?.truncated) {
        toast.warning(`Data truncated. Showing first ${data.pagination.limit} records. Please refine your filters.`);
      }

      // Update available months from pagination data
      if (data.pagination?.availableMonths) {
        setAvailableMonths(data.pagination.availableMonths);
      }

      // Fetch hamali entries for all records
      const allRecords = Object.values(data.records || {}).flat();
      const arrivalIds = allRecords.map(r => r.id);

      // For rice stock tabs, also get rice movement IDs
      let riceMovementIds: string[] = [];
      if (activeTab === 'rice-stock' || activeTab === 'rice-outturn-report') {
        // Get all rice stock data IDs
        riceMovementIds = riceStockData.map(item => item.id?.toString()).filter(Boolean);
      }

      if (arrivalIds.length > 0 || riceMovementIds.length > 0) {
        fetchHamaliEntries(arrivalIds, riceMovementIds);
      }

      // Count pending records for manager/admin
      if (canEdit && activeTab === 'arrivals') {
        const pending = allRecords.filter(r => r.status === 'pending').length;
        setPendingCount(pending);

        // Count pending admin approvals (approved by manager but not by admin)
        if (user?.role === 'admin') {
          const pendingAdmin = allRecords.filter(r => r.status === 'approved' && !r.adminApprovedBy).length;
          setPendingAdminCount(pendingAdmin);
        }
      }

      // Auto-expand business date records when showing only today
      if (!showAllRecords && !dateFrom && !dateTo) {
        const businessDate = getBusinessDate();
        const recordDates = Object.keys(data.records || {});
        const businessDateExists = recordDates.some(date => date === businessDate);

        if (businessDateExists) {
          setExpandedDates(new Set([businessDate]));
        } else {
          setExpandedDates(new Set());
        }
      } else {
        // Keep all dates collapsed when showing all records or using filters
        setExpandedDates(new Set());
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      // Only show toast if it's a different error than last time
      const errorMsg = 'Failed to fetch records';
      if (lastToastMessage !== errorMsg) {
        toast.error(errorMsg);
        setLastToastMessage(errorMsg);
      }
      // Don't clear existing records - allow user to retry
      // Set empty availableMonths on error
      setAvailableMonths([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const toggleAllDates = () => {
    if (expandedDates.size === Object.keys(records).length) {
      // Collapse all
      setExpandedDates(new Set());
    } else {
      // Expand all
      setExpandedDates(new Set(Object.keys(records)));
    }
  };

  const toggleRateForm = async (recordId: number) => {
    if (expandedRateRecordId === recordId) {
      // Close the form
      setExpandedRateRecordId(null);
      setRateFormData({
        sute: '0',
        suteCalculationMethod: 'per_bag',
        baseRate: '',
        baseRateCalculationMethod: 'per_bag',
        rateType: 'CDL',
        h: '0',
        b: '0',
        bCalculationMethod: 'per_bag',
        lf: '0',
        lfCalculationMethod: 'per_bag',
        egb: '0',
        hCalculationMethod: 'per_bag'
      });
    } else {
      // Open the form and fetch existing rate if any
      setExpandedRateRecordId(recordId);
      try {
        const response = await axios.get<{ purchaseRate: any }>(`/purchase-rates/${recordId}`);
        if (response.data.purchaseRate) {
          const rate = response.data.purchaseRate;
          setRateFormData({
            sute: rate.sute?.toString() || '0',
            suteCalculationMethod: rate.suteCalculationMethod || 'per_bag',
            baseRate: rate.baseRate.toString(),
            baseRateCalculationMethod: rate.baseRateCalculationMethod || 'per_bag',
            rateType: rate.rateType,
            h: rate.h.toString(),
            b: rate.b.toString(),
            bCalculationMethod: rate.bCalculationMethod,
            lf: rate.lf.toString(),
            lfCalculationMethod: rate.lfCalculationMethod,
            egb: rate.egb.toString(),
            hCalculationMethod: rate.hCalculationMethod || 'per_bag'
          });
        }
      } catch (error) {
        // No existing rate, keep default values
        console.log('No existing rate found');
        // Explicitly reset to defaults for new entry
        setRateFormData({
          sute: '0',
          suteCalculationMethod: 'per_bag',
          baseRate: '',
          baseRateCalculationMethod: 'per_bag',
          rateType: 'CDL',
          h: '0',
          b: '0',
          bCalculationMethod: 'per_bag',
          lf: '0',
          lfCalculationMethod: 'per_bag',
          egb: '0',
          hCalculationMethod: 'per_bag'
        });
      }
    }
  };

  const handleRateInputChange = (field: string, value: string) => {
    setRateFormData((prev: any) => {
      const newData = { ...prev, [field]: value };

      // Apply column-type specific rules when rate type changes
      if (field === 'rateType') {
        // CDWB and MDWB: EGB = 0
        if (['CDWB', 'MDWB'].includes(value)) {
          newData.egb = '0';
        }
        // MDL and MDWB: LF = 0
        if (['MDL', 'MDWB'].includes(value)) {
          newData.lf = '0';
        }
      }

      return newData;
    });
  };

  const handleSaveRate = async (recordId: number) => {
    if (!rateFormData.baseRate || parseFloat(rateFormData.baseRate) <= 0) {
      toast.error('Base rate is required and must be greater than 0');
      return;
    }

    try {
      setSavingRate(true);

      // Check if rate already exists to determine if it's add or update
      // Wrap in try-catch so GET failure doesn't block the save operation
      let isUpdate = false;
      try {
        const checkResponse = await axios.get<{ purchaseRate: any }>(`/purchase-rates/${recordId}`);
        isUpdate = !!checkResponse.data.purchaseRate;
      } catch (checkError) {
        // If check fails, assume it's a new rate (will still save correctly)
        console.log('Could not check existing rate, assuming new:', checkError);
        isUpdate = false;
      }

      await axios.post('/purchase-rates', {
        arrivalId: recordId,
        sute: parseFloat(rateFormData.sute),
        suteCalculationMethod: rateFormData.suteCalculationMethod,
        baseRate: parseFloat(rateFormData.baseRate),
        baseRateCalculationMethod: rateFormData.baseRateCalculationMethod,
        rateType: rateFormData.rateType,
        h: parseFloat(rateFormData.h),
        b: parseFloat(rateFormData.b),
        bCalculationMethod: rateFormData.bCalculationMethod,
        lf: parseFloat(rateFormData.lf),
        lfCalculationMethod: rateFormData.lfCalculationMethod,
        egb: parseFloat(rateFormData.egb),
        hCalculationMethod: rateFormData.hCalculationMethod
      });

      toast.success(isUpdate ? NotificationMessages.purchaseRate.updated : NotificationMessages.purchaseRate.added);
      setExpandedRateRecordId(null);
      fetchRecords(); // Refresh to show updated rate
    } catch (error: any) {
      console.error('Error saving rate:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.error || error.message || NotificationMessages.purchaseRate.error;
      toast.error(errorMessage);
    } finally {
      setSavingRate(false);
    }
  };

  // Handler for updating rice stock movement entries
  const handleUpdateRiceMovement = async (updatedData: any) => {
    try {
      console.log('💾 Attempting to update rice movement:', updatedData);
      if (!editingRiceMovement?.id) {
        toast.error('No movement selected for editing');
        return;
      }

      // Determine which API to call based on movement type
      const movementType = editingRiceMovement.movementType?.toLowerCase();
      const isStockMovement = String(editingRiceMovement.originalId || editingRiceMovement.id).includes('movement-') ||
        ['purchase', 'sale', 'palti'].includes(movementType);

      let response;
      if (isStockMovement) {
        // Purchase, Sale, Palti - use rice-stock-management
        response = await axios.put<{ success: boolean; error?: string; message?: string }>(`/rice-stock-management/movements/${editingRiceMovement.id}`, {
          date: updatedData.date,
          movementType: editingRiceMovement.movementType,
          productType: updatedData.productType || updatedData.product_type,
          variety: updatedData.variety,
          bags: updatedData.bags,
          packagingBrand: updatedData.packagingBrand || updatedData.packaging_brand,
          packagingKg: updatedData.bagSizeKg || updatedData.bag_size_kg,
          locationCode: updatedData.locationCode || updatedData.location_code,
          billNumber: updatedData.billNumber || updatedData.bill_number,
          lorryNumber: updatedData.lorryNumber || updatedData.lorry_number,
          quantityQuintals: (updatedData.bags || 0) * ((updatedData.bagSizeKg || updatedData.bag_size_kg || 26) / 100)
        });
      } else {
        // Production entries - use rice-productions
        response = await axios.put<{ message?: string; production?: any; error?: string }>(`/rice-productions/${editingRiceMovement.id}`, {
          date: updatedData.date,
          productType: updatedData.productType || updatedData.product_type,
          variety: updatedData.variety,
          bags: updatedData.bags,
          packagingId: updatedData.packagingId || updatedData.packaging_id,
          packagingBrand: updatedData.packagingBrand || updatedData.packaging_brand,
          locationCode: updatedData.locationCode || updatedData.location_code,
          bagSizeKg: updatedData.bagSizeKg || updatedData.bag_size_kg
        });
      }

      // Handle both success patterns (cast to any to avoid union type issues)
      const data = response.data as any;
      if (data.success || data.message || data.production) {
        setEditingRiceMovement(null);

        // COMPREHENSIVE REFRESH: Await ALL fetch calls to ensure immediate UI update
        // Using Promise.all for parallel fetching with guaranteed completion
        try {
          await Promise.all([
            fetchRiceStock(),           // Refresh Rice Stock tab
            fetchProductionRecords(),   // Refresh Production Shifting records
            fetchOutturns(),            // Refresh outturns list for Outturn Report tab
            fetchByProducts(),          // Refresh By-Products records
            fetchRecords(),             // Refresh main records (affects all tabs)
            fetchAllRiceProductions(),   // Refresh all productions for Paddy Stock deductions
            fetchOpeningBalance()       // Refresh opening balance for Paddy Stock continuity
          ]);


          toast.success('Rice movement updated successfully - All data refreshed!');
        } catch (refreshError) {
          console.error('Error refreshing data:', refreshError);
          toast.success('Rice movement updated - Please refresh if data not showing');
        }
      } else {
        toast.error(data.error || 'Failed to update movement');
      }
    } catch (error: any) {
      console.error('Error updating rice movement:', error);
      toast.error(error.response?.data?.error || 'Failed to update rice movement');
    }
  };


  const fetchOutturns = async () => {

    try {
      const response = await axios.get<any[]>('/outturns');
      setOutturns(response.data);
    } catch (error) {
      console.error('Error fetching outturns:', error);
      toast.error('Failed to fetch outturns');
    }
  };

  const confirmClearOutturn = async () => {
    if (!clearOutturnDate) {
      toast.error('Please select a clear date');
      return;
    }

    try {
      const response = await axios.post<{ message: string }>(`/outturns/${selectedOutturnId}/clear`,
        { clearDate: clearOutturnDate },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      toast.success(response.data.message || 'Outturn cleared successfully!');
      setShowClearOutturnDialog(false);
      fetchOutturns();
      setSelectedOutturnId('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to clear outturn');
    }
  };

  const fetchProductionRecords = async () => {
    try {
      // Fetch both production-shifting AND for-production purchases
      const [productionShiftingResponse, forProductionResponse] = await Promise.all([
        axios.get<any>('/records/arrivals', {
          params: {
            movementType: 'production-shifting',
            outturnId: selectedOutturnId
          }
        }),
        axios.get<any>('/records/arrivals', {
          params: {
            movementType: 'purchase',
            outturnId: selectedOutturnId
          }
        })
      ]);

      const productionShiftingRecords = productionShiftingResponse.data.records
        ? Object.values(productionShiftingResponse.data.records).flat().filter((r: any) => r.outturnId === parseInt(selectedOutturnId))
        : [];

      const forProductionRecords = forProductionResponse.data.records
        ? Object.values(forProductionResponse.data.records).flat().filter((r: any) => r.outturnId === parseInt(selectedOutturnId))
        : [];

      // Combine both production-shifting and for-production purchases
      const allProductionRecords = [...productionShiftingRecords, ...forProductionRecords];
      setProductionRecords(allProductionRecords as any[]);
    } catch (error) {
      console.error('Error fetching production records:', error);
    }
  };

  const fetchByProducts = async () => {
    if (!selectedOutturnId) return;

    try {
      const response = await axios.get<any[]>(`/byproducts/outturn/${selectedOutturnId}`);
      setByProducts(response.data);
    } catch (error) {
      console.error('Error fetching by-products:', error);
    }
  };

  const handleSubmitByProducts = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double-click submission
    if (isSubmittingByProducts) {
      return;
    }

    if (!selectedOutturnId) {
      toast.error('Please select an outturn first');
      return;
    }

    if (!byProductDate) {
      toast.error('Please select a date');
      return;
    }

    setIsSubmittingByProducts(true);
    setLoading(true);
    try {
      // Only send values that were actually entered, not zeros
      const payload: any = {
        outturnId: parseInt(selectedOutturnId),
        date: byProductDate.toISOString().split('T')[0]
      };

      // Only include fields with actual values
      if (rice && rice.trim() !== '') payload.rice = parseFloat(rice);
      if (rejectionRice && rejectionRice.trim() !== '') payload.rejectionRice = parseFloat(rejectionRice);
      if (broken && broken.trim() !== '') payload.broken = parseFloat(broken);
      if (rejectionBroken && rejectionBroken.trim() !== '') payload.rejectionBroken = parseFloat(rejectionBroken);
      if (zeroBroken && zeroBroken.trim() !== '') payload.zeroBroken = parseFloat(zeroBroken);
      if (faram && faram.trim() !== '') payload.faram = parseFloat(faram);
      if (bran && bran.trim() !== '') payload.bran = parseFloat(bran);

      await axios.post('/byproducts', payload);

      toast.success('By-products recorded successfully!');

      // Reset form
      setRice('');
      setRejectionRice('');
      setBroken('');
      setRejectionBroken('');
      setZeroBroken('');
      setFaram('');
      setBran('');

      // Refresh by-products list
      fetchByProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record by-products');
    } finally {
      setLoading(false);
      setIsSubmittingByProducts(false);
    }
  };

  const fetchPackagings = async () => {
    try {
      console.log('Fetching packagings...');
      const response = await axios.get<any>('/packagings');
      console.log('Packagings response:', response.data);
      setPackagings(response.data.packagings || []);
    } catch (error: any) {
      console.error('Error fetching packagings:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to fetch packagings');
    }
  };

  const fetchLocationsData = async () => {
    try {
      console.log('Fetching kunchinittus...');
      const response = await axios.get<any>('/locations/kunchinittus');
      console.log('Kunchinittus response:', response.data);
      setLocationsData(response.data.kunchinittus || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to fetch locations');
    }
  };

  const fetchRiceStockLocations = async () => {
    try {
      const response = await axios.get<any>('/locations/rice-stock-locations');
      setRiceStockLocations(response.data.locations || []);
    } catch (error: any) {
      console.error('Error fetching rice stock locations:', error);
      toast.error('Failed to fetch rice stock locations');
    }
  };

  const handleRiceProductionSubmit = async () => {
    // Prevent double-click submission
    if (isSubmittingRiceProduction) {
      return;
    }

    if (!selectedOutturnId) {
      toast.error('Please select an outturn number');
      return;
    }

    if (!productionDate || !productType || !bags || !packagingId) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmittingRiceProduction(true);

    const prodDateObj = new Date(productionDate + 'T00:00:00');

    if (isNaN(prodDateObj.getTime())) {
      toast.error('Invalid date format');
      return;
    }

    // Date validation removed - allow any date for rice production entry

    if (movementType === 'kunchinittu' && !locationCode) {
      toast.error('Location code is required for Kunchinittu movement');
      return;
    }

    if (movementType === 'loading' && (!lorryNumber || !billNumber)) {
      toast.error('Lorry number and bill number are required for Loading movement');
      return;
    }

    try {
      const selectedOutturn = outturns.find(o => o.id === parseInt(selectedOutturnId));

      console.log('Production Date Input:', productionDateInput);
      console.log('Production Date (YYYY-MM-DD):', productionDate);

      const outturnCode = selectedOutturn?.code || selectedOutturn?.outturnNumber;
      if (!outturnCode) {
        toast.error('Outturn code not found');
        return;
      }

      const payload = {
        outturnNumber: outturnCode,
        date: productionDate,
        productType: productType,
        bags: parseFloat(bags),
        packagingId: parseInt(packagingId),
        movementType: movementType,
        locationCode: movementType === 'kunchinittu' ? locationCode : null,
        lorryNumber: movementType === 'loading' ? lorryNumber : null,
        billNumber: movementType === 'loading' ? billNumber : null
      };

      console.log('Payload being sent:', payload);

      // DETAILED LOGGING FOR SIZER BROKEN
      if (productType === 'Sizer Broken') {
        console.log('🔍 SIZER BROKEN DETECTED:');
        console.log('  - Product Type:', productType);
        console.log('  - Product Type Length:', productType.length);
        console.log('  - Product Type Char Codes:', Array.from(productType).map(c => c.charCodeAt(0)));
        console.log('  - Exact Match Test:', productType === 'Sizer Broken');
        console.log('  - Trimmed:', productType.trim());
        console.log('  - Full Payload:', JSON.stringify(payload, null, 2));
      }

      // Save to rice-productions table (backend automatically creates/updates by-product entry)
      await axios.post('/rice-productions', payload);

      toast.success('Rice production entry saved successfully!');

      // Refresh available bags
      const bagsResponse = await axios.get<{ availableBags: number }>(`/rice-productions/outturn/${selectedOutturnId}/available-bags`);
      setAvailableBags(bagsResponse.data.availableBags);

      // Reset form
      try {
        // Keep the same production date for convenience (user can change if needed)
      } catch (error) {
        console.error('Error resetting date:', error);
      }

      setProductType('');
      setBags('');
      setPackagingId('');
      setQuantityQuintals(0);
      setPaddyBagsDeducted(0);
      setMovementType('kunchinittu');
      setLocationCode('');
      setLorryNumber('');
      setBillNumber('');

      // Refresh production records, rice stock, by-products AND paddy stock data
      fetchProductionRecords();
      fetchRiceStock();
      fetchByProducts();
      fetchRecords();
      fetchAllRiceProductions();
      fetchOpeningBalance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save entry');
    } finally {
      setIsSubmittingRiceProduction(false);
    }
  };

  // Fetch all rice productions for Paddy Stock calculations (deductions and cleared outturns)
  // IMPORTANT: We fetch ALL rice productions regardless of date filter
  // because rice deductions from any time affect the running stock calculation
  const fetchAllRiceProductions = async () => {
    try {
      console.log('📊 Fetching ALL rice productions for Paddy Stock (no date filter)...');
      const token = localStorage.getItem('token');

      // Fetch ALL productions without date filters
      // This ensures rice deductions from all dates are included in stock calculation
      const params: any = { limit: 10000 };

      // DO NOT apply date filters for rice productions
      // The frontend will filter by date when displaying, but we need ALL data for stock calculation

      const response = await axios.get<{ productions: any[]; pagination?: any }>('/rice-productions', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const productions = response.data.productions || [];
      console.log(`✅ Fetched ${productions.length} rice productions for Paddy Stock (ALL dates)`);

      setAllRiceProductions(productions);
    } catch (error) {
      console.error('❌ Error fetching all rice productions:', error);
      // Don't show error toast - this is a background fetch
      setAllRiceProductions([]);
    }
  };

  const fetchRiceStock = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching rice stock data...');
      console.log('🔍 Active tab:', activeTab);
      console.log('🔍 Filters:', { dateFrom, dateTo, riceStockProductType, riceStockLocationCode });

      // For both Rice Stock Movement tabs: fetch ALL movements (Production + Purchase + Sale)
      if (activeTab === 'rice-outturn-report' || activeTab === 'rice-stock') {
        const token = localStorage.getItem('token');

        if (!token) {
          console.error('❌ No authentication token found');
          toast.error('Authentication required. Please login again.');
          setLoading(false);
          return;
        }

        // Fetch rice productions with month filter only (no date range)
        console.log('📊 Fetching rice productions...');
        const productionsParams: any = {
          limit: 100,
          page: riceStockPage
        };

        // OPTIMIZED: Support combined month and date range filters
        if (dateFrom) productionsParams.dateFrom = convertDateFormat(dateFrom);
        if (dateTo) productionsParams.dateTo = convertDateFormat(dateTo);
        if (selectedMonth) productionsParams.month = selectedMonth;

        const productionsResponse = await axios.get<{ productions: any[]; pagination?: any }>('/rice-productions', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          },
          params: productionsParams
        });
        console.log('✅ Rice productions response:', productionsResponse.data.productions?.length || 0, 'records');

        // Update pagination state if returned
        if (productionsResponse.data.pagination) {
          setRiceStockTotalPages(productionsResponse.data.pagination.totalPages || 1);
          setRiceStockTotalRecords(productionsResponse.data.pagination.totalRecords || 0);
        }

        // Fetch rice stock movements (Purchase/Sale/Palti)
        console.log('📦 Fetching rice stock movements...');
        let stockMovements: any[] = [];
        try {
          const movementsParams: any = {
            limit: 100,
            page: riceStockPage,
            _t: Date.now() // Cache buster
          };

          // OPTIMIZED: Support combined month and date range filters
          if (dateFrom) movementsParams.dateFrom = convertDateFormat(dateFrom);
          if (dateTo) movementsParams.dateTo = convertDateFormat(dateTo);
          if (selectedMonth) {
            const [year, month] = selectedMonth.split('-');
            movementsParams.year = year;
            movementsParams.month = parseInt(month);
          }

          // Add product type filter if available
          if (riceStockProductType) movementsParams.productType = riceStockProductType;

          const movementsResponse = await axios.get('/rice-stock-management/movements', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            params: movementsParams
          });

          stockMovements = (movementsResponse.data as any).data?.movements || [];
          console.log('✅ Rice stock movements response:', stockMovements.length, 'records');

          // Filter by approval status on frontend (show all statuses for debugging)
          const approvedMovements = stockMovements.filter((m: any) => m.status === 'approved');
          const pendingMovements = stockMovements.filter((m: any) => m.status === 'pending');
          console.log('📋 Movement status breakdown:', {
            approved: approvedMovements.length,
            pending: pendingMovements.length,
            total: stockMovements.length
          });

          // Use all movements for now (not just approved) to debug
          // stockMovements = approvedMovements;

        } catch (error: any) {
          console.error('❌ Rice stock movements fetch failed:', error.response?.data || error.message);
          if (error.response?.status === 401) {
            toast.error('Authentication failed. Please login again.');
          } else if (error.response?.status === 404) {
            console.log('ℹ️ No rice stock movements found');
          } else {
            console.log('⚠️ Rice stock movements not available:', error.message);
          }
        }

        // Combine and format all movements
        console.log('🔄 Processing and combining data...');
        let allMovements = [
          // Production entries - include status field (productions are typically auto-approved)
          ...(productionsResponse.data.productions || []).map((prod: any) => ({
            ...prod,
            movementType: 'production',
            variety: prod.outturn?.allottedVariety || 'Sum25 RNR Raw',
            productType: prod.productType || prod.product || 'Rice', // Add product type
            bagSizeKg: prod.packaging?.allottedKg || 26,
            packagingId: prod.packagingId, // Ensure packagingId is available for edits
            packagingBrand: prod.packaging?.brandName || prod.packaging_brand || 'A1',
            packagingKg: prod.packaging?.allottedKg || prod.bagSizeKg || 26,
            quantityQuintals: prod.quantityQuintals,
            // FIXED: Include status field for production records (default to 'approved' as productions are auto-approved)
            status: prod.status || 'approved',
            // Ensure packaging object is properly structured
            packaging: prod.packaging ? {
              brandName: prod.packaging.brandName || 'A1',
              allottedKg: prod.packaging.allottedKg || 26
            } : {
              brandName: 'A1',
              allottedKg: 26
            },
            from: `Outt1-${prod.outturn?.code || 'Sum25 RNR Raw'}`,
            to: prod.locationCode || 'A1',
            fromLocation: `Outt1-${prod.outturn?.code || 'Sum25 RNR Raw'}`,
            toLocation: prod.locationCode || 'A1',
            partyName: null,
            billNumber: prod.billNumber,
            lorryNumber: prod.lorryNumber
          })),

          // Purchase/Sale/Palti entries
          ...stockMovements.map((movement: any) => {
            // High-resilience extraction (handle camelCase, snake_case, lowercase, and PascalCase)
            const mvtType = (movement.movementType || movement.movement_type || movement.MovementType || movement.movementtype || 'unknown').toLowerCase();
            const bags = parseInt(movement.bags || movement.BAGS || movement.Bags) || 0;
            const bagSize = parseFloat(movement.bagSizeKg || movement.bag_size_kg || movement.bagsizekg || movement.BagSizeKg) || 26;

            // Calculate quantityQuintals if missing/zero (using double-check for all case variations)
            let qtls = parseFloat(movement.quantityQuintals || movement.quantity_quintals || movement.quantityquintals || movement.QuantityQuintals);
            if (isNaN(qtls) || qtls === 0) {
              qtls = (bags * bagSize) / 100;
            }

            // Standardize location keys
            const locationCode = movement.locationCode || movement.location_code || movement.locationcode || movement.LocationCode;
            const fromLocExplicit = movement.fromLocation || movement.from_location || movement.fromlocation || movement.FromLocation;
            const toLocExplicit = movement.toLocation || movement.to_location || movement.tolocation || movement.ToLocation;

            // Logical location fallbacks for specific movement types
            let fromLoc = fromLocExplicit;
            let toLoc = toLocExplicit;

            if (mvtType === 'purchase') {
              fromLoc = fromLocExplicit || 'Purchase';
              toLoc = toLocExplicit || locationCode;
            } else if (mvtType === 'sale') {
              fromLoc = fromLocExplicit || locationCode;
              toLoc = toLocExplicit || 'Sale';
            } else if (mvtType === 'palti') {
              fromLoc = fromLocExplicit || locationCode || 'Source';
              toLoc = toLocExplicit || 'Target';
            } else {
              fromLoc = fromLocExplicit || locationCode || '-';
              toLoc = toLocExplicit || locationCode || '-';
            }

            return {
              id: `movement-${movement.id || movement.ID}`,
              date: movement.date || movement.DATE || movement.Date,
              productType: movement.productType || movement.product_type || movement.producttype || 'Rice',
              movementType: mvtType,
              variety: movement.variety || movement.VARIETY || movement.Variety || 'Sum25 RNR Raw',
              bags: bags,
              sourceBags: mvtType === 'palti' ? (parseInt(movement.sourceBags || movement.source_bags) || bags) : null,
              bagSizeKg: bagSize,
              packagingId: movement.packagingId || movement.targetPackagingId, // Include packagingId if available
              packagingBrand: movement.packagingBrand || movement.packaging_brand || movement.packagingbrand || movement.targetPackagingBrand || movement.target_packaging_brand || 'A1',
              packagingKg: movement.packagingKg || movement.packaging_kg || movement.packagingkg || bagSize,
              quantityQuintals: qtls,
              packaging: {
                brandName: movement.packagingBrand || movement.packaging_brand || movement.packagingbrand || movement.targetPackagingBrand || movement.target_packaging_brand || 'A1',
                allottedKg: movement.packagingKg || movement.packaging_kg || movement.packagingkg || bagSize
              },
              sourcePackaging: mvtType === 'palti' ? {
                brandName: movement.sourcePackagingBrand || movement.source_packaging_brand || movement.sourcepackagingbrand || 'A1',
                allottedKg: movement.sourcePackagingKg || movement.source_packaging_kg || 26
              } : null,
              targetPackaging: mvtType === 'palti' ? {
                brandName: movement.targetPackagingBrand || movement.target_packaging_brand || movement.targetpackagingbrand || 'A1',
                allottedKg: movement.targetPackagingKg || movement.target_packaging_kg || 26
              } : null,
              shortageKg: parseFloat(movement.conversionShortageKg || movement.conversion_shortage_kg || 0),
              shortageBags: parseFloat(movement.conversionShortageBags || movement.conversion_shortage_bags || 0),
              from: fromLoc,
              to: toLoc,
              fromLocation: fromLoc,
              toLocation: toLoc,
              locationCode: locationCode,
              status: movement.status || movement.STATUS,
              createdBy: movement.createdByUsername || movement.created_by_username || movement.createdbyusername,
              approvedBy: movement.approvedByUsername || movement.approved_by_username,
              // Include admin approval information for bifurcation logic
              adminApprovedBy: movement.adminApprovedBy || movement.admin_approved_by,
              createdByAdmin: (movement.createdByRole || movement.created_by_role) === 'admin',
              partyName: movement.partyName || movement.party_name,
              billNumber: movement.billNumber || movement.bill_number,
              lorryNumber: movement.lorryNumber || movement.lorry_number,
              ratePerBag: movement.ratePerBag || movement.rate_per_bag,
              totalAmount: movement.totalAmount || movement.total_amount
            };
          })
        ];

        console.log('📊 Data before filtering:', {
          productions: productionsResponse.data.productions?.length || 0,
          stockMovements: stockMovements.length,
          combined: allMovements.length
        });

        // Apply filters if they are set (only product type and location - no date range)
        const originalLength = allMovements.length;
        if (riceStockProductType || riceStockLocationCode) {
          console.log('🔍 Applying filters...');
          allMovements = allMovements.filter((movement: any) => {
            // Product type filtering
            if (riceStockProductType && movement.productType !== riceStockProductType) {
              return false;
            }

            // Location filtering
            if (riceStockLocationCode && movement.locationCode !== riceStockLocationCode) {
              return false;
            }

            return true;
          });
          console.log(`📊 Filtered from ${originalLength} to ${allMovements.length} records`);
        } else {
          console.log('📊 No filters applied, showing all records');
        }

        // Sort by date (newest first)
        allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        console.log('✅ Final data summary:', {
          totalRecords: allMovements.length,
          productionRecords: allMovements.filter(m => m.movementType === 'production').length,
          purchaseRecords: allMovements.filter(m => m.movementType === 'purchase').length,
          saleRecords: allMovements.filter(m => m.movementType === 'sale').length,
          paltiRecords: allMovements.filter(m => m.movementType === 'palti').length,
          dateRange: allMovements.length > 0 ? {
            earliest: allMovements[allMovements.length - 1]?.date,
            latest: allMovements[0]?.date
          } : null
        });

        setRiceStockData(allMovements);

        // Fetch rice hamali entries for all movements
        const riceMovementIds = allMovements.map(item => item.id?.toString()).filter(Boolean);
        if (riceMovementIds.length > 0) {
          console.log('🔍 Fetching rice hamali entries for', riceMovementIds.length, 'movements');
          fetchHamaliEntries([], riceMovementIds);
        } else {
          console.log('ℹ️ No movement IDs found for hamali entries');
        }

        // No toast notifications for normal data load to prevent repeated toasts
        // causing page scroll. Only show toast for errors.
      }
    } catch (error: any) {
      console.error('❌ Error fetching rice stock:', error);

      // Handle specific error codes
      if (error.response?.status === 400) {
        toast.error(error.response?.data?.error || 'Invalid filter parameters');
      } else if (error.response?.status === 401) {
        toast.error('Authentication failed. Please login again.');
      } else if (error.response?.status === 404) {
        toast.info('No records found for the selected filters');
        setRiceStockData([]);
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (error.response?.status === 503) {
        toast.error('Database connection error. Please try again.');
      } else if (!error.response) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to fetch rice stock data');
      }

      // Set empty data on error
      setRiceStockData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await axios.patch(`/arrivals/${id}/approve`, { status });
      setLastToastMessage(''); // Clear last toast
      toast.success(`Record ${status} successfully`);
      fetchRecords();
      fetchOpeningBalance(); // Refresh stock totals
      fetchAllRiceProductions(); // Refresh production deductions
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${status} record`);
    }
  };

  const handleAdminApprove = async (id: number) => {
    try {
      await axios.patch(`/arrivals/${id}/admin-approve`);
      toast.success('Record approved by admin - added to paddy stock');
      fetchRecords();
      fetchOpeningBalance(); // Refresh stock totals
      fetchAllRiceProductions(); // Refresh production deductions
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve record');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this arrival? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/arrivals/${id}`);
      toast.success('Arrival deleted successfully');
      fetchRecords();
      fetchOpeningBalance();
      fetchAllRiceProductions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete arrival');
    }
  };

  const fetchPendingMovements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/rice-stock-management/movements/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingMovements((response.data as any).data.movements || []);
    } catch (error: any) {
      console.error('Error fetching pending movements:', error);
      if (error.response?.status !== 403) {
        toast.error('Failed to fetch pending movements');
      }
    }
  };

  const handleApproveMovement = async (id: number, status: 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/rice-stock-management/movements/${id}/status`, {
        status,
        rejectionReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Movement ${status} successfully`);
      fetchPendingMovements();
      fetchRiceStock(); // Refresh main data
      fetchOpeningBalance(); // Refresh stock totals
      fetchAllRiceProductions(); // Refresh production deductions
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${status} movement`);
    }
  };

  // Bulk approve selected rice stock movements
  const handleBulkApprove = async () => {
    if (selectedMovementIds.size === 0) {
      toast.warning('Please select at least one movement to approve');
      return;
    }

    setIsBulkProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/rice-stock-management/movements/bulk-approve', {
        ids: Array.from(selectedMovementIds)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { approved, failed } = (response.data as any).data;

      if (approved.length > 0) {
        toast.success(`✓ ${approved.length} movement${approved.length > 1 ? 's' : ''} approved successfully`);
      }
      if (failed.length > 0) {
        toast.warning(`⚠ ${failed.length} movement${failed.length > 1 ? 's' : ''} could not be approved`);
      }

      // Clear selection and refresh data
      setSelectedMovementIds(new Set());
      fetchPendingMovements();
      fetchRiceStock();
      fetchOpeningBalance();
      fetchAllRiceProductions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to bulk approve movements');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk reject selected rice stock movements
  const handleBulkReject = async () => {
    if (selectedMovementIds.size === 0) {
      toast.warning('Please select at least one movement to reject');
      return;
    }

    const reason = prompt('Rejection reason (optional):');

    setIsBulkProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/rice-stock-management/movements/bulk-reject', {
        ids: Array.from(selectedMovementIds),
        rejectionReason: reason || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { rejected, failed } = (response.data as any).data;

      if (rejected.length > 0) {
        toast.success(`✗ ${rejected.length} movement${rejected.length > 1 ? 's' : ''} rejected`);
      }
      if (failed.length > 0) {
        toast.warning(`⚠ ${failed.length} movement${failed.length > 1 ? 's' : ''} could not be rejected`);
      }

      // Clear selection and refresh data
      setSelectedMovementIds(new Set());
      fetchPendingMovements();
      fetchRiceStock();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to bulk reject movements');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Toggle selection of a single movement
  const toggleMovementSelection = (id: number) => {
    setSelectedMovementIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle select all movements
  const toggleSelectAllMovements = () => {
    if (selectedMovementIds.size === pendingMovements.length) {
      setSelectedMovementIds(new Set());
    } else {
      setSelectedMovementIds(new Set(pendingMovements.map((m: any) => m.id)));
    }
  };

  const handleEdit = (record: Arrival) => {
    setEditingRecord(record);
  };

  const handleEditSuccess = () => {
    fetchRecords();
    fetchOpeningBalance();
    fetchAllRiceProductions();
    setEditingRecord(null);
  };

  // exportCSV function removed as per user request

  const exportPDF = async () => {
    try {
      const params: any = {
        grouping: groupBy, // Pass day-wise or week-wise grouping
        ...(dateFrom && { dateFrom: convertDateFormat(dateFrom) }),
        ...(dateTo && { dateTo: convertDateFormat(dateTo) })
      };

      // Determine endpoint and filename based on active tab
      let endpoint = 'export/pdf/arrivals';
      let filename = 'arrivals';

      if (activeTab === 'purchase') {
        endpoint = 'export/pdf/purchase';
        filename = 'purchase_records';
      } else if (activeTab === 'shifting') {
        endpoint = 'export/pdf/shifting';
        filename = 'shifting_records';
      } else if (activeTab === 'stock') {
        endpoint = 'export/pdf/stock';
        filename = 'paddy_stock';
      } else if (activeTab === 'outturn-report') {
        if (!selectedOutturnId) {
          toast.error('Please select an Outturn to export');
          return;
        }
        endpoint = `export/pdf/outturn/${selectedOutturnId}`;
        filename = `outturn_report_${outturns.find((o: any) => o.id == selectedOutturnId)?.code || 'report'}`;
      } else if (activeTab === 'rice-outturn-report') {
        endpoint = 'export/pdf/rice-stock-movements';
        filename = 'rice_stock_movements';
        // Use date range filters
        if (dateFrom) params.dateFrom = convertDateFormat(dateFrom);
        if (dateTo) params.dateTo = convertDateFormat(dateTo);
        if (riceStockProductType) params.productType = riceStockProductType;
      } else if (activeTab === 'rice-stock') {
        endpoint = 'export/pdf/rice-stock';
        filename = 'rice_stock';
        // Use date range filters
        if (dateFrom) params.dateFrom = convertDateFormat(dateFrom);
        if (dateTo) params.dateTo = convertDateFormat(dateTo);
        if (riceStockProductType) params.productType = riceStockProductType;
        if (riceStockLocationCode) params.locationCode = riceStockLocationCode;
      }

      const response = await axios.get(endpoint, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('PDF exported successfully');
    } catch (error: any) {
      console.error('PDF export error:', error);

      // Enhanced error handling with specific messages
      if (error.response?.status === 413) {
        toast.error('Dataset too large for PDF export. Please apply date filters to reduce the number of records.');
      } else if (error.response?.status === 404) {
        toast.error('No records found for the selected criteria.');
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.error || 'Invalid request parameters.');
      } else if (error.response?.status === 503) {
        toast.error('Database connection error. Please try again in a moment.');
      } else if (error.response?.status === 504) {
        toast.error('Request timeout. Please try with fewer records or a smaller date range.');
      } else {
        toast.error('Failed to export PDF. Please try again or contact support if the issue persists.');
      }
    }
  };

  const canEdit = user?.role === 'manager' || user?.role === 'admin';

  return (
    <Container>
      <Title>📊 Records Management</Title>

      {/* Pending Approvals Alerts */}
      {canEdit && activeTab === 'arrivals' && (pendingCount > 0 || pendingAdminCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Manager Approval Alert */}
          {pendingCount > 0 && (
            <PendingAlert>
              <div className="count">{pendingCount}</div>
              <div className="text">
                ⚠️ Pending Manager Approval{pendingCount > 1 ? 's' : ''} - {pendingCount} arrival{pendingCount > 1 ? 's' : ''} waiting for review
              </div>
            </PendingAlert>
          )}

          {/* Admin Approval Alert */}
          {user?.role === 'admin' && pendingAdminCount > 0 && (
            <PendingAlert style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', borderColor: '#3b82f6' }}>
              <div className="count" style={{ background: '#3b82f6' }}>{pendingAdminCount}</div>
              <div className="text" style={{ color: '#1e40af' }}>
                🔵 Pending Admin Approval{pendingAdminCount > 1 ? 's' : ''} - {pendingAdminCount} arrival{pendingAdminCount > 1 ? 's' : ''} need final approval for Paddy Stock
              </div>
            </PendingAlert>
          )}
        </div>
      )}

      {/* Tabs */}
      <TabContainer>
        <Tab $active={activeTab === 'arrivals'} onClick={() => handleTabChange('arrivals')}>
          All Arrivals {canEdit && (pendingCount + pendingAdminCount) > 0 && `(${pendingCount + pendingAdminCount})`}
        </Tab>
        <Tab $active={activeTab === 'purchase'} onClick={() => handleTabChange('purchase')}>
          Purchase Records
        </Tab>
        <Tab $active={activeTab === 'shifting'} onClick={() => handleTabChange('shifting')}>
          Shifting Records
        </Tab>
        <Tab $active={activeTab === 'stock'} onClick={() => handleTabChange('stock')}>
          Paddy Stock
        </Tab>
        <Tab $active={activeTab === 'outturn-report'} onClick={() => handleTabChange('outturn-report')}>
          Outturn Report
        </Tab>
        <Tab $active={activeTab === 'rice-outturn-report'} onClick={() => handleTabChange('rice-outturn-report')}>
          Rice Stock Movement
        </Tab>
        <Tab $active={activeTab === 'rice-stock'} onClick={() => handleTabChange('rice-stock')}>
          Rice Stock
        </Tab>
      </TabContainer>

      {/* Filters - Show for ALL tabs */}
      <FilterSection>
        {/* Unified Business Date & Toggle Row */}
        {activeTab !== 'outturn-report' && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: showAllRecords ? '#FEF3C7' : '#D1FAE5',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: showAllRecords ? '2px solid #F59E0B' : '2px solid #10B981'
          }}>
            <div>
              <strong style={{ color: showAllRecords ? '#D97706' : '#059669' }}>
                {showAllRecords ? '📋 Showing All Records' : `📅 Business Date: ${(() => {
                  const businessDate = getBusinessDate();
                  return new Date(businessDate + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                })()}`}
              </strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                {showAllRecords
                  ? 'Viewing all historical records with current filters'
                  : 'Showing only today\'s records (Business day starts at 6 AM)'}
              </p>
            </div>
            <Button
              className={showAllRecords ? 'secondary' : 'primary'}
              onClick={() => {
                setShowAllRecords(!showAllRecords);
                if (!showAllRecords) {
                  // If switching TO "Show All", clear month to avoid conflicts
                  setSelectedMonth('');
                }
              }}
              style={{ minWidth: '150px' }}
            >
              {showAllRecords ? '📅 Today Only' : '📋 Show All'}
            </Button>
          </div>
        )}

        <FilterRow>
          {/* Month Selector - Enabled for all tabs including Paddy Stock */}
          {(activeTab === 'arrivals' || activeTab === 'purchase' || activeTab === 'shifting' || activeTab === 'stock' || activeTab === 'rice-stock' || activeTab === 'rice-outturn-report') && (
            <FormGroup>
              <Label>Month Filter</Label>
              <Select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  if (e.target.value) setShowAllRecords(false); // Month filter takes precedence over "Show All"
                }}
                disabled={availableMonths.length === 0}
              >
                <option value="">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.month_label}
                  </option>
                ))}
              </Select>
            </FormGroup>
          )}

          {/* Date Range - enabled for all tabs as requested */}
          {(activeTab === 'arrivals' || activeTab === 'purchase' || activeTab === 'shifting' || activeTab === 'stock' || activeTab === 'rice-stock' || activeTab === 'rice-outturn-report') && (
            <>
              <FormGroup>
                <Label>Date From</Label>
                <Input
                  type="text"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="DD-MM-YYYY"
                />
              </FormGroup>

              <FormGroup>
                <Label>Date To</Label>
                <Input
                  type="text"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="DD-MM-YYYY"
                />
              </FormGroup>
            </>
          )}

          {/* Rice Specific Filters - Only for Rice Outturn Report tab */}
          {activeTab === 'rice-outturn-report' && (
            <>
              <FormGroup>
                <Label>Product Type</Label>
                <Select
                  value={riceStockProductType}
                  onChange={(e) => setRiceStockProductType(e.target.value)}
                >
                  <option value="">All Products</option>
                  <option value="Rice">Rice</option>
                  <option value="Bran">Bran</option>
                  <option value="Farm Bran">Farm Bran</option>
                  <option value="Rejection Rice">Rejection Rice</option>
                  <option value="Sizer Broken">Sizer Broken</option>
                  <option value="RJ Broken">RJ Broken</option>
                  <option value="Broken">Broken</option>
                  <option value="Zero Broken">Zero Broken</option>
                  <option value="Faram">Faram</option>
                  <option value="Unpolished">Unpolished</option>
                  <option value="RJ Rice 1">RJ Rice 1</option>
                  <option value="RJ Rice 2">RJ Rice 2</option>
                </Select>
              </FormGroup>
            </>
          )}


          {/* Grouping Selector */}
          {(activeTab === 'arrivals' || activeTab === 'purchase' || activeTab === 'shifting' || activeTab === 'stock' || activeTab === 'rice-outturn-report') && (
            <FormGroup>
              <Label>Report Grouping</Label>
              <Select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'week' | 'date')}
              >
                <option value="date">📅 Daily View</option>
                <option value="week">📅 Weekly View</option>
              </Select>
            </FormGroup>
          )}

          {/* Search */}
          <FormGroup>
            <Label>Search</Label>
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SL No, WB No, Lorry..."
            />
          </FormGroup>

          {/* Actions Row */}
          <div style={{ display: 'flex', gap: '0.5rem', gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
            <Button className="primary" onClick={fetchRecords} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔍 Search
            </Button>

            <Button className="secondary" onClick={() => {
              if (activeTab === 'rice-stock' || activeTab === 'rice-outturn-report') {
                setDateFrom('');
                setDateTo('');
                setRiceStockProductType('');
                setRiceStockLocationCode('');
              } else {
                setDateFrom('');
                setDateTo('');
                setSearch('');
                setSelectedMonth('');
                setShowAllRecords(false);
              }
              fetchRecords();
            }}>
              🔄 Reset
            </Button>

            <div style={{ flex: 1 }} />

            {/* Export CSV removed as per user request */}

            {/* Professional PDF Download Buttons - Hide All PDF and Day/Week PDF for rice-outturn-report */}
            {activeTab !== 'rice-outturn-report' && (
              <>
                <PDFButton
                  onClick={() => {
                    const allRecords = Object.values(records).flat();
                    if (allRecords.length === 0) {
                      toast.error('No records to export');
                      return;
                    }

                    // OPTIMIZED: Descriptive date range text for reports
                    let dateRangeText = 'All Records';
                    if (dateFrom || dateTo) {
                      dateRangeText = `${dateFrom || 'Start'} to ${dateTo || 'End'}`;
                      if (selectedMonth) {
                        const monthLabel = availableMonths.find(m => m.month === selectedMonth)?.month_label || selectedMonth;
                        dateRangeText += ` (${monthLabel})`;
                      }
                    } else if (selectedMonth) {
                      dateRangeText = availableMonths.find(m => m.month === selectedMonth)?.month_label || selectedMonth;
                    } else if (!showAllRecords) {
                      dateRangeText = `Today (${getBusinessDate()})`;
                    }

                    try {
                      if (activeTab === 'arrivals') {
                        generateArrivalsPDF(allRecords, {
                          title: 'All Arrivals Report',
                          dateRange: dateRangeText,
                          filterType: 'all'
                        });
                      } else if (activeTab === 'purchase') {
                        generatePurchasePDF(allRecords, {
                          title: 'Purchase Records Report',
                          dateRange: dateRangeText,
                          filterType: 'all'
                        });
                      } else if (activeTab === 'shifting') {
                        generateShiftingPDF(allRecords, {
                          title: 'Shifting Records Report',
                          dateRange: dateRangeText,
                          filterType: 'all'
                        });
                      } else if (activeTab === 'rice-stock') {
                        generateRiceStockPDF(riceStockData, {
                          title: 'Rice Stock Report',
                          dateRange: `${dateFrom || 'Start'} to ${dateTo || 'End'}`,
                          filterType: 'all'
                        });
                      } else if (activeTab === 'stock') {
                        generatePaddyStockPDF(allRecords, {
                          title: 'Paddy Stock Report',
                          dateRange: dateRangeText,
                          filterType: 'all'
                        }, allRiceProductions, closedKunchinittus);
                      }
                      toast.success('PDF downloaded successfully!');
                    } catch (error) {
                      console.error('PDF generation error:', error);
                      toast.error('Failed to generate PDF. Please try again.');
                    }
                  }}
                  title="Download PDF of all visible records"
                >
                  📑 All PDF
                </PDFButton>

                <PDFButton
                  $variant="filtered"
                  onClick={() => {
                    const allRecords = Object.values(records).flat();
                    if (allRecords.length === 0) {
                      toast.error('No records to export');
                      return;
                    }

                    // Determine filter type based on groupBy and current selection
                    const filterType = groupBy === 'week' ? 'week' : (selectedMonth ? 'month' : 'day');
                    const dateRangeText = dateFrom && dateTo
                      ? `${dateFrom} to ${dateTo}`
                      : selectedMonth
                        ? availableMonths.find(m => m.month === selectedMonth)?.month_label || selectedMonth
                        : groupBy === 'week' ? 'Weekly View' : 'Daily View';

                    try {
                      if (activeTab === 'arrivals') {
                        generateArrivalsPDF(allRecords, {
                          title: 'All Arrivals Report',
                          subtitle: `Grouped by ${filterType}`,
                          dateRange: dateRangeText,
                          filterType: filterType as 'day' | 'week' | 'month'
                        });
                      } else if (activeTab === 'purchase') {
                        generatePurchasePDF(allRecords, {
                          title: 'Purchase Records Report',
                          subtitle: `Grouped by ${filterType}`,
                          dateRange: dateRangeText,
                          filterType: filterType as 'day' | 'week' | 'month'
                        });
                      } else if (activeTab === 'shifting') {
                        generateShiftingPDF(allRecords, {
                          title: 'Shifting Records Report',
                          subtitle: `Grouped by ${filterType}`,
                          dateRange: dateRangeText,
                          filterType: filterType as 'day' | 'week' | 'month'
                        });
                      } else if (activeTab === 'rice-stock') {
                        generateRiceStockPDF(riceStockData, {
                          title: 'Rice Stock Report',
                          subtitle: `Filtered View`,
                          dateRange: dateRangeText,
                          filterType: filterType as 'day' | 'week' | 'month'
                        });
                      } else if (activeTab === 'stock') {
                        generatePaddyStockPDF(allRecords, {
                          title: 'Paddy Stock Report',
                          subtitle: `Grouped by ${filterType}`,
                          dateRange: dateRangeText,
                          filterType: filterType as 'day' | 'week' | 'month'
                        }, allRiceProductions, closedKunchinittus);
                      }
                      toast.success(`${filterType} PDF downloaded successfully!`);
                    } catch (error) {
                      console.error('PDF generation error:', error);
                      toast.error('Failed to generate PDF. Please try again.');
                    }
                  }}
                  title={`Download PDF grouped by ${groupBy === 'week' ? 'week' : selectedMonth ? 'month' : 'day'}`}
                >
                  📅 {groupBy === 'week' ? 'Week' : selectedMonth ? 'Month' : 'Day'} PDF
                </PDFButton>

                {/* Date-wise PDF Export */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem', borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem' }}>
                  <input
                    type="date"
                    value={singleDatePdf}
                    onChange={(e) => setSingleDatePdf(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      width: '140px'
                    }}
                    title="Select a specific date for PDF export"
                  />
                  <PDFButton
                    $variant="filtered"
                    onClick={() => {
                      if (!singleDatePdf) {
                        toast.error('Please select a date for PDF export');
                        return;
                      }

                      const dateDisplay = new Date(singleDatePdf).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      });

                      try {
                        // Handle each tab type with its own data source
                        if (activeTab === 'arrivals' || activeTab === 'purchase' || activeTab === 'shifting' || activeTab === 'stock') {
                          // These tabs use 'records' object
                          const allRecords = Object.values(records).flat();
                          const dateRecords = allRecords.filter((r: any) => {
                            const recordDate = r.date?.split('T')[0];
                            return recordDate === singleDatePdf;
                          });

                          // For Paddy Stock, also check for rice production entries (like cleared outturns)
                          const dateRiceProds = allRiceProductions.filter((rp: any) => {
                            const rpDate = rp.date?.split('T')[0];
                            return rpDate === singleDatePdf;
                          });

                          // Check if we have any data for this date
                          const hasArrivalRecords = dateRecords.length > 0;
                          const hasRiceProductions = dateRiceProds.length > 0;

                          // For Paddy Stock, allow if either arrivals or rice productions exist
                          if (activeTab === 'stock') {
                            if (!hasArrivalRecords && !hasRiceProductions) {
                              toast.error(`No records found for ${dateDisplay}`);
                              return;
                            }
                          } else {
                            // For other tabs, require arrival records
                            if (!hasArrivalRecords) {
                              toast.error(`No records found for ${dateDisplay}`);
                              return;
                            }
                          }

                          if (activeTab === 'arrivals') {
                            generateArrivalsPDF(dateRecords, {
                              title: `Arrivals Report - ${dateDisplay}`,
                              dateRange: dateDisplay,
                              filterType: 'day'
                            });
                          } else if (activeTab === 'purchase') {
                            generatePurchasePDF(dateRecords, {
                              title: `Purchase Records - ${dateDisplay}`,
                              dateRange: dateDisplay,
                              filterType: 'day'
                            });
                          } else if (activeTab === 'shifting') {
                            generateShiftingPDF(dateRecords, {
                              title: `Shifting Records - ${dateDisplay}`,
                              dateRange: dateDisplay,
                              filterType: 'day'
                            });
                          } else if (activeTab === 'stock') {
                            // For Paddy Stock, pass ALL records so opening balance can be calculated
                            // The targetDate tells the PDF to only show that date's transactions
                            const allRecords = Object.values(records).flat();
                            generatePaddyStockPDF(allRecords, {
                              title: `Paddy Stock - ${dateDisplay}`,
                              dateRange: dateDisplay,
                              filterType: 'day',
                              targetDate: singleDatePdf  // Pass the specific date to filter
                            }, allRiceProductions, closedKunchinittus);
                          }
                        } else if (activeTab === 'rice-stock') {
                          // Rice stock uses 'riceStockData' which has different date format
                          console.log('🔍 Date filter: riceStockData sample:', riceStockData.slice(0, 2));

                          const dateRiceData = riceStockData.filter((r: any) => {
                            // Try multiple date formats
                            const itemDate = r.date?.split('T')[0] || r.date;
                            return itemDate === singleDatePdf;
                          });

                          console.log('🔍 Date filter: Found rice records:', dateRiceData.length, 'for date:', singleDatePdf);

                          if (dateRiceData.length === 0) {
                            toast.error(`No rice records for ${dateDisplay}. Check if data is loaded.`);
                            return;
                          }

                          generateRiceStockPDF(dateRiceData, {
                            title: `Rice Stock - ${dateDisplay}`,
                            dateRange: dateDisplay,
                            filterType: 'day'
                          });
                        }

                        toast.success(`PDF for ${dateDisplay} downloaded!`);
                        setSingleDatePdf(''); // Clear date after export
                      } catch (error) {
                        console.error('PDF generation error:', error);
                        toast.error('Failed to generate PDF. Check console for details.');
                      }
                    }}
                    disabled={!singleDatePdf}
                    title="Download PDF for selected date only"
                    style={{ opacity: singleDatePdf ? 1 : 0.5 }}
                  >
                    📆 Date PDF
                  </PDFButton>
                </div>
              </>
            )}
          </div>
        </FilterRow>
      </FilterSection>


      {/* Month-wise/Date Range Header Info */}
      {selectedMonth && !dateFrom && !dateTo && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div>
            <div style={{ color: '#1e40af', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              📅 Month-wise View: {availableMonths.find(m => m.month === selectedMonth)?.month_label}
            </div>
            <div style={{ color: '#1e3a8a', fontSize: '0.9rem' }}>
              Showing all records for this month • {Object.keys(records).length} days • {Object.values(records).flat().length} total records
            </div>
          </div>
          <Button
            className="secondary"
            onClick={() => setSelectedMonth('')}
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            aria-label="Clear month filter and return to date range view"
          >
            ✕ Clear
          </Button>
        </div>
      )}

      {/* Date Range info - only show if date filters are active */}
      {(dateFrom || dateTo) && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #10b981',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div>
            <div style={{ color: '#065f46', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              📅 Date Range View: {dateFrom || 'Start'} to {dateTo || 'End'}
            </div>
            <div style={{ color: '#064e3b', fontSize: '0.9rem' }}>
              Showing filtered records for selected dates
            </div>
          </div>
          <Button
            className="secondary"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
          >
            ✕ Reset Dates
          </Button>
        </div>
      )}

      {/* Records Display */}
      {loading ? (
        <EmptyState>
          <div className="spinner"></div>
          <p>Loading records...</p>
        </EmptyState>
      ) : activeTab === 'rice-outturn-report' ? (
        /* Rice Stock Movement View - Enhanced with Purchase/Sale */
        <div>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontWeight: 'bold' }}>🍚 Rice Stock Movement</h2>
            <PDFButton
              onClick={() => {
                if (riceStockData.length === 0) {
                  toast.error('No records to export');
                  return;
                }
                try {
                  // Build date range text for PDF header
                  let dateRangeText = 'All Records';
                  if (dateFrom && dateTo) {
                    dateRangeText = `${dateFrom} to ${dateTo}`;
                  } else if (selectedMonth) {
                    dateRangeText = availableMonths.find(m => m.month === selectedMonth)?.month_label || selectedMonth;
                  }

                  generateRiceMovementsPDF(riceStockData, {
                    title: 'Rice Stock Movement Report',
                    dateRange: dateRangeText,
                    filterType: 'all'
                  });
                  toast.success('PDF downloaded successfully!');
                } catch (error) {
                  console.error('PDF generation error:', error);
                  toast.error('Failed to generate PDF');
                }
              }}
              title="Download Rice Stock Movement PDF"
            >
              📥 Download PDF
            </PDFButton>
          </div>

          {/* Search Input */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              type="text"
              placeholder="Search by outturn number, product type, or location..."
              value={riceReportSearch}
              onChange={(e) => setRiceReportSearch(e.target.value)}
              style={{ maxWidth: '400px' }}
            />

            {/* Pagination Controls */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '8px',
              border: '1px solid #0ea5e9'
            }}>
              <button
                onClick={() => setRiceStockPage(Math.max(1, riceStockPage - 1))}
                disabled={riceStockPage <= 1}
                style={{
                  padding: '0.5rem 1rem',
                  background: riceStockPage <= 1 ? '#e5e7eb' : '#3b82f6',
                  color: riceStockPage <= 1 ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: riceStockPage <= 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ← Prev
              </button>
              <span style={{ fontWeight: 'bold', color: '#1e40af' }}>
                Page {riceStockPage} of {riceStockTotalPages}
              </span>
              <button
                onClick={() => setRiceStockPage(Math.min(riceStockTotalPages, riceStockPage + 1))}
                disabled={riceStockPage >= riceStockTotalPages}
                style={{
                  padding: '0.5rem 1rem',
                  background: riceStockPage >= riceStockTotalPages ? '#e5e7eb' : '#3b82f6',
                  color: riceStockPage >= riceStockTotalPages ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: riceStockPage >= riceStockTotalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Next →
              </button>
              <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.5rem' }}>
                ({riceStockTotalRecords.toLocaleString()} total records)
              </span>
            </div>
          </div>

          {riceStockData.length === 0 ? (
            <EmptyState>
              <p>No rice stock entries found</p>
            </EmptyState>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
              <ExcelTable style={{ minWidth: '1500px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                    <th>Sl No</th>
                    <th>Date</th>
                    <th>Mvmt Type</th>
                    <th>Bill Number</th>
                    <th>Variety</th>
                    <th>Product Type</th>
                    <th>Bags</th>
                    <th>Bag Size</th>
                    <th>QTL'S</th>
                    <th>Packaging</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Lorry Number</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Step 1: Filter the data
                    const filteredData = riceStockData.filter((item: any) => {
                      if (item.locationCode === 'CLEARING') return false;
                      if (!riceReportSearch) return true;
                      const searchLower = riceReportSearch.toLowerCase();
                      return (
                        item.outturn?.code?.toLowerCase().includes(searchLower) ||
                        item.billNumber?.toLowerCase().includes(searchLower) ||
                        item.locationCode?.toLowerCase().includes(searchLower) ||
                        item.lorryNumber?.toLowerCase().includes(searchLower) ||
                        item.partyName?.toLowerCase().includes(searchLower) ||
                        item.variety?.toLowerCase().includes(searchLower)
                      );
                    });

                    // Step 2: Group Sales by billNumber+date, keep others as-is
                    const processedData: any[] = [];

                    // Keep individual rows for hamali matching
                    filteredData.forEach((item: any) => {
                      processedData.push({ ...item, _isGrouped: false, _groupItems: [] });
                    });

                    // Sort by date descending
                    processedData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    // Build SL number lookup with rowspan info for grouped sales
                    const billGroups: { [key: string]: any[] } = {};
                    let currentSl = 0;

                    // First pass: group by bill number (for sales AND palti)
                    processedData.forEach((item: any, i: number) => {
                      if (item.movementType === 'sale' && item.billNumber) {
                        const billKey = `sale_${item.billNumber}_${item.date}`;
                        if (!billGroups[billKey]) {
                          billGroups[billKey] = [];
                        }
                        billGroups[billKey].push(i);
                      }
                    });

                    // Second pass: assign SL numbers and rowspan info
                    const slAssigned: { [key: string]: boolean } = {};
                    processedData.forEach((item: any, i: number) => {
                      if (item.movementType === 'sale' && item.billNumber) {
                        const billKey = `sale_${item.billNumber}_${item.date}`;
                        const groupIndices = billGroups[billKey];

                        if (!slAssigned[billKey]) {
                          // First row of this group - gets the SL cell with rowspan
                          currentSl++;
                          slAssigned[billKey] = true;
                          item._slNumber = currentSl;
                          item._rowspan = groupIndices.length;
                          item._isFirstOfGroup = true;
                          item._isPartOfGroup = groupIndices.length > 1;
                        } else {
                          // Subsequent rows - no SL cell (merged)
                          item._slNumber = null; // Skip SL cell
                          item._rowspan = 0;
                          item._isFirstOfGroup = false;
                          item._isPartOfGroup = true;
                        }
                      } else {
                        currentSl++;
                        item._slNumber = currentSl;
                        item._rowspan = 1;
                        item._isFirstOfGroup = true;
                        item._isPartOfGroup = false;
                      }
                    });

                    return processedData.map((item: any, idx: number) => {

                      // Determine row color based on movement type
                      let rowColor = 'white';
                      if (item.movementType === 'purchase') {
                        rowColor = '#d1fae5';
                      } else if (item.movementType === 'sale') {
                        rowColor = '#fee2e2';
                      } else if (item.movementType === 'palti') {
                        rowColor = '#fef3c7';
                      } else if (idx % 2 === 0) {
                        rowColor = '#f9fafb';
                      }

                      // Remove top border for grouped rows (not first of group)
                      const borderStyle = item._isPartOfGroup && !item._isFirstOfGroup
                        ? 'none'
                        : '1px solid #e5e7eb';

                      return (
                        <tr
                          key={item.id}
                          style={{
                            backgroundColor: rowColor,
                            borderTop: borderStyle
                          }}
                        >
                          {/* Only render SL cell for first row of group (with rowspan) */}
                          {item._isFirstOfGroup && (
                            <td rowSpan={item._rowspan} style={{
                              verticalAlign: 'middle',
                              textAlign: 'center',
                              fontWeight: 'bold',
                              borderBottom: item._isPartOfGroup ? '1px solid #e5e7eb' : 'none'
                            }}>
                              {item._slNumber}
                            </td>
                          )}
                          {/* Only render Date cell for first row of group (with rowspan) */}
                          {item._isFirstOfGroup && (
                            <td rowSpan={item._rowspan} style={{
                              verticalAlign: 'middle',
                              textAlign: 'center',
                              borderBottom: item._isPartOfGroup ? '1px solid #e5e7eb' : 'none'
                            }}>
                              {new Date(item.date).toLocaleDateString('en-GB')}
                            </td>
                          )}
                          <td style={{
                            textTransform: 'capitalize',
                            fontWeight: item.movementType !== 'production' ? 'bold' : 'normal',
                            color: item.movementType === 'purchase' ? '#059669' :
                              item.movementType === 'sale' ? '#dc2626' :
                                item.movementType === 'palti' ? '#f59e0b' : 'inherit'
                          }}>
                            {item.movementType === 'production' ? '🏭 Production' :
                              item.movementType === 'purchase' ? '📦 Purchase' :
                                item.movementType === 'sale' ? '💰 Sale' :
                                  item.movementType === 'palti' ? '🔄 Palti' :
                                    item.movementType === 'unknown' ? '❓ Unknown' : item.movementType || '❓ Unknown'}
                            {/* Show grouped item count badge for sales */}
                            {item._isGrouped && item._groupCount > 1 && (
                              <span style={{
                                marginLeft: '4px',
                                padding: '2px 6px',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold'
                              }}>
                                {item._groupCount} items
                              </span>
                            )}
                            {item.movementType === 'palti' && (Number(item.shortageKg) > 0 || Number(item.conversion_shortage_kg) > 0) && (
                              <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 'bold' }}>
                                ⚠️ Shortage: {Number(item.shortageKg || item.conversion_shortage_kg || 0).toFixed(2)}kg
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>
                            {item.movementType === 'palti' ? '-' : (item.billNumber || '-')}
                          </td>
                          <td>{item.variety || 'Sum25 RNR Raw'}</td>
                          <td>{(() => {
                            // For grouped sales, show all product types
                            if (item._isGrouped && item._groupedProductTypes) {
                              return item._groupedProductTypes;
                            }
                            // Determine product type from the item data
                            const productType = item.productType || item.product || '';
                            const productLower = productType.toLowerCase();

                            if (productLower.includes('rejection rice')) return 'Rejection Rice';
                            if (productLower.includes('unpolish')) return 'Unpolished';
                            if (productLower.includes('faram')) return 'Faram';
                            if (productLower.includes('zero broken') || productLower.includes('0 broken')) return 'Zero Broken';
                            if (productLower.includes('sizer broken')) return 'Sizer Broken';
                            if (productLower.includes('rejection broken') || productLower.includes('rj broken')) return 'RJ Broken';
                            if (productLower.includes('rj rice 1')) return 'RJ Rice 1';
                            if (productLower.includes('rj rice 2') || productLower.includes('rj rice (2)')) return 'RJ Rice 2';
                            if (productLower.includes('rj broken')) return 'RJ Broken';
                            if (productLower.includes('broken')) return 'Broken';
                            if (productLower.includes('rice')) return 'Rice';
                            if (productLower.includes('bran')) return 'Bran';

                            return productType || 'Rice'; // Default to Rice if no product type
                          })()}</td>
                          <td>{item.bags}</td>
                          <td>{item.bagSizeKg || item.packaging?.allottedKg || 26}</td>
                          <td>{isNaN(Number(item.quantityQuintals)) ? '0.00' : Number(item.quantityQuintals).toFixed(2)}</td>
                          <td>{(() => {
                            // Handle Palti packaging display: show "source → target"
                            if (item.movementType === 'palti') {
                              // FIXED: Use server-provided packaging data with proper fallbacks
                              const sourcePackaging = item.source_packaging_brand || item.sourcePackaging?.brandName || 'A1';
                              const targetPackaging = item.target_packaging_brand || item.targetPackaging?.brandName || 'A1';

                              console.log('🔍 DEBUG - Palti packaging data:', {
                                'item.source_packaging_brand': item.source_packaging_brand,
                                'item.target_packaging_brand': item.target_packaging_brand,
                                'item.sourcePackaging': item.sourcePackaging,
                                'item.targetPackaging': item.targetPackaging,
                                'FINAL_RESULT': `${sourcePackaging} → ${targetPackaging}`
                              });

                              return `${sourcePackaging} → ${targetPackaging}`;
                            }

                            // For other movement types, show regular packaging
                            const packaging = item.packaging_brand || item.packaging?.brandName || 'A1';

                            return packaging;
                          })()}</td>
                          <td>
                            {item.outturn?.code ? (
                              <span
                                style={{
                                  color: '#7c3aed',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  textDecoration: 'underline'
                                }}
                                onClick={() => navigateToOutturn(item.outturn.code)}
                                title={`Click to view outturn ${item.outturn.code}`}
                              >
                                {item.from || item.outturn.code}
                              </span>
                            ) : (
                              item.from || '-'
                            )}
                          </td>
                          <td>{item.to || item.locationCode || '-'}</td>
                          <td style={{ textTransform: 'uppercase' }}>{item.movementType === 'palti' ? (item.lorryNumber || '-') : (item.lorryNumber || item.billNumber || '-')}</td>
                          <td>
                            <div style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              backgroundColor: item.status === 'approved' ? '#dcfce7' : '#fef3c7',
                              color: item.status === 'approved' ? '#16a34a' : '#ca8a04',
                              display: 'inline-block',
                              marginBottom: '4px'
                            }}>
                              {item.status?.toUpperCase() || 'PENDING'}
                            </div>
                            {item.creator?.username && (
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                By: {item.creator.username}
                              </div>
                            )}
                          </td>
                          {/* Only render Actions cell for first row of group (with rowspan) */}
                          {item._isFirstOfGroup && (
                            <td rowSpan={item._rowspan} style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Approve Button for Pending Items */}
                                {item.status === 'pending' && user?.role !== 'staff' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        console.log('🔍 Approve clicked for item:', {
                                          id: item.id,
                                          movementType: item.movementType,
                                          status: item.status,
                                          idType: typeof item.id,
                                          isStockMovement: String(item.id).includes('movement-')
                                        });

                                        // Check if this is a stock movement (Purchase/Sale/Palti)
                                        // Stock movements have IDs like "movement-123"
                                        const isStockMovement = String(item.id).includes('movement-') ||
                                          ['purchase', 'sale', 'palti'].includes(item.movementType?.toLowerCase());

                                        if (!isStockMovement) {
                                          // Production entries
                                          await axios.post(`/rice-productions/${item.id}/approve`);
                                          toast.success('Rice production approved successfully!');
                                        } else {
                                          // Purchase, Sale, Palti use rice-stock-management
                                          const token = localStorage.getItem('token');
                                          // Extract numeric ID from movement-{id} format if needed
                                          const movementId = String(item.id).replace('movement-', '');
                                          console.log('🔄 Calling rice-stock-management approval for ID:', movementId);
                                          await axios.patch(`/rice-stock-management/movements/${movementId}/status`, {
                                            status: 'approved'
                                          }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                          });
                                          toast.success(`${item.movementType || 'Movement'} approved successfully!`);
                                        }
                                        fetchProductionRecords();
                                        fetchRiceStock();
                                      } catch (error: any) {
                                        console.error('❌ Approval error:', error.response?.data || error);
                                        toast.error(error.response?.data?.error || 'Failed to approve');
                                      }
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem'
                                    }}
                                  >
                                    Approve
                                  </button>
                                )}

                                {/* Edit Button - show if pending OR if user is admin */}
                                {(item.status === 'pending' || user?.role === 'admin' || user?.role === 'manager') && (
                                  <button
                                    onClick={() => {
                                      // Set the item for editing
                                      const movementId = String(item.id).replace('movement-', '');
                                      setEditingRiceMovement({
                                        ...item,
                                        id: movementId // Store clean ID for API call
                                      });
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    title={item.status === 'approved' ? "Admin Edit: Approved Record" : "Edit this entry"}
                                  >
                                    ✏️ Edit
                                  </button>
                                )}

                                {/* Rice Hamali Button - Show for ALL approved entries */}
                                {item.status === 'approved' && (
                                  <button
                                    onClick={() => {
                                      const riceHamaliId = item.id?.toString();
                                      console.log('🔍 Rice Hamali button clicked for:', {
                                        id: item.id,
                                        movementType: item.movementType,
                                        riceHamaliId
                                      });

                                      if (expandedRiceHamaliRecordId === riceHamaliId) {
                                        setExpandedRiceHamaliRecordId(null);
                                      } else {
                                        setExpandedRiceHamaliRecordId(riceHamaliId);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: (riceHamaliEntries[item.id] && Array.isArray(riceHamaliEntries[item.id]) && riceHamaliEntries[item.id].length > 0) ? '#059669' : '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold'
                                    }}
                                    title={(riceHamaliEntries[item.id] && Array.isArray(riceHamaliEntries[item.id]) && riceHamaliEntries[item.id].length > 0) ? "View Rice Hamali" : "Add Rice Hamali"}
                                  >
                                    {(riceHamaliEntries[item.id] && Array.isArray(riceHamaliEntries[item.id]) && riceHamaliEntries[item.id].length > 0) ? '✓' : '+'} 🍚 Hamali
                                  </button>
                                )}

                                {/* Hamali Status Indicator */}
                                {riceHamaliEntries[item.id] && riceHamaliEntries[item.id].length > 0 && (
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      backgroundColor: '#dcfce7',
                                      color: '#16a34a',
                                      borderRadius: '12px',
                                      fontSize: '0.7rem',
                                      fontWeight: 'bold'
                                    }}
                                    title={`${riceHamaliEntries[item.id].length} rice hamali entries`}
                                  >
                                    ✓ {riceHamaliEntries[item.id].length}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </ExcelTable>
            </div>
          )}

          {/* Rice Hamali Form Rendering */}
          {expandedRiceHamaliRecordId && (
            <div style={{
              marginTop: '1rem',
              border: '3px solid #10b981',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              {(() => {
                // Find the selected rice production/movement
                const selectedItem = riceStockData.find((item: any) =>
                  item.id?.toString() === expandedRiceHamaliRecordId
                );

                if (!selectedItem) {
                  console.error('🔍 Selected rice item not found for ID:', expandedRiceHamaliRecordId);
                  return (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#dc2626' }}>
                      Selected rice production not found
                    </div>
                  );
                }

                console.log('🔍 Rendering InlineRiceHamaliForm for:', {
                  id: selectedItem.id,
                  movementType: selectedItem.movementType,
                  productType: selectedItem.productType,
                  bags: selectedItem.bags
                });

                return (
                  <InlineRiceHamaliForm
                    riceProduction={{
                      id: selectedItem.id,
                      date: selectedItem.date,
                      productType: selectedItem.productType || selectedItem.product || 'Rice',
                      bags: selectedItem.bags || 0,
                      quantityQuintals: selectedItem.quantityQuintals || 0,
                      movementType: selectedItem.movementType || 'production',
                      locationCode: selectedItem.locationCode || selectedItem.to,
                      variety: selectedItem.variety,
                      outturn: selectedItem.outturn,
                      packaging: selectedItem.packaging
                    }}
                    onClose={() => setExpandedRiceHamaliRecordId(null)}
                    onSave={() => {
                      fetchRiceStock();
                      fetchHamaliEntries([], [expandedRiceHamaliRecordId!]);
                      setExpandedRiceHamaliRecordId(null);
                    }}
                  />
                );
              })()}
            </div>
          )}
        </div>
      ) : activeTab === 'rice-stock' ? (
        <Container>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            position: 'sticky',
            top: '0',
            backgroundColor: '#ffffff',
            zIndex: 100,
            padding: '0.75rem 1.25rem',
            borderBottom: '2px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            borderRadius: '0 0 12px 12px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🍚</span> Rice Stock
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px', fontWeight: '500' }}>
                {showAllRecords ? "📋 All Records" : `📅 ${(() => {
                  const businessDate = getBusinessDate();
                  return new Date(businessDate + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });
                })()}`}
                {selectedMonth && ` • 🌙 ${selectedMonth}`}
                {(dateFrom || dateTo) && ` • 🗓️ ${dateFrom || '...'} to ${dateTo || '...'}`}
                {riceStockProductType && ` • 📦 ${riceStockProductType}`}
                {riceStockLocationCode && ` • 📍 ${riceStockLocationCode}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {user?.role !== 'staff' && (
                <Button
                  className="secondary"
                  onClick={() => {
                    fetchPendingMovements();
                    setShowPendingMovements(!showPendingMovements);
                  }}
                >
                  {showPendingMovements ? 'Hide' : 'Show'} Pending ({pendingMovements.length})
                </Button>
              )}
              <Button
                className="success"
                onClick={() => setShowPurchaseModal(true)}
                style={{
                  fontWeight: 'bold',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem'
                }}
              >
                📦 Purchase
              </Button>
              <Button
                className="danger"
                onClick={() => setShowSaleModal(true)}
                style={{
                  fontWeight: 'bold',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem'
                }}
              >
                💰 Sale
              </Button>
              <Button
                className="primary"
                onClick={() => setShowPaltiModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  fontWeight: 'bold',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem'
                }}
              >
                🔄 Palti
              </Button>
            </div>
          </div>

          {/* Pending Movements Section */}
          {showPendingMovements && pendingMovements.length > 0 && (
            <div style={{
              background: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              {/* Header with bulk actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <h3 style={{ margin: 0, color: '#92400e' }}>
                  ⏳ Pending Approvals ({pendingMovements.length})
                </h3>

                {/* Bulk action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {selectedMovementIds.size > 0 && (
                    <span style={{
                      color: '#92400e',
                      fontSize: '0.85rem',
                      fontWeight: 'bold'
                    }}>
                      {selectedMovementIds.size} selected
                    </span>
                  )}
                  <button
                    onClick={handleBulkApprove}
                    disabled={selectedMovementIds.size === 0 || isBulkProcessing}
                    style={{
                      padding: '0.5rem 1rem',
                      background: selectedMovementIds.size > 0 ? '#10b981' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedMovementIds.size > 0 ? 'pointer' : 'not-allowed',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    {isBulkProcessing ? '⏳' : '✓'} Approve All ({selectedMovementIds.size})
                  </button>
                  <button
                    onClick={handleBulkReject}
                    disabled={selectedMovementIds.size === 0 || isBulkProcessing}
                    style={{
                      padding: '0.5rem 1rem',
                      background: selectedMovementIds.size > 0 ? '#ef4444' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedMovementIds.size > 0 ? 'pointer' : 'not-allowed',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    {isBulkProcessing ? '⏳' : '✗'} Reject All ({selectedMovementIds.size})
                  </button>
                </div>
              </div>

              {/* Select All checkbox */}
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.5rem',
                background: '#fde68a',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <input
                  type="checkbox"
                  id="selectAllMovements"
                  checked={selectedMovementIds.size === pendingMovements.length && pendingMovements.length > 0}
                  onChange={toggleSelectAllMovements}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <label
                  htmlFor="selectAllMovements"
                  style={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#92400e'
                  }}
                >
                  Select All ({pendingMovements.length} movements)
                </label>
              </div>

              {/* Movement rows with checkboxes */}
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {pendingMovements.map((movement: any) => (
                  <div key={movement.id} style={{
                    background: selectedMovementIds.has(movement.id) ? '#ecfccb' : 'white',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: selectedMovementIds.has(movement.id) ? '2px solid #84cc16' : '1px solid #e5e7eb',
                    transition: 'all 0.15s ease'
                  }}>
                    {/* Checkbox + Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedMovementIds.has(movement.id)}
                        onChange={() => toggleMovementSelection(movement.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <div>
                        <strong>{movement.movement_type.toUpperCase()}</strong> - {movement.bags} bags × {movement.packaging_brand}
                        {movement.movement_type === 'palti' && Number(movement.conversion_shortage_kg) > 0 && (
                          <span style={{ color: '#d97706', fontWeight: 'bold' }}>
                            {' '}(Shortage: {Number(movement.conversion_shortage_kg).toFixed(2)}kg)
                          </span>
                        )}
                        <br />
                        <small style={{ color: '#6b7280' }}>
                          {new Date(movement.date).toLocaleDateString('en-GB')} • {movement.created_by_username} • {movement.location_code}
                        </small>
                      </div>
                    </div>

                    {/* Individual approve/reject buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleApproveMovement(movement.id, 'approved')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Rejection reason (optional):');
                          handleApproveMovement(movement.id, 'rejected', reason || undefined);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <EmptyState>
              <p>Loading rice stock data...</p>
            </EmptyState>
          ) : riceStockData.length === 0 ? (
            <EmptyState>
              <p>No rice stock entries found</p>
            </EmptyState>
          ) : (() => {
            // Debug: Log the raw data to understand its structure
            console.log('🔍 DEBUG - Raw riceStockData:', riceStockData);

            // Process the raw data to create daily summaries with proper stock calculation
            // Robust string normalization helper (matches backend)
            const normalize = (str: any) => {
              if (!str) return '';
              return String(str)
                .toLowerCase()
                .trim()
                .replace(/[_\s-]+/g, ' '); // Standardize spaces, underscores, and hyphens
            };

            const processRiceStockData = (rawData: any[]) => {

              console.log('🔍 DEBUG - processRiceStockData received:', rawData.length, 'items');
              const paltiItems = rawData.filter(item => item.movementType === 'palti' || item.productType === 'Palti');
              console.log('🔍 DEBUG - Sample palti item structure:', paltiItems[0]);
              const dailyData: { [date: string]: any } = {};

              // Initialize stock tracking for different product types (removed separate Palti category)
              const productTypes = ['Rice', 'Bran', 'RJ Rice (2)', 'RJ Broken', 'Sizer Broken', 'RJ Rice 1', 'Broken', '0 Broken', 'Faram', 'Unpolish', 'Other'];

              // Sort data by date first (oldest first for proper stock calculation)
              const sortedData = rawData
                .filter(item => {
                  // Only include approved entries in stock calculation
                  // Also include entries created by admin as they are auto-approved for stock
                  const isApproved = (item.status || item.approvalStatus) === 'approved';
                  const isAdminEntry = item.createdByAdmin || item.adminApprovedBy;
                  return isApproved || isAdminEntry;
                })
                .sort((a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
                );

              // Group movements by date first
              sortedData.forEach((item: any) => {
                const date = item.date;
                if (!dailyData[date]) {
                  dailyData[date] = {
                    date,
                    openingStock: [],
                    productions: [],
                    openingStockTotal: 0,
                    closingStockTotal: 0
                  };
                }

                const productType = item.productType || item.product || 'Rice';
                const qtls = Number(item.quantityQuintals || item.qtls || 0);
                const bags = Number(item.bags || 0);

                // DEBUG: Log Palti movements to trace productType
                if ((item.movementType || item.movement_type) === 'palti') {
                  console.log('🔍 DEBUG - Palti Processing:', {
                    id: item.id,
                    'item.productType': item.productType,
                    'item.product': item.product,
                    'resolved productType': productType,
                    movementType: item.movementType
                  });
                }

                // Determine product category
                let category = 'Other';

                // PRIORITY 1: Exact matches for all known product types (case-sensitive)
                // This ensures 101% accuracy - no ambiguity from includes() checks
                const exactProductTypes: { [key: string]: string } = {
                  'Rice': 'Rice',
                  'Bran': 'Bran',
                  'Broken': 'Broken',
                  'Faram': 'Faram',
                  'Unpolish': 'Unpolish',
                  '0 Broken': '0 Broken',
                  'Zero Broken': '0 Broken',
                  'Sizer Broken': 'Sizer Broken',
                  'RJ Broken': 'RJ Broken',
                  'Rejection Broken': 'RJ Broken',
                  'RJ Rice 1': 'RJ Rice 1',
                  'RJ Rice (2)': 'RJ Rice (2)',
                  'RJ Rice 2': 'RJ Rice (2)',
                };

                // Check for exact match first
                if (exactProductTypes[productType]) {
                  category = exactProductTypes[productType];
                } else {
                  // PRIORITY 2: Case-insensitive exact match
                  const productLower = productType.toLowerCase();
                  const exactMatchLower = Object.entries(exactProductTypes).find(
                    ([key]) => key.toLowerCase() === productLower
                  );
                  if (exactMatchLower) {
                    category = exactMatchLower[1];
                  } else {
                    // PRIORITY 3: Includes-based fallback (for legacy/unexpected data)
                    if (productLower.includes('faram')) {
                      category = 'Faram';
                    } else if (productLower.includes('unpolish')) {
                      category = 'Unpolish';
                    } else if (productLower.includes('zero broken') || productLower.includes('0 broken')) {
                      category = '0 Broken';
                    } else if (productLower.includes('sizer broken')) {
                      category = 'Sizer Broken';
                    } else if (productLower.includes('rejection broken') || productLower.includes('rj broken')) {
                      category = 'RJ Broken';
                    } else if (productLower.includes('rj rice 1')) {
                      category = 'RJ Rice 1';
                    } else if (productLower.includes('rj rice 2') || productLower.includes('rj rice (2)')) {
                      category = 'RJ Rice (2)';
                    } else if (productLower.includes('broken')) {
                      category = 'Broken';
                    } else if (productLower.includes('rice') || productLower.includes('rj rice')) {
                      category = 'Rice';
                    } else if (productLower.includes('bran')) {
                      category = 'Bran';
                    }
                  }
                }

                // DEBUG: Log category assignment for Palti
                if ((item.movementType || item.movement_type) === 'palti') {
                  console.log('🔍 DEBUG - Palti Category Assignment:', {
                    productType,
                    assignedCategory: category
                  });
                }

                // Add movement to daily data
                dailyData[date].productions.push({
                  id: item.id,
                  qtls: Math.abs(Number(qtls)), // Always show positive values for display
                  bags: Math.abs(Number(bags)),
                  bagSizeKg: Number(item.bagSizeKg || item.bag_size_kg || 26),
                  product: productType,
                  variety: item.variety || item.outturn?.allottedVariety || 'Sum25 RNR Raw',
                  packaging: (() => {
                    // Handle Palti movements with source → target format
                    if ((item.movementType || item.movement_type) === 'palti') {
                      const sourcePackaging = item.sourcePackaging?.brandName || item.source_packaging_brand || 'A1';
                      const targetPackaging = item.targetPackaging?.brandName || item.target_packaging_brand || 'A1';

                      // Debug logging for Palti packaging
                      console.log('🔍 DEBUG - Palti packaging extraction:', {
                        id: item.id,
                        sourcePackaging,
                        targetPackaging,
                        'item.sourcePackaging': item.sourcePackaging,
                        'item.targetPackaging': item.targetPackaging,
                        'item.source_packaging_brand': item.source_packaging_brand,
                        'item.target_packaging_brand': item.target_packaging_brand,
                        'FINAL_RESULT': `${sourcePackaging} → ${targetPackaging}`
                      });

                      return `${sourcePackaging} → ${targetPackaging}`;
                    }

                    // Handle regular movements
                    if (typeof item.packaging === 'object' && item.packaging !== null) {
                      return item.packaging.brandName || item.packaging.code || '';
                    }
                    return item.packaging || item.packaging_brand || '';
                  })(),
                  location: (() => {
                    // First try to get explicit location
                    const explicitLocation = item.locationCode || item.location_code || item.location;
                    if (explicitLocation) return explicitLocation;

                    // For production entries without location, assign default based on product type
                    const mvtType = (item.movementType || item.movement_type || 'production').toLowerCase();
                    if (mvtType === 'production' || mvtType === 'kunchinittu') {
                      const prodType = (productType || '').toLowerCase();
                      if (prodType.includes('bran')) return 'Bran Room';
                      if (prodType.includes('broken') || prodType === '0 broken') return 'B1';
                      if (prodType.includes('unpolish')) return 'U1';
                      if (prodType.includes('faram')) return 'F1';
                      if (prodType.includes('rj rice 1')) return 'N3';
                      if (prodType.includes('rj rice 2') || prodType.includes('rj rice (2)')) return 'N4';
                      return 'A1'; // Default for rice and other products
                    }
                    return 'A1'; // Default for purchase/sale/palti
                  })(),
                  fromLocation: item.fromLocation || item.from_location || item.fromlocation || item.from || (item.movementType === 'palti' ? item.locationCode || item.location_code : ''),
                  toLocation: item.toLocation || item.to_location || item.tolocation || item.to || '',
                  billNumber: item.billNumber || item.bill_number || item.billnumber || '',
                  lorryNumber: item.lorryNumber || item.lorry_number || item.lorrynumber || '',
                  outturn: item.outturn || '',
                  outturnId: item.outturnId || item.outturn_id,
                  movementType: item.movementType || item.movement_type || 'production',
                  category: category,
                  actualQtls: qtls, // Keep original value for stock calculation
                  isPositive: qtls >= 0, // Track if this adds or subtracts stock
                  // Add Raw/Steam indicator for production
                  processType: (item.movementType || item.movement_type || 'production').toLowerCase() === 'production' ? 'Raw' : null,
                  // Add palti-specific fields
                  shortageKg: item.shortageKg || item.conversionShortageKg || item.conversion_shortage_kg || 0,
                  shortageBags: item.shortageBags || item.conversionShortageBags || item.conversion_shortage_bags || 0,
                  sourcePackaging: item.source_packaging_brand ? {
                    brandName: item.source_packaging_brand,
                    allottedKg: item.source_packaging_kg || 26
                  } : null,
                  targetPackaging: item.target_packaging_brand ? {
                    brandName: item.target_packaging_brand,
                    allottedKg: item.target_packaging_kg || 26
                  } : null
                });
              });

              // Calculate running stock with proper continuation by variety + location + product + packaging
              const runningStockDetailed: { [key: string]: number } = {};
              const runningStockByType: { [productType: string]: number } = {};

              // Initialize running stock by product type
              productTypes.forEach(type => {
                runningStockByType[type] = 0;
              });


              // FIXED: Stock key NOW INCLUDES variety for correct variety-wise bifurcation
              // Key: variety(normalized)|process|location|product|packaging|bagSize
              const createStockKey = (variety: string, location: string, product: string, packaging: string, bagSize: number) => {
                // Robust variety cleaning
                let varClean = normalize(variety || 'Common');

                // Normalize Process (Raw vs Steam)
                let process = 'Raw';
                if (varClean.includes('steam')) {
                  process = 'Steam';
                  varClean = varClean.replace('steam', '').trim();
                } else if (varClean.includes('raw')) {
                  process = 'Raw';
                  varClean = varClean.replace('raw', '').trim();
                }

                varClean = varClean.replace(/\s+/g, ' ').trim();

                // Normalize other parts
                const normLoc = normalize(location);
                const normProd = normalize(product);
                const normPkg = normalize(packaging);

                return `${varClean}|${process}|${normLoc}|${normProd}|${normPkg}|${bagSize}`;
              };

              // Process each day in chronological order
              const sortedDates = Object.keys(dailyData).sort((a, b) =>
                new Date(a).getTime() - new Date(b).getTime()
              );

              sortedDates.forEach((date, dateIndex) => {
                const dayData = dailyData[date];

                // Set opening stock for this day (yesterday's closing becomes today's opening)
                const openingStockByType: { [type: string]: number } = {};
                productTypes.forEach(type => {
                  openingStockByType[type] = runningStockByType[type];
                });

                // FIXED: Capture detailed opening stock BEFORE today's movements
                // This is used for variety-wise opening stock display (yesterday's closing = today's opening)
                const openingStockDetailed: { [key: string]: number } = {};
                Object.entries(runningStockDetailed).forEach(([key, qtls]) => {
                  openingStockDetailed[key] = qtls;
                });

                // Calculate movements for this day by detailed tracking
                const movementsByType: { [type: string]: number } = {};
                productTypes.forEach(type => {
                  movementsByType[type] = 0;
                });

                dayData.productions.forEach((prod: any) => {
                  const category = prod.category;
                  const movementType = (prod.movementType || '').toLowerCase();
                  const variety = prod.variety || 'Sum25 RNR Raw';

                  // Determine base location with defaults for production
                  let baseLocation = prod.location || prod.locationCode;
                  if (!baseLocation) {
                    if (prod.isRiceProduction || movementType === 'production') {
                      switch (category) {
                        case 'Bran': baseLocation = 'Bran Room'; break;
                        case 'Broken':
                        case '0 Broken':
                        case 'RJ Broken': baseLocation = 'B1'; break;
                        case 'unpolish':
                        case 'Unpolish': baseLocation = 'U1'; break;
                        case 'Faram': baseLocation = 'F1'; break;
                        case 'Rj Rice 1': baseLocation = 'N3'; break;
                        case 'Rj Rice 2': baseLocation = 'N4'; break;
                        default: baseLocation = 'U1';
                      }
                    } else {
                      baseLocation = 'A1'; // Default location for all other movement types
                    }
                  }

                  const packaging = prod.packaging || 'A1';

                  // Handle Palti as a movement between source (location/pkg) and target (location/pkg)
                  if (movementType === 'palti') {
                    const sourceLoc = prod.fromLocation || baseLocation;
                    const targetLoc = prod.toLocation || baseLocation;
                    const sourcePkg = prod.sourcePackaging?.brandName || prod.sourcePackagingBrand || prod.source_packaging_brand || prod.source_packaging || 'Unknown';

                    // FIXED: Use correct backend field names (camelCase) for target packaging
                    let targetPkgName = 'A1';
                    if (prod.targetPackaging?.brandName) {
                      targetPkgName = prod.targetPackaging.brandName;
                    } else if (prod.targetPackagingBrand) {
                      targetPkgName = prod.targetPackagingBrand;
                    } else if (prod.target_packaging_brand) {
                      targetPkgName = prod.target_packaging_brand;
                    } else if (typeof packaging === 'string') {
                      if (packaging.includes('→')) {
                        targetPkgName = packaging.split('→').pop()?.trim() || packaging;
                      } else {
                        targetPkgName = packaging;
                      }
                    } else if (packaging && typeof packaging === 'object') {
                      targetPkgName = packaging.brandName || 'A1';
                    }

                    // Calculate weights
                    const sourceKgPerBag = prod.sourcePackaging?.allottedKg || prod.sourcePackagingKg || 26;
                    const targetKgPerBag = prod.targetPackaging?.allottedKg || prod.targetPackagingKg || prod.bagSizeKg || 26;
                    const targetBags = prod.bags || 0;
                    const targetQtls = prod.actualQtls || prod.quantityQuintals || (targetBags * targetKgPerBag) / 100;
                    const shortageKg = prod.shortageKg || prod.conversionShortageKg || prod.conversion_shortage_kg || 0;
                    const shortageQtls = shortageKg / 100;
                    const sourceQtls = targetQtls + shortageQtls;

                    let sourceCategory = category;
                    const preferredSourceKey = createStockKey(variety, sourceLoc, category, sourcePkg, sourceKgPerBag);

                    const getDefaultProductForLocation = (loc: string): string => {
                      if (['A1', 'A2', 'M1', 'M2', 'M3', 'G1'].includes(loc)) return 'Rice';
                      if (loc === 'Bran Room') return 'Bran';
                      if (['B1', 'B2'].includes(loc)) return 'Broken';
                      if (['F1'].includes(loc)) return 'Faram';
                      if (['N3'].includes(loc)) return 'RJ Rice 1';
                      if (['N4'].includes(loc)) return 'RJ Rice (2)';
                      return 'Rice';
                    };

                    const defaultSourceCategory = getDefaultProductForLocation(sourceLoc);
                    const fallbackSourceKey = createStockKey(variety, sourceLoc, defaultSourceCategory, sourcePkg, sourceKgPerBag);

                    const hasPreferredStock = (runningStockDetailed[preferredSourceKey] || 0) > 0.01;
                    const hasFallbackStock = (runningStockDetailed[fallbackSourceKey] || 0) > 0.01;

                    if (!hasPreferredStock && hasFallbackStock && category !== defaultSourceCategory) {
                      sourceCategory = defaultSourceCategory;
                    }

                    // 1. Subtract from source (with fuzzy matching fallback)
                    let sourceKey = createStockKey(variety, sourceLoc, sourceCategory, sourcePkg, sourceKgPerBag);

                    // Fallback matching if exact key (with packaging) has no stock
                    if ((runningStockDetailed[sourceKey] || 0) < sourceQtls - 0.001) {
                      const allKeys = Object.keys(runningStockDetailed);
                      const varPart = normalize(variety).replace(/steam|raw/g, '').trim();
                      const locPart = normalize(sourceLoc);
                      const prodPart = normalize(sourceCategory);

                      const fuzzyKey = allKeys.find(k => {
                        const [kVar, kProc, kLoc, kProd] = k.split('|');
                        return kVar === varPart && kLoc === locPart && kProd === prodPart && runningStockDetailed[k] > 0.01;
                      });

                      if (fuzzyKey) {
                        sourceKey = fuzzyKey;
                      }
                    }

                    if (!runningStockDetailed[sourceKey]) runningStockDetailed[sourceKey] = 0;
                    runningStockDetailed[sourceKey] -= sourceQtls;

                    // Cleanup epsilon stock to prevent ghost entries
                    if (Math.abs(runningStockDetailed[sourceKey]) < 0.001) {
                      delete runningStockDetailed[sourceKey];
                    }

                    // 2. Add to target
                    const targetKey = createStockKey(variety, targetLoc, category, targetPkgName, targetKgPerBag);
                    if (!runningStockDetailed[targetKey]) runningStockDetailed[targetKey] = 0;
                    runningStockDetailed[targetKey] += targetQtls;

                    // Update category totals separately for Source and Target
                    // ONLY if NOT direct load (normalized check)
                    if (normalize(sourceLoc) !== 'direct load') {
                      if (movementsByType[sourceCategory] === undefined) movementsByType[sourceCategory] = 0;
                      movementsByType[sourceCategory] -= sourceQtls;
                    }
                    if (normalize(targetLoc) !== 'direct load') {
                      if (movementsByType[category] === undefined) movementsByType[category] = 0;
                      movementsByType[category] += targetQtls;
                    }

                    return;
                  }

                  // Regular movement
                  const location = baseLocation;
                  const bagSize = prod.bagSizeKg || 26;
                  const pkgName = typeof packaging === 'string' ? packaging : (packaging?.brandName || 'A1');
                  const stockKey = createStockKey(variety, location, category, pkgName, bagSize);

                  if (!runningStockDetailed[stockKey]) {
                    runningStockDetailed[stockKey] = 0;
                  }

                  let qtlsChange = prod.actualQtls;
                  if (movementType === 'sale') {
                    qtlsChange = -Math.abs(qtlsChange);
                  } else {
                    qtlsChange = Math.abs(qtlsChange);
                  }

                  runningStockDetailed[stockKey] += qtlsChange;

                  // Cleanup epsilon for regular movements too
                  if (Math.abs(runningStockDetailed[stockKey]) < 0.001) {
                    delete runningStockDetailed[stockKey];
                  }

                  // Only add to runningStockByType if NOT DIRECT_LOAD
                  if (normalize(location) !== 'direct load') {
                    movementsByType[category] += qtlsChange;
                  }
                });

                // Update running stock by type and calculate closing stock
                const closingStockByType: { [type: string]: number } = {};
                productTypes.forEach(type => {
                  runningStockByType[type] += movementsByType[type];
                  closingStockByType[type] = runningStockByType[type];
                });

                // Add yesterday's bifurcation and opening stock entries for display
                dayData.openingStock = [];
                dayData.yesterdayBifurcation = [];
                dayData.conversions = []; // Dedicated for Palti/Shortage

                // Get yesterday's data for bifurcation + same-day admin entries
                const yesterdayDate = new Date(date);
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                const yesterdayDateStr = yesterdayDate.toISOString().split('T')[0];
                const yesterdayData = dailyData[yesterdayDateStr];
                const todayData = dailyData[date];

                // Show yesterday's data + same-day admin-approved entries in bifurcation
                const bifurcationSources: any[] = [];

                // Add yesterday's data - only approved movements (already filtered in sortedData)
                if (yesterdayData && yesterdayData.productions) {
                  yesterdayData.productions.forEach((movement: any) => {
                    if (movement.movementType === 'palti') {
                      // 1. Add the Target side (Addition)
                      bifurcationSources.push({
                        ...movement,
                        _isPaltiTarget: true
                      });

                      // 2. Add the Source side (Subtraction)
                      bifurcationSources.push({
                        ...movement,
                        _isPaltiSource: true,
                        packaging: movement.sourcePackaging?.brandName || movement.source_packaging_brand || 'A1',
                        bags: -(movement.bags || 0),
                        qtls: -(movement.sourceQtls || (movement.bags * (movement.sourcePackaging?.allottedKg || 26) / 100))
                      });
                    } else {
                      bifurcationSources.push(movement);
                    }
                  });
                }

                // FIXED: Same-day transactions should NOT appear in bifurcation (opening stock)
                // They will appear in the transactions section for today and move to opening stock NEXT day
                // This matches the Paddy Stock behavior with Kunchinittu-wise data
                // (Removed the same-day admin entries logic that was incorrectly adding today's data to bifurcation)

                // ALWAYS build bifurcation groups, even if no movements, to show current stock state
                const bifurcationGroups: { [key: string]: any } = {};

                // FIXED: Use openingStockDetailed (BEFORE today's movements) for opening stock display
                // This ensures variety-wise opening stock shows yesterday's closing, not including today's transactions
                Object.entries(openingStockDetailed).forEach(([key, qtls]) => {
                  if (qtls > 0.001 && !key.includes('|direct load|')) { // Use normalized key check
                    // FIXED: Key is now variety|process|location|product|packaging|bagSize (6 parts)
                    // We must destructure correctly to support variety-wise bifurcation display
                    const [stockVariety, stockProcess, location, product, packaging, bagSize] = key.split('|');

                    // Variety is now derived from the key (with optional Process appended if relevant)
                    // e.g. "Sum25 RNR" + "Raw" -> "Sum25 RNR Raw" for display clarity
                    let displayVariety = stockVariety || product || 'Rice';
                    if (stockProcess && stockProcess !== 'Raw' && !displayVariety.toLowerCase().includes(stockProcess.toLowerCase())) {
                      displayVariety += ` ${stockProcess}`;
                    }

                    // FIXED: Clean up packaging to remove arrow notation (e.g., "white packet → mi orange" -> "mi orange")
                    let cleanPackaging = packaging;
                    if (packaging && packaging.includes('→')) {
                      // Extract target packaging (after the arrow)
                      cleanPackaging = packaging.split('→').pop()?.trim() || packaging;
                    }

                    // CRITICAL FIX: Map normalized product back to proper case for filtering
                    // The stock key has lowercase product (e.g., 'rice'), but productTypes uses proper case ('Rice')
                    const normalizedProduct = product.toLowerCase().trim();
                    let properCaseCategory = 'Other';

                    // Map normalized names to proper case - exact matching first
                    const productMappings: { [key: string]: string } = {
                      'rice': 'Rice',
                      'bran': 'Bran',
                      'broken': 'Broken',
                      '0 broken': '0 Broken',
                      'zero broken': '0 Broken',
                      'faram': 'Faram',
                      'unpolish': 'Unpolish',
                      'sizer broken': 'Sizer Broken',
                      'rj broken': 'RJ Broken',
                      'rejection broken': 'RJ Broken', // FIXED: Consistently map to RJ Broken
                      'rj rice 1': 'RJ Rice 1',
                      'rj rice (2)': 'RJ Rice (2)',
                      'rj rice 2': 'RJ Rice (2)',
                    };

                    if (productMappings[normalizedProduct]) {
                      properCaseCategory = productMappings[normalizedProduct];
                    } else {
                      // Fallback: includes-based matching
                      if (normalizedProduct.includes('faram')) properCaseCategory = 'Faram';
                      else if (normalizedProduct.includes('unpolish')) properCaseCategory = 'Unpolish';
                      else if (normalizedProduct.includes('0 broken') || normalizedProduct.includes('zero broken')) properCaseCategory = '0 Broken';
                      else if (normalizedProduct.includes('sizer broken')) properCaseCategory = 'Sizer Broken';
                      else if (normalizedProduct.includes('rj broken') || normalizedProduct.includes('rejection broken')) properCaseCategory = 'RJ Broken';
                      else if (normalizedProduct.includes('rj rice 1')) properCaseCategory = 'RJ Rice 1';
                      else if (normalizedProduct.includes('rj rice 2') || normalizedProduct.includes('rj rice (2)')) properCaseCategory = 'RJ Rice (2)';
                      else if (normalizedProduct.includes('broken')) properCaseCategory = 'Broken';
                      else if (normalizedProduct.includes('rice')) properCaseCategory = 'Rice';
                      else if (normalizedProduct.includes('bran')) properCaseCategory = 'Bran';
                    }

                    // Group by variety + location + product + packaging + bagsize
                    const bifurcationKey = `${displayVariety}-${location}-${properCaseCategory}-${cleanPackaging}-${bagSize}`;
                    bifurcationGroups[bifurcationKey] = {
                      product: properCaseCategory,
                      variety: displayVariety, // Use the actual variety from key
                      packaging: cleanPackaging,
                      category: properCaseCategory, // FIXED: Use proper case category for filtering
                      location,
                      qtls,
                      bags: Math.round(qtls * 100 / (Number(bagSize) || 26)),
                      bagSizeKg: Number(bagSize) || 26,
                      movementTypes: [],
                      count: 0,
                      isPalti: false,
                      shortageKg: 0,
                      shortageBags: 0
                    };
                  }
                });

                // FIXED: Removed the bifurcationSources overlay logic
                // With openingStockDetailed, we already have the correct opening stock values
                // No need to process yesterday's movements again - they're already reflected in the stock totals

                // Also check for pending palti movements from yesterday + same-day to show as shortage
                const pendingPalti = rawData.filter((movement: any) => {
                  const movementDate = new Date(movement.date).toISOString().split('T')[0];
                  return (movementDate === yesterdayDateStr || movementDate === date) &&
                    movement.movementType === 'palti' &&
                    movement.status === 'pending';
                });

                // Add pending palti shortages as separate bifurcation entries
                pendingPalti.forEach((palti: any) => {
                  const shortageKey = `shortage-${palti.variety || 'Unknown'}-${palti.productType}-${palti.locationCode}-palti-shortage`;
                  bifurcationGroups[shortageKey] = {
                    product: 'Shortage from Palti',
                    variety: palti.variety,
                    packaging: `${palti.sourcePackaging?.brandName || 'A1'} → ${palti.targetPackaging?.brandName || 'A1'}`,
                    category: palti.productType === 'Rice' ? 'Rice' : palti.productType,
                    location: palti.locationCode,
                    qtls: (palti.shortageKg || 0) / 100, // Convert kg to quintals
                    bags: 0, // Shortage doesn't have bags
                    bagSizeKg: 0,
                    outturn: null,
                    movementType: 'palti-shortage',
                    processType: null,
                    shortageKg: palti.shortageKg || 0,
                    shortageBags: palti.shortageBags || 0,
                    sourcePackaging: palti.sourcePackaging?.brandName,
                    targetPackaging: palti.targetPackaging?.brandName
                  };
                });

                // Convert bifurcation groups to array and separate Palti/Conversions
                const allGroups = Object.values(bifurcationGroups).map((group: any) => {
                  // FIXED: Simplified product display - just show the product/category
                  // Movement type should not affect the display for cleaner variety-wise grouping
                  let productDisplay = group.product || group.category;

                  // Only special case: Palti entries get an icon
                  if (group.isPalti) {
                    productDisplay = `🔄 ${group.product || 'Palti'}`;
                  }
                  return {
                    ...group,
                    product: productDisplay
                  };
                }).filter((group: any) => {
                  // FIXED: Cap at 0 minimum - don't show negative stock
                  if (group.qtls < 0) group.qtls = 0;
                  if (group.bags < 0) group.bags = 0;
                  return group.bags > 0 || group.qtls > 0.01;
                });

                // Separate into regular bifurcation and conversions (Palti)
                dayData.yesterdayBifurcation = allGroups.filter(g => !g.isPalti && g.movementType !== 'palti-shortage');

                // FIXED: Include APPROVED palti movements in conversions for inline palti splits
                // Today's palti entries are already in productionGroups, but we also want them
                // in conversions for the hierarchical splits display under opening stock
                const approvedPaltiMovements = rawData.filter((movement: any) => {
                  const movementDate = new Date(movement.date).toISOString().split('T')[0];
                  const isApproved = (movement.status || movement.approvalStatus) === 'approved' || movement.adminApprovedBy;
                  // FIXED: Use TODAY'S date to show today's conversions as splits under opening stock
                  return movementDate === date &&
                    movement.movementType === 'palti' &&
                    isApproved;
                }).map((palti: any) => ({
                  ...palti,
                  category: palti.productType || palti.product || 'Rice',
                  isPalti: true,
                  variety: palti.variety || 'Unknown',
                  qtls: Math.abs(palti.quantityQuintals || palti.qtls || 0),
                  bags: Number(palti.bags) || 0,
                  bagSizeKg: palti.bagSizeKg || palti.targetPackaging?.allottedKg || 26,
                  sourcePackaging: palti.sourcePackaging,
                  targetPackaging: palti.targetPackaging,
                  source_packaging_brand: palti.source_packaging_brand || palti.sourcePackaging?.brandName,
                  target_packaging_brand: palti.target_packaging_brand || palti.targetPackaging?.brandName,
                  fromLocation: palti.fromLocation || palti.locationCode,
                  toLocation: palti.toLocation || palti.location,
                  shortageKg: palti.shortageKg || palti.conversionShortageKg || palti.conversion_shortage_kg || 0
                }));

                // Combine pending palti (from allGroups) with TODAY's approved palti movements
                dayData.conversions = [
                  ...allGroups.filter(g => g.isPalti || g.movementType === 'palti-shortage'),
                  ...approvedPaltiMovements
                ];

                console.log('🔍 DEBUG - Bifurcation for', date, ':', {
                  yesterdayDate: yesterdayDateStr,
                  bifurcationGroups: Object.keys(bifurcationGroups).length,
                  sampleGroup: Object.values(bifurcationGroups)[0]
                });

                // Add detailed stock information to day data for debugging

                // Add opening stock entries for display (simplified totals)
                productTypes.forEach(type => {
                  const qtls = Number(openingStockByType[type] || 0);
                  if (qtls > 0.01) {
                    // Calculate exact bags from openingStockDetailed for this type
                    let totalBags = 0;
                    Object.entries(openingStockDetailed).forEach(([key, keyQtls]) => {
                      const [v, p, l, prodName, pkg, bagSize] = key.split('|');
                      if (normalize(prodName) === normalize(type)) {
                        const bSize = Number(bagSize) || 26;
                        totalBags += Math.round((keyQtls * 100) / bSize);
                      }
                    });

                    dayData.openingStock.push({
                      product: type,
                      qtls: qtls,
                      bags: totalBags,
                      bagSizeKg: totalBags > 0 ? Math.round((qtls * 100) / totalBags) : 26,
                      packaging: '',
                      location: 'Stock',
                      category: type
                    });
                  }
                });

                dayData.openingStockTotal = Object.values(openingStockByType).reduce((sum: number, val: number) => sum + Number(val || 0), 0);
                dayData.closingStockTotal = Object.values(closingStockByType).reduce((sum: number, val: number) => sum + Number(val || 0), 0);

                // IMPORTANT: "DIRECT_LOAD" location should not carry forward to the next day.
                // Reset DIRECT_LOAD stock in running trackers so it doesn't appear in tomorrow's opening.
                // WE DO NOT subtract from runningStockByType here because DIRECT_LOAD movements 
                // were already excluded from the initial movement totals (at lines 4480 and 4513).
                Object.entries(runningStockDetailed).forEach(([key, qtls]) => {
                  if (key.includes('|direct load|')) {
                    delete runningStockDetailed[key]; // Properly delete detailed record
                  }
                });
              });

              // Log final stock balances for debugging
              console.log('🔍 DEBUG - Final detailed stock balances:', runningStockDetailed);
              console.log('🔍 DEBUG - Final stock by type:', runningStockByType);

              // Validate stock calculations
              sortedDates.forEach(date => {
                const dayData = dailyData[date];
                const totalOpening = dayData.openingStockTotal || 0;
                const totalClosing = dayData.closingStockTotal || 0;
                
                // Validate opening/closing stock consistency
                if (totalOpening < 0) {
                  console.error(`🔍 ERROR - Negative opening stock on ${date}: ${totalOpening}`);
                  dayData.openingStockTotal = 0;
                }
                if (totalClosing < 0) {
                  console.error(`🔍 ERROR - Negative closing stock on ${date}: ${totalClosing}`);
                  dayData.closingStockTotal = 0;
                }
                
                // Validate individual product stock
                dayData.openingStock.forEach(item => {
                  if (item.qtls < 0) {
                    console.error(`🔍 ERROR - Negative opening qtls for ${item.product} on ${date}`);
                    item.qtls = 0;
                  }
                  if (item.bags < 0) {
                    console.error(`🔍 ERROR - Negative opening bags for ${item.product} on ${date}`);
                    item.bags = 0;
                  }
                });
              });
              
              // Return in reverse chronological order (latest first) for display
              return sortedDates.reverse().map(date => dailyData[date]);
            };

            const processedData = processRiceStockData(riceStockData);
            console.log('🔍 DEBUG - Processed data:', processedData);
            console.log('🔍 DEBUG - Dates in processed data:', processedData.map((d: any) => d.date));

            // Filter data - show only dates that have data AND match filters
            const filteredData = processedData.filter((dayData: any) => {
              const hasData = dayData.productions && dayData.productions.length > 0;
              if (!hasData) return false;

              const itemDate = dayData.date; // YYYY-MM-DD format

              // Apply dateFrom filter
              if (dateFrom) {
                // Convert DD-MM-YYYY to YYYY-MM-DD for comparison
                const parts = dateFrom.split('-');
                if (parts.length === 3) {
                  const filterDateFrom = parts.length === 3 && parts[2].length === 4
                    ? `${parts[2]}-${parts[1]}-${parts[0]}` // DD-MM-YYYY -> YYYY-MM-DD
                    : dateFrom; // Already in YYYY-MM-DD
                  if (itemDate < filterDateFrom) return false;
                }
              }

              // Apply dateTo filter
              if (dateTo) {
                // Convert DD-MM-YYYY to YYYY-MM-DD for comparison
                const parts = dateTo.split('-');
                if (parts.length === 3) {
                  const filterDateTo = parts.length === 3 && parts[2].length === 4
                    ? `${parts[2]}-${parts[1]}-${parts[0]}` // DD-MM-YYYY -> YYYY-MM-DD
                    : dateTo; // Already in YYYY-MM-DD
                  if (itemDate > filterDateTo) return false;
                }
              }

              // Apply month filter (YYYY-MM format)
              if (selectedMonth && !itemDate.startsWith(selectedMonth)) {
                return false;
              }

              console.log(`🔍 DEBUG - Date ${dayData.date}: hasData=${hasData}, passed filters=true`);
              return true;
            });

            console.log('🔍 DEBUG - Filtered data after date/month filter:', filteredData.length);

            if (filteredData.length === 0) {
              return (
                <EmptyState>
                  <p>No rice stock data available for the selected period</p>
                  <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                    Total raw records: {riceStockData.length}
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                    Rice stock will appear here once rice production entries are approved
                  </p>
                </EmptyState>
              );
            }

            return (
              <div style={{ padding: '1rem' }}>
                {filteredData.map((dayData: any) => {
                  // Group data by product types - Excel style
                  const groupDataByProductType = (data: any[]) => {
                    const groups: { [key: string]: any[] } = {
                      'Rice': [],
                      'Palti': [],
                      'Bran': [],
                      'RJ Rice (2)': [],
                      'RJ Broken': [],
                      'Unpolish': [],
                      'Faram': [],
                      '0 Broken': [],
                      'Sizer Broken': [],
                      'RJ Rice 1': [],
                      'Broken': [],
                      'Other': []
                    };

                    data.forEach(item => {
                      // Integrate palti operations into their actual product types
                      if (item.movementType === 'palti') {
                        // For palti operations, use the actual product_type (Rice, Broken, etc.)
                        let actualProductType = item.productType || item.category || 'Rice';

                        // Debug logging
                        console.log('🔍 DEBUG - Palti grouping:', {
                          itemId: item.id,
                          'item.productType': item.productType,
                          'item.category': item.category,
                          'actualProductType': actualProductType
                        });

                        // If productType is 'Palti' (legacy entries), default to 'Rice'
                        if (actualProductType === 'Palti') {
                          actualProductType = 'Rice'; // Legacy entries treated as Rice
                        }

                        // Use exact match first (same as categorization logic)
                        const exactProductTypes: { [key: string]: string } = {
                          'Rice': 'Rice',
                          'Bran': 'Bran',
                          'Broken': 'Broken',
                          'Faram': 'Faram',
                          'Unpolish': 'Unpolish',
                          '0 Broken': '0 Broken',
                          'Zero Broken': '0 Broken',
                          'Sizer Broken': 'Sizer Broken',
                          'RJ Broken': 'RJ Broken',
                          'Rejection Broken': 'RJ Broken', // FIXED: Consistency
                          'RJ Rice 1': 'RJ Rice 1',
                          'RJ Rice (2)': 'RJ Rice (2)',
                          'RJ Rice 2': 'RJ Rice (2)',
                        };

                        // Normalize productType to category name
                        if (exactProductTypes[actualProductType]) {
                          actualProductType = exactProductTypes[actualProductType];
                        } else {
                          // Case-insensitive match
                          const productLower = actualProductType.toLowerCase();
                          const exactMatch = Object.entries(exactProductTypes).find(
                            ([key]) => key.toLowerCase() === productLower
                          );
                          if (exactMatch) {
                            actualProductType = exactMatch[1];
                          }
                        }

                        console.log('🔍 DEBUG - Palti final category:', actualProductType);

                        if (!groups[actualProductType]) {
                          groups[actualProductType] = [];
                        }
                        groups[actualProductType].push(item);
                        return;
                      }

                      const product = (item.product || '').toLowerCase();
                      if (product.includes('unpolish')) {
                        groups['Unpolish'].push(item);
                      } else if (product.includes('faram')) {
                        groups['Faram'].push(item);
                      } else if (product.includes('zero broken') || product.includes('0 broken')) {
                        groups['0 Broken'].push(item);
                      } else if (product.includes('sizer broken')) {
                        groups['Sizer Broken'].push(item);
                      } else if (product.includes('rejection broken') || product.includes('rj broken')) {
                        groups['RJ Broken'].push(item);
                      } else if (product.includes('rj rice 1')) {
                        groups['RJ Rice 1'].push(item);
                      } else if (product.includes('rj rice 2') || product.includes('rj rice (2)')) {
                        groups['RJ Rice (2)'].push(item);
                      } else if (product.includes('broken')) {
                        groups['Broken'].push(item);
                      } else if (product.includes('rice') || product.includes('rj rice')) {
                        groups['Rice'].push(item);
                      } else if (product.includes('bran')) {
                        groups['Bran'].push(item);
                      } else {
                        groups['Other'].push(item);
                      }
                    });

                    return groups;
                  };

                  const openingGroups = groupDataByProductType(dayData.openingStock || []);

                  // Include ALL productions (including Palti) in productionGroups
                  // Palti entries will be grouped by their product_type (Rice, Bran, etc.)
                  const allProductions = dayData.productions || [];

                  // All movements go into productionGroups based on their product category
                  const productionGroups = groupDataByProductType(allProductions);

                  // For backward compatibility, create empty paltiGroups
                  // Palti entries are now in productionGroups under their product type (Rice, Bran, etc.)
                  const paltiGroups: { [key: string]: any[] } = {
                    'Rice': [], 'Bran': [], 'Broken': [], '0 Broken': [], 'Faram': [],
                    'Unpolish': [], 'RJ Rice (2)': [], 'Sizer Broken': [], 'RJ Rice 1': [],
                    'RJ Broken': [], 'Other': [], 'Palti': []
                  };

                  console.log('🔍 DEBUG - Production groups for date', dayData.date, {
                    allProductions: allProductions.length,
                    productionGroupKeys: Object.keys(productionGroups).filter(k => productionGroups[k].length > 0),
                    riceCount: productionGroups['Rice']?.length || 0,
                    paltiInRice: productionGroups['Rice']?.filter((p: any) => p.movementType === 'palti').length || 0
                  });

                  // Calculate totals for each group (considering movement types)
                  const calculateGroupTotals = (group: any[]) => {
                    return {
                      qtls: group.reduce((sum, item) => {
                        const movementType = (item.movementType || '').toLowerCase();

                        if (movementType === 'palti') {
                          let paltiChange = 0;
                          const fromLoc = item.fromLocation || item.locationCode || '';
                          const toLoc = item.toLocation || item.location || '';
                          const targetQtls = Math.abs(item.actualQtls || item.qtls || 0);
                          const shortageKg = Number(item.shortageKg || item.conversionShortageKg || item.conversion_shortage_kg || 0);
                          const shortageQtls = shortageKg / 100;
                          const sourceQtls = targetQtls + shortageQtls;

                          if (normalize(fromLoc) !== 'direct load') {
                            paltiChange -= sourceQtls;
                          }
                          if (normalize(toLoc) !== 'direct load') {
                            paltiChange += targetQtls;
                          }
                          return sum + paltiChange;
                        }

                        // Regular movement
                        const location = item.locationCode || item.location || '';
                        if (normalize(location) === 'direct load') return sum;

                        const qty = Math.abs(Number(item.actualQtls || item.qtls) || 0);
                        return movementType === 'sale' ? sum - qty : sum + qty;
                      }, 0),
                      bags: group.reduce((sum, item) => {
                        const movementType = (item.movementType || '').toLowerCase();

                        if (movementType === 'palti') {
                          let bagsChange = 0;
                          const fromLoc = item.fromLocation || item.locationCode || '';
                          const toLoc = item.toLocation || item.location || '';
                          const targetBags = Number(item.bags) || 0;
                          const shortageBags = Number(item.shortageBags || 0);

                          // FIX: Use actual source bags from database, or calculate from quintals
                          // item.bags is TARGET bags (e.g., 86 bags of 30kg)
                          // item.sourceBags is SOURCE bags (e.g., 100 bags of 26kg)
                          let sourceBags: number;
                          if (item.sourceBags && Number(item.sourceBags) > 0) {
                            sourceBags = Number(item.sourceBags);
                          } else {
                            // Calculate source bags from quintals and SOURCE packaging kg
                            // CRITICAL FIX: Use source packaging kg, NOT target bag kg
                            const targetQtls = Math.abs(item.actualQtls || item.qtls || 0);
                            const shortageKg = Number(item.shortageKg || item.conversionShortageKg || item.conversion_shortage_kg || 0);
                            const sourceQtls = targetQtls + (shortageKg / 100);

                            // FIXED: Prioritize sourcePackaging information over bagSizeKg (which is TARGET size)
                            const sourcePackagingKg = Number(
                              item.sourcePackaging?.allottedKg ||
                              item.source_packaging_kg ||
                              item.sourcePackagingKg ||
                              item.source_bag_size_kg ||
                              // Fallback: if we have source bags in the data, we can calculate kg from qtls
                              (item.source_bags && sourceQtls > 0 ? (sourceQtls * 100) / Number(item.source_bags) : null) ||
                              26 // Default to 26kg only if nothing else available
                            );
                            sourceBags = Math.round((sourceQtls * 100) / sourcePackagingKg);

                            // DEBUG: Log when palti calculation happens
                            console.log('📊 Palti sourceBags calculation:', {
                              id: item.id,
                              targetQtls,
                              shortageKg,
                              sourceQtls,
                              sourcePackagingKg,
                              calculatedSourceBags: sourceBags,
                              targetBags,
                              fromLoc,
                              toLoc
                            });
                          }

                          if (normalize(fromLoc) !== 'direct load') {
                            bagsChange -= sourceBags;
                          }
                          if (normalize(toLoc) !== 'direct load') {
                            bagsChange += targetBags;
                          }
                          return sum + bagsChange;
                        }


                        // Regular movement
                        const location = item.locationCode || item.location || '';
                        if (normalize(location) === 'direct load') return sum;

                        const bags = Math.abs(Number(item.bags) || 0);
                        return movementType === 'sale' ? sum - bags : sum + bags;
                      }, 0)
                    };
                  };

                  // Standardized Variety Matching Helper (used for Palti splits)
                  const standardizeVariety = (str: any) => {
                    if (!str) return '';
                    return String(str)
                      .toLowerCase()
                      .trim()
                      .replace(/raw$/, '')
                      .replace(/steam$/, '')
                      .replace(/[_\s-]+/g, ' ')
                      .trim();
                  };

                  return (
                    <div key={dayData.date} style={{ marginBottom: '2rem', background: 'white', border: '1px solid #000' }}>
                      {/* Date Header - Excel style */}
                      <div style={{ background: '#4472C4', color: '#FFF', padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '0.9rem', borderBottom: '1px solid #000' }}>
                        {new Date(dayData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>

                      {/* Clean card-style layout - Rice left, Right side with vertical stack + horizontal bottom row */}
                      <div style={{
                        padding: '1rem',
                        fontFamily: 'Calibri, Arial, sans-serif'
                      }}>

                        {/* Top Row: Rice left, Vertical stack right */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 20px 1fr',
                          gap: '0',
                          marginBottom: '8px'
                        }}>

                          {/* Left Side: Rice */}
                          <div>
                            {(() => {
                              const productType = 'Rice';
                              const hasData = (openingGroups[productType]?.length > 0 || productionGroups[productType]?.length > 0);

                              return (
                                <div key={productType}>
                                  <div style={{
                                    background: '#f8f9fa',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    marginBottom: '16px'
                                  }}>
                                    {/* Product Header */}
                                    <div style={{
                                      background: '#e9ecef',
                                      padding: '8px 12px',
                                      fontWeight: 'bold',
                                      textAlign: 'center',
                                      fontSize: '12pt',
                                      fontFamily: 'Calibri, Arial, sans-serif',
                                      color: '#495057'
                                    }}>
                                      Rice
                                    </div>

                                    {/* Column Headers */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                      gap: '8px',
                                      padding: '6px 12px',
                                      background: '#f1f3f4',
                                      fontSize: '9pt',
                                      fontWeight: 'bold',
                                      color: '#5f6368'
                                    }}>
                                      <div style={{ textAlign: 'center' }}>Qtls</div>
                                      <div style={{ textAlign: 'center' }}>Bags</div>
                                      <div style={{ textAlign: 'center' }}>Product</div>
                                      <div style={{ textAlign: 'center' }}>Variety</div>
                                      <div style={{ textAlign: 'center' }}>Packaging</div>
                                      <div style={{ textAlign: 'center' }}>L</div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ padding: '8px 12px' }}>
                                      {(() => {
                                        // FIXED: Deduplicate paltiItems by ID to prevent showing same entry twice
                                        // dayData.conversions now correctly contains today's palti movements
                                        const paltiItemsAll = dayData.conversions?.filter((item: any) => item.category === productType) || [];
                                        const seenPaltiIds = new Set<string>();
                                        const paltiItems = paltiItemsAll.filter((item: any) => {
                                          const itemId = String(item.id);
                                          if (seenPaltiIds.has(itemId)) return false;
                                          seenPaltiIds.add(itemId);
                                          return true;
                                        });

                                        // HIERARCHICAL GROUPING: Group palti entries by source variety + source packaging
                                        const groupPaltiBySource = (items: any[]) => {
                                          const sourceGroups: {
                                            [key: string]: {
                                              sourceVariety: string;
                                              sourcePackaging: string;
                                              sourceBagSizeKg: number;
                                              sourceLocation: string;
                                              conversions: any[];
                                              totalConvertedQtls: number;
                                              totalConvertedBags: number;
                                              totalShortageKg: number;
                                            }
                                          } = {};

                                          items.forEach((item: any) => {
                                            // Extract source info
                                            const sourceVariety = item.variety || item.sourceVariety || 'Unknown';
                                            const sourcePkg = item.sourcePackaging?.brandName || item.source_packaging_brand || item.source_packaging || 'Unknown';
                                            const sourceBagSizeKg = item.sourcePackaging?.allottedKg || item.source_packaging_kg || item.sourceBagSizeKg || 50;
                                            const sourceLocation = item.fromLocation || item.locationCode || 'A1';

                                            // Create grouping key based on source variety + source packaging
                                            const groupKey = `${sourceVariety}|${sourcePkg}|${sourceBagSizeKg}`;

                                            if (!sourceGroups[groupKey]) {
                                              sourceGroups[groupKey] = {
                                                sourceVariety,
                                                sourcePackaging: sourcePkg,
                                                sourceBagSizeKg,
                                                sourceLocation,
                                                conversions: [],
                                                totalConvertedQtls: 0,
                                                totalConvertedBags: 0,
                                                totalShortageKg: 0
                                              };
                                            }

                                            // Extract target info
                                            let targetPkg = item.targetPackaging?.brandName || item.target_packaging_brand || item.target_packaging || item.packaging?.brandName || item.packaging || 'Unknown';
                                            if (typeof targetPkg === 'string' && targetPkg.includes('→')) {
                                              const parts = targetPkg.split('→').map((s: string) => s.trim());
                                              targetPkg = parts[1] || parts[0];
                                            }
                                            const targetBagSizeKg = item.targetPackaging?.allottedKg || item.target_packaging_kg || item.bagSizeKg || 26;
                                            const targetLocation = item.toLocation || item.location || 'A1';

                                            const qtls = Math.abs(item.qtls || 0);
                                            const bags = item.bags || 0;
                                            const shortageKg = item.shortageKg || item.conversionShortageKg || item.conversion_shortage_kg || 0;

                                            sourceGroups[groupKey].conversions.push({
                                              ...item,
                                              targetPackaging: targetPkg,
                                              targetBagSizeKg,
                                              targetLocation,
                                              qtls,
                                              bags,
                                              shortageKg
                                            });
                                            sourceGroups[groupKey].totalConvertedQtls += qtls;
                                            sourceGroups[groupKey].totalConvertedBags += bags;
                                            sourceGroups[groupKey].totalShortageKg += Number(shortageKg);
                                          });

                                          return Object.values(sourceGroups);
                                        };

                                        const hierarchicalGroups = groupPaltiBySource(paltiItems);
                                        const totalQtls = paltiItems.reduce((sum: number, item: any) => sum + Math.abs(item.qtls || 0), 0);
                                        const totalBags = paltiItems.reduce((sum: number, item: any) => sum + (item.bags || 0), 0);
                                        const totalShortage = paltiItems.reduce((sum: number, item: any) => sum + (item.shortageKg || item.conversionShortageKg || item.conversion_shortage_kg || 0), 0);

                                        return (
                                          <>
                                            {/* Redundant Palti Box Removed - Inline Palti implemented below */}


                                            {/* Yesterday's Bifurcation - WITH PALTI SPLITS INLINE */}
                                            {(() => {
                                              // Get all bifurcation items for this product type (excluding palti movement type)
                                              const bifurcationItems = dayData.yesterdayBifurcation?.filter(
                                                (item: any) => item.category === productType && item.movementType !== 'palti' && item.movementType !== 'palti-shortage'
                                              ) || [];

                                              if (bifurcationItems.length === 0) return null;

                                              // Get all Palti items for this product type to find splits
                                              // FIXED: Deduplicate by ID to prevent showing same palti twice
                                              const allPaltiItems = [...(dayData.conversions?.filter((item: any) => item.category === productType) || []),
                                              ...(productionGroups[productType] || []).filter((item: any) => item.movementType === 'palti')];

                                              // Deduplicate by ID
                                              const seenIds = new Set<string>();
                                              const paltiItems = allPaltiItems.filter((item: any) => {
                                                const itemId = String(item.id);
                                                if (seenIds.has(itemId)) return false;
                                                seenIds.add(itemId);
                                                return true;
                                              });

                                              // Create a map of source key -> palti splits
                                              // FIXED: Use only variety for matching (not packaging) since
                                              // opening stock shows TARGET packaging but palti has SOURCE packaging
                                              const paltiSplitsMap: { [key: string]: any[] } = {};
                                              paltiItems.forEach((palti: any) => {
                                                // Create source key matching: variety only (simplified for better matching)
                                                // Improved Variety Normalization for matching (sum25 rnr -> sum25 rnr raw/steam)
                                                const sourceVariety = standardizeVariety(palti.variety || palti.sourceVariety);

                                                // SIMPLIFIED: Use variety only as key to fix mismatch issues
                                                const sourceKey = sourceVariety;

                                                if (!paltiSplitsMap[sourceKey]) {
                                                  paltiSplitsMap[sourceKey] = [];
                                                }

                                                // Extract target info for this split
                                                let targetPkg = palti.targetPackaging?.brandName || palti.target_packaging_brand || palti.target_packaging || palti.packaging?.brandName || palti.packaging || 'Unknown';
                                                if (typeof targetPkg === 'string' && targetPkg.includes('→')) {
                                                  const parts = targetPkg.split('→').map((s: string) => s.trim());
                                                  targetPkg = parts[1] || parts[0];
                                                }
                                                const targetBagSizeKg = palti.targetPackaging?.allottedKg || palti.target_packaging_kg || palti.bagSizeKg || 26;
                                                const targetLocation = palti.toLocation || palti.location || 'Unknown';
                                                const shortageKg = Number(palti.shortageKg || palti.conversionShortageKg || palti.conversion_shortage_kg || 0);

                                                paltiSplitsMap[sourceKey].push({
                                                  qtls: Math.abs(palti.qtls || 0),
                                                  bags: palti.bags || 0,
                                                  targetPackaging: targetPkg,
                                                  targetBagSizeKg,
                                                  targetLocation,
                                                  shortageKg,
                                                  variety: palti.variety || 'Unknown'
                                                });
                                              });

                                              return (
                                                <>
                                                  <div style={{
                                                    fontSize: '8.5pt',
                                                    fontWeight: 'bold',
                                                    color: '#4b5563',
                                                    padding: '2px 8px',
                                                    marginBottom: '4px'
                                                  }}>
                                                    📋 Variety-wise Opening Stock
                                                  </div>

                                                  {bifurcationItems.map((item: any, idx: number) => {
                                                    // Create key to check if this item was used as Palti source
                                                    // Improved Variety Normalization for matching (sum25 rnr -> sum25 rnr raw/steam)
                                                    const itemVariety = standardizeVariety(item.variety);

                                                    const itemPkg = (item.packaging?.brandName || item.packaging || '').toLowerCase().trim();
                                                    const itemBagSizeKg = item.bagSizeKg || 26;
                                                    const itemLocation = (item.location || '').toLowerCase().trim();

                                                    // SIMPLIFIED: Use variety only as key to match palti source key format
                                                    const itemKey = itemVariety;
                                                    const splits = paltiSplitsMap[itemKey] || [];
                                                    const hasSplits = splits.length > 0;
                                                    const totalShortage = splits.reduce((sum: number, s: any) => sum + (s.shortageKg || 0), 0);

                                                    // DEBUG: Log matching keys to trace why splits aren't matching
                                                    console.log('🔍 PALTI MATCH DEBUG:', {
                                                      bifurcationItem: {
                                                        variety: item.variety,
                                                        standardizedVariety: itemVariety,
                                                        packaging: item.packaging,
                                                        standardizedPkg: itemPkg,
                                                        bagSizeKg: itemBagSizeKg,
                                                        location: item.location,
                                                        standardizedLoc: itemLocation,
                                                        KEY: itemKey
                                                      },
                                                      paltiItemsCount: paltiItems.length,
                                                      paltiSplitsMapKeys: Object.keys(paltiSplitsMap),
                                                      hasSplits,
                                                      splitsCount: splits.length
                                                    });

                                                    return (
                                                      <React.Fragment key={`bifurcation-${productType}-${idx}`}>
                                                        {/* Main Opening Stock Entry - Highlighted Yellow if has Palti splits */}
                                                        <div style={{
                                                          display: 'grid',
                                                          gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                                          gap: '8px',
                                                          padding: '3px 0',
                                                          fontSize: '9pt',
                                                          background: hasSplits ? '#fef3c7' : '#f8f9fa',
                                                          marginBottom: hasSplits ? '0' : '2px',
                                                          borderRadius: hasSplits ? '3px 3px 0 0' : '3px',
                                                          border: hasSplits ? '2px solid #f59e0b' : '1px solid #e9ecef',
                                                          borderBottom: hasSplits ? '1px dashed #f59e0b' : '1px solid #e9ecef'
                                                        }}>
                                                          <div style={{ textAlign: 'center', fontSize: '8pt', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.qtls.toFixed(2)}</div>
                                                          <div style={{ textAlign: 'center', fontSize: '8pt' }}>{item.bags}{item.bagSizeKg ? `/${item.bagSizeKg}kgs` : ''}</div>
                                                          <div style={{ fontSize: '8pt', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                            <div>
                                                              {item.product}
                                                              {item.outturn?.code && (
                                                                <span style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: '4px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigateToOutturn(item.outturn.code)}>→ {item.outturn.code}</span>
                                                              )}
                                                            </div>
                                                            {hasSplits && totalShortage > 0 && (
                                                              <div style={{
                                                                background: '#fee2e2',
                                                                color: '#dc2626',
                                                                fontSize: '7pt',
                                                                padding: '1px 4px',
                                                                borderRadius: '4px',
                                                                fontWeight: 'bold',
                                                                border: '1px solid #fca5a5'
                                                              }}>
                                                                S: {totalShortage.toFixed(1)}kg
                                                              </div>
                                                            )}
                                                          </div>
                                                          <div style={{ fontSize: '8pt', textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.variety || 'Unknown'}</div>
                                                          <div style={{ fontSize: '8pt', textAlign: 'center' }}>{item.packaging?.brandName || item.packaging || 'A1'}</div>
                                                          <div style={{ fontSize: '8pt', textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.location}</div>
                                                        </div>

                                                        {/* Palti Splits - Shown below the source entry with reference-accurate styling */}
                                                        {hasSplits && (
                                                          <div style={{
                                                            border: '2px solid #f59e0b',
                                                            borderTop: 'none',
                                                            borderRadius: '0 0 4px 4px',
                                                            marginBottom: '6px',
                                                            overflow: 'hidden'
                                                          }}>
                                                            {splits.map((split: any, splitIdx: number) => (
                                                              <div key={`split-${splitIdx}`} style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                                                gap: '8px',
                                                                padding: '4px 12px',
                                                                fontSize: '8.5pt',
                                                                background: splitIdx % 2 === 0 ? '#fff7ed' : '#ffedd5',
                                                                color: '#7c2d12',
                                                                borderBottom: splitIdx < splits.length - 1 ? '1px solid #fed7aa' : 'none',
                                                                position: 'relative'
                                                              }}>
                                                                <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#ea580c' }}>
                                                                  {split.qtls.toFixed(2)}
                                                                </div>
                                                                <div style={{ textAlign: 'center', color: '#9a3412' }}>
                                                                  {split.bags}/{split.targetBagSizeKg}kg
                                                                </div>
                                                                <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                                  <span style={{ color: '#f97316' }}>↳</span> Palti Target
                                                                </div>
                                                                <div style={{ textAlign: 'center', fontWeight: '500', color: '#7c3aed' }}>{split.variety}</div>
                                                                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{split.targetPackaging}</div>
                                                                <div style={{ textAlign: 'center' }}>{split.targetLocation}</div>
                                                              </div>
                                                            ))}

                                                            {/* Total shortage row - Matching Red reference style */}
                                                            {totalShortage > 0 && (
                                                              <div style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                                                gap: '8px',
                                                                padding: '5px 12px',
                                                                fontSize: '8.5pt',
                                                                background: '#fee2e2',
                                                                color: '#dc2626',
                                                                borderTop: '1.5px solid #fca5a5',
                                                                fontWeight: 'bold'
                                                              }}>
                                                                <div style={{ textAlign: 'center' }}>{(totalShortage / 100).toFixed(2)}</div>
                                                                <div style={{ textAlign: 'center' }}>-</div>
                                                                <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                                  <span style={{ fontSize: '10pt' }}>⚠️</span> Shortage From Palti
                                                                </div>
                                                                <div style={{ textAlign: 'center' }}>-</div>
                                                                <div style={{ textAlign: 'center' }}>-</div>
                                                                <div style={{ textAlign: 'center' }}>{totalShortage.toFixed(1)}kg</div>
                                                              </div>
                                                            )}
                                                          </div>
                                                        )}
                                                      </React.Fragment>
                                                    );
                                                  })}
                                                </>
                                              );
                                            })()}

                                            {/* Opening Stock */}
                                            {hasData && openingGroups[productType]?.length > 0 && (
                                              <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                                gap: '8px',
                                                padding: '3px 0',
                                                fontSize: '9pt',
                                                background: '#ffffff',
                                                marginBottom: '4px',
                                                borderRadius: '4px'
                                              }}>
                                                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '8pt' }}>{calculateGroupTotals(openingGroups[productType]).qtls.toFixed(2)}</div>
                                                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '8pt' }}>{calculateGroupTotals(openingGroups[productType]).bags}</div>
                                                <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>Opening Stock</div>
                                                <div></div><div></div><div></div>
                                              </div>
                                            )}

                                            {/* Daily Movements */}
                                            {hasData && (productionGroups[productType] || []).filter((prod: any) => prod.movementType !== 'palti' && prod.movementType !== 'palti-shortage').map((prod: any, idx: number) => {
                                              const getMovementColor = (movementType: string) => {
                                                switch (movementType?.toLowerCase()) {
                                                  case 'production': return '#d4edda';
                                                  case 'purchase': return '#cce5ff';
                                                  case 'sale': return '#fee2e2';
                                                  default: return '#ffffff';
                                                }
                                              };
                                              return (
                                                <div key={`${productType}-${idx}`} style={{
                                                  display: 'grid',
                                                  gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                                  gap: '8px',
                                                  padding: '3px 0',
                                                  fontSize: '8pt',
                                                  background: getMovementColor(prod.movementType),
                                                  marginBottom: '2px',
                                                  borderRadius: '4px'
                                                }}>
                                                  <div style={{ textAlign: 'center' }}>{Math.abs(Number(prod.qtls) || 0).toFixed(2)}</div>
                                                  <div style={{ textAlign: 'center' }}>{prod.bags || 0}{prod.bagSizeKg ? `/${prod.bagSizeKg}kgs` : ''}</div>
                                                  <div style={{ textAlign: 'center' }}>
                                                    {String(prod.product || '')}
                                                    {prod.outturn?.code && (
                                                      <span style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: '4px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigateToOutturn(prod.outturn.code)}>→ {prod.outturn.code}</span>
                                                    )}
                                                  </div>
                                                  <div style={{ textAlign: 'center' }}>{String(prod.variety || 'Unknown')}</div>
                                                  <div style={{ textAlign: 'center' }}>{prod.packaging?.brandName || prod.packaging || 'A1'}</div>
                                                  <div style={{ textAlign: 'center' }}>{prod.locationCode || prod.location || ''}</div>
                                                </div>
                                              );
                                            })}

                                            {/* Closing Stock */}
                                            {hasData && (
                                              <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '60px 80px 1fr 120px 100px 60px',
                                                gap: '8px',
                                                padding: '3px 0',
                                                fontSize: '9pt',
                                                background: '#e9ecef',
                                                marginTop: '4px',
                                                borderRadius: '4px',
                                                fontWeight: 'bold'
                                              }}>
                                                <div style={{ textAlign: 'right', fontSize: '8pt' }}>{(calculateGroupTotals(openingGroups[productType] || []).qtls + calculateGroupTotals(productionGroups[productType] || []).qtls).toFixed(2)}</div>
                                                <div style={{ textAlign: 'right', fontSize: '8pt' }}>{calculateGroupTotals(openingGroups[productType] || []).bags + calculateGroupTotals(productionGroups[productType] || []).bags}</div>
                                                <div style={{ fontSize: '8pt' }}>Closing Stock</div>
                                                <div></div><div></div><div></div>
                                              </div>
                                            )}

                                            {!hasData && (
                                              <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic', fontSize: '9pt' }}>No data available</div>
                                            )}
                                          </>
                                        );
                                      })()}</div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Palti Section - Removed since Palti entries now appear in their product type sections */}
                          </div>

                          {/* Gap */}
                          <div></div>

                          {/* Right Side: Vertically Stacked Product Types */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {['Broken', 'RJ Broken', 'RJ Rice 1', '0 Broken', 'Unpolish', 'Faram'].map((productType) => {
                              const hasData = (openingGroups[productType]?.length > 0 || productionGroups[productType]?.length > 0);

                              return (
                                <div key={productType}>
                                  <div style={{
                                    background: '#f8f9fa',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    marginBottom: '20px'
                                  }}>
                                    {/* Product Header */}
                                    <div style={{
                                      background: '#e9ecef',
                                      padding: '4px 8px',
                                      fontWeight: 'bold',
                                      textAlign: 'center',
                                      fontSize: '10pt',
                                      fontFamily: 'Calibri, Arial, sans-serif',
                                      color: '#495057'
                                    }}>
                                      {productType}
                                    </div>

                                    {/* Column Headers */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                      gap: '6px',
                                      padding: '3px 8px',
                                      background: '#f1f3f4',
                                      fontSize: '8pt',
                                      fontWeight: 'bold',
                                      color: '#5f6368'
                                    }}>
                                      <div style={{ textAlign: 'center' }}>Qtls</div>
                                      <div style={{ textAlign: 'center' }}>Bags</div>
                                      <div style={{ textAlign: 'center' }}>Product</div>
                                      <div style={{ textAlign: 'center' }}>Variety</div>
                                      <div style={{ textAlign: 'center' }}>Packaging</div>
                                      <div style={{ textAlign: 'center' }}>L</div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ padding: '4px 8px' }}>
                                      {/* Yesterday's Bifurcation - WITH PALTI SPLITS INLINE */}
                                      {(() => {
                                        const bifurcationItems = dayData.yesterdayBifurcation?.filter(
                                          (item: any) => item.category === productType && item.movementType !== 'palti' && item.movementType !== 'palti-shortage'
                                        ) || [];

                                        if (bifurcationItems.length === 0) return null;

                                        // Get Palti items for splits
                                        const paltiItems = [
                                          ...(dayData.conversions?.filter((item: any) => item.category === productType) || []),
                                          ...(productionGroups[productType] || []).filter((item: any) => item.movementType === 'palti')
                                        ];

                                        // Map source key -> splits
                                        // FIXED: Use only variety for matching (matching Rice section logic)
                                        const paltiSplitsMap: { [key: string]: any[] } = {};

                                        // FIXED: Deduplicate palti items by ID
                                        const seenPaltiIds = new Set<string>();
                                        const dedupedPaltiItems = paltiItems.filter((p: any) => {
                                          const pid = String(p.id);
                                          if (seenPaltiIds.has(pid)) return false;
                                          seenPaltiIds.add(pid);
                                          return true;
                                        });

                                        dedupedPaltiItems.forEach((palti: any) => {
                                          const sourceVariety = standardizeVariety(palti.variety || palti.sourceVariety);
                                          // SIMPLIFIED: variety-only key
                                          const sourceKey = sourceVariety;

                                          if (!paltiSplitsMap[sourceKey]) paltiSplitsMap[sourceKey] = [];

                                          let targetPkg = palti.targetPackaging?.brandName || palti.target_packaging_brand || palti.target_packaging || palti.packaging?.brandName || palti.packaging || 'Unknown';
                                          if (typeof targetPkg === 'string' && targetPkg.includes('→')) {
                                            targetPkg = targetPkg.split('→').map((s: string) => s.trim())[1] || targetPkg.split('→')[0];
                                          }

                                          paltiSplitsMap[sourceKey].push({
                                            qtls: Math.abs(palti.qtls || 0),
                                            bags: palti.bags || 0,
                                            targetPackaging: targetPkg,
                                            targetBagSizeKg: palti.targetPackaging?.allottedKg || palti.target_packaging_kg || palti.bagSizeKg || 26,
                                            targetLocation: palti.toLocation || palti.location || 'Unknown',
                                            shortageKg: Number(palti.shortageKg || palti.conversionShortageKg || palti.conversion_shortage_kg || 0),
                                            variety: palti.variety || 'Unknown'
                                          });
                                        });

                                        return (
                                          <>
                                            <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#4b5563', padding: '2px 4px', marginBottom: '2px' }}>
                                              📋 Variety-wise Opening Stock
                                            </div>
                                            {bifurcationItems.map((item: any, idx: number) => {
                                              const itemVariety = standardizeVariety(item.variety);
                                              // SIMPLIFIED: Use variety only as key to match palti source key format
                                              const itemKey = itemVariety;
                                              const splits = paltiSplitsMap[itemKey] || [];
                                              const hasSplits = splits.length > 0;
                                              const totalShortage = splits.reduce((sum: number, s: any) => sum + (s.shortageKg || 0), 0);


                                              return (
                                                <React.Fragment key={`bifurcation-${productType}-${idx}`}>
                                                  <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                                    gap: '6px',
                                                    padding: '2px 0',
                                                    fontSize: '8pt',
                                                    background: hasSplits ? '#fef3c7' : '#f8f9fa',
                                                    marginBottom: hasSplits ? '0' : '1px',
                                                    borderRadius: hasSplits ? '2px 2px 0 0' : '2px',
                                                    border: hasSplits ? '2px solid #f59e0b' : '1px solid #e9ecef',
                                                    borderBottom: hasSplits ? '1px dashed #f59e0b' : '1px solid #e9ecef'
                                                  }}>
                                                    <div style={{ textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.qtls.toFixed(2)}</div>
                                                    <div style={{ textAlign: 'center' }}>{item.bags}{item.bagSizeKg ? `/${item.bagSizeKg}kgs` : ''}</div>
                                                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                      <div>
                                                        {item.product}
                                                        {item.outturn?.code && (
                                                          <span style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: '4px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigateToOutturn(item.outturn.code)}>→ {item.outturn.code}</span>
                                                        )}
                                                      </div>
                                                      {hasSplits && totalShortage > 0 && (
                                                        <div style={{
                                                          background: '#fee2e2',
                                                          color: '#dc2626',
                                                          fontSize: '6.5pt',
                                                          padding: '0px 3px',
                                                          borderRadius: '3px',
                                                          fontWeight: 'bold',
                                                          border: '1px solid #fca5a5'
                                                        }}>
                                                          S: {totalShortage.toFixed(1)}kg
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div style={{ textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.variety || 'Unknown'}</div>
                                                    <div style={{ textAlign: 'center' }}>{item.packaging}</div>
                                                    <div style={{ textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.location}</div>
                                                  </div>

                                                  {/* Palti Splits - Shown below the source entry with reference-accurate styling */}
                                                  {hasSplits && (
                                                    <div style={{
                                                      border: '2px solid #f59e0b',
                                                      borderTop: 'none',
                                                      borderRadius: '0 0 4px 4px',
                                                      marginBottom: '4px',
                                                      overflow: 'hidden'
                                                    }}>
                                                      {splits.map((split: any, splitIdx: number) => (
                                                        <div key={`split-${splitIdx}`} style={{
                                                          display: 'grid',
                                                          gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                                          gap: '6px',
                                                          padding: '3px 8px',
                                                          fontSize: '7.5pt',
                                                          background: splitIdx % 2 === 0 ? '#fff7ed' : '#ffedd5',
                                                          color: '#7c2d12',
                                                          borderBottom: splitIdx < splits.length - 1 ? '1px solid #fed7aa' : 'none',
                                                          position: 'relative'
                                                        }}>
                                                          <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#ea580c' }}>
                                                            {split.qtls.toFixed(2)}
                                                          </div>
                                                          <div style={{ textAlign: 'center', color: '#9a3412' }}>
                                                            {split.bags}/{split.targetBagSizeKg}kg
                                                          </div>
                                                          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                                            <span style={{ color: '#f97316' }}>↳</span> Split
                                                          </div>
                                                          <div style={{ textAlign: 'center', fontWeight: '500', color: '#7c3aed' }}>{split.variety}</div>
                                                          <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{split.targetPackaging}</div>
                                                          <div style={{ textAlign: 'center' }}>{split.targetLocation}</div>
                                                        </div>
                                                      ))}

                                                      {/* Total shortage row - Matching Red reference style */}
                                                      {totalShortage > 0 && (
                                                        <div style={{
                                                          display: 'grid',
                                                          gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                                          gap: '6px',
                                                          padding: '4px 8px',
                                                          fontSize: '7.5pt',
                                                          background: '#fee2e2',
                                                          color: '#dc2626',
                                                          borderTop: '1.2px solid #fca5a5',
                                                          fontWeight: 'bold'
                                                        }}>
                                                          <div style={{ textAlign: 'center' }}>{(totalShortage / 100).toFixed(2)}</div>
                                                          <div style={{ textAlign: 'center' }}>-</div>
                                                          <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                                            <span style={{ fontSize: '9pt' }}>⚠️</span> Shortage
                                                          </div>
                                                          <div style={{ textAlign: 'center' }}>-</div>
                                                          <div style={{ textAlign: 'center' }}>-</div>
                                                          <div style={{ textAlign: 'center' }}>{totalShortage.toFixed(1)}kg</div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </React.Fragment>
                                              );
                                            })}
                                          </>
                                        );
                                      })()}

                                      {/* Opening Stock */}
                                      {hasData && openingGroups[productType]?.length > 0 && (
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                          gap: '6px',
                                          padding: '2px 0',
                                          fontSize: '8pt',
                                          background: '#ffffff',
                                          marginBottom: '2px',
                                          borderRadius: '3px'
                                        }}>
                                          <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            {calculateGroupTotals(openingGroups[productType]).qtls.toFixed(2)}
                                          </div>
                                          <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            {calculateGroupTotals(openingGroups[productType]).bags}
                                          </div>
                                          <div style={{ fontWeight: 'bold' }}>Opening Stock</div>
                                          <div></div>
                                          <div></div>
                                          <div></div>
                                        </div>
                                      )}

                                      {/* Daily Movements - Exclude Palti (shown in box above) */}
                                      {hasData && (productionGroups[productType] || [])
                                        .filter((prod: any) => {
                                          // Filter out Palti and Shortage
                                          if (prod.movementType === 'palti' || prod.movementType === 'palti-shortage') return false;

                                          if (!debouncedSearch) return true;
                                          const searchLower = debouncedSearch.toLowerCase();
                                          return (
                                            (prod.variety && prod.variety.toLowerCase().includes(searchLower)) ||
                                            (prod.product && prod.product.toLowerCase().includes(searchLower)) ||
                                            (prod.locationCode && prod.locationCode.toLowerCase().includes(searchLower)) ||
                                            (prod.location && prod.location.toLowerCase().includes(searchLower)) ||
                                            (prod.billNumber && prod.billNumber.toLowerCase().includes(searchLower)) ||
                                            (prod.lorryNumber && prod.lorryNumber.toLowerCase().includes(searchLower)) ||
                                            (prod.broker && prod.broker.toLowerCase().includes(searchLower))
                                          );
                                        })
                                        .map((prod: any, idx: number) => {
                                          const getMovementColor = (movementType: string) => {
                                            switch (movementType?.toLowerCase()) {
                                              case 'production': return '#d4edda';
                                              case 'purchase': return '#cce5ff';
                                              case 'sale': return '#fee2e2';
                                              case 'palti': return '#e5ccff';
                                              default: return '#ffffff';
                                            }
                                          };

                                          return (
                                            <div key={`${productType.toLowerCase().replace(/\s+/g, '-')}-prod-${idx}`} style={{
                                              display: 'grid',
                                              gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                              gap: '6px',
                                              padding: '2px 0',
                                              fontSize: '8pt',
                                              background: getMovementColor(prod.movementType),
                                              marginBottom: '1px',
                                              borderRadius: '3px'
                                            }}>
                                              <div style={{ textAlign: 'center' }}>
                                                {Math.abs(Number(prod.qtls) || 0).toFixed(2)}
                                              </div>
                                              <div style={{ textAlign: 'center' }}>
                                                {prod.bags || 0}{prod.bagSizeKg ? `/${prod.bagSizeKg}kgs` : ''}
                                              </div>
                                              <div style={{ textAlign: 'center' }}>
                                                {String(prod.product || '')}
                                                {prod.outturn?.code && (
                                                  <span
                                                    style={{
                                                      color: '#7c3aed',
                                                      fontWeight: 'bold',
                                                      marginLeft: '4px',
                                                      cursor: 'pointer',
                                                      textDecoration: 'underline'
                                                    }}
                                                    onClick={() => navigateToOutturn(prod.outturn.code)}
                                                    title={`Click to view outturn ${prod.outturn.code}`}
                                                  >
                                                    → {prod.outturn.code}
                                                  </span>
                                                )}
                                              </div>
                                              <div style={{ textAlign: 'center' }}>
                                                <div>{String(prod.variety || 'Unknown')}</div>
                                                {prod.processType && (
                                                  <div style={{ fontSize: '7pt', color: '#666', fontStyle: 'italic' }}>
                                                    {prod.processType}
                                                  </div>
                                                )}
                                              </div>
                                              <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '8pt' }}>
                                                  {prod.movementType === 'palti' && prod.sourcePackaging ?
                                                    `${prod.sourcePackaging.brandName || 'A1'} → ${prod.targetPackaging?.brandName || 'A1'}` :
                                                    prod.packaging?.brandName || prod.packaging || 'A1'
                                                  }
                                                </div>
                                                {prod.movementType && (
                                                  <div style={{ fontSize: '7pt', color: '#666', fontStyle: 'italic' }}>
                                                    {prod.movementType}
                                                  </div>
                                                )}
                                              </div>
                                              <div style={{ textAlign: 'center' }}>
                                                <div>{prod.locationCode || prod.location || ''}</div>
                                                {prod.billNumber && (
                                                  <div style={{ fontSize: '7pt', color: '#666' }}>
                                                    {prod.billNumber}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}

                                      {/* Closing Stock */}
                                      {hasData && (
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                          gap: '6px',
                                          padding: '3px 0',
                                          fontSize: '8pt',
                                          background: '#e9ecef',
                                          marginTop: '2px',
                                          borderRadius: '3px',
                                          fontWeight: 'bold'
                                        }}>
                                          <div style={{ textAlign: 'center' }}>
                                            {(calculateGroupTotals(openingGroups[productType] || []).qtls + calculateGroupTotals(productionGroups[productType] || []).qtls).toFixed(2)}
                                          </div>
                                          <div style={{ textAlign: 'center' }}>
                                            {calculateGroupTotals(openingGroups[productType] || []).bags + calculateGroupTotals(productionGroups[productType] || []).bags}
                                          </div>
                                          <div>Closing Stock</div>
                                          <div></div>
                                          <div></div>
                                          <div></div>
                                        </div>
                                      )}

                                      {/* No data placeholder */}
                                      {!hasData && (
                                        <div style={{
                                          padding: '12px',
                                          textAlign: 'center',
                                          color: '#666',
                                          fontStyle: 'italic',
                                          fontSize: '8pt'
                                        }}>
                                          No data available
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bottom Row: Horizontal Product Types */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '8px'
                        }}>
                          {['Bran', 'RJ Rice (2)', 'Sizer Broken', 'Other'].map((productType) => {
                            const hasData = (openingGroups[productType]?.length > 0 || productionGroups[productType]?.length > 0);

                            return (
                              <div key={productType}>
                                <div style={{
                                  background: '#f8f9fa',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                  marginBottom: '20px'
                                }}>
                                  {/* Product Header */}
                                  <div style={{
                                    background: '#e9ecef',
                                    padding: '4px 8px',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    fontSize: '10pt',
                                    fontFamily: 'Calibri, Arial, sans-serif',
                                    color: '#495057'
                                  }}>
                                    {productType}
                                  </div>

                                  {/* Column Headers */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                    gap: '6px',
                                    padding: '3px 8px',
                                    background: '#f1f3f4',
                                    fontSize: '8pt',
                                    fontWeight: 'bold',
                                    color: '#5f6368'
                                  }}>
                                    <div style={{ textAlign: 'center' }}>Qtls</div>
                                    <div style={{ textAlign: 'center' }}>Bags</div>
                                    <div style={{ textAlign: 'center' }}>Product</div>
                                    <div style={{ textAlign: 'center' }}>Variety</div>
                                    <div style={{ textAlign: 'center' }}>Packaging</div>
                                    <div style={{ textAlign: 'center' }}>L</div>
                                  </div>

                                  {/* Content */}
                                  <div style={{ padding: '4px 8px' }}>
                                    {/* Yesterday's Bifurcation - WITH PALTI SPLITS INLINE */}
                                    {(() => {
                                      const bifurcationItems = dayData.yesterdayBifurcation?.filter(
                                        (item: any) => item.category === productType && item.movementType !== 'palti' && item.movementType !== 'palti-shortage'
                                      ) || [];

                                      if (bifurcationItems.length === 0) return null;

                                      // Get Palti items for splits
                                      const paltiItems = [
                                        ...(dayData.conversions?.filter((item: any) => item.category === productType) || []),
                                        ...(productionGroups[productType] || []).filter((item: any) => item.movementType === 'palti')
                                      ];

                                      // Map source key -> splits
                                      const paltiSplitsMap: { [key: string]: any[] } = {};
                                      paltiItems.forEach((palti: any) => {
                                        const sourceVariety = standardizeVariety(palti.variety || palti.sourceVariety);
                                        // SIMPLIFIED: variety-only key for robust matching
                                        const sourceKey = sourceVariety;

                                        if (!paltiSplitsMap[sourceKey]) paltiSplitsMap[sourceKey] = [];

                                        let targetPkg = palti.targetPackaging?.brandName || palti.target_packaging_brand || palti.target_packaging || palti.packaging?.brandName || palti.packaging || 'Unknown';
                                        if (typeof targetPkg === 'string' && targetPkg.includes('→')) {
                                          targetPkg = targetPkg.split('→').map((s: string) => s.trim())[1] || targetPkg.split('→')[0];
                                        }

                                        paltiSplitsMap[sourceKey].push({
                                          qtls: Math.abs(palti.qtls || 0),
                                          bags: palti.bags || 0,
                                          targetPackaging: targetPkg,
                                          targetBagSizeKg: palti.targetPackaging?.allottedKg || palti.target_packaging_kg || palti.bagSizeKg || 26,
                                          targetLocation: palti.toLocation || palti.location || 'Unknown',
                                          shortageKg: Number(palti.shortageKg || palti.conversionShortageKg || palti.conversion_shortage_kg || 0),
                                          variety: palti.variety || 'Unknown'
                                        });
                                      });

                                      return (
                                        <>
                                          <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#4b5563', padding: '2px 4px', marginBottom: '2px' }}>
                                            📋 Variety-wise Opening Stock
                                          </div>
                                          {bifurcationItems.map((item: any, idx: number) => {
                                            const itemVariety = standardizeVariety(item.variety);
                                            // SIMPLIFIED: Use variety only as key to match palti source key format
                                            const itemKey = itemVariety;


                                            const splits = paltiSplitsMap[itemKey] || [];
                                            const hasSplits = splits.length > 0;
                                            const totalShortage = splits.reduce((sum: number, s: any) => sum + (s.shortageKg || 0), 0);

                                            return (
                                              <React.Fragment key={`bifurcation-${productType}-${idx}`}>
                                                <div style={{
                                                  display: 'grid',
                                                  gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                                  gap: '6px',
                                                  padding: '2px 0',
                                                  fontSize: '8pt',
                                                  background: hasSplits ? '#fef3c7' : '#f8f9fa',
                                                  marginBottom: hasSplits ? '0' : '1px',
                                                  borderRadius: hasSplits ? '2px 2px 0 0' : '2px',
                                                  border: hasSplits ? '2px solid #f59e0b' : '1px solid #e9ecef',
                                                  borderBottom: hasSplits ? '1px dashed #f59e0b' : '1px solid #e9ecef'
                                                }}>
                                                  <div style={{ textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.qtls.toFixed(2)}</div>
                                                  <div style={{ textAlign: 'center' }}>{item.bags}{item.bagSizeKg ? `/${item.bagSizeKg}kgs` : ''}</div>
                                                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                    <div>
                                                      {item.product}
                                                      {item.outturn?.code && (
                                                        <span style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: '4px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigateToOutturn(item.outturn.code)}>→ {item.outturn.code}</span>
                                                      )}
                                                    </div>
                                                    {hasSplits && totalShortage > 0 && (
                                                      <div style={{
                                                        background: '#fee2e2',
                                                        color: '#dc2626',
                                                        fontSize: '6.5pt',
                                                        padding: '0px 3px',
                                                        borderRadius: '3px',
                                                        fontWeight: 'bold',
                                                        border: '1px solid #fca5a5'
                                                      }}>
                                                        S: {totalShortage.toFixed(1)}kg
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div style={{ textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.variety || 'Unknown'}</div>
                                                  <div style={{ textAlign: 'center' }}>{item.packaging}</div>
                                                  <div style={{ textAlign: 'center', fontWeight: hasSplits ? 'bold' : 'normal' }}>{item.location}</div>
                                                </div>

                                                {/* Palti Splits - Shown below the source entry with reference-accurate styling */}
                                                {hasSplits && (
                                                  <div style={{
                                                    border: '2px solid #f59e0b',
                                                    borderTop: 'none',
                                                    borderRadius: '0 0 4px 4px',
                                                    marginBottom: '4px',
                                                    overflow: 'hidden'
                                                  }}>
                                                    {splits.map((split: any, splitIdx: number) => (
                                                      <div key={`split-${splitIdx}`} style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                                        gap: '6px',
                                                        padding: '3px 8px',
                                                        fontSize: '7.5pt',
                                                        background: splitIdx % 2 === 0 ? '#fff7ed' : '#ffedd5',
                                                        color: '#7c2d12',
                                                        borderBottom: splitIdx < splits.length - 1 ? '1px solid #fed7aa' : 'none',
                                                        position: 'relative'
                                                      }}>
                                                        <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#ea580c' }}>
                                                          {split.qtls.toFixed(2)}
                                                        </div>
                                                        <div style={{ textAlign: 'center', color: '#9a3412' }}>
                                                          {split.bags}/{split.targetBagSizeKg}kg
                                                        </div>
                                                        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                                          <span style={{ color: '#f97316' }}>↳</span> Split
                                                        </div>
                                                        <div style={{ textAlign: 'center', fontWeight: '500', color: '#7c3aed' }}>{split.variety}</div>
                                                        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{split.targetPackaging}</div>
                                                        <div style={{ textAlign: 'center' }}>{split.targetLocation}</div>
                                                      </div>
                                                    ))}

                                                    {/* Total shortage row - Matching Red reference style */}
                                                    {totalShortage > 0 && (
                                                      <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                                        gap: '6px',
                                                        padding: '4px 8px',
                                                        fontSize: '7.5pt',
                                                        background: '#fee2e2',
                                                        color: '#dc2626',
                                                        borderTop: '1.2px solid #fca5a5',
                                                        fontWeight: 'bold'
                                                      }}>
                                                        <div style={{ textAlign: 'center' }}>{(totalShortage / 100).toFixed(2)}</div>
                                                        <div style={{ textAlign: 'center' }}>-</div>
                                                        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                                          <span style={{ fontSize: '9pt' }}>⚠️</span> Shortage
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>-</div>
                                                        <div style={{ textAlign: 'center' }}>-</div>
                                                        <div style={{ textAlign: 'center' }}>{totalShortage.toFixed(1)}kg</div>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </React.Fragment>
                                            );
                                          })}
                                        </>
                                      );
                                    })()}

                                    {/* Opening Stock */}
                                    {hasData && openingGroups[productType]?.length > 0 && (
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                        gap: '6px',
                                        padding: '2px 0',
                                        fontSize: '9pt',
                                        background: '#ffffff',
                                        marginBottom: '2px',
                                        borderRadius: '3px'
                                      }}>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                          {calculateGroupTotals(openingGroups[productType]).qtls.toFixed(2)}
                                        </div>
                                        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                          {calculateGroupTotals(openingGroups[productType]).bags}
                                        </div>
                                        <div style={{ fontWeight: 'bold', textAlign: 'center' }}>Opening Stock</div>
                                        <div></div>
                                        <div></div>
                                        <div></div>
                                      </div>
                                    )}

                                    {/* Daily Movements - Exclude Palti (Shown in dedicated box above) */}
                                    {hasData && (productionGroups[productType] || [])
                                      .filter((prod: any) => {
                                        // Filter out Palti and Shortage
                                        if (prod.movementType === 'palti' || prod.movementType === 'palti-shortage') return false;

                                        if (!debouncedSearch) return true;
                                        const searchLower = debouncedSearch.toLowerCase();
                                        return (
                                          (prod.variety && prod.variety.toLowerCase().includes(searchLower)) ||
                                          (prod.product && prod.product.toLowerCase().includes(searchLower)) ||
                                          (prod.locationCode && prod.locationCode.toLowerCase().includes(searchLower)) ||
                                          (prod.location && prod.location.toLowerCase().includes(searchLower)) ||
                                          (prod.billNumber && prod.billNumber.toLowerCase().includes(searchLower)) ||
                                          (prod.lorryNumber && prod.lorryNumber.toLowerCase().includes(searchLower)) ||
                                          (prod.broker && prod.broker.toLowerCase().includes(searchLower))
                                        );
                                      })
                                      .map((prod: any, idx: number) => {
                                        const getMovementColor = (movementType: string) => {
                                          switch (movementType?.toLowerCase()) {
                                            case 'production': return '#d4edda';
                                            case 'purchase': return '#cce5ff';
                                            case 'sale': return '#fee2e2';
                                            default: return '#ffffff';
                                          }
                                        };

                                        return (
                                          <div key={`${productType.toLowerCase().replace(/\s+/g, '-')}-prod-${idx}`} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                            gap: '6px',
                                            padding: '2px 0',
                                            fontSize: '8pt',
                                            background: getMovementColor(prod.movementType),
                                            marginBottom: '1px',
                                            borderRadius: '3px'
                                          }}>
                                            <div style={{ textAlign: 'center' }}>
                                              {Math.abs(Number(prod.qtls) || 0).toFixed(2)}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              {prod.bags || 0}{prod.bagSizeKg ? `/${prod.bagSizeKg}kgs` : ''}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              {String(prod.product || '')}
                                              {prod.outturn?.code && (
                                                <span style={{ color: '#7c3aed', fontWeight: 'bold', marginLeft: '4px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigateToOutturn(prod.outturn.code)}>→ {prod.outturn.code}</span>
                                              )}
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div>{String(prod.variety || 'Unknown')}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '8pt' }}>{prod.packaging?.brandName || prod.packaging || 'A1'}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div>{prod.locationCode || prod.location || ''}</div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                    {/* Closing Stock */}
                                    {hasData && (
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '50px 60px 1fr 100px 80px 50px',
                                        gap: '6px',
                                        padding: '3px 0',
                                        fontSize: '8pt',
                                        background: '#e9ecef',
                                        marginTop: '2px',
                                        borderRadius: '3px',
                                        fontWeight: 'bold'
                                      }}>
                                        <div style={{ textAlign: 'center' }}>
                                          {(calculateGroupTotals(openingGroups[productType] || []).qtls + calculateGroupTotals(productionGroups[productType] || []).qtls).toFixed(2)}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          {calculateGroupTotals(openingGroups[productType] || []).bags + calculateGroupTotals(productionGroups[productType] || []).bags}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>Closing Stock</div>
                                        <div></div>
                                        <div></div>
                                        <div></div>
                                      </div>
                                    )}

                                    {/* No data placeholder */}
                                    {!hasData && (
                                      <div style={{
                                        padding: '12px',
                                        textAlign: 'center',
                                        color: '#666',
                                        fontStyle: 'italic',
                                        fontSize: '8pt'
                                      }}>
                                        No data available
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );

          })()
          }

        </Container >
      ) : activeTab === 'outturn-report' ? (
        /* Outturn Report View - With Rice Production Entry Form */
        <div style={{ padding: '1rem' }}>
          {/* Outturn Selector */}
          <FormGroup style={{ marginBottom: '2rem' }}>
            <Label>Search Outturn</Label>
            <Input
              type="text"
              placeholder="Search by outturn number or variety..."
              value={outturnSearch}
              onChange={(e) => setOutturnSearch(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <Label>Select Outturn</Label>
            <Select
              value={selectedOutturnId || ''}
              onChange={(e) => setSelectedOutturnId(e.target.value)}
            >
              <option value="">-- Select Outturn --</option>
              {outturns
                .filter((outturn: any) => {
                  if (!outturnSearch) return true;
                  const searchLower = outturnSearch.toLowerCase();
                  const outturnCode = outturn.outturnNumber || outturn.code || '';
                  return (
                    outturnCode.toLowerCase().includes(searchLower) ||
                    outturn.allottedVariety?.toLowerCase().includes(searchLower)
                  );
                })
                .map((outturn: any) => (
                  <option key={outturn.id} value={outturn.id}>
                    {outturn.outturnNumber || outturn.code} - {outturn.allottedVariety}
                  </option>
                ))}
            </Select>

          </FormGroup>

          {selectedOutturnId && (
            <div>
              {/* Outturn Details Header */}
              <div style={{
                backgroundColor: '#f3f4f6',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                gap: '2rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <strong>Outturn Code:</strong> {outturns.find((o: any) => o.id === parseInt(selectedOutturnId))?.outturnNumber || outturns.find((o: any) => o.id === parseInt(selectedOutturnId))?.code}
                </div>
                <div>
                  <strong>Variety:</strong> {outturns.find((o: any) => o.id === parseInt(selectedOutturnId))?.allottedVariety}
                </div>
                <div>
                  <strong>Type:</strong> {outturns.find((o: any) => o.id === parseInt(selectedOutturnId))?.type || 'Raw'}
                </div>
                {/* PDF Download Button */}
                <div style={{ marginLeft: 'auto' }}>
                  <Button
                    onClick={() => {
                      const selectedOutturn = outturns.find((o: any) => o.id === parseInt(selectedOutturnId));
                      if (!selectedOutturn) {
                        toast.error('Please select an outturn first');
                        return;
                      }
                      try {
                        // Get production records for this outturn
                        const outturnProductions = productionRecords.filter((pr: any) =>
                          pr.outturn?.id === parseInt(selectedOutturnId) ||
                          pr.outturnId === parseInt(selectedOutturnId)
                        );
                        // Get by-products data - use existing byProducts variable
                        const byProductsList = byProducts;
                        generateOutturnReportPDF(
                          selectedOutturn,
                          outturnProductions,
                          byProductsList,
                          { title: `Outturn Report - ${selectedOutturn?.code || selectedOutturn?.outturnNumber}` }
                        );
                        toast.success('PDF generated successfully!');
                      } catch (error) {
                        console.error('PDF generation error:', error);
                        toast.error('Failed to generate PDF');
                      }
                    }}
                    style={{
                      backgroundColor: '#dc2626',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    📥 Download PDF
                  </Button>
                </div>
              </div>

              {/* Available Bags Display */}
              <div style={{
                backgroundColor: availableBags > 0 ? '#dcfce7' : '#fee2e2',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                color: availableBags > 0 ? '#16a34a' : '#dc2626'
              }}>
                Available Bags for Production: {availableBags} bags
              </div>

              {/* Cleared Outturn Message */}
              {isOutturnCleared && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fee2e2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: '#991b1b'
                }}>
                  ✅ This outturn has been cleared and closed. No more production entries can be added.
                </div>
              )}

              {/* Clear Outturn - Only for Admin and Manager */}
              {(user?.role === 'admin' || user?.role === 'manager') && availableBags > 0 && !isOutturnCleared && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  backgroundColor: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    marginBottom: '0.75rem',
                    fontWeight: 'bold',
                    color: '#92400e',
                    textAlign: 'center',
                    fontSize: '1.1rem'
                  }}>
                    ⚠️ Outturn Completion
                  </div>
                  <div style={{
                    marginBottom: '0.75rem',
                    textAlign: 'center',
                    color: '#78350f'
                  }}>
                    Remaining Bags: <strong>{availableBags} bags</strong>
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#78350f',
                    marginBottom: '0.75rem',
                    textAlign: 'center'
                  }}>
                    These bags represent waste/loss in production. Clearing will mark outturn as complete.
                  </div>
                  <Button
                    onClick={() => {
                      setClearOutturnDate(new Date().toISOString().split('T')[0]);
                      setShowClearOutturnDialog(true);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Outturn
                  </Button>
                </div>
              )}

              {/* TOP: Rice Production Entry Form - Horizontal Layout */}
              <div style={{
                backgroundColor: '#FFF7ED',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '2rem',
                border: '2px solid #FB923C'
              }}>
                <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#EA580C', fontWeight: 'bold' }}>
                  📝 Rice Production Data Entry
                </h3>

                {/* Horizontal Form Grid - Row 1 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <FormGroup>
                    <Label>Date *</Label>
                    <Input
                      type="text"
                      value={productionDateInput}
                      onChange={(e) => {
                        let value = e.target.value.replace(/[^\d-]/g, '');
                        const parts = value.split('-');
                        if (parts.length > 3) {
                          value = parts.slice(0, 3).join('-');
                        }
                        let formatted = value.replace(/-/g, '');
                        if (formatted.length >= 2) {
                          formatted = formatted.slice(0, 2) + '-' + formatted.slice(2);
                        }
                        if (formatted.length >= 5) {
                          formatted = formatted.slice(0, 5) + '-' + formatted.slice(5);
                        }
                        if (formatted.length > 10) {
                          formatted = formatted.slice(0, 10);
                        }
                        setProductionDateInput(formatted);
                        if (formatted.length === 10) {
                          const [day, month, year] = formatted.split('-').map(Number);
                          console.log('Date parts:', { day, month, year });
                          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                            // Use UTC to avoid timezone issues
                            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            console.log('Converted date (YYYY-MM-DD):', dateStr);
                            setProductionDate(dateStr);
                          } else {
                            console.log('Date validation failed:', { day, month, year });
                          }
                        }
                      }}
                      placeholder="DD-MM-YYYY"
                      maxLength={10}
                    />
                    <InfoText>Format: DD-MM-YYYY (e.g., 05-11-2025)</InfoText>
                  </FormGroup>

                  <FormGroup>
                    <Label>Select Product *</Label>
                    <Select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                    >
                      <option value="">-- SELECT PRODUCT --</option>
                      <option value="Rice">RICE</option>
                      <option value="Sizer Broken">SIZER BROKEN</option>
                      <option value="RJ Rice 1">RJ RICE 1</option>
                      <option value="RJ Rice 2">RJ RICE 2</option>
                      <option value="Broken">BROKEN</option>
                      <option value="RJ Broken">RJ BROKEN</option>
                      <option value="Zero Broken">ZERO BROKEN</option>
                      <option value="Faram">FARAM</option>
                      <option value="Bran">BRAN</option>
                      <option value="Unpolished">UNPOLISHED</option>
                    </Select>
                  </FormGroup>

                  <FormGroup>
                    <Label>Number of Bags *</Label>
                    <Input
                      type="number"
                      step="1"
                      value={bags}
                      onChange={(e) => setBags(e.target.value)}
                      placeholder="0"
                    />
                  </FormGroup>

                  <FormGroup>
                    <Label>Packaging *</Label>
                    <Select
                      value={packagingId}
                      onChange={(e) => setPackagingId(e.target.value)}
                    >
                      <option value="">-- SELECT PACKAGING --</option>
                      {packagings.map((pkg: any) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.brandName?.toUpperCase() || 'N/A'} ({pkg.allottedKg} KG/BAG)
                        </option>
                      ))}
                    </Select>
                  </FormGroup>
                </div>

                {/* Calculation Summary Box */}
                {quantityQuintals > 0 && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '2px solid #86efac',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ marginBottom: '0.75rem', fontWeight: 'bold', color: '#1f2937', fontSize: '0.95rem' }}>
                      📊 CALCULATION SUMMARY
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr auto 1fr',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      background: 'white',
                      borderRadius: '6px',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>BAGS</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>{bags}</div>
                      </div>

                      <div style={{ fontSize: '1.25rem', color: '#6b7280' }}>×</div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>PACKAGING (KG)</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                          {packagings.find((p: any) => p.id === parseInt(packagingId))?.allottedKg || 0}
                        </div>
                      </div>

                      <div style={{ fontSize: '1.25rem', color: '#6b7280' }}>=</div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>QUINTALS</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                          {(quantityQuintals || 0).toFixed(2)} Q
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderTop: '1px solid #e5e7eb',
                      color: '#166534',
                      fontWeight: 500,
                      fontSize: '0.9rem'
                    }}>
                      <span>🌾 PADDY BAGS DEDUCTED:</span>
                      <span style={{ fontWeight: 'bold' }}>{paddyBagsDeducted} BAGS</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      color: '#166534',
                      fontWeight: 500,
                      fontSize: '0.9rem'
                    }}>
                      <span>📦 TOTAL WEIGHT:</span>
                      <span style={{ fontWeight: 'bold' }}>{((quantityQuintals || 0) * 100).toFixed(2)} KG</span>
                    </div>
                  </div>
                )}

                {/* Horizontal Form Grid - Row 2 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>

                  <FormGroup>
                    <Label>Type of Movement *</Label>
                    <Select
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value as 'kunchinittu' | 'loading')}
                    >
                      <option value="kunchinittu">KUNCHINITTU</option>
                      <option value="loading">LOADING</option>
                    </Select>
                  </FormGroup>

                  {movementType === 'kunchinittu' ? (
                    <FormGroup style={{ gridColumn: 'span 2' }}>
                      <Label>Location Code *</Label>
                      <Select
                        value={locationCode}
                        onChange={(e) => setLocationCode(e.target.value)}
                      >
                        <option value="">-- SELECT LOCATION --</option>
                        {riceStockLocations.map((loc: any) => (
                          <option key={loc.id} value={loc.code}>
                            {loc.code} {loc.name ? `- ${loc.name}` : ''}
                          </option>
                        ))}
                      </Select>
                    </FormGroup>
                  ) : (
                    <>
                      <FormGroup>
                        <Label>Lorry Number *</Label>
                        <Input
                          type="text"
                          value={lorryNumber}
                          onChange={(e) => setLorryNumber(e.target.value)}
                          placeholder="Enter lorry number"
                        />
                      </FormGroup>

                      <FormGroup>
                        <Label>Bill Number *</Label>
                        <Input
                          type="text"
                          value={billNumber}
                          onChange={(e) => setBillNumber(e.target.value)}
                          placeholder="Enter bill number"
                        />
                      </FormGroup>
                    </>
                  )}
                </div>

                <Button className="success" onClick={handleRiceProductionSubmit} disabled={isSubmittingRiceProduction} style={{ width: '100%', padding: '0.875rem', fontSize: '1.05rem' }}>
                  {isSubmittingRiceProduction ? '⏳ Saving...' : '💾 Save Entry'}
                </Button>
              </div>

              {/* BELOW: Two Column Layout - Table Left, Summary Right */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem' }}>
                {/* LEFT: Excel-style By-Products Table */}
                <div>
                  <h3 style={{ marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>By-Products Record</h3>

                  {/* By-Products Table with exact Excel format + Unpolished */}
                  <ExcelTable style={{ border: '1px solid #5B9BD5', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#2E75B6', color: 'white', fontWeight: 'bold' }}>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Rice</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Sizer Broken</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>RJ Rice 1</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>RJ Rice 2</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Broken</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>RJ Broken</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Zero Broken</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Faram</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Bran</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Unpolished</th>
                        <th style={{ border: '1px solid #5B9BD5', padding: '10px 12px', fontSize: '11pt', textAlign: 'center', minWidth: '100px', whiteSpace: 'nowrap' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byProducts.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', border: '1px solid #9BC2E6' }}>
                            No by-products recorded yet
                          </td>
                        </tr>
                      ) : (
                        <>
                          {byProducts
                            // Filter out rows where ALL values are 0 (empty rows)
                            .filter((bp: any) => {
                              const hasValue =
                                (bp.rice && bp.rice > 0) ||
                                (bp.rejectionRice && bp.rejectionRice > 0) ||
                                (bp.rjRice1 && bp.rjRice1 > 0) ||
                                (bp.rjRice2 && bp.rjRice2 > 0) ||
                                (bp.broken && bp.broken > 0) ||
                                (bp.rejectionBroken && bp.rejectionBroken > 0) ||
                                (bp.zeroBroken && bp.zeroBroken > 0) ||
                                (bp.faram && bp.faram > 0) ||
                                (bp.bran && bp.bran > 0) ||
                                (bp.unpolished && bp.unpolished > 0);
                              return hasValue;
                            })
                            .map((bp: any, idx: number) => (
                              <tr key={bp.id} style={{ backgroundColor: idx % 2 === 0 ? '#BDD7EE' : 'white' }}>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.rice > 0 ? bp.rice : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.rejectionRice > 0 ? bp.rejectionRice : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.rjRice1 > 0 ? bp.rjRice1 : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.rjRice2 > 0 ? bp.rjRice2 : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.broken > 0 ? bp.broken : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.rejectionBroken > 0 ? bp.rejectionBroken : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.zeroBroken > 0 ? bp.zeroBroken : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.faram > 0 ? bp.faram : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.bran > 0 ? bp.bran : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {bp.unpolished > 0 ? bp.unpolished : '-'}
                                </td>
                                <td style={{ border: '1px solid #9BC2E6', padding: '8px 12px', textAlign: 'center', fontSize: '10pt' }}>
                                  {new Date(bp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </td>
                              </tr>
                            ))}

                          {/* Totals Row */}
                          <tr style={{ backgroundColor: '#BDD7EE', fontWeight: 'bold' }}>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rice || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rejectionRice || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rjRice1 || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rjRice2 || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.broken || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rejectionBroken || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.zeroBroken || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.faram || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.bran || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px', textAlign: 'center', fontSize: '10.5pt', fontWeight: 'bold' }}>
                              {byProducts.reduce((sum: number, bp: any) => sum + Number(bp.unpolished || 0), 0).toFixed(2)}
                            </td>
                            <td style={{ border: '1px solid #2E75B6', padding: '10px 12px' }}></td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </ExcelTable>
                </div>

                {/* RIGHT: Yielding Rice Summary - Smaller and on the right */}
                <div>
                  {byProducts.length > 0 && productionRecords.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        margin: '0',
                        border: '1px solid #9BC2E6',
                        fontSize: '8pt'
                      }}>
                        <tbody>
                          {/* Yielding Rice Calculations */}
                          {(() => {
                            const totalPaddyWeight = productionRecords.reduce((sum: number, rec: any) =>
                              sum + Number(rec.netWeight || 0), 0
                            );

                            const totalByProducts = byProducts.reduce((sum: number, bp: any) =>
                              sum + Number(bp.rice || 0) + Number(bp.rejectionRice || 0) + Number(bp.rjRice1 || 0) + Number(bp.rjRice2 || 0) +
                              Number(bp.broken || 0) + Number(bp.rejectionBroken || 0) +
                              Number(bp.zeroBroken || 0) + Number(bp.faram || 0) + Number(bp.bran || 0) + Number(bp.unpolished || 0), 0
                            );

                            const entries = [
                              {
                                label: 'Rice',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rice || 0), 0)
                              },
                              {
                                label: 'Sizer Broken',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rejectionRice || 0), 0)
                              },
                              {
                                label: 'RJ Rice 1',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rjRice1 || 0), 0)
                              },
                              {
                                label: 'RJ Rice 2',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rjRice2 || 0), 0)
                              },
                              {
                                label: 'Broken',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.broken || 0), 0)
                              },
                              {
                                label: 'RJ Broken',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.rejectionBroken || 0), 0)
                              },
                              {
                                label: 'Zero broken',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.zeroBroken || 0), 0)
                              },
                              {
                                label: 'Faram',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.faram || 0), 0)
                              },
                              {
                                label: 'Bran',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.bran || 0), 0)
                              },
                              {
                                label: 'Unpolished',
                                value: byProducts.reduce((sum: number, bp: any) => sum + Number(bp.unpolished || 0), 0)
                              }
                            ];

                            return entries.map((entry, idx) => (
                              <tr key={idx}>
                                <td style={{
                                  border: '1px solid #9BC2E6',
                                  padding: '2px 4px',
                                  textAlign: 'center',
                                  fontSize: '8pt',
                                  fontWeight: '500'
                                }}>
                                  {entry.value > 0 ? entry.value.toFixed(2) : '-'}
                                </td>
                                <td style={{
                                  border: '1px solid #9BC2E6',
                                  padding: '2px 4px',
                                  textAlign: 'left',
                                  fontSize: '8pt'
                                }}>
                                  {entry.label}
                                </td>
                                <td style={{
                                  border: '1px solid #9BC2E6',
                                  padding: '2px 4px',
                                  textAlign: 'center',
                                  fontSize: '8pt',
                                  fontWeight: '500'
                                }}>
                                  {entry.value > 0 && totalPaddyWeight > 0
                                    ? ((entry.value / totalPaddyWeight) * 100).toFixed(2)
                                    : '0.00'
                                  }
                                </td>
                              </tr>
                            ));
                          })()}

                          {/* Total BY Products Weight */}
                          <tr style={{ fontWeight: 'bold' }}>
                            <td style={{
                              border: '1px solid #2E75B6',
                              padding: '3px 5px',
                              textAlign: 'center',
                              fontSize: '8pt',
                              fontWeight: 'bold'
                            }}>
                              {byProducts.reduce((sum: number, bp: any) =>
                                sum + Number(bp.rice || 0) + Number(bp.rejectionRice || 0) + Number(bp.rjRice1 || 0) + Number(bp.rjRice2 || 0) +
                                Number(bp.broken || 0) + Number(bp.rejectionBroken || 0) +
                                Number(bp.zeroBroken || 0) + Number(bp.faram || 0) + Number(bp.bran || 0) + Number(bp.unpolished || 0), 0
                              ).toFixed(2)} Q
                            </td>
                            <td style={{
                              border: '1px solid #2E75B6',
                              padding: '3px 5px',
                              textAlign: 'left',
                              fontSize: '8pt',
                              fontWeight: 'bold'
                            }}>
                              Total BY Products
                            </td>
                            <td style={{
                              border: '1px solid #2E75B6',
                              padding: '3px 5px',
                              textAlign: 'center',
                              fontSize: '8pt',
                              fontWeight: 'bold',
                              backgroundColor: '#70AD47',
                              color: 'white'
                            }}>
                              {(() => {
                                // Net Weight is in KG, convert to Quintals by dividing by 100 (1 Quintal = 100 KG)
                                const totalPaddyWeightKG = productionRecords.reduce((sum: number, rec: any) =>
                                  sum + Number(rec.netWeight || 0), 0
                                );
                                const totalPaddyWeightQuintals = totalPaddyWeightKG / 100;

                                // Total produced quintals from by-products (including RJ Rice 1 and RJ Rice 2)
                                const totalByProductsQuintals = byProducts.reduce((sum: number, bp: any) =>
                                  sum + Number(bp.rice || 0) + Number(bp.rejectionRice || 0) + Number(bp.rjRice1 || 0) + Number(bp.rjRice2 || 0) +
                                  Number(bp.broken || 0) + Number(bp.rejectionBroken || 0) +
                                  Number(bp.zeroBroken || 0) + Number(bp.faram || 0) + Number(bp.bran || 0) + Number(bp.unpolished || 0), 0
                                );

                                // Yield % = (Produced Quintals / Paddy Quintals) * 100
                                return totalPaddyWeightQuintals > 0
                                  ? ((totalByProductsQuintals / totalPaddyWeightQuintals) * 100).toFixed(2)
                                  : '0.00';
                              })()} %
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* LEFT: Production Shifting Records - Below By-Products Table */}
                <div>
                  <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontWeight: 'bold' }}>Production Shifting Records</h3>
                  {productionRecords.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#6b7280' }}>No production records found</p>
                  ) : (
                    <ExcelTable>
                      <thead>
                        <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                          <th>Sl No</th>
                          <th>Date</th>
                          <th>Type of Movement</th>
                          <th>Broker</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Variety</th>
                          <th>Bags</th>
                          <th>Moisture</th>
                          <th>Cutting</th>
                          <th>Wb No</th>
                          <th>Net Weight</th>
                          <th>Lorry No</th>
                          <th>Rate/Q</th>
                          <th>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionRecords.map((record: any, idx: number) => {
                          const isForProduction = record.movementType === 'purchase' && record.outturnId;
                          return (
                            <tr key={record.id} style={{ backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white' }}>
                              <td>{idx + 1}</td>
                              <td>{new Date(record.date).toLocaleDateString('en-GB')}</td>
                              <td>{isForProduction ? 'For Production' : 'Production Shifting'}</td>
                              <td>{record.broker || '-'}</td>
                              <td>{isForProduction ? (record.fromLocation || 'Direct') : `${record.fromKunchinittu?.code || ''} - ${record.fromWarehouse?.name || ''}`}</td>
                              <td>{isForProduction ? '-' : `${record.toKunchinittu?.code || ''} - ${record.toWarehouseShift?.name || ''}`}</td>
                              <VarietyCell hasLocation={!!(record.variety && (record.fromKunchinittu || isForProduction))}>
                                {record.variety || '-'}
                              </VarietyCell>
                              <td>{record.bags || 0}</td>
                              <td>{record.moisture || '-'}</td>
                              <td>{record.cutting || '-'}</td>
                              <td>{record.wbNo || '-'}</td>
                              <td>{isNaN(Number(record.netWeight)) ? '0.00' : Number(record.netWeight || 0).toFixed(2)}</td>
                              <td>{record.lorryNumber || '-'}</td>
                              <td>
                                {/* For Production purchases: show purchase rate */}
                                {/* Production-shifting: show snapshot rate (or outturn rate as fallback) */}
                                {record.purchaseRate
                                  ? `₹${parseFloat(record.purchaseRate.averageRate).toFixed(2)}`
                                  : record.snapshotRate
                                    ? `₹${parseFloat(record.snapshotRate).toFixed(2)}`
                                    : record.outturn?.averageRate
                                      ? `₹${parseFloat(record.outturn.averageRate).toFixed(2)}`
                                      : '-'
                                }
                              </td>
                              <td>
                                {/* Only show total amount for "For Production" purchases with purchase rate */}
                                {record.purchaseRate
                                  ? `₹${parseFloat(record.purchaseRate.totalAmount).toFixed(2)}`
                                  : '-'
                                }
                              </td>
                            </tr>
                          );
                        })}
                        {/* Total Net Weight and Amount Row */}
                        <tr style={{ backgroundColor: '#4a90e2', color: 'white', fontWeight: 'bold' }}>
                          <td colSpan={11} style={{ textAlign: 'right', padding: '10px' }}>Total:</td>
                          <td style={{ textAlign: 'center', padding: '10px' }}>
                            {productionRecords.reduce((sum: number, rec: any) =>
                              sum + Number(rec.netWeight || 0), 0
                            ).toFixed(2)} kg
                          </td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'center', padding: '10px' }}>
                            ₹{productionRecords.reduce((sum: number, rec: any) => {
                              // Only sum "For Production" purchase amounts, not production-shifting
                              if (rec.purchaseRate?.totalAmount) {
                                return sum + Number(rec.purchaseRate.totalAmount);
                              }
                              return sum;
                            }, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </ExcelTable>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'stock' ? (
        /* Paddy Stock View - Full width layout */
        /* FIX: Show stock view if we have historicalOpeningBalance even when no transactions */
        Object.keys(records).length === 0 && !(dateFrom && historicalOpeningBalance) ? (
          <EmptyState>
            <p>📭 No stock records found</p>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Records must be approved by admin to appear in paddy stock</p>
          </EmptyState>
        ) : (
          <div style={{ width: '100%' }}>
            {/* Date-wise stock with variety summary on right */}
            <RecordsContainer>
              {(() => {
                // Merge dates from records (Arrivals) and rice productions
                const recordDates = Object.keys(records);
                const riceProductionDates = allRiceProductions.map((rp: any) => rp.date);
                let allUniqueDates = Array.from(new Set([...recordDates, ...riceProductionDates])).sort();

                // Generate ALL dates in range (including no-transaction days)
                // ALWAYS generate full date range from min to max date in data
                let startDateStr = '';
                let endDateStr = '';

                // OPTIMIZED: Combined date range detection for Paddy Stock
                if (dateFrom || dateTo || selectedMonth) {
                  // Initialize with "everlasting" bounds if partially provided
                  let rangeStart = dateFrom ? convertDateFormat(dateFrom) : '1970-01-01';
                  let rangeEnd = dateTo ? convertDateFormat(dateTo) : '2099-12-31';

                  // Intersect with Month filter if present
                  if (selectedMonth) {
                    const [year, monthNum] = selectedMonth.split('-');
                    const monthStart = `${year}-${monthNum.padStart(2, '0')}-01`;
                    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
                    const monthEnd = `${year}-${monthNum.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

                    // Take the most restrictive bounds (Intersection)
                    rangeStart = rangeStart > monthStart ? rangeStart : monthStart;
                    rangeEnd = rangeEnd < monthEnd ? rangeEnd : monthEnd;
                  }

                  startDateStr = rangeStart;
                  endDateStr = rangeEnd;
                } else if (!showAllRecords) {
                  // Default behavior: Show today only (Business Date)
                  const today = getBusinessDate();
                  startDateStr = today;
                  endDateStr = today;
                } else if (allUniqueDates.length > 0) {
                  // "Show All" is active: use data bounds
                  startDateStr = allUniqueDates[0];
                  endDateStr = allUniqueDates[allUniqueDates.length - 1];
                }

                // ALWAYS generate full date range (even without user selection)
                if (startDateStr && endDateStr) {
                  const startDate = new Date(startDateStr + 'T00:00:00');
                  const endDate = new Date(endDateStr + 'T00:00:00');
                  const allDatesInRange: string[] = [];
                  const currentDate = new Date(startDate);

                  while (currentDate <= endDate) {
                    const year = currentDate.getFullYear();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    allDatesInRange.push(dateStr);
                    currentDate.setDate(currentDate.getDate() + 1);
                  }

                  allUniqueDates = allDatesInRange;
                }


                // ═══════════════════════════════════════════════════════════════════════════
                // FIX: PRE-COMPUTE ALL STOCK IN CHRONOLOGICAL ORDER
                // This ensures closing stock properly becomes next day's opening stock
                // ═══════════════════════════════════════════════════════════════════════════

                // Keep dates in chronological order for calculation
                const datesChronological = [...allUniqueDates]; // Already sorted oldest first

                // Helper to normalize keys (pipe separator and TRIM/UPPERCASE)
                const normalizeKeyFn = (key: string, variety: string): string => {
                  const normalizedVariety = (variety || '').trim().toUpperCase();
                  if (key.includes('|')) {
                    const parts = key.split('|');
                    const locationOrOutturn = parts[parts.length - 1];
                    return `${normalizedVariety}|${locationOrOutturn}`;
                  }

                  if (key.startsWith(variety + '-')) {
                    // variety-loc -> VARIETY|loc
                    return normalizedVariety + '|' + key.substring(variety.length + 1);
                  }
                  const firstHyphenIndex = key.indexOf('-');
                  if (firstHyphenIndex > 0) {
                    // some-variety-loc -> SOME VARIETY|loc
                    return normalizedVariety + '|' + key.substring(firstHyphenIndex + 1);
                  }
                  return normalizedVariety + '|' + key;
                };

                // Helper to find outturn key
                const findOutturnKey = (stockMap: any, outturnCode: string): string | null => {
                  for (const key of Object.keys(stockMap)) {
                    const item = stockMap[key];
                    if (item.outturn === outturnCode) return key;
                    if (key.endsWith('|' + outturnCode) || key.endsWith('-' + outturnCode)) return key;
                    let keyOutturn = '';
                    if (key.includes('|')) {
                      const parts = key.split('|');
                      keyOutturn = parts[parts.length - 1];
                    } else if (key.includes('-')) {
                      const firstHyphen = key.indexOf('-');
                      keyOutturn = key.substring(firstHyphen + 1);
                    }
                    if (keyOutturn === outturnCode) return key;
                  }
                  return null;
                };

                // Helper to update stock safely (now allows negative)
                const safeUpdateStock = (stockMap: any, key: string, bags: number, metadata: any): boolean => {
                  if (!stockMap[key]) {
                    stockMap[key] = { ...metadata, bags: 0 };
                  }
                  const newValue = stockMap[key].bags + bags;
                  stockMap[key].bags = newValue;
                  return true;
                };

                // Deep copy helper
                const deepCopy = (obj: any): any => {
                  const copy: any = {};
                  Object.entries(obj).forEach(([k, v]: [string, any]) => {
                    copy[k] = { ...v };
                  });
                  return copy;
                };

                // Store pre-computed stock for each date
                interface StockData {
                  openingWarehouse: { [key: string]: { bags: number; variety: string; location: string } };
                  openingProduction: { [key: string]: { bags: number; variety: string; outturn: string; kunchinittu: string } };
                  closingWarehouse: { [key: string]: { bags: number; variety: string; location: string } };
                  closingProduction: { [key: string]: { bags: number; variety: string; outturn: string; kunchinittu: string } };
                }
                const preComputedStock = new Map<string, StockData>();

                // Initialize running stock (will become next day's opening)
                let runningWarehouse: { [key: string]: { bags: number; variety: string; location: string } } = {};
                let runningProduction: { [key: string]: { bags: number; variety: string; outturn: string; kunchinittu: string } } = {};

                // Pre-populate from historical balance if any filter is applied
                if (historicalOpeningBalance && (dateFrom || selectedMonth)) {
                  Object.entries(historicalOpeningBalance.warehouseBalance).forEach(([key, value]) => {
                    const nVariety = (value.variety || '').trim().toUpperCase();
                    const nKey = normalizeKeyFn(key, nVariety);
                    runningWarehouse[nKey] = { bags: value.bags, variety: nVariety, location: value.location };
                  });
                  Object.entries(historicalOpeningBalance.productionBalance).forEach(([key, value]) => {
                    const nVariety = (value.variety || '').trim().toUpperCase();
                    const nKey = normalizeKeyFn(key, nVariety);
                    runningProduction[nKey] = { bags: value.bags, variety: nVariety, outturn: value.outturn, kunchinittu: '' };
                  });
                  console.log('📊 Pre-compute: Initialized from historical balance', Object.keys(runningWarehouse).length, 'warehouse,', Object.keys(runningProduction).length, 'production');
                }

                // Process each date in CHRONOLOGICAL order (oldest first)
                datesChronological.forEach((d) => {
                  // Opening = previous day's closing (from running variables)
                  const openingWarehouse = deepCopy(runningWarehouse);
                  const openingProduction = deepCopy(runningProduction);

                  // Closing starts as copy of opening
                  const closingWarehouse = deepCopy(openingWarehouse);
                  const closingProduction = deepCopy(openingProduction);

                  // Get today's arrivals and rice productions
                  const dayRecords = records[d] || [];
                  const dayRiceProds = allRiceProductions.filter((rp: any) => rp.date === d);

                  // Apply arrivals to closing stock
                  dayRecords.forEach((rec: Arrival) => {
                    const variety = (rec.variety || 'Unknown').trim().toUpperCase();

                    if (rec.movementType === 'purchase') {
                      if (!rec.outturnId) {
                        // NORMAL PURCHASE (no outturn - goes to warehouse)
                        const location = `${rec.toKunchinittu?.code || ''} - ${rec.toWarehouse?.name || ''}`;
                        const key = `${variety}|${location}`;
                        safeUpdateStock(closingWarehouse, key, rec.bags || 0, { variety, location });
                        console.log(`  🟢 [${d}] PURCHASE: +${rec.bags} ${variety} → Warehouse (${location})`);
                      } else {
                        // FOR-PRODUCTION PURCHASE (has outturn - goes directly to production)
                        const outturn = rec.outturn?.code || `OUT${rec.outturnId}`;
                        const key = `${variety}|${outturn}`;
                        safeUpdateStock(closingProduction, key, rec.bags || 0, { variety, outturn, kunchinittu: rec.fromKunchinittu?.code || 'Direct' });
                        console.log(`  🟠 [${d}] FOR-PROD PURCHASE: +${rec.bags} ${variety} → Production (${outturn})`);
                      }
                    } else if (rec.movementType === 'shifting') {
                      const fromLoc = `${rec.fromKunchinittu?.code || ''} - ${rec.fromWarehouse?.name || ''}`;
                      const toLoc = `${rec.toKunchinittu?.code || ''} - ${rec.toWarehouseShift?.name || ''}`;
                      const fromKey = `${variety}|${fromLoc}`;
                      const toKey = `${variety}|${toLoc}`;
                      const requestedBags = rec.bags || 0;
                      // ALLOW FULL SHIFT: Removing availableAtSource check to prevent "losing" bags in outturns
                      const bagsToMove = requestedBags;
                      safeUpdateStock(closingWarehouse, fromKey, -bagsToMove, { variety, location: fromLoc });
                      safeUpdateStock(closingWarehouse, toKey, bagsToMove, { variety, location: toLoc });
                      console.log(`  🔵 [${d}] SHIFTING: ${bagsToMove} ${variety} from ${fromLoc} → ${toLoc}`);
                    } else if (rec.movementType === 'production-shifting') {
                      const fromLoc = `${rec.fromKunchinittu?.code || ''} - ${rec.fromWarehouse?.name || ''}`;
                      const fromKey = `${variety}|${fromLoc}`;
                      const outturn = rec.outturn?.code || '';
                      const prodKey = `${variety}|${outturn}`;
                      const requestedBags = rec.bags || 0;
                      // ALLOW FULL SHIFT: Removing availableAtSource check to prevent "losing" bags in outturns
                      const bagsToMove = requestedBags;
                      safeUpdateStock(closingWarehouse, fromKey, -bagsToMove, { variety, location: fromLoc });
                      safeUpdateStock(closingProduction, prodKey, bagsToMove, { variety, outturn, kunchinittu: rec.fromKunchinittu?.code || '' });
                      console.log(`  🟡 [${d}] PROD-SHIFTING: ${bagsToMove} ${variety} from Warehouse(${fromLoc}) → Production(${outturn})`);
                    } else if (rec.movementType === 'loose') {
                      // LOOSE ENTRY - Add bags to warehouse (inward like purchase)
                      const location = `${rec.toKunchinittu?.code || ''} - ${rec.toWarehouse?.name || ''}`;
                      const key = `${variety}|${location}`;
                      safeUpdateStock(closingWarehouse, key, rec.bags || 0, { variety, location });
                      console.log(`  🟤 [${d}] LOOSE: +${rec.bags} ${variety} → Warehouse (${location})`);
                    } else {
                      console.log(`  ⚪ [${d}] UNKNOWN: ${rec.movementType} - ${rec.bags} ${variety}`);
                    }
                  });

                  // Subtract rice production from production stock
                  dayRiceProds.forEach((rp: any) => {
                    const outturnCode = rp.outturn?.code || '';
                    if (!outturnCode) {
                      console.log(`  ⚪ [${d}] RICE-PROD (NO OUTTURN CODE): ${rp.quantityQuintals}Q`);
                      return;
                    }
                    const matchedKey = findOutturnKey(closingProduction, outturnCode);
                    if (matchedKey && closingProduction[matchedKey]) {
                      // Only subtract for paddy-consuming products (Matching backend precision)
                      const productType = rp.productType || '';
                      const isNonPaddyProduct = ['Bran', 'Farm Bran', 'Faram', 'Farm'].includes(productType);

                      if (!isNonPaddyProduct) {
                        const deducted = rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, productType);
                        closingProduction[matchedKey].bags = closingProduction[matchedKey].bags - deducted;
                        console.log(`  🔴 [${d}] RICE-PROD (${outturnCode}): -${deducted} bags (Variety: ${rp.variety})`);
                      } else {
                        console.log(`  ⚪ [${d}] RICE-PROD (SKIPPED - ${productType}): ${rp.quantityQuintals}Q from ${outturnCode}`);
                      }
                    } else {
                      console.log(`  ⚠️ [${d}] RICE-PROD (NO MATCH): ${outturnCode} - paddyDeducted: ${rp.paddyBagsDeducted}`);
                    }
                  });

                  // Handle cleared outturns
                  Object.keys(closingProduction).forEach(key => {
                    const item = closingProduction[key];
                    const clearingEntry = allRiceProductions.find((rp: any) =>
                      rp.outturn?.code === item.outturn && rp.locationCode === 'CLEARING'
                    );
                    if (clearingEntry && clearingEntry.date <= d) {
                      delete closingProduction[key];
                    }
                  });

                  // Handle kunchinittu closures - subtraction on the day of closure
                  const closuresToday = (closedKunchinittus || []).filter((ck: any) => {
                    const ckDate = ck.closedAt ? ck.closedAt.split('T')[0] : '';
                    return ckDate === d;
                  });

                  closuresToday.forEach((ck: any) => {
                    // Find all warehouse stock entries for this kunchinittu and subtract them
                    Object.keys(closingWarehouse).forEach(key => {
                      const item = closingWarehouse[key];
                      if (item.location.startsWith(ck.code + ' - ')) {
                        console.log(`  🛑 [${d}] KUNCHINITTU CLOSED: ${ck.code} - subtracting ${item.bags} bags from ${item.location}`);
                        // Update stock: subtract current bags to essentially clear this location's stock
                        safeUpdateStock(closingWarehouse, key, -item.bags, { variety: item.variety, location: item.location });
                      }
                    });
                  });

                  // Store pre-computed data
                  preComputedStock.set(d, { openingWarehouse, openingProduction, closingWarehouse, closingProduction });

                  // DEBUG: Log stock totals for this date
                  const openingWarehouseTotal = Object.values(openingWarehouse).reduce((sum: number, item: any) => sum + (item.bags || 0), 0);
                  const openingProductionTotal = Object.values(openingProduction).reduce((sum: number, item: any) => sum + (item.bags || 0), 0);
                  const closingWarehouseTotal = Object.values(closingWarehouse).reduce((sum: number, item: any) => sum + (item.bags || 0), 0);
                  const closingProductionTotal = Object.values(closingProduction).reduce((sum: number, item: any) => sum + (item.bags || 0), 0);

                  const purchasesToday = dayRecords.filter((r: Arrival) => r.movementType === 'purchase' && !r.outturnId).reduce((sum: number, r: Arrival) => sum + (r.bags || 0), 0);
                  const forProdToday = dayRecords.filter((r: Arrival) => r.movementType === 'purchase' && r.outturnId).reduce((sum: number, r: Arrival) => sum + (r.bags || 0), 0);
                  const prodShiftingToday = dayRecords.filter((r: Arrival) => r.movementType === 'production-shifting').reduce((sum: number, r: Arrival) => sum + (r.bags || 0), 0);
                  const riceDeductToday = dayRiceProds.reduce((sum: number, rp: any) => sum + (rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, rp.productType || '')), 0);

                  console.log(`📊 [${d}] Opening: W=${openingWarehouseTotal} P=${openingProductionTotal} | Purchases: ${purchasesToday} ForProd: ${forProdToday} ProdShift: ${prodShiftingToday} RiceDeduct: ${riceDeductToday} | Closing: W=${closingWarehouseTotal} P=${closingProductionTotal} | Total: ${closingWarehouseTotal + closingProductionTotal}`);

                  // Update running stock for NEXT day's opening
                  runningWarehouse = deepCopy(closingWarehouse);
                  runningProduction = deepCopy(closingProduction);
                });

                console.log('📊 Pre-computed stock for', preComputedStock.size, 'dates');

                // Reverse for display (newest first)
                allUniqueDates = allUniqueDates.reverse();

                return allUniqueDates.map((date) => {
                  // ═══════════════════════════════════════════════════════════════════════════
                  // USE PRE-COMPUTED STOCK DATA (calculated chronologically above)
                  // This ensures closing stock properly becomes next day's opening stock
                  // ═══════════════════════════════════════════════════════════════════════════
                  const preComputed = preComputedStock.get(date);

                  // Get pre-computed opening and closing stock
                  const openingStockByKey = preComputed ? deepCopy(preComputed.openingWarehouse) : {};
                  const openingProductionShifting = preComputed ? deepCopy(preComputed.openingProduction) : {};

                  // Get today's records
                  let dateRecords = records[date] || [];

                  const openingStockItems = Object.values(openingStockByKey);
                  console.log(`[${date}] Opening Stock Items:`, openingStockItems);
                  console.log(`[${date}] Opening Production Shifting:`, openingProductionShifting);

                  // Note: Cleared outturns are already filtered during pre-computation

                  // ═══════════════════════════════════════════════════════════════════════════
                  // USE PRE-COMPUTED CLOSING STOCK
                  // ═══════════════════════════════════════════════════════════════════════════
                  const closingStockByKey = preComputed ? deepCopy(preComputed.closingWarehouse) : {};
                  const productionShiftingClosing = preComputed ? deepCopy(preComputed.closingProduction) : {};

                  // Get today's rice productions for display
                  const todayRiceProductions = allRiceProductions.filter((rp: any) => rp.date === date);

                  // Check if this is a working day (has transactions or rice productions)
                  let hasTransactions = dateRecords.length > 0 || todayRiceProductions.length > 0;

                  // Apply local search filtering for display (doesn't affect stock calculations)
                  if (debouncedSearch) {
                    const searchLower = debouncedSearch.toLowerCase();
                    dateRecords = dateRecords.filter((r: Arrival) =>
                      (r.variety && r.variety.toLowerCase().includes(searchLower)) ||
                      (r.broker && r.broker.toLowerCase().includes(searchLower)) ||
                      (r.lorryNumber && r.lorryNumber.toLowerCase().includes(searchLower)) ||
                      (r.wbNo && r.wbNo.toLowerCase().includes(searchLower)) ||
                      (r.fromLocation && r.fromLocation.toLowerCase().includes(searchLower))
                    );
                    hasTransactions = dateRecords.length > 0 || todayRiceProductions.length > 0;
                  }

                  // ═══════════════════════════════════════════════════════════════════════════
                  // CLOSING STOCK IS PRE-COMPUTED - Just filter for display
                  // ═══════════════════════════════════════════════════════════════════════════
                  const closingStockItems = Object.values(closingStockByKey).filter((item: any) => item.bags !== 0);
                  const productionShiftingItems = Object.values(productionShiftingClosing).filter((item: any) => item.bags !== 0);

                  // Consistency check: Validate stock calculations
                  (() => {
                    const openingTotal = openingStockItems.reduce((sum: number, item: any) => sum + item.bags, 0) +
                      Object.values(openingProductionShifting).reduce((sum: number, item: any) => sum + item.bags, 0);
                    const closingTotal = closingStockItems.reduce((sum: number, item: any) => sum + item.bags, 0) +
                      productionShiftingItems.reduce((sum: number, item: any) => sum + item.bags, 0);

                    // Calculate net movements (purchases add, rice production subtracts)
                    // FIX: Don't double-count for-production purchases - they're already in purchases total
                    const totalPurchasesInconsistency = dateRecords.filter((r: Arrival) => r.movementType === 'purchase')
                      .reduce((sum: number, r: Arrival) => sum + (r.bags || 0), 0);

                    const totalDeductionsInconsistency = todayRiceProductions.reduce((sum: number, rp: any) => {
                      const productType = rp.productType || '';
                      const isNonPaddyProduct = ['Bran', 'Farm Bran', 'Faram', 'Farm'].includes(productType);
                      if (isNonPaddyProduct) return sum;
                      return sum + (rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, productType));
                    }, 0);

                    const actualClosing = Object.values(closingStockByKey).reduce((s: number, i: any) => s + (i.bags || 0), 0) +
                      Object.values(productionShiftingClosing).reduce((s: number, i: any) => s + (i.bags || 0), 0);

                    // Expected closing = opening + all purchases - rice production deductions
                    const expectedClosing = openingTotal + totalPurchasesInconsistency - totalDeductionsInconsistency;

                    // Allow small rounding differences (< 1 bag)
                    if (Math.abs(actualClosing - expectedClosing) > 0.5) {
                      console.warn(`[${date}] Stock calculation mismatch detected:`, {
                        opening: openingTotal,
                        purchases: totalPurchasesInconsistency,
                        riceProductionDeduction: totalDeductionsInconsistency,
                        expectedClosing,
                        actualClosing: actualClosing,
                        difference: actualClosing - expectedClosing
                      });
                    }
                  })();

                  // hasTransactions is already calculated above

                  return (
                    <StockSection key={date} style={{
                      backgroundColor: hasTransactions ? 'white' : '#f9fafb'
                    }}>
                      <StockDate style={{
                        backgroundColor: hasTransactions ? '#4472c4' : '#9ca3af',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>
                          {new Date(date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit'
                          }).replace(/\u200E/g, '').trim()}
                        </span>
                        {!hasTransactions && (
                          <span style={{
                            backgroundColor: '#6b7280',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            Mill Closed
                          </span>
                        )}
                      </StockDate>

                      {/* Calculate kunchinittu stock BEFORE layout so both columns can use it */}
                      {(() => {
                        // Use a deep copy to ensure summary table doesn't suffer from mutation leakage
                        const productionShiftingBags = deepCopy(openingProductionShifting);

                        // Calculate PERFECT VARIETY-WISE stock bifurcation
                        // Group by: location + variety + packaging name + bag size
                        const varietyWiseStock: { [key: string]: { bags: number; quintals: number; variety: string; location: string; packaging: string; bagSize: string; category: string } } = {};
                        openingStockItems.forEach((item: any) => {
                          // PERFECT GROUPING: location|variety|category|brandName|bagSize
                          const location = item.locationCode || item.location || 'Unknown';
                          const variety = item.variety || 'Unknown';
                          const category = item.category || 'Other';
                          const packaging = item.brandName || 'Unknown';
                          const bagSize = item.bagSizeKg ? `${item.bagSizeKg}kg` : 'Unknown';

                          const key = `${location}|${variety}|${category}|${packaging}|${bagSize}`;

                          if (!varietyWiseStock[key]) {
                            varietyWiseStock[key] = {
                              bags: 0,
                              quintals: 0,
                              variety,
                              location,
                              packaging,
                              bagSize,
                              category
                            };
                          }
                          varietyWiseStock[key].bags += item.bags || 0;
                          varietyWiseStock[key].quintals += item.quintals || 0;
                        });

                        // For backward compatibility, also calculate kunchinittu-wise stock
                        const kunchinintuStock: { [key: string]: { bags: number; variety: string; kunchinittu: string; warehouse: string } } = {};
                        openingStockItems.forEach((item: any) => {
                          const locationParts = (item.locationCode || item.location || '').split(' - ');
                          const kunchinittu = locationParts[0] || '';
                          const warehouse = locationParts[1] || '';
                          const key = `${item.variety}|${kunchinittu}`;

                          if (!kunchinintuStock[key]) {
                            kunchinintuStock[key] = { bags: 0, variety: item.variety, kunchinittu, warehouse };
                          }
                          kunchinintuStock[key].bags += item.bags || 0;
                        });

                        const kunchinintuTotal = Object.values(kunchinintuStock).reduce((sum: number, item: any) => sum + item.bags, 0);
                        const productionTotal = Object.values(productionShiftingBags).reduce((sum: number, item: any) => sum + item.bags, 0);

                        return (
                          <>
                            {/* Two column layout: Left = Kunchinittu-wise (full width), Right = Variety-wise summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                              {/* LEFT COLUMN: Kunchinittu-wise bifurcation */}
                              <div>

                                {/* Opening Stock - Separate display for kunchinittu stock and production-shifting */}
                                {(openingStockItems.length > 0 || Object.values(openingProductionShifting).some((item: any) => item.bags > 0)) && (
                                  <>
                                    {(() => {

                                      return (
                                        <>
                                          {/* PERFECT VARIETY-WISE Opening Stock */}
                                          {Object.keys(varietyWiseStock).length > 0 && (
                                            <>
                                              <div style={{
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                marginBottom: '8px',
                                                color: '#1f2937',
                                                fontFamily: 'Calibri, sans-serif'
                                              }}>
                                                📊 Perfect Variety-Wise Stock Bifurcation
                                              </div>
                                              <table style={{
                                                width: '100%',
                                                borderCollapse: 'collapse',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '9pt',
                                                marginBottom: '10px',
                                                border: '1px solid #d1d5db',
                                                backgroundColor: '#f8fafc'
                                              }}>
                                                <thead>
                                                  <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 'bold' }}>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Location</th>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Variety</th>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Category</th>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'left' }}>Packaging</th>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'center' }}>Size</th>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>Bags</th>
                                                    <th style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>Quintals</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {Object.values(varietyWiseStock)
                                                    .filter((item: any) => item.bags > 0)
                                                    .sort((a: any, b: any) => {
                                                      const locationCompare = a.location.localeCompare(b.location);
                                                      if (locationCompare !== 0) return locationCompare;
                                                      const varietyCompare = a.variety.localeCompare(b.variety);
                                                      if (varietyCompare !== 0) return varietyCompare;
                                                      return a.packaging.localeCompare(b.packaging);
                                                    })
                                                    .map((item: any, idx: number) => {
                                                      const isUsedToday = dateRecords.some((rec: Arrival) => {
                                                        const recVariety = rec.variety || '';
                                                        const recLocation = rec.fromLocation || '';
                                                        return recVariety === item.variety && recLocation.includes(item.location);
                                                      });

                                                      return (
                                                        <tr key={idx} style={{
                                                          backgroundColor: isUsedToday ? '#fff3cd' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb')
                                                        }}>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', fontWeight: '600' }}>
                                                            {item.location}
                                                          </td>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', fontWeight: '600' }}>
                                                            {item.variety}
                                                          </td>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', fontWeight: '600', color: '#4b5563' }}>
                                                            {item.category}
                                                          </td>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', color: '#6b7280' }}>
                                                            {item.packaging}
                                                          </td>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', color: '#9ca3af', textAlign: 'center' }}>
                                                            {item.bagSize}
                                                          </td>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', fontWeight: 'bold', textAlign: 'right' }}>
                                                            {item.bags.toLocaleString()}
                                                          </td>
                                                          <td style={{ padding: '4px 6px', border: '1px solid #d1d5db', fontWeight: 'bold', textAlign: 'right' }}>
                                                            {item.quintals.toFixed(2)}
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                </tbody>
                                              </table>
                                            </>
                                          )}

                                          {/* Original Kunchinittu-wise summary table (below detailed variety-wise) */}
                                          <table style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontFamily: 'Calibri, sans-serif',
                                            fontSize: '11pt',
                                            marginBottom: '5px',
                                            border: 'none'
                                          }}>
                                            <tbody>
                                              {Object.values(kunchinintuStock)
                                                .filter((item: any) => item.bags > 0)
                                                .sort((a: any, b: any) => {
                                                  const varietyCompare = a.variety.localeCompare(b.variety);
                                                  if (varietyCompare !== 0) return varietyCompare;
                                                  return a.kunchinittu.localeCompare(b.kunchinittu);
                                                })
                                                .map((item: any, idx: number) => {
                                                  const isUsedToday = dateRecords.some((rec: Arrival) =>
                                                    (rec.movementType === 'production-shifting' || rec.movementType === 'purchase' || rec.movementType === 'shifting') &&
                                                    (rec.fromKunchinittu?.code === item.kunchinittu || rec.toKunchinittu?.code === item.kunchinittu)
                                                  );

                                                  return (
                                                    <tr key={idx}>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: isUsedToday ? '#fff3cd' : 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '10%',
                                                        textAlign: 'right'
                                                      }}>
                                                        {item.bags}
                                                      </td>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '15%',
                                                        textAlign: 'left'
                                                      }}>
                                                        {item.variety}
                                                      </td>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '75%',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        color: '#2563eb'
                                                      }}
                                                        onClick={() => {
                                                          console.log('🔗 Opening ledger for kunchinittu:', item.kunchinittu);
                                                          const url = `/ledger?code=${item.kunchinittu}`;
                                                          window.open(url, '_blank');
                                                        }}
                                                      >
                                                        {item.kunchinittu} - {item.warehouse}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                            </tbody>
                                          </table>
                                          {/* Compact Kunchinittu-wise summary table (below detailed variety-wise) */}
                                          <table style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontFamily: 'Calibri, sans-serif',
                                            fontSize: '11pt',
                                            marginBottom: '5px',
                                            border: 'none'
                                          }}>
                                            <tbody>
                                              {Object.values(kunchinintuStock)
                                                .filter((item: any) => item.bags > 0)
                                                .sort((a: any, b: any) => {
                                                  // Sort by variety first, then by kunchinittu
                                                  const varietyCompare = a.variety.localeCompare(b.variety);
                                                  if (varietyCompare !== 0) return varietyCompare;
                                                  return a.kunchinittu.localeCompare(b.kunchinittu);
                                                })
                                                .map((item: any, idx: number) => {
                                                  // Check if this kunchinittu was used for production shifting, purchase, OR shifting today
                                                  const isUsedToday = dateRecords.some((rec: Arrival) =>
                                                    (rec.movementType === 'production-shifting' || rec.movementType === 'purchase' || rec.movementType === 'shifting') &&
                                                    (rec.fromKunchinittu?.code === item.kunchinittu || rec.toKunchinittu?.code === item.kunchinittu)
                                                  );

                                                  return (
                                                    <tr key={idx}>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: isUsedToday ? '#fff3cd' : 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '10%',
                                                        textAlign: 'right'
                                                      }}>
                                                        {item.bags}
                                                      </td>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '15%',
                                                        textAlign: 'left'
                                                      }}>
                                                        {item.variety}
                                                      </td>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '75%',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        color: '#2563eb'
                                                      }}
                                                        onClick={() => {
                                                          // Navigate to Kunchinittu Ledger page
                                                          console.log('🔗 Opening ledger for kunchinittu:', item.kunchinittu);
                                                          const url = `/ledger?code=${item.kunchinittu}`;
                                                          window.open(url, '_blank');
                                                        }}
                                                      >
                                                        {item.kunchinittu} - {item.warehouse}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                            </tbody>
                                          </table>

                                          {/* Kunchinittu subtotal - only show if there are production entries */}
                                          {kunchinintuTotal > 0 && productionTotal > 0 && (
                                            <div style={{
                                              borderTop: '3px solid #000',
                                              padding: '8px 8px 8px 0',
                                              fontWeight: 'bold',
                                              fontSize: '11pt',
                                              fontFamily: 'Calibri, sans-serif',
                                              marginBottom: '5px',
                                              width: '10%',
                                              textAlign: 'right'
                                            }}>
                                              {kunchinintuTotal}
                                            </div>
                                          )}

                                          {/* Production-shifting stock (Outturn remaining bags) - in table format to align with kunchinittu entries */}
                                          {Object.values(productionShiftingBags).filter((item: any) => item.bags > 0).length > 0 && (
                                            <table style={{
                                              width: '100%',
                                              borderCollapse: 'collapse',
                                              fontFamily: 'Calibri, sans-serif',
                                              fontSize: '11pt',
                                              marginBottom: '5px',
                                              border: 'none'
                                            }}>
                                              <tbody>
                                                {Object.values(productionShiftingBags)
                                                  .filter((item: any) => item.bags > 0)
                                                  .sort((a: any, b: any) => {
                                                    // Sort by outturn code (out01, out02, etc.)
                                                    const aNum = parseInt(a.outturn.replace(/\D/g, '')) || 0;
                                                    const bNum = parseInt(b.outturn.replace(/\D/g, '')) || 0;
                                                    return aNum - bNum;
                                                  })
                                                  .map((item: any, idx: number) => (
                                                    <tr key={`prod-${idx}`}>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: '#ffb366',
                                                        fontWeight: 'bold',
                                                        width: '10%',
                                                        textAlign: 'right'
                                                      }}>
                                                        {item.bags}
                                                      </td>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '15%',
                                                        textAlign: 'left'
                                                      }}>
                                                        {item.variety}
                                                      </td>
                                                      <td style={{
                                                        padding: '4px 8px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        fontWeight: 'bold',
                                                        width: '75%',
                                                        textAlign: 'left',
                                                        color: '#7c3aed',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline'
                                                      }}
                                                        onClick={() => {
                                                          // Find the outturn by code (check both outturnNumber and code fields)
                                                          const outturn = outturns.find((o: any) =>
                                                            (o.outturnNumber === item.outturn) || (o.code === item.outturn)
                                                          );
                                                          if (outturn) {
                                                            setSelectedOutturnId(outturn.id.toString());
                                                            setActiveTab('outturn-report');
                                                          }
                                                        }}
                                                      >
                                                        {item.outturn}
                                                      </td>
                                                    </tr>
                                                  ))}
                                              </tbody>
                                            </table>
                                          )}


                                          {/* Total Opening Stock */}
                                          <div style={{
                                            borderTop: '3px solid #000',
                                            padding: '8px 8px 8px 0',
                                            fontWeight: 'bold',
                                            fontSize: '11pt',
                                            fontFamily: 'Calibri, sans-serif',
                                            marginBottom: '15px',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}>
                                            <span style={{ width: '10%', textAlign: 'right', paddingRight: '8px' }}>
                                              {kunchinintuTotal + productionTotal}
                                            </span>
                                            <span style={{ width: '90%', textAlign: 'left' }}>
                                              Opening Stock
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </>
                                )}

                                {/* Daily Movements - Grouped by variety with color coding and highlight matching */}
                                {(() => {
                                  // Create a set of variety-kunchinittu combinations from opening stock for highlighting
                                  const openingStockKeys = new Set(
                                    openingStockItems.map((item: any) => {
                                      const kunchinintuCode = item.location.split(' - ')[0]; // Extract kunchinittu code
                                      return `${item.variety}|${kunchinintuCode}`;
                                    })
                                  );

                                  // Group purchases by variety and destination
                                  const purchaseGroups: { [key: string]: { bags: number; broker: string; variety: string; date: string; to: string; outturn?: string; highlight: boolean } } = {};
                                  const shiftingGroups: { [key: string]: { bags: number; variety: string; date: string; from: string; to: string; highlight: boolean } } = {};
                                  const productionGroups: { [key: string]: { bags: number; variety: string; date: string; from: string; to: string; highlight: boolean } } = {};
                                  const looseGroups: { [key: string]: { bags: number; variety: string; date: string; to: string; highlight: boolean } } = {};

                                  dateRecords.forEach((record: Arrival) => {
                                    if (record.movementType === 'purchase') {
                                      // Check if this is a for-production purchase (has outturnId)
                                      const isForProduction = !!record.outturnId;

                                      console.log(`🔍 Purchase Record #${record.id}:`, {
                                        movementType: record.movementType,
                                        outturnId: record.outturnId,
                                        isForProduction: isForProduction,
                                        outturn: record.outturn,
                                        variety: record.variety,
                                        broker: record.broker
                                      });

                                      if (isForProduction) {
                                        // For Production purchase - goes directly to outturn (bypasses warehouse)
                                        const outturnCode = record.outturn?.code || (record.outturnId ? `OUT${record.outturnId}` : 'UNKNOWN');
                                        const outturnDisplay = record.outturn ? `${record.outturn.code} - ${record.outturn.allottedVariety || ''}` : outturnCode;
                                        console.log(`✓ For Production Purchase #${record.id}:`, {
                                          variety: record.variety,
                                          bags: record.bags,
                                          broker: record.broker,
                                          outturnId: record.outturnId,
                                          outturnCode: outturnCode,
                                          outturnObject: record.outturn
                                        });
                                        const key = `${record.variety}-${record.broker}-${outturnCode}-${record.id}`;

                                        if (!purchaseGroups[key]) {
                                          purchaseGroups[key] = {
                                            bags: 0,
                                            broker: record.broker || '-',
                                            variety: record.variety || '-',
                                            date: record.date || '',
                                            to: outturnDisplay,
                                            outturn: outturnCode,
                                            highlight: false
                                          };
                                        }
                                        purchaseGroups[key].bags += record.bags || 0;
                                        console.log(`✓ Created purchase group with outturn: ${outturnCode}`);
                                      } else {
                                        // Normal purchase - goes to warehouse (will later be shifted to production)
                                        const toKunchinittu = record.toKunchinittu?.code || '';
                                        const toWarehouse = record.toWarehouse?.name || '';
                                        console.log(`✓ Normal Purchase #${record.id}: ${record.variety} (${record.bags} bags) → Warehouse: ${toKunchinittu} - ${toWarehouse} | Broker: ${record.broker}`);

                                        const key = `${record.variety}|${record.broker}|${toKunchinittu}|${record.id}`;
                                        const highlightKey = `${record.variety}|${toKunchinittu}`;
                                        const shouldHighlight = openingStockKeys.has(highlightKey);

                                        if (!purchaseGroups[key]) {
                                          purchaseGroups[key] = {
                                            bags: 0,
                                            broker: record.broker || '-',
                                            variety: record.variety || '-',
                                            date: record.date || '',
                                            to: `${toKunchinittu} - ${toWarehouse}`,
                                            highlight: shouldHighlight
                                          };
                                        }
                                        purchaseGroups[key].bags += record.bags || 0;
                                      }
                                    } else if (record.movementType === 'production-shifting') {
                                      const fromKunchinittu = record.fromKunchinittu?.code || '';
                                      const outturnCode = record.outturn?.code || '';
                                      // Use record ID to keep each entry separate (no grouping on same day)
                                      const key = `${record.variety}|${fromKunchinittu}|${outturnCode}|${record.id}`;
                                      const highlightKey = `${record.variety}|${fromKunchinittu}`;
                                      const shouldHighlight = openingStockKeys.has(highlightKey);

                                      // Format destination with outturn code
                                      const destination = outturnCode
                                        ? `→ Production (${outturnCode})`
                                        : '→ Production';

                                      // Format source
                                      const from = `${fromKunchinittu} - ${record.fromWarehouse?.name || ''}`;

                                      if (!productionGroups[key]) {
                                        productionGroups[key] = {
                                          bags: 0,
                                          variety: record.variety || '-',
                                          date: record.date || '',
                                          from,
                                          to: destination,
                                          highlight: shouldHighlight
                                        };
                                      }
                                      productionGroups[key].bags += record.bags || 0;
                                    } else if (record.movementType === 'shifting') {
                                      const fromKunchinittu = record.fromKunchinittu?.code || '';
                                      const toKunchinittu = record.toKunchinittu?.code || '';
                                      // Use record ID to keep each entry separate (no grouping on same day)
                                      const key = `${record.variety}|${fromKunchinittu}|${toKunchinittu}|${record.id}`;
                                      const highlightKey = `${record.variety}|${fromKunchinittu}`;
                                      const shouldHighlight = openingStockKeys.has(highlightKey);

                                      if (!shiftingGroups[key]) {
                                        shiftingGroups[key] = {
                                          bags: 0,
                                          variety: record.variety || '-',
                                          date: record.date || '',
                                          from: `${fromKunchinittu} - ${record.fromWarehouse?.name || ''}`,
                                          to: `${toKunchinittu} - ${record.toWarehouseShift?.name || ''}`,
                                          highlight: shouldHighlight
                                        };
                                      }
                                      shiftingGroups[key].bags += record.bags || 0;
                                    } else if (record.movementType === 'loose') {
                                      // Loose entries - treat as inward like purchase
                                      const toKunchinittu = record.toKunchinittu?.code || '';
                                      const toWarehouse = record.toWarehouse?.name || '';
                                      const key = `loose-${record.variety}|${toKunchinittu}|${record.id}`;
                                      const highlightKey = `${record.variety}|${toKunchinittu}`;
                                      const shouldHighlight = openingStockKeys.has(highlightKey);

                                      if (!looseGroups[key]) {
                                        looseGroups[key] = {
                                          bags: 0,
                                          variety: record.variety || '-',
                                          date: record.date || '',
                                          to: `${toKunchinittu} - ${toWarehouse}`,
                                          highlight: shouldHighlight
                                        };
                                      }
                                      looseGroups[key].bags += record.bags || 0;
                                    }
                                  });

                                  return (
                                    <>
                                      {/* Purchase entries - GREEN */}
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontFamily: 'Calibri, sans-serif',
                                        fontSize: '11pt',
                                        marginBottom: '5px',
                                        border: 'none'
                                      }}>
                                        <tbody>
                                          {Object.values(purchaseGroups).map((group, idx) => {
                                            // Check if this is For Production by checking if outturn field exists
                                            const isForProduction = !!group.outturn && group.outturn !== '';

                                            // Debug: Log the entire group object
                                            console.log(`📊 Purchase Group #${idx}:`, group);

                                            // Determine what to display in destination column
                                            let destinationDisplay = '';
                                            let displayColor = '#000';

                                            if (isForProduction) {
                                              // For Production Purchase: show outturn in purple
                                              destinationDisplay = group.outturn || 'UNKNOWN';
                                              displayColor = '#7c3aed';
                                            } else {
                                              // Normal Purchase: show warehouse location in black
                                              // Clean up the display - remove empty parts
                                              const toValue = group.to || '';
                                              if (toValue === ' - ' || toValue === '-' || toValue.trim() === '') {
                                                destinationDisplay = '-';
                                              } else {
                                                destinationDisplay = toValue;
                                              }
                                              displayColor = '#000';
                                            }

                                            return (
                                              <tr key={`purchase-${idx}`}>
                                                <td style={{
                                                  backgroundColor: '#d4edda',
                                                  padding: '4px 8px',
                                                  border: 'none',
                                                  fontFamily: 'Calibri, sans-serif',
                                                  fontSize: '11pt',
                                                  fontWeight: 'bold',
                                                  width: '10%',
                                                  textAlign: 'right'
                                                }}>
                                                  +{group.bags}
                                                </td>
                                                <td style={{
                                                  backgroundColor: 'transparent',
                                                  padding: '4px 8px',
                                                  border: 'none',
                                                  fontFamily: 'Calibri, sans-serif',
                                                  fontSize: '11pt',
                                                  fontWeight: 'bold',
                                                  width: '15%',
                                                  textAlign: 'left'
                                                }}>
                                                  {group.variety}
                                                </td>
                                                <td style={{
                                                  backgroundColor: 'transparent',
                                                  padding: '4px 8px',
                                                  border: 'none',
                                                  fontFamily: 'Calibri, sans-serif',
                                                  fontSize: '11pt',
                                                  fontWeight: 'bold',
                                                  width: '18%',
                                                  textAlign: 'left'
                                                }}>
                                                  {group.broker}
                                                </td>
                                                <td style={{
                                                  backgroundColor: 'transparent',
                                                  padding: '4px 2px',
                                                  border: 'none',
                                                  fontFamily: 'Calibri, sans-serif',
                                                  fontSize: '11pt',
                                                  fontWeight: 'bold',
                                                  width: '3%',
                                                  textAlign: 'center',
                                                  color: '#000'
                                                }}>
                                                  to
                                                </td>
                                                <td style={{
                                                  backgroundColor: 'transparent',
                                                  padding: '4px 8px',
                                                  border: 'none',
                                                  fontFamily: 'Calibri, sans-serif',
                                                  fontSize: '11pt',
                                                  fontWeight: 'bold',
                                                  width: '54%',
                                                  textAlign: 'left',
                                                  color: displayColor
                                                }}>
                                                  {destinationDisplay}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>

                                      {/* Loose entries - YELLOW/AMBER (inward) */}
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontFamily: 'Calibri, sans-serif',
                                        fontSize: '11pt',
                                        marginBottom: '5px',
                                        border: 'none'
                                      }}>
                                        <tbody>
                                          {Object.values(looseGroups).map((group: any, idx: number) => (
                                            <tr key={`loose-${idx}`}>
                                              <td style={{
                                                backgroundColor: '#fef3c7',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '10%',
                                                textAlign: 'right',
                                                color: '#92400e'
                                              }}>
                                                +{group.bags}
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '15%',
                                                textAlign: 'left'
                                              }}>
                                                {group.variety}
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '18%',
                                                textAlign: 'left',
                                                color: '#92400e',
                                                fontStyle: 'italic'
                                              }}>
                                                (Loose)
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 2px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '3%',
                                                textAlign: 'center',
                                                color: '#000'
                                              }}>
                                                to
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '54%',
                                                textAlign: 'left'
                                              }}>
                                                {group.to}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>

                                      {/* Shifting entries - PURPLE/PINK (darker if highlighted) */}
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontFamily: 'Calibri, sans-serif',
                                        fontSize: '11pt',
                                        marginBottom: '5px',
                                        border: 'none'
                                      }}>
                                        <tbody>
                                          {Object.values(shiftingGroups).map((group, idx) => (
                                            <tr key={`shifting-${idx}`}>
                                              <td style={{
                                                backgroundColor: group.highlight ? '#d4bfe6' : '#e2d4ed',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '10%',
                                                textAlign: 'right'
                                              }}>
                                                +-{group.bags}
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '15%',
                                                textAlign: 'left'
                                              }}>
                                                {group.variety}
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '18%',
                                                textAlign: 'left'
                                              }}>
                                                {group.from}
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 2px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '3%',
                                                textAlign: 'center',
                                                color: '#000'
                                              }}>
                                                to
                                              </td>
                                              <td style={{
                                                backgroundColor: 'transparent',
                                                padding: '4px 8px',
                                                border: 'none',
                                                fontFamily: 'Calibri, sans-serif',
                                                fontSize: '11pt',
                                                fontWeight: 'bold',
                                                width: '54%',
                                                textAlign: 'left'
                                              }}>
                                                {group.to}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>

                                      {/* Production-Shifting entries - ORANGE - Show each entry individually */}
                                      <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontFamily: 'Calibri, sans-serif',
                                        fontSize: '11pt',
                                        marginBottom: '5px',
                                        border: 'none'
                                      }}>
                                        <tbody>
                                          {Object.values(productionGroups)
                                            .sort((a: any, b: any) => {
                                              // Sort by outturn code
                                              const aOutturn = a.to.match(/\(([^)]+)\)/)?.[1] || '';
                                              const bOutturn = b.to.match(/\(([^)]+)\)/)?.[1] || '';
                                              const aNum = parseInt(aOutturn.replace(/\D/g, '')) || 0;
                                              const bNum = parseInt(bOutturn.replace(/\D/g, '')) || 0;
                                              return aNum - bNum;
                                            })
                                            .map((group: any, idx: number) => {
                                              const outturn = group.to.match(/\(([^)]+)\)/)?.[1] || '';
                                              return (
                                                <tr key={`production-${idx}`}>
                                                  <td style={{
                                                    backgroundColor: '#ffb366',
                                                    padding: '4px 8px',
                                                    border: 'none',
                                                    fontFamily: 'Calibri, sans-serif',
                                                    fontSize: '11pt',
                                                    fontWeight: 'bold',
                                                    width: '10%',
                                                    textAlign: 'right'
                                                  }}>
                                                    (-) {group.bags} → {outturn}
                                                  </td>
                                                  <td style={{
                                                    backgroundColor: 'transparent',
                                                    padding: '4px 8px',
                                                    border: 'none',
                                                    fontFamily: 'Calibri, sans-serif',
                                                    fontSize: '11pt',
                                                    fontWeight: 'bold',
                                                    width: '15%',
                                                    textAlign: 'left'
                                                  }}>
                                                    {group.variety}
                                                  </td>
                                                  <td style={{
                                                    backgroundColor: 'transparent',
                                                    padding: '4px 8px',
                                                    border: 'none',
                                                    fontFamily: 'Calibri, sans-serif',
                                                    fontSize: '11pt',
                                                    fontWeight: 'bold',
                                                    width: '18%',
                                                    textAlign: 'left'
                                                  }}>
                                                    {group.from}
                                                  </td>
                                                  <td style={{
                                                    backgroundColor: 'transparent',
                                                    padding: '4px 2px',
                                                    border: 'none',
                                                    fontFamily: 'Calibri, sans-serif',
                                                    fontSize: '11pt',
                                                    fontWeight: 'bold',
                                                    width: '3%',
                                                    textAlign: 'center',
                                                    color: '#000'
                                                  }}>
                                                    to
                                                  </td>
                                                  <td style={{
                                                    backgroundColor: 'transparent',
                                                    padding: '4px 8px',
                                                    border: 'none',
                                                    fontFamily: 'Calibri, sans-serif',
                                                    fontSize: '11pt',
                                                    fontWeight: 'bold',
                                                    width: '54%',
                                                    textAlign: 'left'
                                                  }}>
                                                    {outturn}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                        </tbody>
                                      </table>

                                      {/* Rice Production Consumption - RED - GROUPED BY OUTTURN */}
                                      {(() => {
                                        // Group rice productions by outturn
                                        const riceDeductionByOutturn: { [key: string]: { bags: number; variety: string; outturnCode: string; isClearing: boolean } } = {};

                                        todayRiceProductions
                                          .filter((rp: any) => {
                                            // Filter out rice productions with 0 bags deducted (like Bran, Farm Bran)
                                            const deductedBags = rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, rp.productType || '');
                                            return deductedBags > 0;
                                          })
                                          .forEach((rp: any) => {
                                            const outturnCode = rp.outturn?.code || 'UNKNOWN';
                                            const deductedBags = rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, rp.productType || '');
                                            const isClearing = rp.locationCode === 'CLEARING';

                                            // Get variety
                                            let variety = 'Unknown';
                                            if (rp.outturn?.allottedVariety) {
                                              variety = rp.outturn.allottedVariety;
                                            } else if (outturnCode) {
                                              const matchingKey = Object.keys(productionShiftingClosing).find(key => {
                                                const parts = key.split('|');
                                                const keyOutturn = parts[parts.length - 1];
                                                return keyOutturn === outturnCode;
                                              });

                                              if (matchingKey) {
                                                const parts = matchingKey.split('|');
                                                variety = parts[0];
                                              } else {
                                                const outturnArrival = Object.values(records).flat().find((rec: any) =>
                                                  (rec.movementType === 'production-shifting' || (rec.movementType === 'purchase' && rec.outturnId)) &&
                                                  rec.outturn?.code === outturnCode
                                                );
                                                if (outturnArrival) {
                                                  variety = outturnArrival.variety || 'Unknown';
                                                }
                                              }
                                            }

                                            // Group by outturn and clearing status
                                            const groupingKey = isClearing ? `${outturnCode}_CLEARING` : outturnCode;

                                            if (!riceDeductionByOutturn[groupingKey]) {
                                              riceDeductionByOutturn[groupingKey] = {
                                                bags: 0,
                                                variety,
                                                outturnCode,
                                                isClearing
                                              };
                                            }
                                            riceDeductionByOutturn[groupingKey].bags += deductedBags;
                                          });

                                        const riceDeductionGroups = Object.values(riceDeductionByOutturn);

                                        return riceDeductionGroups.length > 0 && (
                                          <table style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontFamily: 'Calibri, sans-serif',
                                            fontSize: '11pt',
                                            marginBottom: '5px',
                                            border: 'none'
                                          }}>
                                            <tbody>
                                              {riceDeductionGroups.map((group, idx: number) => {
                                                return (
                                                  <tr key={`rice-deduction-${idx}`}>
                                                    <td style={{
                                                      padding: '4px 8px',
                                                      border: 'none',
                                                      backgroundColor: group.isClearing ? '#fecaca' : '#ff9999',
                                                      fontWeight: 'bold',
                                                      width: '10%',
                                                      textAlign: 'right',
                                                      color: group.isClearing ? '#991b1b' : '#991f1f'
                                                    }}>
                                                      (-) {group.bags}
                                                    </td>
                                                    <td style={{
                                                      padding: '4px 8px',
                                                      border: 'none',
                                                      backgroundColor: 'transparent',
                                                      fontWeight: 'bold',
                                                      width: '15%',
                                                      textAlign: 'left',
                                                      color: group.isClearing ? '#991b1b' : '#dc2626'
                                                    }}>
                                                      {group.variety}
                                                    </td>
                                                    <td style={{
                                                      padding: '4px 8px',
                                                      border: 'none',
                                                      backgroundColor: 'transparent',
                                                      fontWeight: 'bold',
                                                      width: '75%',
                                                      textAlign: 'left',
                                                      color: group.isClearing ? '#991b1b' : '#dc2626',
                                                      cursor: 'pointer',
                                                      textDecoration: 'underline'
                                                    }}
                                                      onClick={() => {
                                                        // Find the outturn by code (check both outturnNumber and code fields)
                                                        const outturn = outturns.find((o: any) =>
                                                          (o.outturnNumber === group.outturnCode) || (o.code === group.outturnCode)
                                                        );
                                                        if (outturn) {
                                                          setSelectedOutturnId(outturn.id.toString());
                                                          setActiveTab('outturn-report');
                                                        }
                                                      }}
                                                    >
                                                      {group.outturnCode} → {group.isClearing ? 'Outturn Cleared (Waste/Loss)' : 'Rice Production'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        );

                                      })()}

                                      {/* Kunchinittu Closure Entries - GRAY/RED */}
                                      {(() => {
                                        const closuresToday = (closedKunchinittus || []).filter((ck: any) => {
                                          const ckDate = ck.closedAt ? ck.closedAt.split('T')[0] : '';
                                          return ckDate === date;
                                        });

                                        if (closuresToday.length === 0) return null;

                                        return (
                                          <table style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontFamily: 'Calibri, sans-serif',
                                            fontSize: '11pt',
                                            marginBottom: '5px',
                                            border: 'none'
                                          }}>
                                            <tbody>
                                              {closuresToday.map((ck: any, idx: number) => (
                                                <tr key={`closure-${idx}`}>
                                                  <td style={{
                                                    backgroundColor: '#e5e7eb',
                                                    padding: '4px 8px',
                                                    border: '1px solid #ef4444',
                                                    fontWeight: 'bold',
                                                    width: '10%',
                                                    textAlign: 'right',
                                                    color: '#ef4444'
                                                  }}>
                                                    (-) {ck.closedRemainingBags || 0}
                                                  </td>
                                                  <td style={{
                                                    backgroundColor: '#e5e7eb',
                                                    padding: '4px 8px',
                                                    border: '1px solid #ef4444',
                                                    borderLeft: 'none',
                                                    fontWeight: 'bold',
                                                    width: '15%',
                                                    textAlign: 'left',
                                                    color: '#ef4444'
                                                  }}>
                                                    {ck.variety || 'KUNCHINITTU'}
                                                  </td>
                                                  <td style={{
                                                    backgroundColor: '#e5e7eb',
                                                    padding: '4px 8px',
                                                    border: '1px solid #ef4444',
                                                    borderLeft: 'none',
                                                    fontWeight: 'bold',
                                                    width: '75%',
                                                    textAlign: 'left',
                                                    color: '#ef4444'
                                                  }}>
                                                    {ck.code} - {ck.warehouse || ck.warehouseName || ''} (KUNCHINITTU CLOSED)
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        );
                                      })()}

                                      {/* Loading (Dispatch) Entries - NOT SHOWN IN PADDY STOCK */}
                                      {/* Loading entries are rice dispatches and don't affect paddy stock */}
                                      {/* They represent rice being loaded onto trucks (already converted from paddy) */}
                                    </>
                                  );
                                })()}

                                {/* Closing Stock - Total only (bifurcation hidden but calculated in backend) */}
                                {(closingStockItems.length > 0 || productionShiftingItems.length > 0) && (
                                  <>
                                    {/* Calculate bifurcation for backend/internal use but don't display */}
                                    {(() => {
                                      // Group closing stock by variety and kunchinittu (not warehouse) - for calculation only
                                      const kunchinintuGrouped: { [key: string]: { bags: number; variety: string; kunchinittu: string; warehouse: string } } = {};

                                      closingStockItems.forEach((item: any) => {
                                        const locationParts = item.location.split(' - ');
                                        const kunchinittu = locationParts[0] || '';
                                        const warehouse = locationParts[1] || '';
                                        const key = `${item.variety}-${kunchinittu}`;

                                        if (!kunchinintuGrouped[key]) {
                                          kunchinintuGrouped[key] = {
                                            bags: 0,
                                            variety: item.variety,
                                            kunchinittu,
                                            warehouse
                                          };
                                        }
                                        kunchinintuGrouped[key].bags += item.bags;
                                      });

                                      // Bifurcation is calculated but not displayed
                                      // This data is available for backend processing if needed
                                      return null;
                                    })()}

                                    <div style={{
                                      borderTop: '3px solid #000',
                                      padding: '8px 8px 8px 0',
                                      fontWeight: 'bold',
                                      fontSize: '11pt',
                                      fontFamily: 'Calibri, sans-serif',
                                      marginTop: '15px',
                                      marginBottom: '15px',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}>
                                      <span style={{ width: '10%', textAlign: 'right', paddingRight: '8px' }}>
                                        {closingStockItems.reduce((sum: number, item: any) => sum + item.bags, 0) +
                                          productionShiftingItems.reduce((sum: number, item: any) => sum + item.bags, 0)}
                                      </span>
                                      <span style={{ width: '90%', textAlign: 'left' }}>
                                        Closing Stock
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* RIGHT COLUMN: Variety-wise summary AND Working section */}
                              <div style={{ position: 'sticky', top: '20px', alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                                {/* Working Section - Rice Production Deductions - ALWAYS SHOW on working days */}
                                {hasTransactions && (
                                  <div style={{
                                    backgroundColor: 'white',
                                    border: '2px solid #ef4444',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    maxWidth: '150px'
                                  }}>
                                    <div style={{
                                      backgroundColor: '#ef4444',
                                      color: 'white',
                                      padding: '0.3rem',
                                      fontWeight: 'bold',
                                      fontSize: '8pt',
                                      textAlign: 'center'
                                    }}>
                                      Working
                                    </div>
                                    <div style={{ padding: '0.4rem', fontSize: '8pt' }}>
                                      {(() => {
                                        // MONTH-WISE CALCULATION: Reset on 1st of each month
                                        const currentDate = new Date(date + 'T00:00:00');
                                        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                                        const firstDayOfMonthStr = firstDayOfMonth.toISOString().split('T')[0];

                                        // Calculate cumulative total up to YESTERDAY (all days before today in current month)
                                        const daysBeforeToday = allRiceProductions.filter((rp: any) =>
                                          rp.date >= firstDayOfMonthStr && rp.date < date
                                        );
                                        const cumulativeBeforeToday = daysBeforeToday.reduce((sum: number, rp: any) =>
                                          sum + (rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, rp.productType || '')), 0
                                        );

                                        // Calculate today's total
                                        const todayProds = allRiceProductions.filter((rp: any) => rp.date === date);
                                        const todayTotal = todayProds.reduce((sum: number, rp: any) =>
                                          sum + (rp.paddyBagsDeducted || calculatePaddyBagsDeducted(rp.quantityQuintals || 0, rp.productType || '')), 0
                                        );

                                        // Total for the month up to today
                                        const monthTotal = cumulativeBeforeToday + todayTotal;

                                        return (
                                          <div>
                                            {/* Show month-wise cumulative calculation */}
                                            <div>
                                              <div style={{ fontWeight: 'bold', color: '#dc2626', marginBottom: '0.15rem', fontSize: '7pt' }}>
                                                {new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                              </div>
                                              <div style={{ textAlign: 'right', fontSize: '8pt', color: '#374151' }}>
                                                {cumulativeBeforeToday}
                                              </div>
                                              <div style={{ textAlign: 'right', fontSize: '8pt', color: '#dc2626', borderBottom: '1px solid #000', paddingBottom: '1px' }}>
                                                {todayTotal}
                                              </div>
                                              <div style={{ textAlign: 'right', fontSize: '8pt', fontWeight: 'bold', color: '#374151', paddingTop: '1px' }}>
                                                {monthTotal}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* Variety-wise Opening Stock */}
                                {/* Group kunchinittu stock by variety, then show outturn entries separately */}
                                {(() => {
                                  // Group kunchinittu stock by variety only
                                  const kunchinintuVarietyMap: { [variety: string]: number } = {};
                                  Object.values(kunchinintuStock).forEach((item: any) => {
                                    if (!kunchinintuVarietyMap[item.variety]) {
                                      kunchinintuVarietyMap[item.variety] = 0;
                                    }
                                    kunchinintuVarietyMap[item.variety] += item.bags;
                                  });

                                  // Group production shifting by variety and outturn
                                  const productionVarietyMap: { [key: string]: { variety: string; outturn: string; bags: number } } = {};
                                  Object.values(productionShiftingBags).forEach((item: any) => {
                                    const key = `${item.variety}-${item.outturn}`;
                                    if (!productionVarietyMap[key]) {
                                      productionVarietyMap[key] = {
                                        variety: item.variety,
                                        outturn: item.outturn,
                                        bags: 0
                                      };
                                    }
                                    productionVarietyMap[key].bags += item.bags;
                                  });

                                  const sortedKunchinintuVarieties = Object.entries(kunchinintuVarietyMap)
                                    .filter(([_, bags]) => bags !== 0) // Show all non-zero stock (even negative to highlight data issues)
                                    .sort((a, b) => a[0].localeCompare(b[0]));

                                  const sortedProductionEntries = Object.values(productionVarietyMap)
                                    .filter((item: any) => item.bags > 0)
                                    .sort((a: any, b: any) => {
                                      const varietyCompare = a.variety.localeCompare(b.variety);
                                      if (varietyCompare !== 0) return varietyCompare;
                                      return a.outturn.localeCompare(b.outturn);
                                    });

                                  const kunchinintuTotal = sortedKunchinintuVarieties.reduce((sum, [_, bags]) => sum + bags, 0);
                                  const productionTotal = sortedProductionEntries.reduce((sum, item) => sum + item.bags, 0);
                                  const totalBags = kunchinintuTotal + productionTotal;

                                  return (
                                    <div style={{
                                      backgroundColor: 'white',
                                      border: '2px solid #4a90e2',
                                      borderRadius: '8px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        backgroundColor: '#4a90e2',
                                        color: 'white',
                                        padding: '0.5rem',
                                        fontWeight: 'bold',
                                        fontSize: '11pt',
                                        textAlign: 'center'
                                      }}>
                                        Variety-wise Opening Stock
                                      </div>
                                      <ExcelTable style={{ fontSize: '10pt', marginBottom: 0 }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#4a90e2', color: 'white' }}>
                                            <th>Variety</th>
                                            <th>Bags</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {/* Kunchinittu stock - grouped by variety */}
                                          {sortedKunchinintuVarieties.map(([variety, bags], idx) => (
                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9fafb' : 'white' }}>
                                              <td>{variety}</td>
                                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{bags}</td>
                                            </tr>
                                          ))}

                                          {/* Production shifting - show with outturn, orange background */}
                                          {sortedProductionEntries.map((item: any, idx: number) => (
                                            <tr key={`prod-${idx}`} style={{ backgroundColor: '#ffe4cc' }}>
                                              <td>{item.variety} ({item.outturn})</td>
                                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.bags}</td>
                                            </tr>
                                          ))}

                                          <tr style={{ backgroundColor: '#4a90e2', color: 'white', fontWeight: 'bold' }}>
                                            <td>TOTAL</td>
                                            <td style={{ textAlign: 'right' }}>
                                              {totalBags}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </ExcelTable>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </StockSection>
                  );
                });
              })()}
            </RecordsContainer>
          </div>
        )
      ) : Object.keys(records).length === 0 ? (
        <EmptyState>
          <p>📭 No records found</p>
          {selectedMonth && (
            <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.5rem' }}>
              No records available for {availableMonths.find(m => m.month === selectedMonth)?.month_label}
            </p>
          )}
        </EmptyState>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'sticky',
            top: '0',
            backgroundColor: '#ffffff',
            zIndex: 100,
            padding: '1rem 1.25rem',
            borderBottom: '2px solid #e5e7eb',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: '0 0 12px 12px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 'bold', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {activeTab === 'arrivals' && <span>🚛 Historical Arrivals</span>}
                {activeTab === 'purchase' && <span>📦 Purchase Records</span>}
                {activeTab === 'shifting' && <span>🔄 Shifting Records</span>}
                <span>🌾 Paddy Stock</span>
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px', fontWeight: '500' }}>
                {showAllRecords ? "📋 All Records" : `📅 ${(() => {
                  const bDate = getBusinessDate();
                  return new Date(bDate + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  });
                })()}`}
                {selectedMonth && ` • 🌙 ${availableMonths.find(m => m.month === selectedMonth)?.month_label || selectedMonth}`}
                {(dateFrom || dateTo) && ` • 🗓️ ${dateFrom || '...'} to ${dateTo || '...'}`}
                {search && ` • 🔍 "${search}"`}
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'bold' }}>
              {Object.keys(records).length} Days • {Object.values(records).flat().length} Records
            </div>
          </div>

          <RecordsContainer>
            {Object.entries(records).map(([date, dateRecords]) => (
              <DateGroup key={date} expanded={true}>
                <DateHeader>
                  <DateTitle>
                    {groupBy === 'week' ? (
                      `📅 ${getWeekRange(new Date(date))}`
                    ) : (
                      `📅 ${new Date(date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit'
                      }).replace(/\u200E/g, '').trim()}`
                    )}
                  </DateTitle>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <RecordCount>{dateRecords.length} records</RecordCount>
                  </div>
                </DateHeader>

                <TableContainer>
                  {activeTab === 'arrivals' ? (
                    <ExcelTable>
                      <thead>
                        <tr>
                          <th>SL No</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Broker</th>
                          <th>From</th>
                          <th>To Kunchinittu</th>
                          <th>To Warehouse</th>
                          <th>Outturn</th>
                          <th>Variety</th>
                          <th>Bags</th>
                          <th>Moisture</th>
                          <th>Cutting</th>
                          <th>WB No</th>
                          <th>Gross Weight</th>
                          <th>Tare Weight</th>
                          <th>Net Weight</th>
                          <th>Lorry No</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateRecords.map((record) => {
                          const RowComponent = record.movementType === 'purchase' ? PurchaseRow : ShiftingRow;
                          const isLoose = record.movementType === 'loose';
                          return (
                            <React.Fragment key={record.id}>
                              <RowComponent style={isLoose ? { background: '#fffbeb' } : {}}>
                                <td>{record.slNo}</td>
                                <td>{new Date(record.date).toLocaleDateString('en-GB')}</td>
                                <td style={{ textTransform: 'capitalize' }}>{record.movementType}</td>
                                <td>{isLoose ? '-' : (record.broker || '-')}</td>
                                <LocationCell
                                  hasLocation={record.movementType === 'shifting'}
                                  isPurple={true}
                                >
                                  {isLoose ? '-' : (record.movementType === 'purchase'
                                    ? (record.outturnId ? (record.fromLocation || 'Direct Purchase') : (record.fromLocation || '-'))
                                    : record.movementType === 'production-shifting'
                                      ? `${record.fromKunchinittu?.code || '-'} - ${record.fromWarehouse?.name || '-'}`
                                      : `${record.fromKunchinittu?.name || '-'}`
                                  )}
                                </LocationCell>
                                <LocationCell
                                  hasLocation={!!(record.movementType === 'purchase' ? (record.outturnId ? false : record.toKunchinittu) : (record.movementType === 'production-shifting' ? record.outturn : record.toKunchinittu))}
                                  isPurple={record.movementType !== 'purchase'}
                                >
                                  {isLoose ? (record.toKunchinittu?.code || '-') : (record.movementType === 'purchase'
                                    ? (record.outturnId ? '-' : (record.toKunchinittu?.name || '-'))
                                    : record.movementType === 'production-shifting'
                                      ? `→ Production (${record.outturn?.code || '-'})`
                                      : record.toKunchinittu?.code || '-'
                                  )}
                                </LocationCell>
                                <LocationCell
                                  hasLocation={!!(record.movementType === 'purchase' ? (record.outturnId ? false : record.toWarehouse) : (record.movementType === 'production-shifting' ? record.toWarehouse : (record.fromWarehouse || record.toWarehouseShift)))}
                                  isPurple={record.movementType !== 'purchase'}
                                >
                                  {isLoose ? '-' : (record.movementType === 'purchase'
                                    ? (record.outturnId ? '-' : (record.toWarehouse?.name || '-'))
                                    : record.movementType === 'production-shifting'
                                      ? record.toWarehouse?.name || '-'
                                      : `${record.fromWarehouse?.name || '-'} → ${record.toWarehouseShift?.name || '-'}`
                                  )}
                                </LocationCell>
                                <LocationCell
                                  hasLocation={!!(record.movementType === 'purchase' && record.outturnId)}
                                  isPurple={true}
                                >
                                  {record.movementType === 'purchase' && record.outturnId
                                    ? record.outturn?.code || '-'
                                    : '-'}
                                </LocationCell>
                                <VarietyCell
                                  hasLocation={!!(record.variety && (record.toKunchinittu || record.fromKunchinittu))}
                                  isPurple={record.movementType !== 'purchase'}
                                >
                                  {isLoose ? '-' : (record.variety || '-')}
                                </VarietyCell>
                                <td>{record.bags || '-'}</td>
                                <td>{isLoose ? '-' : (record.moisture || '-')}</td>
                                <td>{isLoose ? '-' : (record.cutting || '-')}</td>
                                <td>{isLoose ? '-' : record.wbNo}</td>
                                <td>{isLoose ? '-' : record.grossWeight}</td>
                                <td>{isLoose ? '-' : record.tareWeight}</td>
                                <td>{isLoose ? '-' : record.netWeight}</td>
                                <td>{isLoose ? '-' : record.lorryNumber}</td>
                                <td>
                                  <StatusBadge status={record.status}>
                                    {record.status}
                                    {record.status === 'approved' && !record.adminApprovedBy && ' (Manager)'}
                                    {record.adminApprovedBy && ' (Admin ✓)'}
                                  </StatusBadge>
                                </td>
                                <td>
                                  <ActionButtons>
                                    {/* FIXED: Paddy Hamali Status Indicators - Use paddyHamaliEntries with OLD system structure */}
                                    {(paddyHamaliEntries[record.id] && (
                                      paddyHamaliEntries[record.id].hasLoadingHamali ||
                                      paddyHamaliEntries[record.id].hasUnloadingHamali ||
                                      paddyHamaliEntries[record.id].hasLooseTumbiddu
                                    )) && (
                                        <IconButton
                                          style={{
                                            background: '#10b981',
                                            color: 'white',
                                            fontSize: '0.8rem',
                                            padding: '0.25rem 0.5rem',
                                            marginRight: '0.25rem'
                                          }}
                                          title="Paddy Hamali Added"
                                        >
                                          ✓ 🌾
                                        </IconButton>
                                      )}

                                    {/* Manager approval for pending records */}
                                    {record.status === 'pending' && user?.role !== 'staff' && (
                                      <>
                                        <IconButton
                                          className="approve"
                                          onClick={() => handleApprove(record.id, 'approved')}
                                          title="Approve (Manager)"
                                        >
                                          ✓
                                        </IconButton>
                                        <IconButton
                                          className="delete"
                                          onClick={() => handleApprove(record.id, 'rejected')}
                                          title="Reject"
                                        >
                                          ✗
                                        </IconButton>
                                      </>
                                    )}

                                    {/* Admin approval for manager-approved records */}
                                    {record.status === 'approved' && !record.adminApprovedBy && user?.role === 'admin' && (
                                      <IconButton
                                        className="approve"
                                        onClick={() => handleAdminApprove(record.id)}
                                        title="Admin Approve (Add to Stock)"
                                      >
                                        ✓✓
                                      </IconButton>
                                    )}

                                    {/* Edit button - Only for Manager/Admin on approved records */}
                                    {(record.status === 'approved' || record.status === 'admin-approved') &&
                                      (user?.role === 'manager' || user?.role === 'admin') && (
                                        <IconButton
                                          className="edit"
                                          onClick={() => handleEdit(record)}
                                          title="Edit Record"
                                        >
                                          ✏️
                                        </IconButton>
                                      )}

                                    {/* Paddy Hamali Button - FIXED: Use paddyHamaliEntries with OLD system structure */}
                                    {record.status === 'approved' && (
                                      <IconButton
                                        className={(paddyHamaliEntries[record.id] && (
                                          paddyHamaliEntries[record.id].hasLoadingHamali ||
                                          paddyHamaliEntries[record.id].hasUnloadingHamali ||
                                          paddyHamaliEntries[record.id].hasLooseTumbiddu
                                        )) ? "approve" : "edit"}
                                        onClick={() => setExpandedHamaliRecordId(expandedHamaliRecordId === record.id ? null : record.id)}
                                        title={(paddyHamaliEntries[record.id] && (
                                          paddyHamaliEntries[record.id].hasLoadingHamali ||
                                          paddyHamaliEntries[record.id].hasUnloadingHamali ||
                                          paddyHamaliEntries[record.id].hasLooseTumbiddu
                                        )) ? "View Paddy Hamali" : "Add Paddy Hamali"}
                                        style={{
                                          background: (paddyHamaliEntries[record.id] && (
                                            paddyHamaliEntries[record.id].hasLoadingHamali ||
                                            paddyHamaliEntries[record.id].hasUnloadingHamali ||
                                            paddyHamaliEntries[record.id].hasLooseTumbiddu
                                          )) ? '#10b981' : '#f59e0b',
                                          color: 'white',
                                          fontSize: '0.8rem',
                                          padding: '0.25rem 0.5rem',
                                          marginRight: '0.25rem'
                                        }}
                                      >
                                        {(paddyHamaliEntries[record.id] && (
                                          paddyHamaliEntries[record.id].hasLoadingHamali ||
                                          paddyHamaliEntries[record.id].hasUnloadingHamali ||
                                          paddyHamaliEntries[record.id].hasLooseTumbiddu
                                        )) ? '✓' : '+'} 🌾
                                      </IconButton>
                                    )}

                                    {/* Palti Button - Logic from user request */}
                                    {record.status === 'approved' && (
                                      <IconButton
                                        className={expandedPaltiRecordId === record.id ? "approve" : "edit"}
                                        onClick={() => setExpandedPaltiRecordId(expandedPaltiRecordId === record.id ? null : record.id)}
                                        title="Palti Conversion"
                                        style={{
                                          background: expandedPaltiRecordId === record.id ? '#10b981' : '#f59e0b',
                                          color: 'white',
                                          fontSize: '0.8rem',
                                          padding: '0.25rem 0.5rem',
                                          marginRight: '0.25rem'
                                        }}
                                      >
                                        🔄 Palti
                                      </IconButton>
                                    )}

                                    {/* Delete button - Only for Manager/Admin on approved records */}
                                    {(record.status === 'approved' || record.status === 'admin-approved') &&
                                      (user?.role === 'manager' || user?.role === 'admin') && (
                                        <IconButton
                                          className="delete"
                                          onClick={() => handleDelete(record.id)}
                                          title="Delete"
                                        >
                                          🗑️
                                        </IconButton>
                                      )}


                                  </ActionButtons>
                                </td>
                              </RowComponent>
                              {expandedHamaliRecordId === record.id && (
                                <tr>
                                  <td colSpan={17} style={{ padding: 0 }}>
                                    {paddyHamaliEntries[record.id] ? (
                                      <div style={{
                                        background: '#f0fdf4',
                                        border: '2px solid #10b981',
                                        borderRadius: '8px',
                                        padding: '1.5rem',
                                        margin: '0.5rem 0'
                                      }}>
                                        <h4 style={{ color: '#10b981', margin: '0 0 1rem 0' }}>
                                          ✓ Hamali Already Added
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                          {paddyHamaliEntries[record.id].hasLoadingHamali && (
                                            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px' }}>
                                              <strong>Loading Hamali:</strong> ₹{paddyHamaliEntries[record.id].loadingTotal}
                                              <br />
                                              <small style={{ color: '#6b7280' }}>
                                                {paddyHamaliEntries[record.id].loadingBags} bags × ₹{paddyHamaliEntries[record.id].loadingRate}
                                              </small>
                                            </div>
                                          )}
                                          {paddyHamaliEntries[record.id].hasUnloadingHamali && (
                                            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px' }}>
                                              <strong>Unloading Hamali ({paddyHamaliEntries[record.id].unloadingType?.toUpperCase()}):</strong> ₹{paddyHamaliEntries[record.id].unloadingTotal}
                                              <br />
                                              <small style={{ color: '#6b7280' }}>
                                                {paddyHamaliEntries[record.id].unloadingBags} bags × ₹{paddyHamaliEntries[record.id].unloadingRate}
                                              </small>
                                            </div>
                                          )}
                                          {paddyHamaliEntries[record.id].hasLooseTumbiddu && (
                                            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px' }}>
                                              <strong>Loose Tumbiddu:</strong> ₹{paddyHamaliEntries[record.id].looseTotal}
                                              <br />
                                              <small style={{ color: '#6b7280' }}>
                                                {paddyHamaliEntries[record.id].looseBags} bags × ₹{paddyHamaliEntries[record.id].looseRate}
                                              </small>
                                            </div>
                                          )}
                                        </div>
                                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '6px', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'right' }}>
                                          Grand Total: ₹{paddyHamaliEntries[record.id].grandTotal}
                                        </div>
                                        {paddyHamaliEntries[record.id].status === 'pending' && (
                                          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '6px', color: '#92400e', fontWeight: '600' }}>
                                            ⏳ Pending Approval
                                          </div>
                                        )}
                                        {paddyHamaliEntries[record.id].status === 'approved' && (
                                          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#dcfce7', borderRadius: '6px', color: '#166534', fontWeight: '600' }}>
                                            ✓ Approved
                                          </div>
                                        )}
                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                          {paddyHamaliEntries[record.id].status === 'pending' && (user?.role === 'manager' || user?.role === 'admin') && (
                                            <button
                                              onClick={async () => {
                                                try {
                                                  await axios.post(`/hamali-entries/${record.id}/approve`);
                                                  toast.success('Hamali approved successfully!');
                                                  fetchRecords();
                                                } catch (error: any) {
                                                  toast.error(error.response?.data?.error || 'Failed to approve');
                                                }
                                              }}
                                              style={{
                                                padding: '0.5rem 1rem',
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                              }}
                                            >
                                              ✓ Approve
                                            </button>
                                          )}
                                          <button
                                            onClick={() => setExpandedHamaliRecordId(null)}
                                            style={{
                                              padding: '0.5rem 1rem',
                                              background: '#6b7280',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: '6px',
                                              cursor: 'pointer',
                                              fontWeight: '600'
                                            }}
                                          >
                                            Close
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <InlineHamaliForm
                                        arrival={record}
                                        onClose={() => setExpandedHamaliRecordId(null)}
                                        onSuccess={() => {
                                          fetchRecords();
                                          setExpandedHamaliRecordId(null);
                                        }}
                                      />
                                    )}
                                  </td>
                                </tr>
                              )}

                              {expandedPaltiRecordId === record.id && (
                                <tr>
                                  <td colSpan={17} style={{ padding: 0 }}>
                                    <InlinePaltiForm
                                      arrival={record}
                                      onClose={() => setExpandedPaltiRecordId(null)}
                                      onSuccess={() => {
                                        fetchRecords();
                                        setExpandedPaltiRecordId(null);
                                      }}
                                    />
                                  </td>
                                </tr>
                              )}

                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </ExcelTable>
                  ) : activeTab === 'purchase' ? (
                    <ExcelTable>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type of Movement</th>
                          <th>Broker</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Variety</th>
                          <th>Bags</th>
                          <th>Moisture</th>
                          <th>Cutting</th>
                          <th>Wb No</th>
                          <th>Gross Weight</th>
                          <th>Tare Weight</th>
                          <th>Net Weight</th>
                          <th>Lorry No</th>
                          <th>Amount</th>
                          <th>Total Amount</th>
                          <th>Average Rate</th>
                          {canEdit && <th>Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {dateRecords.map((record) => (
                          <React.Fragment key={record.id}>
                            <PurchaseRow>
                              <td>{new Date(record.date).toLocaleDateString('en-GB')}</td>
                              <td>Purchase</td>
                              <td>{record.broker || '-'}</td>
                              <LocationCell hasLocation={!!record.fromLocation} isPurple={false}>
                                {record.fromLocation || '-'}
                              </LocationCell>
                              <LocationCell hasLocation={!!(record.outturnId || record.toKunchinittu || record.toWarehouse)} isPurple={record.outturnId ? true : false}>
                                {record.outturnId
                                  ? `→ Production (${record.outturn?.code || `OUT${record.outturnId}`})`
                                  : `${record.toKunchinittu?.name || ''} - ${record.toWarehouse?.name || ''}`
                                }
                              </LocationCell>
                              <VarietyCell hasLocation={!!record.variety} isPurple={false}>
                                {record.variety || '-'}
                              </VarietyCell>
                              <td>{record.bags || '-'}</td>
                              <td>{record.moisture || '-'}</td>
                              <td>{record.cutting || '-'}</td>
                              <td>{record.wbNo}</td>
                              <td>{record.grossWeight}</td>
                              <td>{record.tareWeight}</td>
                              <td>{record.netWeight}</td>
                              <td>{record.lorryNumber}</td>
                              <td style={{
                                fontSize: '0.85rem',
                                whiteSpace: 'pre-line',
                                verticalAlign: 'middle',
                                minWidth: '230px'
                              }}>
                                {record.purchaseRate?.amountFormula || '-'}
                              </td>
                              <td>{record.purchaseRate?.totalAmount ? `₹${Number(record.purchaseRate.totalAmount).toFixed(2)}` : '-'}</td>
                              <td>{record.purchaseRate?.averageRate ? `₹${Number(record.purchaseRate.averageRate).toFixed(2)}` : '-'}</td>
                              {canEdit && (
                                <td>
                                  <Button
                                    className={expandedRateRecordId === record.id ? "secondary" : "primary"}
                                    onClick={() => toggleRateForm(record.id)}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                  >
                                    {expandedRateRecordId === record.id ? 'Close' : (record.purchaseRate ? 'Edit Rate' : 'Add Rate')}
                                  </Button>
                                </td>
                              )}
                            </PurchaseRow>
                            {expandedRateRecordId === record.id && (
                              <InlineRateForm>
                                <RateFormCell colSpan={canEdit ? 17 : 16}>
                                  <RateFormContainer>
                                    <RateFormTitle>📊 {record.purchaseRate ? 'Edit' : 'Add'} Purchase Rate</RateFormTitle>

                                    <RateFormGrid>
                                      <RateFormGroup>
                                        <RateLabel>Sute</RateLabel>
                                        <RateInput
                                          type="number"
                                          step="0.01"
                                          value={rateFormData.sute}
                                          onChange={(e) => handleRateInputChange('sute', e.target.value)}
                                          placeholder="0"
                                        />
                                        <RateRadioGroup>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="suteCalculationMethod"
                                              value="per_bag"
                                              checked={rateFormData.suteCalculationMethod === 'per_bag'}
                                              onChange={(e) => handleRateInputChange('suteCalculationMethod', e.target.value)}
                                            />
                                            Bag
                                          </RateRadioLabel>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="suteCalculationMethod"
                                              value="per_quintal"
                                              checked={rateFormData.suteCalculationMethod === 'per_quintal'}
                                              onChange={(e) => handleRateInputChange('suteCalculationMethod', e.target.value)}
                                            />
                                            Quintal
                                          </RateRadioLabel>
                                        </RateRadioGroup>
                                      </RateFormGroup>

                                      <RateFormGroup>
                                        <RateLabel>Base Rate *</RateLabel>
                                        <RateInput
                                          type="number"
                                          step="0.01"
                                          value={rateFormData.baseRate}
                                          onChange={(e) => handleRateInputChange('baseRate', e.target.value)}
                                          placeholder="Enter base rate"
                                        />
                                        <RateRadioGroup>
                                          {['CDL', 'CDWB', 'MDL', 'MDWB'].map(type => (
                                            <RateRadioLabel key={type}>
                                              <input
                                                type="radio"
                                                name="rateType"
                                                value={type}
                                                checked={rateFormData.rateType === type}
                                                onChange={(e) => handleRateInputChange('rateType', e.target.value)}
                                              />
                                              {type}
                                            </RateRadioLabel>
                                          ))}
                                        </RateRadioGroup>
                                        <RateRadioGroup style={{ marginTop: '0.5rem' }}>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="baseRateCalculationMethod"
                                              value="per_bag"
                                              checked={rateFormData.baseRateCalculationMethod === 'per_bag'}
                                              onChange={(e) => handleRateInputChange('baseRateCalculationMethod', e.target.value)}
                                            />
                                            Per Bag (÷75)
                                          </RateRadioLabel>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="baseRateCalculationMethod"
                                              value="per_quintal"
                                              checked={rateFormData.baseRateCalculationMethod === 'per_quintal'}
                                              onChange={(e) => handleRateInputChange('baseRateCalculationMethod', e.target.value)}
                                            />
                                            Per Quintal (÷100)
                                          </RateRadioLabel>
                                        </RateRadioGroup>
                                      </RateFormGroup>

                                      <RateFormGroup>
                                        <RateLabel>H {['MDL', 'MDWB'].includes(rateFormData.rateType) && <span style={{ color: '#f59e0b', fontSize: '0.65rem' }}>(−=+)</span>}</RateLabel>
                                        <RateInput
                                          type="number"
                                          step="0.01"
                                          value={rateFormData.h}
                                          onChange={(e) => handleRateInputChange('h', e.target.value)}
                                          placeholder="0"
                                          title={['MDL', 'MDWB'].includes(rateFormData.rateType) ? 'For MDL/MDWB, negative values are treated as positive' : 'Enter value (negative to subtract)'}
                                        />
                                        <RateRadioGroup>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="hCalculationMethod"
                                              value="per_bag"
                                              checked={rateFormData.hCalculationMethod === 'per_bag'}
                                              onChange={(e) => handleRateInputChange('hCalculationMethod', (e.target as HTMLInputElement).value)}
                                            />
                                            Bag
                                          </RateRadioLabel>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="hCalculationMethod"
                                              value="per_quintal"
                                              checked={rateFormData.hCalculationMethod === 'per_quintal'}
                                              onChange={(e) => handleRateInputChange('hCalculationMethod', (e.target as HTMLInputElement).value)}
                                            />
                                            Quintal
                                          </RateRadioLabel>
                                        </RateRadioGroup>
                                      </RateFormGroup>

                                      <RateFormGroup>
                                        <RateLabel>B</RateLabel>
                                        <RateInput
                                          type="number"
                                          step="0.01"
                                          value={rateFormData.b}
                                          onChange={(e) => handleRateInputChange('b', e.target.value)}
                                          placeholder="0"
                                        />
                                        <RateRadioGroup>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="bCalculationMethod"
                                              value="per_bag"
                                              checked={rateFormData.bCalculationMethod === 'per_bag'}
                                              onChange={(e) => handleRateInputChange('bCalculationMethod', e.target.value)}
                                            />
                                            Bag
                                          </RateRadioLabel>
                                          <RateRadioLabel>
                                            <input
                                              type="radio"
                                              name="bCalculationMethod"
                                              value="per_quintal"
                                              checked={rateFormData.bCalculationMethod === 'per_quintal'}
                                              onChange={(e) => handleRateInputChange('bCalculationMethod', e.target.value)}
                                            />
                                            Quintal
                                          </RateRadioLabel>
                                        </RateRadioGroup>
                                      </RateFormGroup>

                                      {/* LF - Disabled for MDL and MDWB */}
                                      <RateFormGroup>
                                        <RateLabel>LF {['MDL', 'MDWB'].includes(rateFormData.rateType) && <span style={{ color: '#dc2626', fontSize: '0.65rem' }}>(N/A)</span>}</RateLabel>
                                        <RateInput
                                          type="number"
                                          step="0.01"
                                          value={['MDL', 'MDWB'].includes(rateFormData.rateType) ? '0' : rateFormData.lf}
                                          onChange={(e) => handleRateInputChange('lf', e.target.value)}
                                          placeholder="0"
                                          disabled={['MDL', 'MDWB'].includes(rateFormData.rateType)}
                                          style={['MDL', 'MDWB'].includes(rateFormData.rateType) ? { background: '#fee2e2', cursor: 'not-allowed' } : {}}
                                        />
                                        {!['MDL', 'MDWB'].includes(rateFormData.rateType) && (
                                          <RateRadioGroup>
                                            <RateRadioLabel>
                                              <input
                                                type="radio"
                                                name="lfCalculationMethod"
                                                value="per_bag"
                                                checked={rateFormData.lfCalculationMethod === 'per_bag'}
                                                onChange={(e) => handleRateInputChange('lfCalculationMethod', e.target.value)}
                                              />
                                              Bag
                                            </RateRadioLabel>
                                            <RateRadioLabel>
                                              <input
                                                type="radio"
                                                name="lfCalculationMethod"
                                                value="per_quintal"
                                                checked={rateFormData.lfCalculationMethod === 'per_quintal'}
                                                onChange={(e) => handleRateInputChange('lfCalculationMethod', e.target.value)}
                                              />
                                              Quintal
                                            </RateRadioLabel>
                                          </RateRadioGroup>
                                        )}
                                      </RateFormGroup>

                                      {/* EGB - Show for CDL and MDL */}
                                      {(rateFormData.rateType === 'CDL' || rateFormData.rateType === 'MDL') && (
                                        <RateFormGroup>
                                          <RateLabel>EGB</RateLabel>
                                          <RateInput
                                            type="number"
                                            step="0.01"
                                            value={rateFormData.egb}
                                            onChange={(e) => handleRateInputChange('egb', e.target.value)}
                                            placeholder="0"
                                          />
                                        </RateFormGroup>
                                      )}
                                    </RateFormGrid>

                                    <RateCalculationBox>
                                      <RateCalcRow>
                                        <RateCalcLabel>Net Weight:</RateCalcLabel>
                                        <RateCalcValue>{(parseFloat(record.netWeight.toString()) / 100).toFixed(2)} Q</RateCalcValue>
                                      </RateCalcRow>
                                      <RateCalcRow>
                                        <RateCalcLabel>Total Amount:</RateCalcLabel>
                                        <RateCalcValue>
                                          ₹{(() => {
                                            const bags = record.bags || 0;
                                            const actualNetWeight = parseFloat(record.netWeight.toString());

                                            // 1. Calculate Sute Weight (Deduction based on Physical Bags or Weight)
                                            const suteValue = parseFloat(rateFormData.sute || '0');
                                            const suteWeightKg = rateFormData.suteCalculationMethod === 'per_bag'
                                              ? suteValue * bags
                                              : (actualNetWeight / 100) * suteValue;

                                            // 2. Sute Net Weight (Weight left after Sute is subtracted)
                                            const suteNetWeight = actualNetWeight - suteWeightKg;

                                            // 3. Base Rate Amount (Calculated ONLY on Sute Net Weight)
                                            const baseDivisor = rateFormData.baseRateCalculationMethod === 'per_bag' ? 75 : 100;
                                            const baseRateValue = parseFloat(rateFormData.baseRate || '0');
                                            const baseRateAmount = (suteNetWeight / baseDivisor) * baseRateValue;

                                            // 4. Other Charges (H, B, LF)
                                            // If Per Bag: Always use Physical Bags
                                            // If Per Quintal: Always use Original Net Weight
                                            const hValue = parseFloat(rateFormData.h || '0');
                                            const hAmount = rateFormData.hCalculationMethod === 'per_bag'
                                              ? hValue * bags
                                              : hValue * (actualNetWeight / 100);

                                            const bValue = parseFloat(rateFormData.b || '0');
                                            const bAmount = rateFormData.bCalculationMethod === 'per_bag'
                                              ? bValue * bags
                                              : bValue * (actualNetWeight / 100);

                                            let lfValue = parseFloat(rateFormData.lf || '0');
                                            if (['MDL', 'MDWB'].includes(rateFormData.rateType)) {
                                              lfValue = 0;
                                            }
                                            const lfAmount = rateFormData.lfCalculationMethod === 'per_bag'
                                              ? lfValue * bags
                                              : lfValue * (actualNetWeight / 100);

                                            // 5. EGB (Always uses Physical Bags)
                                            const showEGB = ['CDL', 'MDL'].includes(rateFormData.rateType);
                                            const egbAmount = showEGB ? bags * parseFloat(rateFormData.egb || '0') : 0;

                                            // 6. Total = Base Amount + All Adjustments
                                            const totalAmount = baseRateAmount + hAmount + bAmount + lfAmount + egbAmount;
                                            return totalAmount.toFixed(2);
                                          })()}
                                        </RateCalcValue>
                                      </RateCalcRow>
                                    </RateCalculationBox>

                                    <RateButtonGroup>
                                      <Button
                                        className="secondary"
                                        onClick={() => toggleRateForm(record.id)}
                                        disabled={savingRate}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        className="success"
                                        onClick={() => handleSaveRate(record.id)}
                                        disabled={savingRate}
                                      >
                                        {savingRate ? 'Saving...' : 'Save Rate'}
                                      </Button>
                                    </RateButtonGroup>
                                  </RateFormContainer>
                                </RateFormCell>
                              </InlineRateForm>
                            )}

                          </React.Fragment>
                        ))}
                      </tbody>
                    </ExcelTable>
                  ) : activeTab === 'shifting' ? (
                    <ExcelTable>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type of Movement</th>
                          <th>From Kunchinittu</th>
                          <th>From Warehouse</th>
                          <th>To Kunchinittu</th>
                          <th>To Warehouse</th>
                          <th>Variety</th>
                          <th>Bags</th>
                          <th>Moisture</th>
                          <th>Cutting</th>
                          <th>Wb No</th>
                          <th>Gross Weight</th>
                          <th>Tare Weight</th>
                          <th>Net Weight</th>
                          <th>Lorry No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateRecords.map((record) => (
                          <ShiftingRow key={record.id}>
                            <td>{new Date(record.date).toLocaleDateString('en-GB')}</td>
                            <td style={{ textTransform: 'capitalize' }}>
                              {record.movementType === 'production-shifting' ? 'Production-Shifting' :
                                record.movementType === 'for-production' ? 'For-Production' : 'Shifting'}
                            </td>
                            <LocationCell
                              hasLocation={!!(record.movementType === 'shifting' || record.movementType === 'production-shifting' || record.movementType === 'for-production') && !!record.fromKunchinittu}
                              isPurple={true}
                            >
                              {record.movementType === 'production-shifting' || record.movementType === 'for-production'
                                ? record.fromKunchinittu?.code || '-'
                                : record.fromKunchinittu?.name || '-'}
                            </LocationCell>
                            <LocationCell
                              hasLocation={!!(record.movementType === 'shifting' || record.movementType === 'production-shifting') && !!record.fromWarehouse}
                              isPurple={true}
                            >
                              {record.movementType === 'production-shifting'
                                ? record.fromWarehouse?.name || '-'
                                : record.fromWarehouse?.name || '-'}
                            </LocationCell>
                            <LocationCell
                              hasLocation={!!(record.movementType === 'production-shifting' ? record.outturn : record.toKunchinittu)}
                              isPurple={true}
                            >
                              {record.movementType === 'production-shifting'
                                ? `→ Production (${record.outturn?.code || '-'})`
                                : record.toKunchinittu?.name || '-'}
                            </LocationCell>
                            <LocationCell
                              hasLocation={!!(record.movementType === 'production-shifting' ? record.toWarehouse : record.toWarehouseShift)}
                              isPurple={true}
                            >
                              {record.movementType === 'production-shifting'
                                ? record.toWarehouse?.name || '-'
                                : record.toWarehouseShift?.name || '-'}
                            </LocationCell>
                            <VarietyCell hasLocation={!!record.variety} isPurple={true}>
                              {record.variety || '-'}
                            </VarietyCell>
                            <td>{record.bags || '-'}</td>
                            <td>{record.moisture || '-'}</td>
                            <td>{record.cutting || '-'}</td>
                            <td>{record.wbNo}</td>
                            <td>{record.grossWeight}</td>
                            <td>{record.tareWeight}</td>
                            <td>{record.netWeight}</td>
                            <td>{record.lorryNumber}</td>
                          </ShiftingRow>
                        ))}
                      </tbody>
                    </ExcelTable>
                  ) : null}
                </TableContainer>
              </DateGroup>
            ))}

            {/* Enhanced Pagination - Different for Paddy Stock */}
            <Pagination>
              {(activeTab as string) === 'stock' ? (
                /* Month-wise Navigation for Paddy Stock */
                <>
                  <PageButton
                    onClick={() => navigateMonth('prev')}
                    disabled={loading}
                  >
                    ‹ Previous Month
                  </PageButton>

                  <div style={{
                    margin: '0 2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    fontSize: '0.9rem',
                    color: '#374151'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      📅 {getCurrentMonthLabel()}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {Object.values(records).flat().length} stock entries this month
                    </div>
                  </div>

                  <PageButton
                    onClick={() => navigateMonth('next')}
                    disabled={loading}
                  >
                    Next Month ›
                  </PageButton>

                  {/* Quick Month Selector */}
                  <div style={{ marginLeft: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>Jump to:</label>
                    <Select
                      value={selectedMonth || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedMonth(e.target.value);
                          toast.info('Loading selected month...');
                        }
                      }}
                      style={{ padding: '0.25rem', fontSize: '0.85rem', minWidth: '150px' }}
                    >
                      <option value="">Select Month</option>
                      {availableMonths.map((m) => (
                        <option key={m.month} value={m.month}>
                          {m.month_label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : (
                /* Regular Pagination for Other Tabs */
                <>
                  <PageButton
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                  >
                    « First
                  </PageButton>

                  <PageButton
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ‹ Previous
                  </PageButton>

                  {/* Page Numbers */}
                  {(() => {
                    const maxVisiblePages = 5;
                    const startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
                    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                    const pages = [];

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <PageButton
                          key={i}
                          $active={i === page}
                          onClick={() => setPage(i)}
                        >
                          {i}
                        </PageButton>
                      );
                    }

                    return pages;
                  })()}

                  <PageButton
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next ›
                  </PageButton>

                  <PageButton
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                  >
                    Last »
                  </PageButton>

                  <div style={{
                    margin: '0 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#374151' }}>
                      Page {page} of {totalPages}
                    </div>
                    <div>
                      Showing {((page - 1) * 250) + 1}-{Math.min(page * 250, ((page - 1) * 250) + Object.values(records).flat().length)}
                      of {Object.values(records).flat().length > 0 ?
                        (showAllRecords ? 'all' : selectedMonth ? 'monthly' : 'filtered') : '0'} records
                    </div>
                  </div>
                </>
              )}
            </Pagination>
          </RecordsContainer>
        </div>
      )}

      {/* Edit Arrival Modal */}
      {
        editingRecord && (
          <EditArrivalModal
            arrival={editingRecord}
            onClose={() => setEditingRecord(null)}
            onSuccess={handleEditSuccess}
          />
        )
      }

      {/* Clear Outturn Dialog */}
      {
        showClearOutturnDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 1.5rem 0', color: '#1f2937' }}>
                Clear Outturn
              </h3>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  background: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '0.5rem' }}>
                    ⚠️ Remaining Bags: {availableBags} bags
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#78350f' }}>
                    These bags will be consumed and added to the working section on the selected date.
                  </div>
                </div>

                <Label>Select Clear Date *</Label>
                <Input
                  type="date"
                  value={clearOutturnDate}
                  onChange={(e) => setClearOutturnDate(e.target.value)}
                  style={{ marginTop: '0.5rem', width: '100%' }}
                />
                <InfoText style={{ marginTop: '0.5rem' }}>
                  Choose the date when this outturn should be cleared
                </InfoText>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <Button
                  className="secondary"
                  onClick={() => setShowClearOutturnDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="primary"
                  onClick={confirmClearOutturn}
                  disabled={!clearOutturnDate}
                >
                  Confirm Clear
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Pagination Controls */}
      {(activeTab === 'arrivals' || activeTab === 'purchase' || activeTab === 'shifting') && totalPages > 1 && (
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          recordsPerPage={250}
          onPageChange={(newPage) => {
            setPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          loading={loading}
        />
      )}

      {/* Paddy Hamali Modal */}
      {
        showPaddyHamaliModal && selectedArrivalForHamali && (
          <AddPaddyHamaliModal
            isOpen={showPaddyHamaliModal}
            onClose={() => {
              setShowPaddyHamaliModal(false);
              setSelectedArrivalForHamali(null);
            }}
            arrival={{
              id: selectedArrivalForHamali.id,
              arrivalNumber: selectedArrivalForHamali.slNo,        // ✅ Fixed: Map slNo to arrivalNumber
              partyName: selectedArrivalForHamali.broker || 'N/A', // ✅ Fixed: Map broker to partyName
              bags: selectedArrivalForHamali.bags || 0
            }}
            onSave={() => {
              setShowPaddyHamaliModal(false);
              setSelectedArrivalForHamali(null);
            }}
          />
        )
      }

      {/* Purchase/Sale modals removed - Rice Stock tab is display-only */}

      {/* Purchase Modal */}
      <SimplePurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={() => {
          fetchRiceStock();
          fetchPendingMovements();
        }}
      />

      {/* Sale Modal */}
      <SimpleSaleModal
        isOpen={showSaleModal}
        onClose={() => setShowSaleModal(false)}
        onSuccess={() => {
          fetchRiceStock();
          fetchPendingMovements();
        }}
      />

      {/* Enhanced Palti Modal - Multi-Target Support */}
      <EnhancedPaltiModal
        isOpen={showPaltiModal}
        onClose={() => setShowPaltiModal(false)}
        onSuccess={() => {
          fetchRiceStock();
          fetchPendingMovements();
          // Force refresh of hierarchical component with a small delay to ensure DB is updated
          setTimeout(() => {
            setHierarchicalRefreshTrigger(prev => prev + 1);
          }, 500);
        }}
        initialDate={paltiDate}
        onDateChange={setPaltiDate}
      />

      {editingRiceMovement && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease'
        }} onClick={() => setEditingRiceMovement(null)}>
          <div style={{
            background: 'white',
            width: '90%',
            maxWidth: '550px',
            maxHeight: '90vh',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            borderRadius: '16px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              background: '#f8fafc',
              padding: '1.5rem 2rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.25rem', fontWeight: 700 }}>
                ✏️ Edit Rice Movement
              </h3>
              <button
                onClick={() => setEditingRiceMovement(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >×</button>
            </div>

            <div style={{ padding: '1.5rem 2rem', flex: 1, overflowY: 'auto' }}>

              {/* Movement Type Badge (Read-only) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Movement Type</label>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  background: editingRiceMovement.movementType === 'sale' ? '#fee2e2' :
                    editingRiceMovement.movementType === 'purchase' ? '#dcfce7' :
                      editingRiceMovement.movementType === 'palti' ? '#ede9fe' : '#f3f4f6',
                  color: editingRiceMovement.movementType === 'sale' ? '#dc2626' :
                    editingRiceMovement.movementType === 'purchase' ? '#16a34a' :
                      editingRiceMovement.movementType === 'palti' ? '#7c3aed' : '#374151'
                }}>
                  {editingRiceMovement.movementType || editingRiceMovement.movement_type || 'production'}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Date</label>
                <input
                  type="date"
                  value={editingRiceMovement.date?.split('T')[0] || ''}
                  onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Product Type</label>
                <select
                  value={editingRiceMovement.product_type || editingRiceMovement.productType || ''}
                  onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, productType: e.target.value, product_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select Product Type</option>
                  <option value="Rice">Rice</option>
                  <option value="Bran">Bran</option>
                  <option value="Broken">Broken</option>
                  <option value="Faram">Faram</option>
                  <option value="0 Broken">0 Broken</option>
                  <option value="Zero Broken">Zero Broken</option>
                  <option value="Sizer Broken">Sizer Broken</option>
                  <option value="RJ Rice 1">RJ Rice 1</option>
                  <option value="RJ Rice (2)">RJ Rice (2)</option>
                  <option value="RJ Broken">RJ Broken</option>
                  <option value="Unpolish">Unpolish</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Variety</label>
                <input
                  type="text"
                  value={editingRiceMovement.variety || ''}
                  onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, variety: e.target.value })}
                  placeholder="e.g., DEC25 KNM"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Bags</label>
                  <input
                    type="number"
                    value={editingRiceMovement.bags || 0}
                    onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, bags: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1.5px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Bag Size (kg)</label>
                  <input
                    type="number"
                    value={editingRiceMovement.bag_size_kg || editingRiceMovement.bagSizeKg || 26}
                    onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, bagSizeKg: parseFloat(e.target.value) || 26, bag_size_kg: parseFloat(e.target.value) || 26 })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1.5px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Packaging Brand</label>
                <select
                  value={editingRiceMovement.packaging_brand || editingRiceMovement.packagingBrand || ''}
                  onChange={(e) => {
                    const selectedPkg = packagings.find(pkg => pkg.brandName === e.target.value);
                    setEditingRiceMovement({
                      ...editingRiceMovement,
                      packagingBrand: e.target.value,
                      packaging_brand: e.target.value,
                      packagingId: selectedPkg?.id || editingRiceMovement.packagingId,
                      bagSizeKg: selectedPkg?.allottedKg || editingRiceMovement.bagSizeKg,
                      bag_size_kg: selectedPkg?.allottedKg || editingRiceMovement.bagSizeKg,
                      packagingKg: selectedPkg?.allottedKg || editingRiceMovement.bagSizeKg
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select Packaging</option>
                  {packagings.map((pkg: any) => (
                    <option key={pkg.id} value={pkg.brandName}>{pkg.brandName} ({pkg.allottedKg}kg)</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Location Code</label>
                <select
                  value={editingRiceMovement.location_code || editingRiceMovement.locationCode || ''}
                  onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, locationCode: e.target.value, location_code: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">Select Location</option>
                  {riceStockLocations.map((loc: any) => (
                    <option key={loc.code} value={loc.code}>{loc.code} - {loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Bill/Lorry Numbers - Only for Sale/Purchase */}
              {(editingRiceMovement.movementType === 'sale' || editingRiceMovement.movementType === 'purchase') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Bill Number</label>
                    <input
                      type="text"
                      value={editingRiceMovement.bill_number || editingRiceMovement.billNumber || ''}
                      onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, billNumber: e.target.value, bill_number: e.target.value })}
                      placeholder="Bill #"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1.5px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>Lorry Number</label>
                    <input
                      type="text"
                      value={editingRiceMovement.lorry_number || editingRiceMovement.lorryNumber || ''}
                      onChange={(e) => setEditingRiceMovement({ ...editingRiceMovement, lorryNumber: e.target.value, lorry_number: e.target.value })}
                      placeholder="MH-12-XX-1234"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1.5px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Palti-specific fields */}
              {editingRiceMovement.movementType === 'palti' && (
                <div style={{
                  background: '#f5f3ff',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid #c4b5fd'
                }}>
                  <div style={{ fontWeight: '600', color: '#7c3aed', marginBottom: '8px' }}>🔄 Palti Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem' }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>From:</span> {editingRiceMovement.from_location || editingRiceMovement.fromLocation || 'N/A'}
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>To:</span> {editingRiceMovement.to_location || editingRiceMovement.toLocation || 'N/A'}
                    </div>
                    {(editingRiceMovement.shortage_kg || editingRiceMovement.shortageKg) && (
                      <div style={{ gridColumn: '1 / -1', color: '#dc2626', fontWeight: '600' }}>
                        ⚠️ Shortage: {editingRiceMovement.shortage_kg || editingRiceMovement.shortageKg} kg
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quantity Display */}
              <div style={{
                background: '#f0fdf4',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '24px',
                border: '1px solid #86efac'
              }}>
                <div style={{ fontWeight: '600', color: '#16a34a', marginBottom: '4px' }}>📊 Calculated Quantity</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#15803d' }}>
                  {((editingRiceMovement.bags || 0) * ((editingRiceMovement.bag_size_kg || editingRiceMovement.bagSizeKg || 26) / 100)).toFixed(2)} Qtls
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  ({editingRiceMovement.bags || 0} bags × {editingRiceMovement.bag_size_kg || editingRiceMovement.bagSizeKg || 26}kg)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingRiceMovement(null)}
                  style={{
                    padding: '10px 20px',
                    background: '#f3f4f6',
                    color: '#4b5563',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateRiceMovement(editingRiceMovement)}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  💾 Save Changes
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
          `}</style>
        </div>,
        document.body
      )}
    </Container>
  );
};

export default Records;
// Trigger check: 2026-01-06 10:26:54
