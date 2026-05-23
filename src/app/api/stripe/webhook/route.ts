import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// Stripe sends raw bodies; we must read the request as text and pass the raw
// payload to constructEvent so the signature check matches.
export const runtime = 'nodejs'

type BookingForPayment = {
  id: string
  slot_id: string
  status: string
  student_id: string
  teacher_id: string
  price_at_booking: number
}
type BookingForRefund = { id: string; slot_id: string }

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'missing signature or secret' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `signature verification failed: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    await handlePaymentSucceeded(pi)
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    await handlePaymentFailed(pi)
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    if (charge.payment_intent && typeof charge.payment_intent === 'string') {
      await handleRefund(charge.payment_intent)
    }
  } else if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object as Stripe.Dispute
    if (dispute.payment_intent && typeof dispute.payment_intent === 'string') {
      await handleDispute(dispute.payment_intent, dispute.amount, dispute.reason)
    }
  }

  return NextResponse.json({ received: true })
}

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('bookings')
    .select('id, slot_id, status, student_id, teacher_id, price_at_booking')
    .eq('stripe_payment_intent_id', pi.id)

  const rows = (existing ?? []) as unknown as BookingForPayment[]
  if (rows.length === 0) {
    // Phantom payment: charge succeeded but no booking row exists. Either the
    // cleanup cron deleted/cancelled them, or the row never existed.
    // Auto-refund and alert admins so money never silently sits with us.
    await handlePhantomPayment(pi)
    return
  }

  // Phantom payment via cancellation: bookings exist but were already cancelled
  // by the expiry cleanup. Auto-refund + alert.
  if (rows.every((r) => r.status === 'cancelled')) {
    await handlePhantomPayment(pi, rows)
    return
  }

  // Idempotency: if already confirmed (duplicate webhook), no-op.
  const alreadyDone = rows.every((r) => r.status === 'confirmed' || r.status === 'paid')
  if (alreadyDone) return

  const teacherPayout = Number(pi.metadata.teacher_payout_amount ?? 0)
  const platform = Number(pi.metadata.platform_amount ?? 0)
  const system = Number(pi.metadata.system_amount ?? 0)
  const totalCount = rows.length

  const perBookingTeacher = Math.floor(teacherPayout / totalCount)
  const perBookingPlatform = Math.floor(platform / totalCount)
  const perBookingSystem = Math.floor(system / totalCount)

  // status='confirmed' fires the notify_booking_status_changed trigger,
  // which fans notifications out to student + teacher + admins.
  await admin
    .from('bookings')
    .update({
      status: 'confirmed',
      paid_at: new Date().toISOString(),
      expires_at: null,
      teacher_payout_amount: perBookingTeacher,
      platform_amount: perBookingPlatform,
      system_amount: perBookingSystem,
    } as any)
    .eq('stripe_payment_intent_id', pi.id)

  // Slot transitions: reserved (the normal path) or available (cron cleaned it
  // up between Stripe charge and webhook arrival) → both become 'booked'.
  await admin
    .from('availability_slots')
    .update({ status: 'booked', reserved_until: null } as any)
    .in('id', rows.map((r) => r.slot_id))
}

async function handlePhantomPayment(
  pi: Stripe.PaymentIntent,
  rows?: Array<{ id: string; student_id: string; teacher_id: string; price_at_booking: number }>,
) {
  const admin = createAdminClient()

  // Best-effort refund. If it fails (already refunded, no charge, etc.), still
  // alert admins so the situation gets human attention.
  let refundError: string | null = null
  try {
    await stripe.refunds.create({ payment_intent: pi.id, reason: 'requested_by_customer' })
  } catch (err: any) {
    refundError = err?.message ?? 'unknown refund error'
  }

  // Alert all admins.
  const { data: admins } = await admin.from('profiles').select('id').eq('is_admin', true)
  const adminIds = ((admins ?? []) as unknown as Array<{ id: string }>).map((a) => a.id)
  if (adminIds.length === 0) return

  const amountStr = `$${((pi.amount ?? 0) / 100).toFixed(2)} CAD`
  const summary = rows && rows.length > 0
    ? `予約レコードが既にキャンセル/期限切れ済み (${rows.length}件)`
    : '対応する予約レコードなし'

  // Pull student/teacher from rows if present, else fall back to PaymentIntent metadata.
  const metaStudent = pi.metadata.student_id ?? null
  const metaTeacher = pi.metadata.teacher_id ?? null
  const metaBookingIds = (pi.metadata.booking_ids ?? '').split(',').filter(Boolean)

  await admin.from('notifications').insert(
    adminIds.map((id) => ({
      user_id: id,
      type: 'admin_booking_phantom_payment',
      title: refundError
        ? '[管理・要対応] 決済発生 / 自動返金失敗'
        : '[管理] 決済発生 / 自動返金実行',
      body: `${amountStr} - ${summary}${refundError ? ` / 返金エラー: ${refundError}` : ''}`,
      link: '/settings',
      metadata: {
        payment_intent_id: pi.id,
        amount_cents: pi.amount,
        refund_error: refundError,
        booking_ids: rows?.map((r) => r.id) ?? metaBookingIds,
        student_id: rows?.[0]?.student_id ?? metaStudent,
        teacher_id: rows?.[0]?.teacher_id ?? metaTeacher,
      },
    })) as any,
  )
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  // payment_failed does NOT change bookings.status (it stays 'pending_payment'),
  // so the DB trigger doesn't fire. We manually insert the notifications here.
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('bookings')
    .select('id, student_id, teacher_id, price_at_booking')
    .eq('stripe_payment_intent_id', pi.id)

  const rows = (existing ?? []) as unknown as Array<{
    id: string
    student_id: string
    teacher_id: string
    price_at_booking: number
  }>
  if (rows.length === 0) return

  const studentId = rows[0].student_id
  const teacherId = rows[0].teacher_id
  const totalAmount = rows.reduce((s, r) => s + r.price_at_booking, 0)
  const amountStr = `$${(totalAmount / 100).toFixed(2)} CAD`
  const reason = pi.last_payment_error?.message ?? '不明なエラー'

  // Student: payment failed
  await admin.from('notifications').insert({
    user_id: studentId,
    type: 'booking_payment_failed',
    title: '決済に失敗しました',
    body: `${amountStr} の決済が完了しませんでした。${reason}`,
    link: `/payment/${rows[0].id}?ids=${rows.map((r) => r.id).join(',')}`,
    metadata: { payment_intent_id: pi.id, booking_ids: rows.map((r) => r.id) },
  } as any)

  // Admins: payment failed (operational visibility)
  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('is_admin', true)

  const adminIds = ((admins ?? []) as unknown as Array<{ id: string }>)
    .map((a) => a.id)
    .filter((id) => id !== studentId && id !== teacherId)

  if (adminIds.length > 0) {
    await admin.from('notifications').insert(
      adminIds.map((id) => ({
        user_id: id,
        type: 'admin_booking_payment_failed',
        title: '[管理] 決済失敗',
        body: `${amountStr} / ${reason}`,
        link: '/settings',
        metadata: {
          payment_intent_id: pi.id,
          booking_ids: rows.map((r) => r.id),
          student_id: studentId,
          teacher_id: teacherId,
        },
      })) as any
    )
  }
}

async function handleRefund(paymentIntentId: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('bookings')
    .select('id, slot_id')
    .eq('stripe_payment_intent_id', paymentIntentId)

  const rows = (existing ?? []) as unknown as BookingForRefund[]
  if (rows.length === 0) return
  const slotIds = rows.map((r) => r.slot_id)

  // status='refunded' fires the trigger which notifies all parties.
  await admin
    .from('bookings')
    .update({ status: 'refunded' } as any)
    .eq('stripe_payment_intent_id', paymentIntentId)

  await admin
    .from('availability_slots')
    .update({ status: 'available' } as any)
    .in('id', slotIds)
}

async function handleDispute(paymentIntentId: string, amount: number, reason: string) {
  // Disputes (chargebacks) don't change bookings.status automatically —
  // they need human review. We notify all admins urgently.
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('bookings')
    .select('id, student_id, teacher_id')
    .eq('stripe_payment_intent_id', paymentIntentId)

  const rows = (existing ?? []) as unknown as Array<{
    id: string
    student_id: string
    teacher_id: string
  }>
  if (rows.length === 0) return

  const { data: admins } = await admin
    .from('profiles')
    .select('id')
    .eq('is_admin', true)

  const adminIds = ((admins ?? []) as unknown as Array<{ id: string }>).map((a) => a.id)
  if (adminIds.length === 0) return

  const amountStr = `$${(amount / 100).toFixed(2)} CAD`
  await admin.from('notifications').insert(
    adminIds.map((id) => ({
      user_id: id,
      type: 'admin_booking_dispute',
      title: '[管理・要対応] チャージバック発生',
      body: `${amountStr} / 理由: ${reason}`,
      link: '/settings',
      metadata: {
        payment_intent_id: paymentIntentId,
        booking_ids: rows.map((r) => r.id),
        amount_cents: amount,
        reason,
      },
    })) as any
  )
}
