import React, { useState } from 'react';
import { Plus, Trash2, HelpCircle, Sparkles, Globe, Users, Lock } from 'lucide-react';

export default function PollForm({ onSubmit, isSubmitting = false, errorMessage = null }) {
  const [question, setQuestion] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [options, setOptions] = useState([
    'TypeScript / Node.js',
    'Rust / Axum',
    'Python / FastAPI',
  ]);
  const [validationError, setValidationError] = useState('');

  const minOptions = 2;
  const maxOptions = 6;

  const handleOptionChange = (index, value) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
    setValidationError('');
  };

  const handleAddOption = () => {
    if (options.length < maxOptions) {
      setOptions([...options, '']);
      setValidationError('');
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > minOptions) {
      const next = options.filter((_, i) => i !== index);
      setOptions(next);
      setValidationError('');
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setValidationError('Please enter a poll question.');
      return;
    }

    const trimmedOptions = options.map((opt) => opt.trim());
    const emptyOptionIndex = trimmedOptions.findIndex((opt) => opt.length === 0);
    if (emptyOptionIndex !== -1) {
      setValidationError(`Option ${emptyOptionIndex + 1} cannot be empty.`);
      return;
    }

    if (trimmedOptions.length < minOptions || trimmedOptions.length > maxOptions) {
      setValidationError(`Please provide between ${minOptions} and ${maxOptions} options.`);
      return;
    }

    // Check for duplicate option values
    const uniqueOptions = new Set(trimmedOptions.map((o) => o.toLowerCase()));
    if (uniqueOptions.size !== trimmedOptions.length) {
      setValidationError('All options must be unique.');
      return;
    }

    onSubmit({
      question: trimmedQuestion,
      options: trimmedOptions,
      visibility,
    });
  };

  const errorToDisplay = validationError || errorMessage;

  return (
    <form
      id="create-poll-form"
      onSubmit={handleFormSubmit}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8"
    >
      <div className="mb-6">
        <label
          htmlFor="poll-question-input"
          className="text-sm font-bold text-slate-800 mb-2 flex items-center justify-between"
        >
          <span>Poll Question</span>
          <span className="text-xs font-normal text-slate-400">Required</span>
        </label>
        <input
          id="poll-question-input"
          type="text"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setValidationError('');
          }}
          placeholder="e.g. Which language should we use for our club project?"
          maxLength={180}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors text-base"
        />
        <div className="flex justify-between items-center mt-1.5 px-1 text-xs text-slate-400">
          <span>Be direct and concise</span>
          <span>{question.length}/180</span>
        </div>
      </div>

      {/* Visibility Control */}
      <div className="mb-6">
        <label className="text-sm font-bold text-slate-800 mb-2 flex items-center justify-between">
          <span>Poll Visibility</span>
          <span className="text-xs font-normal text-slate-400">Access Control</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            id="visibility-public-btn"
            onClick={() => setVisibility('PUBLIC')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              visibility === 'PUBLIC'
                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Globe className={`w-4 h-4 ${visibility === 'PUBLIC' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className={`text-xs font-bold ${visibility === 'PUBLIC' ? 'text-indigo-900' : 'text-slate-800'}`}>
                PUBLIC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Visible to everyone across the homepage and previous polls.
            </p>
          </button>

          <button
            type="button"
            id="visibility-participants-btn"
            onClick={() => setVisibility('PARTICIPANTS_ONLY')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              visibility === 'PARTICIPANTS_ONLY'
                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Users className={`w-4 h-4 ${visibility === 'PARTICIPANTS_ONLY' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className={`text-xs font-bold ${visibility === 'PARTICIPANTS_ONLY' ? 'text-indigo-900' : 'text-slate-800'}`}>
                PARTICIPANTS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Visible only to users who join this poll room with the code.
            </p>
          </button>

          <button
            type="button"
            id="visibility-private-btn"
            onClick={() => setVisibility('PRIVATE')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              visibility === 'PRIVATE'
                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Lock className={`w-4 h-4 ${visibility === 'PRIVATE' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className={`text-xs font-bold ${visibility === 'PRIVATE' ? 'text-indigo-900' : 'text-slate-800'}`}>
                PRIVATE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Strictly restricted to authorized ADMIN and OWNER accounts.
            </p>
          </button>
        </div>
      </div>

      {/* Dynamic Options */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span>Poll Options</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
              {options.length} of {maxOptions}
            </span>
          </label>
          <span className="text-xs text-slate-400 font-medium">2–6 options allowed</span>
        </div>

        <div className="space-y-3">
          {options.map((opt, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-7 text-xs font-mono font-semibold text-slate-400 text-right select-none">
                0{index + 1}
              </div>
              <input
                id={`poll-option-input-${index + 1}`}
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                maxLength={80}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-sm font-medium"
              />
              <button
                id={`remove-option-btn-${index + 1}`}
                type="button"
                onClick={() => handleRemoveOption(index)}
                disabled={options.length <= minOptions}
                title={options.length <= minOptions ? 'Minimum 2 options required' : 'Remove option'}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {options.length < maxOptions && (
          <button
            id="add-option-btn"
            type="button"
            onClick={handleAddOption}
            className="mt-3.5 w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Add Another Option ({options.length}/{maxOptions})</span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorToDisplay && (
        <div
          id="poll-form-error-alert"
          className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
          <span>{errorToDisplay}</span>
        </div>
      )}

      {/* Submit */}
      <button
        id="submit-create-poll-btn"
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer text-base"
      >
        {isSubmitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Creating Room...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Create Poll & Launch Room</span>
          </>
        )}
      </button>
    </form>
  );
}
