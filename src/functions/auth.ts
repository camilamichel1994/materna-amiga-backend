import { eq, and, gt, isNull } from 'drizzle-orm'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import admin from 'firebase-admin'
import { db } from '../db'
import { users, passwordResetTokens } from '../db/schema'
import { env } from '../env'

interface SignupInput {
  name: string
  email: string
  password: string
  acceptTerms: boolean
}

interface LoginInput {
  email: string
  password: string
  remember?: boolean
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':') as [string, string]
  const hashBuffer = Buffer.from(hash, 'hex')
  const suppliedHashBuffer = scryptSync(password, salt, 64)
  return timingSafeEqual(hashBuffer, suppliedHashBuffer)
}

function generateToken(userId: string, expiresInDays: number): { token: string; expiresAt: Date } {
  const payload = {
    userId,
    iat: Date.now(),
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  }
  const token = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const expiresAt = new Date(payload.exp)
  return { token, expiresAt }
}

export async function signup(data: SignupInput) {
  if (!data.acceptTerms) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'You must accept the terms and conditions',
    }
  }

  const existingUser = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.email, data.email.toLowerCase()))

  if (existingUser.length > 0) {
    return {
      success: false,
      status: 409,
      error: 'Conflict',
      message: 'User already exists',
    }
  }

  const hashedPassword = hashPassword(data.password)

  const result = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      acceptedTermsAt: new Date(),
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })

  const user = result[0]!

  const { token } = generateToken(user.id, 7)

  return {
    success: true,
    status: 201,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      token,
    },
  }
}

export async function login(data: LoginInput) {
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      password: users.password,
    })
    .from(users)
    .where(eq(users.email, data.email.toLowerCase()))

  if (result.length === 0) {
    return {
      success: false,
      status: 404,
      error: 'UserNotFound',
      message: 'User not registered',
    }
  }

  const user = result[0]!

  if (!user.password) {
    return {
      success: false,
      status: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
    }
  }

  const isValidPassword = verifyPassword(data.password, user.password)

  if (!isValidPassword) {
    return {
      success: false,
      status: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
    }
  }

  const expiresInDays = data.remember ? 30 : 1
  const { token, expiresAt } = generateToken(user.id, expiresInDays)

  return {
    success: true,
    status: 200,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      token,
      expiresAt: expiresAt.toISOString(),
    },
  }
}

interface ForgotPasswordInput {
  email: string
}

interface ResetPasswordInput {
  token: string
  newPassword: string
}

function generateResetToken(): string {
  return randomBytes(32).toString('hex')
}

function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'A senha deve ter no mínimo 8 caracteres',
    }
  }

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

  if (!hasLetter || !hasNumber || !hasSymbol) {
    return {
      valid: false,
      message: 'A nova senha não atende aos requisitos de segurança',
    }
  }

  return { valid: true }
}

export async function forgotPassword(data: ForgotPasswordInput) {
  const user = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.email, data.email.toLowerCase()))
    .limit(1)

  if (user.length > 0) {
    const resetToken = generateResetToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    await db.insert(passwordResetTokens).values({
      userId: user[0]!.id,
      token: resetToken,
      expiresAt,
    })

    console.log(`Reset token for ${user[0]!.email}: ${resetToken}`)
  }

  return {
    success: true,
    status: 200,
    message: 'Se o e-mail estiver registrado, um link para redefinição de senha foi enviado.',
  }
}

export async function resetPassword(data: ResetPasswordInput) {
  const passwordValidation = validatePasswordStrength(data.newPassword)
  if (!passwordValidation.valid) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: passwordValidation.message,
    }
  }

  const tokenRecord = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, data.token),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1)

  if (tokenRecord.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'ValidationError',
      message: 'Token inválido ou expirado',
    }
  }

  const token = tokenRecord[0]!

  const hashedPassword = hashPassword(data.newPassword)
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, token.userId))

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, token.id))

  return {
    success: true,
    status: 200,
    message: 'Senha redefinida com sucesso.',
  }
}

let firebaseAdminInitialized = false

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return
  }

  const credPath = process.env['GOOGLE_APPLICATION_CREDENTIALS']

  if (credPath) {
    try {
      const absolutePath = path.isAbsolute(credPath)
        ? credPath
        : path.resolve(process.cwd(), credPath)
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] = absolutePath
      admin.initializeApp({ credential: admin.credential.applicationDefault() })
      firebaseAdminInitialized = true
      console.log('Firebase Admin inicializado com sucesso (arquivo JSON).')
    } catch (error) {
      console.error('Erro ao inicializar Firebase Admin com GOOGLE_APPLICATION_CREDENTIALS:', error)
      if (error instanceof Error) {
        console.error('Detalhes:', { message: error.message, stack: error.stack })
      }
    }
    return
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      })
      firebaseAdminInitialized = true
      console.log('Firebase Admin inicializado com sucesso. Project ID:', env.FIREBASE_PROJECT_ID)
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error)
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
        })
      }
    }
  } else {
    console.warn('Firebase Admin não configurado: variáveis de ambiente faltando', {
      hasProjectId: !!env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!env.FIREBASE_PRIVATE_KEY,
    })
  }
}

