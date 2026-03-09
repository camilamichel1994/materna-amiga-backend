import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { createListing, getListings, getListingById, updateListing, deleteListing, getSimilarListings } from '../../functions/listings'
import { verifyToken } from '../../functions/auth-utils'
import { listingConditions } from '../../db/schema'

export const listingsRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/',
    {
      schema: {
        querystring: z.object({
          q: z.string().optional(),
          ownerId: z.string().optional(),
          condition: z.string().optional(),
          listingType: z.string().optional(), // ex: "venda" ou "doacao,troca" (filtrar por doação, troca ou venda)
          priceMin: z.coerce.number().optional(),
          priceMax: z.coerce.number().optional(),
          city: z.string().optional(),
          sortBy: z.string().optional(),
          sortOrder: z.string().optional(),
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { q, ownerId, condition, listingType, priceMin, priceMax, city, sortBy, sortOrder, page, limit } =
        request.query as {
          q?: string
          ownerId?: string
          condition?: string
          listingType?: string
          priceMin?: number
          priceMax?: number
          city?: string
          sortBy?: string
          sortOrder?: string
          page?: number
          limit?: number
        }

      const result = await getListings({
        q,
        ownerId,
        condition,
        listingType,
        priceMin,
        priceMax,
        city,
        sortBy,
        sortOrder,
        page,
        limit,
      })

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(200).send(result.data)
    }
  )

  app.post(
    '/',
    {
      schema: {
        body: z.object({
          name: z
            .string()
            .min(5, 'Name must be at least 5 characters')
            .max(100, 'Name must be at most 100 characters'),
          description: z
            .string()
            .min(20, 'Description must be at least 20 characters')
            .max(500, 'Description must be at most 500 characters'),
          condition: z.enum(['Novo', 'Usado - Excelente', 'Usado - Bom', 'Usado - Regular'] as [string, ...string[]], {
            message: 'Condition value is not allowed. Allowed values: Novo, Usado - Excelente, Usado - Bom, Usado - Regular',
          }),
          listingType: z.enum(['venda', 'doacao', 'troca'], {
            message: 'listingType must be one of: venda (vender), doacao (doar), troca (trocar)',
          }),
          price: z.number().positive('Price must be a positive number').optional(),
          message: z.string().max(300, 'Message must be at most 300 characters').optional(),
          city: z.string().max(100, 'City must be at most 100 characters').optional(),
          photos: z
            .array(z.string())
            .min(1, 'Pelo menos uma foto é obrigatória')
            .max(5, 'Máximo de 5 fotos por anúncio'),
        }),
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        })
      }

      const token = authHeader.substring(7)
      const tokenResult = verifyToken(token)

      if (!tokenResult.valid) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        })
      }

      const { name, description, condition, listingType, price, message, city, photos } = request.body as {
        name: string
        description: string
        condition: string
        listingType: 'venda' | 'doacao' | 'troca'
        price?: number
        message?: string
        city?: string
        photos: string[]
      }

      const result = await createListing({
        name,
        description,
        condition,
        listingType,
        price,
        message,
        city,
        photos,
        ownerId: tokenResult.userId,
      })

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(201).send(result.data)
    }
  )

  app.get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid listing ID format'),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = await getListingById(id)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(200).send(result.data)
    }
  )

  app.put(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid listing ID format'),
        }),
        body: z.object({
          name: z.string().min(5).max(100).optional(),
          description: z.string().min(20).max(500).optional(),
          condition: z.enum(['Novo', 'Usado - Excelente', 'Usado - Bom', 'Usado - Regular'] as [string, ...string[]], {
            message: 'Condition value is not allowed. Allowed values: Novo, Usado - Excelente, Usado - Bom, Usado - Regular',
          }).optional(),
          listingType: z.enum(['venda', 'doacao', 'troca'], {
            message: 'listingType must be one of: venda, doacao, troca',
          }).optional(),
          price: z.number().positive().optional(),
          message: z.string().max(300).optional(),
          city: z.string().max(100).optional(),
          photos: z.array(z.string()).min(1).max(5, 'Máximo de 5 fotos por anúncio').optional(),
        }),
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        })
      }

      const token = authHeader.substring(7)
      const tokenResult = verifyToken(token)

      if (!tokenResult.valid) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        })
      }

      const { id } = request.params as { id: string }
      const body = request.body as any

      const result = await updateListing(id, tokenResult.userId, body)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(200).send(result.data)
    }
  )

  app.delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid listing ID format'),
        }),
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        })
      }

      const token = authHeader.substring(7)
      const tokenResult = verifyToken(token)

      if (!tokenResult.valid) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        })
      }

      const { id } = request.params as { id: string }

      const result = await deleteListing(id, tokenResult.userId)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(200).send({
        message: result.message,
      })
    }
  )

  app.get(
    '/:id/similar',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid listing ID format'),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = await getSimilarListings(id)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(200).send(result.data)
    }
  )
}

