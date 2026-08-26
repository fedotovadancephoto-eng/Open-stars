import { useEffect, useState } from "react";

import {
  Coins,
  TrendingUp,
  BookOpen,
  Newspaper,
  CalendarDays,
  MessageCircle,
  Award,
  CreditCard,
  Camera,
} from "lucide-react";

import { Header } from "@/components/Header";
import { ProfileCard } from "@/components/ProfileCard";
import { OverviewCards } from "@/components/OverviewCards";
import { ParentAuth } from "@/components/ParentAuth";

import { CoinsTab } from "@/components/tabs/CoinsTab";
import { ProgressTab } from "@/components/tabs/ProgressTab";
import { HomeworkTab } from "@/components/tabs/HomeworkTab";
import { CommentsTab } from "@/components/tabs/CommentsTab";
import { AchievementsTab } from "@/components/tabs/AchievementsTab";
import { NewsTab } from "@/components/tabs/NewsTab";
import { ScheduleTab } from "@/components/tabs/ScheduleTab";
import { PaymentsTab } from "@/components/tabs/PaymentsTab";
import { PhotosTab } from "@/components/tabs/PhotosTab";

import { child } from "@/data/demoData";

import {
  DEMO_USER_ROLE,
  ROLE_PORTAL_LABELS,
} from "@/types/role";

import type { NotificationTarget } from "@/data/notificationsData";

import { getValidParentSession } from "@/openStarsApi";



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

type AuthStatus =
  | "checking"
  | "guest"
  | "authenticated";

const developmentTabs = [
  {
    id: "coins" as TabId,
    label: "Star Coin",
    icon: Coins,
    iconBox: "bg-[#D96A24]/12",
    iconColor: "text-[#C95320]",
    hoverBg: "hover:bg-[#D96A24]/[0.055]",
  },
  {
    id: "progress" as TabId,
    label: "Успеваемость",
    icon: TrendingUp,
    iconBox: "bg-[#5F6338]/12",
    iconColor: "text-[#4D512E]",
    hoverBg: "hover:bg-[#5F6338]/[0.055]",
  },
  {
    id: "homework" as TabId,
    label: "Домашние задания",
    icon: BookOpen,
    iconBox: "bg-[#D96A24]/12",
    iconColor: "text-[#C95320]",
    hoverBg: "hover:bg-[#D96A24]/[0.055]",
  },
  {
    id: "comments" as TabId,
    label: "Комментарии",
    icon: MessageCircle,
    iconBox: "bg-[#5F6338]/12",
    iconColor: "text-[#4D512E]",
    hoverBg: "hover:bg-[#5F6338]/[0.055]",
  },
  {
    id: "achievements" as TabId,
    label: "Достижения",
    icon: Award,
    iconBox: "bg-[#D96A24]/12",
    iconColor: "text-[#C95320]",
    hoverBg: "hover:bg-[#D96A24]/[0.055]",
  },
];

const parentTabs = [
  {
    id: "schedule" as TabId,
    label: "Расписание",
    icon: CalendarDays,
    iconBox: "bg-[#5F6338]/12",
    iconColor: "text-[#4D512E]",
    hoverBg: "hover:bg-[#5F6338]/[0.055]",
  },
  {
    id: "news" as TabId,
    label: "Новости",
    icon: Newspaper,
    iconBox: "bg-[#D96A24]/12",
    iconColor: "text-[#C95320]",
    hoverBg: "hover:bg-[#D96A24]/[0.055]",
  },
  {
    id: "payments" as TabId,
    label: "Оплата",
    icon: CreditCard,
    iconBox: "bg-[#5F6338]/12",
    iconColor: "text-[#4D512E]",
    hoverBg: "hover:bg-[#5F6338]/[0.055]",
  },
  {
    id: "photos" as TabId,
    label: "Фотосессии",
    icon: Camera,
    iconBox: "bg-[#D96A24]/12",
    iconColor: "text-[#C95320]",
    hoverBg: "hover:bg-[#D96A24]/[0.055]",
  },
];

