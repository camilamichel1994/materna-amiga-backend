import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { listings, listingConditions, listingTypes, type ListingCondition, type ListingType, users, reviews } from '../db/schema'

function handleListingError(error: unknown, context: string): { status: number; error: string; message: string } {
  console.error(`Error ${context}:`, error)
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('listing_type') && (msg.includes('does not exist') || msg.includes('column'))) {
    return {
      status: 503,
      error: 'ServiceUnavailable',
      message: 'Banco de dados desatualizado. Execute: yarn migrate',
    }
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('connection') || msg.includes('connect')) {
    return {
      status: 503,
      error: 'ServiceUnavailable',
      message: 'Banco de dados indisponível. Verifique se o PostgreSQL está rodando.',
    }
  }
  if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
    return {
      status: 400,
      error: 'ValidationError',
      message: 'Referência inválida (ex.: usuário não encontrado).',
    }
  }
  return {
    status: 500,
    error: 'ServerError',
    message: 'Erro interno. Tente novamente ou verifique os logs do servidor.',
  }
}

interface CreateListingInput {
  name: string
  description: string
  condition: string
  listingType: 'venda' | 'doacao' | 'troca'
  price?: number
  message?: string
  city?: string
  photos: string[]
  ownerId: string
}

export async function createListing(data: CreateListingInput) {
  if (data.name.length < 5) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Name must be at least 5 characters',
    }
  }

  if (data.name.length > 100) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Name must be at most 100 characters',
    }
  }

  if (data.description.length < 20) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Description must be at least 20 characters',
    }
  }

  if (data.description.length > 500) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Description must be at most 500 characters',
    }
  }

  if (!listingConditions.includes(data.condition as ListingCondition)) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Condition value is not allowed',
    }
  }

  if (!listingTypes.includes(data.listingType as ListingType)) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'listingType must be one of: venda, doacao, troca',
    }
  }

  if (data.listingType === 'venda') {
    if (data.price === undefined || data.price === null) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Preço é obrigatório para anúncios de venda',
      }
    }
    if (data.price <= 0) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Price must be a positive number',
      }
    }
  } else {
    if (data.price !== undefined && data.price !== null) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Preço não deve ser informado para doação ou troca',
      }
    }
  }

  if (data.message && data.message.length > 300) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Message must be at most 300 characters',
    }
  }

  if (data.photos.length < 1) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Pelo menos uma foto é obrigatória',
    }
  }
  if (data.photos.length > 5) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Máximo de 5 fotos por anúncio',
    }
  }

  try {
    const result = await db
      .insert(listings)
      .values({
        name: data.name,
        description: data.description,
        condition: data.condition as ListingCondition,
        listingType: data.listingType as ListingType,
        price: data.listingType === 'venda' && data.price != null ? data.price.toString() : null,
        message: data.message,
        city: data.city,
        photos: data.photos,
        ownerId: data.ownerId,
      })
      .returning({
        id: listings.id,
        name: listings.name,
        description: listings.description,
        condition: listings.condition,
        listingType: listings.listingType,
        price: listings.price,
        message: listings.message,
        city: listings.city,
        photos: listings.photos,
        ownerId: listings.ownerId,
        createdAt: listings.createdAt,
      })

    const listing = result[0]!

    return {
      success: true,
      status: 201,
      data: {
        id: listing.id,
        name: listing.name,
        description: listing.description,
        condition: listing.condition,
        listingType: listing.listingType,
        price: listing.price ? Number.parseFloat(listing.price) : null,
        message: listing.message,
        city: listing.city,
        photos: listing.photos,
        ownerId: listing.ownerId,
        createdAt: listing.createdAt.toISOString(),
      },
    }
  } catch (error) {
    const { status, error: err, message } = handleListingError(error, 'creating listing')
    return { success: false, status, error: err, message }
  }
}

const allowedSortBy = ['createdAt', 'price', 'rating'] as const
type SortByField = (typeof allowedSortBy)[number]

const allowedSortOrder = ['asc', 'desc'] as const
type SortOrder = (typeof allowedSortOrder)[number]

