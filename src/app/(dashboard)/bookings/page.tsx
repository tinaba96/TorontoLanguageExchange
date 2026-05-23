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
  X,
  CalendarCheck,
  TrendingUp,
  Users,
  CreditCard,
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
  stripe_payment_intent_id: string | null;
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
      if (!user) { router.push("/login"); return; }
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(profileData as Profile);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!profile) {
    return <div className="text-center py-12 text-slate-500">プロフィール情報を取得できませんでした。</div>;
  }

  if (profile.is_admin) return <AdminBookingsView />;
  if (profile.role === "teacher") return <TeacherBookingsView profile={profile} />;
  return <StudentBookingsView profile={profile} />;
}

// ── Shared utilities ────────────────────────────────────────────────────────────
function formatDateTime(slot: BookingRow["slot"]): string {
  if (!slot) return "-";
  const d = new Date(slot.slot_date + "T00:00:00");
  const dateStr = d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", weekday: "short" });
  return `${dateStr} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    confirmed: { label: "確定", bg: "rgba(16,185,129,0.1)", text: "#059669" },
    paid:      { label: "確定", bg: "rgba(16,185,129,0.1)", text: "#059669" },
    pending_payment: { label: "決済待ち", bg: "rgba(245,158,11,0.1)", text: "#B45309" },
    refunded:  { label: "返金済", bg: "rgba(59,130,246,0.1)", text: "#1D4ED8" },
    cancelled: { label: "キャンセル", bg: "rgba(100,116,139,0.1)", text: "#475569" },
  };
  const c = config[status] ?? { label: status, bg: "rgba(100,116,139,0.1)", text: "#475569" };
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

function isUpcoming(slot: BookingRow["slot"]): boolean {
  if (!slot) return false;
  return new Date(slot.slot_date + "T" + slot.start_time).getTime() > Date.now();
}

function filterBookings(bookings: BookingRow[], time: TimeFilter, status: StatusFilter): BookingRow[] {
  return bookings.filter((b) => {
    if (time === "upcoming" && !isUpcoming(b.slot)) return false;
    if (time === "past" && isUpcoming(b.slot)) return false;
    if (status !== "all" && b.status !== status) return false;
    return true;
  });
}

const SELECT_BASE = `id, status, price_at_booking, teacher_payout_amount, platform_amount, system_amount, paid_at, created_at, student_id, teacher_id, stripe_payment_intent_id, student:student_id(full_name, email), teacher:teacher_id(full_name, email), slot:slot_id(slot_date, start_time, end_time)`;

function normalise(rows: any[]): BookingRow[] {
  return rows.map((r) => ({
    ...r,
    student: Array.isArray(r.student) ? r.student[0] : r.student,
    teacher: Array.isArray(r.teacher) ? r.teacher[0] : r.teacher,
    slot: Array.isArray(r.slot) ? r.slot[0] : r.slot,
  }));
}

// ── Shared sub-components ────────────────────────────────────────────────────────
function PageHeader({ title, subtitle, onRefresh }: { title: string; subtitle: string; onRefresh: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck className="w-5 h-5 text-indigo-500" />
          <h1 className="text-2xl font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>{title}</h1>
        </div>
        <p className="text-slate-500 text-sm">{subtitle}</p>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        title="再読み込み"
      >
        <RefreshCcw className="w-4 h-4" />
        <span className="hidden sm:inline">更新</span>
      </button>
    </div>
  );
}

function TabBar({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div className="flex p-1 rounded-xl gap-1 mb-5 w-fit" style={{ background: '#F1F5F9' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-4 py-1.5 text-sm font-semibold rounded-lg transition-all"
          style={value === opt.value ? { background: 'white', color: '#0B1629', boxShadow: '0 1px 4px rgba(11,22,41,0.1)' } : { color: '#64748B' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = '#0B1629', accent = 'rgba(79,70,229,0.08)' }: { label: string; value: string; icon?: any; color?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      {Icon && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: accent }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      )}
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-extrabold" style={{ color, fontFamily: 'var(--font-syne)' }}>{value}</p>
    </div>
  );
}

function EmptyState({ role, filter }: { role: "student" | "teacher" | "admin"; filter?: TimeFilter }) {
  const messages: Record<string, Record<string, string>> = {
    student: { upcoming: "今後の予約はありません", past: "過去の予約はありません", all: "予約はまだありません" },
    teacher: { upcoming: "今後の予約はありません", past: "過去の予約はありません", all: "予約はまだありません" },
    admin:   { upcoming: "条件に一致する予約はありません", past: "条件に一致する予約はありません", all: "条件に一致する予約はありません" },
  };
  const msg = messages[role][filter ?? "all"];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(79,70,229,0.07)' }}>
        <Calendar className="w-7 h-7 text-indigo-300" />
      </div>
      <p className="text-slate-500 font-medium">{msg}</p>
      {role !== "admin" && (
        <Link href="/messages" className="inline-block mt-3 text-indigo-500 hover:underline text-sm font-semibold">
          メッセージから予約する
        </Link>
      )}
    </div>
  );
}

// ── Student view ────────────────────────────────────────────────────────────────
function StudentBookingsView({ profile }: { profile: Profile }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("bookings").select(SELECT_BASE).eq("student_id", profile.id).in("status", ["confirmed", "paid", "refunded"]).order("created_at", { ascending: false });
    setBookings(normalise((data as any[]) ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterBookings(bookings, timeFilter, "all"), [bookings, timeFilter]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="予約一覧" subtitle="あなたが予約したレッスン" onRefresh={load} />
      <TabBar value={timeFilter} options={[{ value: "upcoming", label: "今後" }, { value: "past", label: "過去" }, { value: "all", label: "すべて" }]} onChange={(v) => setTimeFilter(v as TimeFilter)} />
      {loading ? (
        <div className="p-12 flex justify-center"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState role="student" filter={timeFilter} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((b) => (
            <li key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(79,70,229,0.08)' }}>
                      <Calendar className="w-4 h-4 text-indigo-500" />
                    </div>
                    <p className="font-bold text-slate-900 text-sm leading-snug truncate">{formatDateTime(b.slot)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 ml-10">
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">先生: {b.teacher?.full_name ?? "名前未設定"}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {statusBadge(b.status)}
                  <p className="text-base font-extrabold text-slate-900 mt-1.5">{formatCurrency(b.price_at_booking)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Teacher view ────────────────────────────────────────────────────────────────
function TeacherBookingsView({ profile }: { profile: Profile }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("bookings").select(SELECT_BASE).eq("teacher_id", profile.id).in("status", ["confirmed", "paid", "refunded"]).order("created_at", { ascending: false });
    setBookings(normalise((data as any[]) ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterBookings(bookings, timeFilter, "all"), [bookings, timeFilter]);
  const totalPayout = filtered.reduce((s, b) => s + (b.teacher_payout_amount ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="予約一覧" subtitle="あなたのレッスンに入った予約" onRefresh={load} />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="フィルタ内件数" value={`${filtered.length} 件`} icon={CalendarCheck} color="#4F46E5" accent="rgba(79,70,229,0.08)" />
        <StatCard label="受取予定額" value={formatCurrency(totalPayout)} icon={TrendingUp} color="#059669" accent="rgba(16,185,129,0.08)" />
      </div>

      <TabBar value={timeFilter} options={[{ value: "upcoming", label: "今後" }, { value: "past", label: "過去" }, { value: "all", label: "すべて" }]} onChange={(v) => setTimeFilter(v as TimeFilter)} />

      {loading ? (
        <div className="p-12 flex justify-center"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState role="teacher" filter={timeFilter} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F8F9FB' }}>
                <tr>
                  <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">日時</th>
                  <th className="text-left px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">生徒</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">受取予定</th>
                  <th className="text-center px-5 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-900 font-medium text-sm">{formatDateTime(b.slot)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{b.student?.full_name ?? "名前未設定"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{formatCurrency(b.teacher_payout_amount)}</td>
                    <td className="px-5 py-3.5 text-center">{statusBadge(b.status)}</td>
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

// ── Admin view ──────────────────────────────────────────────────────────────────
function AdminBookingsView() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("confirmed");
  const [periodStart, setPeriodStart] = useState<string>(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); });
  const [periodEnd, setPeriodEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [refundTarget, setRefundTarget] = useState<BookingRow | null>(null);
  const [refundSiblings, setRefundSiblings] = useState<BookingRow[]>([]);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    let query = supabase.from("bookings").select(SELECT_BASE).order("created_at", { ascending: false });
    if (statusFilter === "all" || statusFilter === "cancelled") {
      query = query.gte("created_at", periodStart).lte("created_at", periodEnd + "T23:59:59");
    } else {
      query = query.gte("paid_at", periodStart).lte("paid_at", periodEnd + "T23:59:59");
    }
    if (statusFilter !== "all") {
      const statuses = statusFilter === "confirmed" ? ["confirmed", "paid"] : [statusFilter];
      query = query.in("status", statuses);
    }
    const { data } = await query;
    setBookings(normalise((data as any[]) ?? []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, periodStart, periodEnd]);

  const totals = useMemo(() => bookings.reduce((acc, b) => ({ count: acc.count + 1, gross: acc.gross + b.price_at_booking, teacher: acc.teacher + (b.teacher_payout_amount ?? 0), platform: acc.platform + (b.platform_amount ?? 0), system: acc.system + (b.system_amount ?? 0) }), { count: 0, gross: 0, teacher: 0, platform: 0, system: 0 }), [bookings]);

  const exportCsv = () => {
    const header = ["booking_id", "status", "paid_at", "lesson_date", "lesson_time", "student_name", "student_email", "teacher_name", "teacher_email", "gross_cad", "teacher_payout_cad", "platform_cad", "system_cad"];
    const rows = bookings.map((b) => [b.id, b.status, b.paid_at ?? "", b.slot?.slot_date ?? "", b.slot ? `${b.slot.start_time}-${b.slot.end_time}` : "", b.student?.full_name ?? "", b.student?.email ?? "", b.teacher?.full_name ?? "", b.teacher?.email ?? "", (b.price_at_booking / 100).toFixed(2), ((b.teacher_payout_amount ?? 0) / 100).toFixed(2), ((b.platform_amount ?? 0) / 100).toFixed(2), ((b.system_amount ?? 0) / 100).toFixed(2)]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bookings_${periodStart}_${periodEnd}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const openRefundModal = async (booking: BookingRow) => {
    setRefundTarget(booking); setRefundSiblings([]);
    if (!booking.stripe_payment_intent_id) return;
    const { data } = await supabase.from("bookings").select(SELECT_BASE).eq("stripe_payment_intent_id", booking.stripe_payment_intent_id);
    const all = normalise((data as any[]) ?? []);
    setRefundSiblings(all.filter((b) => b.id !== booking.id));
  };

  const closeRefundModal = () => { setRefundTarget(null); setRefundSiblings([]); };

  const submitRefund = async () => {
    if (!refundTarget) return;
    setProcessingRefund(true);
    try {
      const res = await fetch("/api/stripe/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: refundTarget.id }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error ?? "返金に失敗しました"); return; }
      closeRefundModal();
      setNotice("返金処理を開始しました。数秒後に一覧が更新されます。");
      setTimeout(() => { load(); setNotice(null); }, 3000);
    } catch (err: any) { alert(err?.message ?? "ネットワークエラー"); }
    finally { setProcessingRefund(false); }
  };

  const inputClass = "px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="予約管理" subtitle="全予約の集計・確認・CSVエクスポート" onRefresh={load} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="件数" value={`${totals.count} 件`} icon={CalendarCheck} color="#4F46E5" accent="rgba(79,70,229,0.08)" />
        <StatCard label="売上総額" value={formatCurrency(totals.gross)} icon={DollarSign} color="#0B1629" accent="rgba(11,22,41,0.06)" />
        <StatCard label="先生取分 (70%)" value={formatCurrency(totals.teacher)} icon={Users} color="#059669" accent="rgba(16,185,129,0.08)" />
        <StatCard label="運営取分 (15%)" value={formatCurrency(totals.platform)} icon={TrendingUp} color="#4F46E5" accent="rgba(79,70,229,0.08)" />
        <StatCard label="システム枠 (15%)" value={formatCurrency(totals.system)} icon={CreditCard} color="#64748B" accent="rgba(100,116,139,0.08)" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
              <Filter className="inline w-3 h-3 mr-1" />ステータス
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={inputClass}>
              <option value="confirmed">確定 (paid)</option>
              <option value="refunded">返金済</option>
              <option value="cancelled">キャンセル</option>
              <option value="all">すべて</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">期間（開始）</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">期間（終了）</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
          </div>
          <button
            onClick={exportCsv}
            disabled={bookings.length === 0}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}
          >
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 flex justify-center"><div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : bookings.length === 0 ? (
        <EmptyState role="admin" />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#F8F9FB' }}>
                <tr>
                  {["日時", "生徒", "先生", "売上", "先生", "運営", "システム", "状態", "操作"].map((h) => (
                    <th key={h} className={`px-4 py-3 font-bold text-slate-400 text-xs uppercase tracking-wide ${["売上", "先生", "運営", "システム"].includes(h) ? 'text-right' : ['状態', '操作'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookings.map((b) => {
                  const refundable = (b.status === "confirmed" || b.status === "paid") && !!b.stripe_payment_intent_id;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-900 font-medium whitespace-nowrap text-xs">{formatDateTime(b.slot)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{b.student?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{b.teacher?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 text-xs">{formatCurrency(b.price_at_booking)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 text-xs">{formatCurrency(b.teacher_payout_amount)}</td>
                      <td className="px-4 py-3 text-right text-indigo-600 text-xs">{formatCurrency(b.platform_amount)}</td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs">{formatCurrency(b.system_amount)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(b.status)}</td>
                      <td className="px-4 py-3 text-center">
                        {refundable ? (
                          <button
                            onClick={() => openRefundModal(b)}
                            className="px-3 py-1 text-xs font-bold text-red-600 rounded-lg transition-colors"
                            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}
                          >
                            返金する
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notice toast */}
      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-white px-5 py-3 rounded-2xl shadow-xl text-sm z-50 font-semibold" style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
          {notice}
        </div>
      )}

      {/* Refund modal */}
      {refundTarget && (
        <RefundConfirmModal target={refundTarget} siblings={refundSiblings} processing={processingRefund} onCancel={closeRefundModal} onConfirm={submitRefund} />
      )}
    </div>
  );
}

function RefundConfirmModal({ target, siblings, processing, onCancel, onConfirm }: { target: BookingRow; siblings: BookingRow[]; processing: boolean; onCancel: () => void; onConfirm: () => void }) {
  const totalCount = siblings.length + 1;
  const totalAmount = target.price_at_booking + siblings.reduce((sum, b) => sum + b.price_at_booking, 0);
  const buttonLabel = processing ? "処理中..." : totalCount > 1 ? `全${totalCount}件まとめて返金する` : "返金する";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-syne)' }}>返金確認</h2>
          <button onClick={onCancel} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="flex justify-between py-2.5 border-b border-slate-100">
            <span className="text-slate-500">生徒</span>
            <span className="font-semibold text-slate-900">{target.student?.full_name ?? "—"}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-slate-100">
            <span className="text-slate-500">先生</span>
            <span className="font-semibold text-slate-900">{target.teacher?.full_name ?? "—"}</span>
          </div>
          <div className="py-2 border-b border-slate-100">
            <span className="text-slate-500 text-xs block mb-2">対象予約</span>
            <div className="space-y-1.5">
              {[target, ...siblings].map((b) => (
                <div key={b.id} className="flex justify-between px-3 py-2 rounded-lg bg-slate-50">
                  <span className="text-slate-700">{formatDateTime(b.slot)}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(b.price_at_booking)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-bold text-slate-900">合計返金額</span>
            <span className="font-extrabold text-lg text-red-600">{formatCurrency(totalAmount)} CAD</span>
          </div>

          {siblings.length > 0 && (
            <div className="rounded-xl p-3 text-xs text-amber-800" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              この決済には他に {siblings.length} 件の予約が含まれています。Stripe の仕様により、これらもまとめて返金されます。
            </div>
          )}
          <div className="rounded-xl p-3 text-xs text-red-700" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            この操作は取り消せません。Stripe から顧客のカードへ返金され、対応するレッスン枠は空き状態に戻ります。
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={processing} className="flex-1 py-3 rounded-xl font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50">キャンセル</button>
            <button onClick={onConfirm} disabled={processing} className="flex-1 py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>{buttonLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
