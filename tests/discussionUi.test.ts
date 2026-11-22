import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { discussionUi, hasDiscussionUiTranslation, missingDiscussionUiTranslations } from '../src/lib/discussionUi';
import { communityDirection, communityInterfaceLocale, communityReturnLocale } from '../src/lib/communityLanguage';
import { discussionTranslationLabel } from '../src/lib/discussionTranslationUi';

describe('discussion language across the public-to-app journey', () => {
  it('renders Swahili discussion actions without claiming translation service support', () => {
    expect(missingDiscussionUiTranslations('sw')).toEqual([]);
    expect(discussionUi('sw', 'Publier le sujet')).toBe('Chapisha mada');
    expect(discussionTranslationLabel('sw', 'unavailable')).toBe('Tafsiri haipatikani kwa sasa.');
    expect(communityInterfaceLocale('sw-KE')).toBe('sw');
    expect(missingDiscussionUiTranslations('ga')).toEqual([]);
    expect(discussionUi('ga-IE', 'Publier le sujet')).toBe('Foilsigh an t-ábhar');
    expect(communityInterfaceLocale('ga-IE')).toBe('ga');
  });
  it('keeps a valid language when opening or returning to a discussion', () => {
    expect(communityReturnLocale('/club/france/discussions/new', 'en')).toBe('/club/france/discussions/new?communityLocale=en');
    expect(communityReturnLocale('/club/france/discussions/topic', 'fr')).toContain('communityLocale=fr');
    expect(communityReturnLocale('/club/france/discussions', 'en&foo=1')).toBe('/club/france/discussions');
  });
  it('translates discussion actions and validation errors in English and retains French', () => {
    for (const [fr, en] of [
      ['Publier le sujet', 'Publish topic'], ['Publier la réponse', 'Publish reply'],
      ['Rechercher dans les discussions', 'Search discussions'], ['Signaler', 'Report'],
      ['Le titre doit contenir entre 5 et 180 caractères.', 'The title must contain between 5 and 180 characters.'],
    ]) { expect(discussionUi('en', fr)).toBe(en); expect(discussionUi('fr', fr)).toBe(fr); }
  });
  it('translates the Spanish discussion and sign-in journey', () => {
    for (const [fr, es] of [
      ['Discussions du club', 'Debates del club'], ['Publier le sujet', 'Publicar tema'],
      ['Rechercher dans les discussions', 'Buscar en los debates'], ['Signaler', 'Denunciar'],
      ['Connexion requise', 'Debes iniciar sesión'], ['Le titre doit contenir entre 5 et 180 caractères.', 'El título debe tener entre 5 y 180 caracteres.'],
    ]) expect(discussionUi('es-ES', fr)).toBe(es);
  });
  it('provides complete Portuguese copy for discussion and sign-in actions', () => {
    expect(missingDiscussionUiTranslations('pt')).toEqual([]);
    expect(discussionUi('pt-BR', 'Publier le sujet')).toBe('Publicar tópico');
    expect(discussionUi('pt-PT', 'Connexion requise')).toBe('É necessário entrar');
    expect(missingDiscussionUiTranslations('fo').length).toBeGreaterThan(0);
  });
  it('provides Italian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('it')).toEqual([]);
    expect(discussionUi('it-IT', 'Publier le sujet')).toBe('Pubblica argomento');
    expect(discussionUi('it', 'Connexion requise')).toBe('Accesso richiesto');
    expect(discussionUi('it', 'Envoyer le signalement')).toBe('Invia segnalazione');
  });
  it('provides Dutch discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('nl')).toEqual([]);
    expect(discussionUi('nl-NL', 'Publier le sujet')).toBe('Onderwerp publiceren');
    expect(discussionUi('nl-BE', 'Connexion requise')).toBe('Inloggen vereist');
    expect(discussionUi('nl', 'Envoyer le signalement')).toBe('Melding verzenden');
  });
  it('provides Arabic discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ar')).toEqual([]);
    expect(discussionUi('ar-MA', 'Publier le sujet')).toBe('نشر الموضوع');
    expect(discussionUi('ar', 'Connexion requise')).toBe('يلزم تسجيل الدخول');
    expect(discussionUi('ar', 'Envoyer le signalement')).toBe('إرسال البلاغ');
    expect(communityDirection('ar-MA')).toBe('rtl');
    expect(communityDirection('fr-FR')).toBe('ltr');
  });
  it('provides Turkish discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('tr')).toEqual([]);
    expect(discussionUi('tr-TR', 'Publier le sujet')).toBe('Konuyu yayımla');
    expect(discussionUi('tr', 'Connexion requise')).toBe('Giriş gerekli');
    expect(discussionUi('tr', 'Envoyer le signalement')).toBe('Bildirimi gönder');
  });
  it('provides Japanese discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ja')).toEqual([]);
    expect(discussionUi('ja-JP', 'Publier le sujet')).toBe('トピックを投稿');
    expect(discussionUi('ja', 'Connexion requise')).toBe('ログインが必要です');
    expect(discussionUi('ja', 'Envoyer le signalement')).toBe('報告を送信');
  });
  it('provides simplified Chinese without presenting it as traditional Chinese', () => {
    expect(missingDiscussionUiTranslations('zh')).toEqual([]);
    expect(discussionUi('zh-CN', 'Publier le sujet')).toBe('发布话题');
    expect(discussionUi('zh-Hant-TW', 'Publier le sujet')).toBe('發布話題');
    expect(discussionUi('zh', 'Envoyer le signalement')).toBe('发送举报');
  });
  it('provides Korean discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ko')).toEqual([]);
    expect(discussionUi('ko-KR', 'Publier le sujet')).toBe('주제 게시');
    expect(discussionUi('ko', 'Connexion requise')).toBe('로그인이 필요합니다');
    expect(discussionUi('ko', 'Envoyer le signalement')).toBe('신고 보내기');
  });
  it('provides Russian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ru')).toEqual([]);
    expect(discussionUi('ru-RU', 'Publier le sujet')).toBe('Опубликовать тему');
    expect(discussionUi('ru', 'Connexion requise')).toBe('Необходим вход');
    expect(discussionUi('ru', 'Envoyer le signalement')).toBe('Отправить жалобу');
  });
  it('provides Ukrainian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('uk')).toEqual([]);
    expect(discussionUi('uk-UA', 'Publier le sujet')).toBe('Опублікувати тему');
    expect(discussionUi('uk', 'Connexion requise')).toBe('Потрібно увійти');
    expect(discussionUi('uk', 'Envoyer le signalement')).toBe('Надіслати скаргу');
  });
  it('provides Polish discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('pl')).toEqual([]);
    expect(discussionUi('pl-PL', 'Publier le sujet')).toBe('Opublikuj temat');
    expect(discussionUi('pl', 'Envoyer le signalement')).toBe('Wyślij zgłoszenie');
    expect(discussionTranslationLabel('pl', 'show')).toBe('Zobacz tłumaczenie');
  });
  it('provides Czech discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('cs')).toEqual([]);
    expect(discussionUi('cs-CZ', 'Publier le sujet')).toBe('Zveřejnit téma');
    expect(discussionUi('cs', 'Envoyer le signalement')).toBe('Odeslat hlášení');
    expect(discussionTranslationLabel('cs', 'show')).toBe('Zobrazit překlad');
  });
  it('provides Romanian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ro')).toEqual([]);
    expect(discussionUi('ro-RO', 'Publier le sujet')).toBe('Publică subiectul');
    expect(discussionUi('ro', 'Envoyer le signalement')).toBe('Trimite raportarea');
    expect(discussionTranslationLabel('ro', 'show')).toBe('Vezi traducerea');
  });
  it('provides Hungarian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('hu')).toEqual([]);
    expect(discussionUi('hu-HU', 'Publier le sujet')).toBe('Téma közzététele');
    expect(discussionUi('hu', 'Envoyer le signalement')).toBe('Jelentés elküldése');
    expect(discussionTranslationLabel('hu', 'show')).toBe('Fordítás megtekintése');
  });
  it('provides Finnish discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('fi')).toEqual([]);
    expect(discussionUi('fi-FI', 'Publier le sujet')).toBe('Julkaise aihe');
    expect(discussionUi('fi', 'Envoyer le signalement')).toBe('Lähetä ilmoitus');
    expect(discussionTranslationLabel('fi', 'show')).toBe('Näytä käännös');
  });
  it('provides Swedish discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('sv')).toEqual([]);
    expect(discussionUi('sv-SE', 'Publier le sujet')).toBe('Publicera ämnet');
    expect(discussionUi('sv', 'Envoyer le signalement')).toBe('Skicka anmälan');
    expect(discussionTranslationLabel('sv', 'show')).toBe('Visa översättning');
  });
  it('provides Danish discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('da')).toEqual([]);
    expect(discussionUi('da-DK', 'Publier le sujet')).toBe('Udgiv emnet');
    expect(discussionUi('da', 'Envoyer le signalement')).toBe('Send anmeldelse');
    expect(discussionTranslationLabel('da', 'show')).toBe('Se oversættelse');
  });
  it('provides Greek discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('el')).toEqual([]);
    expect(discussionUi('el-GR', 'Publier le sujet')).toBe('Δημοσίευση θέματος');
    expect(discussionUi('el', 'Envoyer le signalement')).toBe('Αποστολή αναφοράς');
    expect(discussionTranslationLabel('el', 'show')).toBe('Προβολή μετάφρασης');
  });
  it('provides Croatian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('hr')).toEqual([]);
    expect(discussionUi('hr-HR', 'Publier le sujet')).toBe('Objavi temu');
    expect(discussionUi('hr', 'Envoyer le signalement')).toBe('Pošalji prijavu');
    expect(discussionTranslationLabel('hr', 'show')).toBe('Prikaži prijevod');
  });
  it('provides Slovenian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('sl')).toEqual([]);
    expect(discussionUi('sl-SI', 'Publier le sujet')).toBe('Objavi temo');
    expect(discussionUi('sl', 'Envoyer le signalement')).toBe('Pošlji prijavo');
    expect(discussionTranslationLabel('sl', 'show')).toBe('Prikaži prevod');
  });
  it('provides Slovak discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('sk')).toEqual([]);
    expect(discussionUi('sk-SK', 'Publier le sujet')).toBe('Zverejniť tému');
    expect(discussionUi('sk', 'Envoyer le signalement')).toBe('Odoslať hlásenie');
    expect(discussionTranslationLabel('sk', 'show')).toBe('Zobraziť preklad');
  });
  it('provides Bulgarian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('bg')).toEqual([]);
    expect(discussionUi('bg-BG', 'Publier le sujet')).toBe('Публикувай тема');
    expect(discussionUi('bg', 'Envoyer le signalement')).toBe('Изпрати сигнал');
    expect(discussionTranslationLabel('bg', 'show')).toBe('Виж превода');
  });
  it('provides Estonian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('et')).toEqual([]);
    expect(discussionUi('et-EE', 'Publier le sujet')).toBe('Avalda teema');
    expect(discussionUi('et', 'Envoyer le signalement')).toBe('Saada teavitus');
    expect(discussionTranslationLabel('et', 'show')).toBe('Vaata tõlget');
  });
  it('provides Lithuanian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('lt')).toEqual([]);
    expect(discussionUi('lt-LT', 'Publier le sujet')).toBe('Paskelbti temą');
    expect(discussionUi('lt', 'Envoyer le signalement')).toBe('Siųsti pranešimą');
    expect(discussionTranslationLabel('lt', 'show')).toBe('Peržiūrėti vertimą');
  });
  it('provides Latvian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('lv')).toEqual([]);
    expect(discussionUi('lv-LV', 'Publier le sujet')).toBe('Publicēt tēmu');
    expect(discussionUi('lv', 'Envoyer le signalement')).toBe('Nosūtīt ziņojumu');
    expect(discussionTranslationLabel('lv', 'show')).toBe('Skatīt tulkojumu');
  });
  it('provides Norwegian Bokmål discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('nb')).toEqual([]);
    expect(discussionUi('nb-NO', 'Publier le sujet')).toBe('Publiser temaet');
    expect(discussionUi('nb', 'Envoyer le signalement')).toBe('Send rapport');
    expect(discussionTranslationLabel('nb', 'show')).toBe('Se oversettelse');
  });
  it('provides Catalan discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ca')).toEqual([]);
    expect(discussionUi('ca-ES', 'Publier le sujet')).toBe('Publica el tema');
    expect(discussionUi('ca', 'Envoyer le signalement')).toBe('Envia la denúncia');
    expect(discussionTranslationLabel('ca', 'show')).toBe('Veure la traducció');
  });
  it('keeps Serbian Cyrillic and Latin interface scripts distinct', () => {
    expect(missingDiscussionUiTranslations('sr')).toEqual([]);
    expect(missingDiscussionUiTranslations('sr-Latn')).toEqual([]);
    expect(discussionUi('sr-RS', 'Publier le sujet')).toBe('Објави тему');
    expect(discussionUi('sr-Latn-RS', 'Publier le sujet')).toBe('Objavi temu');
    expect(discussionTranslationLabel('sr-Latn', 'show')).toBe('Prikaži prevod');
  });
  it('provides Hebrew discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('he')).toEqual([]);
    expect(discussionUi('he-IL', 'Publier le sujet')).toBe('פרסום הנושא');
    expect(discussionUi('he', 'Envoyer le signalement')).toBe('שליחת הדיווח');
    expect(communityDirection('he-IL')).toBe('rtl');
    expect(discussionTranslationLabel('he', 'show')).toBe('הצגת התרגום');
  });
  it('provides Persian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('fa')).toEqual([]);
    expect(discussionUi('fa-IR', 'Publier le sujet')).toBe('انتشار موضوع');
    expect(discussionUi('fa', 'Envoyer le signalement')).toBe('ارسال گزارش');
    expect(communityDirection('fa-IR')).toBe('rtl');
    expect(discussionTranslationLabel('fa', 'show')).toBe('نمایش ترجمه');
  });
  it('provides Hindi discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('hi')).toEqual([]);
    expect(discussionUi('hi-IN', 'Publier le sujet')).toBe('विषय प्रकाशित करें');
    expect(discussionUi('hi', 'Envoyer le signalement')).toBe('रिपोर्ट भेजें');
    expect(discussionTranslationLabel('hi', 'show')).toBe('अनुवाद देखें');
  });
  it('provides Thai discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('th')).toEqual([]);
    expect(discussionUi('th-TH', 'Publier le sujet')).toBe('เผยแพร่หัวข้อ');
    expect(discussionUi('th', 'Envoyer le signalement')).toBe('ส่งรายงาน');
    expect(discussionTranslationLabel('th', 'show')).toBe('ดูคำแปล');
  });
  it('provides Indonesian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('id')).toEqual([]);
    expect(discussionUi('id-ID', 'Publier le sujet')).toBe('Publikasikan topik');
    expect(discussionUi('id', 'Envoyer le signalement')).toBe('Kirim laporan');
    expect(discussionTranslationLabel('id', 'show')).toBe('Lihat terjemahan');
  });
  it('provides Icelandic discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('is')).toEqual([]);
    expect(discussionUi('is-IS', 'Publier le sujet')).toBe('Birta umræðu');
    expect(discussionUi('is', 'Envoyer le signalement')).toBe('Senda tilkynningu');
    expect(discussionTranslationLabel('is', 'show')).toBe('Sjá þýðingu');
  });
  it('provides Malay discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ms')).toEqual([]);
    expect(discussionUi('ms-MY', 'Publier le sujet')).toBe('Terbitkan topik');
    expect(discussionUi('ms', 'Envoyer le signalement')).toBe('Hantar laporan');
    expect(discussionTranslationLabel('ms', 'show')).toBe('Lihat terjemahan');
  });
  it('provides Albanian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('sq')).toEqual([]);
    expect(discussionUi('sq-AL', 'Publier le sujet')).toBe('Publiko temën');
    expect(discussionUi('sq', 'Envoyer le signalement')).toBe('Dërgo raportimin');
    expect(discussionTranslationLabel('sq', 'show')).toBe('Shiko përkthimin');
  });
  it('provides Macedonian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('mk')).toEqual([]);
    expect(discussionUi('mk-MK', 'Publier le sujet')).toBe('Објави тема');
    expect(discussionUi('mk', 'Envoyer le signalement')).toBe('Испрати пријава');
    expect(discussionTranslationLabel('mk', 'show')).toBe('Прикажи превод');
  });
  it('provides Haitian Creole discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('ht')).toEqual([]);
    expect(discussionUi('ht-HT', 'Publier le sujet')).toBe('Pibliye sijè a');
    expect(discussionUi('ht', 'Envoyer le signalement')).toBe('Voye siyalman an');
    expect(discussionTranslationLabel('ht', 'show')).toBe('Gade tradiksyon an');
  });
  it('provides Belarusian discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('be')).toEqual([]);
    expect(discussionUi('be-BY', 'Publier le sujet')).toBe('Апублікаваць тэму');
    expect(discussionUi('be', 'Envoyer le signalement')).toBe('Адправіць скаргу');
    expect(discussionTranslationLabel('be', 'show')).toBe('Паглядзець пераклад');
  });
  it('provides Nynorsk discussion and moderation actions', () => {
    expect(missingDiscussionUiTranslations('nn')).toEqual([]);
    expect(discussionUi('nn-NO', 'Publier le sujet')).toBe('Publiser temaet');
    expect(discussionUi('nn', 'Envoyer le signalement')).toBe('Send rapport');
    expect(discussionTranslationLabel('nn', 'show')).toBe('Sjå omsetjing');
  });
  it('provides German copy for discussion actions, errors and moderation', () => {
    expect(missingDiscussionUiTranslations('de')).toEqual([]);
    expect(discussionUi('de-DE', 'Publier le sujet')).toBe('Thema veröffentlichen');
    expect(discussionUi('de-AT', 'Connexion requise')).toBe('Anmeldung erforderlich');
    expect(discussionUi('de', 'Envoyer le signalement')).toBe('Meldung senden');
  });
  it('covers every literal discussion and sign-in string used in the interface', () => {
    const files = ['src/components/ClubDiscussions.tsx', 'src/screens/ClubDiscussions.tsx', 'src/components/AuthGate.tsx'];
    const used = new Set(files.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/\bt\("([^"\n]+)"\)/g)].map(match => match[1])));
    expect(used.size).toBeGreaterThan(40);
    for (const locale of ['en', 'es', 'pt', 'de', 'it', 'nl', 'ar', 'tr', 'ja', 'zh', 'ko', 'ru', 'uk', 'pl', 'cs', 'ro', 'hu', 'fi', 'sv', 'da', 'el', 'hr', 'sl', 'sk', 'bg', 'et', 'lt', 'lv', 'nb', 'nn', 'ca', 'sr', 'sr-latn', 'he', 'fa', 'hi', 'th', 'id', 'is', 'ms', 'sq', 'mk', 'ht', 'be']) {
      for (const text of used) expect(hasDiscussionUiTranslation(locale, text), `${locale}: ${text}`).toBe(true);
    }
  });
  it('selects the most specific available interface language for regional tags', () => {
    expect(communityInterfaceLocale('en-US')).toBe('en');
    expect(communityInterfaceLocale('es-MX')).toBe('es');
    expect(communityInterfaceLocale('sr-Latn-RS')).toBe('sr-Latn');
    expect(communityInterfaceLocale('sr-RS')).toBe('sr');
    expect(communityInterfaceLocale('SR-latn-rs')).toBe('sr-Latn');
    expect(communityInterfaceLocale('zh-Hant-TW')).toBe('zh-Hant');
    expect(communityInterfaceLocale('zh-TW')).toBe('zh-Hant');
    expect(communityInterfaceLocale('zh-HK')).toBe('zh-Hant');
    expect(communityInterfaceLocale('zh-CN')).toBe('zh');
    expect(communityInterfaceLocale('not-a-language')).toBe('fr');
    expect(communityReturnLocale('/discussions', 'es-MX')).toBe('/discussions?communityLocale=es-MX');
    expect(communityReturnLocale('/club/france/discussions/new', 'EN-us')).toBe('/club/france/discussions/new?communityLocale=en-US');
  });
  it('localizes translation controls even when the translation service lacks the target', () => {
    expect(discussionTranslationLabel('ar-MA', 'show')).toBe('عرض الترجمة');
    expect(discussionTranslationLabel('ja-JP', 'unavailable')).toBe('現在、翻訳を利用できません。');
    expect(discussionTranslationLabel('zh-Hant-TW', 'show')).toBe('查看翻譯');
  });
});
