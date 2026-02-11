import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getAvailableExchanges, proposeExchange, getExchanges, updateExchangeStatus } from '../../functions/exchanges'
import { verifyToken } from '../../functions/auth-utils'

export const exchangesRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/available',
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

      const result = await getAvailableExchanges(tokenResult.userId)

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
          offered_item_id: z.string().uuid('Invalid item ID format'),
          requested_item_id: z.string().uuid('Invalid item ID format'),
          message: z.string().optional(),
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

      const { offered_item_id, requested_item_id, message } = request.body as {
        offered_item_id: string
        requested_item_id: string
        message?: string
      }

      const result = await proposeExchange(
        tokenResult.userId,
        offered_item_id,
        requested_item_id,
        message
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

  app.get(
    '/',
    {
      schema: {
        querystring: z.object({
          status: z.enum(['pending', 'accepted', 'rejected']).optional(),
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

      const { status } = request.query as { status?: string }

      const result = await getExchanges(tokenResult.userId, status)

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
          id: z.string().uuid('Invalid exchange ID format'),
        }),
        body: z.object({
          status: z.enum(['accepted', 'rejected']),
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
      const { status } = request.body as { status: 'accepted' | 'rejected' }

      const result = await updateExchangeStatus(id, tokenResult.userId, status)

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

