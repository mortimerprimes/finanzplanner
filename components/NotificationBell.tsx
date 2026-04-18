'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { Icon } from '@/src/components/ui';

export function NotificationBell() {
  const { state, dispatch } = useFinance();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = state.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Gerade eben';
    if (mins < 60) return `Vor ${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return `Vor ${days} Tag${days > 1 ? 'en' : ''}`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) {
            notifications.filter(n => !n.read).forEach(n => {
              dispatch({ type: 'MARK_NOTIFICATION_READ', payload: n.id });
            });
          }
        }}
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Benachrichtigungen</h3>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  onClick={() => dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' })}
                  className="rounded-lg p-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="Alle löschen"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-400 dark:text-gray-600">
                <Bell size={32} className="mx-auto mb-3 opacity-40" />
                <p>Keine Benachrichtigungen</p>
                <p className="mt-1 text-xs">Aktiviere Benachrichtigungen in den Einstellungen.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                      !n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${n.color || '#6366f1'}15` }}
                    >
                      <Icon name={n.icon || 'Bell'} size={16} color={n.color || '#6366f1'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{n.message}</p>
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-gray-600">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id })}
                      className="mt-1 shrink-0 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
