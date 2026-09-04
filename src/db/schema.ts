import { pgTable, serial, text, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table supporting OWNER, ADMIN, and PARTICIPANT roles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('ADMIN'), // 'OWNER' | 'ADMIN' | 'PARTICIPANT'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Polls table holding room state and question
export const polls = pgTable('polls', {
  id: serial('id').primaryKey(),
  roomCode: text('room_code').notNull().unique(),
  adminToken: text('admin_token').notNull(),
  question: text('question').notNull(),
  state: text('state').notNull().default('WAITING'), // 'WAITING' | 'LIVE' | 'ENDED'
  visibility: text('visibility').notNull().default('PUBLIC'), // 'PUBLIC' | 'PARTICIPANTS_ONLY' | 'PRIVATE'
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Poll Options table
export const pollOptions = pgTable('poll_options', {
  id: serial('id').primaryKey(),
  pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
  optionKey: text('option_key').notNull(),
  text: text('text').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Votes table with strict one-vote constraint per participant per poll
export const votes = pgTable(
  'votes',
  {
    id: serial('id').primaryKey(),
    pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    participantId: text('participant_id').notNull(),
    optionKey: text('option_key').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('poll_participant_unique_idx').on(table.pollId, table.participantId),
  ]
);

// Poll Participants table to record users who joined a poll (for PARTICIPANTS_ONLY visibility)
export const pollParticipants = pgTable(
  'poll_participants',
  {
    id: serial('id').primaryKey(),
    pollId: integer('poll_id').notNull().references(() => polls.id, { onDelete: 'cascade' }),
    participantId: text('participant_id').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('poll_participant_join_unique_idx').on(table.pollId, table.participantId),
  ]
);

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdPolls: many(polls),
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  creator: one(users, {
    fields: [polls.createdByUserId],
    references: [users.id],
  }),
  options: many(pollOptions),
  votes: many(votes),
  participants: many(pollParticipants),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id],
  }),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  poll: one(polls, {
    fields: [votes.pollId],
    references: [polls.id],
  }),
}));

export const pollParticipantsRelations = relations(pollParticipants, ({ one }) => ({
  poll: one(polls, {
    fields: [pollParticipants.pollId],
    references: [polls.id],
  }),
}));
