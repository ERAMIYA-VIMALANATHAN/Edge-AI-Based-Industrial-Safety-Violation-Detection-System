import React, { useState } from "react";
import { 
  useGetReportSummary,
  useGetZoneViolations,
  useGetWorkerViolations,
  useGetComplianceTrend
} from "@workspace/api-client-react";
import { Activity, Download, PieChart as PieChartIcon } from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

export default function Reports() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");

  const { data: summary } = useGetReportSummary({ period });
  const { data: zoneViolations } = useGetZoneViolations({ period });
  const { data: workerViolations } = useGetWorkerViolations({ period });
  const { data: trend } = useGetComplianceTrend({ period });

  const PIE_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono flex items-center gap-2">
            <PieChartIcon size={24} className="text-amber-500" />
            Analytics Engine
          </h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">Compliance Data & Metrics</p>
        </div>
        <div className="flex gap-4">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 text-white text-sm px-3 py-1.5 rounded font-mono uppercase tracking-wider focus:outline-none focus:border-amber-500"
          >
            <option value="daily">Last 24 Hours</option>
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
          </select>
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-1.5 px-3 rounded text-xs uppercase tracking-wider font-mono transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Total Infractions</p>
          <p className="text-3xl font-mono font-bold text-red-500">{summary?.totalViolations || 0}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Overall Compliance</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-mono font-bold text-amber-500">{summary?.overallCompliance || 0}</p>
            <span className="text-sm text-slate-500 font-mono">%</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Helmet Compliance</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-mono font-bold text-white">{summary?.helmetCompliance || 0}</p>
            <span className="text-sm text-slate-500 font-mono">%</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Active Personnel</p>
          <p className="text-3xl font-mono font-bold text-blue-400">{summary?.totalWorkers || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Compliance Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickMargin={10} tickFormatter={(v) => v.substring(5)} />
                <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="overallCompliance" name="Overall %" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} activeDot={{r:5}} />
                <Line type="monotone" dataKey="helmetCompliance" name="Helmet %" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="vestCompliance" name="Vest %" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Violations by Zone</h3>
          <div className="h-[300px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zoneViolations || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="violations"
                  nameKey="zoneName"
                  stroke="none"
                >
                  {(zoneViolations || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">Zones</span>
              <span className="text-xl text-white font-mono font-bold">{zoneViolations?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Top Offenders Table */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Top Recurrent Infractors</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="uppercase tracking-wider font-semibold text-[10px] text-slate-400 bg-slate-950 font-mono border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Personnel</th>
                  <th className="px-4 py-3 text-center">Total Infractions</th>
                  <th className="px-4 py-3">Compliance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {workerViolations?.map(wv => (
                  <tr key={wv.workerId} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white font-mono">{wv.workerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {wv.rfidId}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-red-500/10 text-red-500 font-mono font-bold px-2 py-1 rounded">
                        {wv.violations}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 w-48">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${wv.complianceRate >= 90 ? 'bg-green-500' : wv.complianceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${wv.complianceRate}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">{wv.complianceRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
