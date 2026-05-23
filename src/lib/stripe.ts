import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
})

// 70 / 15 / 15 split — system_amount catches the 1-cent rounding residue.
export function computeSplit(priceCents: number) {
  const teacher = Math.floor(priceCents * 0.70)
  const platform = Math.floor(priceCents * 0.15)
  const system = priceCents - teacher - platform
  return { teacher, platform, system }
}
