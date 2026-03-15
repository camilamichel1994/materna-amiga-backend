import { Resend } from 'resend'
import { env } from '../env'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

interface SendPasswordResetEmailInput {
  to: string
  resetToken: string
}

export async function sendPasswordResetEmail({ to, resetToken }: SendPasswordResetEmailInput) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`

  if (!resend) {
    console.warn('RESEND_API_KEY not configured — logging reset link instead')
    console.log(`Password reset link for ${to}: ${resetUrl}`)
    return
  }

  const { data, error } = await resend.emails.send({
    from: 'Materna Amiga <onboarding@resend.dev>',
    to,
    subject: 'Redefinição de senha - Materna Amiga',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #6A5ACD;">Materna Amiga</h2>
        <p>Olá!</p>
        <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
        <a
          href="${resetUrl}"
          style="display: inline-block; background-color: #6A5ACD; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;"
        >
          Redefinir senha
        </a>
        <p style="color: #666; font-size: 14px;">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
        <p style="color: #666; font-size: 14px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${resetUrl}</p>
      </div>
    `,
  })

  if (error) {
    console.error('Failed to send password reset email:', error)
    throw new Error(`Failed to send password reset email: ${error.message}`)
  }

  console.log('Password reset email sent:', data?.id)
}
