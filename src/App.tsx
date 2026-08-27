import { useEffect, useRef, useState } from "react";

import {
  Award,
  BookOpen,
  CalendarDays,
  Camera,
  Coins,
  CreditCard,
  MessageCircle,
  Newspaper,
  TrendingUp,
} from "lucide-react";

import { claimBirthdayReward, BirthdayReward } from "@/birthdayApi";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { FeedbackCard } from "@/components/FeedbackCard";
import { Header } from "@/components/Header";
import { OverviewCards } from "@/components/OverviewCards";
import { ParentAuth } from "@/components/ParentAuth";
import { ProfileCard } from "@/components/ProfileCard";
import { AchievementsTab } from "@/components/tabs/AchievementsTab";
import { CoinsTab } from "@/components/tabs/CoinsTab";
import { CommentsTab } from "@/components/tabs/CommentsTab";
import { HomeworkTab } from "@/components/tabs/HomeworkTab";
import { NewsTab } from "@/components/tabs/NewsTab";
import { PaymentsTab } from "@/components/tabs/PaymentsTab";
import { PhotosTab } from "@/components/tabs/PhotosTab";
import { ProgressTab } from "@/components/tabs/ProgressTab";
import { ScheduleTab } from "@/components/tabs/ScheduleTab";
import { applyDashboardData, child } from "@/data/demoData";
import { fetchParentDashboard, getValidParentSession, logoutParent } from "@/openStarsApi";
import { DEMO_USER_ROLE, ROLE_PORTAL_LABELS } from "@/types/role";

type TabId =
  | "coins"
  | "progress"
  | "homework"
  | "comments"
  | "achievements"
  | "news"
  | "schedule"
  | "payments"
  | "photos";

type AuthStatus = "checking" | "guest" | "authenticated";
type DataStatus = "idle" | "loading" | "ready" | "error";

type TabConfig = {
  id: TabId;
  label: string;
  icon: typeof Coins;
  iconBox: string;
  iconColor: string;
  hoverBg: string;
};

const developmentTabs: TabConfig[] = [
  { id: "coins", label: "Star Coin", icon: Coins, iconBox: "bg-[#D96A24]/12", iconColor: "text-[#C95320]", hoverBg: "hover:bg-[#D96A24]/[0.055]" },
  { id: "progress", label: "Успеваемость", icon: TrendingUp, iconBox: "bg-[#5F6338]/12", iconColor: "text-[#4D512E]", hoverBg: "hover:bg-[#5F6338]/[0.055]" },
  { id: "homework", label: "Домашние задания", icon: BookOpen, iconBox: "bg-[#D96A24]/12", iconColor: "text-[#C95320]", hoverBg: "hover:bg-[#D96A24]/[0.055]" },
  { id: "comments", label: "Комментарии", icon: MessageCircle, iconBox: "bg-[#5F6338]/12", iconColor: "text-[#4D512E]", hoverBg: "hover:bg-[#5F6338]/[0.055]" },
  { id: "achievements", label: "Достижения", icon: Award, iconBox: "bg-[#D96A24]/12", iconColor: "text-[#C95320]", hoverBg: "hover:bg-[#D96A24]/[0.055]" },
];

const parentTabs: TabConfig[] = [
  { id: "schedule", label: "Расписание", icon: CalendarDays, iconBox: "bg-[#5F6338]/12", iconColor: "text-[#4D512E]", hoverBg: "hover:bg-[#5F6338]/[0.055]" },
  { id: "news", label: "Новости", icon: Newspaper, iconBox: "bg-[#D96A24]/12", iconColor: "text-[#C95320]", hoverBg: "hover:bg-[#D96A24]/[0.055]" },
  { id: "payments", label: "Оплата", icon: CreditCard, iconBox: "bg-[#5F6338]/12", iconColor: "text-[#4D512E]", hoverBg: "hover:bg-[#5F6338]/[0.055]" },
  { id: "photos", label: "Фотосессии", icon: Camera, iconBox: "bg-[#D96A24]/12", iconColor: "text-[#C95320]", hoverBg: "hover:bg-[#D96A24]/[0.055]" },
];

function nameInAboutCase(name: string) {
  if (!name) return "ребёнке";
  if (name.endsWith("ия")) return `${name.slice(0, -2)}ии`;
  if (name.endsWith("а")) return `${name.slice(0, -1)}е`;
  if (name.endsWith("я")) return `${name.slice(0, -1)}е`;
  return name;
}

function LoadingScreen({ text = "Загрузка" }: { text?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#FAF9F5]">
      <div className="text-center">
        <div className="text-xl font-semibold tracking-[-0.03em] text-[#171717]">OPEN STARS</div>
        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-black/35">{text}</div>
      </div>
    </div>
  );
}

