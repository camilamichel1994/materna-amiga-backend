import { eq, and, desc, count, sql } from 'drizzle-orm'
import { db } from '../db'
import { reviews, users } from '../db/schema'

export async function getReviewsByUser(
  reviewedUserId: string,
  page = 1,
  limit = 10
) {
  try {
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, reviewedUserId))
      .limit(1)

    if (user.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'User not found',
      }
    }

    const offset = (page - 1) * limit

    const [reviewsList, totalResult, avgResult] = await Promise.all([
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          reviewerId: reviews.reviewerId,
          reviewerName: users.name,
          reviewerAvatarUrl: users.avatarUrl,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.reviewerId, users.id))
        .where(eq(reviews.reviewedUserId, reviewedUserId))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(reviews)
        .where(eq(reviews.reviewedUserId, reviewedUserId)),
      db
        .select({
          avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        })
        .from(reviews)
        .where(eq(reviews.reviewedUserId, reviewedUserId)),
    ])

    const total = totalResult[0]?.count || 0
    const averageRating = avgResult[0]?.avgRating
      ? Math.round(Number(avgResult[0].avgRating) * 10) / 10
      : 0

    const items = reviewsList.map(review => ({
      id: review.id,
      rating: Number.parseInt(review.rating.toString()),
      comment: review.comment,
      reviewer: {
        id: review.reviewerId,
        name: review.reviewerName,
        avatarUrl: review.reviewerAvatarUrl || null,
      },
      created_at: review.createdAt.toISOString(),
    }))

    return {
      success: true,
      status: 200,
      data: {
        items,
        averageRating,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    }
  } catch (error) {
    console.error('Error getting reviews:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function getReviewById(reviewId: string) {
  try {
    const result = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        reviewerId: reviews.reviewerId,
        reviewerName: users.name,
        reviewerAvatarUrl: users.avatarUrl,
        reviewedUserId: reviews.reviewedUserId,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.id, reviewId))
      .limit(1)

    if (result.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Review not found',
      }
    }

    const review = result[0]!

    return {
      success: true,
      status: 200,
      data: {
        id: review.id,
        rating: Number.parseInt(review.rating.toString()),
        comment: review.comment,
        reviewedUserId: review.reviewedUserId,
        reviewer: {
          id: review.reviewerId,
          name: review.reviewerName,
          avatarUrl: review.reviewerAvatarUrl || null,
        },
        created_at: review.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error getting review:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function createReview(
  reviewerId: string,
  reviewedUserId: string,
  rating: number,
  comment = ''
) {
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
        message: 'Cannot review yourself',
      }
    }

    const reviewedUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, reviewedUserId))
      .limit(1)

    if (reviewedUser.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Reviewed user not found',
      }
    }

    const existing = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(
          eq(reviews.reviewerId, reviewerId),
          eq(reviews.reviewedUserId, reviewedUserId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return {
        success: false,
        status: 409,
        error: 'Conflict',
        message: 'You have already reviewed this user',
      }
    }

    const result = await db
      .insert(reviews)
      .values({
        reviewerId,
        reviewedUserId,
        rating: rating.toString(),
        comment,
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
    console.error('Error creating review:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function updateReview(
  reviewId: string,
  userId: string,
  data: { rating?: number; comment?: string }
) {
  try {
    const existing = await db
      .select({
        id: reviews.id,
        reviewerId: reviews.reviewerId,
      })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1)

    if (existing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Review not found',
      }
    }

    if (existing[0]!.reviewerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You can only edit your own reviews',
      }
    }

    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Rating must be between 1 and 5',
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.rating !== undefined) updateData['rating'] = data.rating.toString()
    if (data.comment !== undefined) updateData['comment'] = data.comment

    const result = await db
      .update(reviews)
      .set(updateData)
      .where(eq(reviews.id, reviewId))
      .returning({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
      })

    return {
      success: true,
      status: 200,
      data: {
        id: result[0]!.id,
        rating: Number.parseInt(result[0]!.rating),
        comment: result[0]!.comment,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error updating review:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function deleteReview(reviewId: string, userId: string) {
  try {
    const existing = await db
      .select({
        id: reviews.id,
        reviewerId: reviews.reviewerId,
      })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1)

    if (existing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Review not found',
      }
    }

    if (existing[0]!.reviewerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You can only delete your own reviews',
      }
    }

    await db.delete(reviews).where(eq(reviews.id, reviewId))

    return {
      success: true,
      status: 200,
      message: 'Review deleted successfully',
    }
  } catch (error) {
    console.error('Error deleting review:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}
