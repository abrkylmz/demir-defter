// Supabase: hesap (e-posta + şifre) ve kullanıcıya özel bulut depolama.
// VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı değilse hiçbir şey yapılmaz ve uygulama yerel modda çalışır.
// Veri, claude.ai bulutuyla aynı belge modelini kullanan tek bir `docs` tablosunda tutulur (supabase/schema.sql);
// bu yüzden aşağıdaki adaptör sync.ts'in beklediği CloudDb arayüzünü sağlar ve senkron mantığı ortaktır.
import { createClient, type RealtimeChannel, type SupabaseClient, type User } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/** Hesap sistemi bu kurulumda açık mı? */
export const authEnabled = (): boolean => !!(URL && KEY);

export function supabase(): SupabaseClient {
  if (!client) {
    if (!URL || !KEY) throw new Error('Supabase yapılandırılmadı');
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export async function currentUser(): Promise<User | null> {
  if (!authEnabled()) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.user ?? null;
}

/** Kullanıcı adının kaynağı: kayıtta girilen ad. */
export const displayName = (u: User | null): string | undefined => {
  const n = u?.user_metadata?.full_name;
  return typeof n === 'string' && n.trim() ? n.trim() : undefined;
};

// ---------- CloudDb adaptörü ----------

interface DocRow {
  id: string;
  data: unknown;
}

/** `docs` tablosunu claude.ai CloudDb arayüzüne uyarlar. Tüm sorgular RLS ile kullanıcıya sınırlıdır. */
export function supabaseDb(sb: SupabaseClient, userId: string): CloudDb & { close(): void } {
  let channel: RealtimeChannel | null = null;
  const toDoc = (row: DocRow): CloudDoc => ({ id: row.id, data: () => row.data });

  const collection: CloudCollection = {
    doc: id => ({
      async set(data) {
        const { error } = await sb
          .from('docs')
          .upsert({ user_id: userId, id, data, updated_at: new Date().toISOString() });
        if (error) throw Object.assign(new Error(error.message), { code: 'unavailable' });
      },
      async delete() {
        const { error } = await sb.from('docs').delete().eq('user_id', userId).eq('id', id);
        if (error) throw Object.assign(new Error(error.message), { code: 'unavailable' });
      },
    }),

    async get() {
      const { data, error } = await sb.from('docs').select('id, data').eq('user_id', userId);
      if (error) throw error;
      const docs = (data as DocRow[]).map(toDoc);
      return { docs, docChanges: () => docs.map(doc => ({ type: 'added' as const, doc })) };
    },

    onSnapshot(onNext, onError) {
      channel = sb
        .channel(`docs:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'docs', filter: `user_id=eq.${userId}` },
          payload => {
            // Silme olaylarında yalnızca birincil anahtar gelir ve filtre uygulanmaz; kullanıcıyı kendimiz kontrol ederiz.
            const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<
              DocRow & { user_id: string }
            >;
            if (!row.id || (row.user_id && row.user_id !== userId)) return;
            const type =
              payload.eventType === 'DELETE'
                ? 'removed'
                : payload.eventType === 'INSERT'
                  ? 'added'
                  : 'modified';
            const doc = toDoc({ id: row.id, data: type === 'removed' ? null : row.data });
            onNext({ docs: [doc], docChanges: () => [{ type, doc }] });
          },
        )
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR') onError(new Error('realtime'));
        });
      return () => void channel?.unsubscribe();
    },
  };

  return {
    collection: () => collection,
    close: () => {
      if (channel) void sb.removeChannel(channel);
      channel = null;
    },
  };
}

// ---------- hesap işlemleri ----------

/** Supabase hata mesajlarını Türkçeye çevirir. */
export function authErrorText(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-posta ya da şifre hatalı.';
  if (m.includes('email not confirmed'))
    return 'E-postanı henüz onaylamadın. Gelen kutundaki bağlantıya tıkla.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.';
  if (m.includes('password should be at least') || m.includes('weak password'))
    return 'Şifre en az 8 karakter olmalı.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Geçerli bir e-posta gir.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Çok fazla deneme oldu, biraz sonra tekrar dene.';
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'İnternet bağlantısı yok gibi görünüyor.';
  return 'Bir sorun oluştu, tekrar dene.';
}

export type AuthResult = { ok: true; needsConfirmation: boolean } | { ok: false; error: string };

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: location.origin },
  });
  if (error) return { ok: false, error: authErrorText(error.message) };
  return { ok: true, needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: authErrorText(error.message) };
  return { ok: true, needsConfirmation: false };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  if (error) return { ok: false, error: authErrorText(error.message) };
  return { ok: true, needsConfirmation: false };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) return { ok: false, error: authErrorText(error.message) };
  return { ok: true, needsConfirmation: false };
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}