interface GoogleAuthInput {
  idToken: string
}

export async function googleAuth(data: GoogleAuthInput) {
  try {
    initializeFirebaseAdmin()

    if (!firebaseAdminInitialized) {
      console.error('Tentativa de autenticação Google sem Firebase Admin configurado')
      return {
        success: false,
        status: 500,
        error: 'ServerError',
        message: 'Firebase Admin não está configurado',
      }
    }

    if (!data.idToken || data.idToken.trim().length === 0) {
      console.warn('Tentativa de autenticação Google com idToken vazio')
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'ID token é obrigatório',
      }
    }

    let decodedToken
    try {
      decodedToken = await admin.auth().verifyIdToken(data.idToken)
      console.log('Token do Firebase verificado com sucesso. Email:', decodedToken.email)
    } catch (verifyError) {
      console.error('Erro ao verificar token do Firebase:', verifyError)
      if (verifyError instanceof Error) {
        // Log mais detalhado para ajudar no diagnóstico
        if (verifyError.message.includes('expired')) {
          console.error('Token expirado')
        } else if (verifyError.message.includes('invalid')) {
          console.error('Token inválido')
        } else if (verifyError.message.includes('project')) {
          console.error('Erro de projeto - verifique se o Project ID está correto')
        }
      }
      throw verifyError
    }

    if (!decodedToken.email) {
      console.warn('Token do Firebase não contém email. Decoded token:', {
        uid: decodedToken.uid,
        hasEmail: !!decodedToken.email,
        firebase: decodedToken.firebase,
      })
      return {
        success: false,
        status: 400,
        error: 'ValidationError',
        message: 'Token do Firebase não contém email',
      }
    }

    const email = decodedToken.email.toLowerCase()
    const name =
      (decodedToken as { name?: string }).name ||
      decodedToken.email.split('@')[0] ||
      'Usuário'
    const avatarUrl = (decodedToken as { picture?: string }).picture || null

    const existingUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    let user

    if (existingUser.length > 0) {
      user = existingUser[0]!

      if (avatarUrl && user.avatarUrl !== avatarUrl) {
        await db.update(users).set({ avatarUrl }).where(eq(users.id, user.id))
        user.avatarUrl = avatarUrl
      }
    } else {
      const result = await db
        .insert(users)
        .values({
          name,
          email,
          avatarUrl,
          acceptedTermsAt: new Date(),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })

      user = result[0]!
    }

    const expiresInDays = 30
    const { token, expiresAt } = generateToken(user.id, expiresInDays)

    return {
      success: true,
      status: 200,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          createdAt: 'createdAt' in user ? user.createdAt : undefined,
        },
        expiresAt: expiresAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error in googleAuth:', error)

    if (error instanceof Error) {
      // Erros específicos do Firebase Admin
      if (error.message.includes('auth/') || error.message.includes('Firebase')) {
        console.error('Erro de autenticação Firebase:', {
          message: error.message,
          code: error.message.match(/auth\/[a-z-]+/)?.[0],
        })
        return {
          success: false,
          status: 401,
          error: 'Unauthorized',
          message: 'Token do Firebase inválido ou expirado',
        }
      }

      // Erros de validação de token
      if (error.message.includes('expired') || error.message.includes('Expired')) {
        return {
          success: false,
          status: 401,
          error: 'Unauthorized',
          message: 'Token do Firebase expirado',
        }
      }

      if (error.message.includes('invalid') || error.message.includes('Invalid')) {
        return {
          success: false,
          status: 401,
          error: 'Unauthorized',
          message: 'Token do Firebase inválido',
        }
      }

      // Erros de projeto
      if (error.message.includes('project') || error.message.includes('Project')) {
        console.error('Erro de configuração do projeto Firebase')
        return {
          success: false,
          status: 500,
          error: 'ServerError',
          message: 'Erro de configuração do Firebase. Verifique o Project ID.',
        }
      }
    }

    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Ocorreu um erro inesperado no servidor',
    }
  }
}

export async function getMe(userId: string) {
  try {
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        location: users.location,
        babyAgeRange: users.babyAgeRange,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'User not found',
      }
    }

    return {
      success: true,
      status: 200,
      data: user[0]!,
    }
  } catch (error) {
    console.error('Error in getMe:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Ocorreu um erro inesperado no servidor',
    }
  }
}

export async function logout() {
  return {
    success: true,
    status: 200,
    message: 'Logout realizado com sucesso',
  }
}

