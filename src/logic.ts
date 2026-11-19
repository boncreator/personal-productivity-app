import type { Activity, Entry, RecordItem } from './db';

export const dayNumber = (date: string) => ((new Date(`${date}T12:00:00`).getDay() + 6) % 7) + 1;
export const dateOffset = (date: string, offset: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dailyProgress = (activities: Activity[], records: RecordItem[], date: string) => {
  const scheduled = activities.filter(
    (a) => a.day === dayNumber(date) && a.active && (!a.oneOffDate || a.oneOffDate === date) && !a.optional,
  );
  const done = scheduled.filter((a) =>
    records.some(
      (r) => r.date === date && r.activityId === a.id && ['completed', 'minimum'].includes(r.status),
    ),
  ).length;
  return scheduled.length ? Math.round((done / scheduled.length) * 100) : 0;
};
export function activityRate(
  records: RecordItem[],
  activities: Activity[],
  match: (a: Activity) => boolean,
  daysBack: number,
  today: string,
) {
  let done = 0,
    total = 0;
  for (let n = 1; n <= daysBack; n++) {
    const date = dateOffset(today, -n);
    for (const a of activities.filter(
      (x) =>
        x.active &&
        !x.optional &&
        x.day === dayNumber(date) &&
        (!x.oneOffDate || x.oneOffDate === date) &&
        match(x),
    )) {
      const r = records.find((x) => x.date === date && x.activityId === a.id);
      if (!r || r.status === 'skipped') continue;
      total++;
      if (['completed', 'minimum'].includes(r.status)) done++;
    }
  }
  return total ? Math.round((done / total) * 100) : null;
}
export function scheduledStreak(
  records: RecordItem[],
  activities: Activity[],
  today: string,
  now = new Date(),
) {
  let count = 0;
  for (let n = 0; n < 365; n++) {
    const date = dateOffset(today, -n),
      scheduled = activities.filter(
        (a) =>
          a.active &&
          a.category === 'foresite' &&
          a.day === dayNumber(date) &&
          (!a.oneOffDate || a.oneOffDate === date),
      );
    if (!scheduled.length) continue;
    const happened = scheduled.every((a) =>
      records.some(
        (r) => r.date === date && r.activityId === a.id && ['completed', 'minimum'].includes(r.status),
      ),
    );
    if (happened) {
      count++;
      continue;
    }
    if (
      n === 0 &&
      scheduled.some(
        (a) =>
          a.time > `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      )
    )
      continue;
    break;
  }
  return count;
}
type HabitDefinition = {
  id: string;
  name: string;
  match: (a: Activity) => boolean;
  entry?: (e: Entry) => boolean;
};
export const HABITS: HabitDefinition[] = [
  { id: 'wake', name: 'Wake up on time', match: (a: Activity) => /wake up/i.test(a.title) },
  { id: 'movement', name: 'Morning movement', match: (a: Activity) => a.category === 'health' },
  { id: 'foresite', name: 'Foresite deep work', match: (a: Activity) => a.category === 'foresite' },
  {
    id: 'communication',
    name: 'Communication & sales',
    match: (a: Activity) => a.category === 'learning' && /communication|sales|pitch|outreach/i.test(a.title),
  },
  {
    id: 'software',
    name: 'Software / CS study',
    match: (a: Activity) =>
      a.category === 'learning' && /software|computer science|study block/i.test(a.title),
  },
  {
    id: 'forex',
    name: 'Forex learning journal',
    match: (a: Activity) => a.category === 'forex',
    entry: (e: Entry) => e.type === 'forexJournal',
  },
  { id: 'planning', name: 'Daily planning', match: (a: Activity) => /plan|wind down/i.test(a.title) },
  { id: 'sleep', name: 'Sleep routine', match: (a: Activity) => /sleep|early night/i.test(a.title) },
  {
    id: 'content',
    name: 'TikTok content creation',
    match: (a: Activity) => a.category === 'learning' && /social content|tiktok/i.test(a.title),
    entry: (e: Entry) =>
      e.type === 'video' && ['Recorded', 'Editing', 'Ready to post', 'Published'].includes(e.status),
  },
];
export function getHabitStats(
  records: RecordItem[],
  activities: Activity[],
  entries: Entry[],
  today: string,
) {
  return HABITS.map((h) => {
    const dates = Array.from({ length: 365 }, (_, i) => dateOffset(today, i - 364));
    const daily = dates.map((date) => {
      const scheduled = activities.filter(
        (a) =>
          a.active &&
          !a.optional &&
          a.day === dayNumber(date) &&
          (!a.oneOffDate || a.oneOffDate === date) &&
          h.match(a),
      );
      const matchingEntries = entries.filter((e) => e.date === date && h.entry?.(e));
      const matched = records.filter((r) => r.date === date && scheduled.some((a) => a.id === r.activityId));
      const done =
        matched.some((r) => r.status === 'completed' || r.status === 'minimum') || matchingEntries.length > 0;
      const missed = matched.some((r) => r.status === 'missed');
      const skipped = matched.length > 0 && matched.every((r) => r.status === 'skipped');
      return {
        date,
        scheduled: scheduled.length > 0,
        done,
        missed,
        skipped,
        logged: matched.length > 0 || matchingEntries.length > 0,
        sessions:
          matched.filter((r) => r.status === 'completed' || r.status === 'minimum').length +
          matchingEntries.length,
      };
    });
    const rate = (span: number) => {
      const range = daily.slice(-span);
      const tracked = range.filter((d) => (d.logged && !d.skipped) || d.missed);
      return tracked.length
        ? Math.round((tracked.filter((d) => d.done).length / tracked.length) * 100)
        : null;
    };
    let longest = 0,
      run = 0;
    for (const d of daily) {
      if (!d.scheduled) continue;
      if (d.done) {
        run++;
        longest = Math.max(longest, run);
      } else if (d.logged || d.missed) run = 0;
    }
    let current = 0;
    for (const d of [...daily].reverse()) {
      if (!d.scheduled) continue;
      if (d.date === today && !d.logged) {
        const task = activities.find(
          (a) =>
            a.active && a.day === dayNumber(today) && (!a.oneOffDate || a.oneOffDate === today) && h.match(a),
        );
        if (
          task &&
          task.time >
            `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
        )
          continue;
      }
      if (d.done) {
        current++;
        continue;
      }
      if (d.logged || d.missed) break;
    }
    const completedSessions = daily.reduce((n, d) => n + d.sessions, 0);
    return {
      id: h.id,
      name: h.name,
      currentStreak: current,
      longestStreak: longest,
      weeklyRate: rate(7),
      monthlyRate: rate(30),
      completedSessions,
    };
  });
}

