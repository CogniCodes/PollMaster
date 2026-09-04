import React from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';

export default function OptionBar({
  option,
  totalVotes = 0,
  isVotingEnabled = false,
  isSelected = false,
  hasVoted = false,
  isEnded = false,
  onSelect = null,
  showWinner = false,
}) {
  const { id, text, votes = 0, percentage = 0, isWinner = false } = option;

  const shouldHighlightWinner = showWinner && isWinner && totalVotes > 0;
  const isClickable = isVotingEnabled && !hasVoted && typeof onSelect === 'function';

  // Interactive voting card for participant when voting is active and they haven't voted yet
  if (isClickable) {
    return (
      <div
        id={`option-bar-${id}`}
        onClick={() => onSelect(id)}
        className={`group relative rounded-xl border-2 p-4 flex items-center justify-between transition-all cursor-pointer select-none ${
          isSelected
            ? 'border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-600/20'
            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
              isSelected
                ? 'border-indigo-600 bg-indigo-600'
                : 'border-slate-300 bg-white group-hover:border-indigo-400'
            }`}
          >
            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>

          <span
            className={`text-base font-semibold truncate transition-colors ${
              isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'
            }`}
          >
            {text}
          </span>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wider transition-colors ${
            isSelected
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700'
          }`}
        >
          {isSelected ? 'Selected' : 'Select'}
        </span>
      </div>
    );
  }

  // Result visualization bar (matches the Sleek Interface design feed)
  return (
    <div
      id={`option-bar-${id}`}
      className={`rounded-xl p-3.5 border transition-all ${
        shouldHighlightWinner
          ? 'bg-amber-50/60 border-amber-200 shadow-sm'
          : isSelected
          ? 'bg-indigo-50/50 border-indigo-200 shadow-sm'
          : 'bg-slate-50/70 border-slate-200/80'
      }`}
    >
      <div className="flex justify-between items-end mb-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-bold text-slate-800 uppercase tracking-tight truncate">
            {text}
          </span>

          {shouldHighlightWinner && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
              <Trophy className="w-3 h-3 text-amber-600" />
              Winner
            </span>
          )}

          {isSelected && hasVoted && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
              Your Vote
            </span>
          )}
        </div>

        <span
          className={`text-sm font-mono font-bold shrink-0 ${
            shouldHighlightWinner
              ? 'text-amber-700 font-extrabold'
              : isSelected
              ? 'text-indigo-700 font-extrabold'
              : 'text-slate-600'
          }`}
        >
          {percentage}% ({votes} {votes === 1 ? 'vote' : 'votes'})
        </span>
      </div>

      {/* Sleek Progress Track & Bar */}
      <div className="h-3.5 bg-slate-200/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            shouldHighlightWinner
              ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : isSelected
              ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)]'
              : percentage > 0
              ? 'bg-slate-400'
              : 'bg-transparent'
          }`}
          style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
