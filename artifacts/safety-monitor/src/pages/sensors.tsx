import React, { useState } from "react";
import { useGetLiveSensorData, useGetSensorHistory, getGetLiveSensorDataQueryKey, getGetSensorHistoryQueryKey } from "@workspace/api-client-react";
import { Activity, Thermometer, Wind, Droplets } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";

const SENSOR_ICONS: Record<string, React.ElementType> = {
  temperature: Thermometer,
  gas: Wind,
  humidity: Droplets,
  co2: Wind,
};

export default function Sensors() {
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);

  const { data: sensors, isLoading: loadingSensors } = useGetLiveSensorData({ query: { refetchInterval: 5000, queryKey: getGetLiveSensorDataQueryKey() } });
  
  // Set default selection
  React.useEffect(() => {
    if (sensors && sensors.length > 0 && !selectedSensorId) {
      setSelectedSensorId(sensors[0].sensorId);
    }
  }, [sensors, selectedSensorId]);

  const { data: history, isLoading: loadingHistory } = useGetSensorHistory(
    { sensorId: selectedSensorId || undefined },
    { query: { enabled: !!selectedSensorId, queryKey: getGetSensorHistoryQueryKey({ sensorId: selectedSensorId || undefined }) } }
  );

  const selectedSensor = sensors?.find(s => s.sensorId === selectedSensorId);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-mono flex items-center gap-2">
            <Activity size={24} className="text-amber-500" />
            Environmental Telemetry
          </h1>
          <p className="text-sm text-slate-400 uppercase tracking-widest mt-1">IoT Sensor Array Monitoring</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loadingSensors ? (
           Array(4).fill(0).map((_, i) => (
             <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-4 h-32 animate-pulse"></div>
           ))
        ) : sensors?.map(sensor => {
          const Icon = SENSOR_ICONS[sensor.type] || Activity;
          const isCrit = sensor.status === "critical";
          const isWarn = sensor.status === "warning";
          const color = isCrit ? "#ef4444" : isWarn ? "#f59e0b" : "#22c55e";
          const bgClass = isCrit ? "bg-red-500/10" : isWarn ? "bg-amber-500/10" : "bg-green-500/10";
          
          const maxVal = sensor.threshold?.critical ? sensor.threshold.critical * 1.2 : sensor.value * 1.5;
          const pct = Math.min(100, Math.max(0, (sensor.value / maxVal) * 100));

          return (
            <div 
              key={sensor.sensorId} 
              onClick={() => setSelectedSensorId(sensor.sensorId)}
              className={`bg-slate-900 border rounded-lg p-4 cursor-pointer transition-all ${selectedSensorId === sensor.sensorId ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-slate-800 hover:border-slate-700'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded border border-slate-800 ${bgClass}`}>
                    <Icon size={16} color={color} />
                  </div>
                  <div>
                    <h3 className="text-white font-mono font-bold text-sm uppercase">{sensor.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{sensor.location}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${isCrit ? "bg-red-500 animate-pulse" : isWarn ? "bg-amber-500" : "bg-green-500"}`}></div>
              </div>
              
              <div className="flex items-end justify-between mb-2">
                <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                  {sensor.value.toFixed(1)}
                  <span className="text-sm text-slate-500 ml-1">{sensor.unit}</span>
                </div>
                <div className={`text-[10px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border ${isCrit ? "text-red-500 border-red-500/50" : isWarn ? "text-amber-500 border-amber-500/50" : "text-green-500 border-green-500/50"}`}>
                  {sensor.status}
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full transition-all duration-1000" 
                  style={{ width: `${pct}%`, backgroundColor: color }}
                ></div>
              </div>
              {sensor.threshold && (
                <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-500">
                  <span>0</span>
                  <span>WARN:{sensor.threshold.warning}</span>
                  <span className="text-red-500/50">CRIT:{sensor.threshold.critical}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedSensor && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-mono font-bold text-white uppercase">{selectedSensor.name} Telemetry</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">48-Hour Historical Analysis</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
               {selectedSensor.threshold && (
                 <>
                   <div className="flex items-center gap-1 text-amber-500"><div className="w-2 h-0.5 bg-amber-500"></div> Warn ({selectedSensor.threshold.warning}{selectedSensor.unit})</div>
                   <div className="flex items-center gap-1 text-red-500"><div className="w-2 h-0.5 bg-red-500"></div> Crit ({selectedSensor.threshold.critical}{selectedSensor.unit})</div>
                 </>
               )}
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            {loadingHistory ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono animate-pulse">Querying time-series database...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history || []} margin={{ top: 20, right: 30, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickFormatter={(v) => format(new Date(v), "HH:mm")}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => `${v}${selectedSensor.unit}`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                    labelFormatter={(v) => format(new Date(v), "MMM dd, HH:mm:ss")}
                  />
                  
                  {selectedSensor.threshold && (
                    <>
                      <ReferenceLine y={selectedSensor.threshold.warning} stroke="#f59e0b" strokeDasharray="5 5" opacity={0.5} />
                      <ReferenceLine y={selectedSensor.threshold.critical} stroke="#ef4444" strokeDasharray="5 5" opacity={0.5} />
                    </>
                  )}
                  
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
