import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

type BookingRow = {
  id: string
  status: string
  stripe_payment_intent_id: string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!(profile as any)?.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const bookingId: unknown = body?.bookingId
  if (typeof bookingId !== 'string' || bookingId.length === 0) {
    return NextResponse.json({ error: 'bookingId required' }, { status: 400 })
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status, stripe_payment_intent_id')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'booking not found' }, { status: 404 })
  }

  const row = booking as unknown as BookingRow

  if (row.status !== 'confirmed' && row.status !== 'paid') {
    return NextResponse.json({ error: 'booking not refundable' }, { status: 409 })
  }

  if (!row.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'no payment intent linked' }, { status: 409 })
  }

  // Fetch all bookings sharing this PaymentIntent so the caller can see
  // exactly what will be refunded. Stripe refunds the entire PI; the
  // charge.refunded webhook will then flip every linked booking to 'refunded'.
  const { data: related } = await supabase
    .from('bookings')
    .select('id')
    .eq('stripe_payment_intent_id', row.stripe_payment_intent_id)

  const affectedBookingIds = ((related ?? []) as Array<{ id: string }>).map((b) => b.id)

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: row.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          triggered_by: 'admin_ui',
          admin_id: user.id,
          booking_id: row.id,
        },
      },
      { idempotencyKey: `refund-${row.stripe_payment_intent_id}` },
    )

    return NextResponse.json({
      refundId: refund.id,
      status: refund.status,
      affectedBookingIds,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'stripe refund failed' },
      { status: 500 },
    )
  }
}
