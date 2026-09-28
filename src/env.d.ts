// Standart tiplerde olmayan tarayıcı ve platform API'leri.

/** claude.ai artifact çalışma zamanı (yalnızca claude.ai'da var). Sadece uygulamanın kullandığı kısım. */
interface CloudDoc {
  id: string;
  data(): unknown;
}

interface CloudDocChange {
  type: 'added' | 'modified' | 'removed';
  doc: CloudDoc;
}

interface CloudSnapshot {
  docs: CloudDoc[];
  docChanges(): CloudDocChange[];
}

interface CloudDocRef {
  set(data: object): Promise<void>;
  delete(): Promise<void>;
}

interface CloudCollection {
  doc(id: string): CloudDocRef;
  get(): Promise<CloudSnapshot>;
  onSnapshot(onNext: (s: CloudSnapshot) => void, onError: (e: unknown) => void): () => void;
}

interface CloudDb {
  collection(path: string): CloudCollection;
}

interface CloudUser {
  id(): Promise<string | null>;
}

interface CloudDownloads {
  save(file: { filename: string; data: string }): Promise<void>;
}

interface ClaudeRuntime {
  use(name: 'db'): Promise<CloudDb | null>;
  use(name: 'user'): Promise<CloudUser | null>;
  use(name: 'downloads'): Promise<CloudDownloads | null>;
}

/** Chrome/Edge/Android kurulum olayı. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Window {
  claude?: ClaudeRuntime;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

interface Navigator {
  /** iOS Safari: ana ekrandan açıldıysa true */
  standalone?: boolean;
}
