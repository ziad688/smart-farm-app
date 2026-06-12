import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import ControlsView from './components/ControlsView';
import DiseaseDetectionView from './components/DiseaseDetectionView';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { WebSocketProvider } from './lib/WebSocketContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <WebSocketProvider>
      <div className={cn(
        "min-h-screen flex bg-background text-foreground transition-colors duration-300",
        isDark ? "dark" : ""
      )}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isDark={isDark} 
          setIsDark={setIsDark} 
        />
        
        <main className="flex-1 overflow-y-auto bg-muted/30 pb-20 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="min-h-full"
            >
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'controls' && <ControlsView />}
              {activeTab === 'disease' && <DiseaseDetectionView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </WebSocketProvider>
  );
}
