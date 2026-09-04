import React, { useState } from 'react';
import { ArrowLeft, Sparkles, ShieldCheck } from 'lucide-react';
import PollForm from '../components/PollForm.jsx';
import { saveAdminToken } from '../socket.js';
import { getAuthToken } from '../auth.js';

export default function AdminCreate({ onNavigate }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleCreatePoll = async ({ question, options, visibility }) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const authToken = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/polls', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, options, visibility }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create poll room.');
      }

      // Store the admin token for authorization
      saveAdminToken(data.roomCode, data.adminToken);

      // Navigate to dashboard
      onNavigate('dashboard');
    } catch (err) {
      console.error('Error creating poll:', err);
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="admin-create-page" className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Top breadcrumb navigation */}
      <button
        id="back-to-home-btn"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Host / Admin Setup</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create a New Poll</h1>
        <p className="text-slate-500 text-sm mt-1">
          Set your poll question and add between 2 to 6 candidate options. A unique room code will be generated.
        </p>
      </div>

      {/* Poll Creation Form */}
      <PollForm
        onSubmit={handleCreatePoll}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </div>
  );
}
