import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Automatically attach Authorization token if stored
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('civicpulse_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle global errors like token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('civicpulse_token');
    }
    return Promise.reject(error);
  }
);

/**
 * Health check API endpoint
 */
export const fetchHealthStatus = async () => {
  try {
    const response = await api.get('/health');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to connect to backend server',
    };
  }
};

/**
 * Auth API Endpoints
 */
export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

/**
 * Report API Endpoints
 */

// Create a new citizen report (supports FormData with optional image file)
export const createReport = async (formData) => {
  const response = await api.post('/reports', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Fetch reports created by currently logged in citizen
export const getMyReports = async () => {
  const response = await api.get('/reports/my');
  return response.data;
};

// Fetch report details by ID
export const getReportById = async (id) => {
  const response = await api.get(`/reports/${id}`);
  return response.data;
};

/**
 * Incident API Endpoints (Authority)
 */
export const getIncidentStats = async () => {
  const response = await api.get('/incidents/stats');
  return response.data;
};

export const getIncidents = async (params = {}) => {
  const response = await api.get('/incidents', { params });
  return response.data;
};

export const getIncidentDetails = async (id) => {
  const response = await api.get(`/incidents/${id}`);
  return response.data;
};

export const verifyIncident = async (id, comment = '') => {
  const response = await api.patch(`/incidents/${id}/verify`, { comment });
  return response.data;
};

export const getWorkers = async () => {
  const response = await api.get('/workers');
  return response.data;
};

export const assignIncident = async (id, workerId, notes = '') => {
  const response = await api.patch(`/incidents/${id}/assign`, { workerId, notes });
  return response.data;
};

/**
 * Field Worker API Endpoints
 */
export const getMyWorkerIncidents = async () => {
  const response = await api.get('/incidents/worker/my');
  return response.data;
};

export const startWorkOnIncident = async (id, comment = '') => {
  const response = await api.patch(`/incidents/${id}/start`, { comment });
  return response.data;
};

export const addProgressUpdate = async (id, note) => {
  const response = await api.post(`/incidents/${id}/updates`, { note });
  return response.data;
};

export const completeWork = async (id, formDataOrPayload) => {
  // If formDataOrPayload is FormData (contains uploaded image file)
  if (formDataOrPayload instanceof FormData) {
    const response = await api.post(`/incidents/${id}/complete`, formDataOrPayload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  // Standard JSON payload
  const response = await api.post(`/incidents/${id}/complete`, formDataOrPayload);
  return response.data;
};

/**
 * Citizen Verification API Endpoint
 */
export const verifyCitizenResolution = async (id, confirmed, reason = '') => {
  const response = await api.patch(`/incidents/${id}/verify-resolution`, { confirmed, reason });
  return response.data;
};

export default api;
