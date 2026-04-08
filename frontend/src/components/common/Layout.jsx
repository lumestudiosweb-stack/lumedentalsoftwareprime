import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../contexts/authStore';
import { LayoutDashboard, Users, MessageSquare, LogOut, Hexagon } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/patients', label: 'Patients', icon: Users },
  { path: '/crm', label: 'Clinical CRM', icon: MessageSquare },
];

export default function Layout() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-screen bg-surface-0">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-1 border-r border-white/5 flex flex-col">
        <div className="p-5 border-b border-white/5">
          <h1 className="text-lg font-display font-bold flex items-center gap-2 text-white tracking-tight">
            <Hexagon size={22} className="text-lume-400" />
            LumeDental
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5 tracking-wide uppercase">3D Predictive Platform</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="text-sm text-gray-400 mb-2">
            {user?.first_name} {user?.last_name}
            <span className="block text-xs text-gray-600 capitalize">{user?.role}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-300 transition"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
