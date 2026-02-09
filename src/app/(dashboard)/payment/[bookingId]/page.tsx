"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";

type BookingDetail = {
  id: string;
  price_at_booking: number;
  status: string;
  created_at: string;
  teacher: { full_name: string | null };
  slot: { slot_date: string; start_time: string; end_time: string };
};

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  // search params の ids があればそちらを優先、なければパスパラメータ
  const idsParam = searchParams.get("ids");
  const bookingIds = idsParam
    ? idsParam.split(",")
    : [params.bookingId as string];
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadBookings();
  }, [idsParam, params.bookingId]);

  const loadBookings = async () => {
    try {
      // 認証セッションを待つ
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
          teacher: Array.isArray(item.teacher)
            ? item.teacher[0]
            : (item.teacher as any),
          slot: Array.isArray(item.slot)
            ? item.slot[0]
            : (item.slot as any),
        }));
        // 日付・時間順にソート
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

  const totalPrice = bookings.reduce((sum, b) => sum + b.price_at_booking, 0);
  const teacherName = bookings[0]?.teacher?.full_name || "名前未設定";

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
        <Link
          href="/messages"
          className="text-indigo-600 hover:text-indigo-800 font-medium"
        >
          メッセージに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <h1 className="text-xl font-bold">お支払い</h1>
          <p className="text-indigo-100 text-sm mt-1">レッスン予約の決済</p>
        </div>

        {/* 予約詳細 */}
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">先生</span>
              <span className="font-medium text-gray-900">{teacherName}</span>
            </div>

            {/* 各スロット */}
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

          {/* 準備中メッセージ */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
            <p className="text-yellow-800 font-medium text-center">
              決済機能は現在準備中です
            </p>
            <p className="text-yellow-700 text-sm text-center mt-1">
              決済機能が実装され次第、ご利用いただけるようになります。
            </p>
          </div>

          {/* 戻るリンク */}
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
