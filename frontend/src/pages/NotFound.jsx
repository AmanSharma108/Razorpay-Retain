import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 mb-6">
        <ShieldAlert className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-semibold text-slate-200 mb-3">Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-md mb-8">
        The requested resource or page does not exist in the Razorpay Retain platform.
      </p>
      <Link
        to="/"
        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-600/25"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
