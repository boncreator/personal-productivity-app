import { Flame, TrendingUp } from 'lucide-react';

type Habit = {
  id: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  weeklyRate: number | null;
  monthlyRate: number | null;
  completedSessions: number;
};
export default function HabitTracker({ habits }: { habits: Habit[] }) {
  return (
    <section className="habit-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">SCHEDULED HABITS</div>
          <h2>Consistency, in context</h2>
        </div>
        <span className="habit-caption">Only activities you scheduled count.</span>
      </div>
      <div className="habit-grid">
        {habits.map((h) => (
          <article className="card habit-card" key={h.id}>
            <div className="habit-title">
              <strong>{h.name}</strong>
              <span>
                <Flame size={12} />
                {h.currentStreak}
              </span>
            </div>
            <div className="habit-details">
              <div>
                <small>7 DAY</small>
                <strong>{formatRate(h.weeklyRate)}</strong>
              </div>
              <div>
                <small>30 DAY</small>
                <strong>{formatRate(h.monthlyRate)}</strong>
              </div>
              <div>
                <small>LONGEST</small>
                <strong>{h.longestStreak}</strong>
              </div>
            </div>
            <div className="habit-footer">
              <TrendingUp size={12} />
              {h.completedSessions} completed sessions
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function formatRate(value: number | null) {
  return value === null ? '—' : `${value}%`;
}
