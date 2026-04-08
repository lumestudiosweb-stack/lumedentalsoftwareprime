import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../contexts/authStore';
import { LayoutDashboard, Users, Box, MessageSquare, LogOut } from 'lucide-react';

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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-lume-950 text-white flex flex-col">
        <div className="p-6 border-b border-lume-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Box size={24} className="text-lume-400" />
            LumeDental
          </h1>
          <p className="text-lume-400 text-xs mt-1">3D Predictive Platform</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? 'bg-lume-700 text-white font-medium'
                    : 'text-lume-300 hover:bg-lume-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-lume-800">
          <div className="text-sm text-lume-300 mb-2">
            {user?.first_name} {user?.last_name}
            <span className="block text-xs text-lume-500 capitalize">{user?.role}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-lume-400 hover:text-white transition"
          >
            <LogOut size={16} />
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
