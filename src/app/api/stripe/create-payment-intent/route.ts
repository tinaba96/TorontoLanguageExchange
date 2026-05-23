import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, computeSplit } from '@/lib/stripe'

type BookingRow = {
  id: string
  student_id: string
  teacher_id: string
  price_at_booking: number
  status: string
  stripe_payment_intent_id: string | null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const bookingIds: unknown = body?.bookingIds
  if (!Array.isArray(bookingIds) || bookingIds.length === 0 || !bookingIds.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'bookingIds required' }, { status: 400 })
  }

  // RLS will already restrict to the caller's own bookings, but we re-check
  // student_id explicitly to make the intent of this endpoint obvious.
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, student_id, teacher_id, price_at_booking, status, stripe_payment_intent_id')
    .in('id', bookingIds as string[])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!bookings || bookings.length !== bookingIds.length) {
    return NextResponse.json({ error: 'booking not found' }, { status: 404 })
  }

  const rows = bookings as unknown as BookingRow[]
  if (rows.some((b) => b.student_id !== user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (rows.some((b) => b.status !== 'pending_payment')) {
    return NextResponse.json({ error: 'booking not payable' }, { status: 409 })
  }
  const teacherIds = new Set(rows.map((b) => b.teacher_id))
  if (teacherIds.size > 1) {
    return NextResponse.json({ error: 'bookings span multiple teachers' }, { status: 400 })
  }

  const totalCents = rows.reduce((sum, b) => sum + b.price_at_booking, 0)
  const split = computeSplit(totalCents)

  // Reuse an existing PaymentIntent if we already created one for the same set of bookings
  // and it's still in a chargeable state (avoids dupes when the user reloads the page).
  const existingIds = rows.map((b) => b.stripe_payment_intent_id).filter((id): id is string => !!id)
  if (existingIds.length > 0 && existingIds.every((id) => id === existingIds[0])) {
    const existing = await stripe.paymentIntents.retrieve(existingIds[0])
    if (
      existing.amount === totalCents &&
      ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(existing.status)
    ) {
      return NextResponse.json({ clientSecret: existing.client_secret, amount: totalCents })
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'cad',
    automatic_payment_methods: { enabled: true },
    metadata: {
      booking_ids: rows.map((b) => b.id).join(','),
      student_id: user.id,
      teacher_id: rows[0].teacher_id,
      teacher_payout_amount: String(split.teacher),
      platform_amount: String(split.platform),
      system_amount: String(split.system),
    },
  })

  // Stamp the PaymentIntent id onto every booking so the webhook can find them later.
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ stripe_payment_intent_id: paymentIntent.id } as any)
    .in('id', rows.map((b) => b.id))

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, amount: totalCents })
}
