import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DiaryEntry, entries as entriesApi } from '@/lib/api';
import { Calendar, FileText, TrendingUp, Clock, Plus, Smile, Grid3x3, List, Activity } from 'lucide-react';
import { TagDisplay } from '@/components/TagDisplay';
import { format, subDays, subMonths, eachDayOfInterval, startOfDay } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';

interface ChartDataPoint {
  date: string;
  count: number;
  displayDate: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    thisWeek: 0,
  });
  const [chartData, setChartData] = useState<{
    allTime: ChartDataPoint[];
    month: ChartDataPoint[];
    week: ChartDataPoint[];
  }>({
    allTime: [],
    month: [],
    week: [],
  });
  const [moodStats, setMoodStats] = useState<{
    thisMonth: Map<string, number>;
    thisWeek: Map<string, number>;
  }>({
    thisMonth: new Map(),
    thisWeek: new Map(),
  });
  const [activeMoodPeriod, setActiveMoodPeriod] = useState<'thisMonth' | 'thisWeek'>('thisMonth');
  const [entryViewMode, setEntryViewMode] = useState<'list' | 'grid' | 'timeline'>(() => {
    // First check if user has explicitly set a view mode for this session
    const saved = localStorage.getItem('entry_view_mode');
    if (saved === 'list' || saved === 'grid' || saved === 'timeline') {
      return saved;
    }
    // Otherwise, use the default preference from settings
    const defaultView = localStorage.getItem('default_entry_view_mode');
    return (defaultView === 'list' || defaultView === 'grid' || defaultView === 'timeline') ? defaultView : 'list';
  });

  useEffect(() => {
    localStorage.setItem('entry_view_mode', entryViewMode);
  }, [entryViewMode]);

  // Listen for changes to default_entry_view_mode and update if using default
  useEffect(() => {
    const handleDefaultChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ newValue: 'list' | 'grid' | 'timeline'; oldValue: string }>;
      const newValue = customEvent.detail.newValue;
      const oldValue = customEvent.detail.oldValue;

      // Update if our current state matches the old default (meaning we're using the default)
      if (entryViewMode === oldValue) {
        setEntryViewMode(newValue);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'default_entry_view_mode' && e.newValue) {
        const currentViewMode = localStorage.getItem('entry_view_mode');
        const oldDefault = localStorage.getItem('default_entry_view_mode'); // This will be old value before change

        // Update if current view matches the default or if no explicit view is set
        if (!currentViewMode || currentViewMode === oldDefault) {
          const newDefault = e.newValue as 'list' | 'grid' | 'timeline';
          if (['list', 'grid', 'timeline'].includes(newDefault)) {
            setEntryViewMode(newDefault);
          }
        }
      } else if (e.key === 'entry_view_mode' && e.newValue && e.oldValue) {
        // If entry_view_mode was updated (e.g., by Settings page), sync our state
        const newValue = e.newValue as 'list' | 'grid' | 'timeline';
        if (['list', 'grid', 'timeline'].includes(newValue) && newValue !== entryViewMode) {
          // Only update if the old value matches what we're currently showing
          // This means it was updated because default changed
          if (e.oldValue === entryViewMode) {
            setEntryViewMode(newValue);
          }
        }
      }
    };

    window.addEventListener('default-entry-view-mode-changed', handleDefaultChanged);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('default-entry-view-mode-changed', handleDefaultChanged);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [entryViewMode]);

  useEffect(() => {
    if (user) {
      loadEntries();
    }
  }, [user]);

  const loadEntries = async () => {
    try {
      const userEntries = await entriesApi.getAll();
      const sortedEntries = userEntries.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setEntries(sortedEntries);

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const startOfMonthStr = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
      const weekAgoDate = subDays(startOfDay(now), 6);
      const weekAgoStr = format(weekAgoDate, 'yyyy-MM-dd');

      // Filter entries for stats (using date string comparison)
      const thisMonthEntries = sortedEntries.filter(e => {
        const entryDateStr = e.date; // Already in YYYY-MM-DD format
        return entryDateStr >= startOfMonthStr && entryDateStr <= todayStr;
      });

      const thisWeekEntries = sortedEntries.filter(e => {
        const entryDateStr = e.date; // Already in YYYY-MM-DD format
        return entryDateStr >= weekAgoStr && entryDateStr <= todayStr;
      });

      setStats({
        total: sortedEntries.length,
        thisMonth: thisMonthEntries.length,
        thisWeek: thisWeekEntries.length,
      });

      // Generate chart data
      setChartData({
        allTime: generateAllTimeChartData(sortedEntries),
        month: generateMonthChartData(sortedEntries),
        week: generateWeekChartData(sortedEntries),
      });

      // Generate mood statistics using the filtered entries
      setMoodStats({
        thisMonth: calculateMoodStats(thisMonthEntries),
        thisWeek: calculateMoodStats(thisWeekEntries),
      });
    } catch (error) {
      console.error('Failed to load entries:', error);
    }
  };

  const generateAllTimeChartData = (entries: DiaryEntry[]): ChartDataPoint[] => {
    if (entries.length === 0) return [];

    const sortedByDate = [...entries].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstDate = new Date(sortedByDate[0].date);
    const lastDate = new Date();

    const allDays = eachDayOfInterval({ start: firstDate, end: lastDate });
    const entryCounts = new Map<string, number>();

    entries.forEach(entry => {
      const dateKey = format(new Date(entry.date), 'yyyy-MM-dd');
      entryCounts.set(dateKey, (entryCounts.get(dateKey) || 0) + 1);
    });

    return allDays.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: dateKey,
        count: entryCounts.get(dateKey) || 0,
        displayDate: format(day, 'MMM d'),
      };
    });
  };

  const generateMonthChartData = (entries: DiaryEntry[]): ChartDataPoint[] => {
    const now = new Date();
    const monthAgo = subMonths(startOfDay(now), 1);

    const daysInRange = eachDayOfInterval({ start: monthAgo, end: now });
    const entryCounts = new Map<string, number>();

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate >= monthAgo && entryDate <= now) {
        const dateKey = format(entryDate, 'yyyy-MM-dd');
        entryCounts.set(dateKey, (entryCounts.get(dateKey) || 0) + 1);
      }
    });

    return daysInRange.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: dateKey,
        count: entryCounts.get(dateKey) || 0,
        displayDate: format(day, 'MMM d'),
      };
    });
  };

  const generateWeekChartData = (entries: DiaryEntry[]): ChartDataPoint[] => {
    const now = new Date();
    const weekAgo = subDays(startOfDay(now), 6); // Last 7 days including today

    const daysInRange = eachDayOfInterval({ start: weekAgo, end: now });
    const entryCounts = new Map<string, number>();

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate >= weekAgo && entryDate <= now) {
        const dateKey = format(entryDate, 'yyyy-MM-dd');
        entryCounts.set(dateKey, (entryCounts.get(dateKey) || 0) + 1);
      }
    });

    return daysInRange.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: dateKey,
        count: entryCounts.get(dateKey) || 0,
        displayDate: format(day, 'EEE'),
      };
    });
  };

  const calculateMoodStats = (entries: DiaryEntry[]): Map<string, number> => {
    const moodCounts = new Map<string, number>();
    entries.forEach(entry => {
      if (entry.mood) {
        moodCounts.set(entry.mood, (moodCounts.get(entry.mood) || 0) + 1);
      }
    });
    return moodCounts;
  };

  const recentEntries = entries.slice(0, 5);

  const MiniChart = ({ data, color = "#f59e0b" }: { data: ChartDataPoint[]; color?: string }) => {
    if (data.length === 0) return null;

    return (
      <div className="mt-4 h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              formatter={(value: number) => [`${value} ${value === 1 ? 'entry' : 'entries'}`, '']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${color})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.firstName || user?.lastName || user?.username}!</h1>
          <p className="text-muted-foreground">Here's an overview of your journaling journey</p>
        </div>
        <Button
          className="gap-2"
          onClick={async () => {
            try {
              const today = format(new Date(), 'yyyy-MM-dd');
              const newEntry = await entriesApi.create(today);
              navigate(`/diary?date=${today}&entryId=${newEntry.id}`);
            } catch (error) {
              console.error('Failed to create entry:', error);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          Create entry
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
            <MiniChart data={chartData.allTime} color="#f59e0b" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">Entries in {format(new Date(), 'MMMM')}</p>
            <MiniChart data={chartData.month} color="#3b82f6" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            <MiniChart data={chartData.week} color="#10b981" />
          </CardContent>
        </Card>
      </div>

      {/* Mood Tracking Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smile className="h-5 w-5 text-accent" />
                Mood Tracking
              </CardTitle>
              <CardDescription>Your emotional journey over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeMoodPeriod === 'thisMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMoodPeriod('thisMonth')}
              >
                This Month
              </Button>
              <Button
                variant={activeMoodPeriod === 'thisWeek' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMoodPeriod('thisWeek')}
              >
                This Week
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const currentMoodStats = moodStats[activeMoodPeriod];
            const totalMoods = Array.from(currentMoodStats.values()).reduce((sum, count) => sum + count, 0);

            if (totalMoods === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  <Smile className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mood data available for {activeMoodPeriod === 'thisMonth' ? 'this month' : 'this week'}</p>
                  <p className="text-xs mt-2">Add moods to your entries to see them here</p>
                </div>
              );
            }

            const sortedMoods = Array.from(currentMoodStats.entries())
              .sort((a, b) => b[1] - a[1]); // Sort by count descending

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {sortedMoods.map(([mood, count]) => {
                    const percentage = Math.round((count / totalMoods) * 100);
                    return (
                      <div
                        key={mood}
                        className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="text-4xl mb-2">{mood}</div>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground">{percentage}%</div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalMoods > 0 && (
                  <div className="text-sm text-muted-foreground text-center">
                    {totalMoods} {totalMoods === 1 ? 'entry' : 'entries'} with mood tracked
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Entries</CardTitle>
              <CardDescription>Your latest journal entries</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={entryViewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEntryViewMode('grid')}
                  className="h-8 w-8 p-0"
                  title="Grid view"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={entryViewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEntryViewMode('list')}
                  className="h-8 w-8 p-0"
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={entryViewMode === 'timeline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEntryViewMode('timeline')}
                  className="h-8 w-8 p-0"
                  title="Timeline view"
                >
                  <Activity className="h-4 w-4" />
                </Button>
              </div>
              <Button asChild>
                <Link to="/diary">View All</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No entries yet. Start writing your first journal entry!</p>
              <Button asChild className="mt-4">
                <Link to="/diary">Create Entry</Link>
              </Button>
            </div>
          ) : entryViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentEntries.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/diary?date=${entry.date}`}
                  className="block p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors h-full"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-accent" />
                    <span className="font-medium text-sm">{format(new Date(entry.date), 'MMM dd, yyyy')}</span>
                  </div>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="mb-2">
                      <TagDisplay tags={entry.tags} />
                    </div>
                  )}
                  <div
                    className="text-sm text-muted-foreground line-clamp-3 max-w-none [&_*]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{
                      __html: entry.content.replace(/<[^>]*>/g, (match) =>
                        match === '<br>' || match === '<br/>' || match === '<br />' ? match : ' '
                      ).substring(0, 100) + '...'
                    }}
                  />
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(entry.updatedAt), 'HH:mm')}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : entryViewMode === 'timeline' ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-6">
                {recentEntries.map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center z-10">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <Link
                      to={`/diary?date=${entry.date}`}
                      className="flex-1 p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{format(new Date(entry.date), 'MMMM dd, yyyy')}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.updatedAt), 'HH:mm')}
                        </span>
                      </div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mb-2">
                          <TagDisplay tags={entry.tags} />
                        </div>
                      )}
                      <div
                        className="text-sm text-muted-foreground line-clamp-2 max-w-none [&_*]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4"
                        dangerouslySetInnerHTML={{
                          __html: entry.content.replace(/<[^>]*>/g, (match) =>
                            match === '<br>' || match === '<br/>' || match === '<br />' ? match : ' '
                          ).substring(0, 150) + '...'
                        }}
                      />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {recentEntries.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/diary?date=${entry.date}`}
                  className="block p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-accent" />
                        <span className="font-medium">{format(new Date(entry.date), 'MMMM dd, yyyy')}</span>
                      </div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mb-2">
                          <TagDisplay tags={entry.tags} />
                        </div>
                      )}
                      <div
                        className="text-sm text-muted-foreground line-clamp-2 max-w-none [&_*]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4"
                        dangerouslySetInnerHTML={{
                          __html: entry.content.replace(/<[^>]*>/g, (match) =>
                            match === '<br>' || match === '<br/>' || match === '<br />' ? match : ' '
                          ).substring(0, 150) + '...'
                        }}
                      />
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground ml-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
