// Yemek fotoğrafından besin tahmini (Claude, görsel girdi + şemaya bağlı JSON çıktı).
// Model çağrısı setFoodModel ile değiştirilebilir; testler gerçek API'ye gitmez.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export const aiEnabled = (): boolean => !!process.env.ANTHROPIC_API_KEY;

const MODEL = 'claude-opus-5-5';

/** Modelin döndürmesi gereken biçim. Makrolar 100 g başına. */
const FoodPhotoSchema = z.object({
  is_food: z.boolean().describe('Fotoğrafta yiyecek ya da içecek var mı'),
  items: z.array(
    z.object({
      name: z.string().describe('Türkçe yiyecek adı, ör. "Pirinç pilavı"'),
      match: z
        .string()
        .describe('Bilinen besinler listesinde birebir aynı yiyecek varsa onun adı, yoksa boş'),
      grams: z.number().describe('Fotoğraftaki porsiyonun tahmini gramı'),
      kcal: z.number().describe('100 g başına kalori'),
      protein: z.number().describe('100 g başına protein (g)'),
      carbs: z.number().describe('100 g başına karbonhidrat (g)'),
      fat: z.number().describe('100 g başına yağ (g)'),
      confidence: z.enum(['low', 'medium', 'high']),
    }),
  ),
  note: z.string().describe('Kullanıcıya tek cümlelik Türkçe not (ör. varsayımlar); gerekmiyorsa boş'),
});

export type FoodPhotoRaw = z.infer<typeof FoodPhotoSchema>;

export interface FoodPhotoInput {
  /** base64, "data:" öneki olmadan */
  image: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Uygulamanın bildiği besin adları (tablo + kullanıcının kendi besinleri) */
  known: string[];
}

export type FoodModelResult =
  { ok: true; data: FoodPhotoRaw } | { ok: false; reason: 'refused' | 'bad_output' | 'busy' | 'error' };

const SYSTEM = `Sen bir beslenme uzmanısın. Kullanıcı öğününün fotoğrafını çekip kalori takibi yapıyor.
Görevin: fotoğraftaki her ayrı yiyecek ve içeceği tanımak, görünen porsiyonun gramını ve 100 g başına besin değerlerini tahmin etmek.

- Tabak, çatal, el gibi nesneleri ölçek olarak kullan. Türk mutfağındaki tipik porsiyonları göz önünde tut.
- Karışık yemekleri (ör. kuru fasulye, menemen) tek kalem say; ayrı duran yiyecekleri (pilav, salata, ekmek) ayrı kalem yaz.
- Pişirme yağını ve sosları, görünüyorsa ilgili yemeğin değerlerine kat.
- Bilinen besinler listesinde aynı yiyecek varsa "match" alanına listedeki adı harfi harfine yaz; emin değilsen boş bırak.
- Emin olamadığın gramajda confidence "low" ver ve varsayımını "note" alanında kısaca belirt.
- Fotoğrafta yiyecek yoksa is_food false ve items boş olsun.
- Tüm adlar ve not Türkçe olsun.`;

let client: Anthropic | null = null;

async function claudeModel(input: FoodPhotoInput): Promise<FoodModelResult> {
  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Refusal durumunda API aynı isteği uygun bir yedek modelle tekrar dener.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: betaZodOutputFormat(FoodPhotoSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.image } },
            {
              type: 'text',
              text: `Bilinen besinler:\n${input.known.join('\n')}\n\nBu öğündeki yiyecekleri ve miktarlarını tahmin et.`,
            },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') return { ok: false, reason: 'refused' };
    if (!response.parsed_output) return { ok: false, reason: 'bad_output' };
    return { ok: true, data: response.parsed_output };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError)
      return { ok: false, reason: 'busy' };
    console.error('food-ai', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return { ok: false, reason: 'error' };
  }
}

let model: (input: FoodPhotoInput) => Promise<FoodModelResult> = claudeModel;

/** Testler için model çağrısını değiştirir; null gerçek modele döner. */
export function setFoodModel(m: typeof model | null): void {
  model = m ?? claudeModel;
}

export const analyzeFoodPhoto = (input: FoodPhotoInput): Promise<FoodModelResult> => model(input);

// ---------- model çıktısını doğrulama ----------

export interface FoodEstimate {
  name: string;
  /** Uygulamanın tablosundaki eşleşen besin; yoksa null (değerler modelden) */
  match: string | null;
  grams: number;
  per: { k: number; p: number; c: number; f: number };
  confidence: 'low' | 'medium' | 'high';
}

const MAX_ITEMS = 12;
const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Model de hata yapabilir: sayılar makul aralığa çekilir, listede olmayan eşleşme atılır. */
export function cleanEstimate(
  raw: FoodPhotoRaw,
  known: string[],
): { isFood: boolean; items: FoodEstimate[]; note: string } {
  const knownSet = new Map(known.map(n => [n.toLocaleLowerCase('tr-TR'), n]));
  const items = raw.items.slice(0, MAX_ITEMS).flatMap(it => {
    const name = String(it.name || '')
      .trim()
      .slice(0, 60);
    const grams = Math.round(clamp(it.grams, 1, 2000));
    if (!name || !grams) return [];
    return [
      {
        name,
        match:
          knownSet.get(
            String(it.match || '')
              .trim()
              .toLocaleLowerCase('tr-TR'),
          ) ?? null,
        grams,
        per: {
          k: Math.round(clamp(it.kcal, 0, 900)),
          p: r1(clamp(it.protein, 0, 100)),
          c: r1(clamp(it.carbs, 0, 100)),
          f: r1(clamp(it.fat, 0, 100)),
        },
        confidence: it.confidence,
      },
    ];
  });
  return { isFood: !!raw.is_food && items.length > 0, items, note: String(raw.note || '').slice(0, 200) };
}
