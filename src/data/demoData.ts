export const parent = {
  firstName: "Мама",
  name: "Родитель",
};

export const child = {
  name: "Алисия Федотова",
  firstName: "Алисия",

  age: 9,

  group: "PRO",
  groupName: "PRO",

  branch: "Октябрьский",
  campus: "Октябрьский",

  level: "PRO",

  lessonDay: "Суббота",
  lesson_day: "Суббота",

  lessonTime: "16:00",
  lesson_time: "16:00",

  mentorName: "Мария Иванова",
  mentor_name: "Мария Иванова",

  administrator: "Мария Иванова",
  administratorName: "Мария Иванова",

  coins: 480,

  photo: "",
  avatar: "",
};

export const quickStats = {
  coins: 480,
  progress: 78,
  homeworkPending: 2,
};

/* =========================
   STAR COIN
========================= */

export const coins = {
  balance: 480,
  earnedThisMonth: 120,
};

export const coinHistory = [
  {
    id: "coin-1",
    amount: 5,
    title: "Хореография · оценка 5",
    date: "25 авг.",
    source: "Автоматически",
    type: "auto",
  },
  {
    id: "coin-2",
    amount: 4,
    title: "Фотопозирование · оценка 4",
    date: "23 авг.",
    source: "Автоматически",
    type: "auto",
  },
  {
    id: "coin-3",
    amount: 10,
    title: "Участие в показе",
    date: "20 авг.",
    source: "Администратор",
    type: "manual",
  },
  {
    id: "coin-4",
    amount: 5,
    title: "Без пропусков за месяц",
    date: "1 авг.",
    source: "Автоматически",
    type: "auto",
  },
];

/* =========================
   УСПЕВАЕМОСТЬ
========================= */

export const grades = [
  {
    id: "grade-1",
    subject: "Хореография",
    grade: 5,
    value: 5,
    date: "25 авг.",
    teacher: "Преподаватель",
    comment: "Отличная работа на занятии.",
  },
  {
    id: "grade-2",
    subject: "Фотопозирование",
    grade: 4,
    value: 4,
    date: "23 авг.",
    teacher: "Преподаватель",
    comment: "Хороший результат.",
  },
  {
    id: "grade-3",
    subject: "Актёрское мастерство",
    grade: 5,
    value: 5,
    date: "20 авг.",
    teacher: "Преподаватель",
    comment: "Очень уверенная работа.",
  },
  {
    id: "grade-4",
    subject: "Дефиле и подиумный шаг",
    grade: 4,
    value: 4,
    date: "18 авг.",
    teacher: "Преподаватель",
    comment: "Продолжаем работать над техникой.",
  },
];

export const progress = {
  overall: 78,
  month: 78,
  attendance: 92,
  averageGrade: 4.5,
};

export const progressData = progress;

export const attendance = Object.assign(
  [
    {
      id: "attendance-1",
      date: "25 авг.",
      subject: "Хореография",
      present: true,
      status: "present",
    },
    {
      id: "attendance-2",
      date: "23 авг.",
      subject: "Фотопозирование",
      present: true,
      status: "present",
    },
    {
      id: "attendance-3",
      date: "20 авг.",
      subject: "Актёрское мастерство",
      present: true,
      status: "present",
    },
    {
      id: "attendance-4",
      date: "18 авг.",
      subject: "Дефиле и подиумный шаг",
      present: false,
      status: "absent",
    },
  ],
  {
    percentage: 92,
    rate: 92,
    total: 12,
    present: 11,
    absent: 1,
  }
);

/* =========================
   ДОМАШНИЕ ЗАДАНИЯ
========================= */

