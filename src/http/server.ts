import fastify from 'fastify'
import cors from '@fastify/cors'
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { env } from '../env'

import { authRoutes } from './routes/auth'
import { listingsRoutes } from './routes/listings'
import { profileRoutes } from './routes/profile'
import { favoritesRoutes } from './routes/favorites'
import { chatsRoutes } from './routes/chats'
import { exchangesRoutes } from './routes/exchanges'
import { usersRoutes } from './routes/users'

const app = fastify({
  logger: true,
  bodyLimit: 20 * 1024 * 1024, // 20MB (permite até 5 imagens em base64 no body)
})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

app.register(cors, {
  origin: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
})

app.register(authRoutes, { prefix: '/auth' })
app.register(listingsRoutes, { prefix: '/listings' })
app.register(profileRoutes, { prefix: '/profile' })
app.register(favoritesRoutes, { prefix: '/favorites' })
app.register(chatsRoutes, { prefix: '/chats' })
app.register(exchangesRoutes, { prefix: '/exchanges' })
app.register(usersRoutes, { prefix: '/users' })

app.listen({ port: env.PORT, host: '0.0.0.0' }).then(() => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`)
})

