import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Users, Trophy, Radio, CheckCircle2, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { getSocket } from '../socket.js';
import { getAuthToken } from '../auth.js';

export default function PreviousPolls({ onNavigate }) {
  const [polls, setPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchPreviousPolls = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const authToken = getAuthToken();
      const participantId = localStorage.getItem('rt_polling_participant_id');

      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      if (participantId) headers['x-participant-id'] = participantId;

      const res = await fetch('/api/polls/previous', { headers });
      const data = await res.json();

      if (data.success) {
        setPolls(data.polls || []);
      } else {
        setErrorMessage(data.error || 'Failed to load previous polls.');
      }
    } catch (err) {
      console.error('Error fetching previous polls:', err);
      setErrorMessage('Could not load previous polls. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPreviousPolls();

    const socket = getSocket();
    const handleUpdate = () => fetchPreviousPolls();

    socket.on('polls:list_updated', handleUpdate);
    socket.on('poll:deleted', handleUpdate);
    socket.on('poll:state_changed', handleUpdate);

    return () => {
      socket.off('polls:list_updated', handleUpdate);
      socket.off('poll:deleted', handleUpdate);
      socket.off('poll:state_changed', handleUpdate);
    };
  }, []);

  return (
    <div id="previous-polls-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* Back button and page title */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Previous Polls
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Archived results and final vote distributions from concluded polls.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('create')}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <span>Create New Poll</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-500">Loading previous polls...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-rose-800">{errorMessage}</p>
          <button
            type="button"
            onClick={fetchPreviousPolls}
            className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : polls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Previous Polls</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            When polls end, their completed vote tallies and final distributions will appear here.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span>Create the First Poll</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const totalVotes = (poll.options || []).reduce((sum, o) => sum + (o.votes || 0), 0);
            const maxVotes = Math.max(...(poll.options || []).map((o) => o.votes || 0), 0);

            return (
              <div
                key={poll.roomCode}
                id={`previous-poll-${poll.roomCode}`}
                className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs hover:border-slate-300 transition-all"
              >
                {/* Poll Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                        ENDED
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        ROOM #{poll.roomCode}
                      </span>
                      {poll.visibility && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {poll.visibility}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {poll.question}
                    </h2>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xl font-black text-indigo-600 tracking-tight">
                      {totalVotes}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Total Votes
                    </p>
                  </div>
                </div>

                {/* Final Results (Read-Only) */}
                <div className="space-y-3">
                  {(poll.options || []).map((opt) => {
                    const percentage = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                    const isLeading = totalVotes > 0 && opt.votes === maxVotes && maxVotes > 0;

                    return (
                      <div
                        key={opt.id}
                        className={`p-3.5 rounded-xl border ${
                          isLeading
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50/60 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {isLeading && <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                            <span className={`font-semibold truncate ${isLeading ? 'text-slate-900 font-bold' : 'text-slate-800'}`}>
                              {opt.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono">
                            <span className="font-bold text-slate-700">{percentage}%</span>
                            <span className="text-slate-400 text-[11px]">({opt.votes || 0} votes)</span>
                          </div>
                        </div>

                        <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLeading ? 'bg-amber-500' : 'bg-slate-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