interface GetListingsInput {
  q?: string
  ownerId?: string
  condition?: string
  /** Um ou mais tipos separados por vírgula: venda, doacao, troca */
  listingType?: string
  priceMin?: number
  priceMax?: number
  city?: string
  sortBy?: string
  sortOrder?: string
  page?: number
  limit?: number
}

export async function getListings(params: GetListingsInput) {
  if (params.sortBy && !allowedSortBy.includes(params.sortBy as SortByField)) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Invalid value for sortBy parameter. Allowed values are: createdAt, price, rating',
    }
  }

  if (params.sortOrder && !allowedSortOrder.includes(params.sortOrder as SortOrder)) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Invalid value for sortOrder parameter. Allowed values are: asc, desc',
    }
  }

  if (params.priceMin !== undefined && params.priceMin < 0) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'priceMin must be a positive number',
    }
  }

  if (params.priceMax !== undefined && params.priceMax < 0) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'priceMax must be a positive number',
    }
  }

  const page = params.page || 1
  const limit = params.limit || 12
  const offset = (page - 1) * limit
  const sortBy = (params.sortBy as SortByField) || 'createdAt'
  const sortOrder = (params.sortOrder as SortOrder) || 'desc'

  try {
    const filters = []

    if (params.q) {
      filters.push(
        or(
          ilike(listings.name, `%${params.q}%`),
          ilike(listings.description, `%${params.q}%`)
        )
      )
    }

    if (params.ownerId) {
      filters.push(eq(listings.ownerId, params.ownerId))
    }

    if (params.condition) {
      const conditions = params.condition.split(',').map(c => c.trim()) as ListingCondition[]
      filters.push(inArray(listings.condition, conditions))
    }

    if (params.listingType) {
      const types = params.listingType
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => listingTypes.includes(t as ListingType)) as ListingType[]
      if (types.length > 0) {
        filters.push(inArray(listings.listingType, types))
      }
    }

    if (params.priceMin !== undefined) {
      filters.push(gte(sql`CAST(${listings.price} AS DECIMAL)`, params.priceMin))
    }

    if (params.priceMax !== undefined) {
      filters.push(lte(sql`CAST(${listings.price} AS DECIMAL)`, params.priceMax))
    }

    if (params.city) {
      filters.push(ilike(listings.city, `%${params.city}%`))
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined

    const getSortColumn = () => {
      switch (sortBy) {
        case 'price':
          return sql`CAST(${listings.price} AS DECIMAL)`
        case 'rating':
          return sql`CAST(${listings.rating} AS DECIMAL)`
        default:
          return listings.createdAt
      }
    }

    const sortColumn = getSortColumn()
    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)

    const countResult = await db
      .select({ total: count() })
      .from(listings)
      .where(whereClause)

    const total = countResult[0]?.total || 0

    const result = await db
      .select({
        id: listings.id,
        name: listings.name,
        description: listings.description,
        condition: listings.condition,
        listingType: listings.listingType,
        price: listings.price,
        city: listings.city,
        photos: listings.photos,
        rating: listings.rating,
        ownerId: listings.ownerId,
        createdAt: listings.createdAt,
      })
      .from(listings)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    const data = result.map(listing => ({
      id: listing.id,
      name: listing.name,
      description: listing.description,
      condition: listing.condition,
      listingType: listing.listingType,
      price: listing.price ? Number.parseFloat(listing.price) : null,
      city: listing.city,
      photos: listing.photos,
      rating: listing.rating ? Number.parseFloat(listing.rating) : 0,
      ownerId: listing.ownerId,
      createdAt: listing.createdAt.toISOString(),
    }))

    return {
      success: true,
      status: 200,
      data: {
        data,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    }
  } catch (error) {
    const { status, error: err, message } = handleListingError(error, 'getting listings')
    return { success: false, status, error: err, message }
  }
}

