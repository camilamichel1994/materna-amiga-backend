import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getProfile } from '../../functions/profile'
import { verifyToken } from '../../functions/auth-utils'

export const profileRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid user ID format'),
        }),
        querystring: z.object({
          reviewsPage: z.coerce.number().int().positive().optional(),
          reviewsLimit: z.coerce.number().int().positive().max(100).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { reviewsPage, reviewsLimit } = request.query as {
        reviewsPage?: number
        reviewsLimit?: number
      }

      let currentUserId: string | undefined
      const authHeader = request.headers.authorization

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const tokenResult = verifyToken(token)

        if (tokenResult.valid) {
          currentUserId = tokenResult.userId
        }
      }

      const result = await getProfile({
        userId: id,
        currentUserId,
        reviewsPage,
        reviewsLimit,
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
}

