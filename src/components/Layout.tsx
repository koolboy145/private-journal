import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, Calendar, Settings, LogOut, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export const Layout = () => {
  const location = useLocation();
  const { logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BookOpen className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold">Private Journal</h1>
          </Link>
          
          <nav className="flex items-center gap-1">
            <Button
              variant={isActive('/') ? 'secondary' : 'ghost'}
              size="sm"
              asChild
              className="w-9 px-0"
              title="Dashboard"
            >
              <Link to="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button
              variant={isActive('/diary') ? 'secondary' : 'ghost'}
              size="sm"
              asChild
              className="w-9 px-0"
              title="Diary"
            >
              <Link to="/diary">
                <Calendar className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button
              variant={isActive('/settings') ? 'secondary' : 'ghost'}
              size="sm"
              asChild
              className="w-9 px-0"
              title="Settings"
            >
              <Link to="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              title="Logout"
              className="w-9 px-0"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </nav>
        </div>
      </header>
      
      <main className="flex-1 container py-6">
        <Outlet />
      </main>
    </div>
  );
};
