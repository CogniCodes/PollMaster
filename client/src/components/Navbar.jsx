import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart2,
  LogIn,
  LayoutGrid,
  Sun,
  ExternalLink,
  ChevronDown,
  LogOut,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { getSocket } from '../socket.js';
import { getAuthUser, clearAuthSession } from '../auth.js';

export default function Navbar({ currentView, onNavigate, activeRoomCode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [authUser, setAuthUser] = useState(getAuthUser());
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Refresh auth user periodically
    const interval = setInterval(() => {
      setAuthUser(getAuthUser());
    }, 2000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleJoinClick = () => {
    if (currentView === 'home') {
      const joinSection = document.getElementById('join-section');
      if (joinSection) {
        joinSection.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    onNavigate('join');
  };

  const handleSignOut = () => {
    clearAuthSession();
    setAuthUser(null);
    setShowUserDropdown(false);
    onNavigate('dashboard');
  };

  const isDashboard = currentView === 'dashboard';

  return (
    <header
      id="app-navbar"
      className="sticky top-0 z-50 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shrink-0 transition-colors"
    >
      <div className="w-full px-4 sm:px-8 h-full flex items-center justify-between">
        {/* Extreme Left: Brand + LIVE SYNC status pill */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            id="nav-brand-btn"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105">
              <BarChart2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
              PollMaster
            </span>
          </button>

          {/* Socket Connection Status Badge: Directly beside PollMaster */}
          <div
            id="connection-status-badge"
            title={isConnected ? 'Connected to real-time server' : 'Disconnected / Reconnecting'}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-[11px] sm:text-xs font-bold transition-all ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="tracking-wider uppercase text-[10px] sm:text-xs font-bold">
                  LIVE SYNC
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-rose-500 rounded-full" />
                <span className="tracking-wider uppercase text-[10px] sm:text-xs font-bold">
                  OFFLINE
                </span>
              </>
            )}
          </div>
        </div>

        {/* Extreme Right Navigation Controls */}
        {isDashboard ? (
          /* Admin Dashboard Header Right Controls matching reference screenshot */
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sun / Theme icon button */}
            <button
              type="button"
              id="admin-theme-toggle-btn"
              title="Light theme active"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* View Site external link */}
            <button
              type="button"
              id="admin-view-site-btn"
              onClick={() => onNavigate('home')}
              className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>View Site</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>

            {/* Admin Profile Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                id="admin-profile-menu-btn"
                onClick={() => setShowUserDropdown((prev) => !prev)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-100/70 transition-colors cursor-pointer focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {authUser?.username ? authUser.username.charAt(0).toUpperCase() : 'A'}
                </div>
                <span className="font-semibold text-xs sm:text-sm text-slate-800 hidden sm:inline">
                  {authUser?.role === 'OWNER' ? 'Owner' : authUser?.username || 'Admin'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div
                  id="admin-profile-dropdown"
                  className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-left"
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {authUser?.username || 'Administrator'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{authUser?.email || 'admin@pollmaster.internal'}</p>
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {authUser?.role === 'OWNER' ? (
                          <>
                            <Shield className="w-3 h-3 text-indigo-600" />
                            <span>System Owner</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Administrator</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onNavigate('home');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>Switch to Visitor Mode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onNavigate('join');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5 text-slate-400" />
                      <span>Join Room as Participant</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Normal Public Header Right Controls */
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Dashboard */}
            <button
              id="nav-dashboard-btn"
              onClick={() => onNavigate('dashboard')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                currentView === 'dashboard'
                  ? 'text-indigo-600 font-bold bg-indigo-50/80'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-slate-600" />
              <span>Dashboard</span>
              {authUser && (
                <span
                  className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                    authUser.role === 'OWNER'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {authUser.role}
                </span>
              )}
            </button>

            {/* Join Room */}
            <button
              id="nav-join-btn"
              onClick={handleJoinClick}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 ${
                currentView === 'join'
                  ? 'text-indigo-600 font-bold bg-indigo-50/80'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <LogIn className="w-4 h-4 text-slate-600" />
              <span>Join Room</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
