export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface AppointmentDto {
  id: string;
  businessId: string;
  serviceId: string | null;
  serviceName: string;
  priceCents: number;
  durationMinutes: number;
  currency: string;
  status: AppointmentStatus;
  startsAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerNote: string;
  createdAt: string;
  updatedAt: string;
}
