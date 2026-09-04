import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

export default function RoomCode({ code, size = 'default' }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!code) return null;

  const formattedCode = code.toUpperCase();

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(formattedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/#room/${formattedCode}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const isHero = size === 'hero';
  const isLarge = size === 'large';

  if (isHero) {
    return (
      <div
        id="room-code-hero-card"
        className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">
            Room Code
          </p>
          <div className="flex items-center gap-3 mb-4">
            <h3
              id="room-code-display"
              className="text-3xl sm:text-4xl font-black tracking-widest font-mono text-white"
            >
              {formattedCode}
            </h3>
            <button
              id="copy-room-code-btn"
              onClick={handleCopyCode}
              title="Copy room code"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-white" />
              )}
            </button>
            <button
              id="copy-room-link-btn"
              onClick={handleCopyLink}
              title="Copy direct invite link"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Share2 className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
      </div>
    );
  }

  return (
    <div
      id="room-code-badge-container"
      className="inline-flex flex-col sm:flex-row items-center gap-2.5 bg-white border border-slate-200 rounded-xl p-2 sm:px-3 sm:py-1.5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Room Code
        </span>
        <span
          id="room-code-display"
          className={`font-mono font-black tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-0.5 ${
            isLarge ? 'text-2xl' : 'text-base'
          }`}
        >
          {formattedCode}
        </span>
      </div>

      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center">
        <button
          id="copy-room-code-btn"
          onClick={handleCopyCode}
          title="Copy room code"
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
        >
          {copiedCode ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Copy</span>
            </>
          )}
        </button>

        <button
          id="copy-room-link-btn"
          onClick={handleCopyLink}
          title="Copy direct invite link"
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