function TabGrid({ tabs, activeTab, onSelect, columns }: { tabs: TabConfig[]; activeTab: TabId; onSelect: (tab: string) => void; columns: string }) {
  return (
    <nav className={`grid grid-cols-2 gap-2 rounded-[24px] border border-black/[0.055] bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,0.035)] ${columns}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`group flex min-h-[64px] items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.99] ${isActive ? "bg-[#171717] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]" : `text-[#171717] ${tab.hoverBg}`}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] transition-all ${isActive ? "bg-white/[0.10]" : tab.iconBox}`}>
              <Icon size={20} strokeWidth={2.2} className={isActive ? "text-[#E8752A]" : tab.iconColor} />
            </span>
            <span className="text-[13px] font-semibold leading-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("coins");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [dataStatus, setDataStatus] = useState<DataStatus>("idle");
  const [dataError, setDataError] = useState("");
  const [birthdayReward, setBirthdayReward] = useState<BirthdayReward | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const tabContentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getValidParentSession()
      .then((session) => mounted && setAuthStatus(session ? "authenticated" : "guest"))
      .catch(() => mounted && setAuthStatus("guest"));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let mounted = true;
    setDataStatus("loading");
    setDataError("");
    setBirthdayReward(null);

    fetchParentDashboard()
      .then(async (data) => {
        if (!mounted) return;

        let dashboardData = data;
        let reward: BirthdayReward | null = null;

        try {
          const childId = data?.child?.id;
          if (childId) {
            reward = await claimBirthdayReward(childId);
            if (reward.awardedNow) {
              dashboardData = await fetchParentDashboard();
            }
          }
        } catch {
          // Поздравление не должно мешать загрузке основного кабинета.
        }

        if (!mounted) return;
        applyDashboardData(dashboardData);
        setBirthdayReward(reward?.isBirthday ? reward : null);
        setDataStatus("ready");
      })
      .catch((error) => {
        if (!mounted) return;
        setDataError(error instanceof Error ? error.message : "Не удалось загрузить данные кабинета.");
        setDataStatus("error");
      });
    return () => { mounted = false; };
  }, [authStatus, reloadKey]);

  const handleTabSelect = (tab: string) => {
    setActiveTab(tab as TabId);
    window.setTimeout(() => tabContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  const handleLogout = () => {
    logoutParent();
    setActiveTab("coins");
    setDataStatus("idle");
    setDataError("");
    setBirthdayReward(null);
    setAuthStatus("guest");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (authStatus === "checking") return <LoadingScreen />;
  if (authStatus === "guest") {
    return <ParentAuth onSuccess={() => { setDataStatus("idle"); setAuthStatus("authenticated"); }} />;
  }
  if (dataStatus === "idle" || dataStatus === "loading") return <LoadingScreen text="Загружаем кабинет" />;

  if (dataStatus === "error") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FAF9F5] px-6">
        <div className="w-full max-w-md rounded-[28px] border border-black/[0.06] bg-white p-6 text-center shadow-sm">
          <div className="text-xl font-semibold text-[#171717]">Не удалось загрузить кабинет</div>
          <p className="mt-3 text-sm leading-6 text-black/50">{dataError}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-5 rounded-[16px] bg-[#171717] px-5 py-3 text-sm font-semibold text-white">Повторить</button>
        </div>
      </div>
    );
  }

  const childFirstName = child.firstName || child.name.split(" ")[0];

  return (
    <div className="flex min-h-screen bg-[#faf9f5]">
      <div className="min-w-0 flex-1">
        <Header onNavigate={handleTabSelect} onLogout={handleLogout} />
        <main className="mx-auto w-full max-w-7xl px-5 py-7 sm:px-6 lg:px-8">
          <section className="mb-6">
            <div className="inline-flex items-center rounded-full bg-gradient-to-r from-[#D96A24] to-[#E98A34] px-5 py-2.5 text-sm font-medium text-white shadow-sm">{ROLE_PORTAL_LABELS[DEMO_USER_ROLE]}</div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-[#171717] sm:text-4xl">С возвращением!</h1>
            <p className="mt-2 text-[15px] text-black/50 sm:text-base">Всё важное об {nameInAboutCase(childFirstName)} в OPEN STARS — на этой неделе.</p>
          </section>

          {birthdayReward && <BirthdayBanner firstName={childFirstName || "звезда"} amount={birthdayReward.amount || 10} />}

          <ProfileCard />
          <section className="mt-6"><OverviewCards onTabSelect={handleTabSelect} /></section>

          <section className="mt-7">
            <div className="mb-3 flex items-center gap-3 px-1"><span className="h-px w-7 bg-[#D96A24]" /><p className="text-[11px] font-bold uppercase tracking-[0.19em] text-black/45">Развитие ребёнка</p></div>
            <TabGrid tabs={developmentTabs} activeTab={activeTab} onSelect={handleTabSelect} columns="sm:grid-cols-3 lg:grid-cols-5" />
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center gap-3 px-1"><span className="h-px w-7 bg-[#5F6338]" /><p className="text-[11px] font-bold uppercase tracking-[0.19em] text-black/45">Для родителей</p></div>
            <TabGrid tabs={parentTabs} activeTab={activeTab} onSelect={handleTabSelect} columns="lg:grid-cols-4" />
          </section>

          <section ref={tabContentRef} className="mt-6 scroll-mt-24 pb-8">
            {activeTab === "coins" && <CoinsTab />}
            {activeTab === "progress" && <ProgressTab />}
            {activeTab === "homework" && <HomeworkTab />}
            {activeTab === "comments" && <CommentsTab />}
            {activeTab === "achievements" && <AchievementsTab />}
            {activeTab === "schedule" && <ScheduleTab />}
            {activeTab === "news" && <NewsTab />}
            {activeTab === "payments" && <PaymentsTab />}
            {activeTab === "photos" && <PhotosTab />}
          </section>

          <FeedbackCard />
        </main>
      </div>
    </div>
  );
}

export default App;
