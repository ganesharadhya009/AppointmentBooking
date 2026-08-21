import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export function DonutChart({ data, size = 168, centerLabel, centerValue }: { data: DonutDatum[]; size?: number; centerLabel?: string; centerValue?: string | number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total === 0 ? [{ name: "Empty", value: 1, color: "#e2e8f0" }] : data}
            dataKey="value"
            nameKey="name"
            innerRadius="70%"
            outerRadius="100%"
            paddingAngle={total === 0 ? 0 : 3}
            stroke="none"
            animationDuration={700}
          >
            {(total === 0 ? [{ name: "Empty", value: 1, color: "#e2e8f0" }] : data).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {total > 0 && (
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 12px 32px -12px rgba(15,23,42,0.25)", fontSize: 12 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue !== undefined) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-ink-950">{centerValue}</span>
          {centerLabel && <span className="text-[10px] font-medium text-ink-700/45">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function DonutLegend({ data }: { data: DonutDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-2 font-medium text-ink-700/70">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </span>
          <span className="font-bold text-ink-900">
            {d.value} <span className="font-normal text-ink-700/40">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}
