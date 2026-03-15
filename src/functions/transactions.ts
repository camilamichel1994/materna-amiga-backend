import { eq, or, desc, count } from 'drizzle-orm'
import { db } from '../db'
import { transactions, listings, users } from '../db/schema'

export async function getTransactionsByUser(
  userId: string,
  page = 1,
  limit = 10
) {
  try {
    const offset = (page - 1) * limit

    const [transactionsList, totalResult] = await Promise.all([
      db
        .select({
          id: transactions.id,
          listingId: transactions.listingId,
          buyerId: transactions.buyerId,
          sellerId: transactions.sellerId,
          createdAt: transactions.createdAt,
          listingName: listings.name,
          listingPrice: listings.price,
          listingPhotos: listings.photos,
          buyerName: users.name,
        })
        .from(transactions)
        .innerJoin(listings, eq(transactions.listingId, listings.id))
        .innerJoin(users, eq(transactions.buyerId, users.id))
        .where(
          or(
            eq(transactions.buyerId, userId),
            eq(transactions.sellerId, userId)
          )
        )
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(transactions)
        .where(
          or(
            eq(transactions.buyerId, userId),
            eq(transactions.sellerId, userId)
          )
        ),
    ])

    const total = totalResult[0]?.count || 0

    const sellerIds = [
      ...new Set(transactionsList.map(t => t.sellerId)),
    ]

    const sellersData =
      sellerIds.length > 0
        ? await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(
              or(...sellerIds.map(id => eq(users.id, id)))!
            )
        : []

    const sellersMap = new Map(sellersData.map(s => [s.id, s.name]))

    const items = transactionsList.map(t => ({
      id: t.id,
      listing: {
        id: t.listingId,
        name: t.listingName,
        price: t.listingPrice ? Number.parseFloat(t.listingPrice) : null,
        photo: t.listingPhotos[0] || null,
      },
      buyer: {
        id: t.buyerId,
        name: t.buyerName,
      },
      seller: {
        id: t.sellerId,
        name: sellersMap.get(t.sellerId) || null,
      },
      role: t.buyerId === userId ? 'buyer' : 'seller',
      created_at: t.createdAt.toISOString(),
    }))

    return {
      success: true,
      status: 200,
      data: {
        items,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    }
  } catch (error) {
    console.error('Error getting transactions:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function getTransactionById(transactionId: string, userId: string) {
  try {
    const result = await db
      .select({
        id: transactions.id,
        listingId: transactions.listingId,
        buyerId: transactions.buyerId,
        sellerId: transactions.sellerId,
        createdAt: transactions.createdAt,
        listingName: listings.name,
        listingPrice: listings.price,
        listingPhotos: listings.photos,
      })
      .from(transactions)
      .innerJoin(listings, eq(transactions.listingId, listings.id))
      .where(eq(transactions.id, transactionId))
      .limit(1)

    if (result.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Transaction not found',
      }
    }

    const t = result[0]!

    if (t.buyerId !== userId && t.sellerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You can only view your own transactions',
      }
    }

    const [buyerResult, sellerResult] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, t.buyerId))
        .limit(1),
      db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, t.sellerId))
        .limit(1),
    ])

    return {
      success: true,
      status: 200,
      data: {
        id: t.id,
        listing: {
          id: t.listingId,
          name: t.listingName,
          price: t.listingPrice ? Number.parseFloat(t.listingPrice) : null,
          photos: t.listingPhotos,
        },
        buyer: {
          id: t.buyerId,
          name: buyerResult[0]?.name || null,
          avatarUrl: buyerResult[0]?.avatarUrl || null,
        },
        seller: {
          id: t.sellerId,
          name: sellerResult[0]?.name || null,
          avatarUrl: sellerResult[0]?.avatarUrl || null,
        },
        role: t.buyerId === userId ? 'buyer' : 'seller',
        created_at: t.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error getting transaction:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function createTransaction(
  buyerId: string,
  listingId: string
) {
  try {
    const listing = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
        name: listings.name,
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1)

    if (listing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Listing not found',
      }
    }

    const sellerId = listing[0]!.ownerId

    if (buyerId === sellerId) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Cannot buy your own listing',
      }
    }

    const result = await db
      .insert(transactions)
      .values({
        listingId,
        buyerId,
        sellerId,
      })
      .returning({
        id: transactions.id,
        listingId: transactions.listingId,
        buyerId: transactions.buyerId,
        sellerId: transactions.sellerId,
        createdAt: transactions.createdAt,
      })

    return {
      success: true,
      status: 201,
      data: {
        id: result[0]!.id,
        listing_id: result[0]!.listingId,
        buyer_id: result[0]!.buyerId,
        seller_id: result[0]!.sellerId,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error creating transaction:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function deleteTransaction(transactionId: string, userId: string) {
  try {
    const existing = await db
      .select({
        id: transactions.id,
        buyerId: transactions.buyerId,
        sellerId: transactions.sellerId,
      })
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)

    if (existing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Transaction not found',
      }
    }

    if (existing[0]!.buyerId !== userId && existing[0]!.sellerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You can only delete your own transactions',
      }
    }

    await db.delete(transactions).where(eq(transactions.id, transactionId))

    return {
      success: true,
      status: 200,
      message: 'Transaction deleted successfully',
    }
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}
