import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  getReviewsByUser,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
} from '../../functions/reviews'
import { verifyToken } from '../../functions/auth-utils'

export const reviewsRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/user/:userId',
    {
      schema: {
        params: z.object({
          userId: z.string().uuid('Invalid user ID format'),
        }),
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string }
      const { page, limit } = request.query as {
        page?: number
        limit?: number
      }

      const result = await getReviewsByUser(userId, page, limit)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(200).send(result.data)
    }
  )

  app.get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid review ID format'),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = await getReviewById(id)

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
          reviewed_user_id: z.string().uuid('Invalid user ID format'),
          rating: z.number().int().min(1).max(5),
          comment: z.string().optional().default(''),
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

      const { reviewed_user_id, rating, comment } = request.body as {
        reviewed_user_id: string
        rating: number
        comment: string
      }

      const result = await createReview(
        tokenResult.userId,
        reviewed_user_id,
        rating,
        comment
      )

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(201).send(result.data)
    }
  )

  app.put(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid review ID format'),
        }),
        body: z.object({
          rating: z.number().int().min(1).max(5).optional(),
          comment: z.string().min(1).optional(),
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
      const body = request.body as { rating?: number; comment?: string }

      const result = await updateReview(id, tokenResult.userId, body)

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
          id: z.string().uuid('Invalid review ID format'),
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

      const result = await deleteReview(id, tokenResult.userId)

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
}
