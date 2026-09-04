import React, { useState, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import AdminCreate from './pages/AdminCreate.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import ParticipantRoom from './pages/ParticipantRoom.jsx';
import PreviousPolls from './pages/PreviousPolls.jsx';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [activeRoomCode, setActiveRoomCode] = useState('');

  // Synchronize routing with browser URL hash for direct links and browser back/forward support
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (!hash) {
        setCurrentView('home');
        setActiveRoomCode('');
        return;
      }

      if (hash === 'create' || hash === 'admin-create') {
        setCurrentView('create');
        setActiveRoomCode('');
      } else if (hash === 'dashboard' || hash === 'admin-dashboard') {
        setCurrentView('dashboard');
        setActiveRoomCode('');
      } else if (hash === 'join') {
        setCurrentView('join');
        setActiveRoomCode('');
      } else if (hash === 'previous' || hash === 'previous-polls') {
        setCurrentView('previous');
        setActiveRoomCode('');
      } else if (hash.startsWith('room/')) {
        const code = hash.split('/')[1] || '';
        setActiveRoomCode(code.toUpperCase());
        setCurrentView('participant');
      } else {
        setCurrentView('home');
        setActiveRoomCode('');
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  const handleNavigate = (view, roomCode = '') => {
    setCurrentView(view);
    setActiveRoomCode(roomCode);

    if (view === 'home') {
      window.location.hash = '';
    } else if (view === 'create') {
      window.location.hash = 'create';
    } else if (view === 'dashboard') {
      window.location.hash = 'dashboard';
    } else if (view === 'join') {
      window.location.hash = 'join';
    } else if (view === 'previous') {
      window.location.hash = 'previous';
    } else if (view === 'participant' && roomCode) {
      window.location.hash = `room/${roomCode}`;
    }
  };

  return (
    <div id="app-root" className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white font-sans">
      {/* Top Header */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        activeRoomCode={activeRoomCode}
      />

      {/* Main Viewport */}
      <main className="flex-1">
        {currentView === 'home' && <Home onNavigate={handleNavigate} />}
        {currentView === 'create' && <AdminCreate onNavigate={handleNavigate} />}
        {currentView === 'dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
        {currentView === 'previous' && <PreviousPolls onNavigate={handleNavigate} />}
        {currentView === 'join' && (
          <JoinRoom onNavigate={handleNavigate} initialCode={activeRoomCode} />
        )}
        {currentView === 'participant' && (
          <ParticipantRoom roomCode={activeRoomCode} onNavigate={handleNavigate} />
        )}
      </main>

      {/* Footer matching PollMaster aesthetic (omitted on dashboard for dedicated admin view) */}
      {currentView !== 'dashboard' && (
        <footer className="border-t border-slate-200/80 bg-white py-6 px-4 sm:px-8 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-2xs">
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-extrabold text-slate-900 text-sm tracking-tight">PollMaster</span>
                <p className="text-[11px] text-slate-500">Live polls. Real people. Better decisions.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-slate-600 text-xs">
              <button
                onClick={() => handleNavigate('dashboard')}
                className="hover:text-indigo-600 cursor-pointer font-medium transition-colors"
              >
                Dashboard
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => {
                  if (currentView === 'home') {
                    const el = document.getElementById('join-section');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                      return;
                    }
                  }
                  handleNavigate('join');
                }}
                className="hover:text-indigo-600 cursor-pointer font-medium transition-colors"
              >
                Join Room
              </button>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">
                Built with <span className="text-rose-500">❤️</span> for better conversations.
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
