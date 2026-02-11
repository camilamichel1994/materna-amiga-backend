import { and, eq, or, ne } from 'drizzle-orm'
import { db } from '../db'
import { exchanges, listings, users } from '../db/schema'

export async function getAvailableExchanges(userId: string) {
  try {
    const result = await db
      .select({
        id: listings.id,
        name: listings.name,
        description: listings.description,
        photos: listings.photos,
        ownerId: listings.ownerId,
        owner: {
          id: users.id,
          name: users.name,
          location: users.location,
        },
      })
      .from(listings)
      .innerJoin(users, eq(listings.ownerId, users.id))
      .where(ne(listings.ownerId, userId))

    const items = result.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      images: item.photos,
      owner: {
        id: item.owner.id,
        name: item.owner.name,
        location: item.owner.location,
      },
    }))

    return {
      success: true,
      status: 200,
      data: { items },
    }
  } catch (error) {
    console.error('Error getting available exchanges:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function proposeExchange(
  userId: string,
  offeredItemId: string,
  requestedItemId: string,
  message?: string
) {
  try {
    const items = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
      })
      .from(listings)
      .where(or(eq(listings.id, offeredItemId), eq(listings.id, requestedItemId)))

    const offeredItem = items.find(item => item.id === offeredItemId)
    const requestedItem = items.find(item => item.id === requestedItemId)

    if (!offeredItem || !requestedItem) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'One or both items not found',
      }
    }

    if (offeredItem.ownerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not own the offered item',
      }
    }

    if (requestedItem.ownerId === userId) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Cannot propose exchange with your own item',
      }
    }

    const result = await db
      .insert(exchanges)
      .values({
        offeredItemId,
        requestedItemId,
        offeredByUserId: userId,
        requestedByUserId: requestedItem.ownerId,
        message,
        status: 'pending',
      })
      .returning({
        id: exchanges.id,
        offeredItemId: exchanges.offeredItemId,
        requestedItemId: exchanges.requestedItemId,
        status: exchanges.status,
        createdAt: exchanges.createdAt,
      })

    return {
      success: true,
      status: 201,
      data: {
        id: result[0]!.id,
        offered_item_id: result[0]!.offeredItemId,
        requested_item_id: result[0]!.requestedItemId,
        status: result[0]!.status,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error proposing exchange:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function getExchanges(userId: string, status?: string) {
  try {
    const filters = [
      or(eq(exchanges.offeredByUserId, userId), eq(exchanges.requestedByUserId, userId)),
    ]

    if (status) {
      filters.push(eq(exchanges.status, status))
    }

    const result = await db
      .select({
        id: exchanges.id,
        offeredItemId: exchanges.offeredItemId,
        requestedItemId: exchanges.requestedItemId,
        status: exchanges.status,
        createdAt: exchanges.createdAt,
        offeredItem: {
          id: listings.id,
          name: listings.name,
          photos: listings.photos,
        },
        requestedItem: {
          id: listings.id,
          name: listings.name,
          photos: listings.photos,
        },
      })
      .from(exchanges)
      .innerJoin(listings, eq(exchanges.offeredItemId, listings.id))
      .innerJoin(listings, eq(exchanges.requestedItemId, listings.id))
      .where(and(...filters))

    const exchangesList = await db
      .select({
        id: exchanges.id,
        offeredItemId: exchanges.offeredItemId,
        requestedItemId: exchanges.requestedItemId,
        status: exchanges.status,
        createdAt: exchanges.createdAt,
      })
      .from(exchanges)
      .where(and(...filters))

    const exchangesWithItems = await Promise.all(
      exchangesList.map(async exchange => {
        const offeredItem = await db
          .select({ id: listings.id, name: listings.name, photos: listings.photos })
          .from(listings)
          .where(eq(listings.id, exchange.offeredItemId))
          .limit(1)

        const requestedItem = await db
          .select({ id: listings.id, name: listings.name, photos: listings.photos })
          .from(listings)
          .where(eq(listings.id, exchange.requestedItemId))
          .limit(1)

        return {
          id: exchange.id,
          offered_item: {
            id: offeredItem[0]?.id,
            name: offeredItem[0]?.name,
            images: offeredItem[0]?.photos,
          },
          requested_item: {
            id: requestedItem[0]?.id,
            name: requestedItem[0]?.name,
            images: requestedItem[0]?.photos,
          },
          status: exchange.status,
          created_at: exchange.createdAt.toISOString(),
        }
      })
    )

    return {
      success: true,
      status: 200,
      data: { exchanges: exchangesWithItems },
    }
  } catch (error) {
    console.error('Error getting exchanges:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function updateExchangeStatus(
  exchangeId: string,
  userId: string,
  status: 'accepted' | 'rejected'
) {
  try {
    const exchange = await db
      .select({
        id: exchanges.id,
        requestedByUserId: exchanges.requestedByUserId,
        status: exchanges.status,
      })
      .from(exchanges)
      .where(eq(exchanges.id, exchangeId))
      .limit(1)

    if (exchange.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Exchange not found',
      }
    }

    if (exchange[0]!.requestedByUserId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have permission to update this exchange',
      }
    }

    if (exchange[0]!.status !== 'pending') {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Exchange is not pending',
      }
    }

    await db
      .update(exchanges)
      .set({ status, updatedAt: new Date() })
      .where(eq(exchanges.id, exchangeId))

    return {
      success: true,
      status: 200,
      message: `Exchange ${status} successfully`,
    }
  } catch (error) {
    console.error('Error updating exchange status:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

