import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { buildDefaultRoutine, RhythmDB } from '../src/db';
import {
  activityRate,
  dailyProgress,
  getHabitStats,
  makeRecommendation,
  scheduledStreak,
  validateBackup,
} from '../src/logic';
import type { Activity, Entry, RecordItem } from '../src/db';

const activities = Array.from({ length: 7 }, (_, i) => buildDefaultRoutine(i + 1)).flat();
const record = (
  date: string,
  activityId: string,
  status: RecordItem['status'] = 'completed',
): RecordItem => ({ id: `${date}-${activityId}`, date, activityId, title: 'saved title', status });
const day = (date: string, offset: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('default routine and local progress', () => {
  it('creates the weekday routine and weekday-specific skill rotation', () => {
    expect(buildDefaultRoutine(1)).toHaveLength(13);
    expect(buildDefaultRoutine(2).find((a) => a.time === '21:00')?.title).toContain('Software development');
    expect(buildDefaultRoutine(3).find((a) => a.time === '21:00')?.title).toContain('TikTok');
    expect(buildDefaultRoutine(5).find((a) => a.time === '21:00')?.title).toContain('Friday weekly review');
    expect(buildDefaultRoutine(1).find((a) => a.category === 'learning' && a.optional)?.optional).toBe(true);
  });
  it('protects Sunday morning and includes the Saturday build block', () => {
    const sun = buildDefaultRoutine(7),
      sat = buildDefaultRoutine(6);
    expect(sun[0].title).toContain('Rest');
    expect(sun[0].time).toBe('08:00');
    expect(sat.find((a) => a.category === 'foresite')?.time).toBe('09:30');
  });
  it('excludes flexible commute activities from daily progress', () => {
    const mon = buildDefaultRoutine(1),
      required = mon.filter((a) => !a.optional);
    expect(
      dailyProgress(
        mon,
        required.map((a) => record('2026-11-16', a.id)),
        '2026-11-16',
      ),
    ).toBe(100);
    expect(dailyProgress(mon, [], '2026-11-16')).toBe(0);
  });
  it('keeps a historical record title independent of edited templates', () => {
    const history = record('2026-11-16', 'd1-8');
    const edited = { ...buildDefaultRoutine(1)[8], title: 'A renamed future session' };
    expect(history.title).toBe('saved title');
    expect(edited.title).not.toBe(history.title);
  });
  it('measures activity streaks by scheduled occurrences and accepts minimum sessions', () => {
    const dates = ['2026-11-16', '2026-11-17', '2026-11-18'];
    const rows = dates.map((d) => {
      const dow = ((new Date(`${d}T12:00:00`).getDay() + 6) % 7) + 1;
      const a = buildDefaultRoutine(dow).find((x) => x.category === 'foresite')!;
      return record(d, a.id, d === '2026-11-17' ? 'minimum' : 'completed');
    });
    expect(scheduledStreak(rows, activities, '2026-11-18', new Date('2026-11-18T12:00:00'))).toBe(3);
    expect(activityRate(rows, activities, (a) => a.category === 'foresite', 7, '2026-11-18')).toBe(100);
  });
  it('reports weekly, monthly, current, longest and completed-session habit stats', () => {
    const dates = ['2026-11-16', '2026-11-17', '2026-11-18'];
    const rows = dates.map((d, i) => {
      const dow = ((new Date(`${d}T12:00:00`).getDay() + 6) % 7) + 1;
      const a = buildDefaultRoutine(dow).find((x) => x.category === 'foresite')!;
      return record(d, a.id, i === 1 ? 'minimum' : 'completed');
    });
    const stat = getHabitStats(rows, activities, [], '2026-11-18').find((x) => x.id === 'foresite')!;
    expect(stat.weeklyRate).toBe(100);
    expect(stat.currentStreak).toBe(3);
    expect(stat.longestStreak).toBe(3);
    expect(stat.completedSessions).toBe(3);
  });
});

describe('evidence-based recommendations', () => {
  const date = '2026-11-18';
  it('recommends a minimum Foresite session after three missed scheduled days', () => {
    const activity = buildDefaultRoutine(3).find((a) => a.category === 'foresite')!;
    const misses = [-2, -1, 0].map((n) => {
      const d = day(date, n);
      return record(
        d,
        buildDefaultRoutine(((new Date(d + 'T12:00:00').getDay() + 6) % 7) + 1).find(
          (a) => a.category === 'foresite',
        )!.id,
        'missed',
      );
    });
    expect(makeRecommendation(misses, activities, [], date).ruleId).toBe('foresite');
  });
  it('recommends consolidating after two missed forex sessions', () => {
    const fx = buildDefaultRoutine(1).find((a) => a.category === 'forex')!;
    const records = [
      record('2026-11-16', fx.id, 'missed'),
      record('2026-11-17', buildDefaultRoutine(2).find((a) => a.category === 'forex')!.id, 'missed'),
    ];
    expect(makeRecommendation(records, activities, [], date).ruleId).toBe('forex');
  });
  it('does not count unpublished content toward the target', () => {
    const entries: Entry[] = [
      { id: 'v1', date, type: 'video', status: 'Idea' },
      { id: 'v2', date, type: 'video', status: 'Published' },
    ];
    expect(makeRecommendation([], [], entries, date).ruleId).toBe('content');
  });
  it('only suggests a stretch target when every weekly target is recorded', () => {
    const entries: Entry[] = [
      ['foresite', 5],
      ['interview', 1],
      ['video', 3],
      ['post', 1],
      ['study', 2],
      ['forexWeekly', 1],
      ['forexJournal', 4],
      ['savings', 1],
    ].flatMap(([type, n]) =>
      Array.from({ length: Number(n) }, (_, i) => ({
        id: `${type}-${i}`,
        date,
        type: String(type),
        goalType: String(type),
        status: type === 'video' ? 'Published' : undefined,
        weekStart: '2026-11-16',
      })),
    );
    expect(makeRecommendation([], [], entries, date).ruleId).toBe('stretch');
  });
  it('recommends a sleep reset after repeated explicitly missed sleep habits', () => {
    const sleep = buildDefaultRoutine(1).find((a) => a.title === 'Sleep')!;
    const misses = [-1, -2, -3, -4, -5, -6, -7].flatMap((n) => {
      const d = day(date, n),
        dnum = ((new Date(d + 'T12:00:00').getDay() + 6) % 7) + 1;
      const a = buildDefaultRoutine(dnum).find((x) => /sleep|early night/i.test(x.title));
      return a ? [record(d, a.id, 'missed')] : [];
    });
    expect(makeRecommendation(misses, activities, [], date).ruleId).toBe('sleep');
  });
  it('recommends connecting repeated study misses to a Foresite feature', () => {
    const misses = [-1, -6, -3].map((n) => {
      const d = day(date, n),
        dnum = ((new Date(d + 'T12:00:00').getDay() + 6) % 7) + 1;
      const item = buildDefaultRoutine(dnum).find(
        (a) => a.category === 'learning' && /skill|study|software|computer science/i.test(a.title),
      );
      return record(d, item!.id, 'missed');
    });
    expect(makeRecommendation(misses, activities, [], date).ruleId).toBe('study');
  });
  it('warns when the recent scheduled completion rate falls against the monthly rate', () => {
    const rows: RecordItem[] = [];
    for (let n = -29; n < 0; n++) {
      const d = day(date, n),
        dnum = ((new Date(`${d}T12:00:00`).getDay() + 6) % 7) + 1;
      for (const a of buildDefaultRoutine(dnum).filter((x) => !x.optional)) {
        if (a.title === 'Sleep') rows.push(record(d, a.id));
        else rows.push(record(d, a.id, n >= -6 ? 'missed' : 'completed'));
      }
    }
    expect(makeRecommendation(rows, activities, [], date).ruleId).toBe('burnout');
  });
  it('checks backup records before import', () => {
    const good = { formatVersion: 1, activities, records: [], entries: [], settings: [] };
    expect(validateBackup(good)).toBe(true);
    expect(validateBackup({ ...good, records: [{ id: 'bad' }] })).toBe(false);
  });
});

describe('IndexedDB persistence', () => {
  it('creates and updates records while retaining the saved historical title', async () => {
    const local = new RhythmDB(`test-${crypto.randomUUID()}`);
    await local.open();
    const activity = buildDefaultRoutine(1)[8],
      record = {
        id: '2026-11-16-d1-8',
        date: '2026-11-16',
        activityId: activity.id,
        title: activity.title,
        status: 'completed' as const,
      };
    await local.activities.add(activity);
    await local.records.add(record);
    await local.activities.update(activity.id, { title: 'Renamed for future weeks' });
    expect((await local.records.get(record.id))?.title).toBe('Foresite deep work');
    await local.records.update(record.id, { status: 'minimum' });
    expect((await local.records.get(record.id))?.status).toBe('minimum');
    await local.delete();
  });
  it('migrates a version-one database without dropping old records', async () => {
    const name = `migration-${crypto.randomUUID()}`,
      old = new Dexie(name);
    old.version(1).stores({
      activities: 'id,day,active,sort',
      records: 'id,date,activityId,[date+activityId]',
      entries: 'id,date,type,weekStart,status',
      settings: 'id',
    });
    await old.open();
    await old.table('records').add({
      id: 'kept',
      date: '2026-11-16',
      activityId: 'd1-8',
      title: 'Old saved session',
      status: 'completed',
    });
    await old.close();
    const upgraded = new RhythmDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect((await upgraded.records.get('kept'))?.title).toBe('Old saved session');
    expect(await upgraded.settings.get('app')).toBeTruthy();
    await upgraded.delete();
  });
});
