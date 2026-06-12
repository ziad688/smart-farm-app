import React, { useEffect, useState } from 'react';
import { Thermometer, Droplets, Wind, Activity, Zap, Waves, Sprout, Sun } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { useWebSocket } from '../lib/WebSocketContext';

export default function DashboardView() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const { sensorData, isConnected } = useWebSocket();

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
      setHistory(json.history);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (sensorData?.temperature !== undefined) {
      const now = new Date();
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      setHistory(prev => {
        const newPoint = {
          time: timeStr,
          temp: sensorData.temperature,
          humidity: sensorData.humidity
        };
        // Keep last 24 points
        const newHistory = [...prev, newPoint];
        return newHistory.slice(-24);
      });
    }
  }, [sensorData]);

  if (!data) return <div className="p-8">Loading dashboard...</div>;

  // Merge real-time data with initial data
  const currentStats = {
    temp: sensorData?.temperature ?? data.stats.temp,
    humidity: sensorData?.humidity ?? data.stats.humidity,
    soilMoisture: sensorData?.moisture ?? data.stats.soilMoisture,
    lightIntensity: sensorData?.lightIntensity ?? data.stats.lightIntensity,
    plantHealth: sensorData?.plantHealth ?? data.stats.plantHealth,
    waterLevel: sensorData?.water_level ?? 72
  };

  const currentNutrients = [
    { name: 'Nitrogen', value: sensorData?.nitrogen ?? 68, color: '#10b981' },
    { name: 'Phosphorus', value: sensorData?.phosphorus ?? 45, color: '#f59e0b' },
    { name: 'Potassium', value: sensorData?.potassium ?? 82, color: '#8b5cf6' }
  ];

  const stats = [
    { label: 'Temperature', value: `${currentStats.temp.toFixed(1)}°C`, icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-500/10', trend: '+ 2.5% vs last hour' },
    { label: 'Humidity', value: `${currentStats.humidity.toFixed(1)}%`, icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-500/10', trend: '- 1.2% vs last hour' },
    { label: 'Soil Moisture', value: `${currentStats.soilMoisture.toFixed(1)}%`, icon: Wind, color: 'text-emerald-500', bg: 'bg-emerald-500/10', trend: '+ 5.8% vs last hour' },
    { label: 'Light Intensity', value: `${currentStats.lightIntensity.toFixed(0)} lx`, icon: Sun, color: 'text-amber-500', bg: 'bg-amber-500/10', trend: 'Optimal' },
  ];

  return (
    <div className="px-6 py-8 md:px-12 md:py-12 space-y-10 md:space-y-12 max-w-7xl mx-auto">
      {/* Header with plenty of spacing and borderline */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-border/60">
        <div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight">Farm Dashboard</h2>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-sm text-muted-foreground">Real-time monitoring & environmental analytics</p>
            {sensorData && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded text-muted-foreground">
                  Device: {sensorData.device}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <span className={cn(
            "px-4 py-2 text-xs font-medium rounded-full flex items-center gap-2 transition-colors border border-border/40",
            isConnected ? "bg-blue-500/10 text-blue-600" : "bg-rose-500/10 text-rose-600"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isConnected ? "bg-blue-500" : "bg-rose-500"
            )} />
            {isConnected ? 'AWS IoT Live Sync' : 'Reconnecting...'}
          </span>
        </div>
      </header>

      {/* Metrics Cards Grid - stacked gracefully and generous spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, translateY: -4 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
            className="bg-card border border-border/80 p-8 rounded-3xl space-y-5 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
              <motion.div 
                whileHover={{ rotate: 12 }}
                className={cn("p-2.5 rounded-2xl", stat.bg)}
              >
                <stat.icon size={22} className={stat.color} />
              </motion.div>
            </div>
            <div className="space-y-1">
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold tracking-tight text-foreground"
              >
                {stat.value}
              </motion.div>
              <p className="text-xs text-muted-foreground font-medium">{stat.trend}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts & Side Panels grid layout with spacious gap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        <div className="lg:col-span-2 space-y-8 md:space-y-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border p-8 rounded-3xl shadow-sm space-y-6"
          >
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <h3 className="font-bold text-xl tracking-tight text-foreground">Temperature Monitor</h3>
              <span className="text-xs text-muted-foreground font-medium">Historical timeline log</span>
            </div>
            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fill: 'var(--muted-foreground)'}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fill: 'var(--muted-foreground)'}} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="temp" stroke="#f97316" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Soil Nutrients Panel */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border p-8 rounded-3xl shadow-sm space-y-8"
          >
            <h3 className="font-bold text-xl tracking-tight flex items-center gap-2.5 text-foreground">
              <Sprout className="text-emerald-500" size={24} />
              Soil Nutrients (NPK)
            </h3>
            <div className="space-y-8">
              {currentNutrients.map((n) => (
                <div key={n.name} className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-semibold">{n.name} Level</span>
                    <span className="font-bold text-base" style={{ color: n.color }}>{n.value} mg/kg</span>
                  </div>
                  <div className="h-3.5 bg-muted rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${n.value}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="h-full rounded-full" 
                      style={{ backgroundColor: n.color }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Water reservoir on side with expanded layout */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card border border-border p-8 rounded-3xl shadow-sm space-y-8 h-fit flex flex-col justify-between"
        >
          <div className="space-y-2">
            <h4 className="font-bold text-lg flex items-center gap-2.5 text-foreground">
              <Waves size={20} className="text-blue-500" />
              Water Reservoir
            </h4>
            <p className="text-xs text-muted-foreground">Active supply levels of moisture sensors</p>
          </div>
          
          <div className="relative h-72 w-full max-w-[180px] mx-auto bg-muted rounded-3xl overflow-hidden border border-border/80 flex items-end">
            <motion.div 
              initial={{ height: 0 }}
              animate={{ 
                height: `${currentStats.waterLevel}%`,
                backgroundColor: ['rgba(59, 130, 246, 0.45)', 'rgba(59, 130, 246, 0.55)', 'rgba(59, 130, 246, 0.45)']
              }}
              transition={{ 
                height: { duration: 1.5, ease: "easeInOut" },
                backgroundColor: { duration: 3, repeat: Infinity, ease: "linear" }
              }}
              className="absolute bottom-0 w-full flex items-center justify-center overflow-hidden"
            >
              {/* Wave effect overlay animation */}
              <motion.div 
                animate={{ 
                  x: [-120, 0],
                }}
                transition={{ 
                  duration: 2.2, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
                className="absolute top-0 left-0 w-[240%] h-4 bg-blue-300/20 blur-sm"
                style={{ borderRadius: '40% 40% 0 0' }}
              />
              
              <span className="text-3xl font-black text-blue-800 dark:text-blue-100 relative z-10 font-mono tracking-tight">
                {Math.round(currentStats.waterLevel)}%
              </span>
            </motion.div>
          </div>
          <p className="text-xs text-center text-muted-foreground font-semibold uppercase tracking-wider mt-2">
            Current Reservoir Fluid Capacity
          </p>
        </motion.div>
      </div>
    </div>
  );
}