import React, { useState } from 'react';
import { ArrowLeft, LogIn, AlertCircle, Sparkles } from 'lucide-react';
import { getOrCreateParticipantId } from '../socket.js';
import { getAuthToken } from '../auth.js';

export default function JoinRoom({ onNavigate, initialCode = '' }) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a room code.');
      return;
    }

    if (cleanCode.length < 3) {
      setError('Room codes are at least 3 characters.');
      return;
    }

    setIsChecking(true);
    try {
      const pid = getOrCreateParticipantId();
      const token = getAuthToken();
      const headers = { 'x-participant-id': pid };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/polls/${cleanCode}`, { headers });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Room "${cleanCode}" does not exist.`);
      }

      // Valid room found, navigate to participant room
      onNavigate('participant', cleanCode);
    } catch (err) {
      setError(err.message || 'Unable to find room. Please verify the code.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div id="join-room-page" className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <button
        id="join-back-to-home-btn"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6">
          <LogIn className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Join a Live Poll</h1>
        <p className="text-slate-500 text-sm mb-6">
          Enter the room code shared by the host to participate in the real-time vote.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="join-room-input"
              className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2"
            >
              Room Code
            </label>
            <input
              id="join-room-input"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="e.g. VOTE42"
              maxLength={12}
              autoFocus
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-mono tracking-widest text-center uppercase text-xl font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all"
            />
          </div>

          {error && (
            <div
              id="join-error-alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            id="join-submit-btn"
            type="submit"
            disabled={isChecking}
            className="w-full py-3.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 text-sm"
          >
            {isChecking ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Checking Room...</span>
              </>
            ) : (
              <>
                <span>Enter Room</span>
                <LogIn className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
