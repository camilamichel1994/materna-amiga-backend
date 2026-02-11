import { eq, and, desc, inArray } from 'drizzle-orm'
import { db } from '../db'
import { favorites, listings } from '../db/schema'

export async function getFavorites(userId: string) {
  try {
    const favoritesList = await db
      .select({
        id: favorites.id,
        listingId: favorites.listingId,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt))

    if (favoritesList.length === 0) {
      return {
        success: true,
        status: 200,
        data: { items: [] },
      }
    }

    const listingIds = favoritesList.map(fav => fav.listingId)

    const listingsData = await db
      .select({
        id: listings.id,
        name: listings.name,
        price: listings.price,
        photos: listings.photos,
        city: listings.city,
      })
      .from(listings)
      .where(inArray(listings.id, listingIds))

    const listingsMap = new Map(listingsData.map(listing => [listing.id, listing]))

    const items = favoritesList.map(favorite => {
      const listing = listingsMap.get(favorite.listingId)
      
      if (!listing) {
        return null
      }

      return {
        id: favorite.id,
        item: {
          id: listing.id,
          name: listing.name,
          price: listing.price ? Number.parseFloat(listing.price) : null,
          images: listing.photos,
          location: listing.city,
        },
        created_at: favorite.createdAt.toISOString(),
      }
    }).filter(item => item !== null) as Array<{
      id: string
      item: {
        id: string
        name: string
        price: number | null
        images: string[]
        location: string | null
      }
      created_at: string
    }>

    return {
      success: true,
      status: 200,
      data: { items },
    }
  } catch (error) {
    console.error('Error getting favorites:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function addFavorite(userId: string, listingId: string) {
  try {
    const listing = await db
      .select({ id: listings.id })
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

    const existing = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)))
      .limit(1)

    if (existing.length > 0) {
      return {
        success: false,
        status: 409,
        error: 'Conflict',
        message: 'Listing already in favorites',
      }
    }

    const result = await db
      .insert(favorites)
      .values({
        userId,
        listingId,
      })
      .returning({
        id: favorites.id,
        createdAt: favorites.createdAt,
      })

    return {
      success: true,
      status: 201,
      data: {
        id: result[0]!.id,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error adding favorite:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function removeFavorite(userId: string, listingId: string) {
  try {
    const result = await db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)))
      .returning({ id: favorites.id })

    if (result.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Favorite not found',
      }
    }

    return {
      success: true,
      status: 200,
      message: 'Favorite removed successfully',
    }
  } catch (error) {
    console.error('Error removing favorite:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

