import { pgTable, text, timestamp, uuid, numeric } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password'),
  avatarUrl: text('avatar_url'),
  location: text('location'),
  babyAgeRange: text('baby_age_range'),
  acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const listingConditions = ['Novo', 'Usado - Excelente', 'Usado - Bom', 'Usado - Regular'] as const
export type ListingCondition = (typeof listingConditions)[number]

export const listingTypes = ['venda', 'doacao', 'troca'] as const
export type ListingType = (typeof listingTypes)[number]

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  condition: text('condition').notNull().$type<ListingCondition>(),
  listingType: text('listing_type').notNull().$type<ListingType>().default('venda'),
  price: numeric('price', { precision: 10, scale: 2 }),
  message: text('message'),
  photos: text('photos').array().notNull(),
  city: text('city'),
  rating: numeric('rating', { precision: 2, scale: 1 }).default('0'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewerId: uuid('reviewer_id').notNull().references(() => users.id),
  reviewedUserId: uuid('reviewed_user_id').notNull().references(() => users.id),
  rating: numeric('rating', { precision: 1, scale: 0 }).notNull(),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  buyerId: uuid('buyer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id').references(() => listings.id),
  user1Id: uuid('user1_id').notNull().references(() => users.id),
  user2Id: uuid('user2_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').notNull().references(() => chats.id),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const exchanges = pgTable('exchanges', {
  id: uuid('id').primaryKey().defaultRandom(),
  offeredItemId: uuid('offered_item_id').notNull().references(() => listings.id),
  requestedItemId: uuid('requested_item_id').notNull().references(() => listings.id),
  offeredByUserId: uuid('offered_by_user_id').notNull().references(() => users.id),
  requestedByUserId: uuid('requested_by_user_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

