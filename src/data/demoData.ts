export const child = {
  name: 'Mia Anderson',
  age: 9,
  group: 'Rising Stars · Junior Cohort',
  photo: 'https://images.pexels.com/photos/29311763/pexels-photo-29311763.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  enrolledSince: 'January 2026',
  mentor: 'Ms. Eleanor Vance',
  streak: 8,
};

export const quickStats = {
  coins: 480,
  progress: 78,
  upcomingClasses: 3,
  homeworkPending: 2,
};

export const attendance = {
  percentage: 94,
  attended: 32,
  total: 34,
  trend: '+3% this month',
  monthly: [
    { label: 'Mar', value: 88 },
    { label: 'Apr', value: 91 },
    { label: 'May', value: 90 },
    { label: 'Jun', value: 96 },
    { label: 'Jul', value: 94 },
  ],
};

export const progress = {
  level: 2,
  levelName: 'Rising Stars',
  xp: 1240,
  xpToNext: 1500,
  skills: [
    { name: 'Posture & Poise', mastery: 92 },
    { name: 'Runway Walk', mastery: 78 },
    { name: 'Posing & Expression', mastery: 85 },
    { name: 'Confidence', mastery: 70 },
  ],
  achievements: [
    { icon: '🏆', label: 'Best Effort', month: 'Jul' },
    { icon: '⭐', label: 'Perfect Week', month: 'Jun' },
    { icon: '🌟', label: 'First Showcase', month: 'May' },
  ],
};

export const coins = {
  balance: 480,
  earnedThisMonth: 120,
  history: [
    { label: 'Outstanding participation', amount: 50, date: 'Aug 19', reason: 'participation' },
    { label: 'Neat appearance in class', amount: 30, date: 'Aug 12', reason: 'appearance' },
    { label: 'Great teamwork in group shoot', amount: 40, date: 'Aug 5', reason: 'teamwork' },
  ],
};

export const coinReasons = [
  { icon: '🎤', label: 'Participation', description: 'Active engagement in class activities' },
  { icon: '✨', label: 'Neat Appearance', description: 'Arriving well-groomed and prepared' },
  { icon: '💪', label: 'Effort', description: 'Showing dedication and hard work' },
  { icon: '😎', label: 'Confidence', description: 'Demonstrating self-assurance on stage' },
  { icon: '🤝', label: 'Teamwork', description: 'Supporting peers during group sessions' },
];

export const homework = [
  {
    id: 'hw1',
    title: 'Runway Walk Practice',
    description: 'Practice the basic T-walk and pivot turn for 20 minutes daily. Focus on posture and stride length.',
    dueDate: 'Aug 27, 2026',
    status: 'new',
    subject: 'Runway',
  },
  {
    id: 'hw2',
    title: 'Pose Study Sheet',
    description: 'Review the 5 classic posing angles and record yourself attempting each one.',
    dueDate: 'Aug 29, 2026',
    status: 'in-progress',
    subject: 'Posing',
  },
  {
    id: 'hw3',
    title: 'Confidence Journal',
    description: 'Write three things you felt confident about this week and one thing to improve.',
    dueDate: 'Aug 20, 2026',
    status: 'completed',
    subject: 'Mindset',
  },
];

export const news = [
  {
    id: 'n1',
    category: 'Event',
    title: 'OPEN STARS Junior Showcase 2026',
    body: 'Our annual junior showcase is approaching! All Rising Stars students will present their runway and posing skills. Detailed schedule and wardrobe notes will be sent home next week.',
    date: 'Aug 24, 2026',
    tag: 'event',
  },
  {
    id: 'n2',
    category: 'Reminder',
    title: 'Photo Day — September 5th',
    body: 'Please ensure your child arrives in neat academy attire with hair styled. Group and individual photos will be taken for the yearbook and portfolio.',
    date: 'Aug 22, 2026',
    tag: 'reminder',
  },
  {
    id: 'n3',
    category: 'Announcement',
    title: 'New Workshop: Stage Presence',
    body: 'We are adding a special Stage Presence workshop every Friday this September. Spaces are limited and will be assigned on a first-come basis.',
    date: 'Aug 18, 2026',
    tag: 'announcement',
  },
];

export const upcomingClasses = [
  {
    day: 'Wed',
    date: 'Aug 27',
    time: '4:00 PM',
    duration: '60 min',
    title: 'Runway Fundamentals',
    instructor: 'Ms. Eleanor',
    room: 'Studio A',
    color: 'orange',
  },
  {
    day: 'Sat',
    date: 'Aug 30',
    time: '10:30 AM',
    duration: '90 min',
    title: 'Posing & Expression Lab',
    instructor: 'Mr. Daniel',
    room: 'Studio B',
    color: 'olive',
  },
  {
    day: 'Mon',
    date: 'Sep 1',
    time: '4:00 PM',
    duration: '60 min',
    title: 'Confidence & Stage Presence',
    instructor: 'Ms. Eleanor',
    room: 'Studio A',
    color: 'orange',
  },
];

export const payments = [
  {
    title: 'Monthly Tuition · September',
    dueDate: 'Sep 1, 2026',
    status: 'upcoming',
  },
  {
    title: 'Portfolio Materials Fee',
    dueDate: 'Sep 15, 2026',
    status: 'upcoming',
  },
  {
    title: 'Monthly Tuition · August',
    dueDate: 'Aug 1, 2026',
    status: 'paid',
  },
];

export const paymentMethod = {
  brand: 'Visa',
  last4: '4242',
  expiry: '08/27',
};
