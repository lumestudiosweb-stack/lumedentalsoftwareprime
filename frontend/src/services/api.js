import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lume_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lume_token');
      localStorage.removeItem('lume_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Patients
export const patientAPI = {
  list: (params) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  getProfile: (id) => api.get(`/patients/${id}/profile`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
};

// Clinical Records
export const clinicalAPI = {
  listByPatient: (pid) => api.get(`/clinical/patient/${pid}`),
  getPerioChart: (pid) => api.get(`/clinical/patient/${pid}/perio-chart`),
  create: (pid, data) => api.post(`/clinical/patient/${pid}`, data),
  update: (id, data) => api.put(`/clinical/${id}`, data),
};

// Scans
export const scanAPI = {
  listByPatient: (pid) => api.get(`/scans/patient/${pid}`),
  get: (id) => api.get(`/scans/${id}`),
  upload: (pid, formData) => api.post(`/scans/patient/${pid}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getMeshes: (id) => api.get(`/scans/${id}/meshes`),
};

// Simulations
export const simulationAPI = {
  listByPatient: (pid) => api.get(`/simulations/patient/${pid}`),
  get: (id) => api.get(`/simulations/${id}`),
  getStates: (id) => api.get(`/simulations/${id}/states`),
  create: (data) => api.post('/simulations', data),
};

// Treatments
export const treatmentAPI = {
  listByPatient: (pid) => api.get(`/treatments/patient/${pid}`),
  create: (pid, data) => api.post(`/treatments/patient/${pid}`, data),
  complete: (id) => api.post(`/treatments/${id}/complete`),
};

// CRM
export const crmAPI = {
  listByPatient: (pid) => api.get(`/crm/patient/${pid}`),
  getEscalations: () => api.get('/crm/escalations'),
  getDue: () => api.get('/crm/due'),
  recordResponse: (id, response) => api.post(`/crm/${id}/response`, { response }),
};

// Aligners
export const alignerAPI = {
  getStatus: (pid) => api.get(`/aligners/patient/${pid}/status`),
  getHistory: (pid) => api.get(`/aligners/patient/${pid}/history`),
  start: (pid, data) => api.post(`/aligners/patient/${pid}/start`, data),
  submitFitPhoto: (pid, formData) => api.post(`/aligners/patient/${pid}/fit-photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  advance: (pid) => api.post(`/aligners/patient/${pid}/advance`),
};

export default api;
