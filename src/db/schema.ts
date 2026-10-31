import { mysqlTable, varchar, double, text, timestamp, boolean } from 'drizzle-orm/mysql-core';

// Users table schema
export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  avatar: varchar('avatar', { length: 255 }).default('default'),
  monthlyIncomeGoal: double('monthly_income_goal').default(0),
  monthlyExpenseLimit: double('monthly_expense_limit').default(0),
  expenseLimitPeriod: varchar('expense_limit_period', { length: 20 }).default('bulanan'),
  telegramChatId: varchar('telegram_chat_id', { length: 64 }).unique(),
  telegramUsername: varchar('telegram_username', { length: 255 }),
  telegramLinkCode: varchar('telegram_link_code', { length: 32 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transactions table schema
export const transactions = mysqlTable('transactions', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }),
  nominal: double('nominal').notNull(),
  kategori: varchar('kategori', { length: 100 }).notNull(),
  tanggal: varchar('tanggal', { length: 10 }).notNull(), // format: YYYY-MM-DD
  catatan: text('catatan'),
  tipe: varchar('tipe', { length: 20 }).notNull(), // 'pemasukan' | 'pengeluaran'
  buktiPembayaran: text('bukti_pembayaran'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Savings Goals table schema
export const savingsGoals = mysqlTable('savings_goals', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }),
  title: varchar('title', { length: 255 }).notNull(),
  targetAmount: double('target_amount').notNull(),
  currentAmount: double('current_amount').notNull().default(0),
  deadline: varchar('deadline', { length: 10 }).notNull(), // format: YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow(),
});

// Sessions table schema
export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 512 }),
  userId: varchar('user_id', { length: 128 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
});

// Accounts table schema
export const accounts = mysqlTable('accounts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 128 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Verifications table schema
export const verifications = mysqlTable('verifications', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
