import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DiaryEntry, entries as entriesApi } from '@/lib/api';
import { Calendar, FileText, TrendingUp, Clock } from 'lucide-react';
import { format, subDays, subMonths, eachDayOfInterval, startOfDay } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';

interface ChartDataPoint {
  date: string;
  count: number;
  displayDate: string;
}

export default function Dashboard() {
  const { user } = useAuth();
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
      const thisMonth = sortedEntries.filter(e => {
        const entryDate = new Date(e.date);
        return entryDate.getMonth() === now.getMonth() && 
               entryDate.getFullYear() === now.getFullYear();
      }).length;

      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek = sortedEntries.filter(e => new Date(e.date) >= weekAgo).length;

      setStats({
        total: sortedEntries.length,
        thisMonth,
        thisWeek,
      });

      // Generate chart data
      setChartData({
        allTime: generateAllTimeChartData(sortedEntries),
        month: generateMonthChartData(sortedEntries),
        week: generateWeekChartData(sortedEntries),
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
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.username}!</h1>
        <p className="text-muted-foreground">Here's an overview of your journaling journey</p>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Entries</CardTitle>
              <CardDescription>Your latest journal entries</CardDescription>
            </div>
            <Button asChild>
              <Link to="/diary">View All</Link>
            </Button>
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
