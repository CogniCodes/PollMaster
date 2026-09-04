import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Vote,
  Sparkles,
  Trophy,
  BarChart3,
  ArrowLeft,
  Radio,
} from 'lucide-react';
import RoomCode from '../components/RoomCode.jsx';
import OptionBar from '../components/OptionBar.jsx';
import { getSocket, getOrCreateParticipantId } from '../socket.js';
import { getAuthToken } from '../auth.js';

export default function ParticipantRoom({ roomCode, onNavigate }) {
  const [poll, setPoll] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVotedOptionId, setUserVotedOptionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const participantId = getOrCreateParticipantId();

  useEffect(() => {
    if (!roomCode) return;

    const socket = getSocket();
    setIsLoading(true);
    setErrorMessage(null);

    const cleanCode = roomCode.toUpperCase().trim();
    const authToken = getAuthToken() || '';

    // Immediate HTTP fallback fetch for instant render without socket latency
    fetch(`/api/polls/${cleanCode}`, {
      headers: {
        'x-participant-id': participantId,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success && data.poll) {
          setPoll(data.poll);
          if (data.participantCount !== undefined) {
            setParticipantCount(data.participantCount);
          }
          setIsLoading(false);
        }
      })
      .catch(() => {});

    // Join room via socket
    socket.emit(
      'room:join',
      {
        roomCode: cleanCode,
        participantId,
        isAdmin: false,
        authToken,
      },
      (res) => {
        setIsLoading(false);
        if (res && res.success) {
          setPoll(res.poll);
          setParticipantCount(res.participantCount || 0);
          if (res.hasVoted && res.userVotedOptionId) {
            setHasVoted(true);
            setUserVotedOptionId(res.userVotedOptionId);
            setSelectedOptionId(res.userVotedOptionId);
          }
        } else {
          setErrorMessage(res?.error || `Room "${cleanCode}" not found.`);
        }
      }
    );

    // Listen for real-time poll changes (vote tallies, state changes, visibility)
    const onPollUpdated = ({ poll: updatedPoll }) => {
      if (!updatedPoll || (updatedPoll.roomCode && updatedPoll.roomCode.toUpperCase() !== cleanCode)) return;

      // If poll was made PRIVATE and current user is not an admin
      if (updatedPoll.visibility === 'PRIVATE' && !getAuthToken()) {
        setErrorMessage('Access denied: This poll is private and only visible to authorized administrators.');
        setPoll(null);
        return;
      }

      setErrorMessage(null);
      setPoll(updatedPoll);
      if (updatedPoll.participantCount !== undefined) {
        setParticipantCount(updatedPoll.participantCount);
      }
    };

    // Listen for explicit state transitions (WAITING <-> LIVE <-> ENDED)
    const onStateChanged = ({ state, poll: statePoll }) => {
      if (statePoll && statePoll.roomCode && statePoll.roomCode.toUpperCase() === cleanCode) {
        onPollUpdated({ poll: statePoll });
      } else if (state) {
        setPoll((prev) => (prev ? { ...prev, state } : prev));
      }
    };

    // Listen for participant count updates
    const onParticipantsUpdated = ({ roomCode: updatedCode, participantCount: count }) => {
      if (!updatedCode || updatedCode.toUpperCase() === cleanCode) {
        setParticipantCount(count);
      }
    };

    // Listen for poll deletion
    const onPollDeleted = ({ roomCode: deletedCode }) => {
      if (deletedCode && deletedCode.toUpperCase() === cleanCode) {
        setErrorMessage('This poll has been deleted by the host.');
        setPoll(null);
        setTimeout(() => {
          onNavigate('home');
        }, 2500);
      }
    };

    // Handle socket reconnect (e.g. after sleep, tab switch, or network drop)
    const handleConnect = () => {
      socket.emit(
        'room:join',
        {
          roomCode: cleanCode,
          participantId,
          isAdmin: false,
          authToken,
        },
        (res) => {
          if (res && res.success) {
            setPoll(res.poll);
            setParticipantCount(res.participantCount || 0);
            if (res.hasVoted && res.userVotedOptionId) {
              setHasVoted(true);
              setUserVotedOptionId(res.userVotedOptionId);
              setSelectedOptionId(res.userVotedOptionId);
            }
          }
        }
      );
    };

    socket.on('connect', handleConnect);
    socket.on('poll:state_changed', onStateChanged);
    socket.on('poll:updated', onPollUpdated);
    socket.on('room:participants_updated', onParticipantsUpdated);
    socket.on('poll:deleted', onPollDeleted);

    return () => {
      socket.emit('room:leave', { roomCode: cleanCode });
      socket.off('connect', handleConnect);
      socket.off('poll:state_changed', onStateChanged);
      socket.off('poll:updated', onPollUpdated);
      socket.off('room:participants_updated', onParticipantsUpdated);
      socket.off('poll:deleted', onPollDeleted);
    };
  }, [roomCode, participantId]);

  const handleCastVote = () => {
    if (!selectedOptionId) {
      setErrorMessage('Please select an option first.');
      return;
    }

    if (poll.state !== 'LIVE') {
      setErrorMessage('Voting is currently not open.');
      return;
    }

    if (hasVoted) {
      setErrorMessage('You have already submitted a vote in this poll.');
      return;
    }

    setIsSubmittingVote(true);
    setErrorMessage(null);

    const socket = getSocket();
    socket.emit(
      'poll:vote',
      {
        roomCode: roomCode.toUpperCase(),
        participantId,
        optionId: selectedOptionId,
      },
      (res) => {
        setIsSubmittingVote(false);
        if (res && res.success) {
          setHasVoted(true);
          setUserVotedOptionId(res.votedOptionId);
          setPoll(res.poll);
          setSuccessMessage('Your vote has been cast successfully!');
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setErrorMessage(res?.error || 'Failed to submit vote. Please try again.');
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium text-sm">Entering room {roomCode}...</p>
      </div>
    );
  }

  if (errorMessage && !poll) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Room Unavailable</h2>
          <p className="text-slate-500 text-sm mb-6">{errorMessage}</p>
          <button
            onClick={() => onNavigate('home')}
            className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const isLive = poll.state === 'LIVE';
  const isWaiting = poll.state === 'WAITING';
  const isEnded = poll.state === 'ENDED';
  const totalVotes = poll.totalVotes || 0;

  return (
    <div id="participant-room-page" className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Top Bar Navigation & Info */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Room</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span id="participant-online-count" className="font-bold text-slate-900">
              {participantCount}
            </span>
            <span className="text-slate-400 hidden sm:inline">online</span>
          </div>

          <RoomCode code={poll.roomCode} />
        </div>
      </div>

      {/* Main Interactive Poll Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-7">
        {/* Status Notification Banner */}
        {isWaiting && (
          <div
            id="poll-status-waiting-banner"
            className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-xs"
          >
            <Clock className="w-4 h-4 flex-shrink-0 text-amber-600 animate-pulse" />
            <div>
              <div className="font-bold text-amber-950">Waiting for Host</div>
              <div className="text-slate-600 mt-0.5">
                The poll hasn't started yet. Voting will unlock as soon as the host starts the session.
              </div>
            </div>
          </div>
        )}

        {isEnded && (
          <div
            id="poll-status-ended-banner"
            className="mb-5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3 text-slate-900 text-xs"
          >
            <Trophy className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <div>
              <div className="font-bold text-slate-900">Voting Closed</div>
              <div className="text-slate-600 mt-0.5">
                Final results are frozen with the leading selection highlighted.
              </div>
            </div>
          </div>
        )}

        {isLive && !hasVoted && (
          <div
            id="poll-status-live-banner"
            className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-2.5 text-emerald-800 text-xs font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span>Voting is live. Select your choice below and submit.</span>
          </div>
        )}

        {hasVoted && (
          <div
            id="poll-voted-confirmation-banner"
            className="mb-5 p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between gap-3 text-indigo-900 text-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-medium">
                Your vote is counted. Live tallies update automatically.
              </span>
            </div>
            <span className="font-semibold text-indigo-700 uppercase tracking-wider text-[10px] bg-white border border-indigo-200 px-2 py-0.5 rounded">
              Vote Recorded
            </span>
          </div>
        )}

        {/* Question Header */}
        <div className="mb-5 pb-3 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Question
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
            {poll.question}
          </h1>
        </div>

        {/* Options List / Voting Cards */}
        <div className="space-y-2.5 mb-5">
          {poll.options.map((opt) => {
            const isSelected = selectedOptionId === opt.id;
            const isUserChoice = userVotedOptionId === opt.id;

            return (
              <OptionBar
                key={opt.id}
                option={opt}
                totalVotes={totalVotes}
                isVotingEnabled={isLive && !hasVoted}
                isSelected={hasVoted ? isUserChoice : isSelected}
                hasVoted={hasVoted}
                isEnded={isEnded}
                showWinner={isEnded}
                onSelect={(id) => {
                  if (isLive && !hasVoted) {
                    setSelectedOptionId(id);
                    setErrorMessage(null);
                  }
                }}
              />
            );
          })}
        </div>

        {/* Submit Vote CTA for un-voted participants when LIVE */}
        {isLive && !hasVoted && (
          <div className="pt-2">
            <button
              id="participant-submit-vote-btn"
              onClick={handleCastVote}
              disabled={!selectedOptionId || isSubmittingVote}
              className="w-full py-3 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm"
            >
              {isSubmittingVote ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting Vote...</span>
                </>
              ) : (
                <>
                  <Vote className="w-4 h-4" />
                  <span>{selectedOptionId ? 'Confirm & Cast Vote' : 'Select an Option Above'}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Dynamic Messages */}
        {errorMessage && (
          <div className="mt-3.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Live Total Tally Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Total tally:</span>
            <strong id="participant-total-votes" className="text-slate-800 font-semibold">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Real-Time via Socket.IO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
