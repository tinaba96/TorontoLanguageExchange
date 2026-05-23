"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type {
  Profile,
  MatchWithProfiles,
  MessageWithSender,
  AvailabilitySlot,
} from "@/lib/types/database.types";
import { Send, ChevronDown, ChevronUp, Calendar, X, MessageSquare } from "lucide-react";

export default function MessagesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<MatchWithProfiles[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithProfiles | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [teacherRate, setTeacherRate] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [showSlots, setShowSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<AvailabilitySlot[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (selectedMatch) {
      loadMessages(selectedMatch.id);
      loadTeacherInfo(selectedMatch.teacher_id);
      const channel = supabase.channel(`match-${selectedMatch.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${selectedMatch.id}` }, () => { loadMessages(selectedMatch.id); }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedMatch]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const [profileResult, versionResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("app_settings").select("value").eq("key", "passphrase_version").single(),
      ]);
      const profileData = profileResult.data;
      const userVersion = profileData?.passphrase_version || 0;
      const currentVersion = parseInt(versionResult.data?.value || "1", 10);
      if (!profileData?.is_admin && userVersion < currentVersion) { router.push("/verify-passphrase"); return; }
      setProfile(profileData);
      const { data: matchesData } = await supabase.from("matches").select(`*, teacher:teacher_id(*), student:student_id(*, student_profile:student_profiles(*))`).or(`teacher_id.eq.${user.id},student_id.eq.${user.id}`).eq("status", "active").order("created_at", { ascending: false });
      if (matchesData) {
        const formattedMatches: MatchWithProfiles[] = matchesData.map((match: any) => ({
          ...match,
          teacher: Array.isArray(match.teacher) ? match.teacher[0] : match.teacher,
          student: { ...(Array.isArray(match.student) ? match.student[0] : match.student), student_profile: Array.isArray(match.student?.student_profile) ? match.student.student_profile[0] || null : match.student?.student_profile || null },
        }));
        setMatches(formattedMatches);
        if (formattedMatches.length > 0) setSelectedMatch(formattedMatches[0]);
      }
    } catch (error) { console.error("Error loading data:", error); }
    finally { setLoading(false); }
  };

  const loadTeacherInfo = async (teacherId: string) => {
    try {
      const { data: teacherProfile } = await supabase.from("teacher_profiles").select("hourly_rate").eq("user_id", teacherId).single();
      setTeacherRate(teacherProfile?.hourly_rate ?? null);
      const { data: slotsData } = await supabase.from("availability_slots").select("*").eq("teacher_id", teacherId).eq("status", "available").gte("slot_date", new Date().toISOString().split("T")[0]).order("slot_date", { ascending: true }).order("start_time", { ascending: true });
      setAvailableSlots((slotsData as AvailabilitySlot[]) || []);
      setShowSlots(false);
    } catch (error) { console.error("Error loading teacher info:", error); }
  };

  const loadMessages = async (matchId: string) => {
    try {
      const { data } = await supabase.from("messages").select(`*, sender:sender_id(*)`).eq("match_id", matchId).order("created_at", { ascending: true });
      if (data) {
        setMessages(data.map((msg: any) => ({ ...msg, sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender })));
      }
    } catch (error) { console.error("Error loading messages:", error); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedMatch || !profile) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({ match_id: selectedMatch.id, sender_id: profile.id, content: newMessage.trim() } as any);
      if (error) throw error;
      setNewMessage("");
    } catch (error) { console.error("Error sending message:", error); alert("メッセージの送信に失敗しました。再度お試しください。"); }
    finally { setSending(false); }
  };

  const toggleSlotSelection = (slot: AvailabilitySlot) => {
    setSelectedSlots((prev) => prev.find((s) => s.id === slot.id) ? prev.filter((s) => s.id !== slot.id) : [...prev, slot]);
  };

  const handleBookSelectedSlots = async () => {
    if (!profile || !selectedMatch || teacherRate === null || selectedSlots.length === 0) return;
    setCreatingBooking(true);
    try {
      const { data, error } = await supabase.rpc("reserve_slots_for_booking", { p_match_id: selectedMatch.id, p_slot_ids: selectedSlots.map((s) => s.id), p_student_id: profile.id, p_teacher_id: selectedMatch.teacher_id, p_price_at_booking: teacherRate, p_hold_minutes: 15 } as any);
      if (error) {
        if (error.message?.includes("slot_unavailable")) { alert("選択したスロットの一部はすでに予約されています。最新の空き状況を確認してください。"); }
        else if (error.message?.includes("forbidden")) { alert("操作が許可されていません。再ログインしてお試しください。"); }
        else { alert("予約の作成に失敗しました。再度お試しください。"); }
        return;
      }
      if (!data || (data as any[]).length === 0) { alert("予約データが返されませんでした"); return; }
      const bookingIds = (data as Array<{ booking_id: string }>).map((b) => b.booking_id).join(",");
      router.push(`/payment/checkout?ids=${bookingIds}`);
    } catch (error) { console.error("Error creating booking:", error); alert("予約の作成に失敗しました。再度お試しください。"); }
    finally { setCreatingBooking(false); setShowConfirmModal(false); setSelectedSlots([]); }
  };

  const getOtherUser = (match: MatchWithProfiles) => {
    if (!profile) return null;
    return profile.id === match.teacher_id ? match.student : match.teacher;
  };

  const isStudent = profile?.role === "student";
  const groupedSlots = availableSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = [];
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>メッセージ</h1>
        </div>
        <p className="text-slate-500 text-sm">マッチングした相手とメッセージを交換しましょう</p>
      </div>

      {matches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <MessageSquare className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500">まだマッチングがありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 220px)' }}>
          {/* Match list sidebar */}
          <div className="col-span-12 md:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-sm">マッチング一覧</h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {matches.map((match) => {
                const otherUser = getOtherUser(match);
                const isSelected = selectedMatch?.id === match.id;
                return (
                  <button
                    key={match.id}
                    onClick={() => setSelectedMatch(match)}
                    className={`w-full p-4 text-left transition-all ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={otherUser?.avatar_url}
                        name={otherUser?.full_name}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${isSelected ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                        imgClassName="w-full h-full object-cover rounded-xl"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {otherUser?.full_name || "名前未設定"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {profile?.id === match.teacher_id ? "生徒" : "先生"}
                        </p>
                      </div>
                      {isSelected && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat area */}
          <div className="col-span-12 md:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            {selectedMatch ? (
              <>
                {/* Chat header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                  <Avatar
                    url={getOtherUser(selectedMatch)?.avatar_url}
                    name={getOtherUser(selectedMatch)?.full_name}
                    className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0"
                    imgClassName="w-full h-full object-cover rounded-xl"
                  />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{getOtherUser(selectedMatch)?.full_name || "名前未設定"}</p>
                    <p className="text-xs text-slate-400">{profile?.id === selectedMatch.teacher_id ? "生徒" : "先生"}</p>
                  </div>
                </div>

                {/* Lesson booking bar (students only) */}
                {isStudent && teacherRate !== null && (
                  <div className="border-b border-slate-100 px-5 py-3" style={{ background: 'rgba(79,70,229,0.04)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-indigo-700">
                        レッスン料金: ${(teacherRate / 100).toFixed(2)}/時間
                      </span>
                      <button
                        onClick={() => setShowSlots(!showSlots)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        予約可能な時間
                        {showSlots ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {showSlots && (
                      <div className="mt-3 space-y-3 max-h-56 overflow-y-auto">
                        {Object.keys(groupedSlots).length === 0 ? (
                          <p className="text-sm text-slate-500">現在予約可能なスロットはありません</p>
                        ) : (
                          <>
                            {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                              <div key={date}>
                                <h4 className="text-xs font-bold text-slate-600 mb-1.5">
                                  {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                                </h4>
                                <div className="space-y-1 ml-2">
                                  {dateSlots.map((slot) => {
                                    const isSelected = selectedSlots.some((s) => s.id === slot.id);
                                    return (
                                      <button
                                        key={slot.id}
                                        onClick={() => toggleSlotSelection(slot)}
                                        className={`flex items-center justify-between w-full rounded-xl px-3 py-2 text-sm transition-all ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:bg-white'}`}
                                        style={isSelected ? { background: 'rgba(79,70,229,0.1)' } : { background: 'rgba(255,255,255,0.6)' }}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                          </div>
                                          <span className="text-slate-700 font-medium">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                                        </div>
                                        <span className="text-slate-500 text-xs">${(teacherRate / 100).toFixed(2)}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {selectedSlots.length > 0 && (
                              <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-indigo-200">
                                <span className="text-sm font-semibold text-slate-700">
                                  {selectedSlots.length}時間選択 ·{' '}
                                  <span className="text-indigo-600 font-bold">${(teacherRate / 100 * selectedSlots.length).toFixed(2)} CAD</span>
                                </span>
                                <button
                                  onClick={() => setShowConfirmModal(true)}
                                  className="px-4 py-1.5 rounded-xl text-sm font-bold text-white"
                                  style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
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

                {/* Messages list */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <MessageSquare className="w-10 h-10 opacity-30" />
                      <p className="text-sm">メッセージを送信してみましょう</p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.sender_id === profile?.id;
                      return (
                        <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} items-end gap-2`}>
                          {!isOwn && (
                            <Avatar
                              url={message.sender?.avatar_url}
                              name={message.sender?.full_name}
                              className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0"
                            />
                          )}
                          <div className="max-w-xs lg:max-w-sm">
                            <div
                              className={`px-4 py-2.5 text-sm leading-relaxed ${isOwn ? 'text-white rounded-2xl rounded-br-sm' : 'text-slate-800 rounded-2xl rounded-bl-sm bg-slate-100'}`}
                              style={isOwn ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)' } : {}}
                            >
                              {message.content}
                            </div>
                            <p className={`text-xs mt-1 ${isOwn ? 'text-right text-slate-400' : 'text-slate-400'}`}>
                              {new Date(message.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="メッセージを入力..."
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-800 placeholder-slate-400 border border-slate-200 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">マッチングを選択してください</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Booking confirmation modal ── */}
      {showConfirmModal && selectedMatch && teacherRate !== null && selectedSlots.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>予約確認</h2>
              <button onClick={() => setShowConfirmModal(false)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between py-2.5 border-b border-slate-100 text-sm">
                <span className="text-slate-500">先生</span>
                <span className="font-semibold text-slate-900">{selectedMatch.teacher.full_name || "名前未設定"}</span>
              </div>

              <div className="py-2.5 border-b border-slate-100">
                <span className="text-sm text-slate-500 block mb-2">選択した時間帯</span>
                <div className="space-y-1.5">
                  {selectedSlots.sort((a, b) => a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time)).map((slot) => (
                    <div key={slot.id} className="flex justify-between text-sm px-3 py-2 rounded-lg bg-slate-50">
                      <span className="text-slate-700">
                        {new Date(slot.slot_date + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" })}
                      </span>
                      <span className="font-medium text-slate-900">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                      <span className="text-slate-500">${(teacherRate / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between py-2 text-sm">
                <span className="font-bold text-slate-900">合計（{selectedSlots.length}時間）</span>
                <span className="font-bold text-lg text-indigo-600">${(teacherRate / 100 * selectedSlots.length).toFixed(2)} CAD</span>
              </div>

              <div className="rounded-xl p-3 text-xs text-amber-800" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                決済が完了するまで予約は確定しません。決済画面で支払いを完了してください。
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">キャンセル</button>
                <button
                  onClick={handleBookSelectedSlots}
                  disabled={creatingBooking}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
                >
                  {creatingBooking ? "処理中..." : "決済に進む"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
