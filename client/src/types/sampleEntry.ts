export type EntryType = 'CREATE_NEW' | 'DIRECT_LOADED_VEHICLE' | 'LOCATION_SAMPLE' | 'RICE_SAMPLE';

export type WorkflowStatus =
  | 'STAFF_ENTRY'
  | 'QUALITY_CHECK'
  | 'LOT_SELECTION'
  | 'COOKING_REPORT'
  | 'FINAL_REPORT'
  | 'LOT_ALLOTMENT'
  | 'PHYSICAL_INSPECTION'
  | 'INVENTORY_ENTRY'
  | 'OWNER_FINANCIAL'
  | 'MANAGER_FINANCIAL'
  | 'FINAL_REVIEW'
  | 'COMPLETED'
  | 'FAILED';

export type CookingReportStatus = 'PASS' | 'FAIL' | 'RECHECK' | 'MEDIUM';

export type SuteType = 'PER_BAG' | 'PER_TON';

export type BaseRateType = 'PD_LOOSE' | 'PD_WB' | 'MD_LOOSE' | 'MD_WB';

export type CalculationUnit = 'PER_BAG' | 'PER_QUINTAL';

export type PriceType = 'BAGS' | 'LOOSE';

export interface SampleEntry {
  id: number;
  serialNo?: number;
  entryDate: string;
  entryType: EntryType;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  lorryNumber?: string;
  packaging?: '75' | '40' | '26 kg' | '50 kg' | 'Tons' | 'Loose';
  sampleCollectedBy?: string;
  sampleGivenToOffice?: boolean;
  workflowStatus: WorkflowStatus;
  offeringPrice?: number;
  priceType?: PriceType;
  offeringRemarks?: string;
  finalPrice?: number;
  lotSelectionDecision?: 'PASS_WITHOUT_COOKING' | 'PASS_WITH_COOKING' | 'FAIL';
  lotSelectionByUserId?: number;
  lotSelectionAt?: string;
  lotSelectionByUser?: {
    id: number;
    username: string;
  };
  qualityReportAttempts?: number;
  qualityAttemptDetails?: any[];
  qualityReportHistory?: string[];
  sampleCollectedHistory?: string[];
  createdByUserId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QualityParameters {
  id: number;
  sampleEntryId: number;
  moisture: number;
  cutting1?: number;
  cutting2?: number;
  cuttingColumn1?: number;
  cuttingColumn2?: number;
  bend?: number;
  mixS?: number;
  mixL?: number;
  mixKandu?: number;
  oil?: number;
  skGrainsCount?: number;
  wbR?: number;
  wbBk?: number;
  wbT?: number;
  paddyWb?: number;
  phoo?: number;
  reportedBy?: string;
  remarks?: string;
  reportedByUserId: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CookingReport {
  id: number;
  sampleEntryId: number;
  status: CookingReportStatus;
  remarks?: string;
  cookingDoneBy?: string;
  cookingApprovedBy?: string;
  reportedByUserId: number;
  createdAt: string;
  updatedAt?: string;
  history?: any[];
}

export interface LotAllotment {
  id: number;
  sampleEntryId: number;
  managerId: number;
  physicalSupervisorId: number;
  allottedByManagerId?: number;
  allottedToSupervisorId?: number;
  supervisor?: {
    id: number;
    username: string;
  };
  createdAt: string;
}

export interface PhysicalInspection {
  id: number;
  lotAllotmentId: number;
  sampleEntryId?: number;
  inspectionDate?: string;
  date: string;
  actualBags?: number;
  bags: number;
  lorryNumber?: string;
  cutting?: number;
  cutting1?: number;
  cutting2?: number;
  bend?: number;
  remarks?: string;
  isComplete?: boolean;
  halfLorryImageUrl?: string;
  fullLorryImageUrl?: string;
  reportedByUserId: number;
  createdAt: string;
}

export interface InventoryData {
  id: number;
  physicalInspectionId: number;
  date: string;
  entryDate?: string;
  variety: string;
  bags: number;
  moisture: number;
  wbNumber: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  location: string;
  kunchinittuId?: number | null;
  outturnId?: number | null;
  enteredByUserId: number;
  createdAt: string;
}

export interface FinancialCalculation {
  id: number;
  inventoryDataId: number;
  suteType: SuteType;
  suteRate: number;
  totalSute: number;
  suteNetWeight: number;
  baseRateType: BaseRateType;
  baseRate?: number;
  baseRateValue: number;
  customDivisor?: number;
  baseRateTotal: number;
  brokerageUnit: CalculationUnit;
  brokerageRate: number;
  brokerageTotal: number;
  egbRate?: number;
  egbTotal?: number;
  lfinUnit: CalculationUnit;
  lfinRate: number;
  lfinTotal: number;
  hamaliUnit: CalculationUnit;
  hamaliRate: number;
  hamaliTotal: number;
  totalAmount: number;
  average: number;
  ownerCalculatedBy?: number;
  managerCalculatedBy?: number;
  createdAt: string;
}

export interface SampleEntryWithDetails extends SampleEntry {
  qualityParameters?: QualityParameters;
  cookingReport?: CookingReport;
  lotAllotment?: LotAllotment & {
    physicalInspection?: PhysicalInspection & {
      inventoryData?: InventoryData & {
        financialCalculation?: FinancialCalculation;
      };
    };
    physicalInspections?: (PhysicalInspection & {
      inventoryData?: InventoryData & {
        financialCalculation?: FinancialCalculation;
      };
    })[];
  };
}

export interface SampleEntryFilters {
  status?: WorkflowStatus;
  startDate?: string;
  endDate?: string;
  broker?: string;
  variety?: string;
  party?: string;
  location?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  entryType?: string;
  excludeEntryType?: string;
}
