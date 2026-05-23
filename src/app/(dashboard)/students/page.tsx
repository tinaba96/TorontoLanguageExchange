"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, StudentWithProfile, AvailabilitySlot } from "@/lib/types/database.types";
import { X, MapPin, Clock, Target, Sparkles, User, DollarSign, Calendar, Trash2, AlertTriangle, Plus, ChevronRight } from "lucide-react";
import Avatar from "@/components/Avatar";

type Tab = "students" | "lesson-settings";

export default function TeacherDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingStudentId, setMatchingStudentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("students");

  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [savingRate, setSavingRate] = useState(false);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [profileResult, versionResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("app_settings").select("value").eq("key", "passphrase_version").single()
      ]);

      const profileData = profileResult.data;
      const userVersion = profileData?.passphrase_version || 0;
      const currentVersion = parseInt(versionResult.data?.value || "1", 10);

      if (!profileData?.is_admin && userVersion < currentVersion) {
        router.push("/verify-passphrase");
        return;
      }

      if ((profileData as any)?.role !== "teacher") {
        router.push("/");
        return;
      }

      setProfile(profileData);

      const { data: teacherProfile } = await supabase
        .from("teacher_profiles")
        .select("hourly_rate")
        .eq("user_id", user.id)
        .single();

      if (teacherProfile?.hourly_rate) {
        setHourlyRate((teacherProfile.hourly_rate / 100).toString());
      }

      const { data: slotsData } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("teacher_id", user.id)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotsData) setSlots(slotsData as AvailabilitySlot[]);

      const { data: matchesData } = await supabase
        .from("matches")
        .select("student_id")
        .eq("teacher_id", user.id);

      const matchedStudentIds = matchesData?.map((m) => m.student_id) || [];

      let query = supabase
        .from("profiles")
        .select(`*, student_profile:student_profiles(*)`)
        .eq("role", "student");

      if (matchedStudentIds.length > 0) {
        query = query.not("id", "in", `(${matchedStudentIds.join(",")})`);
      }

      const { data: studentsData } = await query;

      if (studentsData) {
        const formattedStudents: StudentWithProfile[] = studentsData.map((student) => ({
          ...student,
          student_profile: Array.isArray(student.student_profile)
            ? student.student_profile[0] || null
            : student.student_profile || null,
        }));
        setStudents(formattedStudents);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async (studentId: string) => {
    if (!profile) return;
    setMatchingStudentId(studentId);
    try {
      const { error } = await supabase.from("matches").insert({
        teacher_id: profile.id,
        student_id: studentId,
      });
      if (error) throw error;
      router.push("/messages");
    } catch (error) {
      console.error("Error creating match:", error);
      alert("マッチングに失敗しました");
    } finally {
      setMatchingStudentId(null);
    }
  };

  const handleSaveRate = async () => {
    if (!profile) return;
    setSavingRate(true);
    try {
      const rateInCents = Math.round(parseFloat(hourlyRate) * 100);
      if (isNaN(rateInCents) || rateInCents <= 0) {
        alert("正しい金額を入力してください");
        return;
      }
      const { error } = await supabase
        .from("teacher_profiles")
        .update({ hourly_rate: rateInCents } as any)
        .eq("user_id", profile.id);
      if (error) throw error;
      alert("金額を保存しました");
    } catch (error) {
      console.error("Error saving rate:", error);
      alert("金額の保存に失敗しました");
    } finally {
      setSavingRate(false);
    }
  };

  const handleAddSlot = async () => {
    if (!profile || !slotDate || !slotStartTime || !slotEndTime) {
      alert("日付・開始時刻・終了時刻を入力してください");
      return;
    }
    if (slotEndTime <= slotStartTime) {
      alert("終了時刻は開始時刻より後に設定してください");
      return;
    }

    const hourlySlots: { start: string; end: string }[] = [];
    const [startH, startM] = slotStartTime.split(":").map(Number);
    const [endH, endM] = slotEndTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + 60 <= endMinutes; m += 60) {
      const sh = String(Math.floor(m / 60)).padStart(2, "0");
      const sm = String(m % 60).padStart(2, "0");
      const eh = String(Math.floor((m + 60) / 60)).padStart(2, "0");
      const em = String((m + 60) % 60).padStart(2, "0");
      hourlySlots.push({ start: `${sh}:${sm}`, end: `${eh}:${em}` });
    }

    if (hourlySlots.length === 0) {
      alert("最低1時間以上の範囲を指定してください");
      return;
    }

    setAddingSlot(true);
    try {
      const inserts = hourlySlots.map((s) => ({
        teacher_id: profile.id,
        slot_date: slotDate,
        start_time: s.start,
        end_time: s.end,
      }));

      const { data, error } = await supabase
        .from("availability_slots")
        .insert(inserts as any)
        .select();

      if (error) throw error;

      setSlots((prev) =>
        [...prev, ...(data as AvailabilitySlot[])].sort((a, b) => {
          const d = a.slot_date.localeCompare(b.slot_date);
          return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
        })
      );
      setSlotDate("");
      setSlotStartTime("");
      setSlotEndTime("");
    } catch (error) {
      console.error("Error adding slot:", error);
      alert("スロットの追加に失敗しました");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const { error } = await supabase.from("availability_slots").delete().eq("id", slotId);
      if (error) throw error;
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (error) {
      console.error("Error deleting slot:", error);
      alert("スロットの削除に失敗しました");
    }
  };

  const getLevelBadge = (level: string | null) => {
    const levels = {
      beginner: { label: "初級", bg: "rgba(16,185,129,0.1)", color: "#059669", border: "rgba(16,185,129,0.25)" },
      intermediate: { label: "中級", bg: "rgba(245,158,11,0.1)", color: "#D97706", border: "rgba(245,158,11,0.25)" },
      advanced: { label: "上級", bg: "rgba(239,68,68,0.1)", color: "#DC2626", border: "rgba(239,68,68,0.25)" },
    };
    const cfg = levels[level as keyof typeof levels] || { label: "未設定", bg: "rgba(100,116,139,0.08)", color: "#64748B", border: "rgba(100,116,139,0.2)" };
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-bold border"
        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
      >
        {cfg.label}
      </span>
    );
  };

  const groupedSlots = slots.reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
    if (!acc[slot.slot_date]) acc[slot.slot_date] = [];
    acc[slot.slot_date].push(slot);
    return acc;
  }, {});

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>
          先生ダッシュボード
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">生徒とマッチングし、レッスンスケジュールを管理しましょう</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {([
          { key: "students", label: "生徒一覧" },
          { key: "lesson-settings", label: "レッスン設定" },
        ] as { key: Tab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={
              activeTab === tab.key
                ? { background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: 'white', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
                : { color: '#64748B' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Students tab */}
      {activeTab === "students" && (
        <>
          <p className="text-sm text-slate-500">
            {students.length > 0
              ? `${students.length}名の生徒が見つかりました`
              : "現在、マッチング可能な生徒はいません"}
          </p>

          {students.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(79,70,229,0.08)' }}>
                <User className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-slate-600 font-medium mb-1">現在、マッチング可能な生徒はいません</p>
              <p className="text-sm text-slate-400">新しい生徒が登録されるまでお待ちください</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
                >
                  {/* Card header */}
                  <div className="relative h-20 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1E3A5F 60%, #4F46E5 100%)' }}>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #6366F1 0%, transparent 60%)' }} />
                  </div>

                  <div className="px-5 pb-5">
                    <div className="flex items-end justify-between -mt-8 mb-4">
                      <div className="w-16 h-16 rounded-2xl ring-4 ring-white overflow-hidden shadow-md">
                        <Avatar
                          url={student.avatar_url}
                          name={student.full_name}
                          fallback="S"
                          className="w-full h-full"
                          imgClassName="w-full h-full object-cover"
                        />
                      </div>
                      {getLevelBadge(student.student_profile?.japanese_level || null)}
                    </div>

                    <h3 className="font-bold text-slate-900 mb-0.5" style={{ fontFamily: 'var(--font-syne)' }}>
                      {student.full_name || "名前未設定"}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4 truncate">{student.email}</p>

                    <div className="space-y-2.5 mb-5">
                      {student.student_profile?.bio && (
                        <div className="flex gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-500 line-clamp-2">{student.student_profile.bio}</p>
                        </div>
                      )}
                      {student.student_profile?.learning_goals && (
                        <div className="flex gap-2">
                          <Target className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-500 line-clamp-2">{student.student_profile.learning_goals}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {student.student_profile?.location && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-xs font-medium">
                          <MapPin className="w-3 h-3" />{student.student_profile.location}
                        </span>
                      )}
                      {student.student_profile?.availability && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-medium">
                          <Clock className="w-3 h-3" />{student.student_profile.availability}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                      >
                        詳細 <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMatch(student.id)}
                        disabled={matchingStudentId === student.id}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
                      >
                        {matchingStudentId === student.id ? "処理中..." : "教える"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lesson settings tab */}
      {activeTab === "lesson-settings" && (
        <div className="space-y-5">
          {/* Rate setting */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,70,229,0.1)' }}>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">レッスン料金設定</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-bold text-lg">$</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="30.00"
                min="0"
                step="0.01"
                className="w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
              <span className="text-sm text-slate-500">/時間 (CAD)</span>
              <button
                onClick={handleSaveRate}
                disabled={savingRate}
                className="ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
              >
                {savingRate ? "保存中..." : "保存"}
              </button>
            </div>
          </div>

          {/* Schedule setting */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">スケジュール設定</h2>
            </div>

            {/* Warning notice */}
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold mb-1">スロット作成前にご確認ください</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>一度予約が入ったスロットは<strong>原則キャンセルできません</strong>。確実に対応できる日時のみご登録ください。</li>
                    <li>やむを得ず変更・キャンセルが必要な場合は、<strong>速やかに生徒へ連絡</strong>してください。</li>
                    <li>予約状況や直前のキャンセルは信頼に影響します。慎重にスケジュールを設定してください。</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Add slot form */}
            <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-slate-50 rounded-2xl">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">日付</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">開始時刻</label>
                <input
                  type="time"
                  value={slotStartTime}
                  onChange={(e) => setSlotStartTime(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">終了時刻</label>
                <input
                  type="time"
                  value={slotEndTime}
                  onChange={(e) => setSlotEndTime(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
              <button
                onClick={handleAddSlot}
                disabled={addingSlot}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
              >
                <Plus className="w-4 h-4" />
                {addingSlot ? "追加中..." : "追加"}
              </button>
            </div>

            {/* Registered slots */}
            <h3 className="text-sm font-bold text-slate-700 mb-3">登録済みスケジュール</h3>
            {Object.keys(groupedSlots).length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">まだスケジュールが登録されていません</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                  <div key={date}>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                        year: "numeric", month: "long", day: "numeric", weekday: "short",
                      })}
                    </h4>
                    <div className="space-y-1.5 ml-2">
                      {dateSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm text-slate-700 font-medium">
                              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={
                                slot.status === "available"
                                  ? { background: 'rgba(16,185,129,0.1)', color: '#059669' }
                                  : slot.status === "reserved"
                                  ? { background: 'rgba(245,158,11,0.1)', color: '#D97706' }
                                  : { background: 'rgba(239,68,68,0.1)', color: '#DC2626' }
                              }
                            >
                              {slot.status === "available" ? "空き" : slot.status === "reserved" ? "決済待ち" : "予約済み"}
                            </span>
                          </div>
                          {slot.status === "available" && (
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student detail modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div
              className="relative p-6 text-white rounded-t-3xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0B1629 0%, #1E3A5F 60%, #4F46E5 100%)' }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #6366F1 0%, transparent 60%)' }} />
              <div className="relative flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl ring-2 ring-white/30 overflow-hidden shadow-lg">
                    <Avatar
                      url={selectedStudent.avatar_url}
                      name={selectedStudent.full_name}
                      fallback="S"
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-syne)' }}>
                      {selectedStudent.full_name || "名前未設定"}
                    </h2>
                    <p className="text-white/60 text-sm">{selectedStudent.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative mt-4">
                {getLevelBadge(selectedStudent.student_profile?.japanese_level || null)}
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5">
              {[
                { icon: <User className="w-4 h-4 text-indigo-500" />, label: "自己紹介", value: selectedStudent.student_profile?.bio, placeholder: "自己紹介が登録されていません", accent: 'rgba(79,70,229,0.1)' },
                { icon: <Target className="w-4 h-4 text-emerald-500" />, label: "学習目標", value: selectedStudent.student_profile?.learning_goals, placeholder: "学習目標が登録されていません", accent: 'rgba(16,185,129,0.1)' },
                { icon: <Sparkles className="w-4 h-4 text-amber-500" />, label: "理想の先生像", value: selectedStudent.student_profile?.desired_teacher_type, placeholder: "理想の先生像が登録されていません", accent: 'rgba(245,158,11,0.1)' },
              ].map(({ icon, label, value, placeholder, accent }) => (
                <div key={label} className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: accent }}>
                      {icon}
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">{label}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed pl-8">
                    {value || <span className="text-slate-400 italic">{placeholder}</span>}
                  </p>
                </div>
              ))}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <MapPin className="w-4 h-4 text-blue-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">場所</h3>
                  </div>
                  <p className="text-sm text-slate-600 pl-8">
                    {selectedStudent.student_profile?.location || <span className="text-slate-400 italic">未設定</span>}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.1)' }}>
                      <Clock className="w-4 h-4 text-purple-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700">対応可能時間</h3>
                  </div>
                  <p className="text-sm text-slate-600 pl-8">
                    {selectedStudent.student_profile?.availability || <span className="text-slate-400 italic">未設定</span>}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={() => { handleMatch(selectedStudent.id); setSelectedStudent(null); }}
                  disabled={matchingStudentId === selectedStudent.id}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
                >
                  {matchingStudentId === selectedStudent.id ? "処理中..." : "この生徒を教える"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