export type Recommendation = {
  ruleId: string;
  title: string;
  message: string;
  reason: string;
  priority: number;
};
export const RECOMMENDATION_THRESHOLDS = {
  foresiteMissedSessions: 3,
  sleepMissesInThirtyDays: 4,
  forexMissesInSevenDays: 2,
  studyMissesInThirtyDays: 3,
  burnoutRateDrop: 0.2,
  burnoutMissedActivities: 3,
  tiktokWeeklyTarget: 3,
} as const;
const goals: [string, number][] = [
  ['foresite', 5],
  ['interview', 1],
  ['video', 3],
  ['post', 1],
  ['study', 2],
  ['forexWeekly', 1],
  ['forexJournal', 4],
  ['savings', 1],
];
export function makeRecommendation(
  records: RecordItem[],
  activities: Activity[],
  entries: Entry[],
  today: string,
  paydayDate?: string,
): Recommendation {
  const expected = (activity: Activity, date: string) =>
    activity.active &&
    !activity.optional &&
    activity.day === dayNumber(date) &&
    (!activity.oneOffDate || activity.oneOffDate === date);
  const occurrence = (a: Activity, date: string) =>
    records.find((r) => r.date === date && r.activityId === a.id);
  const isDone = (r?: RecordItem) => !!r && ['completed', 'minimum'].includes(r.status);
  const days = (n: number) => Array.from({ length: n }, (_, i) => dateOffset(today, -i));
  const scheduledStats = (span: number) => {
    let done = 0,
      total = 0,
      missed = 0;
    for (const date of days(span))
      for (const a of activities.filter((x) => expected(x, date))) {
        const record = occurrence(a, date);
        if (date === today && !record) continue;
        if (record?.status === 'skipped') continue;
        if (!isDone(record) && record?.status !== 'missed') continue;
        total++;
        if (isDone(record)) done++;
        else missed++;
      }
    return { done, total, missed, rate: total ? done / total : 1 };
  };
  const stats7 = scheduledStats(7),
    stats30 = scheduledStats(30);
  const foresiteDates = days(8)
    .filter((date) => activities.some((a) => expected(a, date) && a.category === 'foresite'))
    .slice(0, RECOMMENDATION_THRESHOLDS.foresiteMissedSessions);
  const threeForesiteMisses =
    foresiteDates.length === RECOMMENDATION_THRESHOLDS.foresiteMissedSessions &&
    foresiteDates.every((date) =>
      activities
        .filter((a) => expected(a, date) && a.category === 'foresite')
        .every((a) => occurrence(a, date)?.status === 'missed'),
    );
  const sleepMisses = days(30).reduce(
    (n, date) =>
      n +
      activities
        .filter((a) => expected(a, date) && (/sleep|early night/i.test(a.title) || a.category === 'sleep'))
        .filter((a) => {
          const r = occurrence(a, date);
          return date !== today && r?.status === 'missed';
        }).length,
    0,
  );
  const forexMisses = days(7).reduce(
    (n, date) =>
      n +
      activities
        .filter((a) => expected(a, date) && a.category === 'forex')
        .filter((a) => {
          const r = occurrence(a, date);
          return date !== today && r?.status === 'missed';
        }).length,
    0,
  );
  const studyMisses = days(30).reduce(
    (n, date) =>
      n +
      activities
        .filter(
          (a) =>
            expected(a, date) &&
            a.category === 'learning' &&
            /study|software|computer science|skill/i.test(a.title),
        )
        .filter((a) => {
          const r = occurrence(a, date);
          return date !== today && r?.status === 'missed';
        }).length,
    0,
  );
  const weekStart = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const week = weekStart(today),
    weekEntries = entries.filter((e) => (e.weekStart || weekStart(e.date)) === week);
  const count = (type: string) =>
    weekEntries.filter(
      (e) => (e.type === type || e.goalType === type) && (type !== 'video' || e.status === 'Published'),
    ).length;
  const savingsDue = !!paydayDate && weekStart(paydayDate) === week;
  const targetAchievement = goals.every(([type, target]) =>
    type === 'savings' ? !savingsDue || count(type) >= target : count(type) >= target,
  );
  if (sleepMisses >= RECOMMENDATION_THRESHOLDS.sleepMissesInThirtyDays)
    return {
      ruleId: 'sleep',
      title: 'Make room for recovery.',
      message:
        'Your evening routine may be too demanding. Consider reducing evening activities and protecting your wind-down time.',
      reason: `${sleepMisses} scheduled sleep routines were missed in the last 30 days.`,
      priority: 1,
    };
  if (
    stats7.rate < stats30.rate - RECOMMENDATION_THRESHOLDS.burnoutRateDrop &&
    stats7.missed >= RECOMMENDATION_THRESHOLDS.burnoutMissedActivities
  )
    return {
      ruleId: 'burnout',
      title: 'Ease the pace this week.',
      message:
        'Your current schedule may be too demanding. Reduce optional activities and protect your rest time.',
      reason: `Scheduled completion fell from ${Math.round(stats30.rate * 100)}% over 30 days to ${Math.round(stats7.rate * 100)}% over 7 days.`,
      priority: 1,
    };
  if (threeForesiteMisses)
    return {
      ruleId: 'foresite',
      title: 'Make Foresite easier to return to.',
      message:
        'Your Foresite consistency has dropped. Try the 30-minute minimum session, and move the block earlier if that helps.',
      reason: 'Three scheduled days passed without a Foresite session.',
      priority: 2,
    };
  if (stats7.missed >= 4)
    return {
      ruleId: 'routine',
      title: 'Give your routine more breathing room.',
      message:
        'Several scheduled activities were missed this week. Consider removing optional commitments and protecting your rest time.',
      reason: `${stats7.missed} scheduled activities were missed or left incomplete in the last 7 days.`,
      priority: 3,
    };
  if (forexMisses >= RECOMMENDATION_THRESHOLDS.forexMissesInSevenDays)
    return {
      ruleId: 'forex',
      title: 'Simplify the market review.',
      message: 'Consider consolidating your educational market reviews into Saturday’s weekly review.',
      reason: `${forexMisses} scheduled educational reviews were missed this week.`,
      priority: 4,
    };
  if (studyMisses >= RECOMMENDATION_THRESHOLDS.studyMissesInThirtyDays)
    return {
      ruleId: 'study',
      title: 'Connect study to the build.',
      message: 'Consider connecting your study sessions to the next feature you need to build in Foresite.',
      reason: `${studyMisses} scheduled skill sessions were missed over the last 30 days.`,
      priority: 5,
    };
  if (count('video') < RECOMMENDATION_THRESHOLDS.tiktokWeeklyTarget)
    return {
      ruleId: 'content',
      title: 'Capture a little of the process.',
      message:
        'You are behind your weekly content target. Capture a short clip during tomorrow’s Foresite session.',
      reason: `${count('video')} of ${RECOMMENDATION_THRESHOLDS.tiktokWeeklyTarget} videos are published this week.`,
      priority: 6,
    };
  if (targetAchievement)
    return {
      ruleId: 'stretch',
      title: 'You kept the promises you made.',
      message:
        'You achieved your weekly targets. Consider adding one additional customer interview next week.',
      reason: 'Every weekly target has been reached.',
      priority: 7,
    };
  return {
    ruleId: 'steady',
    title: 'Keep the next step small.',
    message: 'Choose one clear task for your next Foresite session and leave a note about where to pick up.',
    reason: stats30.total
      ? `${Math.round(stats30.rate * 100)}% of scheduled activity was completed or intentionally kept light over 30 days.`
      : 'Your records are just getting started; recommendations will adapt as you log activity.',
    priority: 8,
  };
}

