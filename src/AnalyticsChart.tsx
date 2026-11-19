import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { iso, type RecordItem } from './db';

export default function AnalyticsChart({ records, range }: { records: RecordItem[]; range: number }) {
  const data = Array.from({ length: range }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (range - 1 - i));
    const date = iso(d);
    const rows = records.filter((r) => r.date === date && r.status !== 'skipped');
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      value: rows.length
        ? Math.round(
            (rows.filter((r) => ['completed', 'minimum'].includes(r.status)).length / rows.length) * 100,
          )
        : 0,
    };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          interval={range === 30 ? 4 : 0}
        />
        <YAxis hide domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            color: 'var(--text)',
          }}
          formatter={(v: any) => [`${v}%`, 'Completion']}
        />
        <Bar dataKey="value" fill="#9ba8f7" radius={[5, 5, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