export async function getListingById(listingId: string) {
  try {
    const result = await db
      .select({
        id: listings.id,
        name: listings.name,
        description: listings.description,
        condition: listings.condition,
        listingType: listings.listingType,
        price: listings.price,
        message: listings.message,
        city: listings.city,
        photos: listings.photos,
        rating: listings.rating,
        ownerId: listings.ownerId,
        createdAt: listings.createdAt,
        updatedAt: listings.updatedAt,
        owner: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          location: users.location,
          rating: sql<number>`COALESCE(
            (SELECT AVG(CAST(${reviews.rating} AS DECIMAL))
             FROM ${reviews}
             WHERE ${reviews.reviewedUserId} = ${users.id}), 0
          )`.as('rating'),
        },
      })
      .from(listings)
      .innerJoin(users, eq(listings.ownerId, users.id))
      .where(eq(listings.id, listingId))
      .limit(1)

    if (result.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Listing not found',
      }
    }

    const listing = result[0]!

    const ownerReviews = await db
      .select({
        id: reviews.id,
        reviewerId: reviews.reviewerId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        reviewer: {
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.reviewedUserId, listing.ownerId))
      .orderBy(desc(reviews.createdAt))
      .limit(10)

    const reviewsData = ownerReviews.map(review => ({
      id: review.id,
      user: {
        name: review.reviewer.name,
        avatarUrl: review.reviewer.avatarUrl,
      },
      rating: Number.parseFloat(review.rating),
      comment: review.comment,
      created_at: review.createdAt.toISOString(),
    }))

    return {
      success: true,
      status: 200,
      data: {
        id: listing.id,
        name: listing.name,
        description: listing.description,
        listingType: listing.listingType,
        price: listing.price ? Number.parseFloat(listing.price) : null,
        state: listing.condition,
        images: listing.photos,
        seller: {
          id: listing.owner.id,
          name: listing.owner.name,
          avatar_url: listing.owner.avatarUrl,
          location: listing.owner.location,
          rating: Number.parseFloat(String(listing.owner.rating || '0')),
        },
        location: listing.city,
        rating: listing.rating ? Number.parseFloat(listing.rating) : 0,
        reviews: reviewsData,
        created_at: listing.createdAt.toISOString(),
        updated_at: listing.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    const { status, error: err, message } = handleListingError(error, 'getting listing by id')
    return { success: false, status, error: err, message }
  }
}

export async function updateListing(
  listingId: string,
  userId: string,
  data: Partial<CreateListingInput>
) {
  try {
    const existingListing = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1)

    if (existingListing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Listing not found',
      }
    }

    if (existingListing[0]!.ownerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have permission to update this listing',
      }
    }

    if (data.name !== undefined) {
      if (data.name.length < 5 || data.name.length > 100) {
        return {
          success: false,
          status: 400,
          error: 'ValidationError',
          message: 'Name must be between 5 and 100 characters',
        }
      }
    }

    if (data.description !== undefined) {
      if (data.description.length < 20 || data.description.length > 500) {
        return {
          success: false,
          status: 400,
          error: 'ValidationError',
          message: 'Description must be between 20 and 500 characters',
        }
      }
    }

    if (data.condition !== undefined) {
      if (!listingConditions.includes(data.condition as ListingCondition)) {
        return {
          success: false,
          status: 400,
          error: 'ValidationError',
          message: 'Condition value is not allowed',
        }
      }
    }

    if (data.listingType !== undefined) {
      if (!listingTypes.includes(data.listingType as ListingType)) {
        return {
          success: false,
          status: 400,
          error: 'ValidationError',
          message: 'listingType must be one of: venda, doacao, troca',
        }
      }
    }

    if (data.listingType === 'venda' && (data.price === undefined || data.price === null)) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Preço é obrigatório para anúncios de venda',
      }
    }
    if (data.listingType === 'venda' && data.price !== undefined && data.price !== null && data.price <= 0) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Price must be a positive number',
      }
    }
    if ((data.listingType === 'doacao' || data.listingType === 'troca') && data.price !== undefined && data.price !== null) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Preço não deve ser informado para doação ou troca',
      }
    }
    if (data.price !== undefined && data.price !== null && data.price <= 0) {
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Price must be a positive number',
      }
    }

    if (data.photos !== undefined) {
      if (data.photos.length < 1) {
        return {
          success: false,
          status: 400,
          error: 'ValidationError',
          message: 'Pelo menos uma foto é obrigatória',
        }
      }
      if (data.photos.length > 5) {
        return {
          success: false,
          status: 400,
          error: 'ValidationError',
          message: 'Máximo de 5 fotos por anúncio',
        }
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updateData['name'] = data.name
    if (data.description !== undefined) updateData['description'] = data.description
    if (data.condition !== undefined) updateData['condition'] = data.condition
    if (data.listingType !== undefined) updateData['listingType'] = data.listingType
    if (data.listingType === 'doacao' || data.listingType === 'troca') {
      updateData['price'] = null
    } else if (data.price !== undefined) {
      updateData['price'] = data.price.toString()
    }
    if (data.message !== undefined) updateData['message'] = data.message
    if (data.city !== undefined) updateData['city'] = data.city
    if (data.photos !== undefined) updateData['photos'] = data.photos

    const result = await db
      .update(listings)
      .set(updateData as typeof listings.$inferInsert)
      .where(eq(listings.id, listingId))
      .returning({
        id: listings.id,
        name: listings.name,
        description: listings.description,
        condition: listings.condition,
        listingType: listings.listingType,
        price: listings.price,
        message: listings.message,
        city: listings.city,
        photos: listings.photos,
        ownerId: listings.ownerId,
        createdAt: listings.createdAt,
        updatedAt: listings.updatedAt,
      })

    const listing = result[0]!

    return {
      success: true,
      status: 200,
      data: {
        id: listing.id,
        name: listing.name,
        description: listing.description,
        condition: listing.condition,
        listingType: listing.listingType,
        price: listing.price ? Number.parseFloat(listing.price) : null,
        message: listing.message,
        city: listing.city,
        images: listing.photos,
        ownerId: listing.ownerId,
        created_at: listing.createdAt.toISOString(),
        updated_at: listing.updatedAt.toISOString(),
      },
    }
  } catch (error) {
    const { status, error: err, message } = handleListingError(error, 'updating listing')
    return { success: false, status, error: err, message }
  }
}

