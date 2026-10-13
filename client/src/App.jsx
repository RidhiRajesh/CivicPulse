import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import HealthCheck from './pages/HealthCheck';
import ReportIssue from './pages/ReportIssue';
import MyReports from './pages/MyReports';
import AuthorityDashboard from './pages/AuthorityDashboard';
import WorkerDashboard from './pages/WorkerDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/health" element={<HealthCheck />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/report"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <ReportIssue />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-reports"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <MyReports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/authority"
            element={
              <ProtectedRoute allowedRoles={['AUTHORITY']}>
                <AuthorityDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/worker"
            element={
              <ProtectedRoute allowedRoles={['FIELD_WORKER']}>
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
