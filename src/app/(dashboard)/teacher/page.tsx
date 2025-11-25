"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile, StudentWithProfile } from "@/lib/types/database.types";

export default function TeacherDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingStudentId, setMatchingStudentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProfile | null>(null);

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

      // バージョンが古ければ再認証ページへ
      if (userVersion < currentVersion) {
        router.push("/verify-passphrase");
        return;
      }

      if ((profileData as any)?.role !== "teacher") {
        router.push("/");
        return;
      }

      setProfile(profileData);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">先生マッチング</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/announcements"
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              全体告知
            </Link>
            <Link
              href="/board"
              className="text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              掲示板
            </Link>
            <Link
              href="/messages"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              メッセージ
            </Link>
            {profile?.is_admin && (
              <Link
                href="/settings"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                設定
              </Link>
            )}
            <span className="text-gray-700 font-medium">{profile?.full_name}</span>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">生徒一覧</h2>
          <p className="text-gray-600">
            {students.length > 0
              ? `${students.length}名の生徒が見つかりました`
              : "現在、マッチング可能な生徒はいません"
            }
          </p>
        </div>

        {students.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-xl text-gray-600 mb-2">現在、マッチング可能な生徒はいません</p>
            <p className="text-gray-500">新しい生徒が登録されるまでお待ちください</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                  <div className="flex items-center mb-3">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-lg">
                      {student.full_name?.charAt(0) || "S"}
                    </div>
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
                        <span className="text-lg mr-2">👤</span>
                        <h4 className="text-sm font-bold text-gray-700">自己紹介</h4>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3 pl-7">
                        {student.student_profile.bio}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 pl-7">自己紹介が未設定です</div>
                  )}

                  {/* 学習目標 */}
                  {student.student_profile?.learning_goals ? (
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="text-lg mr-2">🎯</span>
                        <h4 className="text-sm font-bold text-gray-700">学習目標</h4>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3 pl-7">
                        {student.student_profile.learning_goals}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 pl-7">学習目標が未設定です</div>
                  )}

                  {/* 理想の先生像 */}
                  {student.student_profile?.desired_teacher_type ? (
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="text-lg mr-2">✨</span>
                        <h4 className="text-sm font-bold text-gray-700">理想の先生像</h4>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 pl-7">
                        {student.student_profile.desired_teacher_type}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 pl-7">理想の先生像が未設定です</div>
                  )}

                  {/* ロケーションと時間帯 */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {student.student_profile?.location ? (
                      <span className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                        📍 {student.student_profile.location}
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                        📍 場所未設定
                      </span>
                    )}
                    {student.student_profile?.availability ? (
                      <span className="inline-flex items-center bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                        🕐 {student.student_profile.availability}
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-xs">
                        🕐 時間未設定
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
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white sticky top-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-3xl shadow-lg">
                    {selectedStudent.full_name?.charAt(0) || "S"}
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold">
                      {selectedStudent.full_name || "名前未設定"}
                    </h2>
                    <p className="text-indigo-100">{selectedStudent.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-white hover:text-gray-200 text-3xl leading-none"
                >
                  ×
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
                  <span className="text-2xl mr-2">👤</span>
                  自己紹介
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.bio || "自己紹介が登録されていません"}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <span className="text-2xl mr-2">🎯</span>
                  学習目標
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.learning_goals || "学習目標が登録されていません"}
                </p>
              </div>

              <div>
                <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                  <span className="text-2xl mr-2">✨</span>
                  理想の先生像
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedStudent.student_profile?.desired_teacher_type || "理想の先生像が登録されていません"}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <span className="text-2xl mr-2">📍</span>
                    場所
                  </h3>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {selectedStudent.student_profile?.location || "未設定"}
                  </p>
                </div>

                <div>
                  <h3 className="flex items-center text-lg font-bold text-gray-900 mb-3">
                    <span className="text-2xl mr-2">🕐</span>
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
