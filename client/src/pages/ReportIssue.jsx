import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createReport } from '../services/api';
import LocationPicker from '../components/LocationPicker';
import {
  Activity,
  AlertTriangle,
  Upload,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-react';

export default function ReportIssue() {
  const navigate = useNavigate();

  const [category, setCategory] = useState('POTHOLE');
  const [severity, setSeverity] = useState('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedReport, setSubmittedReport] = useState(null);

  // Handle Location Picker Changes
  const handleLocationChange = (loc) => {
    if (loc.latitude) setLatitude(loc.latitude);
    if (loc.longitude) setLongitude(loc.longitude);
    if (loc.address !== undefined) setAddress(loc.address);
  };

  // Handle Image Selection and Preview
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size must be less than 5MB.');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('severity', severity);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('address', address);

      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await createReport(formData);

      if (res.success && res.report) {
        setSubmittedReport(res.report);
      } else {
        setError(res.message || 'Failed to submit report.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred while submitting the report.');
    } finally {
      setIsSubmitting(false);
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
              <span className="font-bold text-lg text-slate-900">Report Civic Problem</span>
            </div>
          </div>

          <Link to="/my-reports" className="text-sm text-blue-600 hover:text-blue-700 font-bold hover:underline">
            My Submitted Reports
          </Link>
        </div>
      </nav>

      <main className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* SUCCESS CONFIRMATION STATE */}
        {submittedReport ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-sm space-y-6 text-center">
            <div className="inline-flex p-4 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Issue Reported Successfully!</h2>
              <p className="text-base text-slate-600 max-w-md mx-auto">
                Your report has been received and correlated into the CivicPulse incident workflow.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left text-sm space-y-3.5">
              <div className="flex justify-between border-b border-slate-200 pb-2.5">
                <span className="text-slate-500 font-medium">Report ID</span>
                <span className="font-mono font-bold text-slate-900">{submittedReport.id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2.5">
                <span className="text-slate-500 font-medium">Linked Incident ID</span>
                <span className="font-mono font-bold text-blue-700">{submittedReport.incidentId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2.5">
                <span className="text-slate-500 font-medium">Selected Coordinates</span>
                <span className="font-mono text-slate-900 font-medium">
                  {submittedReport.latitude}, {submittedReport.longitude}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2.5">
                <span className="text-slate-500 font-medium">Category & Severity</span>
                <span className="font-semibold text-amber-700">
                  {submittedReport.category} ({submittedReport.incident?.severity || severity})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">SLA Resolution Target</span>
                <span className="font-bold text-emerald-700">
                  {submittedReport.incident?.slaHours || 72} Hours
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to="/my-reports"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
              >
                View My Reports
              </Link>
              <button
                onClick={() => {
                  setSubmittedReport(null);
                  setDescription('');
                  setTitle('');
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-sm font-semibold transition"
              >
                Report Another Issue
              </button>
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Report a Civic Problem
              </h1>
              <p className="text-sm sm:text-base text-slate-600">
                Pin the exact issue location on the interactive map and describe the problem for municipal authorities.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-3 text-rose-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category & Severity Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1">
                    <span>Category</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  >
                    <option value="POTHOLE">Pothole / Damaged Road</option>
                    <option value="GARBAGE">Garbage / Waste Overflow</option>
                    <option value="STREETLIGHT">Broken Streetlight / Electrical</option>
                    <option value="DRAINAGE">Drainage / Sewage Blockage</option>
                    <option value="WATER_LEAKAGE">Water Leakage / Pipe Burst</option>
                    <option value="DAMAGED_ROAD">Road Construction / Barrier Damage</option>
                    <option value="OTHER">Other Civic Incident</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1">
                    <span>Perceived Severity</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  >
                    <option value="LOW">Low (Minor inconvenience / SLA: 7 days)</option>
                    <option value="MEDIUM">Medium (Standard priority / SLA: 3 days)</option>
                    <option value="HIGH">High (Traffic hazard / SLA: 48 hours)</option>
                    <option value="CRITICAL">Critical (Immediate danger / SLA: 24 hours)</option>
                  </select>
                </div>
              </div>

              {/* Title (Optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Title (Optional)</label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Massive Pothole near Central Bus Stop"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center space-x-1">
                  <span>Detailed Description</span>
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, approximate size, depth, safety risks, or surrounding landmarks..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition resize-none"
                />
              </div>

              {/* Interactive Leaflet Location Picker */}
              <div className="space-y-3 p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  address={address}
                  onChange={handleLocationChange}
                />

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-600">Street Address / Landmark Details (Optional)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g., Corner of 5th Cross & MG Road, Indiranagar"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Photo Upload Section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Photo Evidence (Optional)</label>

                {imagePreview ? (
                  <div className="relative inline-block border border-slate-200 rounded-2xl overflow-hidden shadow-sm group">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-56 object-cover rounded-2xl" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full transition shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl cursor-pointer transition hover:bg-blue-50/30">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-bold text-slate-700">Click to upload photo evidence</span>
                    <span className="text-xs text-slate-500 mt-1">JPEG, PNG, WEBP up to 5MB</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-semibold transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting Report...' : 'Submit Civic Issue Report'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
