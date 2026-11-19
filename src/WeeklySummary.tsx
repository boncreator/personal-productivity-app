import { weekStart, type RecordItem } from './db';

type Props = {
  entries: any[];
  records: RecordItem[];
  week: string;
  goals: readonly (readonly [string, number, string])[];
  count: (type: string) => number;
  savingsDue: boolean;
};
export default function WeeklySummary({ entries, records, week, goals, count, savingsDue }: Props) {
  const review = entries.find((e) => e.type === 'review' && e.weekStart === week);
  if (!review) return null;
  const rows = records.filter((r) => weekStart(r.date) === week),
    used = rows.filter((r) => r.status !== 'skipped'),
    done = used.filter((r) => r.status === 'completed' || r.status === 'minimum');
  const openGoals = goals
    .filter((g) => !(g[2] === 'savings' && !savingsDue) && count(g[2]) < g[1])
    .map((g) => g[0]);
  const wins = entries.filter((e) => e.type === 'win' && weekStart(e.date) === week);
  const stats: [string, string | number][] = [
    [
      'Foresite sessions',
      rows.filter((r) => r.category === 'foresite' && (r.status === 'completed' || r.status === 'minimum'))
        .length,
    ],
    ['Customer conversations', count('interview')],
    ['Videos posted', count('video')],
    ['Study sessions', count('study')],
    ['Forex reviews', count('forexWeekly')],
    ['Recorded routine rate', used.length ? `${Math.round((done.length / used.length) * 100)}%` : '—'],
  ];
  return (
    <section className="card week-summary">
      <div className="eyebrow">YOUR WEEK, IN REVIEW</div>
      <h2>A week of showing up.</h2>
      <div className="summary-stats">
        {stats.map(([label, value]) => (
          <div className="summary-stat" key={label}>
            <strong>{value}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className="summary-foot">
        <div>
          <small>WINS</small>
          <p>
            {wins.length
              ? wins.map((e) => e.description).join(' · ')
              : 'Keep recording the small things that moved.'}
          </p>
        </div>
        <div>
          <small>OPEN TARGETS</small>
          <p>{openGoals.length ? openGoals.join(' · ') : 'No weekly targets left open.'}</p>
        </div>
        <div>
          <small>NEXT WEEK’S PRIORITY</small>
          <p>{review.q4 || 'Add one clear priority in your review.'}</p>
        </div>
      </div>
    </section>
  );
}