export async function deleteListing(listingId: string, userId: string) {
  try {
    const existingListing = await db
      .select({
        id: listings.id,
        ownerId: listings.ownerId,
      })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1)

    if (existingListing.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Item not found',
      }
    }

    if (existingListing[0]!.ownerId !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have permission to delete this listing',
      }
    }

    await db.delete(listings).where(eq(listings.id, listingId))

    return {
      success: true,
      status: 200,
      message: 'Item deleted successfully',
    }
  } catch (error) {
    const { status, error: err, message } = handleListingError(error, 'deleting listing')
    return { success: false, status, error: err, message }
  }
}

export async function getSimilarListings(listingId: string, limit: number = 5) {
  try {
    const listing = await db
      .select({
        id: listings.id,
        name: listings.name,
        condition: listings.condition,
        city: listings.city,
        ownerId: listings.ownerId,
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

    const currentListing = listing[0]!

    const similar = await db
      .select({
        id: listings.id,
        name: listings.name,
        listingType: listings.listingType,
        price: listings.price,
        photos: listings.photos,
        city: listings.city,
      })
      .from(listings)
      .where(
        and(
          ne(listings.id, listingId),
          eq(listings.condition, currentListing.condition),
          currentListing.city ? eq(listings.city, currentListing.city) : undefined,
          ne(listings.ownerId, currentListing.ownerId)
        )
      )
      .limit(limit)

    const items = similar.map(item => ({
      id: item.id,
      name: item.name,
      listingType: item.listingType,
      price: item.price ? Number.parseFloat(item.price) : null,
      images: item.photos,
      location: item.city,
    }))

    return {
      success: true,
      status: 200,
      data: { items },
    }
  } catch (error) {
    const { status, error: err, message } = handleListingError(error, 'getting similar listings')
    return { success: false, status, error: err, message }
  }
}
