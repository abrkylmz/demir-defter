// Şifre sıfırlama e-postası (Resend). RESEND_API_KEY yoksa şifre sıfırlama kapalıdır.

export const mailEnabled = (): boolean => !!process.env.RESEND_API_KEY;

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export async function sendResetEmail(to: string, name: string, link: string): Promise<void> {
  const from = process.env.EMAIL_FROM || 'Demir Defter <onboarding@resend.dev>';
  const hello = name ? `Merhaba ${esc(name)},` : 'Merhaba,';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'Demir Defter şifre yenileme',
      text: `${name ? `Merhaba ${name},` : 'Merhaba,'}\n\nŞifreni yenilemek için bu bağlantıyı aç (1 saat geçerli):\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
      html: `<p>${hello}</p><p>Şifreni yenilemek için aşağıdaki bağlantıya tıkla. Bağlantı 1 saat geçerli.</p>
        <p><a href="${esc(link)}">Şifremi yenile</a></p>
        <p style="color:#736c66">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
