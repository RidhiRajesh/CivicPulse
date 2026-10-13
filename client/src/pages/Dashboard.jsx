import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  LogOut,
  UserCheck,
  Shield,
  HardHat,
  HeartHandshake,
  ExternalLink,
  PlusCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'AUTHORITY':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span>Municipal Authority</span>
          </span>
        );
      case 'FIELD_WORKER':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-bold">
            <HardHat className="w-3.5 h-3.5 text-teal-600" />
            <span>Field Worker</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
            <HeartHandshake className="w-3.5 h-3.5 text-blue-600" />
            <span>Verified Citizen</span>
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
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">
              Civic<span className="text-blue-600">Pulse</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/health"
              className="text-xs font-medium text-slate-600 hover:text-blue-600 transition flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <span>System Status</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              onClick={logout}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 mt-8">
        {/* Welcome Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Welcome back, {user?.name}!
              </h1>
              {getRoleBadge(user?.role)}
            </div>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Logged in as <span className="text-blue-700 font-semibold">{user?.role}</span>. Access active civic management tools and spatial services below.
            </p>
          </div>
        </div>

        {/* Citizen Quick Actions */}
        {user?.role === 'CITIZEN' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Citizen Core Services</h2>
              <span className="text-xs text-slate-400">Intelligent Smart-City Portal</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Report An Issue Card */}
              <Link
                to="/report"
                className="group bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit border border-blue-100 group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Report an Issue
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Submit a new civic problem report (pothole, garbage, streetlight, water leakage) with interactive map selection and photo evidence upload.
                  </p>
                </div>
                <div className="flex items-center text-sm font-bold text-blue-600 space-x-1.5 pt-4 border-t border-slate-100">
                  <span>Create New Report</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* My Reports Card */}
              <Link
                to="/my-reports"
                className="group bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl w-fit border border-teal-100 group-hover:scale-105 transition-transform">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                    My Submitted Reports
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Track real-time status, severity, SLA countdowns, field work evidence, and verify completed resolutions for issues you reported.
                  </p>
                </div>
                <div className="flex items-center text-sm font-bold text-teal-600 space-x-1.5 pt-4 border-t border-slate-100">
                  <span>View Tracked Reports</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Authority Quick Actions */}
        {user?.role === 'AUTHORITY' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Authority Control Center</h2>
              <span className="text-xs text-slate-400">Municipal Operations</span>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <Link
                to="/authority"
                className="group bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl w-fit border border-purple-100 group-hover:scale-105 transition-transform">
                    <Shield className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                    Authority Operational Control Center
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Manage correlated Civic Incidents, inspect spatial maps, verify reported problems, monitor SLA breaches, and assign field workers.
                  </p>
                </div>
                <div className="flex items-center text-sm font-bold text-purple-600 space-x-1.5 pt-4 border-t border-slate-100">
                  <span>Open Operational Dashboard</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Field Worker Quick Actions */}
        {user?.role === 'FIELD_WORKER' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Field Operations</h2>
              <span className="text-xs text-slate-400">Field Worker Portal</span>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <Link
                to="/worker"
                className="group bg-white border border-slate-200 hover:border-teal-300 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl w-fit border border-teal-100 group-hover:scale-105 transition-transform">
                    <HardHat className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                    Field Worker Operations Dashboard
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    View your assigned civic repair incidents, start work, log timeline progress notes, and upload photo proof to submit work resolutions.
                  </p>
                </div>
                <div className="flex items-center text-sm font-bold text-teal-600 space-x-1.5 pt-4 border-t border-slate-100">
                  <span>Open Field Worker Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* User Details Profile Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>Authenticated Profile Information</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-xs font-medium block">Full Name</span>
              <span className="font-bold text-slate-900">{user?.name}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-xs font-medium block">Email Address</span>
              <span className="font-semibold text-slate-900">{user?.email}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-xs font-medium block">Account Role</span>
              <span className="font-bold text-blue-700">{user?.role}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 text-xs font-medium block">Department</span>
              <span className="font-semibold text-slate-900">{user?.department || 'General Citizen Services'}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
