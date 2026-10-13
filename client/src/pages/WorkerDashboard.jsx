import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMyWorkerIncidents,
  startWorkOnIncident,
  addProgressUpdate,
  completeWork,
  getIncidentDetails,
} from '../services/api';
import IncidentDetailModal from '../components/IncidentDetailModal';
import {
  HardHat,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Play,
  MessageSquare,
  Upload,
  Eye,
  AlertCircle,
  Loader2,
  TrendingUp,
  MapPin,
  Users,
  Image as ImageIcon,
  Check,
  X,
  FileText,
} from 'lucide-react';

export default function WorkerDashboard() {
  const { user, logout } = useAuth();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modal / Action States
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [actionModalIncident, setActionModalIncident] = useState(null);
  const [actionType, setActionType] = useState(null); // 'UPDATE' | 'COMPLETE'

  // Action Form Inputs
  const [progressNote, setProgressNote] = useState('');
  const [workNotes, setWorkNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startingId, setStartingId] = useState(null);

  const fetchWorkerIncidents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getMyWorkerIncidents();
      if (res.success) {
        setIncidents(res.incidents);
      }
    } catch (err) {
      console.error('Failed to load assigned incidents:', err);
      setError('Failed to load assigned field incidents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerIncidents();
  }, []);

  // Filtered incidents logic
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = inc.title?.toLowerCase().includes(q);
        const descMatch = inc.description?.toLowerCase().includes(q);
        const addressMatch = inc.address?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !addressMatch) return false;
      }
      return true;
    });
  }, [incidents, statusFilter, categoryFilter, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    let total = incidents.length;
    let assigned = 0;
    let inProgress = 0;
    let pendingVerification = 0;

    incidents.forEach((inc) => {
      if (inc.status === 'ASSIGNED') assigned++;
      else if (inc.status === 'IN_PROGRESS') inProgress++;
      else if (inc.status === 'RESOLVED_PENDING_VERIFICATION') pendingVerification++;
    });

    return { total, assigned, inProgress, pendingVerification };
  }, [incidents]);

  // Action: Start Work
  const handleStartWork = async (incidentId) => {
    setStartingId(incidentId);
    setError('');
    setSuccessMsg('');
    try {
      const res = await startWorkOnIncident(incidentId, 'Field worker initiated repair work.');
      if (res.success) {
        setSuccessMsg(`Started repair work on Incident #${incidentId.slice(0, 8)}.`);
        fetchWorkerIncidents();
      }
    } catch (err) {
      console.error('Error starting work:', err);
      setError(err.response?.data?.message || 'Failed to start work.');
    } finally {
      setStartingId(null);
    }
  };

  // Action: Add Progress Update Submit
  const handleProgressUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!progressNote.trim()) return;

    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await addProgressUpdate(actionModalIncident.id, progressNote.trim());
      if (res.success) {
        setSuccessMsg(`Progress update logged for Incident #${actionModalIncident.id.slice(0, 8)}.`);
        setActionModalIncident(null);
        setProgressNote('');
        fetchWorkerIncidents();
      }
    } catch (err) {
      console.error('Error adding progress update:', err);
      setError(err.response?.data?.message || 'Failed to add progress update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Submit Work Completion
  const handleCompletionSubmit = async (e) => {
    e.preventDefault();
    if (!workNotes.trim()) return;

    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('workNotes', workNotes.trim());
      if (evidenceFile) {
        formData.append('image', evidenceFile);
      }

      const res = await completeWork(actionModalIncident.id, formData);
      if (res.success) {
        setSuccessMsg(`Incident #${actionModalIncident.id.slice(0, 8)} work submitted for citizen resolution verification!`);
        setActionModalIncident(null);
        setWorkNotes('');
        setEvidenceFile(null);
        fetchWorkerIncidents();
      }
    } catch (err) {
      console.error('Error submitting completion:', err);
      setError(err.response?.data?.message || 'Failed to submit work resolution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inspect Incident Details
  const handleInspect = async (incident) => {
    try {
      const res = await getIncidentDetails(incident.id);
      if (res.success) {
        setSelectedIncident(res.incident);
      } else {
        setSelectedIncident(incident);
      }
    } catch (err) {
      setSelectedIncident(incident);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ASSIGNED':
        return (
          <span className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-xs font-bold flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>ASSIGNED (Ready to Start)</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-3 py-1 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-full text-xs font-bold flex items-center space-x-1.5">
            <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
            <span>IN PROGRESS</span>
          </span>
        );
      case 'RESOLVED_PENDING_VERIFICATION':
        return (
          <span className="px-3 py-1 bg-orange-50 text-orange-800 border border-orange-300 rounded-full text-xs font-bold flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-orange-600" />
            <span>PENDING CITIZEN VERIFICATION</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">
                Civic<span className="text-teal-600">Pulse</span>
              </span>
              <span className="ml-2 text-xs font-bold px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full">
                Field Operations Portal
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
              onClick={fetchWorkerIncidents}
              disabled={loading}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition"
              title="Refresh Assignments"
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
        {/* Welcome Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Worker Field Operations</h1>
            </div>
            <p className="text-sm text-slate-600">
              Welcome, <span className="text-teal-700 font-bold">{user?.name}</span> ({user?.department || 'Field Services'}). Manage your assigned civic incidents and submit repair evidence below.
            </p>
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

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-sm">
            <span className="text-slate-500 block font-semibold text-xs">Total Assigned Incidents</span>
            <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-sm">
            <span className="text-purple-700 block font-bold text-xs">Pending Start (Assigned)</span>
            <span className="text-2xl font-bold text-purple-700">{metrics.assigned}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-sm">
            <span className="text-cyan-700 block font-bold text-xs">Work In Progress</span>
            <span className="text-2xl font-bold text-cyan-700">{metrics.inProgress}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1 shadow-sm">
            <span className="text-orange-800 block font-bold text-xs">Submitted for Verification</span>
            <span className="text-2xl font-bold text-orange-800">{metrics.pendingVerification}</span>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search your assigned incidents by title or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-teal-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">Assigned (Ready to Start)</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED_PENDING_VERIFICATION">Pending Verification</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-teal-600"
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
          </div>
        </div>

        {/* Assignments List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            <span className="text-sm text-slate-600 font-semibold">Fetching assigned field incidents...</span>
          </div>
        ) : filteredIncidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredIncidents.map((incident) => {
              const latestAssignment = incident.assignments && incident.assignments.length > 0 ? incident.assignments[0] : null;

              return (
                <div
                  key={incident.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Status & Priority Header */}
                    <div className="flex items-center justify-between gap-2">
                      {getStatusBadge(incident.status)}
                      <div className="flex items-center space-x-2 font-mono text-xs">
                        <span className="text-slate-500 font-medium">Priority Score:</span>
                        <span className="font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">
                          {incident.priorityScore ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* Title & Category */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{incident.title}</h3>
                      <div className="text-xs text-teal-700 font-mono font-bold mt-0.5">{incident.category}</div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                      {incident.description}
                    </p>

                    {/* Location & Details */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="truncate">{incident.address || 'Smart City Zone'}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono pl-5">
                        GPS: {incident.latitude}, {incident.longitude}
                      </div>
                    </div>

                    {/* Assignment Metadata */}
                    {latestAssignment && (
                      <div className="text-xs text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                        <div>
                          Assigned by:{' '}
                          <span className="text-slate-900 font-bold">{latestAssignment.assignedBy?.name || 'Authority'}</span>
                        </div>
                        <div>Assigned on: {new Date(latestAssignment.assignedAt).toLocaleString()}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleInspect(incident)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition inline-flex items-center space-x-1.5 border border-slate-200"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Inspect</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      {/* ASSIGNED -> Start Work */}
                      {incident.status === 'ASSIGNED' && (
                        <button
                          type="button"
                          onClick={() => handleStartWork(incident.id)}
                          disabled={startingId === incident.id}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition inline-flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                        >
                          {startingId === incident.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>Start Work</span>
                        </button>
                      )}

                      {/* IN_PROGRESS -> Update & Complete */}
                      {incident.status === 'IN_PROGRESS' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActionModalIncident(incident);
                              setActionType('UPDATE');
                              setProgressNote('');
                            }}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-blue-700 border border-slate-200 rounded-xl font-bold transition inline-flex items-center space-x-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                            <span>Progress Note</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActionModalIncident(incident);
                              setActionType('COMPLETE');
                              setWorkNotes('');
                              setEvidenceFile(null);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition inline-flex items-center space-x-1.5 shadow-sm"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Submit Completion</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-2 shadow-sm">
            <HardHat className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-base font-bold text-slate-700">No assigned field incidents found matching active filters.</p>
          </div>
        )}
      </main>

      {/* Progress Update / Complete Action Modal */}
      {actionModalIncident && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                {actionType === 'UPDATE' ? (
                  <>
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    <span>Log Repair Progress Note</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <span>Submit Work Resolution</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setActionModalIncident(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Incident: <span className="font-bold text-slate-900">{actionModalIncident.title}</span> (ID: {actionModalIncident.id.slice(0, 8)})
            </div>

            {/* FORM: UPDATE */}
            {actionType === 'UPDATE' ? (
              <form onSubmit={handleProgressUpdateSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Progress Update Note *
                  </label>
                  <textarea
                    rows="4"
                    required
                    placeholder="e.g. Excavation complete. Sub-base material poured and compaction started."
                    value={progressNote}
                    onChange={(e) => setProgressNote(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalIncident(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Progress Note</span>
                  </button>
                </div>
              </form>
            ) : (
              /* FORM: COMPLETE WORK */
              <form onSubmit={handleCompletionSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Work Resolution Notes *
                  </label>
                  <textarea
                    rows="3"
                    required
                    placeholder="e.g. Pothole filled with hot-mix asphalt and roller compacted. Site cleared."
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Upload Resolution Evidence Photo (Optional/Recommended)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEvidenceFile(e.target.files[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Allowed formats: JPEG, PNG, WEBP (Max 5MB)</p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalIncident(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>Submit Work Completion</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Incident Details Inspection Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}
