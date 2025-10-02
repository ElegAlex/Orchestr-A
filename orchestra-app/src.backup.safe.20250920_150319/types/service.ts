export interface Service {
  id: string;
  name: string;
  description?: string;
  color: string;
  manager?: string; // ID du manager du service
  budget?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceRequest {
  name: string;
  description?: string;
  color: string;
  manager?: string;
  budget?: number;
}

export interface UpdateServiceRequest extends Partial<CreateServiceRequest> {
  id: string;
  isActive?: boolean;
}