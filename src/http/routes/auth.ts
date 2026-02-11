import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { signup, login, forgotPassword, resetPassword, googleAuth, getMe, logout } from '../../functions/auth'
import { verifyToken } from '../../functions/auth-utils'

export const authRoutes: FastifyPluginAsyncZod = async app => {
  app.post(
    '/signup',
    {
      schema: {
        body: z.object({
          name: z.string().min(2, 'Name must be at least 2 characters'),
          email: z.string().email('Invalid email format'),
          password: z.string().min(6, 'Password must be at least 6 characters'),
          acceptTerms: z.boolean(),
        }),
      },
    },
    async (request, reply) => {
      const { name, email, password, acceptTerms } = request.body as {
        name: string
        email: string
        password: string
        acceptTerms: boolean
      }

      const result = await signup({ name, email, password, acceptTerms })

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
    '/login',
    {
      schema: {
        body: z.object({
          email: z.string().email('Invalid email format'),
          password: z.string().min(6, 'Password must be at least 6 characters'),
          remember: z.boolean().optional().default(false),
        }),
      },
    },
    async (request, reply) => {
      const { email, password, remember } = request.body as {
        email: string
        password: string
        remember?: boolean
      }

      const result = await login({ email, password, remember })

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
    '/forgot-password',
    {
      schema: {
        body: z.object({
          email: z.string().email('Email inválido'),
        }),
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string }

      const result = await forgotPassword({ email })

      return reply.status(200).send({
        message: result.message,
      })
    }
  )

  app.post(
    '/reset-password',
    {
      schema: {
        body: z.object({
          token: z.string().min(1, 'Token é obrigatório'),
          newPassword: z
            .string()
            .min(8, 'A senha deve ter no mínimo 8 caracteres')
            .regex(/[a-zA-Z]/, 'A senha deve conter pelo menos uma letra')
            .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
            .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'A senha deve conter pelo menos um símbolo'),
        }),
      },
    },
    async (request, reply) => {
      const { token, newPassword } = request.body as {
        token: string
        newPassword: string
      }

      const result = await resetPassword({ token, newPassword })

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

  app.post(
    '/google',
    {
      schema: {
        body: z.object({
          idToken: z.string().min(1, 'ID token é obrigatório'),
        }),
      },
    },
    async (request, reply) => {
      const { idToken } = request.body as { idToken: string }

      const result = await googleAuth({ idToken })

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
    '/me',
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

      const result = await getMe(tokenResult.userId)

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
    '/logout',
    async (request, reply) => {
      const authHeader = request.headers.authorization

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        })
      }

      const result = await logout()

      return reply.status(200).send({
        message: result.message,
      })
    }
  )
}

