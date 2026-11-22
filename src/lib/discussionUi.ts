import { portuguese } from './discussionUiPortuguese';
import { german } from './discussionUiGerman';
import { italian } from './discussionUiItalian';
import { dutch } from './discussionUiDutch';
import { arabic } from './discussionUiArabic';
import { turkish } from './discussionUiTurkish';
import { japanese } from './discussionUiJapanese';
import { chinese } from './discussionUiChinese';
import { chineseTraditional } from './discussionUiChineseTraditional';
import { swahili } from './discussionUiSwahili';
import { irish } from './discussionUiIrish';
import { korean } from './discussionUiKorean';
import { russian } from './discussionUiRussian';
import { ukrainian } from './discussionUiUkrainian';
import { polish } from './discussionUiPolish';
import { czech } from './discussionUiCzech';
import { romanian } from './discussionUiRomanian';
import { hungarian } from './discussionUiHungarian';
import { finnish } from './discussionUiFinnish';
import { swedish } from './discussionUiSwedish';
import { danish } from './discussionUiDanish';
import { greek } from './discussionUiGreek';
import { croatian } from './discussionUiCroatian';
import { slovenian } from './discussionUiSlovenian';
import { slovak } from './discussionUiSlovak';
import { bulgarian } from './discussionUiBulgarian';
import { estonian } from './discussionUiEstonian';
import { lithuanian } from './discussionUiLithuanian';
import { latvian } from './discussionUiLatvian';
import { norwegian } from './discussionUiNorwegian';
import { nynorsk } from './discussionUiNynorsk';
import { maltese } from './discussionUiMaltese';
import { catalan } from './discussionUiCatalan';
import { serbian, serbianLatin } from './discussionUiSerbian';
import { hebrew } from './discussionUiHebrew';
import { persian } from './discussionUiPersian';
import { hindi } from './discussionUiHindi';
import { thai } from './discussionUiThai';
import { indonesian } from './discussionUiIndonesian';
import { icelandic } from './discussionUiIcelandic';
import { malay } from './discussionUiMalay';
import { albanian } from './discussionUiAlbanian';
import { macedonian } from './discussionUiMacedonian';
import { haitian } from './discussionUiHaitian';
import { belarusian } from './discussionUiBelarusian';

