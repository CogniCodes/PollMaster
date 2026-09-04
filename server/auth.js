import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { users } from '../src/db/schema.ts';

function cleanEnvSecret(val, fallback = '') {
  if (!val) return fallback;
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str || fallback;
}

export function getJwtSecret() {
  const secret = cleanEnvSecret(process.env.JWT_SECRET);
  return secret || 'pollmaster-cloudsql-secure-jwt-secret-key-2026';
}

/**
 * Ensures the system has an initial OWNER on first bootstrap if none exists.
 * Environment variables (INITIAL_OWNER_EMAIL, INITIAL_OWNER_PASSWORD, INITIAL_OWNER_USERNAME)
 * are ONLY used to bootstrap the first OWNER account.
 * Once an OWNER exists in the database, this function will NEVER overwrite, recreate, or force credentials.
 * Ongoing authentication is strictly backed by the PostgreSQL users table.
 */
export async function seedInitialOwner() {
  try {
    // 1. If any OWNER already exists in PostgreSQL, do not touch or overwrite anything!
    const existingOwners = await db
      .select()
      .from(users)
      .where(eq(users.role, 'OWNER'))
      .limit(1);

    if (existingOwners.length > 0) {
      console.log(`[Auth] System OWNER verified in database (ID: ${existingOwners[0].id}).`);
      return existingOwners[0];
    }

    // 2. Only bootstrap if NO OWNER exists in the entire system.
    const initialEmail = cleanEnvSecret(process.env.INITIAL_OWNER_EMAIL, 'owner@pollmaster.internal').toLowerCase();
    const initialUsername = cleanEnvSecret(process.env.INITIAL_OWNER_USERNAME, 'SystemOwner');
    const initialPassword = cleanEnvSecret(process.env.INITIAL_OWNER_PASSWORD, 'OwnerSecure2026!');

    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    // If a user with initialEmail exists in the database, promote to OWNER
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${initialEmail}`)
      .limit(1);

    if (existingUser.length > 0) {
      const [promoted] = await db
        .update(users)
        .set({
          role: 'OWNER',
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser[0].id))
        .returning();
      console.log(`[Auth] Existing account promoted to OWNER (ID: ${promoted.id}).`);
      return promoted;
    }

    // Otherwise, create the first system OWNER
    const [createdOwner] = await db
      .insert(users)
      .values({
        email: initialEmail,
        username: initialUsername,
        passwordHash: hashedPassword,
        role: 'OWNER',
      })
      .returning();

    console.log(`[Auth] Initial system OWNER created (ID: ${createdOwner.id}).`);
    return createdOwner;
  } catch (err) {
    console.error('[Auth] Error during initial OWNER bootstrap:', err.message);
    throw err;
  }
}

/**
 * Authenticates user and returns JWT token
 */
export async function loginUser(identifier, password) {
  if (!identifier || !password) {
    throw new Error('Email/Username and password are required.');
  }

  const cleanIdent = String(identifier).toLowerCase().trim();

  // Find by email or username
  const foundUsers = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${cleanIdent} OR LOWER(${users.username}) = ${cleanIdent}`)
    .limit(1);

  if (foundUsers.length === 0) {
    throw new Error('Invalid credentials.');
  }

  const user = foundUsers[0];
  const isMatch = await bcrypt.compare(String(password), user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid credentials.');
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}

/**
 * Get user profile by ID
 */
export async function getUserById(userId) {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (result.length === 0) return null;
  const u = result[0];
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
  };
}

/**
 * Lists all administrative users (OWNER and ADMINs)
 */
export async function listAdmins() {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(users.id);

  return result;
}

/**
 * Create a new ADMIN user.
 * Exactly one OWNER exists, so only ADMIN role can be created.
 */
export async function createAdmin({ email, username, password }, requestingUserId) {
  if (!email || !username || !password) {
    throw new Error('Email, username, and password are required.');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.trim();

  // Check if email already in use
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, cleanEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A user with email "${cleanEmail}" already exists.`);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [newAdmin] = await db
    .insert(users)
    .values({
      email: cleanEmail,
      username: cleanUsername,
      passwordHash,
      role: 'ADMIN',
    })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    });

  return newAdmin;
}

/**
 * Revoke an admin user.
 * Cannot revoke the OWNER.
 */
export async function revokeAdmin(targetUserId, requestingUserId) {
  if (targetUserId === requestingUserId) {
    throw new Error('Cannot revoke your own account.');
  }

  const target = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (target.length === 0) {
    throw new Error('Target user not found.');
  }

  if (target[0].role === 'OWNER') {
    throw new Error('Cannot revoke the OWNER account. Transfer ownership first.');
  }

  await db.delete(users).where(eq(users.id, targetUserId));
  return { success: true, revokedUserId: targetUserId };
}

/**
 * Transfer ownership to a selected ADMIN.
 * Rules:
 * - Exactly one OWNER at a time.
 * - Makes the selected ADMIN the new OWNER.
 * - Makes the previous OWNER an ADMIN.
 * - ADMIN cannot transfer ownership.
 */
export async function transferOwnership(newOwnerId, currentOwnerId) {
  if (newOwnerId === currentOwnerId) {
    throw new Error('Target user is already the OWNER.');
  }

  // Verify target user is an ADMIN
  const targetUser = await db.select().from(users).where(eq(users.id, newOwnerId)).limit(1);
  if (targetUser.length === 0) {
    throw new Error('Target user does not exist.');
  }

  if (targetUser[0].role !== 'ADMIN') {
    throw new Error('Ownership can only be transferred to an active ADMIN.');
  }

  // Perform transfer: demote current owner to ADMIN, promote target to OWNER
  await db.transaction(async (tx) => {
    // Demote current owner
    await tx
      .update(users)
      .set({ role: 'ADMIN', updatedAt: new Date() })
      .where(eq(users.id, currentOwnerId));

    // Promote new owner
    await tx
      .update(users)
      .set({ role: 'OWNER', updatedAt: new Date() })
      .where(eq(users.id, newOwnerId));
  });

  const updatedTarget = await getUserById(newOwnerId);
  const updatedPrevious = await getUserById(currentOwnerId);

  return {
    success: true,
    newOwner: updatedTarget,
    previousOwner: updatedPrevious,
  };
}

/**
 * Express middleware to authenticate any ADMIN or OWNER
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token.' });
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token.' });
    }

    const token = match[1].trim();
    const decoded = jwt.verify(token, getJwtSecret());

    const user = await getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token.' });
  }
}

/**
 * Express middleware to strictly enforce OWNER role
 */
export function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'OWNER') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only the system OWNER has permission to perform this action.',
    });
  }
  next();
}
