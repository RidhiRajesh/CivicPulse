import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Resolves an image path to a safe displayable URL across development and production:
 * 1. Returns empty string if path is missing or empty.
 * 2. Preserves already-absolute URLs (http, https, data, blob) unchanged (e.g. Cloudinary).
 * 3. For relative paths (e.g. /uploads/image.png):
 *    - Derives backend origin from VITE_API_BASE_URL when configured (stripping /api).
 *    - Falls back to local development server (http://localhost:5000) when not configured.
 * 4. Normalizes leading/trailing slashes to prevent malformed URLs.
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string' || !imagePath.trim()) {
    return '';
  }
  const trimmedPath = imagePath.trim();
  if (/^(https?:|data:|blob:)/i.test(trimmedPath)) {
    return trimmedPath;
  }
  const cleanImage = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    try {
      const url = new URL(apiBase);
      const basePath = url.pathname.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
      return `${url.origin}${basePath}${cleanImage}`;
    } catch {
      return `http://localhost:5000${cleanImage}`;
    }
  }
  return `http://localhost:5000${cleanImage}`;
};

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

export const adminResolveIncident = async (id, reason) => {
  const response = await api.patch(`/incidents/${id}/admin-resolve`, { reason });
  return response.data;
};

export const exportIncidents = async (params = {}) => {
  const response = await api.get('/incidents/export', {
    params,
    responseType: 'blob',
  });

  // Extract filename from Content-Disposition header if available
  const disposition = response.headers['content-disposition'];
  let filename = `civicpulse-export-${new Date().toISOString().split('T')[0]}.${params.format === 'geojson' ? 'geojson' : 'csv'}`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  // Trigger browser download
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);

  return { success: true, filename };
};

/**
 * Notification API Endpoints
 */
export const getNotifications = async (params = {}) => {
  const response = await api.get('/notifications', { params });
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch('/notifications/read-all');
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
