export type { Appointment, AppointmentStatus } from './model/types';
export { APPOINTMENT_STATUS_LABELS } from './model/types';
export { createAppointment } from './api/create-appointment';
export type { CreateAppointmentInput, CreateAppointmentOutcome } from './api/create-appointment';
export { getAppointments } from './api/get-appointments';
export { updateAppointmentStatus } from './api/update-appointment-status';
export { BookingModal } from './ui/BookingModal';