/** Interface strings for the club discussion journey. */
const english: Record<string, string> = {
  'Discussions du club': 'Club discussions', 'Discussions football': 'Football discussions',
  'Le club se vit aussi entre vous.': 'Share the club experience with other supporters.',
  'Partagez, débattez et échangez avec la communauté.': 'Share, debate and connect with the community.',
  'Choisir un club pour créer un sujet': 'Choose a club to start a topic',
  'Rechercher dans les discussions': 'Search discussions', 'Récents': 'Recent',
  'Populaires · 7 jours': 'Popular · 7 days', 'Les mieux notés': 'Top rated', 'Tout': 'All',
  'Matchs': 'Matches', 'Mercato': 'Transfers', 'Vie du club': 'Club life', 'Questions': 'Questions', 'Autres': 'Other',
  'Pays du club (FR, ES…)': 'Club country (FR, ES…)', 'Langue du sujet (fr, en, sr-Latn…)': 'Topic language (fr, en, sr-Latn…)',
  'Aucun sujet trouvé': 'No topics found', 'Une question, un débrief de match ou une idée pour le club ? La communauté vous attend.': 'Have a question, a match recap or an idea for the club? The community is waiting.',
  'Charger plus de sujets': 'Load more topics', 'Explorer toutes les discussions': 'Explore all discussions',
  'Membre': 'Member', 'Compte supprimé': 'Deleted account', 'Épinglé': 'Pinned', 'Verrouillé': 'Locked',
  'Titre du sujet': 'Topic title', 'Votre message': 'Your message', 'Votre réponse': 'Your reply',
  'Modifier': 'Edit', 'Enregistrer': 'Save', 'Publier le sujet': 'Publish topic', 'Publier la réponse': 'Publish reply', 'Annuler': 'Cancel',
  'Le titre doit contenir entre 5 et 180 caractères.': 'The title must contain between 5 and 180 characters.',
  'Développez votre sujet en 20 caractères minimum.': 'Your topic must contain at least 20 characters.',
  'Ajoutez un message à votre réponse.': 'Add a message to your reply.',
  'Code de langue invalide : fr, en, sr-Latn, tpi…': 'Invalid language code: fr, en, sr-Latn, tpi…',
  'La publication n’a pas pu être confirmée. Réessayez cet envoi.': 'Publication could not be confirmed. Retry this submission.',
  'L’envoi n’a pas abouti. Votre brouillon est conservé.': 'The submission failed. Your draft has been kept.',
  'Restez respectueux, protégez les informations personnelles et partagez uniquement des médias que vous avez le droit de publier.': 'Be respectful, protect personal information and only share media you have the right to publish.',
  ' Votre envoi est conservé : réessayez pour confirmer sa publication sans créer de doublon.': ' Your submission has been kept: retry to confirm publication without creating a duplicate.',
  'Réessayer le même envoi': 'Retry the same submission', 'Répondre': 'Reply', 'Ne plus suivre': 'Unfollow', 'Suivre le sujet': 'Follow topic',
  'Options': 'Options', 'Partager': 'Share', 'Supprimer': 'Delete', 'Signaler': 'Report',
  'Vote positif': 'Upvote', 'Vote négatif': 'Downvote', 'Connectez-vous pour participer.': 'Sign in to participate.',
  'L’état du vote a été actualisé.': 'The vote status has been refreshed.', 'Signalement transmis à la modération.': 'Report sent to the moderation team.',
  'Le partage n’a pas pu être ouvert.': 'Sharing could not be opened.',
  'Supprimer votre contenu ? Les réponses des autres membres resteront visibles.': 'Delete your content? Other members’ replies will remain visible.',
  'Confirmer la suppression': 'Confirm deletion', 'Signaler à FootNation': 'Report to FootNation',
  'Harcèlement': 'Harassment', 'Violence': 'Violence', 'Inapproprié': 'Inappropriate', 'Protection des mineurs': 'Child safety', 'Autre': 'Other',
  'Précisions (facultatif)': 'Details (optional)', 'Envoyer le signalement': 'Send report',
  'Le résultat du vote doit être vérifié avant de voter à nouveau.': 'The vote result must be checked before voting again.', 'Actualiser le vote': 'Refresh vote',
  'Ce contenu a été retiré.': 'This content has been removed.', 'Club introuvable': 'Club not found', 'Sujet indisponible': 'Topic unavailable',
  'Connexion requise': 'Sign-in required', 'Connectez-vous pour accéder à cette section de FootNation.': 'Sign in to access this section of FootNation.',
  'Se connecter': 'Log in', 'S’inscrire': 'Sign up', 'Se reconnecter': 'Sign in again', 'Complétez votre profil': 'Complete your profile',
  'Créez votre profil FootNation pour rejoindre la communauté.': 'Create your FootNation profile to join the community.', 'Compléter mon profil': 'Complete my profile',
  'Ce sujet n’existe pas ou a été masqué par la modération.': 'This topic does not exist or has been hidden by moderators.',
  'Ce sujet n’accepte plus de nouvelles réponses.': 'This topic no longer accepts replies.',
  'En réponse à un commentaire précédent.': 'In reply to an earlier comment.', 'Charger plus de réponses': 'Load more replies',
};
const spanish: Record<string, string> = {
  'Discussions du club': 'Debates del club', 'Discussions football': 'Debates de fútbol',
  'Le club se vit aussi entre vous.': 'Comparte la pasión por el club con otros aficionados.',
  'Partagez, débattez et échangez avec la communauté.': 'Comparte, debate y conversa con la comunidad.',
  'Choisir un club pour créer un sujet': 'Elige un club para crear un tema', 'Rechercher dans les discussions': 'Buscar en los debates',
  'Récents': 'Recientes', 'Populaires · 7 jours': 'Populares · 7 días', 'Les mieux notés': 'Mejor valorados', 'Tout': 'Todos',
  'Matchs': 'Partidos', 'Mercato': 'Fichajes', 'Vie du club': 'Vida del club', 'Questions': 'Preguntas', 'Autres': 'Otros',
  'Pays du club (FR, ES…)': 'País del club (FR, ES…)', 'Langue du sujet (fr, en, sr-Latn…)': 'Idioma del tema (fr, en, sr-Latn…)',
  'Aucun sujet trouvé': 'No se encontraron temas', 'Une question, un débrief de match ou une idée pour le club ? La communauté vous attend.': '¿Tienes una pregunta, un comentario sobre un partido o una idea para el club? La comunidad te espera.',
  'Charger plus de sujets': 'Cargar más temas', 'Explorer toutes les discussions': 'Explorar todos los debates',
  'Membre': 'Miembro', 'Compte supprimé': 'Cuenta eliminada', 'Épinglé': 'Fijado', 'Verrouillé': 'Cerrado',
  'Titre du sujet': 'Título del tema', 'Votre message': 'Tu mensaje', 'Votre réponse': 'Tu respuesta',
  'Modifier': 'Editar', 'Enregistrer': 'Guardar', 'Publier le sujet': 'Publicar tema', 'Publier la réponse': 'Publicar respuesta', 'Annuler': 'Cancelar',
  'Le titre doit contenir entre 5 et 180 caractères.': 'El título debe tener entre 5 y 180 caracteres.',
  'Développez votre sujet en 20 caractères minimum.': 'El tema debe tener al menos 20 caracteres.', 'Ajoutez un message à votre réponse.': 'Añade un mensaje a tu respuesta.',
  'Code de langue invalide : fr, en, sr-Latn, tpi…': 'Código de idioma no válido: fr, en, sr-Latn, tpi…',
  'La publication n’a pas pu être confirmée. Réessayez cet envoi.': 'No se pudo confirmar la publicación. Reintenta este envío.',
  'L’envoi n’a pas abouti. Votre brouillon est conservé.': 'No se pudo completar el envío. Tu borrador se ha conservado.',
  'Restez respectueux, protégez les informations personnelles et partagez uniquement des médias que vous avez le droit de publier.': 'Respeta a los demás, protege los datos personales y comparte solo contenido que tengas derecho a publicar.',
  ' Votre envoi est conservé : réessayez pour confirmer sa publication sans créer de doublon.': ' Tu envío se ha conservado: reinténtalo para confirmar su publicación sin crear duplicados.',
  'Réessayer le même envoi': 'Reintentar el mismo envío', 'Répondre': 'Responder', 'Ne plus suivre': 'Dejar de seguir', 'Suivre le sujet': 'Seguir el tema',
  'Options': 'Opciones', 'Partager': 'Compartir', 'Supprimer': 'Eliminar', 'Signaler': 'Denunciar', 'Vote positif': 'Voto positivo', 'Vote négatif': 'Voto negativo',
  'Connectez-vous pour participer.': 'Inicia sesión para participar.', 'L’état du vote a été actualisé.': 'Se ha actualizado el estado del voto.',
  'Signalement transmis à la modération.': 'La denuncia se ha enviado al equipo de moderación.', 'Le partage n’a pas pu être ouvert.': 'No se pudo abrir la opción de compartir.',
  'Supprimer votre contenu ? Les réponses des autres membres resteront visibles.': '¿Eliminar tu contenido? Las respuestas de otros miembros seguirán visibles.',
  'Confirmer la suppression': 'Confirmar eliminación', 'Signaler à FootNation': 'Denunciar a FootNation',
  'Harcèlement': 'Acoso', 'Violence': 'Violencia', 'Inapproprié': 'Inapropiado', 'Protection des mineurs': 'Protección de menores', 'Autre': 'Otro',
  'Précisions (facultatif)': 'Detalles (opcional)', 'Envoyer le signalement': 'Enviar denuncia',
  'Le résultat du vote doit être vérifié avant de voter à nouveau.': 'Hay que verificar el resultado del voto antes de volver a votar.', 'Actualiser le vote': 'Actualizar voto',
  'Ce contenu a été retiré.': 'Este contenido ha sido retirado.', 'Club introuvable': 'Club no encontrado', 'Sujet indisponible': 'Tema no disponible',
  'Connexion requise': 'Debes iniciar sesión', 'Connectez-vous pour accéder à cette section de FootNation.': 'Inicia sesión para acceder a esta sección de FootNation.',
  'Se connecter': 'Iniciar sesión', 'S’inscrire': 'Registrarse', 'Se reconnecter': 'Volver a iniciar sesión', 'Complétez votre profil': 'Completa tu perfil',
  'Créez votre profil FootNation pour rejoindre la communauté.': 'Crea tu perfil de FootNation para unirte a la comunidad.', 'Compléter mon profil': 'Completar mi perfil',
  'Ce sujet n’existe pas ou a été masqué par la modération.': 'Este tema no existe o ha sido ocultado por moderación.',
  'Ce sujet n’accepte plus de nouvelles réponses.': 'Este tema ya no acepta nuevas respuestas.',
  'En réponse à un commentaire précédent.': 'En respuesta a un comentario anterior.', 'Charger plus de réponses': 'Cargar más respuestas',
};
const translations: Record<string, Record<string, string>> = { en: english, es: spanish, pt: portuguese, de: german, it: italian, nl: dutch, ar: arabic, tr: turkish, ja: japanese, zh: chinese, 'zh-hant': chineseTraditional, ko: korean, ru: russian, uk: ukrainian, pl: polish, cs: czech, ro: romanian, hu: hungarian, fi: finnish, sv: swedish, da: danish, el: greek, hr: croatian, sl: slovenian, sk: slovak, bg: bulgarian, et: estonian, lt: lithuanian, lv: latvian, nb: norwegian, nn: nynorsk, mt: maltese, sw: swahili, ga: irish, ca: catalan, sr: serbian, 'sr-latn': serbianLatin, he: hebrew, fa: persian, hi: hindi, th: thai, id: indonesian, is: icelandic, ms: malay, sq: albanian, mk: macedonian, ht: haitian, be: belarusian };

export function discussionUi(locale: unknown, text: string): string {
  if (typeof locale !== 'string') return text;
  const language = /^zh-(?:hant|tw|hk|mo)(?:-|$)/i.test(locale) ? 'zh-hant' : /^sr-latn(?:-|$)/i.test(locale) ? 'sr-latn' : locale.toLowerCase().split('-')[0];
  return translations[language]?.[text] ?? text;
}

/** Detect missing UI copy before publishing a new locale. */
export function missingDiscussionUiTranslations(locale: string): string[] {
  const copy = translations[locale.toLowerCase()];
  return Object.keys(english).filter(key => !copy?.[key]?.trim());
}

export function hasDiscussionUiTranslation(locale: string, text: string): boolean {
  return !!translations[locale.toLowerCase()]?.[text]?.trim();
}
