"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database.types";
import {
  Calendar,
  Clock,
  DollarSign,
  Download,
  Filter,
  RefreshCcw,
  User,
} from "lucide-react";

type BookingRow = {
  id: string;
  status: string;
  price_at_booking: number;
  teacher_payout_amount: number | null;
  platform_amount: number | null;
  system_amount: number | null;
  paid_at: string | null;
  created_at: string;
  student_id: string;
  teacher_id: string;
  student: { full_name: string | null; email: string | null } | null;
  teacher: { full_name: string | null; email: string | null } | null;
  slot: { slot_date: string; start_time: string; end_time: string } | null;
};

type TimeFilter = "upcoming" | "past" | "all";
type StatusFilter = "all" | "confirmed" | "refunded" | "cancelled";

export default function BookingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData as Profile);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-gray-600">
        プロフィール情報を取得できませんでした。
      </div>
    );
  }

  if (profile.is_admin) return <AdminBookingsView />;
  if (profile.role === "teacher") return <TeacherBookingsView profile={profile} />;
  return <StudentBookingsView profile={profile} />;
}

// ============================================================
// Shared utilities
// ============================================================
function formatDateTime(slot: BookingRow["slot"]): string {
  if (!slot) return "-";
  const d = new Date(slot.slot_date + "T00:00:00");
  const dateStr = d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  return `${dateStr} ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    paid: "bg-green-100 text-green-700",
    pending_payment: "bg-amber-100 text-amber-700",
    refunded: "bg-blue-100 text-blue-700",
    cancelled: "bg-gray-200 text-gray-600",
  };
  const labels: Record<string, string> = {
    confirmed: "確定",
    paid: "確定",
    pending_payment: "決済待ち",
    refunded: "返金済",
    cancelled: "キャンセル",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function isUpcoming(slot: BookingRow["slot"]): boolean {
  if (!slot) return false;
  const lessonStart = new Date(slot.slot_date + "T" + slot.start_time);
  return lessonStart.getTime() > Date.now();
}

function filterBookings(
  bookings: BookingRow[],
  time: TimeFilter,
  status: StatusFilter,
): BookingRow[] {
  return bookings.filter((b) => {
    if (time === "upcoming" && !isUpcoming(b.slot)) return false;
    if (time === "past" && isUpcoming(b.slot)) return false;
    if (status !== "all" && b.status !== status) return false;
    return true;
  });
}

const SELECT_BASE = `
  id,
  status,
  price_at_booking,
  teacher_payout_amount,
  platform_amount,
  system_amount,
  paid_at,
  created_at,
  student_id,
  teacher_id,
  student:student_id(full_name, email),
  teacher:teacher_id(full_name, email),
  slot:slot_id(slot_date, start_time, end_time)
`;

function normalise(rows: any[]): BookingRow[] {
  return rows.map((r) => ({
    ...r,
    student: Array.isArray(r.student) ? r.student[0] : r.student,
    teacher: Array.isArray(r.teacher) ? r.teacher[0] : r.teacher,
    slot: Array.isArray(r.slot) ? r.slot[0] : r.slot,
  }));
}

// ============================================================
// Student view
// ============================================================
function StudentBookingsView({ profile }: { profile: Profile }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select(SELECT_BASE)
      .eq("student_id", profile.id)
      .in("status", ["confirmed", "paid", "refunded"])
      .order("created_at", { ascending: false });
    setBookings(normalise((data as any[]) ?? []));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => filterBookings(bookings, timeFilter, "all"),
    [bookings, timeFilter],
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Header
        title="予約一覧"
        subtitle="あなたが予約したレッスン"
        onRefresh={load}
      />
      <TabBar
        value={timeFilter}
        options={[
          { value: "upcoming", label: "今後" },
          { value: "past", label: "過去" },
          { value: "all", label: "すべて" },
        ]}
        onChange={(v) => setTimeFilter(v as TimeFilter)}
      />
      {loading ? (
        <div className="p-10 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <EmptyState role="student" filter={timeFilter} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((b) => (
            <li
              key={b.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <p className="font-semibold text-gray-900 truncate">
                      {formatDateTime(b.slot)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">
                      先生: {b.teacher?.full_name ?? "名前未設定"}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {statusBadge(b.status)}
                  <p className="text-sm text-gray-900 font-semibold mt-1">
                    {formatCurrency(b.price_at_booking)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Teacher view
// ============================================================
function TeacherBookingsView({ profile }: { profile: Profile }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select(SELECT_BASE)
      .eq("teacher_id", profile.id)
      .in("status", ["confirmed", "paid", "refunded"])
      .order("created_at", { ascending: false });
    setBookings(normalise((data as any[]) ?? []));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => filterBookings(bookings, timeFilter, "all"),
    [bookings, timeFilter],
  );

  const totalPayout = filtered.reduce(
    (s, b) => s + (b.teacher_payout_amount ?? 0),
    0,
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Header
        title="予約一覧"
        subtitle="あなたのレッスンに入った予約"
        onRefresh={load}
      />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <SummaryCard label="件数" value={`${filtered.length} 件`} />
        <SummaryCard label="受取予定額（フィルタ内）" value={formatCurrency(totalPayout)} />
      </div>
      <TabBar
        value={timeFilter}
        options={[
          { value: "upcoming", label: "今後" },
          { value: "past", label: "過去" },
          { value: "all", label: "すべて" },
        ]}
        onChange={(v) => setTimeFilter(v as TimeFilter)}
      />
      {loading ? (
        <div className="p-10 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <EmptyState role="teacher" filter={timeFilter} />
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">日時</th>
                <th className="text-left px-4 py-2 font-semibold">生徒</th>
                <th className="text-right px-4 py-2 font-semibold">受取予定</th>
                <th className="text-center px-4 py-2 font-semibold">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{formatDateTime(b.slot)}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {b.student?.full_name ?? "名前未設定"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                    {formatCurrency(b.teacher_payout_amount)}
                  </td>
                  <td className="px-4 py-2 text-center">{statusBadge(b.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Admin view
// ============================================================
function AdminBookingsView() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("confirmed");
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("bookings")
      .select(SELECT_BASE)
      .order("created_at", { ascending: false });

    // For confirmed bookings filter by paid_at; otherwise by created_at.
    if (statusFilter === "all" || statusFilter === "cancelled") {
      query = query
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd + "T23:59:59");
    } else {
      query = query
        .gte("paid_at", periodStart)
        .lte("paid_at", periodEnd + "T23:59:59");
    }

    if (statusFilter !== "all") {
      const statuses =
        statusFilter === "confirmed" ? ["confirmed", "paid"] : [statusFilter];
      query = query.in("status", statuses);
    }

    const { data } = await query;
    setBookings(normalise((data as any[]) ?? []));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, periodStart, periodEnd]);

  const totals = useMemo(() => {
    return bookings.reduce(
      (acc, b) => ({
        count: acc.count + 1,
        gross: acc.gross + b.price_at_booking,
        teacher: acc.teacher + (b.teacher_payout_amount ?? 0),
        platform: acc.platform + (b.platform_amount ?? 0),
        system: acc.system + (b.system_amount ?? 0),
      }),
      { count: 0, gross: 0, teacher: 0, platform: 0, system: 0 },
    );
  }, [bookings]);

  const exportCsv = () => {
    const header = [
      "booking_id",
      "status",
      "paid_at",
      "lesson_date",
      "lesson_time",
      "student_name",
      "student_email",
      "teacher_name",
      "teacher_email",
      "gross_cad",
      "teacher_payout_cad",
      "platform_cad",
      "system_cad",
    ];
    const rows = bookings.map((b) => [
      b.id,
      b.status,
      b.paid_at ?? "",
      b.slot?.slot_date ?? "",
      b.slot ? `${b.slot.start_time}-${b.slot.end_time}` : "",
      b.student?.full_name ?? "",
      b.student?.email ?? "",
      b.teacher?.full_name ?? "",
      b.teacher?.email ?? "",
      (b.price_at_booking / 100).toFixed(2),
      ((b.teacher_payout_amount ?? 0) / 100).toFixed(2),
      ((b.platform_amount ?? 0) / 100).toFixed(2),
      ((b.system_amount ?? 0) / 100).toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${periodStart}_${periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <Header
        title="予約管理"
        subtitle="全予約の集計・確認・CSVエクスポート"
        onRefresh={load}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <SummaryCard label="件数" value={`${totals.count} 件`} />
        <SummaryCard label="売上総額" value={formatCurrency(totals.gross)} />
        <SummaryCard
          label="先生取分 (70%)"
          value={formatCurrency(totals.teacher)}
          color="text-green-700"
        />
        <SummaryCard
          label="運営取分 (15%)"
          value={formatCurrency(totals.platform)}
          color="text-indigo-700"
        />
        <SummaryCard
          label="システム枠 (15%)"
          value={formatCurrency(totals.system)}
          color="text-gray-600"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <Filter className="inline w-3 h-3 mr-1" />
              ステータス
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="confirmed">確定 (paid)</option>
              <option value="refunded">返金済</option>
              <option value="cancelled">キャンセル</option>
              <option value="all">すべて</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              期間（開始）
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              期間（終了）
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={bookings.length === 0}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-10 text-center text-gray-500">読み込み中...</div>
      ) : bookings.length === 0 ? (
        <EmptyState role="admin" />
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">日時</th>
                  <th className="text-left px-3 py-2 font-semibold">生徒</th>
                  <th className="text-left px-3 py-2 font-semibold">先生</th>
                  <th className="text-right px-3 py-2 font-semibold">売上</th>
                  <th className="text-right px-3 py-2 font-semibold">先生</th>
                  <th className="text-right px-3 py-2 font-semibold">運営</th>
                  <th className="text-right px-3 py-2 font-semibold">システム</th>
                  <th className="text-center px-3 py-2 font-semibold">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                      {formatDateTime(b.slot)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {b.student?.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {b.teacher?.full_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(b.price_at_booking)}
                    </td>
                    <td className="px-3 py-2 text-right text-green-700">
                      {formatCurrency(b.teacher_payout_amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-indigo-700">
                      {formatCurrency(b.platform_amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatCurrency(b.system_amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {statusBadge(b.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Small shared components
// ============================================================
function Header({
  title,
  subtitle,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">{subtitle}</p>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        title="再読み込み"
      >
        <RefreshCcw className="w-4 h-4" />
        <span className="hidden sm:inline">更新</span>
      </button>
    </div>
  );
}

function TabBar({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1 mb-4 w-fit">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === opt.value
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({
  role,
  filter,
}: {
  role: "student" | "teacher" | "admin";
  filter?: TimeFilter;
}) {
  const messages = {
    student: {
      upcoming: "今後の予約はありません",
      past: "過去の予約はありません",
      all: "予約はまだありません",
    },
    teacher: {
      upcoming: "今後の予約はありません",
      past: "過去の予約はありません",
      all: "予約はまだありません",
    },
    admin: {
      upcoming: "条件に一致する予約はありません",
      past: "条件に一致する予約はありません",
      all: "条件に一致する予約はありません",
    },
  };
  const msg = messages[role][filter ?? "all"];
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-10 text-center">
      <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" />
      <p className="text-gray-500">{msg}</p>
      {role !== "admin" && (
        <Link
          href="/messages"
          className="inline-block mt-3 text-indigo-600 hover:underline text-sm"
        >
          メッセージから予約する
        </Link>
      )}
    </div>
  );
}
