import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { toast } from '../utils/toast';
import { NotificationMessages } from '../utils/notificationMessages';
import { useLocation as useLocationContext } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import PaddyHamaliRatesTable from '../components/PaddyHamaliRatesTable';
import RiceHamaliRatesTable from '../components/RiceHamaliRatesTable';

const Container = styled.div`
  animation: fadeIn 0.5s ease-in;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
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

const Tab = styled.button<{ active: boolean }>`
  padding: 1rem 2rem;
  border: none;
  background: ${props => props.active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.3s ease;
  
  &:hover {
    background: ${props => props.active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#f3f4f6'};
    color: ${props => props.active ? 'white' : '#374151'};
  }
`;

const SectionContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  border: 2px solid #f3f4f6;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
`;

const SectionTitle = styled.h2`
  color: #1f2937;
  font-size: 1.5rem;
  margin: 0;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &.primary {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
  }

  &.secondary {
    background: #6b7280;
    color: white;
  }

  &.success {
    background: #10b981;
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

const CreateFormContainer = styled.div`
  background: #f8fafc;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 2px solid #e5e7eb;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
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

const Input = styled.input`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  text-transform: uppercase;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
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
  color: #4b5563;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const IconButton = styled.button`
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  
  &.edit {
    background: #3b82f6;
    color: white;
    
    &:hover {
      background: #2563eb;
    }
  }
  
  &.delete {
    background: #ef4444;
    color: white;
    
    &:hover {
      background: #dc2626;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  font-size: 1.1rem;
`;

const Locations: React.FC = () => {
  const { user } = useAuth();
  const { warehouses, kunchinittus, varieties, riceVarieties, fetchWarehouses, fetchKunchinittus, fetchVarieties, fetchRiceVarieties } = useLocationContext();
  const [activeTab, setActiveTab] = useState<'warehouse' | 'kunchinittu' | 'variety' | 'riceVariety' | 'production' | 'packaging' | 'riceStockLocation' | 'hamali' | 'riceHamali' | 'broker'>('warehouse');

  // Warehouse form
  const [warehouseName, setWarehouseName] = useState('');
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);

  // Kunchinittu form
  const [kunchinintuName, setKunchinintuName] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedVarietyId, setSelectedVarietyId] = useState('');
  const [editingKunchinittu, setEditingKunchinittu] = useState<any>(null);

  // Variety form
  const [varietyName, setVarietyName] = useState('');
  const [editingVariety, setEditingVariety] = useState<any>(null);

  // Rice Variety form
  const [riceVarietyName, setRiceVarietyName] = useState('');
  const [editingRiceVariety, setEditingRiceVariety] = useState<any>(null);

  // Broker form
  const [brokerName, setBrokerName] = useState('');
  const [brokerDescription, setBrokerDescription] = useState('');
  const [brokers, setBrokers] = useState<any[]>([]);
  const [editingBroker, setEditingBroker] = useState<any>(null);

  // Production (Outturn) form
  const [outturnCode, setOutturnCode] = useState('');
  const [allottedVariety, setAllottedVariety] = useState('');
  const [outturnType, setOutturnType] = useState<'Raw' | 'Steam'>('Raw');
  const [outturns, setOutturns] = useState<any[]>([]);
  const [editingOutturn, setEditingOutturn] = useState<any>(null);

  // Packaging form
  const [packagingBrandName, setPackagingBrandName] = useState('');
  const [packagingKg, setPackagingKg] = useState('25');
  const [packagings, setPackagings] = useState<any[]>([]);
  const [editingPackaging, setEditingPackaging] = useState<any>(null);

  // Rice Stock Location form
  const [riceStockLocationCode, setRiceStockLocationCode] = useState('');
  const [riceStockLocationName, setRiceStockLocationName] = useState('');
  const [riceStockLocations, setRiceStockLocations] = useState<any[]>([]);
  const [editingRiceStockLocation, setEditingRiceStockLocation] = useState<any>(null);

  // Hamali rates form
  const [loadingRate, setLoadingRate] = useState('');
  const [unloadingSadaRate, setUnloadingSadaRate] = useState('');
  const [unloadingKnRate, setUnloadingKnRate] = useState('');
  const [looseTumbidduRate, setLooseTumbidduRate] = useState('');
  const [hamaliRatesId, setHamaliRatesId] = useState<number | null>(null);
  const [editingHamaliRates, setEditingHamaliRates] = useState(false);

  const canEdit = user?.role === 'manager' || user?.role === 'admin';

  useEffect(() => {
    fetchWarehouses();
    fetchKunchinittus();
    fetchVarieties();
  }, []);

  useEffect(() => {
    if (activeTab === 'production') {
      fetchOutturns();
    } else if (activeTab === 'packaging') {
      fetchPackagings();
    } else if (activeTab === 'riceStockLocation') {
      fetchRiceStockLocations();
    } else if (activeTab === 'riceVariety') {
      fetchRiceVarieties();
    } else if (activeTab === 'hamali') {
      fetchHamaliRates();
    } else if (activeTab === 'broker') {
      fetchBrokers();
    }
  }, [activeTab]);

  const fetchOutturns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<any[]>('/outturns', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setOutturns(data);

      // Auto-generate next outturn code
      if (data.length > 0) {
        // Find the latest code (assuming format YY-SEQUENCE, e.g., 24-01)
        // Sort by ID descending to get the latest created
        const sortedOutturns = [...data].sort((a, b) => b.id - a.id);
        const latestOutturn = sortedOutturns[0];

        if (latestOutturn && latestOutturn.code) {
          const parts = latestOutturn.code.split('-');
          if (parts.length === 2) {
            const year = parts[0];
            const sequence = parseInt(parts[1]);

            // Check if it's the same year
            const currentYear = new Date().getFullYear().toString().slice(-2);

            if (year === currentYear && !isNaN(sequence)) {
              const nextSequence = (sequence + 1).toString().padStart(2, '0');
              setOutturnCode(`${currentYear}-${nextSequence}`);
            } else {
              // New year or invalid format, start fresh for current year
              setOutturnCode(`${currentYear}-01`);
            }
          } else {
            // Different format, start fresh for current year
            const currentYear = new Date().getFullYear().toString().slice(-2);
            setOutturnCode(`${currentYear}-01`);
          }
        }
      } else {
        // No outturns yet, start with current year
        const currentYear = new Date().getFullYear().toString().slice(-2);
        setOutturnCode(`${currentYear}-01`);
      }
    } catch (error) {
      console.error('Error fetching outturns:', error);
      toast.error('Failed to fetch outturns');
    }
  };

  const handleCreateOutturn = async () => {
    if (!outturnCode.trim() || !allottedVariety.trim()) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      if (editingOutturn) {
        // Update existing outturn
        await axios.put(`/outturns/${editingOutturn.id}`,
          { code: outturnCode, allottedVariety, type: outturnType },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Outturn updated successfully!');
        setEditingOutturn(null);
      } else {
        // Create new outturn
        await axios.post('/outturns',
          { code: outturnCode, allottedVariety, type: outturnType },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Outturn created successfully');
      }

      setOutturnCode('');
      setAllottedVariety('');
      setOutturnType('Raw');
      fetchOutturns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingOutturn ? 'Failed to update outturn' : 'Failed to create outturn'));
    }
  };

  const handleEditOutturn = (outturn: any) => {
    setEditingOutturn(outturn);
    setOutturnCode(outturn.code);
    setAllottedVariety(outturn.allottedVariety);
    setOutturnType(outturn.type || 'Raw');
  };

  const handleCancelOutturnEdit = () => {
    setEditingOutturn(null);
    setOutturnCode('');
    setAllottedVariety('');
    setOutturnType('Raw');
    fetchOutturns(); // Re-generate next code
  };

  const handleDeleteOutturn = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this outturn?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/outturns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Outturn deleted successfully');
      fetchOutturns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete outturn');
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseName.trim()) {
      toast.error('Please enter warehouse name');
      return;
    }

    try {
      const code = warehouseName.substring(0, 10).toUpperCase();

      if (editingWarehouse) {
        // Update existing
        await axios.put(`/locations/warehouses/${editingWarehouse.id}`, {
          name: warehouseName.toUpperCase(),
          code: editingWarehouse.code, // Keep existing code
          isActive: true
        });
        toast.success('Warehouse updated successfully!');
        setEditingWarehouse(null);
      } else {
        // Create new
        await axios.post('/locations/warehouses', {
          name: warehouseName.toUpperCase(),
          code,
          isActive: true
        });
        toast.success('Warehouse created successfully!');
      }

      setWarehouseName('');
      fetchWarehouses();
    } catch (error) {
      toast.error(editingWarehouse ? 'Failed to update warehouse' : 'Failed to create warehouse');
    }
  };

  const handleCreateKunchinittu = async () => {
    if (!kunchinintuName.trim() || !selectedWarehouseId || !selectedVarietyId) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const code = kunchinintuName.substring(0, 10).toUpperCase();

      if (editingKunchinittu) {
        // Update existing
        await axios.put(`/locations/kunchinittus/${editingKunchinittu.id}`, {
          name: kunchinintuName.toUpperCase(),
          code: editingKunchinittu.code,
          warehouseId: parseInt(selectedWarehouseId),
          varietyId: parseInt(selectedVarietyId),
          isActive: true
        });
        toast.success('KanchiNittu updated successfully!');
        setEditingKunchinittu(null);
      } else {
        // Create new
        await axios.post('/locations/kunchinittus', {
          name: kunchinintuName.toUpperCase(),
          code,
          warehouseId: parseInt(selectedWarehouseId),
          varietyId: parseInt(selectedVarietyId),
          isActive: true
        });
        toast.success('KanchiNittu created successfully!');
      }

      setKunchinintuName('');
      setSelectedWarehouseId('');
      setSelectedVarietyId('');
      fetchKunchinittus();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || (editingKunchinittu ? 'Failed to update KanchiNittu' : 'Failed to create KanchiNittu');
      toast.error(errorMessage);
    }
  };

  const handleCreateVariety = async () => {
    if (!varietyName.trim()) {
      toast.error('Please enter variety name');
      return;
    }

    try {
      const code = varietyName.substring(0, 10).toUpperCase();

      if (editingVariety) {
        // Update existing
        await axios.put(`/locations/varieties/${editingVariety.id}`, {
          name: varietyName.toUpperCase(),
          code: editingVariety.code,
          isActive: true
        });
        toast.success('Variety updated successfully!');
        setEditingVariety(null);
      } else {
        // Create new
        await axios.post('/locations/varieties', {
          name: varietyName.toUpperCase(),
          code,
          isActive: true
        });
        toast.success('Variety created successfully!');
      }

      setVarietyName('');
      fetchVarieties();
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingVariety ? 'Failed to update variety' : 'Failed to create variety'));
    }
  };

  const handleCreateRiceVariety = async () => {
    if (!riceVarietyName.trim()) {
      toast.error('Please enter rice variety name');
      return;
    }

    try {
      const code = riceVarietyName.substring(0, 15).toUpperCase().replace(/\s+/g, '-');

      if (editingRiceVariety) {
        await axios.put(`/locations/rice-varieties/${editingRiceVariety.id}`, {
          name: riceVarietyName.toUpperCase(),
          code, // Re-generate or keep? Let's re-generate for simplicity or allow edit code later
          isActive: true
        });
        toast.success('Rice Variety updated successfully!');
        setEditingRiceVariety(null);
      } else {
        await axios.post('/locations/rice-varieties', {
          name: riceVarietyName.toUpperCase(),
          code,
          isActive: true
        });
        toast.success('Rice Variety created successfully!');
      }

      setRiceVarietyName('');
      fetchRiceVarieties();
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingRiceVariety ? 'Failed to update rice variety' : 'Failed to create rice variety'));
    }
  };

  const handleDelete = async (type: string, id: number) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) {
      return;
    }

    try {
      await axios.delete(`/locations/${type === 'riceVariety' ? 'rice-varieties' : type + 's'}/${id}`);

      toast.success(`${type === 'riceVariety' ? 'Rice Variety' : type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);

      if (type === 'warehouse') fetchWarehouses();
      if (type === 'kunchinittu') fetchKunchinittus();
      if (type === 'variety') fetchVarieties();
      if (type === 'riceVariety') fetchRiceVarieties();
    } catch (error) {
      toast.error(`Failed to delete ${type}`);
    }
  };

  const handleEdit = (type: string, item: any) => {
    if (type === 'warehouse') {
      setEditingWarehouse(item);
      setWarehouseName(item.name);
    } else if (type === 'variety') {
      setEditingVariety(item);
      setVarietyName(item.name);
    } else if (type === 'kunchinittu') {
      setEditingKunchinittu(item);
      setKunchinintuName(item.name);
      setSelectedWarehouseId(item.warehouseId?.toString() || '');
      setSelectedVarietyId(item.varietyId?.toString() || '');
    } else if (type === 'riceVariety') {
      setEditingRiceVariety(item);
      setRiceVarietyName(item.name);
    }
  };

  const handleCancelEdit = () => {
    setEditingWarehouse(null);
    setEditingVariety(null);
    setEditingKunchinittu(null);
    setWarehouseName('');
    setVarietyName('');
    setKunchinintuName('');
    setRiceVarietyName('');
    setSelectedWarehouseId('');
    setSelectedVarietyId('');
    setEditingPackaging(null);
    setPackagingBrandName('');
    setEditingRiceVariety(null);
    setPackagingKg('25');
    setEditingRiceStockLocation(null);
    setRiceStockLocationCode('');
    setRiceStockLocationName('');
    setEditingBroker(null);
    setBrokerName('');
    setBrokerDescription('');
  };

  // Packaging functions
  const fetchPackagings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ packagings: any[] }>('/packagings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPackagings(response.data.packagings || []);
    } catch (error) {
      console.error('Error fetching packagings:', error);
      toast.error('Failed to fetch packagings');
    }
  };

  const handleCreatePackaging = async () => {
    if (!packagingBrandName.trim()) {
      toast.error('Please fill brand name');
      return;
    }

    if (!packagingKg || parseFloat(packagingKg) <= 0) {
      toast.error('Please enter a valid KG value');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        brandName: packagingBrandName.trim(),
        code: packagingBrandName.trim(), // Use brand name as code
        allottedKg: parseFloat(packagingKg)
      };

      if (editingPackaging) {
        const response = await axios.put(`/packagings/${editingPackaging.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Packaging updated successfully and related records recalculated!');
      } else {
        await axios.post('/packagings', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Packaging created successfully!');
      }

      setPackagingBrandName('');
      setPackagingKg('25');
      setEditingPackaging(null);
      await fetchPackagings();
    } catch (error: any) {
      console.error('Packaging operation error:', error);
      toast.error(error.response?.data?.error || (editingPackaging ? 'Failed to update packaging' : 'Failed to create packaging'));
    }
  };

  const handleDeletePackaging = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this packaging?')) {
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/packagings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Packaging deleted successfully!');
      fetchPackagings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete packaging');
    }
  };

  const handleEditPackaging = (packaging: any) => {
    setEditingPackaging(packaging);
    setPackagingBrandName(packaging.brandName);
    setPackagingKg(packaging.allottedKg);
  };

  // Rice Stock Location functions
  const fetchRiceStockLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ locations: any[] }>('/locations/rice-stock-locations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRiceStockLocations(response.data.locations || []);
    } catch (error) {
      console.error('Error fetching rice stock locations:', error);
      toast.error('Failed to fetch rice stock locations');
    }
  };

  const handleCreateRiceStockLocation = async () => {
    if (!riceStockLocationCode.trim()) {
      toast.error('Please enter location code');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        code: riceStockLocationCode.trim().toUpperCase(),
        name: riceStockLocationName.trim() || null
      };

      if (editingRiceStockLocation) {
        await axios.put(`/locations/rice-stock-locations/${editingRiceStockLocation.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Rice stock location updated successfully!');
      } else {
        await axios.post('/locations/rice-stock-locations', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Rice stock location created successfully!');
      }

      setRiceStockLocationCode('');
      setRiceStockLocationName('');
      setEditingRiceStockLocation(null);
      fetchRiceStockLocations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingRiceStockLocation ? 'Failed to update location' : 'Failed to create location'));
    }
  };

  const handleDeleteRiceStockLocation = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this rice stock location?')) {
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/locations/rice-stock-locations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Rice stock location deleted successfully!');
      fetchRiceStockLocations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete location');
    }
  };

  const handleEditRiceStockLocation = (location: any) => {
    setEditingRiceStockLocation(location);
    setRiceStockLocationCode(location.code);
    setRiceStockLocationName(location.name || '');
  };

  // Hamali rates functions
  const fetchHamaliRates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ rates: any }>('/hamali-rates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rates = response.data.rates;
      setLoadingRate(rates.loadingRate?.toString() || '0');
      setUnloadingSadaRate(rates.unloadingSadaRate?.toString() || '0');
      setUnloadingKnRate(rates.unloadingKnRate?.toString() || '0');
      setLooseTumbidduRate(rates.looseTumbidduRate?.toString() || '0');
      setHamaliRatesId(rates.id || null);
    } catch (error) {
      console.error('Error fetching hamali rates:', error);
      toast.error('Failed to fetch hamali rates');
    }
  };

  const handleSaveHamaliRates = async () => {
    if (!loadingRate || !unloadingSadaRate || !unloadingKnRate || !looseTumbidduRate) {
      toast.error('Please fill all rate fields');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        loadingRate: parseFloat(loadingRate),
        unloadingSadaRate: parseFloat(unloadingSadaRate),
        unloadingKnRate: parseFloat(unloadingKnRate),
        looseTumbidduRate: parseFloat(looseTumbidduRate)
      };

      await axios.post('/hamali-rates', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(NotificationMessages.hamali.ratesUpdated);
      setEditingHamaliRates(false);
      fetchHamaliRates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save hamali rates');
    }
  };

  const handleEditHamaliRates = () => {
    setEditingHamaliRates(true);
  };

  const handleCancelHamaliEdit = () => {
    setEditingHamaliRates(false);
    fetchHamaliRates();
  };

  // Broker functions
  const fetchBrokers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<{ brokers: any[] }>('/locations/brokers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBrokers(response.data.brokers || []);
    } catch (error) {
      console.error('Error fetching brokers:', error);
      toast.error('Failed to fetch brokers');
    }
  };

  const handleCreateBroker = async () => {
    if (!brokerName.trim()) {
      toast.error('Please enter broker name');
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: brokerName.trim().toUpperCase(),
        description: brokerDescription.trim() || null
      };

      if (editingBroker) {
        await axios.put(`/locations/brokers/${editingBroker.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Broker updated successfully!');
      } else {
        await axios.post('/locations/brokers', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Broker created successfully!');
      }

      setBrokerName('');
      setBrokerDescription('');
      setEditingBroker(null);
      fetchBrokers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || (editingBroker ? 'Failed to update broker' : 'Failed to create broker'));
    }
  };

  const handleDeleteBroker = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this broker?')) {
      return;
    }

    if (!canEdit) {
      toast.error('You do not have permission to perform this action');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/locations/brokers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Broker deleted successfully!');
      fetchBrokers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete broker');
    }
  };

  const handleEditBroker = (broker: any) => {
    setEditingBroker(broker);
    setBrokerName(broker.name);
    setBrokerDescription(broker.description || '');
  };

  return (
    <Container>
      <Title>📍 Location Management</Title>

      <TabContainer>
        <Tab active={activeTab === 'warehouse'} onClick={() => setActiveTab('warehouse')}>
          Warehouse
        </Tab>
        <Tab active={activeTab === 'variety'} onClick={() => setActiveTab('variety')}>
          Variety
        </Tab>
        <Tab active={activeTab === 'kunchinittu'} onClick={() => setActiveTab('kunchinittu')}>
          KanchiNittu
        </Tab>
        <Tab active={activeTab === 'production'} onClick={() => setActiveTab('production')}>
          Production
        </Tab>
        <Tab active={activeTab === 'packaging'} onClick={() => setActiveTab('packaging')}>
          Packaging
        </Tab>
        <Tab active={activeTab === 'riceStockLocation'} onClick={() => setActiveTab('riceStockLocation')}>
          Rice Stock Locations
        </Tab>
        <Tab active={activeTab === 'riceVariety'} onClick={() => setActiveTab('riceVariety')}>
          Rice Varieties
        </Tab>
        <Tab active={activeTab === 'broker'} onClick={() => setActiveTab('broker')}>
          Brokers
        </Tab>
        <Tab active={activeTab === 'hamali'} onClick={() => setActiveTab('hamali')}>
          Paddy Hamali
        </Tab>
        <Tab active={activeTab === 'riceHamali'} onClick={() => setActiveTab('riceHamali')}>
          Rice Hamali
        </Tab>
      </TabContainer>

      <SectionContainer>
        {activeTab === 'warehouse' && (
          <>
            <SectionHeader>
              <SectionTitle>Create New Warehouse</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Warehouse Name</Label>
                  <Input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="Enter warehouse name"
                  />
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingWarehouse && (
                    <Button className="secondary" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateWarehouse}>
                    {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
                  </Button>
                </div>
              </div>

              {/* Right Column - Warehouses Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Warehouses</h3>
                {warehouses.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No warehouses created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Warehouse Name</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {warehouses.map((warehouse) => (
                        <tr key={warehouse.id}>
                          <Td>{warehouse.name}</Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEdit('warehouse', warehouse)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDelete('warehouse', warehouse.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'variety' && (
          <>
            <SectionHeader>
              <SectionTitle>Create New Variety</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Variety Name</Label>
                  <Input
                    type="text"
                    value={varietyName}
                    onChange={(e) => setVarietyName(e.target.value)}
                    placeholder="Enter variety name"
                  />
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingVariety && (
                    <Button className="secondary" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateVariety}>
                    {editingVariety ? 'Update Variety' : 'Create Variety'}
                  </Button>
                </div>
              </div>

              {/* Right Column - Varieties Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Varieties</h3>
                {varieties.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No varieties created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Variety Name</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {varieties.map((variety) => (
                        <tr key={variety.id}>
                          <Td>{variety.name}</Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEdit('variety', variety)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDelete('variety', variety.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'kunchinittu' && (
          <>
            <SectionHeader>
              <SectionTitle>Create New KN</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>KN Name</Label>
                  <Input
                    type="text"
                    value={kunchinintuName}
                    onChange={(e) => setKunchinintuName(e.target.value)}
                    placeholder="Enter KN name"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Alloted Warehouse</Label>
                  <Select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  >
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>Alloted Variety</Label>
                  <Select
                    value={selectedVarietyId}
                    onChange={(e) => setSelectedVarietyId(e.target.value)}
                  >
                    <option value="">-- Select Variety --</option>
                    {varieties.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </Select>
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingKunchinittu && (
                    <Button className="secondary" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateKunchinittu}>
                    {editingKunchinittu ? 'Update KN' : 'Create KN'}
                  </Button>
                </div>
              </div>

              {/* Right Column - KanchiNittus Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing KN</h3>
                {kunchinittus.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No KanchiNittus created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>KanchiNittu</Th>
                        <Th>Alloted Warehouse</Th>
                        <Th>Alloted Variety</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {kunchinittus.map((kn) => (
                        <tr key={kn.id}>
                          <Td>{kn.name}</Td>
                          <Td>{kn.warehouse?.name || '-'}</Td>
                          <Td>{kn.variety?.name || '-'}</Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEdit('kunchinittu', kn)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDelete('kunchinittu', kn.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'riceVariety' && (
          <>
            <SectionHeader>
              <SectionTitle>Rice Variety Management</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Rice Variety Name</Label>
                  <Input
                    type="text"
                    value={riceVarietyName}
                    onChange={(e) => setRiceVarietyName(e.target.value)}
                    placeholder="e.g., SUM25 RNR RAW"
                  />
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {editingRiceVariety && (
                    <Button className="secondary" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateRiceVariety}>
                    {editingRiceVariety ? 'Update Rice Variety' : 'Create Rice Variety'}
                  </Button>
                </div>
              </div>

              {/* Right Column - Rice Varieties Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Rice Varieties</h3>
                {riceVarieties.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No rice varieties created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Name</Th>
                        <Th>Code</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {riceVarieties.map((v: any) => (
                        <tr key={v.id}>
                          <Td style={{ fontWeight: '600' }}>{v.name}</Td>
                          <Td>{v.code}</Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEdit('riceVariety', v)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDelete('riceVariety', v.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}
        {activeTab === 'production' && (
          <>
            <SectionHeader>
              <SectionTitle>Create Outturn</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Outturn Code</Label>
                  <Input
                    type="text"
                    value={outturnCode}
                    onChange={(e) => setOutturnCode(e.target.value)}
                    placeholder="Enter outturn code"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Allotted Variety</Label>
                  <Select
                    value={allottedVariety}
                    onChange={(e) => setAllottedVariety(e.target.value)}
                  >
                    <option value="">-- Select Variety --</option>
                    {varieties.map((variety: any) => (
                      <option key={variety.id} value={variety.name}>
                        {variety.name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>Type</Label>
                  <Select
                    value={outturnType}
                    onChange={(e) => setOutturnType(e.target.value as 'Raw' | 'Steam')}
                  >
                    <option value="Raw">Raw</option>
                    <option value="Steam">Steam</option>
                  </Select>
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingOutturn && (
                    <Button className="secondary" onClick={handleCancelOutturnEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateOutturn}>
                    {editingOutturn ? 'Update Outturn' : 'Create Outturn'}
                  </Button>
                </div>
              </div>

              {/* Right Column - Outturns Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Outturns</h3>
                {outturns.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No outturns created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Code</Th>
                        <Th>Allotted Variety</Th>
                        <Th>Type</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {outturns.map((outturn: any) => (
                        <tr key={outturn.id}>
                          <Td>{outturn.code}</Td>
                          <Td>{outturn.allottedVariety}</Td>
                          <Td>{outturn.type || 'Raw'}</Td>
                          <Td>
                            <ActionButtons>
                              <IconButton className="edit" onClick={() => handleEditOutturn(outturn)}>
                                ✏️
                              </IconButton>
                              <IconButton className="delete" onClick={() => handleDeleteOutturn(outturn.id)}>
                                🗑️
                              </IconButton>
                            </ActionButtons>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'packaging' && (
          <>
            <SectionHeader>
              <SectionTitle>Packaging / Brand Management</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Brand Name *</Label>
                  <Input
                    type="text"
                    value={packagingBrandName}
                    onChange={(e) => setPackagingBrandName(e.target.value)}
                    placeholder="e.g., A1, B1, Premium"
                    disabled={!canEdit}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Allotted KG per Bag *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999.99"
                    value={packagingKg}
                    onChange={(e) => setPackagingKg(e.target.value)}
                    placeholder="e.g., 25, 26.5, 30"
                    disabled={!canEdit}
                  />
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingPackaging && (
                    <Button className="secondary" onClick={handleCancelEdit} disabled={!canEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreatePackaging} disabled={!canEdit}>
                    {editingPackaging ? 'Update Packaging' : 'Create Packaging'}
                  </Button>
                </div>

                {!canEdit && (
                  <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                    Only Managers and Admins can create/edit packagings
                  </p>
                )}
              </div>

              {/* Right Column - Packagings Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Packagings</h3>
                {packagings.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No packagings created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Brand Name</Th>
                        <Th>KG/Bag</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {packagings.map((pkg: any) => (
                        <tr key={pkg.id}>
                          <Td style={{ fontWeight: '600' }}>{pkg.brandName}</Td>
                          <Td>{pkg.allottedKg} KG</Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEditPackaging(pkg)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDeletePackaging(pkg.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'riceStockLocation' && (
          <>
            <SectionHeader>
              <SectionTitle>Rice Stock Location Management</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Location Code *</Label>
                  <Input
                    type="text"
                    value={riceStockLocationCode}
                    onChange={(e) => setRiceStockLocationCode(e.target.value)}
                    placeholder="e.g., A1, A2, B8"
                    disabled={!canEdit}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Description (Optional)</Label>
                  <Input
                    type="text"
                    value={riceStockLocationName}
                    onChange={(e) => setRiceStockLocationName(e.target.value)}
                    placeholder="e.g., Storage Area A1"
                    disabled={!canEdit}
                  />
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingRiceStockLocation && (
                    <Button className="secondary" onClick={handleCancelEdit} disabled={!canEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateRiceStockLocation} disabled={!canEdit}>
                    {editingRiceStockLocation ? 'Update Location' : 'Create Location'}
                  </Button>
                </div>

                {!canEdit && (
                  <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                    Only Managers and Admins can create/edit rice stock locations
                  </p>
                )}
              </div>

              {/* Right Column - Locations Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Rice Stock Locations</h3>
                {riceStockLocations.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No rice stock locations created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Code</Th>
                        <Th>Description</Th>
                        <Th>Status</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {riceStockLocations.map((location: any) => (
                        <tr key={location.id}>
                          <Td style={{ fontWeight: '600' }}>{location.code}</Td>
                          <Td>{location.name || '-'}</Td>
                          <Td>
                            <span style={{
                              color: location.isActive ? '#10b981' : '#6b7280',
                              fontWeight: '600'
                            }}>
                              {location.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEditRiceStockLocation(location)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDeleteRiceStockLocation(location.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'hamali' && (
          <PaddyHamaliRatesTable canEdit={canEdit} />
        )}

        {activeTab === 'riceHamali' && (
          <RiceHamaliRatesTable />
        )}

        {activeTab === 'broker' && (
          <>
            <SectionHeader>
              <SectionTitle>Broker Management</SectionTitle>
            </SectionHeader>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column - Creation Form */}
              <div>
                <FormGroup>
                  <Label>Broker Name *</Label>
                  <Input
                    type="text"
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                    placeholder="Enter broker name"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Description (Optional)</Label>
                  <Input
                    type="text"
                    value={brokerDescription}
                    onChange={(e) => setBrokerDescription(e.target.value)}
                    placeholder="Enter description"
                  />
                </FormGroup>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {editingBroker && (
                    <Button className="secondary" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  )}
                  <Button className="primary" onClick={handleCreateBroker} disabled={!canEdit}>
                    {editingBroker ? 'Update Broker' : 'Create Broker'}
                  </Button>
                </div>
              </div>

              {/* Right Column - Brokers Table */}
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#1f2937' }}>Existing Brokers</h3>
                {brokers.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No brokers created yet
                  </p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Broker Name</Th>
                        <Th>Description</Th>
                        {canEdit && <Th>Actions</Th>}
                      </tr>
                    </thead>
                    <tbody>
                      {brokers.map((broker) => (
                        <tr key={broker.id}>
                          <Td>{broker.name}</Td>
                          <Td>{broker.description || '-'}</Td>
                          {canEdit && (
                            <Td>
                              <ActionButtons>
                                <IconButton className="edit" onClick={() => handleEditBroker(broker)}>
                                  ✏️
                                </IconButton>
                                <IconButton className="delete" onClick={() => handleDeleteBroker(broker.id)}>
                                  🗑️
                                </IconButton>
                              </ActionButtons>
                            </Td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}
      </SectionContainer>
    </Container>
  );
};

export default Locations;
