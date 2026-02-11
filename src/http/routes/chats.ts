import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getChats, getChatMessages, sendMessage, createChat, markChatAsRead } from '../../functions/chats'
import { verifyToken } from '../../functions/auth-utils'

export const chatsRoutes: FastifyPluginAsyncZod = async app => {
  app.get(
    '/',
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

      const result = await getChats(tokenResult.userId)

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
    '/:chat_id/messages',
    {
      schema: {
        params: z.object({
          chat_id: z.string().uuid('Invalid chat ID format'),
        }),
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

      const { chat_id } = request.params as { chat_id: string }
      const { page, limit } = request.query as { page?: number; limit?: number }

      const result = await getChatMessages(chat_id, tokenResult.userId, page || 1, limit || 50)

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
    '/:chat_id/messages',
    {
      schema: {
        params: z.object({
          chat_id: z.string().uuid('Invalid chat ID format'),
        }),
        body: z.object({
          text: z.string().min(1, 'Message text is required'),
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

      const { chat_id } = request.params as { chat_id: string }
      const { text } = request.body as { text: string }

      const result = await sendMessage(chat_id, tokenResult.userId, text)

      if (!result.success) {
        return reply.status(result.status).send({
          error: result.error,
          message: result.message,
        })
      }

      return reply.status(201).send(result.data)
    }
  )

  app.post(
    '/',
    {
      schema: {
        body: z.object({
          item_id: z.string().uuid('Invalid item ID format'),
          receiver_id: z.string().uuid('Invalid receiver ID format'),
          message: z.string().min(1, 'Message is required'),
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

      const { item_id, receiver_id, message } = request.body as {
        item_id: string
        receiver_id: string
        message: string
      }

      const result = await createChat(tokenResult.userId, item_id, receiver_id, message)

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
    '/:chat_id/read',
    {
      schema: {
        params: z.object({
          chat_id: z.string().uuid('Invalid chat ID format'),
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

      const { chat_id } = request.params as { chat_id: string }

      const result = await markChatAsRead(chat_id, tokenResult.userId)

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

