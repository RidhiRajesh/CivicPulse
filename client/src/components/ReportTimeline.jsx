import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Shield,
  HardHat,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Activity,
} from 'lucide-react';

const STAGES = [
  {
    key: 'REPORTED',
    label: 'Reported',
    badge: 'Stage 1',
    description: 'Issue reported by citizen with location and initial evidence.',
    icon: FileText,
  },
  {
    key: 'VERIFIED',
    label: 'Verified',
    badge: 'Stage 2',
    description: 'Municipal authority reviewed and validated the report.',
    icon: Shield,
  },
  {
    key: 'ASSIGNED',
    label: 'Assigned',
    badge: 'Stage 3',
    description: 'Work order dispatched to municipal department field team.',
    icon: HardHat,
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    badge: 'Stage 4',
    description: 'Field workers have begun repair operations on site.',
    icon: Activity,
  },
  {
    key: 'RESOLVED_PENDING_VERIFICATION',
    label: 'Verification',
    badge: 'Stage 5',
    description: 'Field repair completed with proof. Awaiting citizen confirmation.',
    icon: Clock,
  },
  {
    key: 'RESOLVED',
    label: 'Resolved',
    badge: 'Stage 6',
    description: 'Citizen confirmed resolution; incident officially closed.',
    icon: CheckCircle2,
  },
];

const STAGE_INDEX_MAP = {
  REPORTED: 0,
  VERIFIED: 1,
  ASSIGNED: 2,
  IN_PROGRESS: 3,
  RESOLVED_PENDING_VERIFICATION: 4,
  RESOLVED: 5,
};

