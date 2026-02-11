import { eq } from 'drizzle-orm'
import { db } from '../db'
import { wishlist } from '../db/schema'

interface WishlistItemInput {
  type: string
  size?: string
  brand?: string
  description?: string
}

export async function getWishlist(userId: string) {
  try {
    const result = await db
      .select({
        id: wishlist.id,
        type: wishlist.type,
        size: wishlist.size,
        brand: wishlist.brand,
        description: wishlist.description,
        createdAt: wishlist.createdAt,
      })
      .from(wishlist)
      .where(eq(wishlist.userId, userId))
      .orderBy(wishlist.createdAt)

    const wishes = result.map(item => ({
      id: item.id,
      type: item.type,
      size: item.size,
      brand: item.brand,
      description: item.description,
      created_at: item.createdAt.toISOString(),
    }))

    return {
      success: true,
      status: 200,
      data: { wishes },
    }
  } catch (error) {
    console.error('Error getting wishlist:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function addWishlistItem(userId: string, data: WishlistItemInput) {
  try {
    const result = await db
      .insert(wishlist)
      .values({
        userId,
        type: data.type,
        size: data.size,
        brand: data.brand,
        description: data.description,
      })
      .returning({
        id: wishlist.id,
        type: wishlist.type,
        size: wishlist.size,
        brand: wishlist.brand,
        description: wishlist.description,
        createdAt: wishlist.createdAt,
      })

    return {
      success: true,
      status: 201,
      data: {
        id: result[0]!.id,
        type: result[0]!.type,
        size: result[0]!.size,
        brand: result[0]!.brand,
        description: result[0]!.description,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error adding wishlist item:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function updateWishlistItem(
  itemId: string,
  userId: string,
  data: Partial<WishlistItemInput>
) {
  try {
    const existing = await db
      .select({ id: wishlist.id, userId: wishlist.userId })
      .from(wishlist)
      .where(eq(wishlist.id, itemId))
      .limit(1)

    if (existing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Wishlist item not found',
      }
    }

    if (existing[0]!.userId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have permission to update this item',
      }
    }

    const updateData: any = { updatedAt: new Date() }
    if (data.type !== undefined) updateData.type = data.type
    if (data.size !== undefined) updateData.size = data.size
    if (data.brand !== undefined) updateData.brand = data.brand
    if (data.description !== undefined) updateData.description = data.description

    const result = await db
      .update(wishlist)
      .set(updateData)
      .where(eq(wishlist.id, itemId))
      .returning({
        id: wishlist.id,
        type: wishlist.type,
        size: wishlist.size,
        brand: wishlist.brand,
        description: wishlist.description,
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt,
      })

    return {
      success: true,
      status: 200,
      data: {
        id: result[0]!.id,
        type: result[0]!.type,
        size: result[0]!.size,
        brand: result[0]!.brand,
        description: result[0]!.description,
        created_at: result[0]!.createdAt.toISOString(),
        updated_at: result[0]!.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error updating wishlist item:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function deleteWishlistItem(itemId: string, userId: string) {
  try {
    const existing = await db
      .select({ id: wishlist.id, userId: wishlist.userId })
      .from(wishlist)
      .where(eq(wishlist.id, itemId))
      .limit(1)

    if (existing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Wishlist item not found',
      }
    }

    if (existing[0]!.userId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have permission to delete this item',
      }
    }

    await db.delete(wishlist).where(eq(wishlist.id, itemId))

    return {
      success: true,
      status: 200,
      message: 'Wishlist item deleted successfully',
    }
  } catch (error) {
    console.error('Error deleting wishlist item:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

