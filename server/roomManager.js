import crypto from 'node:crypto';
import { eq, desc, and } from 'drizzle-orm';
import { createPool, db } from '../src/db/index.ts';
import { polls, pollOptions, votes, pollParticipants } from '../src/db/schema.ts';

// Active socket connection tracking per room: roomCode -> Set of socket.id (for transient live counts)
const activeRoomSockets = new Map();
// Socket to participant mapping: socket.id -> { roomCode, participantId, isAdmin }
const socketMetadata = new Map();

// Helper to generate readable 6-character room codes (avoiding confusing chars like 0/O, 1/I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function generateRoomCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * CODE_CHARS.length);
      code += CODE_CHARS[idx];
    }
    const [existing] = await db
      .select({ id: polls.id })
      .from(polls)
      .where(eq(polls.roomCode, code))
      .limit(1);
    if (!existing) {
      return code;
    }
  }
  return `ROOM${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

// Valid Poll States
export const PollStates = {
  WAITING: 'WAITING',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
};

// Valid Poll Visibility Levels
export const PollVisibility = {
  PUBLIC: 'PUBLIC',
  PARTICIPANTS_ONLY: 'PARTICIPANTS_ONLY',
  PRIVATE: 'PRIVATE',
};

// Valid state transitions
export const VALID_TRANSITIONS = {
  WAITING: ['LIVE'],
  LIVE: ['WAITING', 'ENDED'],
  ENDED: ['LIVE'],
};

/**
 * Validates database connection on boot and logs connection diagnostics.
 */
export async function initRoomManager() {
  try {
    const pool = createPool();
    const client = await pool.connect();
    const res = await client.query('SELECT current_database() as db_name, current_user as db_user, version() as ver;');
    client.release();

    const dbHost = process.env.SQL_HOST || 'unknown';
    const dbName = res.rows[0]?.db_name || process.env.SQL_DB_NAME || 'unknown';
    const projectInstance = dbHost.includes('cloudsql')
      ? dbHost.split('/').pop()
      : dbHost;

    console.log(`[DB DIAGNOSTIC] Database Connection: SUCCESS`);
    console.log(`[DB DIAGNOSTIC] Database Name: ${dbName}`);
    console.log(`[DB DIAGNOSTIC] Cloud SQL Host/Instance: ${projectInstance}`);
    console.log(`[DB DIAGNOSTIC] Server Process PID: ${process.pid}`);

    const countRes = await db.select().from(polls);
    console.log(`[DB DIAGNOSTIC] Verified PostgreSQL polls table: ${countRes.length} persistent polls present.`);
  } catch (err) {
    console.error('[DB DIAGNOSTIC] Critical Error connecting to PostgreSQL:', err);
    throw err;
  }
}

/**
 * Format poll from database rows for client consumption with calculated vote metrics and winner detection
 */
export function formatPollFromDbRows(pollRow, optionsRows, votesRows, roomCode) {
  const totalVotes = votesRows.length;
  const counts = {};
  for (const opt of optionsRows) {
    counts[opt.optionKey] = 0;
  }
  for (const v of votesRows) {
    if (counts[v.optionKey] !== undefined) {
      counts[v.optionKey]++;
    }
  }

  let maxVotes = 0;
  if (totalVotes > 0) {
    for (const opt of optionsRows) {
      const count = counts[opt.optionKey] || 0;
      if (count > maxVotes) {
        maxVotes = count;
      }
    }
  }

  const formattedOptions = optionsRows.map((opt) => {
    const optVotes = counts[opt.optionKey] || 0;
    const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
    const isWinner = totalVotes > 0 && optVotes === maxVotes;
    return {
      id: opt.optionKey,
      text: opt.text,
      votes: optVotes,
      percentage,
      isWinner,
    };
  });

  return {
    id: pollRow.id,
    roomCode: pollRow.roomCode,
    adminToken: pollRow.adminToken,
    question: pollRow.question,
    options: formattedOptions,
    state: pollRow.state,
    visibility: pollRow.visibility || PollVisibility.PUBLIC,
    totalVotes,
    participantCount: getParticipantCount(roomCode || pollRow.roomCode),
    createdAt: pollRow.createdAt ? pollRow.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: pollRow.updatedAt ? pollRow.updatedAt.toISOString() : new Date().toISOString(),
    createdByUserId: pollRow.createdByUserId,
  };
}

/**
 * Record that a participant joined a poll room directly in PostgreSQL
 */
export async function recordParticipantJoined(roomCode, participantId) {
  if (!participantId) return;
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select({ id: polls.id }).from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) return;

  const pid = String(participantId).trim();
  try {
    await db
      .insert(pollParticipants)
      .values({
        pollId: pollRow.id,
        participantId: pid,
      })
      .onConflictDoNothing();
    console.log(`[DB DIAGNOSTIC] Operation=PARTICIPANT_JOINED | roomCode=${code} | participantId=${pid} | DB insert=SUCCESS`);
  } catch (e) {
    // Duplicate or race condition ignored safely
  }
}

/**
 * Check if a participant has joined a poll room directly in PostgreSQL
 */
export async function hasParticipantJoined(roomCode, participantId) {
  if (!participantId) return false;
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select({ id: polls.id }).from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) return false;

  const pid = String(participantId).trim();
  const [participantRow] = await db
    .select({ id: pollParticipants.id })
    .from(pollParticipants)
    .where(and(eq(pollParticipants.pollId, pollRow.id), eq(pollParticipants.participantId, pid)))
    .limit(1);

  if (participantRow) return true;

  const [voteRow] = await db
    .select({ id: votes.id })
    .from(votes)
    .where(and(eq(votes.pollId, pollRow.id), eq(votes.participantId, pid)))
    .limit(1);

  return Boolean(voteRow);
}

/**
 * Server-side visibility enforcement directly querying PostgreSQL:
 * - PUBLIC: visible to everyone.
 * - PARTICIPANTS_ONLY: visible only to users who joined that poll.
 * - PRIVATE: visible only to authorized ADMIN/OWNER.
 * - ADMIN/OWNER can always see/manage their polls.
 */
export async function canViewPoll(
  roomCode,
  { isAuthorizedAdmin = false, participantId = null, adminToken = null } = {},
  preloadedPoll = null
) {
  const code = (roomCode || '').toUpperCase().trim();
  let pollRow = preloadedPoll;
  if (!pollRow) {
    const [row] = await db.select().from(polls).where(eq(polls.roomCode, code)).limit(1);
    pollRow = row;
  }
  if (!pollRow) return false;

  // ADMIN/OWNER or matching room host adminToken can ALWAYS see/manage
  if (isAuthorizedAdmin || (adminToken && pollRow.adminToken === adminToken)) {
    return true;
  }

  const visibility = pollRow.visibility || PollVisibility.PUBLIC;

  if (visibility === PollVisibility.PUBLIC) {
    return true;
  }

  if (visibility === PollVisibility.PARTICIPANTS_ONLY) {
    return await hasParticipantJoined(code, participantId);
  }

  if (visibility === PollVisibility.PRIVATE) {
    return false;
  }

  return false;
}

/**
 * Create a new poll room and persist directly to PostgreSQL
 */
export async function createPoll({ question, options, visibility = 'PUBLIC', createdByUserId = null }) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('Question must be a non-empty string.');
  }

  if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
    throw new Error('A poll must have between 2 and 6 options.');
  }

  const sanitizedVisibility = Object.values(PollVisibility).includes(visibility)
    ? visibility
    : PollVisibility.PUBLIC;

  const sanitizedOptions = options.map((opt, index) => {
    const text = typeof opt === 'string' ? opt.trim() : (opt?.text || '').trim();
    if (!text) {
      throw new Error(`Option ${index + 1} cannot be empty.`);
    }
    return {
      id: `opt_${index + 1}_${Math.random().toString(36).slice(2, 7)}`,
      text,
    };
  });

  const roomCode = await generateRoomCode();
  const adminToken = crypto.randomBytes(16).toString('hex');
  const now = new Date();

  // Insert into PostgreSQL
  const [created] = await db
    .insert(polls)
    .values({
      roomCode,
      adminToken,
      question: question.trim(),
      state: PollStates.WAITING,
      visibility: sanitizedVisibility,
      createdByUserId: createdByUserId || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Insert options into PostgreSQL
  await db.insert(pollOptions).values(
    sanitizedOptions.map((opt, index) => ({
      pollId: created.id,
      optionKey: opt.id,
      text: opt.text,
      displayOrder: index,
      createdAt: now,
    }))
  );

  console.log(`[DB DIAGNOSTIC] Operation=CREATE_POLL | roomCode=${roomCode} | DB transaction=SUCCESS | DB state=${created.state} | visibility=${created.visibility} | id=${created.id}`);

  const poll = await getPoll(roomCode);
  return {
    roomCode,
    adminToken,
    poll,
  };
}

/**
 * Get poll directly from PostgreSQL by room code
 */
export async function getPoll(roomCode) {
  const code = (roomCode || '').toUpperCase().trim();
  if (!code) return null;

  const [pollRow] = await db.select().from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) {
    console.log(`[DB DIAGNOSTIC] Read poll roomCode=${code} | NOT FOUND in PostgreSQL`);
    return null;
  }

  const optionsRows = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollRow.id))
    .orderBy(pollOptions.displayOrder);

  const votesRows = await db
    .select()
    .from(votes)
    .where(eq(votes.pollId, pollRow.id));

  const formatted = formatPollFromDbRows(pollRow, optionsRows, votesRows, code);
  console.log(`[DB DIAGNOSTIC] Read poll roomCode=${code} | DB state=${formatted.state} | totalVotes=${formatted.totalVotes} | visibility=${formatted.visibility}`);
  return formatted;
}

/**
 * Verify admin credentials for a room directly in PostgreSQL
 */
export async function verifyAdmin(roomCode, adminToken) {
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db
    .select({ adminToken: polls.adminToken })
    .from(polls)
    .where(eq(polls.roomCode, code))
    .limit(1);
  if (!pollRow) return false;
  return pollRow.adminToken === adminToken;
}

/**
 * Change poll state and persist directly to PostgreSQL
 * Allowed transitions:
 * WAITING -> LIVE
 * LIVE -> WAITING
 * LIVE -> ENDED
 * ENDED -> LIVE
 */
export async function updatePollState(roomCode, adminToken, newState) {
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select().from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) {
    throw new Error(`Room code "${code}" does not exist.`);
  }

  // Allow if adminToken matches pollRow.adminToken OR adminToken === 'AUTH_ADMIN_SESSION'
  if (adminToken !== 'AUTH_ADMIN_SESSION' && pollRow.adminToken !== adminToken) {
    throw new Error('Unauthorized: Invalid admin credentials.');
  }

  const validTransitions = VALID_TRANSITIONS[pollRow.state] || [];
  if (!validTransitions.includes(newState)) {
    throw new Error(
      `Invalid state transition: Cannot change state from ${pollRow.state} to ${newState}. Valid transitions: ${validTransitions.join(', ') || 'None'}`
    );
  }

  const now = new Date();

  // Persist state directly to PostgreSQL
  const [updated] = await db
    .update(polls)
    .set({
      state: newState,
      updatedAt: now,
    })
    .where(eq(polls.roomCode, code))
    .returning();

  console.log(`[DB DIAGNOSTIC] Operation=STATE_CHANGE | roomCode=${code} | fromState=${pollRow.state} -> toState=${updated.state} | DB transaction=SUCCESS | returned DB state=${updated.state}`);

  return await getPoll(code);
}

/**
 * Update poll visibility and persist directly to PostgreSQL
 * Allowed visibilities: PUBLIC, PARTICIPANTS_ONLY, PRIVATE
 */
export async function updatePollVisibility(roomCode, newVisibility) {
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select().from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) {
    throw new Error(`Room code "${code}" does not exist.`);
  }

  const validVisibilities = Object.values(PollVisibility);
  if (!validVisibilities.includes(newVisibility)) {
    throw new Error(
      `Invalid visibility "${newVisibility}". Allowed values: ${validVisibilities.join(', ')}`
    );
  }

  const now = new Date();

  // Persist visibility directly to PostgreSQL
  const [updated] = await db
    .update(polls)
    .set({
      visibility: newVisibility,
      updatedAt: now,
    })
    .where(eq(polls.roomCode, code))
    .returning();

  console.log(`[DB DIAGNOSTIC] Operation=UPDATE_VISIBILITY | roomCode=${code} | newVisibility=${updated.visibility} | DB transaction=SUCCESS | returned DB visibility=${updated.visibility}`);

  return await getPoll(code);
}

/**
 * Cast a vote and persist directly to PostgreSQL
 * Enforces server-side one-vote-per-participant constraint
 */
export async function castVote(roomCode, participantId, optionId) {
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select().from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) {
    throw new Error(`Room code "${code}" does not exist.`);
  }

  if (pollRow.state !== PollStates.LIVE) {
    if (pollRow.state === PollStates.WAITING) {
      throw new Error('Voting is paused or has not started yet.');
    } else if (pollRow.state === PollStates.ENDED) {
      throw new Error('This poll has ended. Voting is frozen.');
    } else {
      throw new Error(`Cannot vote when poll state is ${pollRow.state}.`);
    }
  }

  if (!participantId || typeof participantId !== 'string' || participantId.trim().length === 0) {
    throw new Error('Participant identifier is required to cast a vote.');
  }

  const trimmedPid = participantId.trim();

  // Validate option exists in database
  const [optionRow] = await db
    .select()
    .from(pollOptions)
    .where(and(eq(pollOptions.pollId, pollRow.id), eq(pollOptions.optionKey, optionId)))
    .limit(1);

  if (!optionRow) {
    throw new Error('Invalid option selected.');
  }

  const now = new Date();

  // Insert vote into PostgreSQL with unique constraint catch
  try {
    await db.insert(votes).values({
      pollId: pollRow.id,
      participantId: trimmedPid,
      optionKey: optionId,
      createdAt: now,
    });
  } catch (dbErr) {
    if (dbErr.message && dbErr.message.includes('unique')) {
      throw new Error('Duplicate vote: You have already submitted a vote in this poll.');
    }
    throw dbErr;
  }

  // Update poll updatedAt timestamp
  await db
    .update(polls)
    .set({ updatedAt: now })
    .where(eq(polls.id, pollRow.id));

  console.log(`[DB DIAGNOSTIC] Operation=CAST_VOTE | roomCode=${code} | participantId=${trimmedPid} | optionId=${optionId} | DB transaction=SUCCESS`);

  const updatedPoll = await getPoll(code);
  return {
    poll: updatedPoll,
    votedOptionId: optionId,
  };
}

/**
 * Check if a participant has voted in a poll directly in PostgreSQL
 */
export async function getParticipantVote(roomCode, participantId) {
  if (!participantId) return null;
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select({ id: polls.id }).from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) return null;

  const [voteRow] = await db
    .select({ optionKey: votes.optionKey })
    .from(votes)
    .where(and(eq(votes.pollId, pollRow.id), eq(votes.participantId, participantId.trim())))
    .limit(1);

  return voteRow ? voteRow.optionKey : null;
}

/**
 * Get all polls grouped by state: WAITING, LIVE, ENDED directly from PostgreSQL
 * For the Admin Dashboard
 */
export async function getAllPollsGrouped() {
  const dbPolls = await db.select().from(polls).orderBy(desc(polls.updatedAt));
  const allOptions = await db.select().from(pollOptions).orderBy(pollOptions.displayOrder);
  const allVotes = await db.select().from(votes);

  const optionsByPollId = new Map();
  for (const opt of allOptions) {
    if (!optionsByPollId.has(opt.pollId)) {
      optionsByPollId.set(opt.pollId, []);
    }
    optionsByPollId.get(opt.pollId).push(opt);
  }

  const votesByPollId = new Map();
  for (const v of allVotes) {
    if (!votesByPollId.has(v.pollId)) {
      votesByPollId.set(v.pollId, []);
    }
    votesByPollId.get(v.pollId).push(v);
  }

  const grouped = {
    WAITING: [],
    LIVE: [],
    ENDED: [],
  };

  for (const p of dbPolls) {
    const pOptions = optionsByPollId.get(p.id) || [];
    const pVotes = votesByPollId.get(p.id) || [];
    const formatted = formatPollFromDbRows(p, pOptions, pVotes, p.roomCode);
    const state = formatted.state;
    if (grouped[state]) {
      grouped[state].push(formatted);
    } else {
      grouped.WAITING.push(formatted);
    }
  }

  console.log(`[DB DIAGNOSTIC] Read getAllPollsGrouped returned ${dbPolls.length} total polls from PostgreSQL (WAITING: ${grouped.WAITING.length}, LIVE: ${grouped.LIVE.length}, ENDED: ${grouped.ENDED.length})`);
  return grouped;
}

/**
 * Get the currently LIVE poll visible to this visitor/user directly from PostgreSQL
 */
export async function getLivePollForVisitor(context = {}) {
  const livePolls = await db
    .select()
    .from(polls)
    .where(eq(polls.state, PollStates.LIVE))
    .orderBy(desc(polls.updatedAt));

  for (const pollRow of livePolls) {
    const isVisible = await canViewPoll(pollRow.roomCode, context, pollRow);
    if (isVisible) {
      const poll = await getPoll(pollRow.roomCode);
      console.log(`[DB DIAGNOSTIC] Read getLivePollForVisitor returned roomCode=${poll?.roomCode} | DB state=${poll?.state}`);
      return poll;
    }
  }

  console.log(`[DB DIAGNOSTIC] Read getLivePollForVisitor returned: none`);
  return null;
}

/**
 * Get all previous (ENDED) polls visible to this visitor/user directly from PostgreSQL
 */
export async function getPreviousPollsForVisitor(context = {}) {
  const endedPolls = await db
    .select()
    .from(polls)
    .where(eq(polls.state, PollStates.ENDED))
    .orderBy(desc(polls.updatedAt));

  const previousPolls = [];
  for (const pollRow of endedPolls) {
    const isVisible = await canViewPoll(pollRow.roomCode, context, pollRow);
    if (isVisible) {
      const poll = await getPoll(pollRow.roomCode);
      if (poll) {
        previousPolls.push(poll);
      }
    }
  }

  console.log(`[DB DIAGNOSTIC] Read getPreviousPollsForVisitor returned ${previousPolls.length} ended polls from PostgreSQL`);
  return previousPolls;
}

/**
 * Delete a poll completely from PostgreSQL
 */
export async function deletePoll(roomCode) {
  const code = (roomCode || '').toUpperCase().trim();
  const [pollRow] = await db.select({ id: polls.id }).from(polls).where(eq(polls.roomCode, code)).limit(1);
  if (!pollRow) {
    throw new Error(`Room "${code}" not found.`);
  }

  // Delete from PostgreSQL (cascades to options, votes, and participants)
  await db.delete(polls).where(eq(polls.roomCode, code));
  console.log(`[DB DIAGNOSTIC] Operation=DELETE_POLL | roomCode=${code} | DB transaction=SUCCESS`);

  // Clean up active room sockets
  if (activeRoomSockets.has(code)) {
    const sockets = activeRoomSockets.get(code);
    if (sockets) {
      for (const sId of sockets) {
        socketMetadata.delete(sId);
      }
    }
    activeRoomSockets.delete(code);
  }

  return { success: true, roomCode: code };
}

/**
 * Real-time active socket tracking & participant counting
 */
export function registerSocket(socketId, roomCode, participantId, isAdmin = false) {
  const code = (roomCode || '').toUpperCase().trim();
  if (!activeRoomSockets.has(code)) {
    activeRoomSockets.set(code, new Set());
  }
  activeRoomSockets.get(code).add(socketId);
  socketMetadata.set(socketId, { roomCode: code, participantId, isAdmin });

  return getParticipantCount(code);
}

export function unregisterSocket(socketId) {
  const meta = socketMetadata.get(socketId);
  if (!meta) return null;

  socketMetadata.delete(socketId);
  const { roomCode } = meta;

  const socketsInRoom = activeRoomSockets.get(roomCode);
  if (socketsInRoom) {
    socketsInRoom.delete(socketId);
    if (socketsInRoom.size === 0) {
      activeRoomSockets.delete(roomCode);
    }
  }

  return {
    roomCode,
    participantCount: getParticipantCount(roomCode),
  };
}

export function getParticipantCount(roomCode) {
  const code = (roomCode || '').toUpperCase().trim();
  const sockets = activeRoomSockets.get(code);
  return sockets ? sockets.size : 0;
}
