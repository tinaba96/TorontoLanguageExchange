"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  MatchWithProfiles,
  MessageWithSender,
  AvailabilitySlot,
} from "@/lib/types/database.types";
import { Send, ChevronDown, ChevronUp, Calendar, X } from "lucide-react";

export default function MessagesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<MatchWithProfiles[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithProfiles | null>(
    null
  );
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // レッスン予約関連
  const [teacherRate, setTeacherRate] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [showSlots, setShowSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id);
      loadTeacherInfo(selectedMatch.teacher_id);

      // リアルタイム更新をサブスクライブ
      const channel = supabase
        .channel(`match-${selectedMatch.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `match_id=eq.${selectedMatch.id}`,
          },
          () => {
            loadMessages(selectedMatch.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedMatch]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // プロフィールとpassphrase_versionを取得
      const [profileResult, versionResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "passphrase_version")
          .single(),
      ]);

      const profileData = profileResult.data;
      const userVersion = profileData?.passphrase_version || 0;
      const currentVersion = parseInt(versionResult.data?.value || "1", 10);

      // adminユーザー以外でバージョンが古ければ再認証ページへ
      if (!profileData?.is_admin && userVersion < currentVersion) {
        router.push("/verify-passphrase");
        return;
      }

      setProfile(profileData);

      // マッチング一覧を取得
      const { data: matchesData } = await supabase
        .from("matches")
        .select(
          `
          *,
          teacher:teacher_id(*),
          student:student_id(*, student_profile:student_profiles(*))
        `
        )
        .or(`teacher_id.eq.${user.id},student_id.eq.${user.id}`)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (matchesData) {
        // データを MatchWithProfiles 型に変換
        const formattedMatches: MatchWithProfiles[] = matchesData.map(
          (match: any) => ({
            ...match,
            teacher: Array.isArray(match.teacher)
              ? match.teacher[0]
              : match.teacher,
            student: {
              ...(Array.isArray(match.student)
                ? match.student[0]
                : match.student),
              student_profile: Array.isArray(match.student?.student_profile)
                ? match.student.student_profile[0] || null
                : match.student?.student_profile || null,
            },
          })
        );
        setMatches(formattedMatches);

        // 最初のマッチングを選択
        if (formattedMatches.length > 0) {
          setSelectedMatch(formattedMatches[0]);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherInfo = async (teacherId: string) => {
    try {
      // 先生のプロフィール（金額）を取得
      const { data: teacherProfile } = await supabase
        .from("teacher_profiles")
        .select("hourly_rate")
        .eq("user_id", teacherId)
        .single();

      setTeacherRate(teacherProfile?.hourly_rate ?? null);

      // 空きスロットを取得
      const { data: slotsData } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("teacher_id", teacherId)
        .eq("status", "available")
        .gte("slot_date", new Date().toISOString().split("T")[0])
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });

      setAvailableSlots((slotsData as AvailabilitySlot[]) || []);
      setShowSlots(false);
    } catch (error) {
      console.error("Error loading teacher info:", error);
    }
  };

  const loadMessages = async (matchId: string) => {
    try {
      const { data } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:sender_id(*)
        `
        )
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (data) {
        const formattedMessages: MessageWithSender[] = data.map((msg: any) => ({
          ...msg,
          sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatch || !profile) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        match_id: selectedMatch.id,
        sender_id: profile.id,
        content: newMessage.trim(),
      } as any);

      if (error) throw error;

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert("メッセージの送信に失敗しました。再度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const toggleSlotSelection = (slot: AvailabilitySlot) => {
    setSelectedSlots((prev) =>
      prev.find((s) => s.id === slot.id)
        ? prev.filter((s) => s.id !== slot.id)
        : [...prev, slot]
    );
  };

  const handleBookSelectedSlots = async () => {
    if (!profile || !selectedMatch || teacherRate === null || selectedSlots.length === 0) return;

    setCreatingBooking(true);
    try {
      // 各スロットの予約を作成（スロットのstatusは決済完了後に更新する）
      const inserts = selectedSlots.map((slot) => ({
        match_id: selectedMatch.id,
        slot_id: slot.id,
        student_id: profile.id,
        teacher_id: selectedMatch.teacher_id,
        price_at_booking: teacherRate,
      }));

      const { data: bookings, error: bookingError } = await supabase
        .from("bookings")
        .insert(inserts as any)
        .select();

      if (bookingError) throw bookingError;
      if (!bookings || bookings.length === 0) throw new Error("予約データが返されませんでした");

      // 支払いページへリダイレクト
      const bookingIds = (bookings as any[]).map((b) => b.id).join(",");
      router.push(`/payment/checkout?ids=${bookingIds}`);
    } catch (error) {
      console.error("Error creating booking:", error);
      alert("予約の作成に失敗しました。再度お試しください。");
    } finally {
      setCreatingBooking(false);
      setShowConfirmModal(false);
      setSelectedSlots([]);
    }
  };

  const getOtherUser = (match: MatchWithProfiles) => {
    if (!profile) return null;
    return profile.id === match.teacher_id ? match.student : match.teacher;
  };

  const isStudent = profile?.role === "student";

  // スロットを日付ごとにグループ化
  const groupedSlots = availableSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = [];
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">メッセージ</h1>
        <p className="text-gray-600 mt-1">マッチングした相手とメッセージを交換しましょう</p>
      </div>

      {matches.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600 border border-gray-200">
          まだマッチングがありません
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)]">
          {/* マッチング一覧 */}
          <div className="col-span-12 md:col-span-4 bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">マッチング一覧</h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {matches.map((match) => {
                const otherUser = getOtherUser(match);
                return (
                  <button
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedMatch?.id === match.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {otherUser?.full_name?.charAt(0) || "U"}
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="font-semibold text-gray-900">
                          {otherUser?.full_name || "名前未設定"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {profile?.id === match.teacher_id ? "生徒" : "先生"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* メッセージエリア */}
          <div className="col-span-12 md:col-span-8 bg-white rounded-lg shadow border border-gray-200 flex flex-col overflow-hidden">
            {selectedMatch ? (
              <>
                {/* ヘッダー */}
                <div className="p-4 border-b">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {getOtherUser(selectedMatch)?.full_name?.charAt(0) ||
                        "U"}
                    </div>
                    <div className="ml-3">
                      <p className="font-semibold text-gray-900">
                        {getOtherUser(selectedMatch)?.full_name ||
                          "名前未設定"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {profile?.id === selectedMatch.teacher_id
                          ? "生徒"
                          : "先生"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* レッスン情報バー（生徒側のみ表示） */}
                {isStudent && teacherRate !== null && (
                  <div className="border-b bg-indigo-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-indigo-800 font-medium">
                        レッスン料金: ${(teacherRate / 100).toFixed(2)}/時間
                      </span>
                      <button
                        onClick={() => setShowSlots(!showSlots)}
                        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        予約可能な時間を見る
                        {showSlots ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* スロット一覧 */}
                    {showSlots && (
                      <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                        {Object.keys(groupedSlots).length === 0 ? (
                          <p className="text-sm text-gray-500">現在予約可能なスロットはありません</p>
                        ) : (
                          <>
                            {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                              <div key={date}>
                                <h4 className="text-xs font-bold text-gray-700 mb-1">
                                  {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                    weekday: "short",
                                  })}
                                </h4>
                                <div className="space-y-1 ml-2">
                                  {dateSlots.map((slot) => {
                                    const isSelected = selectedSlots.some((s) => s.id === slot.id);
                                    return (
                                      <button
                                        key={slot.id}
                                        onClick={() => toggleSlotSelection(slot)}
                                        className={`flex items-center justify-between w-full rounded-lg px-3 py-2 transition-colors ${
                                          isSelected
                                            ? "bg-indigo-100 ring-2 ring-indigo-500"
                                            : "bg-white hover:bg-gray-50"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                            isSelected
                                              ? "bg-indigo-600 border-indigo-600"
                                              : "border-gray-300"
                                          }`}>
                                            {isSelected && (
                                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </div>
                                          <span className="text-sm text-gray-700">
                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                          </span>
                                        </div>
                                        <span className="text-sm text-gray-600">
                                          ${(teacherRate / 100).toFixed(2)}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {/* 選択中の合計 + 予約ボタン */}
                            {selectedSlots.length > 0 && (
                              <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-indigo-200">
                                <span className="text-sm font-medium text-gray-700">
                                  {selectedSlots.length}時間選択中 ・ 合計: <span className="text-indigo-600 font-bold">${(teacherRate / 100 * selectedSlots.length).toFixed(2)} CAD</span>
                                </span>
                                <button
                                  onClick={() => setShowConfirmModal(true)}
                                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                  予約する
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* メッセージ一覧 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      メッセージを送信してみましょう
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwnMessage = message.sender_id === profile?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isOwnMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isOwnMessage
                                ? "bg-indigo-600 text-white"
                                : "bg-gray-200 text-gray-900"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                isOwnMessage
                                  ? "text-indigo-200"
                                  : "text-gray-500"
                              }`}
                            >
                              {new Date(
                                message.created_at
                              ).toLocaleTimeString("ja-JP", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* メッセージ入力 */}
                <form onSubmit={handleSendMessage} className="p-4 border-t">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="メッセージを入力..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">送信</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                マッチングを選択してください
              </div>
            )}
          </div>
        </div>
      )}

      {/* 予約確認モーダル */}
      {showConfirmModal && selectedMatch && teacherRate !== null && selectedSlots.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-gray-900">予約確認</h2>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">先生</span>
                  <span className="font-medium text-gray-900">
                    {selectedMatch.teacher.full_name || "名前未設定"}
                  </span>
                </div>

                {/* 選択したスロット一覧 */}
                <div className="py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">選択した時間帯</span>
                  <div className="mt-2 space-y-1">
                    {selectedSlots
                      .sort((a, b) => a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time))
                      .map((slot) => (
                        <div key={slot.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            {new Date(slot.slot_date + "T00:00:00").toLocaleDateString("ja-JP", {
                              month: "short",
                              day: "numeric",
                              weekday: "short",
                            })}
                          </span>
                          <span className="text-gray-900 font-medium">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                          <span className="text-gray-600">
                            ${(teacherRate / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex justify-between py-2">
                  <span className="text-gray-900 font-bold">合計（{selectedSlots.length}時間）</span>
                  <span className="font-bold text-lg text-indigo-600">
                    ${(teacherRate / 100 * selectedSlots.length).toFixed(2)} CAD
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleBookSelectedSlots}
                  disabled={creatingBooking}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {creatingBooking ? "予約中..." : "予約を確定する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
