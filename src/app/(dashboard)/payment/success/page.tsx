"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");
  const [paid, setPaid] = useState(false);
  const [polling, setPolling] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (!idsParam) { setPolling(false); return; }

    let attempts = 0;
    const maxAttempts = 10;

    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase.from("bookings").select("status").in("id", idsParam.split(","));
      const allPaid = data && data.length > 0 && data.every((b: any) => b.status === "paid" || b.status === "confirmed");
      if (allPaid) { setPaid(true); setPolling(false); clearInterval(interval); }
      else if (attempts >= maxAttempts) { setPolling(false); clearInterval(interval); }
    }, 1500);

    return () => clearInterval(interval);
  }, [idsParam]);

  const failed = redirectStatus && redirectStatus !== "succeeded";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          {/* Status banner */}
          <div
            className="h-2 w-full"
            style={{
              background: failed
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : paid
                ? 'linear-gradient(135deg, #10B981, #059669)'
                : 'linear-gradient(135deg, #4F46E5, #6366F1)',
            }}
          />

          <div className="p-10 text-center">
            {failed ? (
              <>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(239,68,68,0.08)' }}>
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
                  決済が完了しませんでした
                </h1>
                <p className="text-slate-500 text-sm mb-6">ステータス: {redirectStatus}</p>
              </>
            ) : paid ? (
              <>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(16,185,129,0.08)' }}>
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
                  お支払いが完了しました
                </h1>
                <p className="text-slate-500 text-sm mb-6">レッスンの予約が確定しました。</p>
              </>
            ) : polling ? (
              <>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(79,70,229,0.08)' }}>
                  <Clock className="w-10 h-10 text-indigo-500 animate-pulse" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
                  決済を確認中...
                </h1>
                <p className="text-slate-500 text-sm mb-6">少々お待ちください。</p>
                <div className="flex justify-center mb-6">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(245,158,11,0.08)' }}>
                  <Clock className="w-10 h-10 text-amber-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
                  決済処理中
                </h1>
                <p className="text-slate-500 text-sm mb-6">
                  決済の確認に時間がかかっています。数分後にメッセージページで状態をご確認ください。
                </p>
              </>
            )}

            {paymentIntent && (
              <p className="text-xs text-slate-300 mb-5 font-mono">決済ID: {paymentIntent}</p>
            )}

            <Link
              href="/bookings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
            >
              予約一覧を確認する
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="mt-4">
              <Link href="/messages" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                メッセージに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
