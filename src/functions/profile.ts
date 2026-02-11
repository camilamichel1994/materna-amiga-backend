import { eq, desc, sql, count } from 'drizzle-orm'
import { db } from '../db'
import { users, listings, reviews, transactions } from '../db/schema'

interface GetProfileInput {
  userId: string
  currentUserId?: string
  reviewsPage?: number
  reviewsLimit?: number
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffDays === 0) {
    return 'hoje'
  } else if (diffDays === 1) {
    return '1 dia atrás'
  } else if (diffDays < 7) {
    return `${diffDays} dias atrás`
  } else if (diffWeeks === 1) {
    return '1 semana atrás'
  } else if (diffWeeks < 4) {
    return `${diffWeeks} semanas atrás`
  } else if (diffMonths === 1) {
    return '1 mês atrás'
  } else {
    return `${diffMonths} meses atrás`
  }
}

export async function getProfile(data: GetProfileInput) {
  const { userId, currentUserId, reviewsPage = 1, reviewsLimit = 5 } = data

  try {
    const userResult = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (userResult.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: `User with ID ${userId} not found`,
      }
    }

    const userRow = userResult[0]!

    const user = {
      id: userRow.id,
      name: userRow.name,
      avatarUrl: null as string | null,
      location: null as string | null,
      babyAgeRange: null as string | null,
    }

    let averageRating = 0
    let itemsSold = 0
    let itemsBought = 0

    try {
      const avgRatingResult = await db
        .select({
          avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        })
        .from(reviews)
        .where(eq(reviews.reviewedUserId, userId))

      averageRating = avgRatingResult[0]?.avgRating
        ? Number(avgRatingResult[0].avgRating)
        : 0
    } catch (error) {
      console.log('Reviews table not available, using default rating:', error instanceof Error ? error.message : 'unknown error')
      averageRating = 0
    }

    try {
      const itemsSoldResult = await db
        .select({ count: count() })
        .from(transactions)
        .where(eq(transactions.sellerId, userId))

      itemsSold = itemsSoldResult[0]?.count || 0
    } catch (error) {
      console.log('Transactions table not available for itemsSold, using default:', error instanceof Error ? error.message : 'unknown error')
      itemsSold = 0
    }

    try {
      const itemsBoughtResult = await db
        .select({ count: count() })
        .from(transactions)
        .where(eq(transactions.buyerId, userId))

      itemsBought = itemsBoughtResult[0]?.count || 0
    } catch (error) {
      console.log('Transactions table not available for itemsBought, using default:', error instanceof Error ? error.message : 'unknown error')
      itemsBought = 0
    }

    let formattedReviews: Array<{
      id: string
      reviewerName: string
      comment: string
      rating: number
      date: string
    }> = []
    let totalReviews = 0
    let reviewsPages = 0

    try {
      const reviewsOffset = (reviewsPage - 1) * reviewsLimit

      const reviewsResult = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          reviewerId: reviews.reviewerId,
          reviewerName: users.name,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.reviewerId, users.id))
        .where(eq(reviews.reviewedUserId, userId))
        .orderBy(desc(reviews.createdAt))
        .limit(reviewsLimit)
        .offset(reviewsOffset)

      const totalReviewsResult = await db
        .select({ count: count() })
        .from(reviews)
        .where(eq(reviews.reviewedUserId, userId))

      totalReviews = totalReviewsResult[0]?.count || 0
      reviewsPages = Math.ceil(totalReviews / reviewsLimit)

      formattedReviews = reviewsResult.map(review => ({
        id: review.id,
        reviewerName: review.reviewerName,
        comment: review.comment,
        rating: Number.parseInt(review.rating.toString()),
        date: formatRelativeTime(review.createdAt),
      }))
    } catch (error) {
      console.log('Reviews table not available, using empty array:', error instanceof Error ? error.message : 'unknown error')
      formattedReviews = []
      totalReviews = 0
      reviewsPages = 0
    }

    const isCurrentUser = currentUserId === userId

    return {
      success: true,
      status: 200,
      data: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl || null,
        location: user.location || null,
        babyAgeRange: user.babyAgeRange || null,
        stats: {
          averageRating: Math.round(averageRating * 10) / 10,
          itemsSold,
          itemsBought,
        },
        isCurrentUser,
        reviews: formattedReviews,
        reviewsMeta: {
          totalReviews,
          reviewsPage,
          reviewsLimit,
          reviewsPages,
        },
      },
    }
  } catch (error) {
    console.error('Error getting profile:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}


export async function updateProfile(userId: string, data: { name?: string; location?: string; babyAgeRange?: string; avatarUrl?: string }) {
  try {
    const updateData: any = { updatedAt: new Date() }
    if (data.name !== undefined) updateData.name = data.name
    if (data.location !== undefined) updateData.location = data.location
    if (data.babyAgeRange !== undefined) updateData.babyAgeRange = data.babyAgeRange
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        location: users.location,
        babyAgeRange: users.babyAgeRange,
        createdAt: users.createdAt,
      })

    return {
      success: true,
      status: 200,
      data: result[0]!,
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function getUserItems(userId: string) {
  try {
    const result = await db
      .select({
        id: listings.id,
        name: listings.name,
        price: listings.price,
        photos: listings.photos,
        condition: listings.condition,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(eq(listings.ownerId, userId))
      .orderBy(desc(listings.createdAt))

    const items = result.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price ? Number.parseFloat(item.price) : null,
      images: item.photos,
      state: item.condition,
      created_at: item.createdAt.toISOString(),
    }))

    return {
      success: true,
      status: 200,
      data: { items },
    }
  } catch (error) {
    console.error('Error getting user items:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function rateUser(reviewerId: string, reviewedUserId: string, rating: number, comment?: string) {
  try {
    if (rating < 1 || rating > 5) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Rating must be between 1 and 5',
      }
    }

    if (reviewerId === reviewedUserId) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Cannot rate yourself',
      }
    }

    const result = await db
      .insert(reviews)
      .values({
        reviewerId,
        reviewedUserId,
        rating: rating.toString(),
        comment: comment || '',
      })
      .returning({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
      })

    return {
      success: true,
      status: 201,
      data: {
        id: result[0]!.id,
        rating: Number.parseInt(result[0]!.rating),
        comment: result[0]!.comment,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error rating user:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}