export default function ReportTimeline({ report }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!report) return null;

  const currentStatus = report.incident?.status || 'REPORTED';
  const isReopened = currentStatus === 'REOPENED';
  const currentIndex = STAGE_INDEX_MAP[currentStatus] ?? 0;

  // Determine stage progress state: 'completed' | 'current' | 'upcoming' | 'reopened'
  const getStageState = (stageIndex) => {
    if (isReopened) {
      if (stageIndex < 4) return 'completed';
      if (stageIndex === 4) return 'reopened';
      return 'upcoming';
    }

    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) {
      return currentStatus === 'RESOLVED' ? 'completed' : 'current';
    }
    return 'upcoming';
  };

  // High-level summary banner for the card
  const getSummary = () => {
    if (isReopened) {
      return {
        title: 'Status: Reopened for Further Action',
        subtitle: 'Citizen indicated the problem still exists. Returned to field team for re-investigation.',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
        dotClass: 'bg-rose-600 animate-pulse',
      };
    }
    switch (currentStatus) {
      case 'RESOLVED':
        return {
          title: 'Status: Resolved & Closed',
          subtitle: 'All stages finished. Civic issue successfully resolved.',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-600',
        };
      case 'RESOLVED_PENDING_VERIFICATION':
        return {
          title: 'Action Required: Verification Pending',
          subtitle: 'Field team uploaded proof. Please confirm whether the issue is fixed.',
          badgeClass: 'bg-orange-50 text-orange-900 border-orange-300',
          dotClass: 'bg-orange-500 animate-pulse',
        };
      case 'IN_PROGRESS':
        return {
          title: 'Stage 4 of 6: Repair Work In Progress',
          subtitle: 'Field team is actively working on the fix on site.',
          badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          dotClass: 'bg-cyan-600 animate-pulse',
        };
      case 'ASSIGNED':
        return {
          title: 'Stage 3 of 6: Assigned to Field Team',
          subtitle: 'Dispatched to department workers for repair execution.',
          badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
          dotClass: 'bg-purple-600',
        };
      case 'VERIFIED':
        return {
          title: 'Stage 2 of 6: Verified by Authority',
          subtitle: 'Confirmed by municipal authority; queued for worker dispatch.',
          badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
          dotClass: 'bg-blue-600',
        };
      default:
        return {
          title: 'Stage 1 of 6: Report Submitted',
          subtitle: 'Report received; awaiting municipal verification.',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
        };
    }
  };

  const summary = getSummary();

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 transition-all text-xs">
      {/* Header Summary & Toggle Button */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${summary.dotClass}`} />
            <span className="font-bold text-slate-900 text-xs truncate">{summary.title}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug line-clamp-1">{summary.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition flex-shrink-0 shadow-2xs"
          title={isExpanded ? 'Collapse timeline' : 'Expand full timeline'}
        >
          <span>{isExpanded ? 'Hide Details' : 'Timeline'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Mini Progress Stepper Track (Always Visible) */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          {STAGES.map((s, idx) => {
            const state = getStageState(idx);
            let barColor = 'bg-slate-200';
            if (state === 'completed') barColor = 'bg-emerald-500';
            else if (state === 'current') {
              barColor = currentStatus === 'RESOLVED_PENDING_VERIFICATION' ? 'bg-orange-500' : 'bg-blue-600';
            } else if (state === 'reopened') {
              barColor = 'bg-rose-500';
            }

            return (
              <div
                key={s.key}
                className={`h-1.5 flex-1 rounded-full transition-all ${barColor}`}
                title={`${s.label}: ${state.toUpperCase()}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
          <span>Reported</span>
          <span>In Progress</span>
          <span>{isReopened ? 'Reopened' : 'Resolved'}</span>
        </div>
      </div>

      {/* Expanded Detailed Step-by-Step Vertical Timeline */}
      {isExpanded && (
        <div className="pt-3 border-t border-slate-200 space-y-3 mt-2 animate-fadeIn">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            <span>Workflow Lifecycle Progress</span>
            <span className="text-slate-400 font-mono font-normal normal-case">
              {isReopened ? 'Reopened Cycle' : `Step ${Math.min(currentIndex + 1, 6)} of 6`}
            </span>
          </div>

          <div className="relative pl-6 space-y-4">
            {/* Connecting Vertical Track */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200 -translate-x-1/2" />

            {STAGES.map((stage, idx) => {
              const state = getStageState(idx);
              const StageIcon = stage.icon;

              let iconContainer = 'border-2 border-slate-300 bg-white text-slate-400';
              let badge = (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-semibold">
                  Upcoming
                </span>
              );

              if (state === 'completed') {
                iconContainer = 'bg-emerald-600 text-white border-transparent shadow-xs';
                badge = (
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold flex items-center space-x-0.5">
                    <Check className="w-2.5 h-2.5" />
                    <span>Completed</span>
                  </span>
                );
              } else if (state === 'current') {
                const isPendingVerif = currentStatus === 'RESOLVED_PENDING_VERIFICATION';
                iconContainer = isPendingVerif
                  ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                  : 'bg-blue-600 text-white ring-4 ring-blue-100';
                badge = (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      isPendingVerif
                        ? 'bg-orange-50 text-orange-800 border border-orange-300'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    Current Stage
                  </span>
                );
              } else if (state === 'reopened') {
                iconContainer = 'bg-rose-600 text-white ring-4 ring-rose-100';
                badge = (
                  <span className="text-[10px] px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold flex items-center space-x-0.5">
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reopened</span>
                  </span>
                );
              }

              // Only show real timestamps that actually exist (do not invent dates)
              let stageDate = null;
              if (stage.key === 'REPORTED' && report.createdAt) {
                stageDate = new Date(report.createdAt).toLocaleString();
              } else if (
                stage.key === 'RESOLVED_PENDING_VERIFICATION' &&
                report.incident?.resolution?.resolvedAt
              ) {
                stageDate = new Date(report.incident.resolution.resolvedAt).toLocaleString();
              }

              return (
                <div key={stage.key} className="relative flex items-start space-x-3">
                  {/* Step Icon Node */}
                  <div
                    className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-xs z-10 transition-colors ${iconContainer}`}
                  >
                    {state === 'completed' ? (
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    ) : state === 'reopened' ? (
                      <RotateCcw className="w-3 h-3" />
                    ) : (
                      <StageIcon className="w-2.5 h-2.5" />
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span
                        className={`font-bold text-xs ${
                          state === 'completed'
                            ? 'text-slate-800'
                            : state === 'current'
                            ? 'text-blue-700 font-extrabold'
                            : state === 'reopened'
                            ? 'text-rose-700 font-extrabold'
                            : 'text-slate-400'
                        }`}
                      >
                        {stage.label}
                      </span>
                      {badge}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      {state === 'reopened'
                        ? 'Citizen verified that the issue is still unresolved. Awaiting municipal re-investigation.'
                        : stage.description}
                    </p>

                    {stageDate && (
                      <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                        Timestamp: {stageDate}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