export const homework = [
  {
    id: "homework-1",
    subject: "Хореография",
    title: "Повторить комбинацию",
    description:
      "Повторить комбинацию с последнего занятия и обратить внимание на положение рук.",
    dueDate: "30 авг.",
    date: "30 авг.",
    status: "pending",
    completed: false,
  },
  {
    id: "homework-2",
    subject: "Фотопозирование",
    title: "Отработать 5 поз",
    description:
      "Выбрать пять поз и потренировать плавные переходы между ними.",
    dueDate: "31 авг.",
    date: "31 авг.",
    status: "pending",
    completed: false,
  },
];

export const homeworks = homework;

/* =========================
   КОММЕНТАРИИ
========================= */

export const comments = [
  {
    id: "comment-1",
    subject: "Хореография",
    teacher: "Преподаватель",
    title: "Хорошая динамика",
    text: "Алисия хорошо включается в работу и уверенно запоминает материал.",
    comment:
      "Алисия хорошо включается в работу и уверенно запоминает материал.",
    date: "25 авг.",
  },
  {
    id: "comment-2",
    subject: "Фотопозирование",
    teacher: "Преподаватель",
    title: "Работа с камерой",
    text: "Стала увереннее чувствовать себя перед камерой.",
    comment:
      "Стала увереннее чувствовать себя перед камерой.",
    date: "23 авг.",
  },
];

/* =========================
   ДОСТИЖЕНИЯ
========================= */

export const achievements = [
  {
    id: "achievement-1",
    title: "Участие в показе",
    description: "Участие в школьном показе OPEN STARS.",
    date: "20 авг.",
    coins: 10,
    amount: 10,
  },
  {
    id: "achievement-2",
    title: "Месяц без пропусков",
    description: "Все занятия месяца посещены.",
    date: "1 авг.",
    coins: 5,
    amount: 5,
  },
];

/* =========================
   НОВОСТИ
========================= */

export const news = [
  {
    id: "news-1",
    title: "Подготовка к новому учебному месяцу",
    description:
      "В OPEN STARS начинается новый учебный период. Следите за расписанием и объявлениями в личном кабинете.",
    excerpt:
      "В OPEN STARS начинается новый учебный период.",
    date: "26 авг.",
    category: "Школа",
  },
  {
    id: "news-2",
    title: "Фотосессии учеников",
    description:
      "Информация о ближайших фотосессиях будет опубликована в разделе «Фотосессии».",
    excerpt:
      "Информация о ближайших фотосессиях появится в личном кабинете.",
    date: "24 авг.",
    category: "Фотосессия",
  },
  {
    id: "news-3",
    title: "Star Coin",
    description:
      "Напоминаем: Star Coin начисляются за оценки, посещаемость и дополнительные достижения.",
    excerpt:
      "Star Coin начисляются за учебные и дополнительные достижения.",
    date: "22 авг.",
    category: "Star Coin",
  },
];

/* =========================
   РАСПИСАНИЕ
========================= */

export const schedule = [
  {
    id: "schedule-1",
    day: "Суббота",
    date: "29 авг.",
    time: "16:00",
    subject: "Хореография",
    teacher: "Преподаватель",
    instructor: "Преподаватель",
    room: "Зал 1",
    branch: "Октябрьский",
  },
  {
    id: "schedule-2",
    day: "Суббота",
    date: "29 авг.",
    time: "17:00",
    subject: "Фотопозирование",
    teacher: "Преподаватель",
    instructor: "Преподаватель",
    room: "Студия",
    branch: "Октябрьский",
  },
];

export const schedules = schedule;

/* =========================
   ОПЛАТА
========================= */

export const payments = [
  {
    id: "payment-1",
    month: "Сентябрь",
    amount: 0,
    status: "pending",
    statusLabel: "Ожидает оплаты",
    dueDate: "до 5 сентября",
  },
];

/* =========================
   ФОТОСЕССИИ
========================= */

export const photos = [
  {
    id: "photo-1",
    title: "Фотосессии OPEN STARS",
    description:
      "Здесь появятся фотографии после публикации администратором школы.",
    date: "",
    galleryUrl: "",
    url: "",
    published: false,
  },
];

export const photoSessions = photos;