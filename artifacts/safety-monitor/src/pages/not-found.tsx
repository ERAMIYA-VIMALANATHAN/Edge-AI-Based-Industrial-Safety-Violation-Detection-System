import React from "react";
import { Link } from "wouter";
import { AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100 font-mono">
      <div className="text-center space-y-6">
        <AlertTriangle size={64} className="mx-auto text-amber-500 opacity-80" />
        <h1 className="text-4xl font-bold tracking-tight text-white">
          404 <span className="text-amber-500">|</span> UNKNOWN
        </h1>
        <p className="text-sm text-slate-400 uppercase tracking-widest">
          System module not found or unauthorized.
        </p>
        <Link href="/">
          <div className="inline-flex items-center justify-center px-4 py-2 mt-4 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 transition-colors cursor-pointer text-sm font-sans">
            <Home size={16} className="mr-2" />
            Return to Command Center
          </div>
        </Link>
      </div>
    </div>
  );
}
