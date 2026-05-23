"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, StudentWithProfile, AvailabilitySlot } from "@/lib/types/database.types";
import { X, MapPin, Clock, Target, Sparkles, User, DollarSign, Calendar, Trash2, AlertTriangle } from "lucide-react";
import Avatar from "@/components/Avatar";

type Tab = "students" | "lesson-settings";

export default function TeacherDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingStudentId, setMatchingStudentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("students");

  // レッスン設定用
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // プロフィールとpassphrase_versionを取得
      const [profileResult, versionResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single(),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "passphrase_version")
          .single()
      ]);

      const profileData = profileResult.data;
      const userVersion = profileData?.passphrase_version || 0;
      const currentVersion = parseInt(versionResult.data?.value || "1", 10);

      // adminユーザー以外でバージョンが古ければ再認証ページへ
      if (!profileData?.is_admin && userVersion < currentVersion) {
        router.push("/verify-passphrase");
        return;
      }

      if ((profileData as any)?.role !== "teacher") {
        router.push("/");
        return;
      }

      setProfile(profileData);

      // 先生プロフィールから金額を取得
      const { data: teacherProfile } = await supabase
        .from("teacher_profiles")
        .select("hourly_rate")
        .eq("user_id", user.id)
        .single();

      if (teacherProfile?.hourly_rate) {
        setHourlyRate((teacherProfile.hourly_rate / 100).toString());
      }

      // スロット一覧を取得
      const { data: slotsData } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("teacher_id", user.id)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotsData) {
        setSlots(slotsData as AvailabilitySlot[]);
      }

      // 生徒一覧取得（既にマッチング済みの生徒を除外）
      const { data: matchesData } = await supabase
        .from("matches")
        .select("student_id")
        .eq("teacher_id", user.id);

      const matchedStudentIds = matchesData?.map((m) => m.student_id) || [];

      // クエリビルダー
      let query = supabase
        .from("profiles")
        .select(
          `
          *,
          student_profile:student_profiles(*)
        `
        )
        .eq("role", "student");

      // マッチング済みの生徒がいる場合のみ除外条件を追加
      if (matchedStudentIds.length > 0) {
        query = query.not("id", "in", `(${matchedStudentIds.join(",")})`);
      }

      const { data: studentsData } = await query;

      if (studentsData) {
        // データを StudentWithProfile 型に変換
        const formattedStudents: StudentWithProfile[] = studentsData.map(
          (student) => ({
            ...student,
            student_profile: Array.isArray(student.student_profile)
              ? student.student_profile[0] || null
              : student.student_profile || null,
          })
        );
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

      // 成功したらメッセージページへ
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

    // 1時間ごとのスロットに分割
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

      setSlots((prev) => [...prev, ...(data as AvailabilitySlot[])].sort((a, b) => {
        const dateCompare = a.slot_date.localeCompare(b.slot_date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      }));
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
      const { error } = await supabase
        .from("availability_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (error) {
      console.error("Error deleting slot:", error);
      alert("スロットの削除に失敗しました");
    }
  };

  const getLevelBadge = (level: string | null) => {
    const levels = {
      beginner: { label: "初級", color: "bg-green-100 text-green-800" },
      intermediate: { label: "中級", color: "bg-yellow-100 text-yellow-800" },
      advanced: { label: "上級", color: "bg-red-100 text-red-800" },
    };
    const levelInfo = levels[level as keyof typeof levels] || { label: "未設定", color: "bg-gray-100 text-gray-800" };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${levelInfo.color}`}>
        {levelInfo.label}
      </span>
    );
  };

  // スロットを日付ごとにグループ化
  const groupedSlots = slots.reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
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
    <div className="max-w-7xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">先生ダッシュボード</h1>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("students")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === "students"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          生徒一覧
        </button>
        <button
          onClick={() => setActiveTab("lesson-settings")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${
            activeTab === "lesson-settings"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          レッスン設定
        </button>
      </div>

      {/* 生徒一覧タブ */}
      {activeTab === "students" && (
        <>
          <p className="text-gray-600 mb-4">
            {students.length > 0
              ? `${students.length}名の生徒が見つかりました`
              : "現在、マッチング可能な生徒はいません"
            }
          </p>

          {students.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-xl text-gray-600 mb-2">現在、マッチング可能な生徒はいません</p>
              <p className="text-gray-500">新しい生徒が登録されるまでお待ちください</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                    <div className="flex items-center mb-3">
                      <Avatar
                        url={student.avatar_url}
                        name={student.full_name}
                        fallback="S"
                        className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg"
                      />
                      <div className="ml-4">
                        <h3 className="font-bold text-xl">
                          {student.full_name || "名前未設定"}
                        </h3>
                        <p className="text-indigo-100 text-sm">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      {getLevelBadge(student.student_profile?.japanese_level || null)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {/* 自己紹介 */}
                    {student.student_profile?.bio ? (
                      <div>
                        <div className="flex items-center mb-2">
                          <User className="w-4 h-4 mr-2 text-gray-500" />
                          <h4 className="text-sm font-bold text-gray-700">自己紹介</h4>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3 pl-6">
                          {student.student_profile.bio}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 pl-6">自己紹介が未設定です</div>
                    )}

                    {/* 学習目標 */}
                    {student.student_profile?.learning_goals ? (
                      <div>
                        <div className="flex items-center mb-2">
                          <Target className="w-4 h-4 mr-2 text-gray-500" />
                          <h4 className="text-sm font-bold text-gray-700">学習目標</h4>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3 pl-6">
                          {student.student_profile.learning_goals}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 pl-6">学習目標が未設定です</div>
                    )}

                    {/* 理想の先生像 */}
                    {student.student_profile?.desired_teacher_type ? (
                      <div>
                        <div className="flex items-center mb-2">
                          <Sparkles className="w-4 h-4 mr-2 text-gray-500" />
                          <h4 className="text-sm font-bold text-gray-700">理想の先生像</h4>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 pl-6">
                          {student.student_profile.desired_teacher_type}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 pl-6">理想の先生像が未設定です</div>
                    )}

                    {/* ロケーションと時間帯 */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {student.student_profile?.location ? (
                        <span className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                          <MapPin className="w-3 h-3 mr-1" />
                          {student.student_profile.location}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          場所未設定
                        </span>
                      )}
                      {student.student_profile?.availability ? (
                        <span className="inline-flex items-center bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                          <Clock className="w-3 h-3 mr-1" />
                          {student.student_profile.availability}
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          時間未設定
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 pb-6">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                      >
                        詳細を見る
                      </button>
                      <button
                        onClick={() => handleMatch(student.id)}
                        disabled={matchingStudentId === student.id}
                        className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* レッスン設定タブ */}
      {activeTab === "lesson-settings" && (
        <div className="space-y-8">
          {/* 金額設定 */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-indigo-600" />
              レッスン料金設定
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-medium">$</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="30.00"
                min="0"
                step="0.01"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="text-gray-700">/時間 (CAD)</span>
              <button
                onClick={handleSaveRate}
                disabled={savingRate}
                className="ml-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {savingRate ? "保存中..." : "保存"}
              </button>
            </div>
          </div>

          {/* スケジュール設定 */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
              スケジュール設定
            </h2>

            {/* 重要なご案内 */}
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 leading-relaxed">
                  <p className="font-semibold mb-1">スロット作成前にご確認ください</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      一度予約が入ったスロットは
                      <span className="font-semibold">原則キャンセルできません</span>。
                      確実に対応できる日時のみご登録ください。
                    </li>
                    <li>
                      やむを得ず変更・キャンセルが必要な場合は、
                      <span className="font-semibold">速やかに生徒へ連絡</span>
                      してください。
                    </li>
                    <li>
                      予約状況や直前のキャンセルは信頼に影響します。慎重にスケジュールを設定してください。
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
                <input
                  type="time"
                  value={slotStartTime}
                  onChange={(e) => setSlotStartTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了時刻</label>
                <input
                  type="time"
                  value={slotEndTime}
                  onChange={(e) => setSlotEndTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleAddSlot}
                disabled={addingSlot}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {addingSlot ? "追加中..." : "追加"}
              </button>
            </div>

            {/* 登録済みスロット一覧 */}
            <h3 className="text-md font-semibold text-gray-800 mb-3">登録済みスケジュール</h3>
            {Object.keys(groupedSlots).length === 0 ? (
              <p className="text-gray-500 text-sm">まだスケジュールが登録されていません</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                  <div key={date}>
                    <h4 className="text-sm font-bold text-gray-700 mb-2">
                      {new Date(date + "T00:00:00").toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </h4>
                    <div className="space-y-2 ml-4">
                      {dateSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-700">
                              {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                slot.status === "available"
                                  ? "bg-green-100 text-green-700"
                                  : slot.status === "reserved"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {slot.status === "available"
                                ? "空き"
                                : slot.status === "reserved"
                                ? "決済待ち"
                                : "予約済み"}
                            </span>
                          </div>
                          {slot.status === "available" && (
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white sticky top-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <Avatar
                    url={selectedStudent.avatar_url}
                    name={selectedStudent.full_name}
                    fallback="S"
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-lg"
                  />
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">
                      {selectedStudent.full_name || "名前未設定"}
                    </h2>
                    <p className="text-indigo-100">{selectedStudent.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4">
                {getLevelBadge(selectedStudent.student_profile?.japanese_level || null)}
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <User className="w-5 h-5 mr-2 text-indigo-600" />
                  自己紹介
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.bio || "自己紹介が登録されていません"}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <Target className="w-5 h-5 mr-2 text-indigo-600" />
                  学習目標
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.learning_goals || "学習目標が登録されていません"}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
                  理想の先生像
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.desired_teacher_type || "理想の先生像が登録されていません"}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
                    場所
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedStudent.student_profile?.location || "未設定"}
                  </p>
                </div>

                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <Clock className="w-5 h-5 mr-2 text-indigo-600" />
                    対応可能時間
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedStudent.student_profile?.availability || "未設定"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={() => {
                    handleMatch(selectedStudent.id);
                    setSelectedStudent(null);
                  }}
                  disabled={matchingStudentId === selectedStudent.id}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
