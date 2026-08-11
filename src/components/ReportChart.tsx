"use client";

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export function ReportChart({ timeline }: { timeline: any[] }) {
  // timeline [{ date: '2026-08-09', events: [{ user_id, provider, count, magnitude }] }]
  // Let's flatten this so recharts can understand it easily.
  // Data format for chart: [ { date: 'Aug 09', magnitude: 120 }, { date: 'Aug 10', magnitude: 50 } ]
  
  const data = timeline.map(t => {
     const dateObj = new Date(t.date);
     const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
     
     const dailyMagnitude = t.events.reduce((sum: number, e: any) => sum + e.magnitude, 0);

     return {
        date: formattedDate,
        magnitude: dailyMagnitude
     }
  });

  if (!data || data.length === 0) {
     return <div className="h-64 flex items-center justify-center text-white/30 text-sm">No timeline data available.</div>;
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorMag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="rgba(255,255,255,0.2)" 
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} 
            tickLine={false} 
            axisLine={false}
            dy={10}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.2)" 
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          <Tooltip 
             contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(10px)' }}
             itemStyle={{ color: '#fff' }}
             cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />
          <Area 
             type="monotone" 
             dataKey="magnitude" 
             stroke="#fff" 
             strokeWidth={2}
             fillOpacity={1} 
             fill="url(#colorMag)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
