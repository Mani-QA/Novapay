import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, ArrowLeftRight, Users, History,
  LogOut, Shield, Bell, CreditCard, Menu, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const userNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/payees', label: 'Payees', icon: Users },
  { to: '/activity', label: 'Activity', icon: History },
];

const adminNav = [
  { to: '/admin', label: 'Admin Panel', icon: Shield },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.notifications.unreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
    const interval = setInterval(() => {
      api.notifications.unreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = user?.role === 'admin' ? [...userNav, ...adminNav] : userNav;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button className="sm:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <CreditCard className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold text-primary">NovaPay</span>
            </Link>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.to)
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link to="/notifications" className="relative p-2 text-gray-500 hover:text-gray-900">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{user?.full_name}</span>
              <span className="text-xs text-muted-foreground">({user?.id})</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 sm:hidden" onClick={() => setMobileOpen(false)}>
          <nav className="absolute left-0 top-16 w-64 bg-white shadow-lg p-4 space-y-1" onClick={e => e.stopPropagation()}>
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  location.pathname.startsWith(item.to) ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