function App() {
  const [activeTab, setActiveTab] =
    useState<TabId>("coins");

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("checking");

  const childFirstName =
    child.name.split(" ")[0];

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const session =
          await getValidParentSession();

        if (!mounted) return;

        setAuthStatus(
          session
            ? "authenticated"
            : "guest"
        );
      } catch {
        if (!mounted) return;

        setAuthStatus("guest");
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleTabSelect = (
    tab: string
  ) => {
    setActiveTab(tab as TabId);
  };

  const handleNotificationSelect = (
    target: NotificationTarget
  ) => {
    setActiveTab(target as TabId);
  };

  if (authStatus === "checking") {
    return (
      <div
        className="
          grid
          min-h-screen
          place-items-center
          bg-[#FAF9F5]
        "
      >
        <div className="text-center">
          <div
            className="
              text-xl
              font-semibold
              tracking-[-0.03em]
              text-[#171717]
            "
          >
            OPEN STARS
          </div>

          <div
            className="
              mt-2
              text-xs
              uppercase
              tracking-[0.18em]
              text-black/35
            "
          >
            Загрузка
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === "guest") {
    return (
      <ParentAuth
        onSuccess={() =>
          setAuthStatus(
            "authenticated"
          )
        }
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#faf9f5]">


      <div className="min-w-0 flex-1">
        <Header
          onNotificationSelect={
            handleNotificationSelect
          }
        />

        <main
          className="
            mx-auto
            w-full
            max-w-7xl
            px-5
            py-7
            sm:px-6
            lg:px-8
          "
        >
          <section className="mb-6">
            <div
              className="
                inline-flex
                items-center
                rounded-full
                bg-gradient-to-r
                from-[#D96A24]
                to-[#E98A34]
                px-5
                py-2.5
                text-sm
                font-medium
                text-white
                shadow-sm
              "
            >
              {
                ROLE_PORTAL_LABELS[
                  DEMO_USER_ROLE
                ]
              }
            </div>

            <h1
              className="
                mt-5
                text-3xl
                font-semibold
                tracking-[-0.035em]
                text-[#171717]
                sm:text-4xl
              "
            >
              С возвращением,{" "}
              
            </h1>

            <p
              className="
                mt-2
                text-[15px]
                text-black/50
                sm:text-base
              "
            >
              Все важное о{" "}
              {childFirstName} в OPEN
              STARS — на этой неделе.
            </p>
          </section>

          <ProfileCard />

          <section className="mt-6">
            <OverviewCards
              onTabSelect={
                handleTabSelect
              }
            />
          </section>

          {/* РАЗВИТИЕ РЕБЁНКА */}
          <section className="mt-7">
            <div className="mb-3 flex items-center gap-3 px-1">
              <span className="h-px w-7 bg-[#D96A24]" />

              <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-black/45">
                Развитие ребёнка
              </p>
            </div>

            <nav
              className="
                grid
                grid-cols-2
                gap-2
                rounded-[24px]
                border
                border-black/[0.055]
                bg-white
                p-2
                shadow-[0_8px_28px_rgba(0,0,0,0.035)]
                sm:grid-cols-3
                lg:grid-cols-5
              "
            >
              {developmentTabs.map(
                (tab) => {
                  const Icon =
                    tab.icon;

                  const isActive =
                    activeTab ===
                    tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          tab.id
                        )
                      }
                      className={`
                        group
                        flex
                        min-h-[64px]
                        items-center
                        gap-3
                        rounded-[18px]
                        px-3
                        py-2.5
                        text-left
                        transition-all
                        duration-200
                        ${
                          isActive
                            ? "bg-[#171717] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]"
                            : `text-[#171717] ${tab.hoverBg}`
                        }
                      `}
                    >
                      <span
                        className={`
                          grid
                          h-10
                          w-10
                          shrink-0
                          place-items-center
                          rounded-[14px]
                          transition-all
                          ${
                            isActive
                              ? "bg-white/[0.10]"
                              : tab.iconBox
                          }
                        `}
                      >
                        <Icon
                          size={20}
                          strokeWidth={
                            2.2
                          }
                          className={
                            isActive
                              ? "text-[#E8752A]"
                              : tab.iconColor
                          }
                        />
                      </span>

                      <span className="text-[13px] font-semibold leading-tight">
                        {tab.label}
                      </span>
                    </button>
                  );
                }
              )}
            </nav>
          </section>

          {/* ДЛЯ РОДИТЕЛЕЙ */}
          <section className="mt-5">
            <div className="mb-3 flex items-center gap-3 px-1">
              <span className="h-px w-7 bg-[#5F6338]" />

              <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-black/45">
                Для родителей
              </p>
            </div>

            <nav
              className="
                grid
                grid-cols-2
                gap-2
                rounded-[24px]
                border
                border-black/[0.055]
                bg-white
                p-2
                shadow-[0_8px_28px_rgba(0,0,0,0.035)]
                lg:grid-cols-4
              "
            >
              {parentTabs.map(
                (tab) => {
                  const Icon =
                    tab.icon;

                  const isActive =
                    activeTab ===
                    tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          tab.id
                        )
                      }
                      className={`
                        group
                        flex
                        min-h-[64px]
                        items-center
                        gap-3
                        rounded-[18px]
                        px-3
                        py-2.5
                        text-left
                        transition-all
                        duration-200
                        ${
                          isActive
                            ? "bg-[#171717] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]"
                            : `text-[#171717] ${tab.hoverBg}`
                        }
                      `}
                    >
                      <span
                        className={`
                          grid
                          h-10
                          w-10
                          shrink-0
                          place-items-center
                          rounded-[14px]
                          ${
                            isActive
                              ? "bg-white/[0.10]"
                              : tab.iconBox
                          }
                        `}
                      >
                        <Icon
                          size={20}
                          strokeWidth={
                            2.2
                          }
                          className={
                            isActive
                              ? "text-[#E8752A]"
                              : tab.iconColor
                          }
                        />
                      </span>

                      <span className="text-[13px] font-semibold leading-tight">
                        {tab.label}
                      </span>
                    </button>
                  );
                }
              )}
            </nav>
          </section>

          <section className="mt-6 pb-12">
            {activeTab ===
              "coins" && (
              <CoinsTab />
            )}

            {activeTab ===
              "progress" && (
              <ProgressTab />
            )}

            {activeTab ===
              "homework" && (
              <HomeworkTab />
            )}

            {activeTab ===
              "comments" && (
              <CommentsTab />
            )}

            {activeTab ===
              "achievements" && (
              <AchievementsTab />
            )}

            {activeTab ===
              "schedule" && (
              <ScheduleTab />
            )}

            {activeTab ===
              "news" && (
              <NewsTab />
            )}

            {activeTab ===
              "payments" && (
              <PaymentsTab />
            )}

            {activeTab ===
              "photos" && (
              <PhotosTab />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;