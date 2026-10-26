import React, { useState } from 'react';
import { getImageUrl } from '../services/api';
import {
  X,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Users,
  FileText,
  Building,
  Image as ImageIcon,
  Activity,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Check,
  Loader2,
  HardHat,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

export default function IncidentDetailModal({
  incident,
  onClose,
  onVerify,
  isVerifying = false,
  workers = [],
  onAssign,
  isAssigning = false,
  onAdminResolve,
  isAdminResolving = false,
}) {
  const [comment, setComment] = useState('');
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);

  // Worker assignment state
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Admin Override Closure state
  const [adminReason, setAdminReason] = useState('');
  const [showAdminResolveConfirm, setShowAdminResolveConfirm] = useState(false);

  if (!incident) return null;

  const supportCount = incident.supporters?.length || incident.supportCount || 1;
  const reportCount = incident.reports?.length || incident._count?.reports || 1;
  const breakdown = incident.priorityBreakdown || {};

  const activeAssignment = incident.assignments && incident.assignments.length > 0 ? incident.assignments[0] : null;

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (onVerify) {
      onVerify(incident.id, comment);
    }
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!selectedWorkerId) return;
    if (onAssign) {
      onAssign(incident.id, selectedWorkerId, assignmentNotes);
    }
  };

  const handleAdminResolveSubmit = (e) => {
    e.preventDefault();
    if (!adminReason.trim()) return;
    if (onAdminResolve) {
      onAdminResolve(incident.id, adminReason.trim());
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REPORTED':
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
            REPORTED (Unverified)
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">
            VERIFIED
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-xs font-bold">
            ASSIGNED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-3 py-1 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-full text-xs font-bold">
            IN PROGRESS
          </span>
        );
      case 'RESOLVED_PENDING_VERIFICATION':
        return (
          <span className="px-3 py-1 bg-orange-50 text-orange-800 border border-orange-300 rounded-full text-xs font-bold">
            PENDING VERIFICATION
          </span>
        );
      case 'REOPENED':
        return (
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-bold">
            <RotateCcw className="w-3 h-3 text-rose-600" />
            <span>DISPUTED / REOPENED</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
            RESOLVED
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

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-3 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-xs font-bold">
            CRITICAL SEVERITY
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-3 py-1 bg-orange-50 text-orange-800 border border-orange-200 rounded-full text-xs font-bold">
            HIGH SEVERITY
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
            MEDIUM SEVERITY
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">
            LOW SEVERITY
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col text-slate-900">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {getSeverityBadge(incident.severity)}
              {getStatusBadge(incident.status)}
              <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-mono font-bold">
                ID: {incident.id?.slice(0, 8)}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{incident.title}</h2>
            <p className="text-xs text-slate-500 font-mono font-medium">
              Category: <span className="text-blue-700 font-bold">{incident.category}</span> | Created:{' '}
              {new Date(incident.createdAt).toLocaleString()}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          {/* Incident Description */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Overview</span>
            <p className="text-sm sm:text-base text-slate-900 leading-relaxed font-medium">{incident.description}</p>
          </div>

          {/* Citizen Resolution Dispute Alert Banner */}
          {(incident.status === 'REOPENED' || incident.resolution?.citizenFeedback || (incident.resolution?.verifications && incident.resolution.verifications.length > 0)) && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-rose-900 font-bold text-base">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  <span>Citizen Resolution Dispute Center</span>
                </div>
                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-xs font-bold">
                  {incident.status === 'REOPENED' ? 'Active Dispute / Reopened' : 'Resolution Feedback'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                The reporting citizen reviewed the completed work proof and rejected or commented on the resolution, returning this issue to authority attention.
              </p>

              {/* Citizen Dispute Feedback / Reason */}
              {incident.resolution?.citizenFeedback && (
                <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-1">
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">
                    Citizen Stated Feedback / Dispute Reason:
                  </span>
                  <p className="text-sm font-semibold text-slate-900 italic">
                    "{incident.resolution.citizenFeedback}"
                  </p>
                </div>
              )}

              {/* Multi-citizen verification history if available */}
              {incident.resolution?.verifications && incident.resolution.verifications.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-bold text-slate-600 uppercase block">Citizen Verification Log:</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {incident.resolution.verifications.map((v) => (
                      <div key={v.id} className="text-xs p-2.5 bg-white rounded-lg border border-slate-200 flex items-start justify-between">
                        <div>
                          <span className={`font-bold mr-2 ${v.confirmed ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {v.confirmed ? '✓ Confirmed Resolved' : '✗ Disputed / Rejected'}:
                          </span>
                          <span className="text-slate-800 font-medium">{v.reason || (v.confirmed ? 'Confirmed resolved' : 'Disputed')}</span>
                          <div className="text-[11px] text-slate-400 mt-0.5">By: {v.citizen?.name || 'Citizen'} ({v.citizen?.email})</div>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">{new Date(v.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Field Worker Assignment Banner (For VERIFIED, REOPENED, or ASSIGNED status) */}
          {(incident.status === 'VERIFIED' || incident.status === 'REOPENED' || incident.status === 'ASSIGNED') && (
            <div className={`border rounded-2xl p-5 sm:p-6 space-y-4 ${
              incident.status === 'REOPENED'
                ? 'bg-rose-50/70 border-rose-300'
                : incident.status === 'ASSIGNED'
                ? 'bg-slate-50 border-slate-300'
                : 'bg-purple-50 border-purple-200'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-base text-slate-900">
                <HardHat className={`w-5 h-5 ${incident.status === 'REOPENED' ? 'text-rose-600' : 'text-purple-600'}`} />
                <span>
                  {incident.status === 'REOPENED'
                    ? 'Re-dispatch Incident to Field Worker (Dispute Resolution)'
                    : incident.status === 'ASSIGNED'
                    ? 'Reassign Incident to Another Field Worker'
                    : 'Assign Incident to Field Worker'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600">
                {incident.status === 'REOPENED'
                  ? 'This incident was disputed by the citizen. Select an eligible municipal field worker to re-inspect and re-execute field work.'
                  : incident.status === 'ASSIGNED'
                  ? 'This incident is currently assigned. You can reassign it to a different field worker if needed.'
                  : 'This incident is verified. Select an active municipal field worker to assign repair and resolution duties.'}
              </p>

              <form onSubmit={handleAssignSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-700 font-bold block mb-1.5">Select Field Worker</label>
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => setSelectedWorkerId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-purple-600"
                    >
                      <option value="">-- Choose Field Worker --</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.department || 'Maintenance'}) - {w.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-700 font-bold block mb-1.5">Assignment Instructions / Notes</label>
                    <input
                      type="text"
                      placeholder={
                        incident.status === 'REOPENED'
                          ? 'e.g. Citizen reported hole not fully leveled. Re-pave surface.'
                          : 'e.g. Inspect drain pit near bus stop, replace grate.'
                      }
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!selectedWorkerId || isAssigning}
                    className={`px-5 py-2.5 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50 ${
                      incident.status === 'REOPENED'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isAssigning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    <span>
                      {incident.status === 'REOPENED'
                        ? 'Re-dispatch Field Worker'
                        : incident.status === 'ASSIGNED'
                        ? 'Reassign Field Worker'
                        : 'Assign Field Worker'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Assigned Worker Status Card */}
          {activeAssignment && (
            <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs sm:text-sm">
                  <HardHat className="w-4 h-4 text-purple-600" />
                  <span>Assigned Field Worker Details</span>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  Assigned on: {new Date(activeAssignment.assignedAt).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-xs block font-medium">Worker Name</span>
                  <span className="font-bold text-slate-900">{activeAssignment.worker?.name}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-xs block font-medium">Worker Email</span>
                  <span className="font-medium text-slate-900">{activeAssignment.worker?.email}</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-xs block font-medium">Assigned By</span>
                  <span className="font-medium text-slate-900">{activeAssignment.assignedBy?.name || 'Authority'}</span>
                </div>
              </div>

              {activeAssignment.notes && (
                <div className="text-xs sm:text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold">Instructions: </span>
                  {activeAssignment.notes}
                </div>
              )}
            </div>
          )}

          {/* Resolution Evidence Card (If resolved pending verification) */}
          {incident.resolution && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Field Resolution Submitted</span>
                </div>
                <span className="text-xs text-emerald-800 font-mono">
                  Resolved at: {new Date(incident.resolution.resolvedAt).toLocaleString()}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                Work Notes: <span className="text-slate-900 font-bold">{incident.resolution.workNotes}</span>
              </p>

              {incident.resolution.afterImageUrl && (
                <div className="pt-2">
                  <span className="text-xs text-slate-600 block mb-1.5 font-medium">Resolution Evidence Photo:</span>
                  <a
                    href={getImageUrl(incident.resolution.afterImageUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-200 transition"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-700" />
                    <span>View Resolution Proof Image</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Priority Score Card & Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-base">Dynamic Community Priority Engine</h3>
              </div>
              <div className="flex items-center space-x-2 bg-purple-50 text-purple-900 border border-purple-200 px-3.5 py-1.5 rounded-xl">
                <span className="text-xs font-semibold text-purple-700">Priority Score:</span>
                <span className="text-xl font-extrabold text-purple-900">{incident.priorityScore ?? 0}</span>
                <span className="text-xs text-purple-600">/ 100</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs sm:text-sm">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-xs font-medium">Base Severity</span>
                <span className="font-bold text-slate-900 text-sm">{breakdown.severityScore ?? 'N/A'} pts</span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-xs font-medium">Community Impact</span>
                <span className="font-bold text-blue-700 text-sm">
                  {breakdown.communityImpact ? `${breakdown.communityImpact}x` : '1.0x'} ({supportCount} reports)
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-xs font-medium">Aging Boost</span>
                <span className="font-bold text-amber-700 text-sm">
                  +{breakdown.ageScore ?? 0} pts ({breakdown.hoursOld ?? 0}h)
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-xs font-medium">Location Risk</span>
                <span className="font-bold text-rose-700 text-sm">
                  +{breakdown.locationRiskScore ?? 0} pts
                </span>
              </div>
            </div>
          </div>

          {/* Location & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Geographic Location</span>
              </div>
              <p className="text-slate-900 font-semibold">{incident.address || 'Address not provided'}</p>
              <div className="text-slate-500 font-mono text-xs">
                Coordinates: {incident.latitude}, {incident.longitude}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center space-x-2 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>SLA Management & Department</span>
              </div>
              <div className="text-slate-800">
                Department: <span className="font-bold text-slate-900">{incident.department || 'General Works'}</span>
              </div>
              <div className="text-slate-500 text-xs font-medium">
                SLA Deadline:{' '}
                <span className="font-bold text-amber-700">
                  {incident.slaDeadline ? new Date(incident.slaDeadline).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Supporting Citizen Reports (Correlated Slice) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Correlated Citizen Reports ({reportCount})</span>
              </h3>
              <span className="text-xs text-slate-400">Spatial Proximity + Description Correlation</span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {incident.reports && incident.reports.length > 0 ? (
                incident.reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs sm:text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{report.title}</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-600 leading-relaxed">{report.description}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500">
                        Citizen: <span className="text-slate-900 font-bold">{report.citizen?.name || 'Anonymous'}</span> ({report.citizen?.email})
                      </span>

                      {report.imageUrl && (
                        <a
                          href={getImageUrl(report.imageUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-700 font-bold underline flex items-center space-x-1"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>View Photo Evidence</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                  No individual report sub-records retrieved.
                </div>
              )}
            </div>
          </div>

          {/* Audit Timeline */}
          {incident.statusUpdates && incident.statusUpdates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Audit Log & Lifecycle History</span>
              </h3>

              <div className="space-y-2">
                {incident.statusUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">
                          {update.oldStatus ? `${update.oldStatus} → ` : ''}
                          <span className="text-emerald-700 font-extrabold">{update.newStatus}</span>
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          by {update.user?.name || 'System'} ({update.user?.role || 'SYSTEM'})
                        </span>
                      </div>
                      {update.comment && <p className="text-slate-600 text-xs italic font-medium">"{update.comment}"</p>}
                    </div>

                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(update.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-slate-600">
            {incident.status === 'REPORTED' ? (
              <span className="text-amber-800 font-bold flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Action Required: Verify this reported incident to move to field assignment.</span>
              </span>
            ) : incident.status === 'VERIFIED' ? (
              <span className="text-purple-800 font-bold flex items-center space-x-1.5">
                <HardHat className="w-4 h-4 text-purple-600" />
                <span>Action Required: Select and assign a Field Worker above.</span>
              </span>
            ) : incident.status === 'REOPENED' ? (
              <span className="text-rose-800 font-bold flex items-center space-x-1.5">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span>Citizen Dispute: Re-dispatch above or execute administrative override closure below.</span>
              </span>
            ) : incident.status === 'RESOLVED_PENDING_VERIFICATION' ? (
              <span className="text-orange-800 font-bold flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-orange-600" />
                <span>Awaiting Citizen Verification: Can be finalized via administrative override if needed.</span>
              </span>
            ) : (
              <span className="text-emerald-800 font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Incident is active or completed in municipal lifecycle flow.</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center space-x-3 w-full sm:w-auto justify-end gap-2">
            {/* Verify Incident Action (for REPORTED) */}
            {incident.status === 'REPORTED' && (
              <>
                {!showVerifyConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowVerifyConfirm(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Incident</span>
                  </button>
                ) : (
                  <form onSubmit={handleVerifySubmit} className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Optional authority comment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 w-52 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center space-x-1 disabled:opacity-50 shadow-sm"
                    >
                      {isVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Confirm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVerifyConfirm(false)}
                      className="px-2.5 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Administrative Override Closure (for REOPENED or RESOLVED_PENDING_VERIFICATION) */}
            {(incident.status === 'REOPENED' || incident.status === 'RESOLVED_PENDING_VERIFICATION') && (
              <>
                {!showAdminResolveConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowAdminResolveConfirm(true)}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center space-x-1.5"
                    title="Administratively close this incident with a mandatory justification"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Administrative Override Closure</span>
                  </button>
                ) : (
                  <form onSubmit={handleAdminResolveSubmit} className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Mandatory administrative justification..."
                      required
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                      className="px-3.5 py-2 bg-white border border-rose-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-rose-600 w-64 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={isAdminResolving || !adminReason.trim()}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center space-x-1 disabled:opacity-50 shadow-sm"
                    >
                      {isAdminResolving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Confirm Override</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminResolveConfirm(false);
                        setAdminReason('');
                      }}
                      className="px-2.5 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