export function validateBackup(value: unknown): value is {
  formatVersion: number;
  activities: Activity[];
  records: RecordItem[];
  entries: Entry[];
  settings: { id: string }[];
} {
  if (!value || typeof value !== 'object') return false;
  const x = value as any;
  const keys = ['activities', 'records', 'entries', 'settings'];
  if (x.formatVersion !== 1 || !keys.every((k) => Array.isArray(x[k]) && x[k].length <= 50_000)) return false;
  const unique = (rows: any[]) =>
    rows.every((r) => r && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 200) &&
    new Set(rows.map((r) => r.id)).size === rows.length;
  return (
    unique(x.activities) &&
    x.activities.every(
      (a: any) =>
        Number.isInteger(a.day) &&
        a.day >= 1 &&
        a.day <= 7 &&
        typeof a.title === 'string' &&
        a.title.length <= 200 &&
        typeof a.description === 'string' &&
        a.description.length <= 4000 &&
        /^\d{2}:\d{2}$/.test(a.time) &&
        typeof a.category === 'string' &&
        a.category.length <= 80 &&
        typeof a.active === 'boolean' &&
        typeof a.sort === 'number',
    ) &&
    unique(x.records) &&
    x.records.every(
      (r: any) =>
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        typeof r.activityId === 'string' &&
        typeof r.title === 'string' &&
        r.title.length <= 300 &&
        ['completed', 'missed', 'skipped', 'minimum'].includes(r.status) &&
        (!r.notes || (typeof r.notes === 'string' && r.notes.length <= 4000)),
    ) &&
    unique(x.entries) &&
    x.entries.every((e: any) => typeof e.type === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) &&
    unique(x.settings)
  );
}
