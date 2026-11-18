import { useEffect, useRef, useState } from 'react';
import { useAuth } from './store/auth';
import { useSettings } from './store/settings';
import { useChat } from './store/chat';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { SettingsPanel } from './components/SettingsPanel';
import { ImportDialog } from './components/ImportDialog';
import { Logo } from './components/Logo';
import { X } from 'lucide-react';

export default function App() {
  const [drawer, setDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const balanceRequested = useRef(false);

  const auth = useAuth();
  const settings = useSettings();
  const chat = useChat();

  useEffect(() => {
    void useAuth.getState().init();
    void useChat.getState().init();
  }, []);

  useEffect(() => {
    const apply = () => {
      const theme = settings.theme;
      const resolved =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    if (!balanceRequested.current && auth.apiKey && settings.balance === null) {
      balanceRequested.current = true;
      void useSettings.getState().refreshBalance(auth.apiKey);
    }
  }, [auth.apiKey, settings.balance]);

  if (!auth.ready || chat.hydrating || !settings.ready) {
    return (
      <div className="flex h-full items-center justify-center bg-[color:var(--bg-page)]">
        <div className="fade-in flex flex-col items-center gap-3">
          <Logo size={44} />
          <p className="text-[13px] text-muted">正在加载本地会话…</p>
        </div>
      </div>
    );
  }

  if (!auth.apiKey && !auth.webToken) {
    return <LoginScreen />;
  }

  const activeConversation =
    chat.conversations.find((item) => item.id === chat.activeId) ?? chat.conversations[0] ?? null;

  const sidebarProps = {
    conversations: chat.conversations,
    activeId: activeConversation?.id ?? null,
    onSelect: (id: string) => {
      void chat.selectConversation(id);
      setDrawer(false);
    },
    onNew: () => {
      void chat.createConversation();
      setDrawer(false);
    },
    onOpenSettings: () => {
      setSettingsOpen(true);
      setDrawer(false);
    },
    onOpenImport: () => {
      setImportOpen(true);
      setDrawer(false);
    },
    onToggleTheme: () =>
      useSettings.getState().patch({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
  };

  return (
    <div className="flex h-full overflow-hidden bg-[color:var(--bg-page)]">
      <div className="hidden lg:flex">
        <Sidebar {...sidebarProps} />
      </div>

      {drawer && (
        <div className="fixed inset-0 z-30 flex lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="fade-in relative z-10 h-full w-[86%] max-w-[320px] shadow-xl">
            <div className="absolute right-2 top-3 z-10">
              <button type="button" onClick={() => setDrawer(false)} className="rounded-lg p-2 text-muted">
                <X size={18} />
              </button>
            </div>
            <Sidebar {...sidebarProps} compact />
          </div>
        </div>
      )}

      <ChatView
        conversation={activeConversation}
        messages={chat.messages}
        streaming={chat.streaming}
        onOpenMenu={() => setDrawer(true)}
      />

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          onOpenImport={() => {
            setSettingsOpen(false);
            setImportOpen(true);
          }}
        />
      )}

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}

      {chat.toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div
            className={`fade-in max-w-[90%] rounded-full px-4 py-2 text-[12.5px] shadow-lg ${
              chat.toast.kind === 'error'
                ? 'bg-[#fdecec] text-[#c53131]'
                : 'bg-[color:var(--bg-card)] text-ink'
            }`}
          >
            {chat.toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
