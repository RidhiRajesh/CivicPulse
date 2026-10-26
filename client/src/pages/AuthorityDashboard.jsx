import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getIncidentStats,
  getIncidents,
  getIncidentDetails,
  verifyIncident,
  getWorkers,
  assignIncident,
  adminResolveIncident,
  exportIncidents,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/api';
import IncidentsMap from '../components/IncidentsMap';
import IncidentDetailModal from '../components/IncidentDetailModal';
import {
  Shield,
  Activity,
  LogOut,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Map as MapIcon,
  Table as TableIcon,
  RefreshCw,
  Eye,
  Users,
  Check,
  Loader2,
  TrendingUp,
  HardHat,
  Bell,
  BellOff,
  Download,
  RotateCcw,
  CheckCheck,
  X,
  FileText,
} from 'lucide-react';

export default function AuthorityDashboard() {
  const { user, logout } = useAuth();

  const [stats, setStats] = useState({
    total: 0,
    reported: 0,
    verified: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    highPriority: 0,
    overdueSla: 0,
  });

  const [incidents, setIncidents] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [slaFilter, setSlaFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'map'

  // Selected Incident Modal state
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAdminResolving, setIsAdminResolving] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [browserNotifPermission, setBrowserNotifPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const processedNotifIds = useRef(new Set());
  const initialFetchDone = useRef(false);

  // Reopened / Dispute count calculation
  const reopenedIncidents = useMemo(() => {
    return incidents.filter((inc) => inc.status === 'REOPENED');
  }, [incidents]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, incidentsRes, workersRes] = await Promise.all([
        getIncidentStats(),
        getIncidents(),
        getWorkers().catch(() => ({ success: false, workers: [] })),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (incidentsRes.success) setIncidents(incidentsRes.incidents);
      if (workersRes?.success) setWorkers(workersRes.workers);
    } catch (err) {
      console.error('Failed to load Authority Dashboard data:', err);
      setError('Failed to fetch authority dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications
  const fetchNotificationsData = async (silent = false) => {
    if (!silent) setNotifLoading(true);
    setNotifError('');
    try {
      const res = await getNotifications({ limit: 40 });
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadNotifCount(res.unreadCount || 0);

        // Check for new notifications to trigger browser notifications
        if (
          initialFetchDone.current &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          (res.notifications || []).forEach((notif) => {
            if (!notif.isRead && !processedNotifIds.current.has(notif.id)) {
              try {
                new Notification(notif.title, {
                  body: notif.message,
                  icon: '/favicon.ico',
                  tag: notif.id,
                });
              } catch (e) {
                console.error('Browser notification error:', e);
              }
            }
          });
        }

        // Mark all current IDs as processed
        (res.notifications || []).forEach((n) => processedNotifIds.current.add(n.id));
        initialFetchDone.current = true;
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      if (!silent) setNotifError('Failed to load notifications.');
    } finally {
      if (!silent) setNotifLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchNotificationsData();

    // Poll notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotificationsData(true);
    }, 30000);

    // Refresh notifications when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotificationsData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Request browser notification permission explicitly
  const handleRequestBrowserNotif = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Browser notifications are not supported in your browser.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setBrowserNotifPermission(permission);
      if (permission === 'granted') {
        new Notification('CivicPulse Authority Notifications Enabled', {
          body: 'You will receive real-time alerts for SLA breaches and citizen disputes.',
        });
      }
    } catch (err) {
      console.error('Failed to request notification permission:', err);
    }
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      const res = await markNotificationRead(notifId);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
        );
        setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await markAllNotificationsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadNotifCount(0);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    if (notif.incidentId) {
      setIsNotificationOpen(false);
      handleInspectIncident({ id: notif.incidentId });
    }
  };

  const handleAssignWorker = async (incidentId, workerId, notes) => {
    setIsAssigning(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await assignIncident(incidentId, workerId, notes);
      if (res.success) {
        setSuccessMsg(res.message || 'Incident successfully assigned to field worker.');
        setSelectedIncident(null);
        fetchData();
        fetchNotificationsData(true);
      }
    } catch (err) {
      console.error('Error assigning worker:', err);
      setError(err.response?.data?.message || 'Failed to assign field worker.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAdminResolve = async (incidentId, reason) => {
    setIsAdminResolving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await adminResolveIncident(incidentId, reason);
      if (res.success) {
        setSuccessMsg(res.message || `Incident #${incidentId.slice(0, 8)} administratively resolved.`);
        setSelectedIncident(null);
        fetchData();
        fetchNotificationsData(true);
      }
    } catch (err) {
      console.error('Error in administrative resolution:', err);
      setError(err.response?.data?.message || 'Failed to administratively resolve incident.');
    } finally {
      setIsAdminResolving(false);
    }
  };

  const handleExport = async (format) => {
    setIsExporting(true);
    setError('');
    setSuccessMsg('');
    try {
      const params = {
        format,
        category: categoryFilter,
        status: statusFilter,
        severity: severityFilter,
        slaStatus: slaFilter,
        search: searchQuery,
      };
      const res = await exportIncidents(params);
      if (res.success) {
        setSuccessMsg(`Incident export downloaded successfully: ${res.filename}`);
      }
    } catch (err) {
      console.error('Export Error:', err);
      setError(err.response?.data?.message || 'Failed to export incidents.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered incidents logic
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Category filter
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      // Severity filter
      if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
      // Status filter
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      // SLA Status filter
      if (slaFilter !== 'ALL' && inc.slaStatus !== slaFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = inc.title?.toLowerCase().includes(q);
        const descMatch = inc.description?.toLowerCase().includes(q);
        const addressMatch = inc.address?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !addressMatch) return false;
      }
      return true;
    });
  }, [incidents, categoryFilter, severityFilter, statusFilter, slaFilter, searchQuery]);

  // Open incident details modal
  const handleInspectIncident = async (incident) => {
    setFetchingDetails(true);
    try {
      const res = await getIncidentDetails(incident.id);
      if (res.success) {
        setSelectedIncident(res.incident);
      } else {
        setSelectedIncident(incident);
      }
    } catch (err) {
      console.error('Error fetching incident details:', err);
      setSelectedIncident(incident);
    } finally {
      setFetchingDetails(false);
    }
  };

  // Verify Incident handler
  const handleVerifyIncident = async (incidentId, comment = '') => {
    setVerifyingId(incidentId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await verifyIncident(incidentId, comment);
      if (res.success) {
        setSuccessMsg(`Incident #${incidentId.slice(0, 8)} successfully verified!`);
        setSelectedIncident(null);
        fetchData();
        fetchNotificationsData(true);
      }
    } catch (err) {
      console.error('Error verifying incident:', err);
      setError(err.response?.data?.message || 'Failed to verify incident.');
    } finally {
      setVerifyingId(null);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'SLA_WARNING':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'RESOLUTION_VERIFICATION':
        return <RotateCcw className="w-4 h-4 text-rose-600" />;
      case 'ASSIGNMENT':
        return <HardHat className="w-4 h-4 text-purple-600" />;
      case 'INCIDENT_UPDATE':
        return <Activity className="w-4 h-4 text-blue-600" />;
      default:
        return <Shield className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-sm">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">
                Civic<span className="text-purple-600">Pulse</span>
              </span>
              <span className="ml-2 text-xs font-bold px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                Authority Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link
              to="/dashboard"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition"
            >
              Main Dashboard
            </Link>

            {/* Smart Notification Centre Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`relative p-2 rounded-xl border transition ${
                  isNotificationOpen
                    ? 'bg-purple-100 text-purple-700 border-purple-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Smart Notification Centre"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-extrabold shadow-sm min-w-[18px] text-center animate-pulse">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={logout}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 mt-6">
        {/* Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Authority Operations Control Center</h1>
            </div>
            <p className="text-sm text-slate-600">
              Correlated Civic Incidents management, dynamic priority score engine, and municipal SLA escalation monitoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {reopenedIncidents.length > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'REOPENED' ? 'ALL' : 'REOPENED')}
                className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm border ${
                  statusFilter === 'REOPENED'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                }`}
                title="Filter to Citizen Disputed Incidents"
              >
                <RotateCcw className="w-4 h-4 text-rose-500" />
                <span>{reopenedIncidents.length} Citizen Dispute{reopenedIncidents.length === 1 ? '' : 's'} Active</span>
              </button>
            )}

            <div className="flex items-center space-x-2 bg-purple-50 border border-purple-200 px-4 py-2.5 rounded-xl text-xs font-bold text-purple-800 shadow-sm">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>Problem-Centric Correlation Active</span>
            </div>
          </div>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-700 hover:underline font-bold text-xs">Dismiss</button>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-800 hover:underline font-bold text-xs">Dismiss</button>
          </div>
        )}

        {/* 8 Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3.5 text-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-slate-500 block font-semibold">Total Incidents</span>
            <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-amber-700 block font-bold">Unverified</span>
            <span className="text-2xl font-bold text-amber-700">{stats.reported}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-blue-700 block font-bold">Verified</span>
            <span className="text-2xl font-bold text-blue-700">{stats.verified}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-purple-700 block font-bold">Assigned</span>
            <span className="text-2xl font-bold text-purple-700">{stats.assigned}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-cyan-700 block font-bold">In Progress</span>
            <span className="text-2xl font-bold text-cyan-700">{stats.inProgress}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-emerald-700 block font-bold">Resolved</span>
            <span className="text-2xl font-bold text-emerald-700">{stats.resolved}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-rose-700 block font-bold">High Priority</span>
            <span className="text-2xl font-bold text-rose-700">{stats.highPriority}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-rose-800 block font-bold">Overdue SLA</span>
            <span className="text-2xl font-bold text-rose-800">{stats.overdueSla}</span>
          </div>
        </div>

        {/* Toolbar: Search, Filters, Dispute Tab, Export, View Mode Toggle */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-sm">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search incidents by title, description, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition"
            />
          </div>

          {/* Filters and Actions */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Quick Citizen Disputes Toggle Button */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'REOPENED' ? 'ALL' : 'REOPENED')}
              className={`flex items-center space-x-1.5 px-3 py-2.5 rounded-xl font-bold border transition ${
                statusFilter === 'REOPENED'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
              }`}
              title="Filter to Citizen Disputed & Reopened Incidents"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Disputes</span>
              {reopenedIncidents.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  statusFilter === 'REOPENED' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                }`}>
                  {reopenedIncidents.length}
                </span>
              )}
            </button>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
            >
              <option value="ALL">All Categories</option>
              <option value="POTHOLE">Pothole</option>
              <option value="GARBAGE">Garbage</option>
              <option value="STREETLIGHT">Streetlight</option>
              <option value="DRAINAGE">Drainage</option>
              <option value="WATER_LEAKAGE">Water Leakage</option>
              <option value="DAMAGED_ROAD">Damaged Road</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
            >
              <option value="ALL">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="REPORTED">Reported (Unverified)</option>
              <option value="VERIFIED">Verified</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED_PENDING_VERIFICATION">Pending Verification</option>
              <option value="REOPENED">Disputed / Reopened</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            {/* SLA Filter */}
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
            >
              <option value="ALL">All SLA Statuses</option>
              <option value="ON_TRACK">On Track</option>
              <option value="WARNING">Warning (≤20% SLA)</option>
              <option value="OVERDUE">Overdue (Breached)</option>
            </select>

            {/* Export Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={isExporting}
                className="flex items-center space-x-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-bold transition disabled:opacity-50"
                title="Export filtered incident records"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Export</span>
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setExportDropdownOpen(false);
                      handleExport('csv');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg font-semibold text-slate-800 flex items-center space-x-2 transition"
                  >
                    <TableIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>Export as CSV (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportDropdownOpen(false);
                      handleExport('geojson');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg font-semibold text-slate-800 flex items-center space-x-2 transition"
                  >
                    <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export as GeoJSON (.geojson)</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'table' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-4 h-4" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'map' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                <span>Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area: Table View or Map View */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <span className="text-sm text-slate-600 font-semibold">Loading correlated incidents data...</span>
          </div>
        ) : viewMode === 'map' ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600 font-semibold flex items-center justify-between px-1">
              <span>Showing {filteredIncidents.length} spatial incidents on interactive map</span>
              <span className="text-xs text-slate-500">Click any marker pin to inspect details</span>
            </div>
            <IncidentsMap
              incidents={filteredIncidents}
              onSelectIncident={(inc) => handleInspectIncident(inc)}
            />
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-xs">
                  <tr>
                    <th className="py-4 px-4">Priority Score</th>
                    <th className="py-4 px-4">Incident & Category</th>
                    <th className="py-4 px-4">Location</th>
                    <th className="py-4 px-4">Severity</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4">SLA Deadline & Status</th>
                    <th className="py-4 px-4 text-center">Reports / Supporters</th>
                    <th className="py-4 px-4">Created</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredIncidents.length > 0 ? (
                    filteredIncidents.map((incident) => {
                      const supporterCount = incident._count?.supporters || incident.supportCount || 1;
                      const reportCount = incident._count?.reports || incident.reports?.length || 1;
                      const isDisputed = incident.status === 'REOPENED';

                      return (
                        <tr
                          key={incident.id}
                          className={`hover:bg-slate-50 transition ${
                            isDisputed
                              ? 'bg-rose-50/70 border-l-4 border-l-rose-600'
                              : incident.slaStatus === 'OVERDUE'
                              ? 'bg-rose-50/70 border-l-4 border-l-rose-500'
                              : ''
                          }`}
                        >
                          {/* Priority Score */}
                          <td className="py-4 px-4 font-mono font-bold">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs">
                              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                              <span>{incident.priorityScore ?? 0}</span>
                            </span>
                          </td>

                          {/* Incident Title & Category */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900">{incident.title}</div>
                            <div className="text-xs text-blue-700 font-mono font-semibold flex items-center space-x-2">
                              <span>{incident.category}</span>
                              {isDisputed && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded font-bold uppercase">
                                  Citizen Disputed
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-4 px-4 max-w-xs truncate">
                            <span className="text-slate-800 font-medium">{incident.address || 'Smart City Zone'}</span>
                          </td>

                          {/* Severity */}
                          <td className="py-4 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                incident.severity === 'CRITICAL'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : incident.severity === 'HIGH'
                                  ? 'bg-orange-50 text-orange-800 border border-orange-200'
                                  : incident.severity === 'MEDIUM'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {incident.severity}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                incident.status === 'REPORTED'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : incident.status === 'VERIFIED'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : incident.status === 'ASSIGNED'
                                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                  : incident.status === 'IN_PROGRESS'
                                  ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                                  : incident.status === 'RESOLVED_PENDING_VERIFICATION'
                                  ? 'bg-orange-50 text-orange-800 border border-orange-300'
                                  : incident.status === 'REOPENED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center space-x-1'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {incident.status === 'REOPENED' ? 'DISPUTED' : incident.status}
                            </span>
                          </td>

                          {/* SLA Target & Status */}
                          <td className="py-4 px-4 font-mono text-xs">
                            {incident.slaStatus === 'OVERDUE' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-100 text-rose-900 border border-rose-300 rounded-full font-bold text-xs animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                <span>{incident.remainingFormatted || 'OVERDUE'}</span>
                              </span>
                            ) : incident.slaStatus === 'WARNING' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold text-xs">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>{incident.remainingFormatted || 'WARNING'}</span>
                              </span>
                            ) : incident.slaStatus === 'RESOLVED' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>SLA Met</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>{incident.remainingFormatted || 'ON TRACK'}</span>
                              </span>
                            )}
                          </td>

                          {/* Report / Support Count */}
                          <td className="py-4 px-4 text-center font-mono">
                            <span className="text-slate-900 font-bold">{reportCount}</span>
                            <span className="text-slate-400 text-xs"> rep / </span>
                            <span className="text-blue-700 font-bold">{supporterCount}</span>
                            <span className="text-slate-400 text-xs"> sup</span>
                          </td>

                          {/* Created Date */}
                          <td className="py-4 px-4 text-slate-500 font-mono text-xs">
                            {new Date(incident.createdAt).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleInspectIncident(incident)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 border border-slate-200"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>Inspect</span>
                            </button>

                            {incident.status === 'REPORTED' && (
                              <button
                                type="button"
                                onClick={() => handleVerifyIncident(incident.id)}
                                disabled={verifyingId === incident.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1 disabled:opacity-50 shadow-sm"
                              >
                                {verifyingId === incident.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Verify</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-500 text-sm">
                        No correlated incidents matched your active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Smart Notification Centre Drawer */}
      {isNotificationOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsNotificationOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Notification Centre</h2>
                    <span className="text-xs text-slate-500">
                      {unreadNotifCount} unread municipal alert{unreadNotifCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsNotificationOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Browser Notification Opt-In Banner */}
              <div className="p-3 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between text-xs">
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-purple-900 block">Browser Alerts</span>
                  <span className="text-purple-700 text-[11px]">
                    {browserNotifPermission === 'granted'
                      ? '✓ Browser desktop alerts are active for background warnings.'
                      : browserNotifPermission === 'denied'
                      ? '⚠️ Browser notifications blocked in your browser settings.'
                      : 'Enable desktop notifications for real-time SLA & dispute alerts.'}
                  </span>
                </div>

                {browserNotifPermission === 'default' && (
                  <button
                    type="button"
                    onClick={handleRequestBrowserNotif}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs whitespace-nowrap transition shadow-xs"
                  >
                    Enable
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {notifLoading && notifications.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
                    <span className="text-xs text-slate-500 font-medium">Fetching alerts...</span>
                  </div>
                ) : notifError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-2">
                    <span className="text-xs text-rose-700 font-medium block">{notifError}</span>
                    <button
                      type="button"
                      onClick={() => fetchNotificationsData()}
                      className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition"
                    >
                      Retry
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <BellOff className="w-8 h-8 text-slate-300 mx-auto" />
                    <span className="text-sm font-semibold text-slate-600 block">You're all caught up!</span>
                    <span className="text-xs text-slate-400">No authority notifications at this time.</span>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 rounded-xl border text-xs transition cursor-pointer flex items-start space-x-3 ${
                        notif.isRead
                          ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-purple-50/50 hover:bg-purple-50 border-purple-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${notif.isRead ? 'text-slate-800' : 'text-purple-950 font-extrabold'}`}>
                            {notif.title}
                          </span>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 ml-2" />
                          )}
                        </div>

                        <p className="text-slate-600 leading-relaxed text-[11px]">
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                          <span className="font-mono">
                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <div className="flex items-center space-x-2">
                            {notif.incidentId && (
                              <span className="text-purple-600 font-bold hover:underline">
                                Inspect Incident →
                              </span>
                            )}
                            {!notif.isRead && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notif.id);
                                }}
                                className="text-slate-400 hover:text-purple-700 font-medium"
                                title="Mark read"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incident Details Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onVerify={handleVerifyIncident}
          isVerifying={verifyingId === selectedIncident.id}
          workers={workers}
          onAssign={handleAssignWorker}
          isAssigning={isAssigning}
          onAdminResolve={handleAdminResolve}
          isAdminResolving={isAdminResolving}
        />
      )}
    </div>
  );
}
