export const parent = {
  firstName: "Родитель",
  name: "Родитель",
};

export const child = {
  id: "",
  name: "",
  firstName: "",
  lastName: "",
  age: null as number | null,
  group: "",
  groupName: "",
  branch: "",
  campus: "",
  level: "",
  lessonDay: "",
  lesson_day: "",
  lessonTime: "",
  lesson_time: "",
  mentorName: "",
  mentor_name: "",
  administrator: "",
  administratorName: "",
  coins: 0,
  photo: "",
  avatar: "",
  paymentStatus: "",
};

export const quickStats = {
  coins: 0,
  progress: 0,
  homeworkPending: 0,
};

export const coins = {
  balance: 0,
  earnedThisMonth: 0,
};

export const starCoinRules: Array<{
  code: string;
  title: string;
  amount: number;
  active: boolean;
}> = [];

export const coinHistory: any[] = [];
export const grades: any[] = [];

export const progress = {
  overall: 0,
  month: 0,
  attendance: 0,
  averageGrade: 0,
  level: 1,
  levelName: "OPEN STARS",
  xp: 0,
  xpToNext: 100,
  skills: [] as any[],
  achievements: [] as any[],
};

export const progressData = progress;

export const attendance = Object.assign([] as any[], {
  percentage: 0,
  rate: 0,
  total: 0,
  present: 0,
  absent: 0,
  attended: 0,
  monthly: [] as any[],
});

export const homework: any[] = [];
export const homeworks = homework;
export const comments: any[] = [];
export const achievements: any[] = [];
export const news: any[] = [];
export const schedule: any[] = [];
export const upcomingClasses = schedule;
export const schedules = schedule;
export const payments: any[] = [];
export const photos: any[] = [];
export const photoSessions = photos;

export const student = child;
export const studentData = child;
export const recentEarnings = coinHistory;
export const assignments = homework;
export const messages = comments;
export const rewards = achievements;

function replaceArray(target: any[], source: unknown) {
  target.splice(0, target.length, ...(Array.isArray(source) ? source : []));
}

export function applyDashboardData(data: any) {
  if (!data || typeof data !== "object") return;

  if (data.parent) Object.assign(parent, data.parent);
  if (data.child) Object.assign(child, data.child);
  if (data.quickStats) Object.assign(quickStats, data.quickStats);
  if (data.coins) Object.assign(coins, data.coins);
  if (data.progress) Object.assign(progress, data.progress);

  replaceArray(starCoinRules, data.starCoinRules);
  replaceArray(coinHistory, data.coinHistory);
  replaceArray(grades, data.grades);
  replaceArray(homework, data.homework);
  replaceArray(comments, data.comments);
  replaceArray(achievements, data.achievements);
  replaceArray(news, data.news);
  replaceArray(schedule, data.schedule);
  replaceArray(payments, data.payments);
  replaceArray(photos, data.photos);

  replaceArray(attendance, data.attendance?.records);
  Object.assign(attendance, {
    percentage: data.attendance?.percentage ?? 0,
    rate: data.attendance?.rate ?? 0,
    total: data.attendance?.total ?? 0,
    present: data.attendance?.present ?? 0,
    absent: data.attendance?.absent ?? 0,
    attended: data.attendance?.attended ?? 0,
    monthly: Array.isArray(data.attendance?.monthly)
      ? data.attendance.monthly
      : [],
  });
}
