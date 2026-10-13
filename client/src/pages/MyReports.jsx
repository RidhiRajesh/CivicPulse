import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReports, verifyCitizenResolution } from '../services/api';
import LocationViewerModal from '../components/LocationViewerModal';
import {
  Activity,
  Plus,
  MapPin,
  Clock,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Map as MapIcon,
  RotateCcw,
  Check,
  X,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

export default function MyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedReportForMap, setSelectedReportForMap] = useState(null);

  // Verification state per incident
  const [verifyingIncidentId, setVerifyingIncidentId] = useState(null);
  const [rejectingIncidentId, setRejectingIncidentId] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyReports();
      if (data.success) {
        setReports(data.reports || []);
      } else {
        setError(data.message || 'Failed to fetch your reports.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleCitizenVerify = async (incidentId, confirmed, reason = '') => {
    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await verifyCitizenResolution(incidentId, confirmed, reason);
      if (res.success) {
        setSuccessMsg(res.message || (confirmed ? 'Thank you. This civic issue has been marked as resolved.' : 'This issue has been reopened for further action.'));
        setRejectingIncidentId(null);
        setReopenReason('');
        fetchReports();
      }
    } catch (err) {
      console.error('Error verifying resolution:', err);
      setError(err.response?.data?.message || 'Failed to submit verification decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryBadge = (category) => {
    const formatted = (category || '').replace('_', ' ');
    return (
      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold uppercase">
        {formatted}
      </span>
    );
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold">Critical (24h SLA)</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs font-bold">High (48h SLA)</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">Medium (72h SLA)</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">Low (7d SLA)</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center space-x-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>RESOLVED</span></span>;
      case 'REOPENED':
        return <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold flex items-center space-x-1"><RotateCcw className="w-3.5 h-3.5 text-rose-600" /><span>REOPENED</span></span>;
      case 'RESOLVED_PENDING_VERIFICATION':
        return <span className="px-2.5 py-0.5 bg-orange-50 text-orange-800 border border-orange-300 rounded-full text-xs font-bold flex items-center space-x-1"><Clock className="w-3.5 h-3.5 text-orange-600 animate-pulse" /><span>PENDING CITIZEN VERIFICATION</span></span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full text-xs font-bold">IN PROGRESS</span>;
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">ASSIGNED</span>;
      case 'VERIFIED':
        return <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">VERIFIED</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">REPORTED</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Header Bar */}
      <nav className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-slate-900">My Issue Reports</span>
            </div>
          </div>

          <Link
            to="/report"
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Issue</span>
          </Link>
        </div>
      </nav>

      {/* Main Container */}
      <main className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Submitted Reports & Lifecycle Tracker</h1>
            <p className="text-sm text-slate-600">Track real-time resolution status and verify repair work submitted by field teams.</p>
          </div>
          <button
            onClick={fetchReports}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition self-start sm:self-auto"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-700 text-sm">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-700 hover:underline font-semibold text-xs">Dismiss</button>
          </div>
        )}

        {/* SUCCESS STATE */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-800 hover:underline font-semibold text-xs">Dismiss</button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-28 bg-slate-100 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm">
            <div className="inline-flex p-4 bg-slate-100 text-slate-500 rounded-full">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">No Reports Submitted Yet</h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                You haven't reported any civic problems yet. Spot a pothole or garbage issue? Report it now.
              </p>
            </div>
            <Link
              to="/report"
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Report an Issue</span>
            </Link>
          </div>
        ) : (
          /* REPORTS LIST GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => {
              const incStatus = report.incident?.status || 'REPORTED';
              const resolution = report.incident?.resolution;

              return (
                <div
                  key={report.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center space-x-2">
                        {getCategoryBadge(report.category)}
                        {getSeverityBadge(report.incident?.severity || 'MEDIUM')}
                      </div>
                      {getStatusBadge(incStatus)}
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{report.title}</h3>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                        {report.description}
                      </p>
                    </div>

                    {/* Image Preview Thumbnail */}
                    {report.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 max-h-48">
                        <img
                          src={report.imageUrl.startsWith('http') ? report.imageUrl : `http://localhost:5000${report.imageUrl}`}
                          alt={report.title}
                          className="w-full h-44 object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Coordinates & View Map Action */}
                    <div className="text-xs space-y-2 pt-1">
                      <div className="flex items-center justify-between text-slate-600">
                        <div className="flex items-center space-x-1.5 truncate">
                          <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span className="truncate font-medium">{report.address || `GPS (${report.latitude}, ${report.longitude})`}</span>
                        </div>

                        <button
                          onClick={() => setSelectedReportForMap(report)}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex-shrink-0 transition ml-2"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          <span>View Map</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        <span>{new Date(report.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* RESOLUTION PENDING CITIZEN VERIFICATION BOX */}
                    {incStatus === 'RESOLVED_PENDING_VERIFICATION' && (
                      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3.5 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-orange-900 flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-orange-600 animate-pulse" />
                            <span>Resolution Pending Verification</span>
                          </span>
                        </div>

                        {/* Resolution Proof & Evidence */}
                        {resolution && (
                          <div className="space-y-2 text-xs text-slate-700 bg-white p-3 rounded-xl border border-orange-200">
                            <div>
                              <span className="text-slate-500 font-semibold block">Field Work Notes:</span>
                              <p className="text-slate-900 mt-0.5 font-medium">{resolution.workNotes || 'Work completed by field team.'}</p>
                            </div>

                            {resolution.afterImageUrl && (
                              <div className="pt-1">
                                <span className="text-slate-500 text-[11px] block mb-1">Resolution Evidence Photo:</span>
                                <a
                                  href={resolution.afterImageUrl.startsWith('http') ? resolution.afterImageUrl : `http://localhost:5000${resolution.afterImageUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                                  <span>View Photo Proof</span>
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Verification Question & Decision Buttons */}
                        <div className="space-y-2 pt-1 border-t border-orange-200">
                          <p className="text-xs font-bold text-slate-900">Has this civic issue actually been resolved?</p>

                          {rejectingIncidentId !== report.incidentId ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCitizenVerify(report.incidentId, true)}
                                disabled={isSubmitting}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                )}
                                <span>YES — ISSUE RESOLVED</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setRejectingIncidentId(report.incidentId)}
                                disabled={isSubmitting}
                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                <span>NO — ISSUE STILL EXISTS</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2 bg-white p-3 rounded-xl border border-rose-200">
                              <label className="text-xs text-rose-800 font-bold block">
                                Reason for reopening (e.g. The pothole is still present):
                              </label>
                              <input
                                type="text"
                                placeholder="State why the issue is not resolved..."
                                value={reopenReason}
                                onChange={(e) => setReopenReason(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                              />
                              <div className="flex items-center space-x-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleCitizenVerify(report.incidentId, false, reopenReason)}
                                  disabled={isSubmitting}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 disabled:opacity-50"
                                >
                                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                  <span>Confirm Reopen</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectingIncidentId(null)}
                                  className="px-2 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* RESOLVED STATE CALLOUT */}
                    {incStatus === 'RESOLVED' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                        <span>Thank you. This civic issue has been verified and resolved.</span>
                      </div>
                    )}

                    {/* REOPENED STATE CALLOUT */}
                    {incStatus === 'REOPENED' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
                        <RotateCcw className="w-4 h-4 flex-shrink-0 text-rose-600" />
                        <span>This issue has been reopened for further municipal action.</span>
                      </div>
                    )}
                  </div>

                  {/* Footer IDs */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Report #{report.id.substring(0, 8)}</span>
                    <span>Incident #{report.incidentId.substring(0, 8)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Location Viewer Modal */}
        {selectedReportForMap && (
          <LocationViewerModal
            report={selectedReportForMap}
            onClose={() => setSelectedReportForMap(null)}
          />
        )}
      </main>
    </div>
  );
}
