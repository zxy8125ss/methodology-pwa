import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Library,
  FlaskConical,
  Search,
  Target,
  Network,
  GraduationCap,
  Settings,
  WifiOff,
  Download,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore, type ThemeMode } from '../store/useAppStore';
import { Button } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: '首页', icon: LayoutDashboard },
  { to: '/library', label: '方法论', icon: Library },
  { to: '/research', label: '研究', icon: FlaskConical },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/practice', label: '实践', icon: Target },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/graph', label: '知识图谱', icon: Network },
  { to: '/learning', label: '学习中心', icon: GraduationCap },
  { to: '/settings', label: '设置', icon: Settings },
];

function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const options: Array<{ value: ThemeMode; icon: typeof Sun; label: string }> = [
    { value: 'light', icon: Sun, label: '浅色' },
    { value: 'dark', icon: Moon, label: '深色' },
    { value: 'system', icon: Monitor, label: '跟随系统' },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          aria-label={opt.label}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            theme === opt.value
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
        >
          <opt.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function InstallButton() {
  const available = useAppStore((s) => s.installPromptAvailable);
  const showToast = useAppStore((s) => s.showToast);
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e);
      useAppStore.getState().setInstallAvailable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!available) return null;

  const prompt = async () => {
    if (!event) return;
    const e = event as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === 'accepted') {
      showToast('已开始安装到主屏幕', 'success');
    }
    setEvent(null);
    useAppStore.getState().setInstallAvailable(false);
  };

  return (
    <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={prompt}>
      安装
    </Button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const online = useAppStore((s) => s.online);
  const toast = useAppStore((s) => s.toast);
  const location = useLocation();

  return (
    <div className="min-h-full bg-[var(--app-bg)]">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-sky-500 dark:text-slate-950">
              方
            </span>
            <span className="hidden text-sm font-semibold text-slate-900 dark:text-slate-100 sm:block">
              方法论
            </span>
          </NavLink>

          <div className="ml-auto flex items-center gap-2">
            {!online ? (
              <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <WifiOff className="h-3 w-3" />
                离线
              </span>
            ) : null}
            <InstallButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4">
        {/* 桌面端侧栏 */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 flex-col gap-6 overflow-y-auto py-5 lg:flex">
          <nav className="space-y-0.5">
            {PRIMARY_NAV.map((item) => (
              <SideLink key={item.to} item={item} />
            ))}
          </nav>
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              更多
            </p>
            <nav className="space-y-0.5">
              {SECONDARY_NAV.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </nav>
          </div>
        </aside>

        {/* 主内容 */}
        <main className="min-w-0 flex-1 pb-24 pt-5 lg:pb-10">
          <div key={location.pathname} className="animate-[fadeIn_.18s_ease-out]">
            {children}
          </div>
        </main>
      </div>

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <div className="grid grid-cols-5">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-400 dark:text-slate-500',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 lg:bottom-6">
          <div
            className={cn(
              'pointer-events-auto rounded-xl px-4 py-2.5 text-xs font-medium shadow-lg',
              toast.kind === 'success'
                ? 'bg-emerald-600 text-white'
                : toast.kind === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-900 text-white dark:bg-slate-700',
            )}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  );
}
