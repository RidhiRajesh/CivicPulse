import React, { useEffect, useState } from 'react';
import { fetchHealthStatus } from '../services/api';
import { Activity, Database, Server, RefreshCw, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

export default function HealthCheck() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const checkStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    const result = await fetchHealthStatus();
    if (result.success) {
      setHealthData(result.data);
    } else {
      setHealthData(null);
      setErrorMsg(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                CivicPulse
              </h1>
              <p className="text-xs text-slate-400">Intelligent Smart-City Platform</p>
            </div>
          </div>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            Step 1: Foundation
          </span>
        </div>

        {/* Status Section */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">System Diagnostic</h2>

          {loading ? (
            <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-800 flex items-center justify-center space-x-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
              <span>Verifying backend and database connection...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-3">
              <div className="flex items-center space-x-3 text-rose-400 font-semibold">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <span>Backend Connection Failed</span>
              </div>
              <p className="text-sm text-slate-300 pl-9">{errorMsg}</p>
              <p className="text-xs text-slate-400 pl-9">
                Ensure the Express server is running at <code className="text-sky-300">http://localhost:5000</code>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Express Backend Card */}
              <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
                    <Server className="w-4 h-4 text-sky-400" />
                    <span>Express Backend</span>
                  </div>
                  {healthData?.success ? (
                    <span className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Online</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-xs text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Offline</span>
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-slate-300">
                  <p><span className="text-slate-500">Message:</span> {healthData?.message}</p>
                  <p><span className="text-slate-500">Timestamp:</span> {healthData?.timestamp}</p>
                </div>
              </div>

              {/* PostgreSQL / Prisma Card */}
              <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span>PostgreSQL (Prisma)</span>
                  </div>
                  {healthData?.database?.status === 'connected' ? (
                    <span className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Disconnected</span>
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-slate-300">
                  <p><span className="text-slate-500">Status:</span> {healthData?.database?.message}</p>
                  {healthData?.database?.error && (
                    <p className="text-rose-400 font-mono text-[11px] truncate">{healthData?.database?.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action & Info */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            API Base: <code className="text-slate-400">{import.meta.env.VITE_API_BASE_URL || '/api'}</code>
          </div>
          <button
            onClick={checkStatus}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-check Health</span>
          </button>
        </div>
      </div>
    </div>
  );
}
