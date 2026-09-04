import React, { useState, useEffect } from 'react';
import {
  Zap,
  Users,
  BarChart3,
  Lightbulb,
  ChevronDown,
  ArrowRight,
  Lock,
  Clock,
  Sparkles,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { getAuthToken } from '../auth.js';
import { getSocket } from '../socket.js';

export default function Home({ onNavigate }) {
  // Join Room state
  const [roomCode, setRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Interactive Mock Poll Demo for Hero (Visual branding only - no real db poll data)
  const [mockOptions, setMockOptions] = useState([
    { id: '1', text: 'AI Workshop', votes: 53, color: 'from-indigo-500 to-purple-500' },
    { id: '2', text: 'Hackathon', votes: 35, color: 'bg-indigo-600/75' },
    { id: '3', text: 'Tech Talk Series', votes: 25, color: 'bg-indigo-700/65' },
    { id: '4', text: 'Community Event', votes: 14, color: 'bg-indigo-800/55' },
  ]);
  const [userVotedMockId, setUserVotedMockId] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Past polls preview state (observes existing visibility rules)
  const [pastPolls, setPastPolls] = useState([]);
  const [isLoadingPastPolls, setIsLoadingPastPolls] = useState(false);

  // Calculate total mock votes
  const totalMockVotes = mockOptions.reduce((acc, curr) => acc + curr.votes, 0);

  // Handle clicking options in the hero interactive mock card
  const handleVoteMock = (id) => {
    setHasInteracted(true);
    setMockOptions((prev) =>
      prev.map((opt) => {
        if (opt.id === id) {
          const delta = userVotedMockId === id ? -1 : userVotedMockId ? 1 : 1;
          return { ...opt, votes: Math.max(0, opt.votes + (userVotedMockId === id ? -1 : 1)) };
        }
        if (opt.id === userVotedMockId && userVotedMockId !== id) {
          return { ...opt, votes: Math.max(0, opt.votes - 1) };
        }
        return opt;
      })
    );
    setUserVotedMockId((prev) => (prev === id ? null : id));
  };

  // Subtle real-time polling animation for hero: simulated organic vote ticks if user hasn't interacted
  useEffect(() => {
    if (hasInteracted) return;

    const interval = setInterval(() => {
      setMockOptions((prev) => {
        // Pick a random option to gently receive a simulated vote
        const targetIndex = Math.floor(Math.random() * prev.length);
        return prev.map((opt, i) => (i === targetIndex ? { ...opt, votes: opt.votes + 1 } : opt));
      });
    }, 7000);

    return () => clearInterval(interval);
  }, [hasInteracted]);

  // Fetch past polls with standard visibility headers
  useEffect(() => {
    let isMounted = true;
    const fetchPreviousPolls = async () => {
      setIsLoadingPastPolls(true);
      try {
        const authToken = getAuthToken();
        const participantId = localStorage.getItem('rt_polling_participant_id');

        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        if (participantId) headers['x-participant-id'] = participantId;

        const res = await fetch('/api/polls/previous', { headers });
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.polls)) {
          setPastPolls(data.polls.slice(0, 3)); // show top 3 accessible ended polls
        }
      } catch (err) {
        // Silent catch for homepage background preview
      } finally {
        if (isMounted) setIsLoadingPastPolls(false);
      }
    };

    fetchPreviousPolls();

    const socket = getSocket();
    const handleUpdate = () => fetchPreviousPolls();
    socket.on('polls:list_updated', handleUpdate);
    socket.on('poll:state_changed', handleUpdate);

    return () => {
      isMounted = false;
      socket.off('polls:list_updated', handleUpdate);
      socket.off('poll:state_changed', handleUpdate);
    };
  }, []);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const clean = roomCode.trim().toUpperCase();
    if (!clean) {
      setJoinError('Please enter a room code');
      return;
    }
    if (clean.length < 3) {
      setJoinError('Room code must be at least 3 characters');
      return;
    }
    setJoinError('');
    onNavigate('participant', clean);
  };

  const scrollToJoin = () => {
    const el = document.getElementById('join-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="home-page" className="w-full">
      {/* ========================================================================= */}
      {/* SECTION 1: HERO (Dark, visual/branding focused, interactive polling demo) */}
      {/* ========================================================================= */}
      <section
        id="hero-section"
        className="relative w-full bg-gradient-to-b from-[#08091b] via-[#0e102d] to-[#15133a] text-white pt-12 sm:pt-16 lg:pt-20 pb-16 sm:pb-24 overflow-hidden"
      >
        {/* Ambient atmospheric glow spots */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Branding, Typography, Features */}
            <div className="lg:col-span-6 flex flex-col justify-center text-left">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.25em] text-indigo-400">
                  QUESTIONS TODAY. BRIGHTER TOMORROW.
                </span>
              </div>

              {/* Huge Brand Title */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-4">
                <span className="text-white">Poll</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-violet-400">
                  Master
                </span>
              </h1>

              {/* Headline */}
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-100 leading-snug mb-3">
                Real-time polling for teams, clubs, and communities.
              </h2>

              {/* Subhead */}
              <p className="text-sm sm:text-base text-slate-300/85 leading-relaxed max-w-xl mb-8">
                Create impactful polls, share a simple room code, and see responses come alive — instantly, for everyone.
              </p>

              {/* Three Value Proposition Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2">
                {/* 1. Live Results */}
                <div className="flex items-center sm:flex-col sm:items-start gap-3 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 backdrop-blur-xs">
                  <div className="w-10 h-10 rounded-xl bg-indigo-900/60 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">Live Results</h4>
                    <p className="text-[11px] text-slate-400">See answers in real time</p>
                  </div>
                </div>

                {/* 2. No Accounts */}
                <div className="flex items-center sm:flex-col sm:items-start gap-3 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 backdrop-blur-xs">
                  <div className="w-10 h-10 rounded-xl bg-indigo-900/60 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">No Accounts</h4>
                    <p className="text-[11px] text-slate-400">Just a room code</p>
                  </div>
                </div>

                {/* 3. Built for Everyone */}
                <div className="flex items-center sm:flex-col sm:items-start gap-3 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 backdrop-blur-xs">
                  <div className="w-10 h-10 rounded-xl bg-indigo-900/60 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">Built for Everyone</h4>
                    <p className="text-[11px] text-slate-400">Teams, clubs, classes & more</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Interactive Polling Mockup */}
            <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end py-4">
              {/* Neon undulating wave line in background */}
              <svg
                viewBox="0 0 500 400"
                className="absolute -inset-x-8 -inset-y-4 w-[120%] h-[120%] pointer-events-none opacity-40 select-none"
                fill="none"
              >
                <path
                  d="M -20,240 C 90,140 180,310 290,160 C 370,50 440,190 530,120"
                  stroke="url(#neon-wave-gradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="neon-wave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="50%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Handwritten Note (Top Right): "Better Ideas Together" */}
              <div className="absolute -top-3 right-4 sm:right-8 z-30 transform rotate-[-8deg] pointer-events-none select-none">
                <span className="font-handwriting text-2xl sm:text-3xl text-purple-300 tracking-wide drop-shadow-md">
                  Better Ideas Together
                </span>
                <svg
                  className="w-32 h-3 text-purple-400/80 -mt-1 ml-4"
                  viewBox="0 0 100 12"
                  fill="none"
                >
                  <path
                    d="M 2,8 Q 50,0 98,6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Interactive Mock Poll Demonstration Card */}
              <div className="relative w-full max-w-md bg-[#131535]/95 backdrop-blur-xl border border-indigo-500/25 rounded-3xl p-5 sm:p-6 shadow-2xl z-20">
                {/* Floating pill: Responses count */}
                <div className="absolute -top-3 left-4 bg-[#1b1e42]/95 border border-indigo-400/30 rounded-2xl px-3.5 py-1.5 shadow-lg flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="font-extrabold text-white text-xs sm:text-sm">{totalMockVotes}</span>
                  <span className="text-[11px] text-slate-300">responses</span>
                </div>

                {/* Floating pill: Live Status */}
                <div className="absolute -top-3 right-4 sm:right-28 bg-[#1b1e42]/95 border border-indigo-400/30 rounded-full px-3 py-1 shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-white tracking-wide">Live</span>
                </div>

                {/* Question title */}
                <div className="mt-4 mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold block mb-1">
                    Demo Poll Preview
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    Which idea should we pursue?
                  </h3>
                </div>

                {/* 4 Interactive option bars */}
                <div className="space-y-2.5 mb-4">
                  {mockOptions.map((opt) => {
                    const percentage =
                      totalMockVotes > 0 ? Math.round((opt.votes / totalMockVotes) * 100) : 0;
                    const isSelected = userVotedMockId === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleVoteMock(opt.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-950/60 shadow-xs'
                            : 'border-indigo-500/20 bg-indigo-950/30 hover:border-indigo-500/40 hover:bg-indigo-950/50'
                        }`}
                      >
                        {/* Option text and percentage header */}
                        <div className="flex items-center justify-between text-xs font-semibold mb-1.5 relative z-10">
                          <span className="text-slate-100 flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full transition-colors ${
                                isSelected ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            {opt.text}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-white font-bold">{percentage}%</span>
                            <span className="text-slate-400 text-[10px]">({opt.votes})</span>
                          </div>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="h-2 w-full bg-indigo-950/80 rounded-full overflow-hidden relative z-10">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              opt.id === '1'
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                : opt.id === '2'
                                ? 'bg-indigo-500/80'
                                : opt.id === '3'
                                ? 'bg-indigo-600/70'
                                : 'bg-indigo-700/60'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Subtitle inside card */}
                <div className="pt-2 border-t border-indigo-500/15 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="italic">Click an option to test real-time animation</span>
                  <span className="font-mono text-indigo-400 text-[10px]">ROOM #DEMO9</span>
                </div>

                {/* Floating badge (Bottom Right): "Ideas into action" */}
                <div className="absolute -bottom-4 -right-2 sm:-right-4 bg-[#1a1d3f]/95 border border-indigo-500/30 rounded-2xl px-3.5 py-2 shadow-xl flex items-center gap-2.5 z-30">
                  <div className="w-7 h-7 rounded-lg bg-purple-900/60 border border-purple-400/30 flex items-center justify-center text-purple-300">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-white leading-tight">Ideas</p>
                    <p className="text-[10px] text-slate-300 leading-tight">into action</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom smooth SVG curve dipping in the center */}
        <div className="w-full relative overflow-hidden mt-12 sm:mt-16 leading-none">
          <svg
            viewBox="0 0 1440 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-12 sm:h-16 lg:h-20 text-white fill-current block"
            preserveAspectRatio="none"
          >
            <path d="M0,20 C360,95 1080,95 1440,20 L1440,100 L0,100 Z" />
          </svg>
        </div>

        {/* Animated "Scroll to join" indicator positioned at the curve */}
        <div className="relative z-30 flex flex-col items-center justify-center -mt-6 sm:-mt-8">
          <button
            type="button"
            onClick={scrollToJoin}
            className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer group focus:outline-none"
            aria-label="Scroll to join a room"
          >
            {/* Mouse shaped indicator */}
            <div className="w-5 h-8 rounded-full border-2 border-slate-300 group-hover:border-indigo-500 flex items-start justify-center p-1 transition-colors">
              <span className="w-1 h-2 rounded-full bg-slate-400 group-hover:bg-indigo-600 animate-bounce transition-colors" />
            </div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 group-hover:text-indigo-600 transition-colors">
              Scroll to join
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 animate-bounce -mt-1 transition-colors" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: JOIN A POLL / ENTER A ROOM CODE                                */}
      {/* ========================================================================= */}
      <section
        id="join-section"
        className="relative w-full bg-white py-16 sm:py-24 overflow-hidden border-b border-slate-100"
      >
        {/* Subtle decorative dot grid background arrays */}
        <div className="absolute top-12 left-6 sm:left-16 grid grid-cols-4 gap-2.5 opacity-25 pointer-events-none select-none">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          ))}
        </div>
        <div className="absolute bottom-12 right-6 sm:right-16 grid grid-cols-4 gap-2.5 opacity-25 pointer-events-none select-none">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          ))}
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          {/* Eyebrow */}
          <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 mb-2 block">
            JOIN A POLL
          </span>

          {/* Section Title */}
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2.5">
            Enter a Room Code
          </h2>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto mb-8">
            Have a room code from a host? Enter it here to join the poll.
          </p>

          {/* Compact Join Room Form */}
          <form
            onSubmit={handleJoinSubmit}
            className="max-w-md sm:max-w-lg mx-auto flex flex-col sm:flex-row items-stretch gap-3 mb-6"
          >
            <div className="flex-1 relative">
              <input
                id="home-room-code-input"
                type="text"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                placeholder="ROOM CODE"
                maxLength={10}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-slate-900 placeholder-slate-400 font-mono tracking-widest uppercase text-base font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-xs transition-all text-center sm:text-left"
              />
            </div>

            <button
              id="home-join-btn"
              type="submit"
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl sm:rounded-2xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 group"
            >
              <span>Join Room</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition-all" />
            </button>
          </form>

          {joinError && (
            <p className="text-rose-600 text-xs font-semibold mb-6 animate-shake">{joinError}</p>
          )}

          {/* Value propositions row */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm font-semibold text-slate-600 pt-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>No sign-up</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span>Instant access</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Start participating</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: EXPLORE PAST POLLS                                             */}
      {/* ========================================================================= */}
      <section
        id="explore-section"
        className="relative w-full bg-gradient-to-b from-white via-indigo-50/25 to-slate-50 py-16 sm:py-20 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Graphic: Ascending Bar Chart Card + Sticker */}
            <div className="lg:col-span-4 flex items-center justify-center lg:justify-start">
              <div className="relative bg-white rounded-3xl border border-indigo-100/90 p-6 sm:p-7 shadow-lg max-w-xs w-full">
                {/* Ascending stylized bars */}
                <div className="h-32 flex items-end justify-center gap-4 px-2 pb-2">
                  <div className="w-9 h-[45%] rounded-xl bg-gradient-to-t from-indigo-500 to-blue-400 shadow-xs" />
                  <div className="w-9 h-[75%] rounded-xl bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-xs" />
                  <div className="w-9 h-[100%] rounded-xl bg-gradient-to-t from-purple-600 to-indigo-500 shadow-xs" />
                </div>

                {/* Speech bubble sticker: Ideas. Feedback. Progress. */}
                <div className="absolute -top-3.5 -right-3 bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md select-none">
                  <span>Ideas. Feedback. Progress.</span>
                </div>

                <div className="pt-3 border-t border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Concluded Insights
                  </span>
                </div>
              </div>
            </div>

            {/* Center: Title, Description, Button, and Accessible Ended Polls */}
            <div className="lg:col-span-5 text-center lg:text-left">
              <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 mb-2 block">
                EXPLORE
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
                Past Polls
              </h2>
              <p className="text-sm sm:text-base text-slate-500 mb-6 max-w-md">
                Check out the results from previous sessions.
              </p>

              <button
                id="home-see-previous-polls-btn"
                type="button"
                onClick={() => onNavigate('previous')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-indigo-50/80 border border-indigo-200 text-slate-800 hover:text-indigo-700 font-bold rounded-xl text-sm shadow-xs transition-all cursor-pointer group"
              >
                <span>See Previous Polls</span>
                <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Accessible Ended Polls Preview (respects existing visibility rules) */}
              {pastPolls.length > 0 && (
                <div className="mt-8 pt-6 border-t border-indigo-100/60 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Recent Concluded Polls
                  </p>
                  <div className="space-y-2">
                    {pastPolls.map((poll) => (
                      <button
                        key={poll.id}
                        type="button"
                        onClick={() => onNavigate('previous')}
                        className="w-full text-left p-3 rounded-xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all flex items-center justify-between gap-3 shadow-2xs group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                            {poll.question}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono font-bold text-indigo-600">
                              #{poll.roomCode}
                            </span>
                            <span>•</span>
                            <span>
                              {poll.totalVotes || 0} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          Ended
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Accent: Handwritten "Every opinion counts" */}
            <div className="lg:col-span-3 flex items-center justify-center lg:justify-end">
              <div className="transform rotate-[-6deg] select-none text-center lg:text-right">
                <span className="font-handwriting text-3xl sm:text-4xl text-indigo-600/90 font-bold block drop-shadow-xs">
                  Every opinion counts
                </span>
                <svg
                  className="w-40 h-3 text-indigo-400/80 mx-auto lg:ml-auto lg:mr-0 -mt-1"
                  viewBox="0 0 120 12"
                  fill="none"
                >
                  <path
                    d="M 2,6 Q 60,1 118,7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
