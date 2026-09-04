import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Trash2,
  ArrowRightLeft,
  ExternalLink,
  Play,
  Pause,
  StopCircle,
  RotateCcw,
  PlusCircle,
  Plus,
  Copy,
  CheckCircle2,
  LogOut,
  Users,
  Vote,
  Clock,
  Radio,
  Lock,
  AlertCircle,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  MoreVertical,
  Edit3,
  BarChart2,
  Home,
  List,
  Settings,
  FileText,
  TrendingUp,
  Globe,
  Eye,
  Sliders,
  X,
} from 'lucide-react';
import { getAuthToken, getAuthUser, loginAdmin, clearAuthSession, fetchCurrentAdmin } from '../auth.js';
import { getSocket } from '../socket.js';

export default function AdminDashboard({ onNavigate }) {
  const [currentUser, setCurrentUser] = useState(getAuthUser());
  const [authToken, setAuthToken] = useState(getAuthToken());

  // Login form state
  const [loginIdent, setLoginIdent] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sidebar active tab: 'overview' | 'polls' | 'create' | 'team' | 'settings'
  const [activeSidebarTab, setActiveSidebarTab] = useState('overview');

  // Dashboard polls state
  const [pollsGrouped, setPollsGrouped] = useState({ WAITING: [], LIVE: [], ENDED: [] });
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'LIVE' | 'WAITING' | 'PAUSED' | 'ENDED'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5; // 5 items per page to match the reference layout ("Showing 5 of 12 polls")

  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [openVisibilityDropdown, setOpenVisibilityDropdown] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);

  // Team & Role management state (OWNER only)
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [transferConfirmUser, setTransferConfirmUser] = useState(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Modals state
  const [pollToDelete, setPollToDelete] = useState(null);
  const [isDeletingPoll, setIsDeletingPoll] = useState(false);
  const [deletePollError, setDeletePollError] = useState(null);

  const [adminToDelete, setAdminToDelete] = useState(null);
  const [isRevokingAdmin, setIsRevokingAdmin] = useState(false);
  const [revokeAdminError, setRevokeAdminError] = useState(null);

  const [pollForResultsModal, setPollForResultsModal] = useState(null);
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);

  // Create Poll Modal state
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [newVisibility, setNewVisibility] = useState('PUBLIC');
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [createPollError, setCreatePollError] = useState(null);

  // Poll action loading tracker
  const [actionInProgress, setActionInProgress] = useState(null);

  // Check auth session on load
  useEffect(() => {
    if (authToken) {
      fetchCurrentAdmin().then((user) => {
        if (user) {
          setCurrentUser(user);
        } else {
          setAuthToken(null);
          setCurrentUser(null);
        }
      });
    }
  }, [authToken]);

  // Load polls and team when authenticated, and subscribe to real-time updates
  useEffect(() => {
    if (authToken) {
      loadPolls();
      loadTeam();

      const socket = getSocket();
      const onListUpdate = () => loadPolls();

      // Regroups a single updated poll into the correct WAITING, LIVE, or ENDED array
      const regroupPolls = (prev, updated) => {
        if (!updated || !updated.roomCode) return prev;
        const code = updated.roomCode;
        const filteredWaiting = (prev.WAITING || []).filter((p) => p.roomCode !== code);
        const filteredLive = (prev.LIVE || []).filter((p) => p.roomCode !== code);
        const filteredEnded = (prev.ENDED || []).filter((p) => p.roomCode !== code);

        const targetState = updated.state || 'WAITING';
        if (targetState === 'LIVE') {
          return {
            WAITING: filteredWaiting,
            LIVE: [updated, ...filteredLive],
            ENDED: filteredEnded,
          };
        } else if (targetState === 'ENDED') {
          return {
            WAITING: filteredWaiting,
            LIVE: filteredLive,
            ENDED: [updated, ...filteredEnded],
          };
        } else {
          return {
            WAITING: [updated, ...filteredWaiting],
            LIVE: filteredLive,
            ENDED: filteredEnded,
          };
        }
      };

      const onPollUpdated = (payload) => {
        const updatedPoll = payload?.poll;
        if (updatedPoll) {
          setPollsGrouped((prev) => regroupPolls(prev, updatedPoll));
          setPollForResultsModal((prev) =>
            prev && prev.roomCode === updatedPoll.roomCode ? { ...prev, ...updatedPoll } : prev
          );
        }
        loadPolls();
      };

      const onStateChanged = (payload) => {
        const updatedPoll = payload?.poll;
        if (updatedPoll) {
          setPollsGrouped((prev) => regroupPolls(prev, updatedPoll));
          setPollForResultsModal((prev) =>
            prev && prev.roomCode === updatedPoll.roomCode ? { ...prev, ...updatedPoll } : prev
          );
        }
        loadPolls();
      };

      const onParticipantsUpdated = (payload) => {
        const { roomCode, participantCount } = payload || {};
        if (roomCode) {
          setPollsGrouped((prev) => {
            const updateList = (list = []) =>
              list.map((p) => (p.roomCode === roomCode ? { ...p, participantCount } : p));
            return {
              WAITING: updateList(prev.WAITING),
              LIVE: updateList(prev.LIVE),
              ENDED: updateList(prev.ENDED),
            };
          });
          setPollForResultsModal((prev) =>
            prev && prev.roomCode === roomCode ? { ...prev, participantCount } : prev
          );
        }
      };

      const onPollDeleted = (payload) => {
        const deletedCode = payload?.roomCode;
        if (deletedCode) {
          setPollsGrouped((prev) => ({
            WAITING: (prev.WAITING || []).filter((p) => p.roomCode !== deletedCode),
            LIVE: (prev.LIVE || []).filter((p) => p.roomCode !== deletedCode),
            ENDED: (prev.ENDED || []).filter((p) => p.roomCode !== deletedCode),
          }));
          setPollForResultsModal((prev) =>
            prev && prev.roomCode === deletedCode ? null : prev
          );
        }
        loadPolls();
      };

      const onConnect = () => {
        loadPolls();
      };

      socket.on('connect', onConnect);
      socket.on('polls:list_updated', onListUpdate);
      socket.on('poll:deleted', onPollDeleted);
      socket.on('poll:state_changed', onStateChanged);
      socket.on('poll:updated', onPollUpdated);
      socket.on('room:participants_updated', onParticipantsUpdated);

      return () => {
        socket.off('connect', onConnect);
        socket.off('polls:list_updated', onListUpdate);
        socket.off('poll:deleted', onPollDeleted);
        socket.off('poll:state_changed', onStateChanged);
        socket.off('poll:updated', onPollUpdated);
        socket.off('room:participants_updated', onParticipantsUpdated);
      };
    }
  }, [authToken]);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside() {
      setOpenActionMenu(null);
      setOpenVisibilityDropdown(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadPolls = async () => {
    setIsLoadingPolls(true);
    try {
      const token = authToken || getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/polls', { headers });
      const data = await res.json();
      if (data.success && data.polls) {
        setPollsGrouped(data.polls);
        setPollForResultsModal((prev) => {
          if (!prev) return null;
          const all = [
            ...(data.polls.WAITING || []),
            ...(data.polls.LIVE || []),
            ...(data.polls.ENDED || []),
          ];
          const found = all.find((p) => p.roomCode === prev.roomCode);
          return found || prev;
        });
      }
    } catch (err) {
      console.error('Failed to load polls:', err);
    } finally {
      setIsLoadingPolls(false);
    }
  };

  const loadTeam = async () => {
    setIsLoadingTeam(true);
    setTeamError(null);
    try {
      const token = authToken || getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/users', { headers });
      const data = await res.json();
      if (data.success && data.users) {
        setTeamMembers(data.users);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const result = await loginAdmin(loginIdent, loginPass);
      setAuthToken(result.token);
      setCurrentUser(result.user);
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthToken(null);
    setCurrentUser(null);
  };

  const handleStateChange = async (poll, newState) => {
    setActionInProgress(poll.roomCode);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = authToken || getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/polls/${poll.roomCode}/state`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          adminToken: poll.adminToken || 'AUTH_ADMIN_SESSION',
          newState,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadPolls();
      } else {
        alert(data.error || 'Failed to update state');
      }
    } catch (err) {
      console.error('Failed to update state:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const requestDeletePoll = (poll) => {
    setDeletePollError(null);
    setPollToDelete({
      roomCode: poll.roomCode,
      question: poll.question,
      adminToken: poll.adminToken,
    });
  };

  const executeDeletePoll = async () => {
    if (!pollToDelete) return;
    const { roomCode, adminToken: pollAdminToken } = pollToDelete;

    setIsDeletingPoll(true);
    setDeletePollError(null);
    setActionInProgress(roomCode);

    try {
      const headers = {};
      const token = authToken || getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (pollAdminToken) headers['x-admin-token'] = pollAdminToken;

      const res = await fetch(`/api/polls/${roomCode}`, {
        method: 'DELETE',
        headers,
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { error: `Server error (${res.status} ${res.statusText})` };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to delete poll (HTTP ${res.status}).`);
      }

      // Remove from UI state immediately
      setPollsGrouped((prev) => ({
        WAITING: (prev.WAITING || []).filter((p) => p.roomCode !== roomCode),
        LIVE: (prev.LIVE || []).filter((p) => p.roomCode !== roomCode),
        ENDED: (prev.ENDED || []).filter((p) => p.roomCode !== roomCode),
      }));

      // Close modal
      setPollToDelete(null);

      // Background re-sync
      loadPolls();
    } catch (err) {
      console.error('Failed to delete poll:', err);
      setDeletePollError(err.message || 'Failed to delete poll.');
    } finally {
      setIsDeletingPoll(false);
      setActionInProgress(null);
    }
  };

  const handleVisibilityChange = async (roomCode, newVisibility) => {
    setActionInProgress(roomCode);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = authToken || getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/polls/${roomCode}/visibility`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ visibility: newVisibility }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { error: `Server error (${res.status} ${res.statusText})` };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update visibility.');
      }

      await loadPolls();
    } catch (err) {
      console.error('Failed to update visibility:', err);
      alert(err.message || 'Failed to update visibility.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setTeamError(null);
    setIsSubmittingAdmin(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          email: newAdminEmail,
          username: newAdminUsername,
          password: newAdminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create admin.');
      }

      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setShowCreateAdmin(false);
      await loadTeam();
    } catch (err) {
      setTeamError(err.message);
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  const requestRevokeAdmin = (member) => {
    setRevokeAdminError(null);
    setAdminToDelete(member);
  };

  const executeRevokeAdmin = async () => {
    if (!adminToDelete) return;
    setIsRevokingAdmin(true);
    setRevokeAdminError(null);

    try {
      const token = authToken || getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/users/${adminToDelete.id}`, {
        method: 'DELETE',
        headers,
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { error: `Server error (${res.status} ${res.statusText})` };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to revoke admin (HTTP ${res.status}).`);
      }

      // Remove immediately from UI state
      setTeamMembers((prev) => prev.filter((m) => m.id !== adminToDelete.id));

      // Close modal
      setAdminToDelete(null);

      // Background re-sync
      loadTeam();
    } catch (err) {
      console.error('Failed to revoke admin:', err);
      setRevokeAdminError(err.message || 'Failed to revoke admin.');
    } finally {
      setIsRevokingAdmin(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferConfirmUser) return;
    setIsTransferring(true);

    try {
      const res = await fetch('/api/admin/transfer-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ newOwnerId: transferConfirmUser.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to transfer ownership.');
      }

      // Update current user to ADMIN
      setCurrentUser(data.previousOwner);
      setTransferConfirmUser(null);
      await loadTeam();
      alert(`Ownership transferred! "${data.newOwner.username}" is now the OWNER. You are now an ADMIN.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    const validOptions = newOptions.map((o) => o.trim()).filter(Boolean);
    if (!newQuestion.trim()) {
      setCreatePollError('Question cannot be empty.');
      return;
    }
    if (validOptions.length < 2) {
      setCreatePollError('Please provide at least two valid options.');
      return;
    }

    setIsCreatingPoll(true);
    setCreatePollError(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = authToken || getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/polls', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: newQuestion.trim(),
          options: validOptions,
          visibility: newVisibility,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create poll.');
      }

      setNewQuestion('');
      setNewOptions(['', '']);
      setShowCreatePollModal(false);
      await loadPolls();
      setActiveSidebarTab('overview');
    } catch (err) {
      setCreatePollError(err.message || 'Failed to create poll.');
    } finally {
      setIsCreatingPoll(false);
    }
  };

  // Human-readable relative time formatter matching reference screenshot
  const formatTimeAgo = (dateString, isEnded = false) => {
    if (!dateString) return isEnded ? 'Ended recently' : 'Created recently';
    const diffMs = Math.max(0, Date.now() - new Date(dateString).getTime());
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    const prefix = isEnded ? 'Ended ' : 'Created ';
    if (diffMin < 2) return `${prefix}just now`;
    if (diffMin < 60) return `${prefix}${diffMin}m ago`;
    if (diffHour === 1) return `${prefix}1 hour ago`;
    if (diffHour < 24) return `${prefix}${diffHour} hours ago`;
    if (diffDay === 1) return `${prefix}1 day ago`;
    if (diffDay < 7) return `${prefix}${diffDay} days ago`;
    if (diffDay < 14) return `${prefix}1 week ago`;
    if (diffDay < 30) return `${prefix}${Math.floor(diffDay / 7)} weeks ago`;
    return `${prefix}${new Date(dateString).toLocaleDateString()}`;
  };

  // If user is not authenticated, display the Admin Login view
  if (!authToken || !currentUser) {
    return (
      <div id="admin-login-view" className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 text-center tracking-tight mb-1">
            Admin Authentication
          </h1>
          <p className="text-slate-500 text-xs text-center mb-6">
            Sign in with your administrative account to access the control dashboard, manage polls, and configure team roles.
          </p>

          {loginError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email or Username
              </label>
              <input
                id="admin-login-identifier"
                type="text"
                required
                value={loginIdent}
                onChange={(e) => setLoginIdent(e.target.value)}
                placeholder="Email or username"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="admin-login-password"
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>

          {/* Persistent system info */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Persistent PostgreSQL • Role-Based Access Control</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Sign in with administrative credentials configured in environment secrets
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = currentUser.role === 'OWNER';
  const allPolls = [
    ...(pollsGrouped.WAITING || []),
    ...(pollsGrouped.LIVE || []),
    ...(pollsGrouped.ENDED || []),
  ];

  // Filtering by Status and Search query
  const filteredPolls = allPolls.filter((poll) => {
    // Status filter
    if (statusFilter !== 'ALL' && poll.state !== statusFilter) {
      return false;
    }
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchQuestion = (poll.question || '').toLowerCase().includes(q);
      const matchCode = (poll.roomCode || '').toLowerCase().includes(q);
      return matchQuestion || matchCode;
    }
    return true;
  });

  // Pagination calculation
  const totalPollsCount = filteredPolls.length;
  const totalPages = Math.max(1, Math.ceil(totalPollsCount / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedPolls = filteredPolls.slice(startIndex, startIndex + pageSize);

  return (
    <div id="admin-dashboard-layout" className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-slate-50/50">
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR matching reference image */}
      {/* ========================================================================= */}
      <aside
        id="admin-sidebar"
        className="w-full md:w-60 lg:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200/80 p-5 shrink-0 flex flex-col justify-between"
      >
        <div>
          {/* Sidebar Top Title */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Admin Dashboard</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage your polls and sessions</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Sidebar navigation">
            <button
              type="button"
              id="sidebar-nav-overview"
              onClick={() => {
                setActiveSidebarTab('overview');
                setCurrentPage(1);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeSidebarTab === 'overview'
                  ? 'bg-indigo-50/90 text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Home className={`w-4 h-4 ${activeSidebarTab === 'overview' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Overview</span>
            </button>

            <button
              type="button"
              id="sidebar-nav-polls"
              onClick={() => {
                setActiveSidebarTab('polls');
                setCurrentPage(1);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeSidebarTab === 'polls'
                  ? 'bg-indigo-50/90 text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <List className={`w-4 h-4 ${activeSidebarTab === 'polls' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>My Polls</span>
            </button>

            <button
              type="button"
              id="sidebar-nav-create"
              onClick={() => setShowCreatePollModal(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer text-left"
            >
              <PlusCircle className="w-4 h-4 text-slate-500" />
              <span>Create Poll</span>
            </button>

            <button
              type="button"
              id="sidebar-nav-team"
              onClick={() => setActiveSidebarTab('team')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeSidebarTab === 'team'
                  ? 'bg-indigo-50/90 text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className={`w-4 h-4 ${activeSidebarTab === 'team' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Team Members</span>
            </button>

            <button
              type="button"
              id="sidebar-nav-settings"
              onClick={() => setActiveSidebarTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeSidebarTab === 'settings'
                  ? 'bg-indigo-50/90 text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Settings className={`w-4 h-4 ${activeSidebarTab === 'settings' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Script Quote matching reference screenshot verbatim */}
        <div className="pt-8 pb-2 hidden md:block">
          <div className="relative pl-3">
            <span className="text-3xl text-indigo-400 font-serif leading-none select-none absolute -left-1 -top-3">
              “
            </span>
            <p className="font-['Caveat',cursive] text-2xl font-bold text-indigo-600 leading-tight">
              Questions <br />
              create connections.”
            </p>
            <p className="text-xs text-slate-400 mt-2 font-sans">— PollMaster</p>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT CANVAS */}
      {/* ========================================================================= */}
      <main className="flex-1 p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto max-w-7xl">
        {/* OVERVIEW & MY POLLS TAB VIEW */}
        {(activeSidebarTab === 'overview' || activeSidebarTab === 'polls') && (
          <>
            {/* Top Greeting & CTA Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Welcome back, {currentUser?.username || 'Admin'}!</span>
                  <span className="text-2xl">👋</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Create, manage, and monitor your polls — all in one place.
                </p>
              </div>

              <button
                type="button"
                id="top-create-poll-btn"
                onClick={() => setShowCreatePollModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition-all cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create New Poll</span>
              </button>
            </div>

            {/* 4 METRIC CARDS matching reference image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: Total Polls */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs relative flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Total Polls</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {allPolls.length}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+3 this week</span>
                  </span>
                  {/* Subtle decorative purple/lavender sparkline SVG */}
                  <svg className="w-20 h-6 text-indigo-300" viewBox="0 0 80 24" fill="none">
                    <path
                      d="M2 18C12 18 16 10 26 12C36 14 40 6 50 9C60 12 66 3 78 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Metric 2: Live */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs relative flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Live</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {pollsGrouped.LIVE?.length || 0}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2">
                  <span className="text-xs font-bold text-emerald-600">
                    {pollsGrouped.LIVE?.length || 0} active now
                  </span>
                  {/* Subtle decorative emerald sparkline SVG */}
                  <svg className="w-20 h-6 text-emerald-400" viewBox="0 0 80 24" fill="none">
                    <path
                      d="M2 18C14 18 20 14 32 14C44 14 50 6 62 8C68 9 72 5 78 5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Metric 3: Waiting */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs relative flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-3">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Waiting</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {pollsGrouped.WAITING?.length || 0}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2">
                  <span className="text-xs font-bold text-amber-600">Scheduled</span>
                  {/* Subtle decorative amber sparkline SVG */}
                  <svg className="w-20 h-6 text-amber-400" viewBox="0 0 80 24" fill="none">
                    <path
                      d="M2 20C14 20 22 18 34 16C46 14 54 8 66 10C72 11 75 7 78 6"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Metric 4: Ended */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs relative flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-3">
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Ended</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {pollsGrouped.ENDED?.length || 0}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2">
                  <span className="text-xs font-bold text-purple-600">+4 this week</span>
                  {/* Subtle decorative purple sparkline SVG */}
                  <svg className="w-20 h-6 text-purple-300" viewBox="0 0 80 24" fill="none">
                    <path
                      d="M2 16C12 16 18 9 28 11C38 13 46 19 56 17C66 15 70 5 78 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* YOUR POLLS SECTION */}
            <div className="space-y-4">
              {/* Header & Filter Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Your Polls</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage your active, scheduled, and past polls
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search polls..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56 shadow-2xs"
                    />
                  </div>

                  {/* Status Dropdown Filter */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="appearance-none bg-white border border-slate-200 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="LIVE">Live</option>
                      <option value="WAITING">Waiting</option>
                      <option value="ENDED">Ended</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Poll List Cards */}
              {paginatedPolls.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
                  <Vote className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700">No polls match your criteria</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    {searchQuery
                      ? 'Try clearing your search query or changing filters.'
                      : 'Create a new poll to begin collecting live votes from participants.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreatePollModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Poll</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedPolls.map((poll) => {
                    const isLive = poll.state === 'LIVE';
                    const isWaiting = poll.state === 'WAITING';
                    const isEnded = poll.state === 'ENDED';
                    const isBusy = actionInProgress === poll.roomCode;

                    // Compute left accent line class
                    const leftBorderClass = isLive
                      ? 'border-l-4 border-l-emerald-500'
                      : isWaiting
                      ? 'border-l-4 border-l-amber-400'
                      : 'border-l-4 border-l-indigo-500';

                    // Compute badge style
                    const badgeClass = isLive
                      ? 'bg-emerald-50 text-emerald-700'
                      : isWaiting
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-indigo-50 text-indigo-700';

                    const participantsDisplay =
                      poll.participantCount !== undefined
                        ? poll.participantCount
                        : 0;

                    return (
                      <div
                        key={poll.roomCode}
                        className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 transition-all hover:border-slate-300 flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${leftBorderClass}`}
                      >
                        {/* Left Info Column */}
                        <div className="flex items-start gap-4 min-w-0">
                          {/* Status Pill Badge */}
                          <div className="shrink-0 pt-0.5">
                            <span
                              className={`inline-block px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider ${badgeClass}`}
                            >
                              {poll.state}
                            </span>
                          </div>

                          {/* Question and Metadata */}
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words">
                              {poll.question}
                            </h3>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                              {/* Room Code with Copy */}
                              <div className="flex items-center gap-1">
                                <span>Code:</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCode(poll.roomCode);
                                  }}
                                  title="Click to copy code"
                                  className="font-mono font-bold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
                                >
                                  {poll.roomCode}
                                </button>
                                {copiedCode === poll.roomCode && (
                                  <span className="text-[10px] text-emerald-600 font-bold ml-1">Copied!</span>
                                )}
                              </div>

                              <span className="text-slate-300">•</span>

                              {/* Relative Time */}
                              <span>{formatTimeAgo(isEnded ? poll.updatedAt : poll.createdAt, isEnded)}</span>

                              <span className="text-slate-300">•</span>

                              {/* Visibility Badge with Dropdown */}
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenVisibilityDropdown((prev) =>
                                      prev === poll.roomCode ? null : poll.roomCode
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                                  title="Change Visibility"
                                >
                                  {poll.visibility === 'PRIVATE' ? (
                                    <Lock className="w-3 h-3 text-slate-400" />
                                  ) : (
                                    <Globe className="w-3 h-3 text-slate-400" />
                                  )}
                                  <span>
                                    {poll.visibility === 'PRIVATE'
                                      ? 'Private'
                                      : poll.visibility === 'PARTICIPANTS_ONLY'
                                      ? 'Participants Only'
                                      : 'Public'}
                                  </span>
                                </button>

                                {openVisibilityDropdown === poll.roomCode && (
                                  <div
                                    className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-40 text-left"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {[
                                      { key: 'PUBLIC', label: 'Public' },
                                      { key: 'PARTICIPANTS_ONLY', label: 'Participants Only' },
                                      { key: 'PRIVATE', label: 'Private' },
                                    ].map((vis) => (
                                      <button
                                        key={vis.key}
                                        type="button"
                                        onClick={() => {
                                          setOpenVisibilityDropdown(null);
                                          if ((poll.visibility || 'PUBLIC') !== vis.key) {
                                            handleVisibilityChange(poll.roomCode, vis.key);
                                          }
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                                      >
                                        <span>{vis.label}</span>
                                        {(poll.visibility || 'PUBLIC') === vis.key && (
                                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Middle/Right: Metrics & Actions Column */}
                        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-4 sm:gap-6 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                          {/* Metrics stats */}
                          <div className="flex items-center gap-5 sm:gap-7">
                            {/* Participants */}
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-400 shrink-0" />
                              <div className="text-xs">
                                <span className="font-bold text-slate-900 mr-1">
                                  {participantsDisplay}
                                </span>
                                <span className="text-slate-500">Participants</span>
                              </div>
                            </div>

                            {/* Total Votes */}
                            <div className="flex items-center gap-2">
                              <BarChart2 className="w-4 h-4 text-slate-400 shrink-0" />
                              <div className="text-xs">
                                <span className="font-bold text-slate-900 mr-1">
                                  {poll.totalVotes}
                                </span>
                                <span className="text-slate-500">Total Votes</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons matching screenshot */}
                          <div className="flex items-center gap-2">
                            {/* LIVE: Pause & End Poll */}
                            {isLive && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStateChange(poll, 'WAITING')}
                                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                  <span>Pause</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStateChange(poll, 'ENDED')}
                                  className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <StopCircle className="w-3.5 h-3.5" />
                                  <span>End Poll</span>
                                </button>
                              </>
                            )}

                            {/* WAITING: Start Poll & Edit */}
                            {isWaiting && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStateChange(poll, 'LIVE')}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Start Poll</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPollForResultsModal(poll)}
                                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              </>
                            )}

                            {/* ENDED: View Results & Reopen */}
                            {isEnded && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPollForResultsModal(poll)}
                                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>View Results</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleStateChange(poll, 'LIVE')}
                                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Reopen</span>
                                </button>
                              </>
                            )}

                            {/* Three dots menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenu((prev) => (prev === poll.roomCode ? null : poll.roomCode));
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openActionMenu === poll.roomCode && (
                                <div
                                  className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-left"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={`/#room/${poll.roomCode}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Participant View</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleCopyCode(poll.roomCode);
                                      setOpenActionMenu(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Copy Room Code</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPollForResultsModal(poll);
                                      setOpenActionMenu(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Inspect Breakdown</span>
                                  </button>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      requestDeletePoll(poll);
                                      setOpenActionMenu(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Delete Poll</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PAGINATION BAR matching reference image */}
              {totalPollsCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/80 text-xs text-slate-500">
                  <div>
                    Showing {Math.min(totalPollsCount, paginatedPolls.length)} of {totalPollsCount} polls
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Previous page */}
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-8 h-8 px-2.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}

                    {/* Next page */}
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* TEAM MEMBERS TAB VIEW */}
        {activeSidebarTab === 'team' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="w-6 h-6 text-indigo-600" />
                  <span>Team & Role Management</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  System Roles: <span className="font-bold text-indigo-600">OWNER</span> (exactly one permitted),{' '}
                  <span className="font-bold text-emerald-600">ADMIN</span>, and PARTICIPANT.
                </p>
              </div>

              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setShowCreateAdmin(!showCreateAdmin)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showCreateAdmin ? 'Cancel' : 'Add New Admin'}</span>
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  Only OWNER can manage roles
                </span>
              )}
            </div>

            {/* OWNER Add Admin Form */}
            {isOwner && showCreateAdmin && (
              <form
                onSubmit={handleCreateAdmin}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Create New Administrator
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      placeholder="e.g. AlexAdmin"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {teamError && <p className="text-xs text-rose-600 font-semibold">{teamError}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateAdmin(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdmin}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAdmin ? 'Creating...' : 'Create Admin'}
                  </button>
                </div>
              </form>
            )}

            {/* Team Members Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Created</th>
                      {isOwner && <th className="py-3 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {teamMembers.map((member) => {
                      const memberIsOwner = member.role === 'OWNER';
                      return (
                        <tr key={member.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
                                memberIsOwner ? 'bg-indigo-600' : 'bg-emerald-600'
                              }`}
                            >
                              {member.username.slice(0, 1).toUpperCase()}
                            </div>
                            <span>{member.username}</span>
                            {member.id === currentUser.id && (
                              <span className="text-[10px] text-slate-400 font-normal">(you)</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{member.email}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                memberIsOwner
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
                          </td>

                          {/* OWNER-only action controls */}
                          {isOwner && (
                            <td className="py-3.5 px-4 text-right">
                              {memberIsOwner ? (
                                <span className="text-[11px] text-slate-400 italic">Primary Owner</span>
                              ) : (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setTransferConfirmUser(member)}
                                    title="Transfer Ownership to this Admin"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold cursor-pointer transition-colors"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>Transfer Ownership</span>
                                  </button>

                                  <button
                                    type="button"
                                    id={`revoke-admin-${member.id}`}
                                    onClick={() => requestRevokeAdmin(member)}
                                    title="Revoke Admin Access"
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB VIEW */}
        {activeSidebarTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6 text-indigo-600" />
                <span>System & Security Settings</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Overview of persistent PostgreSQL storage, active session tokens, and security policies.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Database Engine</h3>
                  <p className="text-xs text-slate-500">Persistent relational storage for polls, options, and votes</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>PostgreSQL Connected</span>
                </span>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Active Session Role</h3>
                  <p className="text-xs text-slate-500">Authorized user credentials and privilege tier</p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                  {currentUser?.role} ({currentUser?.username})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Real-time WebSocket Engine</h3>
                  <p className="text-xs text-slate-500">Bi-directional live updates with Socket.IO</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* CREATE POLL MODAL */}
      {showCreatePollModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Create New Poll</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePollModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createPollError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createPollError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePollSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Poll Question
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Which tech stack do you prefer for web development?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Answer Options
                  </label>
                  {newOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setNewOptions([...newOptions, ''])}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {newOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...newOptions];
                          updated[idx] = e.target.value;
                          setNewOptions(updated);
                        }}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none"
                      />
                      {newOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewOptions(newOptions.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'PUBLIC', label: 'Public' },
                    { id: 'PARTICIPANTS_ONLY', label: 'Participants' },
                    { id: 'PRIVATE', label: 'Private' },
                  ].map((vis) => (
                    <button
                      key={vis.id}
                      type="button"
                      onClick={() => setNewVisibility(vis.id)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        newVisibility === vis.id
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {vis.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePollModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPoll}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreatingPoll ? 'Creating...' : 'Create Poll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POLL RESULTS / INSPECT OPTIONS MODAL */}
      {pollForResultsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Room: {pollForResultsModal.roomCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                  {pollForResultsModal.question}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPollForResultsModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>Total Votes: <strong>{pollForResultsModal.totalVotes}</strong></span>
              <span>State: <strong>{pollForResultsModal.state}</strong></span>
            </div>

            {/* Options breakdown */}
            <div className="space-y-3 pt-2">
              {pollForResultsModal.options?.map((opt) => (
                <div key={opt.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-800">
                    <span className="truncate pr-2">{opt.text}</span>
                    <span className="shrink-0 font-mono">
                      {opt.votes} ({opt.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${opt.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <a
                href={`/#room/${pollForResultsModal.roomCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Tab</span>
              </a>
              <button
                type="button"
                onClick={() => setPollForResultsModal(null)}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE POLL CONFIRMATION MODAL */}
      {pollToDelete && (
        <div id="delete-poll-modal" className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Delete Poll Permanently</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to permanently delete poll:
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 my-3 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Room Code</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs">
                    {pollToDelete.roomCode}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm line-clamp-2">
                  {pollToDelete.question || `Poll ${pollToDelete.roomCode}`}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
              <p className="font-bold">Permanent Database Deletion:</p>
              <p>• All options, votes, and attendee sessions will be removed from PostgreSQL.</p>
              <p>• Connected attendees will be notified that the poll has been closed.</p>
              <p>• This action cannot be undone.</p>
            </div>

            {deletePollError && (
              <div id="delete-poll-error-banner" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deletePollError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="cancel-delete-poll-btn"
                disabled={isDeletingPoll}
                onClick={() => {
                  setPollToDelete(null);
                  setDeletePollError(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-poll-btn"
                disabled={isDeletingPoll}
                onClick={executeDeletePoll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeletingPoll ? 'Deleting...' : 'Delete Poll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER OWNERSHIP CONFIRMATION MODAL */}
      {transferConfirmUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto">
              <ArrowRightLeft className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Confirm Ownership Transfer</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to transfer the system <span className="font-bold text-indigo-600">OWNER</span> role to:
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 my-3 font-semibold text-slate-800 text-sm">
                {transferConfirmUser.username} ({transferConfirmUser.email})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
              <p className="font-bold">Strict Role Enforcement Rule:</p>
              <p>• Exactly one OWNER is permitted in the system at all times.</p>
              <p>• {transferConfirmUser.username} will become the new OWNER.</p>
              <p>• Your account will automatically become an ADMIN with no ownership privileges.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => setTransferConfirmUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTransferring}
                onClick={handleTransferOwnership}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE ADMIN ACCESS CONFIRMATION MODAL */}
      {adminToDelete && (
        <div id="revoke-admin-modal" className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Revoke Admin Access</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to revoke admin access for:
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 my-3 text-left">
                <div className="font-semibold text-slate-900 text-sm">
                  {adminToDelete.username}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {adminToDelete.email}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
              <p className="font-bold">Privilege Revocation:</p>
              <p>• This user will immediately lose access to create and manage polls.</p>
              <p>• Existing active sessions for this admin will be invalidated.</p>
            </div>

            {revokeAdminError && (
              <div id="revoke-admin-error-banner" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{revokeAdminError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="cancel-revoke-admin-btn"
                disabled={isRevokingAdmin}
                onClick={() => {
                  setAdminToDelete(null);
                  setRevokeAdminError(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-revoke-admin-btn"
                disabled={isRevokingAdmin}
                onClick={executeRevokeAdmin}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isRevokingAdmin ? 'Revoking...' : 'Revoke Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
