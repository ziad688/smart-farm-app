import React, { useEffect, useState } from 'react';
import { Sun, Droplets, FlaskConical, Power, Timer, Calendar, Info, Flame, ThermometerSnowflake } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { useWebSocket } from '../lib/WebSocketContext';

export default function ControlsView() {
  const [controls, setControls] = useState([]);
  const [activeTab, setActiveTab] = useState('lighting');
  const { sendCommand } = useWebSocket();

  useEffect(() => {
    fetchControls();
  }, []);

  const fetchControls = async () => {
    const res = await fetch('/api/controls');
    const json = await res.json();
    setControls(json);
  };

  const setControlStatus = async (id, status) => {
    // Command Mapping
    const commandMap = {
      'heating': { on: 'ON1', off: 'OFF1' },
      'cooling': { on: 'ON2', off: 'OFF2' },
      'light': { on: 'ON3', off: 'OFF3' },
      'pump': { on: 'ON4', off: 'OFF4' },
      'fertilizer': { on: 'ON5', off: 'OFF5' }
    };

    const command = status ? commandMap[id]?.on : commandMap[id]?.off;
    if (command) {
      sendCommand(command);
    }

    // Still update local DB for UI persistence
    await fetch(`/api/controls/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status ? 1 : 0 })
    });
    fetchControls();
  };

  const updateMode = async (id, mode) => {
    const body = { mode };
    if (mode === 'auto') {
      body.status = 0;
    }
    await fetch(`/api/controls/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    fetchControls();
  };
  const light = controls.find(c => c.id === 'light');
  const pump = controls.find(c => c.id === 'pump');
  const fertilizer = controls.find(c => c.id === 'fertilizer');
  const heating = controls.find(c => c.id === 'heating');
  const cooling = controls.find(c => c.id === 'cooling');

  const tabs = [
    { id: 'lighting', label: 'Lighting', icon: Sun },
    { id: 'irrigation', label: 'Irrigation', icon: Droplets },
    { id: 'fertilization', label: 'Fertilization', icon: FlaskConical },
    { id: 'climate', label: 'Climate', icon: Flame },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Smart Controls</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage lighting, irrigation & fertilization</p>
      </header>

      <div className="flex gap-2 p-1 bg-muted w-fit rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
        <Info className="text-blue-500 mt-0.5" size={18} />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-bold">Notice:</span> Control status can only be manually toggled when the system is in <span className="font-bold underline italic">Manual Mode</span> and <span className="font-bold underline italic">Normal Status</span> when the system is in normal status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === 'lighting' && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-8"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-xl">Farm Light</h3>
                <p className="text-sm text-muted-foreground mt-1">Main greenhouse lighting system</p>
              </div>
              <motion.div 
                animate={{ rotate: light?.status ? 180 : 0 }}
                className="p-3 bg-amber-500/10 rounded-2xl"
              >
                <Sun size={24} className="text-amber-500" />
              </motion.div>
            </div>

            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <motion.div 
                animate={{ 
                  scale: light?.status ? 1.1 : 1,
                  backgroundColor: light?.status ? "rgba(245, 158, 11, 1)" : "rgba(0,0,0,0.1)"
                }}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
                  light?.status ? "shadow-[0_0_40px_rgba(245,158,11,0.4)]" : ""
                )}
              >
                <Sun size={40} className={light?.status ? "text-white" : "text-muted-foreground"} />
              </motion.div>
              
              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => setControlStatus('light', true)}
                  disabled={light?.mode === 'auto' || light?.status === 1}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                    light?.status === 1 ? "bg-amber-500 text-white shadow-lg" : "bg-muted text-muted-foreground",
                    light?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                  )}
                >
                  ON
                </button>
                <button
                  onClick={() => setControlStatus('light', false)}
                  disabled={light?.mode === 'auto' || light?.status === 0}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                    light?.status === 0 ? "bg-slate-500 text-white shadow-lg" : "bg-muted text-muted-foreground",
                    light?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                  )}
                >
                  OFF
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['auto', 'manual'].map((m) => (
                    <button
                      key={m}
                      onClick={() => updateMode('light', m)}
                      className={cn(
                        "py-3 rounded-xl text-sm font-medium capitalize transition-all",
                        light?.mode === m ? "bg-amber-500 text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'irrigation' && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-8"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-xl">Water Pump</h3>
                <p className="text-sm text-muted-foreground mt-1">Main irrigation pump system</p>
              </div>
              <motion.div 
                animate={{ y: pump?.status ? [0, -4, 0] : 0 }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="p-3 bg-blue-500/10 rounded-2xl"
              >
                <Droplets size={24} className="text-blue-500" />
              </motion.div>
            </div>

            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <motion.div 
                animate={{ 
                  scale: pump?.status ? 1.1 : 1,
                  backgroundColor: pump?.status ? "rgba(59, 130, 246, 1)" : "rgba(0,0,0,0.1)"
                }}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
                  pump?.status ? "shadow-[0_0_40px_rgba(59,130,246,0.4)]" : ""
                )}
              >
                <Droplets size={40} className={pump?.status ? "text-white" : "text-muted-foreground"} />
              </motion.div>
              
              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => setControlStatus('pump', true)}
                  disabled={pump?.mode === 'auto' || pump?.status === 1}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                    pump?.status === 1 ? "bg-blue-500 text-white shadow-lg" : "bg-muted text-muted-foreground",
                    pump?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                  )}
                >
                  ON
                </button>
                <button
                  onClick={() => setControlStatus('pump', false)}
                  disabled={pump?.mode === 'auto' || pump?.status === 0}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                    pump?.status === 0 ? "bg-slate-500 text-white shadow-lg" : "bg-muted text-muted-foreground",
                    pump?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                  )}
                >
                  OFF
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['auto', 'manual'].map((m) => (
                    <button
                      key={m}
                      onClick={() => updateMode('pump', m)}
                      className={cn(
                        "py-3 rounded-xl text-sm font-medium capitalize transition-all",
                        pump?.mode === m ? "bg-blue-500 text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'fertilization' && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-8"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-xl">Nutrient Dispenser</h3>
                <p className="text-sm text-muted-foreground mt-1">Automatic fertilization system</p>
              </div>
              <motion.div 
                animate={{ scale: fertilizer?.status ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="p-3 bg-emerald-500/10 rounded-2xl"
              >
                <FlaskConical size={24} className="text-emerald-500" />
              </motion.div>
            </div>

            <div className="flex flex-col items-center justify-center py-10 space-y-6">
              <motion.div 
                animate={{ 
                  scale: fertilizer?.status ? 1.1 : 1,
                  backgroundColor: fertilizer?.status ? "rgba(16, 185, 129, 1)" : "rgba(0,0,0,0.1)"
                }}
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
                  fertilizer?.status ? "shadow-[0_0_40px_rgba(16,185,129,0.4)]" : ""
                )}
              >
                <FlaskConical size={40} className={fertilizer?.status ? "text-white" : "text-muted-foreground"} />
              </motion.div>
              
              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => setControlStatus('fertilizer', true)}
                  disabled={fertilizer?.status === 1}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                    fertilizer?.status === 1 ? "bg-emerald-500 text-white shadow-lg" : "bg-muted text-muted-foreground"
                  )}
                >
                  ON
                </button>
                <button
                  onClick={() => setControlStatus('fertilizer', false)}
                  disabled={fertilizer?.status === 0}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95",
                    fertilizer?.status === 0 ? "bg-slate-500 text-white shadow-lg" : "bg-muted text-muted-foreground"
                  )}
                >
                  OFF
                </button>
              </div>
            </div>

            {/* Manual mode only for fertilization */}
          </motion.div>
        )}
        {activeTab === 'climate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2">
            {/* Heating Control */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-8"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-xl">Heating System</h3>
                  <p className="text-sm text-muted-foreground mt-1">Greenhouse temperature regulation</p>
                </div>
                <motion.div 
                  animate={{ scale: heating?.status ? [1, 1.1, 1] : 1 }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="p-3 bg-orange-500/10 rounded-2xl"
                >
                  <Flame size={24} className="text-orange-500" />
                </motion.div>
              </div>

              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <motion.div 
                  animate={{ 
                    scale: heating?.status ? 1.1 : 1,
                    backgroundColor: heating?.status ? "rgba(249, 115, 22, 1)" : "rgba(0,0,0,0.1)"
                  }}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                    heating?.status ? "shadow-[0_0_30px_rgba(249,115,22,0.4)]" : ""
                  )}
                >
                  <Flame size={32} className={heating?.status ? "text-white" : "text-muted-foreground"} />
                </motion.div>
                
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setControlStatus('heating', true)}
                    disabled={heating?.mode === 'auto' || heating?.status === 1}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 text-xs",
                      heating?.status === 1 ? "bg-orange-500 text-white shadow-md" : "bg-muted text-muted-foreground",
                      heating?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => setControlStatus('heating', false)}
                    disabled={heating?.mode === 'auto' || heating?.status === 0}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 text-xs",
                      heating?.status === 0 ? "bg-slate-500 text-white shadow-md" : "bg-muted text-muted-foreground",
                      heating?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    OFF
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['auto', 'manual'].map((m) => (
                    <button
                      key={m}
                      onClick={() => updateMode('heating', m)}
                      className={cn(
                        "py-2 rounded-lg text-xs font-medium capitalize transition-all",
                        heating?.mode === m ? "bg-orange-500 text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Cooling Control */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-8"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-xl">Cooling System</h3>
                  <p className="text-sm text-muted-foreground mt-1">Ventilation and mist cooling</p>
                </div>
                <motion.div 
                  animate={{ rotate: cooling?.status ? 360 : 0 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  className="p-3 bg-cyan-500/10 rounded-2xl"
                >
                  <ThermometerSnowflake size={24} className="text-cyan-500" />
                </motion.div>
              </div>

              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <motion.div 
                  animate={{ 
                    scale: cooling?.status ? 1.1 : 1,
                    backgroundColor: cooling?.status ? "rgba(6, 182, 212, 1)" : "rgba(0,0,0,0.1)"
                  }}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                    cooling?.status ? "shadow-[0_0_30px_rgba(6,182,212,0.4)]" : ""
                  )}
                >
                  <ThermometerSnowflake size={32} className={cooling?.status ? "text-white" : "text-muted-foreground"} />
                </motion.div>
                
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setControlStatus('cooling', true)}
                    disabled={cooling?.mode === 'auto' || cooling?.status === 1}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 text-xs",
                      cooling?.status === 1 ? "bg-cyan-500 text-white shadow-md" : "bg-muted text-muted-foreground",
                      cooling?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => setControlStatus('cooling', false)}
                    disabled={cooling?.mode === 'auto' || cooling?.status === 0}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-bold transition-all active:scale-95 text-xs",
                      cooling?.status === 0 ? "bg-slate-500 text-white shadow-md" : "bg-muted text-muted-foreground",
                      cooling?.mode === 'auto' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    OFF
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {['auto', 'manual'].map((m) => (
                    <button
                      key={m}
                      onClick={() => updateMode('cooling', m)}
                      className={cn(
                        "py-2 rounded-lg text-xs font-medium capitalize transition-all",
                        cooling?.mode === m ? "bg-cyan-500 text-white shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
