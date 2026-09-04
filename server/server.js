import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  initRoomManager,
  createPoll,
  getPoll,
  verifyAdmin,
  updatePollState,
  castVote,
  getParticipantVote,
  getAllPollsGrouped,
  deletePoll,
  updatePollVisibility,
  registerSocket,
  unregisterSocket,
  getParticipantCount,
  recordParticipantJoined,
  hasParticipantJoined,
  canViewPoll,
  getLivePollForVisitor,
  getPreviousPollsForVisitor,
  PollVisibility,
} from './roomManager.js';
import {
  seedInitialOwner,
  loginUser,
  listAdmins,
  createAdmin,
  revokeAdmin,
  transferOwnership,
  requireAuth,
  requireOwner,
  getUserById,
  getJwtSecret,
} from './auth.js';
import jwt from 'jsonwebtoken';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // JSON body parser
  app.use(express.json());

  // Attach Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Seed system OWNER from environment secrets on startup & load PostgreSQL rooms
  try {
    await seedInitialOwner();
    await initRoomManager();
  } catch (initErr) {
    console.error('[Server] Critical error initializing database/owner:', initErr);
  }

  // REST API Endpoints

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // AUTHENTICATION & ROLE MANAGEMENT ROUTES
  // ==========================================

  // Admin login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const result = await loginUser(identifier, password);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(401).json({ success: false, error: err.message });
    }
  });

  // Get current user profile
  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
  });

  // List admin team (OWNER and ADMINs)
  app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
      const admins = await listAdmins();
      res.json({ success: true, users: admins, currentUserRole: req.user.role });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create a new ADMIN (Strictly OWNER only)
  app.post('/api/admin/users', requireAuth, requireOwner, async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const newAdmin = await createAdmin({ email, username, password }, req.user.id);
      res.status(201).json({ success: true, user: newAdmin });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Revoke an ADMIN (Strictly OWNER only; cannot revoke OWNER)
  app.delete('/api/admin/users/:id', requireAuth, requireOwner, async (req, res) => {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (isNaN(targetId)) {
        return res.status(400).json({ success: false, error: 'Invalid user ID.' });
      }
      const result = await revokeAdmin(targetId, req.user.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Transfer Ownership (Strictly OWNER only; exactly one OWNER at a time)
  // Selected ADMIN becomes OWNER; previous OWNER becomes ADMIN.
  app.post('/api/admin/transfer-ownership', requireAuth, requireOwner, async (req, res) => {
    try {
      const { newOwnerId } = req.body;
      const targetId = parseInt(newOwnerId, 10);
      if (isNaN(targetId)) {
        return res.status(400).json({ success: false, error: 'Invalid new owner ID.' });
      }
      const result = await transferOwnership(targetId, req.user.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Helper to extract requester identity and authorization
  async function getRequesterContext(req) {
    let isAuthorizedAdmin = false;
    let user = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        const token = match[1].trim();
        try {
          const decoded = jwt.verify(token, getJwtSecret());
          if (decoded && decoded.id) {
            user = await getUserById(decoded.id);
            if (user && (user.role === 'OWNER' || user.role === 'ADMIN')) {
              isAuthorizedAdmin = true;
            }
          }
        } catch (e) {
          // Token verification failed or expired
        }
      }
    }

    const participantId = req.headers['x-participant-id'] || req.query.participantId || null;
    const adminToken = req.headers['x-admin-token'] || req.query.adminToken || req.body?.adminToken || null;

    return { isAuthorizedAdmin, user, participantId, adminToken };
  }

  // ==========================================
  // POLL MANAGEMENT ROUTES & DIAGNOSTICS
  // ==========================================

  // Diagnostics endpoint for verifying single DB & process
  app.get('/api/diagnostics/db', async (req, res) => {
    try {
      const dbHost = process.env.SQL_HOST || 'unknown';
      const projectInstance = dbHost.includes('cloudsql')
        ? dbHost.split('/').pop()
        : dbHost;

      res.json({
        success: true,
        status: 'connected',
        serverPid: process.pid,
        databaseName: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
        hostInstance: projectInstance,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get all polls grouped by state (WAITING, LIVE, ENDED) for Admin Dashboard
  app.get('/api/polls', requireAuth, async (req, res) => {
    try {
      const grouped = await getAllPollsGrouped();
      res.json({ success: true, polls: grouped });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get current LIVE poll for homepage (respecting visibility)
  app.get('/api/polls/live', async (req, res) => {
    try {
      const context = await getRequesterContext(req);
      const livePoll = await getLivePollForVisitor(context);
      res.json({ success: true, poll: livePoll });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get previous (ENDED) polls for "See Previous Polls" (respecting visibility)
  app.get('/api/polls/previous', async (req, res) => {
    try {
      const context = await getRequesterContext(req);
      const previousPolls = await getPreviousPollsForVisitor(context);
      res.json({ success: true, polls: previousPolls });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create a new poll (Authenticated admin or public room host)
  app.post('/api/polls', async (req, res) => {
    try {
      const { question, options, visibility, createdByUserId } = req.body;
      const context = await getRequesterContext(req);
      const userId = context.user ? context.user.id : createdByUserId || null;
      const result = await createPoll({ question, options, visibility, createdByUserId: userId });
      io.emit('poll:created', { poll: result.poll });
      io.emit('polls:list_updated');
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Get poll details (enforcing visibility)
  app.get('/api/polls/:code', async (req, res) => {
    try {
      const code = req.params.code;
      const poll = await getPoll(code);
      if (!poll) {
        return res.status(404).json({ success: false, error: `Room code "${code}" not found.` });
      }

      const context = await getRequesterContext(req);
      const isVisible = await canViewPoll(code, context);
      if (!isVisible) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have permission to view this poll.',
          visibility: poll.visibility,
        });
      }

      const participantCount = getParticipantCount(code);
      res.json({ success: true, poll, participantCount });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update poll state
  app.post('/api/polls/:code/state', async (req, res) => {
    try {
      const code = req.params.code;
      const { adminToken, newState } = req.body;
      const updatedPoll = await updatePollState(code, adminToken, newState);

      // Broadcast state update to all connected sockets globally and room members
      io.emit('poll:state_changed', { state: updatedPoll.state, poll: updatedPoll });
      io.to(code).emit('poll:state_changed', { state: updatedPoll.state, poll: updatedPoll });
      io.emit('poll:updated', { poll: updatedPoll });
      io.to(code).emit('poll:updated', { poll: updatedPoll });
      io.emit('polls:list_updated');

      res.json({ success: true, poll: updatedPoll });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Update poll visibility (OWNER or authorized ADMIN)
  app.post('/api/polls/:code/visibility', async (req, res) => {
    try {
      const code = req.params.code;
      const { visibility } = req.body;

      const poll = await getPoll(code);
      if (!poll) {
        return res.status(404).json({ success: false, error: `Room "${code}" not found.` });
      }

      const context = await getRequesterContext(req);
      const isAuthorized =
        context.isAuthorizedAdmin ||
        (context.adminToken && (await verifyAdmin(code, context.adminToken)));

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only an OWNER or authorized ADMIN can change poll visibility.',
        });
      }

      const updatedPoll = await updatePollVisibility(code, visibility);

      // Broadcast update to all connected sockets globally and room members
      io.emit('poll:updated', { poll: updatedPoll });
      io.to(code).emit('poll:updated', { poll: updatedPoll });
      io.emit('polls:list_updated');

      res.json({ success: true, poll: updatedPoll });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Cast vote
  app.post('/api/polls/:code/vote', async (req, res) => {
    try {
      const code = req.params.code;
      const { participantId, optionId } = req.body;
      const result = await castVote(code, participantId, optionId);

      // Broadcast vote update in real-time to all connected sockets globally and room members
      io.emit('poll:updated', { poll: result.poll });
      io.to(code).emit('poll:updated', { poll: result.poll });
      io.emit('polls:list_updated');

      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Delete a poll (OWNER, authorized ADMIN, or room host)
  app.delete('/api/polls/:code', async (req, res) => {
    try {
      const rawCode = req.params.code;
      const code = (rawCode || '').toUpperCase().trim();
      if (!code) {
        return res.status(400).json({ success: false, error: 'Room code is required.' });
      }

      const context = await getRequesterContext(req);
      const isAuthorized =
        context.isAuthorizedAdmin ||
        (context.adminToken && (await verifyAdmin(code, context.adminToken)));

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only an OWNER, authorized ADMIN, or room host can delete this poll.',
        });
      }

      const result = await deletePoll(code);

      // Emit to all views and room members immediately
      io.emit('poll:deleted', { roomCode: code });
      io.to(code).emit('poll:deleted', { roomCode: code });
      io.emit('polls:list_updated');

      res.json(result);
    } catch (err) {
      const statusCode = (err.message && err.message.includes('not found')) ? 404 : 400;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // SOCKET.IO REAL-TIME EVENTS
  // ==========================================
  io.on('connection', (socket) => {
    // Participant / Admin joins room
    socket.on('room:join', async ({ roomCode, participantId, isAdmin, adminToken, authToken }, callback = () => {}) => {
      const code = (roomCode || '').toUpperCase().trim();
      const poll = await getPoll(code);

      if (!poll) {
        callback({ success: false, error: `Room "${code}" does not exist. Please check the code.` });
        return;
      }

      let isAuthorizedAdmin = false;
      if (authToken) {
        try {
          const decoded = jwt.verify(authToken, getJwtSecret());
          const user = await getUserById(decoded.id);
          if (user && (user.role === 'OWNER' || user.role === 'ADMIN')) {
            isAuthorizedAdmin = true;
          }
        } catch (e) {}
      }
      if (adminToken && (adminToken === 'AUTH_ADMIN_SESSION' || (await verifyAdmin(code, adminToken)))) {
        isAuthorizedAdmin = true;
      }

      if (isAdmin && !isAuthorizedAdmin) {
        callback({ success: false, error: 'Unauthorized: Invalid admin credentials.' });
        return;
      }

      // Check visibility constraints
      if (poll.visibility === PollVisibility.PRIVATE && !isAuthorizedAdmin) {
        callback({
          success: false,
          error: 'Access denied: This poll is private and only visible to authorized administrators.',
        });
        return;
      }

      // If joining with room code, record participant identity
      if (participantId) {
        await recordParticipantJoined(code, participantId);
      }

      socket.join(code);
      const participantCount = registerSocket(socket.id, code, participantId, isAuthorizedAdmin);

      // Check if this participant has already voted
      const userVotedOptionId = participantId ? await getParticipantVote(code, participantId) : null;

      // Ensure returned poll has the fresh participantCount
      poll.participantCount = participantCount;

      // Broadcast updated participant count to all in this room and dashboard
      io.emit('room:participants_updated', { roomCode: code, participantCount });
      io.to(code).emit('room:participants_updated', { roomCode: code, participantCount });
      io.emit('polls:list_updated');

      callback({
        success: true,
        poll,
        participantCount,
        hasVoted: Boolean(userVotedOptionId),
        userVotedOptionId,
      });
    });

    // Participant exits/leaves room explicitly (e.g., navigates away)
    socket.on('room:leave', ({ roomCode }) => {
      const code = (roomCode || '').toUpperCase().trim();
      socket.leave(code);
      const result = unregisterSocket(socket.id);
      if (result && result.roomCode) {
        io.emit('room:participants_updated', {
          roomCode: result.roomCode,
          participantCount: result.participantCount,
        });
        io.to(result.roomCode).emit('room:participants_updated', {
          roomCode: result.roomCode,
          participantCount: result.participantCount,
        });
        io.emit('polls:list_updated');
      }
    });

    // Admin state change: WAITING->LIVE, LIVE->WAITING, LIVE->ENDED, ENDED->LIVE
    socket.on('poll:set_state', async ({ roomCode, adminToken, newState }, callback = () => {}) => {
      const code = (roomCode || '').toUpperCase().trim();
      try {
        const updatedPoll = await updatePollState(code, adminToken, newState);

        // Real-time broadcast to all clients globally and room members
        io.emit('poll:state_changed', { state: updatedPoll.state, poll: updatedPoll });
        io.to(code).emit('poll:state_changed', { state: updatedPoll.state, poll: updatedPoll });
        io.emit('poll:updated', { poll: updatedPoll });
        io.to(code).emit('poll:updated', { poll: updatedPoll });
        io.emit('polls:list_updated');

        callback({ success: true, poll: updatedPoll });
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    // Participant casts a vote
    socket.on('poll:vote', async ({ roomCode, participantId, optionId }, callback = () => {}) => {
      const code = (roomCode || '').toUpperCase().trim();
      try {
        const result = await castVote(code, participantId, optionId);

        // Real-time broadcast updated poll results to all room members and dashboard
        io.emit('poll:updated', { poll: result.poll });
        io.to(code).emit('poll:updated', { poll: result.poll });
        io.emit('polls:list_updated');

        callback({ success: true, poll: result.poll, votedOptionId: result.votedOptionId });
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    // Query poll state manually if needed
    socket.on('poll:get_state', async ({ roomCode }, callback = () => {}) => {
      const code = (roomCode || '').toUpperCase().trim();
      const poll = await getPoll(code);
      if (!poll) {
        callback({ success: false, error: 'Room not found.' });
      } else {
        const participantCount = getParticipantCount(code);
        callback({ success: true, poll, participantCount });
      }
    });

    // Client disconnection handler
    socket.on('disconnect', () => {
      const result = unregisterSocket(socket.id);
      if (result && result.roomCode) {
        io.emit('room:participants_updated', {
          roomCode: result.roomCode,
          participantCount: result.participantCount,
        });
        io.to(result.roomCode).emit('room:participants_updated', {
          roomCode: result.roomCode,
          participantCount: result.participantCount,
        });
        io.emit('polls:list_updated');
      }
    });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Real-Time Polling server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal error on startup:', err);
  process.exit(1);
});
