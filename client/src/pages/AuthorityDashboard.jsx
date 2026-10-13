import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getIncidentStats,
  getIncidents,
  getIncidentDetails,
  verifyIncident,
  getWorkers,
  assignIncident,
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

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignWorker = async (incidentId, workerId, notes) => {
    setIsAssigning(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await assignIncident(incidentId, workerId, notes);
      if (res.success) {
        setSuccessMsg(`Incident successfully assigned to field worker.`);
        setSelectedIncident(null);
        fetchData();
      }
    } catch (err) {
      console.error('Error assigning worker:', err);
      setError(err.response?.data?.message || 'Failed to assign field worker.');
    } finally {
      setIsAssigning(false);
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
      }
    } catch (err) {
      console.error('Error verifying incident:', err);
      setError(err.response?.data?.message || 'Failed to verify incident.');
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
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

          <div className="flex items-center space-x-4">
            <Link
              to="/dashboard"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition"
            >
              Main Dashboard
            </Link>

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

          <div className="flex items-center space-x-2 bg-purple-50 border border-purple-200 px-4 py-2.5 rounded-xl text-xs font-bold text-purple-800 shadow-sm">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span>Problem-Centric Correlation Active</span>
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

        {/* Toolbar: Search, Filters, View Mode Toggle */}
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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
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
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
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
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="REPORTED">Reported (Unverified)</option>
              <option value="VERIFIED">Verified</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            {/* SLA Filter */}
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-purple-600"
            >
              <option value="ALL">All SLA Statuses</option>
              <option value="ON_TRACK">On Track</option>
              <option value="WARNING">Warning (≤20% SLA)</option>
              <option value="OVERDUE">Overdue (Breached)</option>
            </select>

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

                      return (
                        <tr
                          key={incident.id}
                          className={`hover:bg-slate-50 transition ${
                            incident.slaStatus === 'OVERDUE' ? 'bg-rose-50/70 border-l-4 border-l-rose-500' : ''
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
                            <div className="text-xs text-blue-700 font-mono font-semibold">{incident.category}</div>
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
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {incident.status}
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
        />
      )}
    </div>
  );
}
