interface TokenPayload {
  userId: string
  iat: number
  exp: number
}

export function verifyToken(token: string): { valid: true; userId: string } | { valid: false } {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString()) as TokenPayload

    if (payload.exp < Date.now()) {
      return { valid: false }
    }

    return { valid: true, userId: payload.userId }
  } catch {
    return { valid: false }
  }
}



