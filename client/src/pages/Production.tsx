import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { toast } from '../utils/toast';

const Container = styled.div`
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: #1f2937;
  margin-bottom: 2rem;
  font-size: 2rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  
  @media (max-width: 968px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const CardTitle = styled.h2`
  color: #374151;
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f3f4f6;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  color: #374151;
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
`;

const Th = styled.th`
  background: #f8fafc;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
`;

const Td = styled.td`
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  color: #4b5563;
`;

const DeleteButton = styled.button`
  background: #ef4444;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #dc2626;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #9ca3af;

  p:first-child {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
`;

interface Outturn {
  id: number;
  code: string;
  allottedVariety: string;
  creator: {
    username: string;
  };
  createdAt: string;
}

const Production: React.FC = () => {
  const [outturns, setOutturns] = useState<Outturn[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    allottedVariety: ''
  });

  useEffect(() => {
    fetchOutturns();
    fetchVarieties();
  }, []);

  const fetchOutturns = async () => {
    try {
      const response = await axios.get<Outturn[]>('/outturns');
      setOutturns(response.data);
    } catch (error) {
      console.error('Error fetching outturns:', error);
      toast.error('Failed to fetch outturns');
    }
  };

  const fetchVarieties = async () => {
    try {
      const response = await axios.get<{ varieties: Array<{ name: string; id: number; code: string }> }>('/locations/varieties');
      const varietyNames = response.data.varieties.map((v) => v.name);
      setVarieties(varietyNames);
    } catch (error) {
      console.error('Error fetching varieties:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.allottedVariety) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/outturns', formData);
      toast.success('Outturn created successfully!');
      setFormData({ code: '', allottedVariety: '' });
      fetchOutturns();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create outturn');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this outturn?')) {
      return;
    }

    try {
      await axios.delete(`/outturns/${id}`);
      toast.success('Outturn deleted successfully!');
      fetchOutturns();
    } catch (error) {
      toast.error('Failed to delete outturn');
    }
  };

  return (
    <Container>
      <Title>Production</Title>

      <Grid>
        <Card>
          <CardTitle>Create New Outturn</CardTitle>

          <form onSubmit={handleSubmit}>
            <FormGroup>
              <Label>Outturn Code *</Label>
              <Input
                type="text"
                placeholder="e.g., Outt1, Outt2, etc."
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </FormGroup>

            <FormGroup>
              <Label>Allot Variety *</Label>
              <Select
                value={formData.allottedVariety}
                onChange={(e) => setFormData({ ...formData, allottedVariety: e.target.value })}
              >
                <option value="">Select Variety</option>
                {varieties.map((variety) => (
                  <option key={variety} value={variety}>{variety}</option>
                ))}
              </Select>
            </FormGroup>

            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : '+ Add New'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Outturn's recorded in the system</CardTitle>

          {outturns.length === 0 ? (
            <EmptyState>
              <p>📋</p>
              <p>No outturns created yet</p>
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Outturn</Th>
                  <Th>Variety Alloted</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {outturns.map((outturn) => (
                  <tr key={outturn.id}>
                    <Td>{outturn.code}</Td>
                    <Td>{outturn.allottedVariety}</Td>
                    <Td>
                      <DeleteButton onClick={() => handleDelete(outturn.id)}>
                        Delete
                      </DeleteButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Grid>
    </Container>
  );
};

export default Production;
