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
  const [matchingStudentId, setMatchingStudentId] = useState<string | null>(
    null
  );

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

      // プロフィール取得
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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

      const { data: studentsData } = await supabase
        .from("profiles")
        .select(
          `
          *,
          student_profile:student_profiles(*)
        `
        )
        .eq("role", "student")
        .not("id", "in", `(${matchedStudentIds.join(",") || "null"})`);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">読み込み中...............................</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">
            先生ダッシュボード
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href="/messages"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              メッセージ
            </Link>
            <span className="text-gray-700">{profile?.full_name}</span>
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">生徒一覧</h2>

        {students.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            現在、マッチング可能な生徒はいません
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                    {student.full_name?.charAt(0) || "S"}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {student.full_name || "名前未設定"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {student.student_profile?.japanese_level === "beginner" &&
                        "初級"}
                      {student.student_profile?.japanese_level ===
                        "intermediate" && "中級"}
                      {student.student_profile?.japanese_level === "advanced" &&
                        "上級"}
                    </p>
                  </div>
                </div>

                {student.student_profile?.bio && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      自己紹介
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {student.student_profile.bio}
                    </p>
                  </div>
                )}

                {student.student_profile?.learning_goals && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      学習目標
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {student.student_profile.learning_goals}
                    </p>
                  </div>
                )}

                {student.student_profile?.desired_teacher_type && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      理想の先生像
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {student.student_profile.desired_teacher_type}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 text-xs text-gray-500 mb-4">
                  {student.student_profile?.location && (
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      📍 {student.student_profile.location}
                    </span>
                  )}
                  {student.student_profile?.availability && (
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      🕐 {student.student_profile.availability}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleMatch(student.id)}
                  disabled={matchingStudentId === student.id}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {matchingStudentId === student.id
                    ? "マッチング中..."
                    : "この生徒を教える"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
