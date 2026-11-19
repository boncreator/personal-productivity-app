import Dexie, { type Table } from 'dexie';

export type Activity = {
  id: string;
  day: number;
  oneOffDate?: string;
  title: string;
  description: string;
  time: string;
  endTime?: string;
  category: string;
  optional?: boolean;
  active: boolean;
  sort: number;
};
export type RecordItem = {
  id: string;
  date: string;
  activityId: string;
  title: string;
  category?: string;
  status: 'completed' | 'missed' | 'skipped' | 'minimum';
  completedAt?: string;
  duration?: number;
  notes?: string;
};
export type Entry = { id: string; date: string; type: string; [key: string]: any };
export type Setting = { id: string; [key: string]: any };

export class RhythmDB extends Dexie {
  activities!: Table<Activity, string>;
  records!: Table<RecordItem, string>;
  entries!: Table<Entry, string>;
  settings!: Table<Setting, string>;
  constructor(name = 'foresite-rhythm') {
    super(name);
    this.version(1).stores({
      activities: 'id,day,active,sort',
      records: 'id,date,activityId,[date+activityId]',
      entries: 'id,date,type,weekStart,status',
      settings: 'id',
    });
    this.version(2)
      .stores({
        activities: 'id,day,active,sort',
        records: 'id,date,activityId,[date+activityId]',
        entries: 'id,date,type,weekStart,status,goalType',
        settings: 'id',
      })
      .upgrade(async (t) => {
        await t.table('settings').put({ id: 'app', theme: 'dark', notificationsEnabled: false });
      });
    this.version(3).stores({
      activities: 'id,day,oneOffDate,active,sort,category',
      records: 'id,date,activityId,[date+activityId],category,status',
      entries: 'id,date,type,weekStart,status,goalType',
      settings: 'id',
    });
  }
}
export const db = new RhythmDB();
const weekdayRows: [string, string, string, string, boolean?][] = [
  ['06:00', 'Wake up and drink water', 'Start gently; hydrate before the day begins.', 'wellbeing'],
  ['06:05', 'Movement', 'Exercise Mon/Wed/Fri; walk or stretch Tue/Thu.', 'health'],
  ['06:35', 'Get ready', 'Shower, breakfast and prepare to leave.', 'wellbeing'],
  [
    '07:00',
    'Morning commute',
    'Sales, communication or business podcast. Keep flexible with commute time.',
    'learning',
    true,
  ],
  ['07:30', 'Work at Shepco', 'Focused workday.', 'work'],
  ['12:30', 'Lunch learning', 'Spend 20 minutes reading or capturing notes.', 'learning', true],
  ['17:00', 'Evening commute', 'Audio learning or rest, depending on the day.', 'learning', true],
  ['18:00', 'Dinner & decompress', 'Eat, rest and transition out of work.', 'wellbeing'],
  [
    '19:00',
    'Foresite deep work',
    'Protected development time. Two hours standard; 30 minutes is a valid minimum day.',
    'foresite',
  ],
  ['21:00', 'Skill rotation', 'Develop the skill that supports this week’s Foresite progress.', 'learning'],
  ['21:40', 'Forex review & journal', 'Educational observation and journaling only.', 'forex'],
  ['22:10', 'Plan & wind down', 'Choose tomorrow’s three priorities, then wind down.', 'wellbeing'],
  ['22:30', 'Sleep', 'Protect your recovery.', 'wellbeing'],
];
const skills = [
  'Communication & sales: rehearse the Foresite pitch, draft outreach and prepare social content.',
  'Software development, computer science and the next Foresite technology.',
  'Communication & sales: pitch practice, a short build update and TikTok editing.',
  'Software engineering and computer science coursework.',
  'Friday weekly review, then rest.',
];
const endTimes: Record<number, Record<number, string>> = {
  1: { 1: '06:35', 2: '06:55', 4: '17:00', 8: '21:00', 9: '21:40', 10: '22:10', 11: '22:30' },
  2: { 1: '06:35', 2: '06:55', 4: '17:00', 8: '21:00', 9: '21:40', 10: '22:10', 11: '22:30' },
  3: { 1: '06:35', 2: '06:55', 4: '17:00', 8: '21:00', 9: '21:40', 10: '22:10', 11: '22:30' },
  4: { 1: '06:35', 2: '06:55', 4: '17:00', 8: '21:00', 9: '21:40', 10: '22:10', 11: '22:30' },
  5: { 1: '06:35', 2: '06:55', 4: '17:00', 8: '21:00', 9: '21:40', 10: '22:10', 11: '22:30' },
  6: { 1: '09:00', 2: '12:30', 3: '15:00', 4: '15:30', 5: '16:30' },
  7: { 1: '15:00', 2: '16:30', 3: '17:00' },
};
const weekendRows: Record<number, [string, string, string, string][]> = {
  6: [
    ['07:00', 'Wake up', 'A relaxed start to the weekend.', 'wellbeing'],
    ['08:00', 'Gym / longer workout', 'Move at a comfortable pace.', 'health'],
    ['09:30', 'Foresite deep work', 'Build or speak with customers.', 'foresite'],
    ['13:30', 'Forex weekly review & planning', 'Educational review and journaling.', 'forex'],
    ['15:00', 'Old Mutual online work', 'Scheduled work block.', 'work'],
    ['15:30', 'Admin & client work', 'Starlink, website clients, invoices and outreach.', 'work'],
    ['18:00', 'Friends, family & recreation', 'Enjoy your evening.', 'wellbeing'],
  ],
  7: [
    ['08:00', 'Rest & relaxation', 'Sunday morning is protected rest time.', 'wellbeing'],
    ['14:00', 'Weekly planning', 'Review the week and set your priorities.', 'planning'],
    ['15:00', 'Study block', 'A focused block for coursework or technical learning.', 'learning'],
    ['16:30', 'Prepare for the week', 'Clothes, food and charge devices.', 'planning'],
    ['21:30', 'Early night', 'Give yourself room to recover.', 'wellbeing'],
  ],
};
export function buildDefaultRoutine(day: number): Activity[] {
  if (day >= 1 && day <= 5)
    return weekdayRows.map((r, i) => ({
      id: `d${day}-${i}`,
      day,
      title: i === 9 ? skills[day - 1] : r[1],
      description: r[2],
      time: r[0],
      endTime: endTimes[day]?.[i],
      category: r[3],
      optional: r[4] ?? false,
      active: !(day === 5 && i === 10),
      sort: i,
    }));
  return (weekendRows[day] || []).map((r, i) => ({
    id: `d${day}-${i}`,
    day,
    title: r[1],
    description: r[2],
    time: r[0],
    endTime: endTimes[day]?.[i],
    category: r[3],
    optional: false,
    active: true,
    sort: i,
  }));
}
export async function seed() {
  if (await db.activities.count()) return;
  await db.activities.bulkAdd(Array.from({ length: 7 }, (_, i) => buildDefaultRoutine(i + 1)).flat());
  await db.settings.put({ id: 'app', theme: 'dark', notificationsEnabled: false, reminders: {} });
}
export const iso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const weekStart = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};
export const uid = () => crypto.randomUUID();
