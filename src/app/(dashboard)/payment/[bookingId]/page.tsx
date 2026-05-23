"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Clock, ShieldCheck, CreditCard, CheckCircle2, XCircle } from "lucide-react";

type BookingDetail = {
  id: string;
  price_at_booking: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  teacher: { full_name: string | null };
  slot: { slot_date: string; start_time: string; end_time: string };
};

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const bookingIds = useMemo(
    () => (idsParam ? idsParam.split(",") : [params.bookingId as string]),
    [idsParam, params.bookingId]
  );

  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const supabase = createClient();

  useEffect(() => {
    loadBookings();
  }, [idsParam, params.bookingId]);

  useEffect(() => {
    if (bookings.length === 0) return;
    if (bookings.every((b) => b.status !== "pending_payment")) return;
    createPaymentIntent();
  }, [bookings]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("bookings")
        .select(
          `id, price_at_booking, status, created_at, expires_at,
           teacher:teacher_id(full_name),
           slot:slot_id(slot_date, start_time, end_time)`
        )
        .in("id", bookingIds);

      if (data) {
        const formatted: BookingDetail[] = data.map((item) => ({
          id: item.id,
          price_at_booking: item.price_at_booking,
          status: item.status,
          created_at: item.created_at,
          expires_at: (item as any).expires_at ?? null,
          teacher: Array.isArray(item.teacher) ? item.teacher[0] : (item.teacher as any),
          slot: Array.isArray(item.slot) ? item.slot[0] : (item.slot as any),
        }));
        formatted.sort((a, b) => {
          const d = (a.slot?.slot_date || "").localeCompare(b.slot?.slot_date || "");
          return d !== 0 ? d : (a.slot?.start_time || "").localeCompare(b.slot?.start_time || "");
        });
        setBookings(formatted);
      }
    } catch (error) {
      console.error("Error loading bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const createPaymentIntent = async () => {
    try {
      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIntentError(json.error || "決済の初期化に失敗しました");
        return;
      }
      setClientSecret(json.clientSecret);
    } catch (err: any) {
      setIntentError(err?.message || "ネットワークエラー");
    }
  };

  const totalPrice = bookings.reduce((sum, b) => sum + b.price_at_booking, 0);
  const teacherName = bookings[0]?.teacher?.full_name || "名前未設定";
  const allPaid = bookings.length > 0 && bookings.every((b) => b.status === "paid" || b.status === "confirmed");
  const allCancelled = bookings.length > 0 && bookings.every((b) => b.status === "cancelled");

  const earliestExpiry = bookings
    .map((b) => (b.expires_at ? new Date(b.expires_at).getTime() : null))
    .filter((t): t is number => t !== null)
    .reduce<number | null>((min, t) => (min === null || t < min ? t : min), null);
  const msRemaining = earliestExpiry ? earliestExpiry - now : null;
  const isExpired =
    msRemaining !== null && msRemaining <= 0 &&
    bookings.some((b) => b.status === "pending_payment");
  const countdownLabel = (() => {
    if (msRemaining === null) return null;
    const seconds = Math.max(0, Math.floor(msRemaining / 1000));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(79,70,229,0.08)' }}>
          <CreditCard className="w-7 h-7 text-indigo-400" />
        </div>
        <p className="text-slate-600 font-medium mb-4">予約情報が見つかりませんでした</p>
        <Link href="/messages" className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-4">
          メッセージに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        {/* Header */}
        <div
          className="relative p-6 text-white overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1E3A5F 60%, #4F46E5 100%)' }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, #6366F1 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-indigo-300" />
              <h1 className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-syne)' }}>
                お支払い
              </h1>
            </div>
            <p className="text-white/60 text-sm">レッスン予約の安全な決済</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Booking summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">先生</span>
              <span className="text-sm font-bold text-slate-800">{teacherName}</span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                予約内容（{bookings.length}時間）
              </span>
              <div className="space-y-1.5">
                {bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {b.slot
                        ? new Date(b.slot.slot_date + "T00:00:00").toLocaleDateString("ja-JP", {
                            month: "short", day: "numeric", weekday: "short",
                          })
                        : "–"}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      {b.slot ? `${b.slot.start_time.slice(0, 5)} – ${b.slot.end_time.slice(0, 5)}` : "–"}
                    </span>
                    <span className="text-xs text-slate-700 font-semibold">
                      ${(b.price_at_booking / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">合計</span>
              <span className="text-xl font-extrabold" style={{ color: '#4F46E5', fontFamily: 'var(--font-syne)' }}>
                ${(totalPrice / 100).toFixed(2)} <span className="text-sm font-bold">CAD</span>
              </span>
            </div>
          </div>

          {/* Status states */}
          {allPaid ? (
            <div className="rounded-2xl p-5 text-center border" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-emerald-800 font-semibold text-sm">この予約は決済済みです</p>
            </div>
          ) : allCancelled || isExpired ? (
            <div className="rounded-2xl p-5 text-center border" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-800 font-semibold text-sm mb-1">予約の保留時間が過ぎました</p>
              <p className="text-red-600 text-xs">
                スロットは解放されました。メッセージページから再度ご予約ください。
              </p>
            </div>
          ) : intentError ? (
            <div className="rounded-2xl p-5 text-center border" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-800 font-semibold text-sm">{intentError}</p>
            </div>
          ) : clientSecret ? (
            <>
              {/* Countdown timer */}
              {countdownLabel && (
                <div
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold border"
                  style={
                    msRemaining !== null && msRemaining < 60_000
                      ? { background: 'rgba(239,68,68,0.08)', color: '#DC2626', borderColor: 'rgba(239,68,68,0.2)' }
                      : { background: 'rgba(245,158,11,0.08)', color: '#D97706', borderColor: 'rgba(245,158,11,0.2)' }
                  }
                >
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>このスロットは <strong>{countdownLabel}</strong> 以内に決済してください</span>
                </div>
              )}

              {/* Stripe Elements */}
              <Elements
                key={clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#4F46E5",
                      colorBackground: "#F8FAFC",
                      colorText: "#0F172A",
                      colorDanger: "#EF4444",
                      borderRadius: "12px",
                      fontFamily: "var(--font-dm-sans), sans-serif",
                    },
                  },
                }}
              >
                <CheckoutForm bookingIds={bookingIds} />
              </Elements>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">決済を準備中...</p>
            </div>
          )}

          {/* Back link */}
          <Link
            href="/messages"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            メッセージに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({ bookingIds }: { bookingIds: string[] }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg(null);

    const returnUrl = `${window.location.origin}/payment/success?ids=${bookingIds.join(",")}`;
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      setErrorMsg(error.message || "決済に失敗しました");
      setSubmitting(false);
    }
    // On success Stripe redirects to return_url — no code runs here
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMsg && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-700 border" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
      >
        <CreditCard className="w-4 h-4" />
        {submitting ? "処理中..." : "支払う"}
      </button>
    </form>
  );
}
