import { useState } from 'react';
import { Coins, TrendingUp, BookOpen, Newspaper, CalendarDays } from 'lucide-react';
import { Header } from '@/components/Header';
import { ProfileCard } from '@/components/ProfileCard';
import { OverviewCards } from '@/components/OverviewCards';
import { Tabs } from '@/components/Tabs';
import { CoinsTab } from '@/components/tabs/CoinsTab';
import { ProgressTab } from '@/components/tabs/ProgressTab';
import { HomeworkTab } from '@/components/tabs/HomeworkTab';
import { NewsTab } from '@/components/tabs/NewsTab';
import { ScheduleTab } from '@/components/tabs/ScheduleTab';
import { child } from '@/data/demoData';

const tabDefs = [
  { id: 'coins', label: 'Coins', icon: Coins },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
];

function App() {
  const [activeTab, setActiveTab] = useState('coins');

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-6 sm:px-6 sm:py-8">
        {/* Hero welcome area */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Parent Portal
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-700 tracking-tight text-ink sm:text-4xl">
            Welcome back, Sarah
          </h1>
          <p className="mt-1 text-ink-muted">
            Here's how {child.name.split(' ')[0]} is doing at OPEN STARS Model Academy this week.
          </p>
        </div>

        {/* Profile card */}
        <div className="animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <ProfileCard />
        </div>

        {/* Quick overview cards */}
        <div className="mt-5 sm:mt-6">
          <OverviewCards onTabSelect={setActiveTab} />
        </div>

        {/* Tabbed content area */}
        <div className="mt-6 sm:mt-8">
          <Tabs tabs={tabDefs} active={activeTab} onChange={setActiveTab}>
            {activeTab === 'coins' && <CoinsTab />}
            {activeTab === 'progress' && <ProgressTab />}
            {activeTab === 'homework' && <HomeworkTab />}
            {activeTab === 'news' && <NewsTab />}
            {activeTab === 'schedule' && <ScheduleTab />}
          </Tabs>
        </div>

        <footer className="mt-10 border-t border-neutral-200 pt-6 text-center">
          <p className="text-sm font-medium text-ink-muted">
            OPEN STARS Model Academy · Parent Portal
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
