import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  getTransactionsByUser,
  getTransactionById,
  createTransaction,
  deleteTransaction,
} from '../../functions/transactions'
import { verifyToken } from '../../functions/auth-utils'

export const transactionsRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/',
    {
      schema: {
        querystring: z.object({
          page: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().positive().max(100).optional(),
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

      const { page, limit } = request.query as {
        page?: number
        limit?: number
      }

      const result = await getTransactionsByUser(tokenResult.userId, page, limit)

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
          id: z.string().uuid('Invalid transaction ID format'),
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

      const result = await getTransactionById(id, tokenResult.userId)

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
          listing_id: z.string().uuid('Invalid listing ID format'),
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

      const { listing_id } = request.body as { listing_id: string }

      const result = await createTransaction(tokenResult.userId, listing_id)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(201).send(result.data)
    }
  )

  app.delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid('Invalid transaction ID format'),
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

      const result = await deleteTransaction(id, tokenResult.userId)

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
