import { Link, useLocation, Outlet } from 'react-router-dom';
import { Home, Calendar, Settings, LogOut, BookOpen, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { SearchDrawer } from '@/components/SearchDrawer';

export const Layout = () => {
  const location = useLocation();
  const { logout } = useAuth();
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
  };

  const handleSearchClick = () => {
    setSearchDrawerOpen(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setSearchDrawerOpen(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
            <BookOpen className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold">Private Journal</h1>
          </Link>

          {/* Search Bar - Center */}
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries by text or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onClick={handleSearchClick}
                className="pl-9 cursor-text"
              />
            </div>
          </div>

          <nav className="flex items-center gap-1 flex-shrink-0">
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

      <SearchDrawer
        open={searchDrawerOpen}
        onOpenChange={setSearchDrawerOpen}
        initialQuery={searchQuery}
      />
    </div>
  );
};
