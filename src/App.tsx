import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Flame,
  Heart,
  Home,
  Lightbulb,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Upload,
  Video,
  BookOpen,
  Code2,
  Sun,
  Moon,
  ArrowUpRight,
  Download,
  RotateCcw,
  X,
} from 'lucide-react';
import { db, seed, iso, weekStart, uid, type Activity as RoutineActivity, type RecordItem } from './db';
import {
  makeRecommendation,
  dailyProgress,
  validateBackup,
  activityRate,
  scheduledStreak,
  getHabitStats,
} from './logic';
import HabitTracker from './HabitTracker';
import WeeklySummary from './WeeklySummary';
const AnalyticsChart = lazy(() => import('./AnalyticsChart'));
type Tab = 'Home' | 'Routine' | 'Goals' | 'Insights' | 'Settings';
const goalDefs = [
  ['Foresite sessions', 5, 'foresite'],
  ['Customer interviews', 1, 'interview'],
  ['TikTok videos posted', 3, 'video'],
  ['Written posts / outreach', 1, 'post'],
  ['Software / CS study', 2, 'study'],
  ['Forex weekly review', 1, 'forexWeekly'],
  ['Forex journal entries', 4, 'forexJournal'],
  ['Savings transfer', 1, 'savings'],
] as const;
const rules = [
  'Minimum viable day: complete at least 30 minutes of Foresite on draining days.',
  'Never miss two days in a row.',
  'Protect one real rest half-day every week.',
  'No phone during Foresite deep work.',
  'Conduct a Friday weekly review.',
  'Adjust the routine monthly rather than daily.',
  'Sleep is non-negotiable.',
  'If something must be cut, cut the skill block or optional market review before cutting sleep.',
];
const tips = [
  'Start small.',
  'Prepare the night before.',
  'Keep the phone away during deep work.',
  'Record content while building.',
  'Use commute time for audio learning.',
  'Maintain a daily win log.',
  'Rest intentionally.',
  'Evaluate progress weekly rather than daily.',
];
export default function App() {
  const [tab, setTab] = useState<Tab>('Home'),
    [date, setDate] = useState(iso()),
    [activities, setActivities] = useState<RoutineActivity[]>([]),
    [records, setRecords] = useState<RecordItem[]>([]),
    [entries, setEntries] = useState<any[]>([]),
    [settings, setSettings] = useState<any>({}),
    [toast, setToast] = useState(''),
    [expanded, setExpanded] = useState<string | null>(null),
    [modal, setModal] = useState(''),
    [quick, setQuick] = useState(''),
    [quickNote, setQuickNote] = useState(''),
    [review, setReview] = useState<any>({}),
    [reviewWeek, setReviewWeek] = useState(weekStart(iso())),
    [win, setWin] = useState(''),
    [dark, setDark] = useState(true),
    [chartRange, setChartRange] = useState(7);
  const today = iso();
  const selected = new Date(`${date}T12:00:00`);
  const day = ((selected.getDay() + 6) % 7) + 1;
  const active = activities
    .filter((a) => a.day === day && a.active && (!a.oneOffDate || a.oneOffDate === date))
    .sort((a, b) => a.sort - b.sort);
  const shownRecords = records.filter((r) => r.date === date);
  const required = active.filter((a) => !a.optional);
  const priorities = [...required]
    .sort(
      (a, b) =>
        (({ foresite: 0, health: 1, planning: 2, wellbeing: 3 })[
          a.category as 'foresite' | 'health' | 'planning' | 'wellbeing'
        ] ?? 4) -
        ({ foresite: 0, health: 1, planning: 2, wellbeing: 3 }[
          b.category as 'foresite' | 'health' | 'planning' | 'wellbeing'
        ] ?? 4),
    )
    .slice(0, 3);
  const progress = dailyProgress(activities, records, date);
  const week = weekStart(today);
  const weekEntries = entries.filter((e) => e.weekStart === week || weekStart(e.date || today) === week);
  const rec = useMemo(
    () => makeRecommendation(records, activities, entries, today, settings.paydayDate),
    [records, activities, entries, today],
  );
  const habitStats = useMemo(
    () => getHabitStats(records, activities, entries, today),
    [records, activities, entries, today],
  );
  const recommendationId = `recommendation-${today}-${rec.ruleId}`;
  const recommendationDismissed = entries.some((e) => e.id === recommendationId && e.dismissedAt);
  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';
  const refresh = async () => {
    setActivities(await db.activities.toArray());
    setRecords(await db.records.toArray());
    setEntries(await db.entries.toArray());
    const saved = (await db.settings.get('app')) || { id: 'app', theme: 'dark' };
    setSettings(saved);
    setDark(saved.theme !== 'light');
    const w = await db.entries.get(`win-${today}`);
    setWin(w?.description || '');
  };
  useEffect(() => {
    seed().then(refresh);
  }, []);
  useEffect(() => {
    if (!activities.length || entries.some((e) => e.id === recommendationId)) return;
    db.entries
      .add({
        id: recommendationId,
        type: 'recommendation',
        ruleId: rec.ruleId,
        title: rec.title,
        message: rec.message,
        reason: rec.reason,
        priority: rec.priority,
        date: today,
        generatedAt: new Date().toISOString(),
      })
      .then(refresh);
  }, [activities.length, entries, recommendationId]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2600);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const saveRecord = async (a: RoutineActivity, status: string) => {
    const id = `${date}-${a.id}`;
    await db.records.put({
      id,
      date,
      activityId: a.id,
      title: a.title,
      category: a.category,
      status: status as any,
      completedAt: ['completed', 'minimum'].includes(status) ? new Date().toISOString() : undefined,
    });
    await refresh();
  };
  const toggle = async (a: RoutineActivity) => {
    const r = shownRecords.find((x) => x.activityId === a.id);
    await saveRecord(a, r && ['completed', 'minimum'].includes(r.status) ? '' : 'completed');
  };
  const addAchievement = async (type: string, desc = '') => {
    await db.entries.add({
      id: uid(),
      type,
      goalType: type,
      status: type === 'video' ? 'Published' : undefined,
      date: today,
      weekStart: week,
      description: desc || `Completed ${type.replace(/[A-Z]/g, ' $&').toLowerCase()}`,
      createdAt: new Date().toISOString(),
    });
    await refresh();
    setToast('Added to this week');
    setQuick('');
  };
  const count = (t: string) =>
    weekEntries.filter(
      (e) => (e.type === t || e.goalType === t) && (t !== 'video' || e.status === 'Published'),
    ).length;
  const changeTheme = async () => {
    const value = !dark;
    setDark(value);
    await db.settings.put({ ...settings, id: 'app', theme: value ? 'dark' : 'light' });
  };
  const title =
    tab === 'Home'
      ? 'Your rhythm'
      : tab === 'Routine'
        ? 'Today, in your own time'
        : tab === 'Goals'
          ? 'A week that adds up'
          : tab === 'Insights'
            ? 'Patterns, not pressure'
            : 'Your space';
  return (
    <div className={`app ${dark ? 'dark' : 'light'}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            F<span>.</span>
          </div>
          <span className="brand-name">
            foresite<span className="brand-tag">YOUR RHYTHM</span>
          </span>
        </div>
        <button className="avatar" onClick={() => setTab('Settings')}>
          M
        </button>
      </header>
      <main className="main">
        <div className="eyebrow">
          {new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }).format(
            selected,
          )}{' '}
          <span className="dot-sep">·</span> WEEK OF {week}
        </div>
        <h1>{tab === 'Home' ? `${greeting}, M.` : title}</h1>
        <p className="subtitle">
          {tab === 'Home'
            ? 'A little progress, repeated. That’s how things get built.'
            : tab === 'Routine'
              ? 'A steady framework. Room for real life.'
              : tab === 'Goals'
                ? 'Keep the promises you made to yourself.'
                : tab === 'Insights'
                  ? 'See what’s working, and what needs a softer touch.'
                  : 'A private space, built around the way you work.'}
        </p>
        {tab === 'Home' && (
          <>
            <section className="hero-grid">
              <div className="card progress-card">
                <div className="card-heading">
                  <span className="eyebrow">TODAY, SO FAR</span>
                  <MoreHorizontal size={18} />
                </div>
                <div className="ring-wrap">
                  <svg viewBox="0 0 150 150" className="ring">
                    <circle cx="75" cy="75" r="63" className="ring-bg" />
                    <circle
                      cx="75"
                      cy="75"
                      r="63"
                      className="ring-value"
                      strokeDasharray={`${progress * 3.96} 396`}
                    />
                  </svg>
                  <div className="ring-label">
                    <strong>
                      {progress}
                      <small>%</small>
                    </strong>
                    <span>complete</span>
                  </div>
                </div>
                <div className="progress-foot">
                  <span>
                    <span className="live-dot" />{' '}
                    {
                      required.filter((a) =>
                        shownRecords.some(
                          (r) => r.activityId === a.id && ['completed', 'minimum'].includes(r.status),
                        ),
                      ).length
                    }{' '}
                    of {required.length} essentials
                  </span>
                  <ChevronRight size={15} />
                </div>
              </div>
              <div className="card foresite-card">
                <div className="focus-top">
                  <span className="icon-pill violet">
                    <Code2 size={17} />
                  </span>
                  <span className="badge">PRIMARY FOCUS</span>
                  <button className="icon-button">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <div className="focus-overline">TODAY’S BUILD</div>
                <h2>
                  Give Foresite
                  <br />
                  some room to grow.
                </h2>
                <p>
                  19:00 — 21:00 <span>·</span> 2 hours
                </p>
                <div className="focus-footer">
                  <span className="streak">
                    <Flame size={14} />{' '}
                    {records.filter((r) => r.category === 'foresite' && weekStart(r.date) === week).length}{' '}
                    sessions this week
                  </span>
                  <button className="button primary" onClick={() => setModal('foresite')}>
                    Start a session <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </section>
            <section className="priorities-block">
              <div className="section-head">
                <div>
                  <div className="eyebrow">A GOOD PLACE TO START</div>
                  <h2>Today’s priorities</h2>
                </div>
                <button className="text-button" onClick={() => setTab('Routine')}>
                  Full routine <ChevronRight size={15} />
                </button>
              </div>
              <div className="priority-list">
                {priorities.map((a, i) => {
                  const done = shownRecords.some(
                    (r) => r.activityId === a.id && ['completed', 'minimum'].includes(r.status),
                  );
                  return (
                    <button
                      key={a.id}
                      className={`priority-row ${done ? 'done' : ''}`}
                      onClick={() => toggle(a)}
                    >
                      <span className={`check ${done ? 'checked' : ''}`}>{done && <Check size={14} />}</span>
                      <span className="priority-copy">
                        <strong>{a.title}</strong>
                        <small>
                          {a.time}
                          {a.endTime ? `–${a.endTime}` : ''} <span>·</span>{' '}
                          {i === 0 ? 'Start with intention' : 'One step at a time'}
                        </small>
                      </span>
                      <span className="priority-arrow">
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  );
                })}
                {active.filter((a) => !a.optional).length === 0 && (
                  <Empty title="A quieter day" text="Enjoy the breathing room." />
                )}
              </div>
            </section>
            <section className="insight-row">
              <RecommendationCard
                rec={rec}
                dismissed={recommendationDismissed}
                onDismiss={async () => {
                  if (recommendationDismissed) return;
                  await db.entries.put({
                    id: recommendationId,
                    type: 'recommendation',
                    ruleId: rec.ruleId,
                    title: rec.title,
                    message: rec.message,
                    reason: rec.reason,
                    priority: rec.priority,
                    date: today,
                    generatedAt: new Date().toISOString(),
                    dismissedAt: new Date().toISOString(),
                  });
                  await refresh();
                }}
              />
              <div className="card win-card">
                <div className="section-head">
                  <div>
                    <div className="eyebrow">A SMALL WIN COUNTS</div>
                    <h3>What moved forward today?</h3>
                  </div>
                  <Heart size={17} className="muted" />
                </div>
                <textarea
                  value={win}
                  onChange={(e) => setWin(e.target.value)}
                  onBlur={() =>
                    db.entries
                      .put({ id: `win-${today}`, type: 'win', date: today, description: win })
                      .then(refresh)
                  }
                  placeholder="It doesn’t have to be a big thing…"
                />
                {entries
                  .filter((e) => e.type === 'win')
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 3)
                  .map((e) => (
                    <div className="past-win" key={e.id}>
                      <span>{e.date}</span>
                      <strong>{e.description}</strong>
                    </div>
                  ))}
                <div className="win-bottom">
                  <span>Only for you, on this device.</span>
                  <Check size={14} />
                </div>
              </div>
            </section>
            <button className="weekly-callout" onClick={() => setTab('Goals')}>
              <span className="callout-icon">
                <Target size={17} />
              </span>
              <div>
                <strong>This week is still in progress</strong>
                <small>{count('foresite')} of 5 Foresite sessions · one day at a time</small>
              </div>
              <ChevronRight size={17} />
            </button>
          </>
        )}
        {tab === 'Routine' && (
          <>
            <div className="day-picker">
              <button
                className="icon-button"
                onClick={() => {
                  const d = new Date(`${date}T12:00:00`);
                  d.setDate(d.getDate() - 1);
                  setDate(iso(d));
                }}
              >
                ‹
              </button>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - d.getDay() + 1 + i);
                const ds = iso(d);
                return (
                  <button
                    key={ds}
                    className={`day-chip ${ds === date ? 'selected' : ''}`}
                    onClick={() => setDate(ds)}
                  >
                    <small>{d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}</small>
                    <strong>{d.getDate()}</strong>
                  </button>
                );
              })}
              <button
                className="icon-button"
                onClick={() => {
                  const d = new Date(`${date}T12:00:00`);
                  d.setDate(d.getDate() + 1);
                  setDate(iso(d));
                }}
              >
                ›
              </button>
            </div>
            <div className="routine-summary card">
              <div>
                <span className="eyebrow">YOUR DAY, AT ITS OWN PACE</span>
                <h2>{progress}% of essentials done</h2>
                <p>Optional commute moments never count against your progress.</p>
              </div>
              <span className="summary-ring">{progress}%</span>
            </div>
            <div className="timeline">
              {active.map((a) => {
                const rec = shownRecords.find((r) => r.activityId === a.id);
                const done = rec && ['completed', 'minimum'].includes(rec.status);
                return (
                  <div className="timeline-row" key={a.id}>
                    <div className="time-col">
                      {a.time}
                      {a.endTime && <small className="end-time">–{a.endTime}</small>}
                      <span />
                    </div>
                    <div className={`activity-card ${done ? 'activity-done' : ''}`}>
                      <div className="activity-main">
                        <button className={`check ${done ? 'checked' : ''}`} onClick={() => toggle(a)}>
                          {done && <Check size={14} />}
                        </button>
                        <button
                          className="activity-title"
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        >
                          <strong>{a.title}</strong>
                          <small>
                            {a.category} {a.optional && <span className="optional-tag">FLEXIBLE</span>}
                          </small>
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        >
                          <ChevronDown size={17} />
                        </button>
                      </div>
                      {expanded === a.id && (
                        <div className="activity-detail">
                          <p>{a.description}</p>
                          <div className="routine-actions">
                            {a.category === 'foresite' && (
                              <button className="text-button" onClick={() => setModal('foresite')}>
                                Log session <ChevronRight size={14} />
                              </button>
                            )}
                            <button className="text-button" onClick={() => saveRecord(a, 'skipped')}>
                              Skip intentionally
                            </button>
                            <button className="text-button" onClick={() => saveRecord(a, 'missed')}>
                              Mark missed
                            </button>
                            <button className="text-button" onClick={() => setModal(`edit:${a.id}`)}>
                              Edit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="add-row" onClick={() => setModal('oneOff')}>
              <Plus size={16} /> Add something to today
            </button>
          </>
        )}
        {tab === 'Goals' && (
          <>
            <div className="goals-banner card">
              <div className="goals-banner-icon">
                <Target size={21} />
              </div>
              <div>
                <span className="eyebrow">WEEK OF {week}</span>
                <h2>Steady beats spectacular.</h2>
                <p>Your targets are a compass, not a scorecard.</p>
              </div>
              <div className="week-dates">
                MON — SUN
                <br />
                <strong>{week}</strong>
              </div>
            </div>
            <div className="tracking-links">
              <button className="card tracking-link" onClick={() => setModal('content')}>
                <span className="goal-icon video">
                  <Video size={17} />
                </span>
                <span>
                  <strong>Building in public</strong>
                  <small>{count('video')} of 3 videos posted · plan a clip</small>
                </span>
                <ChevronRight size={16} />
              </button>
              <button className="card tracking-link" onClick={() => setModal('forex')}>
                <span className="goal-icon forexJournal">
                  <Activity size={17} />
                </span>
                <span>
                  <strong>Learning journal</strong>
                  <small>Capture an educational observation</small>
                </span>
                <ChevronRight size={16} />
              </button>
              <p className="content-privacy">
                <Shield size={13} /> Keep employer systems and private customer details out of content. Ask
                permission before sharing interview lessons.
              </p>
            </div>
            <div className="goal-grid">
              {goalDefs.map(([label, target, type]) => {
                const actual = count(type);
                const targetDue =
                  type === 'savings'
                    ? settings.paydayDate && weekStart(settings.paydayDate) === week
                      ? 1
                      : 0
                    : target;
                const percent = targetDue ? Math.min(100, Math.round((actual / targetDue) * 100)) : 0;
                return (
                  <div className="card goal-card" key={type}>
                    <div className="goal-top">
                      <span className={`goal-icon ${type}`}>
                        <GoalIcon type={type} />
                      </span>
                      <button
                        className="quick-add"
                        onClick={() => setQuick(quick === type ? '' : type)}
                        aria-label={`Add ${label}`}
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                    <h3>{label}</h3>
                    <div className="goal-count">
                      <strong>{actual}</strong>
                      <span> / {targetDue || '—'}</span>
                      <small>{percent}%</small>
                    </div>
                    <div className="meter">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <div className="goal-status">
                      {type === 'savings' && !settings.paydayDate ? (
                        'Set your next payday in Settings'
                      ) : type === 'savings' && !targetDue ? (
                        'No transfer due this week'
                      ) : actual >= targetDue ? (
                        <>
                          <Check size={13} /> Target reached
                        </>
                      ) : (
                        `${targetDue - actual} to go · ${type === 'foresite' ? 'Make room to build' : 'Whenever it fits'}`
                      )}
                    </div>
                    {quick === type && (
                      <div className="inline-add">
                        <input
                          autoFocus
                          placeholder="A short note (optional)"
                          value={quick === type ? quickNote : ''}
                          onChange={(e) => setQuickNote(e.target.value)}
                        />
                        <button
                          className="button primary small"
                          onClick={() => {
                            addAchievement(type, quickNote);
                            setQuickNote('');
                          }}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="history-grid">
              <div className="card history-card">
                <div className="section-head">
                  <div>
                    <div className="eyebrow">CONTENT NOTEBOOK</div>
                    <h2>Ideas become posts</h2>
                  </div>
                  <button className="text-button" onClick={() => setModal('content')}>
                    <Plus size={14} /> Add
                  </button>
                </div>
                {entries
                  .filter((e) => e.type === 'video')
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((e) => (
                    <div className="history-row" key={e.id}>
                      <Video size={14} />
                      <div>
                        <strong>{e.title || e.description}</strong>
                        <small>
                          {e.date} · {e.category} ·{' '}
                          <select
                            className="status-select"
                            aria-label="Content status"
                            value={e.status || 'Idea'}
                            onChange={async (ev) => {
                              await db.entries.update(e.id, {
                                status: ev.target.value,
                                recordedAt: ev.target.value === 'Idea' ? e.recordedAt : today,
                                publishedAt: ev.target.value === 'Published' ? today : undefined,
                              });
                              await refresh();
                            }}
                          >
                            {['Idea', 'Recorded', 'Editing', 'Ready to post', 'Published'].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </small>
                      </div>
                    </div>
                  ))}
                {!entries.some((e) => e.type === 'video') && (
                  <Empty title="Keep a small idea list" text="Record privately; publish only when ready." />
                )}
                <p className="privacy-inline">
                  <Shield size={13} /> Never show employer systems or private customer information.
                </p>
              </div>
              <div className="card history-card">
                <div className="section-head">
                  <div>
                    <div className="eyebrow">EDUCATIONAL NOTES</div>
                    <h2>Forex journal</h2>
                  </div>
                  <button className="text-button" onClick={() => setModal('forex')}>
                    <Plus size={14} /> Review
                  </button>
                </div>
                {entries
                  .filter((e) => e.type === 'forexJournal')
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((e) => (
                    <div className="history-row" key={e.id}>
                      <Activity size={14} />
                      <div>
                        <strong>{e.instrument || 'Market observation'}</strong>
                        <small>
                          {e.date} · {e.lessons || e.observations || 'Educational review'}
                        </small>
                      </div>
                    </div>
                  ))}
                {!entries.some((e) => e.type === 'forexJournal') && (
                  <Empty title="No journal entries yet" text="Use notes to keep your learning together." />
                )}
              </div>
            </div>
            <div className="section-head review-head">
              <div>
                <div className="eyebrow">FRIDAY RESET</div>
                <h2>A moment to reflect</h2>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setReviewWeek(week);
                  setReview(entries.find((e) => e.id === `review-${week}`) || {});
                  setModal('review');
                }}
              >
                Open weekly review <ChevronRight size={15} />
              </button>
            </div>
            <div className="review-prompt card">
              <div className="review-quote">“</div>
              <div>
                <h3>What will make next week feel meaningful?</h3>
                <p>Five honest answers can help you start the new week with clarity.</p>
              </div>
              <CalendarDays size={19} />
            </div>
            {entries
              .filter((e) => e.type === 'review')
              .slice()
              .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
              .map((e) => (
                <button
                  className="review-history card"
                  key={e.id}
                  onClick={() => {
                    setReviewWeek(e.weekStart);
                    setReview(e);
                    setModal('review');
                  }}
                >
                  <span className="eyebrow">WEEK OF {e.weekStart}</span>
                  <strong>{e.q4 || 'Weekly reflection saved'}</strong>
                  <small>
                    {e.q1 || 'Open to review your five answers'} · {e.q2 || '—'} customer conversations
                  </small>
                  <ChevronRight size={15} />
                </button>
              ))}
            <WeeklySummary
              entries={entries}
              records={records}
              week={week}
              goals={goalDefs}
              count={count}
              savingsDue={!!settings.paydayDate && weekStart(settings.paydayDate) === week}
            />
            <div className="foresite-log card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">PROJECT LOG</div>
                  <h2>Foresite, in motion</h2>
                </div>
                <button className="text-button" onClick={() => setModal('foresite')}>
                  Log a session <Plus size={14} />
                </button>
              </div>
              {entries
                .filter((e) => e.type === 'foresiteSession')
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((e) => (
                  <div className="log-row project-log-row" key={e.id}>
                    <span className="log-dot" />
                    <div>
                      <strong>{e.work || e.category || 'Foresite session'}</strong>
                      <small>
                        {e.date} · {e.duration} min · {e.category || 'Development'}
                      </small>
                      {e.outcome && <small>Moved forward: {e.outcome}</small>}
                      {e.unfinished && <small>Still open: {e.unfinished}</small>}
                      {e.next && <small>Next: {e.next}</small>}
                    </div>
                    <Code2 size={15} />
                  </div>
                ))}
              {!entries.some((e) => e.type === 'foresiteSession') && (
                <Empty
                  title="Your story starts with a session"
                  text="A few words about what you built are plenty."
                />
              )}
            </div>
          </>
        )}
        {tab === 'Insights' && (
          <>
            <div className="range-toggle">
              <button onClick={() => setChartRange(7)} className={chartRange === 7 ? 'active' : ''}>
                7 days
              </button>
              <button onClick={() => setChartRange(30)} className={chartRange === 30 ? 'active' : ''}>
                30 days
              </button>
            </div>
            <div className="metrics-grid">
              <Metric label="ESSENTIALS DONE" value={`${progress}%`} note="Today’s routine" />
              <Metric
                label="FORESITE SESSIONS"
                value={String(
                  records.filter((r) => r.category === 'foresite' && weekStart(r.date) === week).length,
                )}
                note="This week"
              />
              <Metric
                label="FORESITE STREAK"
                value={String(scheduledStreak(records, activities, today))}
                note="Scheduled Foresite days"
              />
              <Metric
                label="WEEKLY TARGETS"
                value={`${goalDefs.filter((g) => count(g[2]) >= g[1]).length} / ${goalDefs.length}`}
                note="Reached so far"
              />
            </div>
            <div className="metrics-grid habit-metrics">
              <Metric
                label={'FORESITE · ' + chartRange + ' DAYS'}
                value={rateLabel(
                  activityRate(records, activities, (a) => a.category === 'foresite', chartRange, today),
                )}
                note="Full and minimum sessions"
              />
              <Metric
                label={'REST · ' + chartRange + ' DAYS'}
                value={rateLabel(
                  activityRate(
                    records,
                    activities,
                    (a) => /sleep|early night/i.test(a.title),
                    chartRange,
                    today,
                  ),
                )}
                note="Scheduled sleep routines"
              />
              <Metric
                label={'MOVEMENT · ' + chartRange + ' DAYS'}
                value={rateLabel(
                  activityRate(records, activities, (a) => a.category === 'health', chartRange, today),
                )}
                note="Scheduled movement"
              />
              <Metric
                label={'SKILL · ' + chartRange + ' DAYS'}
                value={rateLabel(
                  activityRate(
                    records,
                    activities,
                    (a) =>
                      a.category === 'learning' && /skill|software|computer science|study/i.test(a.title),
                    chartRange,
                    today,
                  ),
                )}
                note="Scheduled study blocks"
              />
            </div>
            <div className="card chart-card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">A LITTLE EVERY DAY</div>
                  <h2>Your daily rhythm</h2>
                </div>
                <TrendingUp size={19} className="muted" />
              </div>
              <div className="chart-area">
                <Suspense fallback={<div className="chart-loading">Loading your chart…</div>}>
                  <AnalyticsChart records={records} range={chartRange} />
                </Suspense>
              </div>
            </div>
            <HabitTracker habits={habitStats} />
            <div className="insight-cards">
              <Insight
                icon={<Code2 />}
                title="Foresite first"
                value={`${records.filter((r) => r.category === 'foresite').length} sessions`}
                text="Every build session is momentum you can keep."
              />
              <Insight
                icon={<Heart />}
                title="A gentler metric"
                value={`${Math.round((records.filter((r) => r.status === 'completed' || r.status === 'minimum').length / Math.max(records.length, 1)) * 100)}%`}
                text="Your recorded activities completed, including minimum days."
              />
            </div>
            <div className="insight-rec">
              <RecommendationCard
                rec={rec}
                dismissed={recommendationDismissed}
                onDismiss={async () => {
                  if (recommendationDismissed) return;
                  await db.entries.put({
                    id: recommendationId,
                    type: 'recommendation',
                    ruleId: rec.ruleId,
                    title: rec.title,
                    message: rec.message,
                    reason: rec.reason,
                    priority: rec.priority,
                    date: today,
                    generatedAt: new Date().toISOString(),
                    dismissedAt: new Date().toISOString(),
                  });
                  await refresh();
                }}
              />
            </div>
          </>
        )}
        {tab === 'Settings' && (
          <>
            <div className="settings-grid">
              <SettingSection
                icon={<Shield />}
                title="My Rules & Principles"
                sub="The promises that keep your pace sustainable"
              >
                {rules.map((x, i) => (
                  <div className="principle" key={x}>
                    <span className="rule-number">{String(i + 1).padStart(2, '0')}</span>
                    {x}
                  </div>
                ))}
              </SettingSection>
              <SettingSection
                icon={<Lightbulb />}
                title="My Productivity Tips"
                sub="Small practices, repeated often"
              >
                {tips.map((x) => (
                  <div className="tip" key={x}>
                    <Check size={15} />
                    {x}
                  </div>
                ))}
              </SettingSection>
              <SettingSection
                icon={<CalendarDays />}
                title="Routine templates"
                sub="Change future days; past records keep their saved details"
              >
                {activities
                  .filter((a) => !a.oneOffDate)
                  .slice()
                  .sort((a, b) => a.day - b.day || a.sort - b.sort)
                  .map((a) => (
                    <div className="setting-row" key={a.id}>
                      <div>
                        <strong>
                          {
                            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
                              a.day - 1
                            ]
                          }{' '}
                          · {a.title}
                        </strong>
                        <small>
                          {a.time}
                          {a.endTime ? `–${a.endTime}` : ''} · {a.category}
                          {a.optional ? ' · flexible' : ''}
                        </small>
                      </div>
                      <div className="routine-template-actions">
                        <button className="text-button" onClick={() => setModal(`edit:${a.id}`)}>
                          Edit
                        </button>
                        <button
                          className="text-button"
                          onClick={async () => {
                            await db.activities.update(a.id, { active: !a.active });
                            await refresh();
                          }}
                        >
                          {a.active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  ))}
                <button className="add-row settings-add" onClick={() => setModal('addActivity')}>
                  <Plus size={15} /> Add an activity
                </button>
              </SettingSection>
              <SettingSection icon={<Sun />} title="Your preferences" sub="Make the space feel like yours">
                <div className="setting-row">
                  <div>
                    <strong>Appearance</strong>
                    <small>Choose a comfortable theme</small>
                  </div>
                  <button className="theme-toggle" onClick={changeTheme}>
                    {dark ? (
                      <>
                        <Moon size={15} /> Dark
                      </>
                    ) : (
                      <>
                        <Sun size={15} /> Light
                      </>
                    )}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Next payday</strong>
                    <small>Set this to show the savings target in the correct week.</small>
                  </div>
                  <input
                    className="payday-input"
                    type="date"
                    value={settings.paydayDate || ''}
                    onChange={async (e) => {
                      const next = { ...settings, paydayDate: e.target.value };
                      setSettings(next);
                      await db.settings.put({ id: 'app', ...next });
                    }}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <strong>Reminders</strong>
                    <small>
                      Unavailable in this version. Scheduled notifications are not active on this device.
                    </small>
                  </div>
                  <span className="unavailable-badge">Not active</span>
                </div>
                <p className="notice">
                  <Heart size={15} /> Your routine works fully without notifications. No permission is
                  requested and no reminder will be sent.
                </p>
              </SettingSection>
              <SettingSection
                icon={<Upload />}
                title="Your data, your device"
                sub="Your personal records stay in this browser"
              >
                <div className="privacy-note">
                  <Shield size={17} />
                  <p>
                    Everything is stored locally on this device. Nothing is sent to a server. Clearing browser
                    data can remove your records — export a backup to keep them safe.
                  </p>
                </div>
                <div className="backup-actions">
                  <button className="button secondary" onClick={exportBackup}>
                    <Download size={15} /> Export backup
                  </button>
                  <label className="button secondary file-button">
                    <Upload size={15} /> Import backup
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(e) => importBackup(e, refresh, setToast)}
                    />
                  </label>
                </div>
                <button className="text-button restore" onClick={() => setModal('restore')}>
                  <RotateCcw size={14} /> Restore default routine
                </button>
              </SettingSection>
              <SettingSection
                icon={<Shield />}
                title="Your privacy"
                sub="Built to keep your personal life personal"
              >
                <div className="privacy-points">
                  <span>✓ No accounts or cloud sync</span>
                  <span>✓ No trackers or advertising</span>
                  <span>✓ Forex learning only — no trading signals</span>
                  <span>✓ Keep Shepco data and customer details private</span>
                </div>
              </SettingSection>
            </div>
          </>
        )}
      </main>
      <nav className="bottom-nav">
        {(['Home', 'Routine', 'Goals', 'Insights', 'Settings'] as Tab[]).map((item, i) => {
          const Icon = [Home, CalendarDays, Target, TrendingUp, Settings][i];
          return (
            <button
              key={item}
              className={`nav-item ${tab === item ? 'selected' : ''}`}
              onClick={() => {
                setTab(item);
                setDate(today);
              }}
            >
              <span className="nav-icon">
                <Icon size={19} />
              </span>
              <span>{item}</span>
            </button>
          );
        })}
      </nav>
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal onClose={() => setModal('')}>
          <ModalContent
            modal={modal}
            initialReview={review}
            activity={activities.find((a) => a.id === modal.slice(5))}
            onClose={() => setModal('')}
            onSave={async (data: any) => {
              if (modal === 'foresite') {
                const activity = active.find((a) => a.category === 'foresite');
                const activityId = activity?.id || uid();
                const id = activity ? `${today}-${activity.id}` : uid();
                await db.records.put({
                  id,
                  date: today,
                  activityId,
                  title: `Foresite · ${data.duration} min`,
                  category: 'foresite',
                  status: data.duration < 120 ? 'minimum' : 'completed',
                  completedAt: new Date().toISOString(),
                  duration: Number(data.duration),
                  notes: data.outcome,
                });
                await db.entries.add({
                  id: uid(),
                  type: 'foresite',
                  goalType: 'foresite',
                  date: today,
                  weekStart: week,
                  duration: Number(data.duration),
                  description: data.outcome || 'Foresite session',
                });
                await db.entries.add({ id: uid(), type: 'foresiteSession', date: today, ...data });
              } else if (modal === 'content') {
                await db.entries.add({
                  id: uid(),
                  type: 'video',
                  goalType: 'video',
                  date: today,
                  weekStart: week,
                  recordedAt: data.status !== 'Idea' ? today : undefined,
                  publishedAt: data.status === 'Published' ? today : undefined,
                  ...data,
                  createdAt: new Date().toISOString(),
                });
              } else if (modal === 'forex') {
                await db.entries.add({
                  id: uid(),
                  type: 'forexJournal',
                  goalType: 'forexJournal',
                  date: today,
                  weekStart: week,
                  ...data,
                  createdAt: new Date().toISOString(),
                });
              } else if (modal === 'review') {
                await db.entries.put({
                  id: `review-${reviewWeek}`,
                  type: 'review',
                  weekStart: reviewWeek,
                  date: today,
                  ...data,
                  updatedAt: new Date().toISOString(),
                });
              } else if (modal === 'addActivity' || modal === 'oneOff') {
                await db.activities.add({
                  id: uid(),
                  day: modal === 'oneOff' ? day : data.day || day,
                  oneOffDate: modal === 'oneOff' ? date : undefined,
                  title: data.title,
                  description: data.description,
                  time: data.time,
                  endTime: data.endTime,
                  category: data.category || 'personal',
                  optional: !!data.optional,
                  active: true,
                  sort: active.length,
                });
              } else if (modal.startsWith('edit:')) {
                const id = modal.slice(5);
                await db.activities.update(id, data);
              }
              await refresh();
              setModal('');
              setToast('Saved on this device.');
            }}
            onRestore={async () => {
              await db.activities.clear();
              await seed();
              await refresh();
              setModal('');
              setToast('Default routine restored. Past records are unchanged.');
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function RecommendationCard({ rec, dismissed, onDismiss }: any) {
  return (
    <div className="card recommendation">
      <div className="rec-icon">
        <Lightbulb size={17} />
      </div>
      <div>
        <div className="eyebrow">{dismissed ? 'SET ASIDE FOR TODAY' : 'BASED ON YOUR RECORDED ACTIVITY'}</div>
        <h3>{dismissed ? 'You’ve dismissed today’s note.' : rec.title}</h3>
        {!dismissed && <p>{rec.message}</p>}
        <span className="rec-reason">{rec.reason}</span>
        {!dismissed && (
          <button className="text-button dismiss-recommendation" onClick={onDismiss}>
            Dismiss for today
          </button>
        )}
      </div>
    </div>
  );
}
function GoalIcon({ type }: { type: string }) {
  let I: any =
    type === 'foresite'
      ? Code2
      : type === 'interview'
        ? MessageCircle
        : type === 'video'
          ? Video
          : type === 'study'
            ? BookOpen
            : type.startsWith('forex')
              ? Activity
              : Target;
  return <I size={17} />;
}
function rateLabel(v: number | null) {
  return v === null ? '—' : v + '%';
}
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Insight({ icon, title, value, text }: any) {
  return (
    <div className="card insight-tile">
      <span className="insight-icon">{icon}</span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Empty({ title, text }: any) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sun size={16} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
function SettingSection({ icon, title, sub, children }: any) {
  return (
    <section className="card setting-section">
      <div className="setting-heading">
        <span className="setting-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      </div>
      <div className="setting-content">{children}</div>
    </section>
  );
}
function streak(records: RecordItem[]) {
  let n = 0,
    d = new Date();
  while (n < 365) {
    const ds = iso(d),
      done = records.some((r) => r.date === ds && (r.status === 'completed' || r.status === 'minimum'));
    if (!done && n > 0) break;
    if (!done) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function Modal({ children, onClose }: any) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
function ModalContent({ modal, activity, initialReview, onClose, onSave, onRestore }: any) {
  const [form, setForm] = useState<any>(modal === 'review' ? initialReview : activity || { duration: 120 });
  const [f, setF] = useState('');
  const update = (k: string, v: any) => setForm({ ...form, [k]: v });
  if (modal === 'restore')
    return (
      <>
        <span className="modal-icon">
          <RotateCcw />
        </span>
        <h2>Restore the original rhythm?</h2>
        <p>
          Your routine templates will return to their defaults. Past activity and notes stay exactly as they
          are.
        </p>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Keep my routine
          </button>
          <button className="button primary" onClick={onRestore}>
            Restore defaults
          </button>
        </div>
      </>
    );
  if (modal === 'content')
    return (
      <>
        <span className="modal-icon violet">
          <Video />
        </span>
        <div className="eyebrow">BUILDING IN PUBLIC</div>
        <h2>Capture the work, your way.</h2>
        <label className="form-label">
          Video idea or title
          <input
            value={form.title || ''}
            onChange={(e) => update('title', e.target.value)}
            placeholder="A small feature, a lesson, a build day…"
          />
        </label>
        <label className="form-label">
          Category
          <select
            value={form.category || 'Day N of building Foresite'}
            onChange={(e) => update('category', e.target.value)}
          >
            {[
              'Day N of building Foresite',
              'Bug fixed',
              'Feature demonstration',
              'Customer interview lesson',
              'Weekly progress',
              'Mistakes and lessons learned',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Status
          <select value={form.status || 'Idea'} onChange={(e) => update('status', e.target.value)}>
            {['Idea', 'Recorded', 'Editing', 'Ready to post', 'Published'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Notes
          <textarea
            value={form.notes || ''}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Ask before sharing interview details."
          />
        </label>
        <div className="notice">
          <Shield size={14} /> Never show Shepco systems or private customer information.
        </div>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" onClick={() => form.title && onSave(form)}>
            Save content
          </button>
        </div>
      </>
    );
  if (modal === 'forex')
    return (
      <>
        <span className="modal-icon">
          <Activity />
        </span>
        <div className="eyebrow">EDUCATIONAL REVIEW ONLY</div>
        <h2>Notice something worth learning?</h2>
        <label className="form-label">
          Instrument (optional)
          <input
            value={form.instrument || ''}
            onChange={(e) => update('instrument', e.target.value)}
            placeholder="e.g. EUR/USD"
          />
        </label>
        <label className="form-label">
          Market observations
          <textarea
            value={form.observations || ''}
            onChange={(e) => update('observations', e.target.value)}
            placeholder="What did you notice?"
          />
        </label>
        <label className="form-label">
          Lesson learned
          <textarea
            value={form.lessons || ''}
            onChange={(e) => update('lessons', e.target.value)}
            placeholder="What will you remember?"
          />
        </label>
        <label className="form-label">
          Notes
          <textarea value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" onClick={() => onSave(form)}>
            Save journal entry
          </button>
        </div>
      </>
    );
  if (modal === 'review') {
    const qs = [
      'What did I ship this week?',
      'How many customer conversations did I have?',
      'What took more time than it should have?',
      'What is the single most important thing for next week?',
      'Did I stick to sleep, exercise and savings?',
    ];
    return (
      <>
        <span className="modal-icon">
          <CalendarDays />
        </span>
        <div className="eyebrow">FRIDAY WEEKLY REVIEW</div>
        <h2>A week, honestly remembered.</h2>
        {qs.map((q, i) => (
          <label className="form-label" key={q}>
            {q}
            <textarea
              value={form[`q${i + 1}`] || ''}
              onChange={(e) => update(`q${i + 1}`, e.target.value)}
              rows={i === 4 ? 2 : 2}
            />
          </label>
        ))}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Later
          </button>
          <button className="button primary" onClick={() => onSave(form)}>
            Save this review
          </button>
        </div>
      </>
    );
  }
  if (modal === 'foresite')
    return (
      <>
        <span className="modal-icon violet">
          <Code2 />
        </span>
        <div className="eyebrow">FORESITE · DEVELOPMENT LOG</div>
        <h2>Make a little room to build.</h2>
        <p>A 30-minute minimum day counts. Choose the session you actually did.</p>
        <label className="form-label">
          Session length
          <select value={form.duration} onChange={(e) => update('duration', Number(e.target.value))}>
            <option value={30}>30 minutes · minimum day</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
            <option value={120}>2 hours · full session</option>
          </select>
        </label>
        <label className="form-label">
          Work category
          <select value={form.category || 'Development'} onChange={(e) => update('category', e.target.value)}>
            {[
              'Development',
              'Bug fixing',
              'Research',
              'Customer interviews',
              'Planning',
              'Documentation',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          What did you work on?
          <input
            value={form.work || ''}
            onChange={(e) => update('work', e.target.value)}
            placeholder="Feature, bug, research…"
          />
        </label>
        <label className="form-label">
          What moved forward?
          <textarea
            value={form.outcome || ''}
            onChange={(e) => update('outcome', e.target.value)}
            placeholder="A quick note to future you…"
          />
        </label>
        <label className="form-label">
          What remains unfinished?
          <textarea
            value={form.unfinished || ''}
            onChange={(e) => update('unfinished', e.target.value)}
            placeholder="Anything to pick up next time?"
          />
        </label>
        <label className="form-label">
          Next task
          <input
            value={form.next || ''}
            onChange={(e) => update('next', e.target.value)}
            placeholder="Where to pick up next time"
          />
        </label>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() => onSave({ ...form, duration: Number(form.duration) })}
          >
            Save session
          </button>
        </div>
      </>
    );
  if (modal === 'addActivity' || modal === 'oneOff' || modal.startsWith('edit:'))
    return (
      <>
        <span className="modal-icon">
          <Plus />
        </span>
        <h2>
          {modal === 'oneOff'
            ? 'Add a one-time task for this date.'
            : modal === 'addActivity'
              ? 'Add an activity to your weekly routine.'
              : 'Adjust your routine.'}
        </h2>
        <label className="form-label">
          Activity
          <input
            value={form.title || ''}
            onChange={(e) => update('title', e.target.value)}
            placeholder="What would you like to do?"
          />
        </label>
        <label className="form-label">
          Time
          <input type="time" value={form.time || '18:00'} onChange={(e) => update('time', e.target.value)} />
        </label>
        <label className="form-label">
          End time (optional)
          <input
            type="time"
            value={form.endTime || ''}
            onChange={(e) => update('endTime', e.target.value || undefined)}
          />
        </label>
        <label className="form-label">
          Description
          <textarea
            value={form.description || ''}
            onChange={(e) => update('description', e.target.value)}
            placeholder="A little context"
          />
        </label>
        <label className="form-label">
          Category
          <select value={form.category || 'personal'} onChange={(e) => update('category', e.target.value)}>
            {['personal', 'foresite', 'health', 'learning', 'forex', 'planning', 'wellbeing'].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label inline-check">
          <input
            type="checkbox"
            checked={!!form.optional}
            onChange={(e) => update('optional', e.target.checked)}
          />{' '}
          Flexible optional activity (excluded from daily progress)
        </label>
        {modal === 'addActivity' && (
          <label className="form-label">
            Day
            <select value={form.day || 1} onChange={(e) => update('day', Number(e.target.value))}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d, i) => (
                <option value={i + 1} key={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() => form.title && onSave({ ...form, day: form.day || new Date().getDay() || 7 })}
          >
            Save activity
          </button>
        </div>
      </>
    );
  return <button onClick={onClose}>Close</button>;
}
function exportBackup() {
  db.transaction('r', db.activities, db.records, db.entries, db.settings, async () => {
    const data = {
      formatVersion: 1,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      activities: await db.activities.toArray(),
      records: await db.records.toArray(),
      entries: await db.entries.toArray(),
      settings: await db.settings.toArray(),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `foresite-backup-${iso()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }).catch(console.error);
}
async function importBackup(e: any, refresh: any, setToast: any) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw Error('Backup is larger than the 20 MB safety limit.');
    const d = JSON.parse(await file.text());
    if (!validateBackup(d))
      throw Error(
        'This backup is incomplete, malformed or from an unsupported version. Your existing data was not changed.',
      );
    const mode = prompt(
      'Choose how to import: type MERGE to combine records, REPLACE to replace all local data, or Cancel.',
      'MERGE',
    );
    if (!mode) return;
    if (!['MERGE', 'REPLACE'].includes(mode.toUpperCase()))
      throw Error('Import cancelled. Choose MERGE or REPLACE.');
    const replace = mode.toUpperCase() === 'REPLACE';
    if (
      !confirm(
        replace
          ? 'Replace all existing routine and personal data with this backup? This cannot be undone.'
          : 'Merge this backup with existing data? Matching IDs will be updated.',
      )
    )
      return;
    await db.transaction('rw', db.activities, db.records, db.entries, db.settings, async () => {
      if (replace) {
        await db.activities.clear();
        await db.records.clear();
        await db.entries.clear();
        await db.settings.clear();
      }
      await db.activities.bulkPut(d.activities);
      await db.records.bulkPut(d.records);
      await db.entries.bulkPut(d.entries);
      await db.settings.bulkPut(d.settings);
    });
    await refresh();
    setToast(replace ? 'Backup restored.' : 'Backup merged successfully.');
  } catch (err: any) {
    setToast(err.message || 'Could not import this backup.');
  } finally {
    e.target.value = '';
  }
}
