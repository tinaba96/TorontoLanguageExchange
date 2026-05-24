"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database.types";
import Avatar from "@/components/Avatar";
import { ArrowRight, Users, Calendar, MessageSquare, Star, Globe, ChevronDown, Mail } from "lucide-react";

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, suffix, label, delay, href }: { value: number; suffix: string; label: string; delay: string; href?: string }) {
  const [visible, setVisible] = useState(false);
  const count = useCounter(value, 1800, visible);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const inner = (
    <>
      <div
        className="text-5xl md:text-6xl font-bold mb-2 transition-transform duration-300 group-hover:scale-105"
        style={{ fontFamily: "var(--font-syne)", color: "#FF6B6B" }}
      >
        {count}{suffix}
      </div>
      <div className="text-sm md:text-base text-slate-300 font-medium tracking-wide uppercase">
        {label}
      </div>
      {href && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
          参加する <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block text-center animate-fade-up cursor-pointer"
        style={{ animationDelay: delay, animationFillMode: "both" }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="text-center animate-fade-up" style={{ animationDelay: delay, animationFillMode: "both" }}>
      {inner}
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ num, title, desc, icon: Icon, href }: { num: string; title: string; desc: string; icon: any; href?: string }) {
  const className = "group relative bg-white rounded-2xl p-8 border border-slate-100 hover-lift shadow-sm hover:shadow-xl transition-all duration-300 block";
  const inner = (
    <>
      <div className="absolute -top-4 -left-4 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg" style={{ fontFamily: "var(--font-syne)" }}>
        {num}
      </div>
      <div className="mb-5 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
        <Icon className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors duration-300" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: "var(--font-syne)" }}>{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
      {href && (
        <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
          始める <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </>
  );

  if (href) {
    return (<Link href={href} className={className}>{inner}</Link>);
  }
  return (<div className={className}>{inner}</div>);
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const goToDashboard = () => {
    if (profile?.role === "teacher") {
      router.push("/students");
    } else if (profile?.role === "student") {
      router.push("/student");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0B1629" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">読み込みしています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── TOP NAV ───────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16"
        style={{ background: "rgba(11, 22, 41, 0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne)", background: "linear-gradient(135deg, #818CF8, #6366F1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              LTOC
            </span>
            <div className="hidden sm:block h-5 w-px bg-slate-600 mx-1" />
            <span className="hidden sm:block text-xs text-slate-400 font-medium tracking-widest uppercase">Language & Toronto Community</span>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link href="/announcements" className="hidden md:inline text-sm text-slate-300 hover:text-white transition-colors">
            イベント
          </Link>
          <Link href="/board" className="hidden md:inline text-sm text-slate-300 hover:text-white transition-colors">
            掲示板
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={goToDashboard}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}
              >
                ダッシュボード
              </button>
              <div className="flex items-center gap-2">
                <Avatar
                  url={profile?.avatar_url}
                  name={profile?.full_name}
                  className="w-8 h-8 bg-indigo-700 rounded-full flex items-center justify-center text-white font-bold text-sm"
                />
                <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-white transition-colors">
                  ログアウト
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-sm text-slate-300 hover:text-white px-3 py-2 transition-colors">
                ログイン
              </Link>
              <Link href="/signup" className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}>
                新規登録
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: "#0B1629" }}>
        {/* Background photo with overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1800&auto=format&fit=crop&q=80"
            alt="People studying together in a cafe"
            fill
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(11,22,41,0.97) 0%, rgba(11,22,41,0.7) 50%, rgba(11,22,41,0.85) 100%)" }} />
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        </div>

        {/* Floating accent orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "#4F46E5" }} />
        <div className="absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "#FF6B6B" }} />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10 pt-24 pb-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-8 animate-fade-up"
                style={{ background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", color: "#818CF8", animationFillMode: "both" }}>
                <Globe className="w-3.5 h-3.5" />
                Language & Toronto Community
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6 animate-fade-up"
                style={{ fontFamily: "var(--font-syne)", animationDelay: "80ms", animationFillMode: "both" }}>
                <span className="text-white">トロントで</span>
                <br />
                <span style={{ background: "linear-gradient(135deg, #818CF8 0%, #6366F1 40%, #FF6B6B 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  言語交換
                </span>
                <span className="text-white">、</span>
                <br />
                <span className="text-white">新しい出会いを</span>
              </h1>

              {/* Sub */}
              <p className="text-lg text-slate-300 leading-relaxed mb-10 max-w-lg animate-fade-up"
                style={{ animationDelay: "160ms", animationFillMode: "both" }}>
                日本語を教えたい日本人と、日本語を学びたい英語話者をつなぐ
                トロント発のコミュニティプラットフォーム。
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: "240ms", animationFillMode: "both" }}>
                {user ? (
                  <>
                    <button
                      onClick={goToDashboard}
                      className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)", boxShadow: "0 0 40px rgba(79,70,229,0.3)" }}
                    >
                      ダッシュボードへ
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <Link href="/messages"
                      className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-200 hover:bg-white/10"
                      style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
                      メッセージ
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/signup"
                      className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
                      style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)", boxShadow: "0 0 40px rgba(79,70,229,0.3)" }}>
                      無料で始める
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link href="/login"
                      className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-200 hover:bg-white/10"
                      style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
                      ログイン
                    </Link>
                  </>
                )}
              </div>

              {/* Trust line */}
              <div className="mt-10 flex items-center gap-3 animate-fade-up" style={{ animationDelay: "320ms", animationFillMode: "both" }}>
                <div className="flex -space-x-2">
                  {[
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&auto=format&fit=crop&q=80",
                    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&auto=format&fit=crop&q=80",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&auto=format&fit=crop&q=80",
                    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&auto=format&fit=crop&q=80",
                  ].map((src, i) => (
                    <div key={i} className="w-9 h-9 rounded-full border-2 overflow-hidden" style={{ borderColor: "#0B1629" }}>
                      <Image src={src} alt="member" width={36} height={36} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-slate-400 text-xs">200人以上のアクティブメンバー</p>
                </div>
              </div>
            </div>

            {/* Right: Photo card stack */}
            <div className="relative hidden lg:block">
              <div className="relative">
                {/* Main photo */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ height: "480px" }}>
                  <Image
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80"
                    alt="Language exchange session"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(11,22,41,0.6) 0%, transparent 60%)" }} />
                  {/* Floating caption */}
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="glass rounded-2xl p-4">
                      <p className="text-white text-sm font-medium leading-relaxed">
                        「英語の練習ができて、しかも収入も得られる。こんな理想的な環境は他にありません！」
                      </p>
                      <p className="text-slate-300 text-xs mt-2">— Takeshi, Japanese Teacher</p>
                    </div>
                  </div>
                </div>

                {/* Floating secondary card */}
                <div className="absolute -bottom-8 -left-8 w-52 rounded-2xl overflow-hidden shadow-xl border-2" style={{ borderColor: "#0B1629", height: "140px" }}>
                  <Image
                    src="https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&auto=format&fit=crop&q=80"
                    alt="Coffee study"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(11,22,41,0.7) 0%, transparent 50%)" }} />
                  <div className="absolute bottom-3 left-3">
                    <p className="text-white text-xs font-semibold">毎月のイベント</p>
                    <p className="text-slate-300 text-xs">50+ 開催中</p>
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 glass-dark rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-white text-xs font-semibold">Now Accepting</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500 animate-bounce">
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────────── */}
      <section style={{ background: "#0B1629" }} className="py-20 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <div className="grid grid-cols-3 gap-8 md:gap-16">
            <StatCard value={200} suffix="+" label="アクティブメンバー" delay="0ms" href={user ? undefined : "/signup"} />
            <StatCard value={150} suffix="+" label="言語交換セッション" delay="100ms" href={user ? undefined : "/signup"} />
            <StatCard value={50} suffix="+" label="毎月のイベント" delay="200ms" href={user ? undefined : "/signup"} />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          {/* Section header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6"
              style={{ background: "rgba(79,70,229,0.07)", color: "#4F46E5" }}>
              How it works
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4" style={{ fontFamily: "var(--font-syne)" }}>
              3ステップで始めよう
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              登録から最初のレッスンまで、シンプルなプロセスで始められます。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 stagger-children">
            <StepCard
              num="01"
              icon={Users}
              title="プロフィール登録"
              desc="合言葉を取得してコミュニティに参加。自己紹介とスケジュールを設定しましょう。"
              href={user ? undefined : "/signup"}
            />
            <StepCard
              num="02"
              icon={MessageSquare}
              title="マッチング＆メッセージ"
              desc="パートナーとマッチングしてチャット。お互いのスケジュールを確認して予約を入れましょう。"
              href={user ? undefined : "/signup"}
            />
            <StepCard
              num="03"
              icon={Calendar}
              title="レッスン開始"
              desc="カフェやオンラインで言語交換セッション。英語と日本語を教え合いながら友達の輪を広げよう。"
              href={user ? undefined : "/signup"}
            />
          </div>
        </div>
      </section>

      {/* ── PHOTO FEATURE SECTION ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: "#F8F9FB" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Photos grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl overflow-hidden shadow-lg" style={{ height: "280px" }}>
                <Image
                  src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500&auto=format&fit=crop&q=80"
                  alt="Toronto community"
                  width={500}
                  height={280}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg mt-8" style={{ height: "280px" }}>
                <Image
                  src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&auto=format&fit=crop&q=80"
                  alt="Friends studying"
                  width={500}
                  height={280}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg" style={{ height: "180px" }}>
                <Image
                  src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80"
                  alt="Coffee conversation"
                  width={500}
                  height={180}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg mt-4" style={{ height: "180px" }}>
                <Image
                  src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&auto=format&fit=crop&q=80"
                  alt="Event gathering"
                  width={500}
                  height={180}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-6"
                style={{ background: "rgba(255,107,107,0.08)", color: "#FF6B6B" }}>
                Community
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight" style={{ fontFamily: "var(--font-syne)" }}>
                ワーホリ中の
                <br />
                <span style={{ color: "#4F46E5" }}>理想的な</span>
                <br />
                稼ぎ方
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                お小遣い程度の収入を得ながら英語の練習もできる。LTOCは日本人ワーホリと英語話者を自然につなぐコミュニティです。
              </p>
              <div className="space-y-4 mb-10">
                {[
                  { icon: "💰", text: "レッスンで収入を得ながら英語も上達" },
                  { icon: "🤝", text: "安心・安全なコミュニティで出会える" },
                  { icon: "🗓️", text: "自分のペースで予定を組める柔軟なスケジュール" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm border border-slate-100">
                    <span className="text-2xl">{item.icon}</span>
                    <p className="text-slate-700 font-medium text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
              <Link href="/announcements"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)" }}>
                イベントを見る
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────────── */}
      <section style={{ background: "#0B1629" }} className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "48px 48px" }} />
        {/* Accent orbs */}
        <div className="absolute top-1/3 left-10 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "#4F46E5" }} />
        <div className="absolute bottom-1/4 right-10 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "#FF6B6B" }} />

        <div className="relative max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-4"
              style={{ background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.25)", color: "#FF8888" }}>
              <Star className="w-3.5 h-3.5 fill-current" />
              メンバーの声
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: "var(--font-syne)" }}>
              リアルな <span style={{ background: "linear-gradient(135deg, #818CF8, #FF6B6B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>体験談</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              トロントのコミュニティで活躍するメンバーから届いたメッセージ
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "お小遣い程度の収入を得ながら、英語の練習もできる。こんな理想的な環境は他にありません！",
                name: "Takeshi",
                role: "Japanese Teacher · Toronto",
                photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&auto=format&fit=crop&q=80",
                accent: "#4F46E5",
                tag: "ワーホリ中",
              },
              {
                quote: "日本人の友達が増えて、レッスンが毎週の楽しみに。文化交流も自然にできて本当に楽しい。",
                name: "Emma",
                role: "English Speaker · Downtown",
                photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&auto=format&fit=crop&q=80",
                accent: "#FF6B6B",
                tag: "学習歴 6ヶ月",
              },
              {
                quote: "始めて2ヶ月でレギュラーの生徒さんが5人に。トロント生活の支えになっています。",
                name: "Hiroshi",
                role: "Japanese Teacher · West End",
                photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&auto=format&fit=crop&q=80",
                accent: "#10B981",
                tag: "アクティブメンバー",
              },
            ].map((t, i) => {
              const cardClass = "group relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 block";
              const cardStyle = {
                background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
              } as any;
              const cardInner = (
                <>
                  {/* Top accent line */}
                  <div className="absolute top-0 left-8 right-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }} />

                  {/* Tag */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase mb-5"
                    style={{ background: `${t.accent}1a`, color: t.accent, border: `1px solid ${t.accent}33` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
                    {t.tag}
                  </div>

                  {/* Quote mark */}
                  <div className="text-5xl leading-none mb-3 opacity-30" style={{ fontFamily: "var(--font-syne)", color: t.accent }}>"</div>

                  {/* Quote */}
                  <blockquote className="text-white text-base leading-relaxed mb-8 min-h-[6.5rem]">
                    {t.quote}
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-5 border-t border-white/5">
                    <div className="w-11 h-11 rounded-full overflow-hidden ring-2" style={{ ringColor: t.accent } as any}>
                      <Image
                        src={t.photo}
                        alt={t.name}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{t.name}</p>
                      <p className="text-slate-400 text-xs">{t.role}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                    </div>
                  </div>

                  {!user && (
                    <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      仲間になる <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </>
              );

              if (!user) {
                return (
                  <Link key={i} href="/signup" className={cardClass} style={cardStyle}>
                    {cardInner}
                  </Link>
                );
              }
              return (
                <div key={i} className={cardClass} style={cardStyle}>
                  {cardInner}
                </div>
              );
            })}
          </div>

          {/* CTA below testimonials */}
          {!user && (
            <div className="text-center mt-14">
              <p className="text-slate-400 mb-5 text-sm">あなたも次のメンバーになりませんか？</p>
              <Link href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #4F46E5, #6366F1)", boxShadow: "0 0 30px rgba(79,70,229,0.3)" }}>
                無料で参加する
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── PUBLIC LINKS SECTION ──────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3" style={{ fontFamily: "var(--font-syne)" }}>
              まずは見てみよう
            </h2>
            <p className="text-slate-500">登録不要でアクセスできるコンテンツ</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Link href="/announcements"
              className="group relative overflow-hidden rounded-2xl p-8 border border-slate-100 hover-lift shadow-sm hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 -mr-8 -mt-8" style={{ background: "#4F46E5" }} />
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-5 group-hover:bg-indigo-600 transition-colors">
                <Calendar className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: "var(--font-syne)" }}>全体告知</h3>
              <p className="text-slate-500 text-sm mb-4">運営からのお知らせやイベント情報をチェック</p>
              <div className="inline-flex items-center gap-1 text-indigo-600 text-sm font-semibold">
                見てみる <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
            <Link href="/board"
              className="group relative overflow-hidden rounded-2xl p-8 border border-slate-100 hover-lift shadow-sm hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 -mr-8 -mt-8" style={{ background: "#FF6B6B" }} />
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-5 group-hover:bg-coral transition-colors" style={{ "--coral": "#FF6B6B" } as any}>
                <MessageSquare className="w-6 h-6 text-red-400 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: "var(--font-syne)" }}>掲示板</h3>
              <p className="text-slate-500 text-sm mb-4">コミュニティで情報交換・交流</p>
              <div className="inline-flex items-center gap-1 text-red-400 text-sm font-semibold">
                見てみる <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-4xl mx-auto px-6 md:px-10 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6" style={{ fontFamily: "var(--font-syne)" }}>
            今すぐコミュニティに参加しよう
          </h2>
          <p className="text-indigo-100 text-lg mb-10 max-w-xl mx-auto">
            トロントで新しい出会いと言語スキルを手に入れる — LTOCが繋ぐ人とチャンスに飛び込もう。
          </p>
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup"
                className="px-10 py-4 rounded-2xl font-bold text-indigo-600 bg-white hover:bg-indigo-50 transition-all hover:scale-[1.02] shadow-xl">
                無料登録する
              </Link>
              <Link href="/announcements"
                className="px-10 py-4 rounded-2xl font-bold text-white transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
                イベントを見る
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0B1629" }} className="py-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="text-xl font-extrabold" style={{ fontFamily: "var(--font-syne)", background: "linear-gradient(135deg, #818CF8, #6366F1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                LTOC
              </span>
              <span className="text-slate-500 text-sm">Language & Toronto Community</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <Link href="/announcements" className="hover:text-white transition-colors">イベント</Link>
              <Link href="/board" className="hover:text-white transition-colors">掲示板</Link>
              <Link href="/login" className="hover:text-white transition-colors">ログイン</Link>
              <Link href="/signup" className="hover:text-white transition-colors">新規登録</Link>
              <a
                href="mailto:info@ltoc.ca"
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                info@ltoc.ca
              </a>
            </div>
            <p className="text-slate-600 text-xs">© 2025 LTOC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
