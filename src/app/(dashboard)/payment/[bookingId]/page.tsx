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
import { ArrowLeft, Clock } from "lucide-react";

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

  // Tick once a second so the countdown re-renders.
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
          `
          id,
          price_at_booking,
          status,
          created_at,
          expires_at,
          teacher:teacher_id(full_name),
          slot:slot_id(slot_date, start_time, end_time)
        `
        )
        .in("id", bookingIds);

      if (data) {
        const formatted: BookingDetail[] = data.map((item) => ({
          id: item.id,
          price_at_booking: item.price_at_booking,
          status: item.status,
          created_at: item.created_at,
          expires_at: (item as any).expires_at ?? null,
          teacher: Array.isArray(item.teacher)
            ? item.teacher[0]
            : (item.teacher as any),
          slot: Array.isArray(item.slot)
            ? item.slot[0]
            : (item.slot as any),
        }));
        formatted.sort((a, b) => {
          const dateCompare = (a.slot?.slot_date || "").localeCompare(b.slot?.slot_date || "");
          if (dateCompare !== 0) return dateCompare;
          return (a.slot?.start_time || "").localeCompare(b.slot?.start_time || "");
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
  const allPaid =
    bookings.length > 0 &&
    bookings.every((b) => b.status === "paid" || b.status === "confirmed");
  const allCancelled =
    bookings.length > 0 && bookings.every((b) => b.status === "cancelled");

  // Earliest expiry across all the bookings being paid for. We surface the
  // remaining time so the student knows the slot lock is on a 15-min fuse.
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
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <p className="text-gray-600 text-lg mb-4">予約情報が見つかりませんでした</p>
        <Link href="/messages" className="text-indigo-600 hover:text-indigo-800 font-medium">
          メッセージに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <h1 className="text-xl font-bold">お支払い</h1>
          <p className="text-indigo-100 text-sm mt-1">レッスン予約の決済</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">先生</span>
              <span className="font-medium text-gray-900">{teacherName}</span>
            </div>

            <div className="py-2 border-b border-gray-100">
              <span className="text-gray-600 text-sm">予約内容（{bookings.length}時間）</span>
              <div className="mt-2 space-y-1">
                {bookings.map((b) => (
                  <div key={b.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {b.slot
                        ? new Date(b.slot.slot_date + "T00:00:00").toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            weekday: "short",
                          })
                        : "-"}
                    </span>
                    <span className="text-gray-900 font-medium">
                      {b.slot
                        ? `${b.slot.start_time.slice(0, 5)} - ${b.slot.end_time.slice(0, 5)}`
                        : "-"}
                    </span>
                    <span className="text-gray-600">
                      ${(b.price_at_booking / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-gray-900 font-bold">合計</span>
              <span className="font-bold text-lg text-indigo-600">
                ${(totalPrice / 100).toFixed(2)} CAD
              </span>
            </div>
          </div>

          {allPaid ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6 text-center">
              <p className="text-green-800 font-medium">この予約は決済済みです</p>
            </div>
          ) : allCancelled || isExpired ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6 text-center">
              <p className="text-red-800 font-medium">予約の保留時間が過ぎました</p>
              <p className="text-red-700 text-sm mt-1">
                スロットは解放されました。メッセージページから再度ご予約ください。
              </p>
            </div>
          ) : intentError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6 text-center">
              <p className="text-red-800 font-medium">{intentError}</p>
            </div>
          ) : clientSecret ? (
            <>
              {countdownLabel && (
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mt-4 ${
                    msRemaining !== null && msRemaining < 60_000
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>このスロットは {countdownLabel} 以内に決済してください</span>
                </div>
              )}
              <Elements
                key={clientSecret}
                stripe={stripePromise}
                options={{ clientSecret, appearance: { theme: "stripe" } }}
              >
                <CheckoutForm bookingIds={bookingIds} />
              </Elements>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">決済を準備中...</div>
          )}

          <Link
            href="/messages"
            className="flex items-center justify-center gap-2 w-full mt-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
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
    // 成功時は Stripe が return_url にリダイレクトするため、ここに来ない
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-6">
      <PaymentElement />
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "処理中..." : "支払う"}
      </button>
    </form>
  );
}
