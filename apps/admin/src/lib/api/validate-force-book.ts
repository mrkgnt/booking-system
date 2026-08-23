export type ForceBookFormValues = {
  serviceId: string; staffId: string; startsAt: string; locale: string;
  patientName: string; patientEmail: string; patientPhone: string;
};

export function validateForceBookForm(values: ForceBookFormValues): string[] {
  const errors: string[] = [];
  if (!values.serviceId) errors.push("Service is required.");
  if (!values.staffId) errors.push("Staff member is required.");
  if (!values.startsAt) errors.push("Start time is required.");
  if (!values.patientName.trim()) errors.push("Patient name is required.");
  if (!values.patientEmail.trim() && !values.patientPhone.trim()) errors.push("Patient email or phone is required.");
  return errors;
}
