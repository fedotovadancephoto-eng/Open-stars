import { useEffect, useState } from "react";
import { ArrowLeft, FileCheck2, LoaderCircle } from "lucide-react";

import { ParentAuth } from "@/components/ParentAuth";
import { DocumentsTab } from "@/components/tabs/DocumentsTab";
import { applyDashboardData, child, familyChildren } from "@/data/demoData";
import { fetchParentDashboard, getValidParentSession, logoutParent, ParentFamilyChild, selectParentChild } from "@/openStarsApi";

type AuthStatus = "checking" | "guest" | "authenticated";

export function DocumentsPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void getValidParentSession().then((session) => { if (active) setAuthStatus(session ? "authenticated" : "guest"); }).catch(() => { if (active) setAuthStatus("guest"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let active = true;
    setLoading(true); setError("");
    void fetchParentDashboard().then((data) => {
      if (!active) return;
      applyDashboardData(data);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить кабинет.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, reloadKey]);

  if (authStatus === "checking") return <div className="grid min-h-screen place-items-center bg-[#FAF9F5]"><LoaderCircle className="h-6 w-6 animate-spin text-[#D96A24]" /></div>;
  if (authStatus === "guest") return <ParentAuth onSuccess={() => setAuthStatus("authenticated")} />;

  return (
    <div className="min-h-screen bg-[#FAF9F5]">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <button type="button" onClick={() => { window.location.href = "/"; }} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#171717] hover:bg-black/[0.04]"><ArrowLeft className="h-4 w-4" /> Кабинет</button>
          <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-[#D96A24]" /><span className="font-semibold tracking-[-0.02em]">Документы</span></div>
          <button type="button" onClick={() => { logoutParent(); setAuthStatus("guest"); }} className="text-xs font-semibold text-black/40">Выйти</button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {familyChildren.length > 1 && (
          <div className="mb-5 rounded-[20px] border border-black/[0.055] bg-white p-3">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">Документы ребёнка</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(familyChildren as ParentFamilyChild[]).map((item) => <button key={item.id} type="button" onClick={() => { if (item.id !== child.id) { selectParentChild(item.id); setReloadKey((v) => v + 1); } }} className={`shrink-0 rounded-[14px] px-4 py-2.5 text-sm font-semibold ${item.id === child.id ? "bg-[#171717] text-white" : "bg-[#FAF9F5] text-[#171717]"}`}>{item.firstName || item.name}</button>)}
            </div>
          </div>
        )}

        {loading ? <div className="flex items-center gap-3 rounded-[20px] bg-white p-6 text-sm text-black/50"><LoaderCircle className="h-5 w-5 animate-spin" /> Загружаем документы…</div> : error ? <div className="rounded-[20px] bg-white p-6"><p className="font-semibold">Не удалось открыть документы</p><p className="mt-2 text-sm text-red-600">{error}</p><button type="button" onClick={() => setReloadKey((v) => v + 1)} className="mt-4 rounded-[14px] bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white">Повторить</button></div> : <DocumentsTab />}
      </main>
    </div>
  );
}
