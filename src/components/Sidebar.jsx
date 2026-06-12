import React from 'react';
import { LayoutDashboard, Settings2, Leaf, Sun, Moon, ShieldAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function Sidebar({ activeTab, setActiveTab, isDark, setIsDark }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'controls', label: 'Controls', icon: Settings2 },
    { id: 'disease', label: 'Detection', icon: ShieldAlert },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col h-screen sticky top-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Leaf size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">IoT Dashboard</h1>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">smart Greenhouse</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                activeTab === item.id 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-border space-y-4">
          <button
            onClick={() => setIsDark(!isDark)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <span className="text-sm font-medium">Theme</span>
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">System Online</span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-3 flex justify-between items-center z-50">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-200",
              activeTab === item.id 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-muted-foreground"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setIsDark(!isDark)}
          className="flex flex-col items-center gap-1 text-muted-foreground"
        >
          {isDark ? <Moon size={20} /> : <Sun size={20} />}
          <span className="text-[10px] font-medium">Theme</span>
        </button>
      </nav>
    </>
  );
}
