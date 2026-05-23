"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Clock } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");
  const [paid, setPaid] = useState(false);
  const [polling, setPolling] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (!idsParam) {
      setPolling(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 1500;

    // Webhook が bookings.status='paid' に更新するまで少しタイムラグがあるので
    // 短い間隔でポーリングする。
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("bookings")
        .select("status")
        .in("id", idsParam.split(","));
      const allPaid =
        data &&
        data.length > 0 &&
        data.every((b: any) => b.status === "paid" || b.status === "confirmed");
      if (allPaid) {
        setPaid(true);
        setPolling(false);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        setPolling(false);
        clearInterval(interval);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [idsParam]);

  const failed = redirectStatus && redirectStatus !== "succeeded";

  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
        {failed ? (
          <>
            <div className="text-red-600 text-5xl mb-4">⚠</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">決済が完了しませんでした</h1>
            <p className="text-gray-600 mb-6">ステータス: {redirectStatus}</p>
          </>
        ) : paid ? (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">お支払いが完了しました</h1>
            <p className="text-gray-600 mb-6">レッスンの予約が確定しました。</p>
          </>
        ) : polling ? (
          <>
            <Clock className="w-16 h-16 text-indigo-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">決済を確認中...</h1>
            <p className="text-gray-600 mb-6">少々お待ちください。</p>
          </>
        ) : (
          <>
            <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">決済処理中</h1>
            <p className="text-gray-600 mb-6">
              決済の確認に時間がかかっています。数分後にメッセージページで状態をご確認ください。
            </p>
          </>
        )}

        {paymentIntent && (
          <p className="text-xs text-gray-400 mb-4">決済ID: {paymentIntent}</p>
        )}

        <Link
          href="/messages"
          className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          メッセージに戻る
        </Link>
      </div>
    </div>
  );
}
