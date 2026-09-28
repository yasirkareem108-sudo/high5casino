import React, { useState, useEffect, useCallback } from 'react';
import { X, Bell, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import {
  getPushEnvironment, enablePush, syncSubscription, currentEndpoint, fetchPushStatus, sendTestPush, readLastPush,
} from './push';

function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const ICON = {
  ok: <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />,
  bad: <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />,
  warn: <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />,
};

export default function NotificationSettings({ token, onClose }) {
  const [env, setEnv] = useState(getPushEnvironment);
  const [browserSub, setBrowserSub] = useState(false);
  const [server, setServer] = useState(null);
  const [serverError, setServerError] = useState('');
  const [lastPush, setLastPush] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // { kind: 'ok' | 'bad', text }

  const refresh = useCallback(async () => {
    setEnv(getPushEnvironment());
    setBrowserSub(!!(await currentEndpoint()));
    setLastPush(await readLastPush());
    try {
      setServer(await fetchPushStatus(token));
      setServerError('');
    } catch (err) {
      setServerError(err.message);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (name, fn) => {
    setBusy(name);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ kind: 'bad', text: err.message });
    } finally {
      setBusy('');
      await refresh();
    }
  };

  const handleEnable = () =>
    run('enable', async () => {
      await enablePush(token);
      setMessage({ kind: 'ok', text: 'This device is now subscribed. Tap "Send test notification" to check it.' });
    });

  const handleRepair = () =>
    run('repair', async () => {
      await syncSubscription(token);
      setMessage({ kind: 'ok', text: 'Subscription refreshed.' });
    });

  const handleTest = () =>
    run('test', async () => {
      const r = await sendTestPush(token);
      if (!r.configured) {
        setMessage({ kind: 'bad', text: `The server can't send pushes: ${r.problems.join('; ')}` });
      } else if (r.attempted === 0) {
        setMessage({ kind: 'bad', text: 'The server has no subscription for this device. Tap "Enable notifications".' });
      } else if (r.failed.length) {
        setMessage({ kind: 'bad', text: `The push service rejected it: ${r.failed.map((f) => f.message).join(' | ')}` });
      } else {
        setMessage({
          kind: 'ok',
          text: 'Sent! You should get a notification within a few seconds. Close the app and run it again to test the closed-app case.',
        });
        await new Promise((res) => setTimeout(res, 2500));
      }
    });

  const thisDevice = server?.devices?.find((d) => d.isThisDevice);
  const vapid = server?.vapid;

  const rows = [
    {
      key: 'supported',
      state: env.supported ? 'ok' : 'bad',
      label: 'Push supported here',
      detail: env.supported
        ? env.standalone ? 'Running as an installed app' : 'Running in a browser tab'
        : env.isIOS && !env.standalone
          ? 'On iPhone, push only works from the Home Screen app: tap Share → Add to Home Screen, then open it from there.'
          : 'This browser has no push support.',
    },
    {
      key: 'permission',
      state: env.permission === 'granted' ? 'ok' : env.permission === 'denied' ? 'bad' : 'warn',
      label: 'Notification permission',
      detail:
        env.permission === 'granted' ? 'Allowed'
          : env.permission === 'denied' ? 'Blocked — turn it on in your phone/browser settings for this app'
          : 'Not asked yet — tap Enable below',
    },
    {
      key: 'browser',
      state: browserSub ? 'ok' : 'warn',
      label: 'Subscribed on this device',
      detail: browserSub ? 'Yes' : 'No',
    },
    {
      key: 'server-registered',
      state: server ? (server.thisDeviceRegistered ? 'ok' : 'warn') : 'warn',
      label: 'Registered with the server',
      detail: serverError
        ? serverError
        : server
          ? server.thisDeviceRegistered
            ? `Yes (${server.devices.length} device${server.devices.length === 1 ? '' : 's'} registered in total)`
            : `No (${server.devices.length} other device${server.devices.length === 1 ? '' : 's'} registered)`
          : 'Checking…',
    },
    {
      key: 'vapid',
      state: vapid ? (vapid.configured ? (vapid.problems.length ? 'warn' : 'ok') : 'bad') : 'warn',
      label: 'Server can send pushes',
      detail: vapid ? (vapid.problems.length ? vapid.problems.join('; ') : 'Yes') : 'Checking…',
    },
    {
      key: 'delivery',
      state: thisDevice ? (thisDevice.lastError ? 'bad' : thisDevice.lastSuccessAt ? 'ok' : 'warn') : 'warn',
      label: 'Last delivery to this device',
      detail: thisDevice
        ? thisDevice.lastError || (thisDevice.lastSuccessAt ? `Accepted by ${thisDevice.service} ${ago(new Date(thisDevice.lastSuccessAt).getTime())}` : 'Nothing sent yet — try the test button')
        : '—',
    },
    {
      key: 'received',
      state: lastPush ? (lastPush.notification === 'shown' ? 'ok' : 'bad') : 'warn',
      label: 'Last push this device received',
      detail: lastPush
        ? `${ago(lastPush.receivedAt)} · notification ${lastPush.notification}${
            lastPush.badgeValue !== null ? ` · icon badge ${lastPush.badge} (${lastPush.badgeValue})` : ''
          }`
        : 'None yet. This is recorded even when the app was closed.',
    },
    {
      key: 'badge',
      state: env.badgeSupported ? 'ok' : 'warn',
      label: 'Icon badge (Badging API)',
      detail: env.badgeSupported
        ? 'Available' + (env.standalone ? '' : ' — but it only shows on an installed app')
        : 'Not available here; the count shows in the tab title instead',
    },
  ];

  const needsEnable = env.supported && (env.permission !== 'granted' || !browserSub || (server && !server.thisDeviceRegistered));

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[#0D111A] border border-amber-500/30 sm:rounded-2xl rounded-t-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="notification-panel"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-400" />
            <h2 className="text-sm font-black">Notifications</h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={refresh} aria-label="Refresh" className="p-2 text-gray-400 hover:text-white"><RefreshCw size={15} /></button>
            <button onClick={onClose} aria-label="Close notifications" className="p-2 -mr-2 text-gray-400 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <ul className="space-y-2.5 mb-4">
          {rows.map((r) => (
            <li key={r.key} data-testid={`row-${r.key}`} data-state={r.state} className="flex gap-2.5 text-xs">
              {ICON[r.state]}
              <div className="min-w-0">
                <p className="font-bold text-white">{r.label}</p>
                <p className="text-gray-400 break-words">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {message && (
          <p
            data-testid="panel-message"
            className={`text-xs rounded-lg p-3 mb-3 break-words ${message.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {needsEnable && (
            <button
              onClick={handleEnable}
              disabled={!!busy}
              data-testid="btn-enable"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-sm font-black disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy === 'enable' && <Loader2 size={14} className="animate-spin" />} Enable notifications
            </button>
          )}
          <button
            onClick={handleTest}
            disabled={!!busy}
            data-testid="btn-test"
            className="w-full py-3 rounded-xl bg-[#131824] border border-gray-700 text-white text-sm font-bold hover:border-amber-500/50 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy === 'test' && <Loader2 size={14} className="animate-spin" />} Send test notification
          </button>
          {env.supported && env.permission === 'granted' && (
            <button
              onClick={handleRepair}
              disabled={!!busy}
              data-testid="btn-repair"
              className="w-full py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white disabled:opacity-60"
            >
              Re-register this device
            </button>
          )}
        </div>

        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
          <strong className="text-gray-300">About sound:</strong> a web notification can&apos;t pick its own tone. The sound and
          vibration come from your phone&apos;s notification settings for this app — check they aren&apos;t set to Silent, and that
          Do Not Disturb / battery saver isn&apos;t muting them.
        </p>
      </div>
    </div>
  );
}
