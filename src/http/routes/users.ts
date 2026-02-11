import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { updateProfile, getUserItems, rateUser } from '../../functions/profile'
import { verifyToken } from '../../functions/auth-utils'

export const usersRoutes: FastifyPluginAsyncZod = async app => {
  app.put(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid user ID format'),
        }),
        body: z.object({
          name: z.string().min(2).optional(),
          location: z.string().optional(),
          baby_age_range: z.string().optional(),
          avatar_url: z.string().url().optional(),
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

      if (id !== tokenResult.userId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only update your own profile',
        })
      }

      const body = request.body as {
        name?: string
        location?: string
        baby_age_range?: string
        avatar_url?: string
      }

      const result = await updateProfile(id, {
        name: body.name,
        location: body.location,
        babyAgeRange: body.baby_age_range,
        avatarUrl: body.avatar_url,
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

  app.get(
    '/:id/items',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid user ID format'),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const result = await getUserItems(id)

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
    '/:id/ratings',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid user ID format'),
        }),
        body: z.object({
          rating: z.number().int().min(1).max(5),
          comment: z.string().optional(),
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
      const { rating, comment } = request.body as { rating: number; comment?: string }

      const result = await rateUser(tokenResult.userId, id, rating, comment)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(201).send(result.data)
    }
  )
}

