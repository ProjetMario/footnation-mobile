// Content ported from the site's checked-in geography pages/data; no generated destinations.
/**
 * Localized intro/name for top international GEO destinations.
 * Pages without a translation entry fall back to the FR intro.
 */
import { SeoLocale } from "./locales";

interface LocalizedGeo {
  name?: string; // city display name in target locale
  intro: string;
  /** Localized H1; defaults to "Football in <name>". */
  h1?: string;
}

export const GEO_I18N: Record<
  string,
  Partial<Record<SeoLocale, LocalizedGeo>>
> = {
  paris: {
    en: {
      name: "Paris",
      intro:
        "Football in Paris is a dense ecosystem: amateur clubs, academies, professional teams (Paris Saint-Germain) and international football schools.",
      h1: "Football in Paris",
    },
    es: {
      name: "París",
      intro:
        "El fútbol en París es un ecosistema denso: clubes amateurs, centros de formación, equipos profesionales (Paris Saint-Germain) y academias internacionales.",
      h1: "Fútbol en París",
    },
    pt: {
      name: "Paris",
      intro:
        "O futebol em Paris é um ecossistema denso: clubes amadores, academias, equipas profissionais (Paris Saint-Germain) e escolas internacionais.",
      h1: "Futebol em Paris",
    },
    de: {
      name: "Paris",
      intro:
        "Fußball in Paris ist ein dichtes Ökosystem: Amateurvereine, Akademien, Profi-Teams (Paris Saint-Germain) und internationale Fußballschulen.",
      h1: "Fußball in Paris",
    },
    it: {
      name: "Parigi",
      intro:
        "Il calcio a Parigi è un ecosistema denso: club amatoriali, accademie, squadre professionistiche (Paris Saint-Germain) e scuole internazionali.",
      h1: "Calcio a Parigi",
    },
    ar: {
      name: "باريس",
      intro:
        "كرة القدم في باريس منظومة غنية: أندية هاوية، أكاديميات، فرق محترفة (باريس سان جيرمان) ومدارس دولية.",
      h1: "كرة القدم في باريس",
    },
  },
  londres: {
    en: {
      name: "London",
      intro:
        "London is the global epicenter of professional football, home to Arsenal, Chelsea, Tottenham, West Ham and dozens of academies and amateur clubs.",
      h1: "Football in London",
    },
    es: {
      name: "Londres",
      intro:
        "Londres es el epicentro mundial del fútbol profesional, hogar de Arsenal, Chelsea, Tottenham, West Ham y decenas de academias y clubes amateurs.",
      h1: "Fútbol en Londres",
    },
    pt: {
      name: "Londres",
      intro:
        "Londres é o epicentro mundial do futebol profissional, lar do Arsenal, Chelsea, Tottenham, West Ham e dezenas de academias e clubes amadores.",
      h1: "Futebol em Londres",
    },
    de: {
      name: "London",
      intro:
        "London ist das globale Epizentrum des Profifußballs — Heimat von Arsenal, Chelsea, Tottenham, West Ham und Dutzenden Akademien und Amateurvereinen.",
      h1: "Fußball in London",
    },
    it: {
      name: "Londra",
      intro:
        "Londra è l'epicentro mondiale del calcio professionistico, casa di Arsenal, Chelsea, Tottenham, West Ham e di decine di accademie e club amatoriali.",
      h1: "Calcio a Londra",
    },
    ar: {
      name: "لندن",
      intro:
        "لندن هي مركز كرة القدم الاحترافية في العالم: أرسنال، تشيلسي، توتنهام، وست هام وعشرات الأكاديميات والأندية الهاوية.",
      h1: "كرة القدم في لندن",
    },
  },
  madrid: {
    en: {
      name: "Madrid",
      intro:
        "Madrid hosts some of the world's biggest clubs — Real Madrid, Atlético — and a dense network of top-level youth academies.",
      h1: "Football in Madrid",
    },
    es: {
      name: "Madrid",
      intro:
        "Madrid alberga algunos de los mayores clubes del mundo — Real Madrid, Atlético — y una densa red de academias juveniles de alto nivel.",
      h1: "Fútbol en Madrid",
    },
    pt: {
      name: "Madrid",
      intro:
        "Madrid acolhe alguns dos maiores clubes do mundo — Real Madrid, Atlético — e uma densa rede de academias juvenis de alto nível.",
      h1: "Futebol em Madrid",
    },
    de: {
      name: "Madrid",
      intro:
        "Madrid beherbergt einige der größten Vereine der Welt — Real Madrid, Atlético — und ein dichtes Netzwerk an Top-Nachwuchsakademien.",
      h1: "Fußball in Madrid",
    },
    it: {
      name: "Madrid",
      intro:
        "Madrid ospita alcuni dei club più grandi al mondo — Real Madrid, Atlético — e una densa rete di accademie giovanili di altissimo livello.",
      h1: "Calcio a Madrid",
    },
    ar: {
      name: "مدريد",
      intro:
        "تحتضن مدريد بعضاً من أكبر أندية العالم — ريال مدريد وأتلتيكو — وشبكة كثيفة من أكاديميات الشباب عالية المستوى.",
      h1: "كرة القدم في مدريد",
    },
  },
  barcelone: {
    en: {
      name: "Barcelona",
      intro:
        "Barcelona is synonymous with elite football development — La Masia is one of the most respected academies on the planet.",
      h1: "Football in Barcelona",
    },
    es: {
      name: "Barcelona",
      intro:
        "Barcelona es sinónimo de formación de élite — La Masia es una de las academias más respetadas del mundo.",
      h1: "Fútbol en Barcelona",
    },
    pt: {
      name: "Barcelona",
      intro:
        "Barcelona é sinónimo de formação de elite — La Masia é uma das academias mais respeitadas do mundo.",
      h1: "Futebol em Barcelona",
    },
    de: {
      name: "Barcelona",
      intro:
        "Barcelona steht für Eliteausbildung — La Masia gehört zu den weltweit angesehensten Akademien.",
      h1: "Fußball in Barcelona",
    },
    it: {
      name: "Barcellona",
      intro:
        "Barcellona è sinonimo di formazione d'élite — La Masia è una delle accademie più rispettate al mondo.",
      h1: "Calcio a Barcellona",
    },
    ar: {
      name: "برشلونة",
      intro:
        "برشلونة مرادفة للتدريب النخبوي — أكاديمية لا ماسيا من أرقى أكاديميات العالم.",
      h1: "كرة القدم في برشلونة",
    },
  },
  berlin: {
    en: {
      name: "Berlin",
      intro:
        "Berlin connects grassroots, semi-pro and Bundesliga-level football in one of Europe's most respected football ecosystems.",
      h1: "Football in Berlin",
    },
    es: {
      name: "Berlín",
      intro:
        "Berlín conecta el fútbol de base, semi-profesional y de Bundesliga en uno de los ecosistemas más respetados de Europa.",
      h1: "Fútbol en Berlín",
    },
    pt: {
      name: "Berlim",
      intro:
        "Berlim liga futebol de base, semi-profissional e da Bundesliga num dos ecossistemas mais respeitados da Europa.",
      h1: "Futebol em Berlim",
    },
    de: {
      name: "Berlin",
      intro:
        "Berlin verbindet Amateur-, Halbprofi- und Bundesliga-Fußball in einem der angesehensten Fußballökosysteme Europas.",
      h1: "Fußball in Berlin",
    },
    it: {
      name: "Berlino",
      intro:
        "Berlino connette calcio di base, semi-professionistico e Bundesliga in uno degli ecosistemi più rispettati d'Europa.",
      h1: "Calcio a Berlino",
    },
    ar: {
      name: "برلين",
      intro:
        "برلين تربط بين كرة القدم القاعدية وشبه الاحترافية والبوندسليغا في منظومة من أكثر منظومات أوروبا احتراماً.",
      h1: "كرة القدم في برلين",
    },
  },
  milan: {
    en: {
      name: "Milan",
      intro:
        "Milan is a capital of Italian football with two historic clubs — AC Milan and Inter — and a deep tradition of youth development.",
      h1: "Football in Milan",
    },
    es: {
      name: "Milán",
      intro:
        "Milán es una capital del fútbol italiano con dos clubes históricos — AC Milan e Inter — y una profunda tradición de formación.",
      h1: "Fútbol en Milán",
    },
    pt: {
      name: "Milão",
      intro:
        "Milão é uma capital do futebol italiano com dois clubes históricos — AC Milan e Inter — e uma tradição profunda de formação.",
      h1: "Futebol em Milão",
    },
    de: {
      name: "Mailand",
      intro:
        "Mailand ist eine Hauptstadt des italienischen Fußballs mit zwei historischen Vereinen — AC Mailand und Inter — und einer tiefen Nachwuchstradition.",
      h1: "Fußball in Mailand",
    },
    it: {
      name: "Milano",
      intro:
        "Milano è una capitale del calcio italiano con due club storici — Milan e Inter — e una profonda tradizione formativa.",
      h1: "Calcio a Milano",
    },
    ar: {
      name: "ميلان",
      intro:
        "ميلان عاصمة للكرة الإيطالية مع ناديين تاريخيين — ميلان وإنتر — وتقليد عميق في تكوين الناشئين.",
      h1: "كرة القدم في ميلان",
    },
  },
  rome: {
    en: {
      name: "Rome",
      intro:
        "Rome cultivates a passionate football culture, from Serie A clubs (AS Roma, Lazio) to vibrant youth academies.",
      h1: "Football in Rome",
    },
    es: {
      name: "Roma",
      intro:
        "Roma cultiva una cultura futbolística apasionada, desde clubes de Serie A (Roma, Lazio) hasta vibrantes academias juveniles.",
      h1: "Fútbol en Roma",
    },
    pt: {
      name: "Roma",
      intro:
        "Roma cultiva uma cultura futebolística apaixonada, de clubes da Serie A (Roma, Lazio) a vibrantes academias juvenis.",
      h1: "Futebol em Roma",
    },
    de: {
      name: "Rom",
      intro:
        "Rom pflegt eine leidenschaftliche Fußballkultur — von Serie-A-Clubs (Roma, Lazio) bis zu lebendigen Nachwuchsakademien.",
      h1: "Fußball in Rom",
    },
    it: {
      name: "Roma",
      intro:
        "Roma coltiva una cultura calcistica appassionata, dai club di Serie A (Roma, Lazio) alle vivaci accademie giovanili.",
      h1: "Calcio a Roma",
    },
    ar: {
      name: "روما",
      intro:
        "تحتضن روما ثقافة كروية متحمسة من أندية السيري آيه (روما، لاتسيو) إلى أكاديميات شبان نابضة.",
      h1: "كرة القدم في روما",
    },
  },
  "new-york": {
    en: {
      name: "New York",
      intro:
        "New York is a fast-growing American soccer hub with MLS clubs, NWSL teams and a booming amateur and youth scene.",
      h1: "Soccer in New York",
    },
    es: {
      name: "Nueva York",
      intro:
        "Nueva York es un hub de fútbol americano en plena expansión, con clubes de MLS, equipos de la NWSL y una escena amateur y juvenil floreciente.",
      h1: "Fútbol en Nueva York",
    },
    pt: {
      name: "Nova Iorque",
      intro:
        "Nova Iorque é um polo do futebol americano em rápida expansão, com clubes da MLS, equipas da NWSL e uma cena amadora e juvenil em forte crescimento.",
      h1: "Futebol em Nova Iorque",
    },
    de: {
      name: "New York",
      intro:
        "New York ist ein rasch wachsender Soccer-Hub mit MLS-Clubs, NWSL-Teams und einer boomenden Amateur- und Nachwuchsszene.",
      h1: "Fußball in New York",
    },
    it: {
      name: "New York",
      intro:
        "New York è un hub del calcio americano in rapida crescita, con club della MLS, squadre della NWSL e una scena amatoriale e giovanile in espansione.",
      h1: "Calcio a New York",
    },
    ar: {
      name: "نيويورك",
      intro:
        "نيويورك مركزٌ كروي أمريكي ينمو بسرعة، مع أندية MLS وفرق NWSL ومشهد هاوي وشبابي مزدهر.",
      h1: "كرة القدم في نيويورك",
    },
  },
  tokyo: {
    en: {
      name: "Tokyo",
      intro:
        "Tokyo is the center of Japanese football, home to the J.League and academies increasingly connected to Europe.",
      h1: "Football in Tokyo",
    },
    es: {
      name: "Tokio",
      intro:
        "Tokio es el centro del fútbol japonés, sede de la J.League y academias cada vez más conectadas con Europa.",
      h1: "Fútbol en Tokio",
    },
    pt: {
      name: "Tóquio",
      intro:
        "Tóquio é o centro do futebol japonês, sede da J.League e academias cada vez mais conectadas com a Europa.",
      h1: "Futebol em Tóquio",
    },
    de: {
      name: "Tokio",
      intro:
        "Tokio ist das Zentrum des japanischen Fußballs, Heimat der J.League und Akademien, die zunehmend mit Europa verbunden sind.",
      h1: "Fußball in Tokio",
    },
    it: {
      name: "Tokyo",
      intro:
        "Tokyo è il centro del calcio giapponese, sede della J.League e accademie sempre più connesse all'Europa.",
      h1: "Calcio a Tokyo",
    },
    ar: {
      name: "طوكيو",
      intro:
        "طوكيو مركز كرة القدم اليابانية، موطئ J.League وأكاديميات تتصل بأوروبا بوتيرة متزايدة.",
      h1: "كرة القدم في طوكيو",
    },
  },
  "sao-paulo": {
    en: {
      name: "São Paulo",
      intro:
        "São Paulo is a cradle of Brazilian football, home to historic clubs like Corinthians, Palmeiras and São Paulo FC.",
      h1: "Football in São Paulo",
    },
    es: {
      name: "São Paulo",
      intro:
        "São Paulo es un crisol del fútbol brasileño, hogar de clubes históricos como Corinthians, Palmeiras y São Paulo FC.",
      h1: "Fútbol en São Paulo",
    },
    pt: {
      name: "São Paulo",
      intro:
        "São Paulo é um berço do futebol brasileiro, lar de clubes históricos como Corinthians, Palmeiras e São Paulo FC.",
      h1: "Futebol em São Paulo",
    },
    de: {
      name: "São Paulo",
      intro:
        "São Paulo ist eine Wiege des brasilianischen Fußballs, Heimat historischer Vereine wie Corinthians, Palmeiras und São Paulo FC.",
      h1: "Fußball in São Paulo",
    },
    it: {
      name: "San Paolo",
      intro:
        "San Paolo è una culla del calcio brasiliano, casa di club storici come Corinthians, Palmeiras e São Paulo FC.",
      h1: "Calcio a San Paolo",
    },
    ar: {
      name: "ساو باولو",
      intro:
        "ساو باولو مهد كرة القدم البرازيلية، موطئ أندية تاريخية مثل كورينثيانز، بالميراس وساو باولو.",
      h1: "كرة القدم في ساو باولو",
    },
  },
  "le-caire": {
    en: {
      name: "Cairo",
      intro:
        "Cairo is the capital of Egyptian and African football, home to Al Ahly and Zamalek, the two most decorated clubs on the continent.",
      h1: "Football in Cairo",
    },
    es: {
      name: "El Cairo",
      intro:
        "El Cairo es la capital del fútbol egipcio y africano, hogar de Al Ahly y Zamalek, los dos clubes más laureados del continente.",
      h1: "Fútbol en El Cairo",
    },
    pt: {
      name: "Cairo",
      intro:
        "Cairo é a capital do futebol egípcio e africano, lar do Al Ahly e Zamalek, os dois clubes mais titulados do continente.",
      h1: "Futebol no Cairo",
    },
    de: {
      name: "Kairo",
      intro:
        "Kairo ist die Hauptstadt des ägyptischen und afrikanischen Fußballs, Heimat von Al Ahly und Zamalek, den beiden erfolgreichsten Vereinen des Kontinents.",
      h1: "Fußball in Kairo",
    },
    it: {
      name: "Il Cairo",
      intro:
        "Il Cairo è la capitale del calcio egiziano e africano, casa di Al Ahly e Zamalek, i due club più titolati del continente.",
      h1: "Calcio al Cairo",
    },
    ar: {
      name: "القاهرة",
      intro:
        "القاهرة عاصمة كرة القدم المصرية والأفريقية، موطئ الأهلي والزمالك، أكثر ناديين تتويجًا في القارة.",
      h1: "كرة القدم في القاهرة",
    },
  },
  riyad: {
    en: {
      name: "Riyadh",
      intro:
        "Riyadh is the center of rapidly transforming Saudi football, with Al-Hilal, Al-Nassr and the arrival of global superstars.",
      h1: "Football in Riyadh",
    },
    es: {
      name: "Riad",
      intro:
        "Riad es el centro del fútbol saudí en plena transformación, con Al-Hilal, Al-Nassr y la llegada de estrellas mundiales.",
      h1: "Fútbol en Riad",
    },
    pt: {
      name: "Riade",
      intro:
        "Riade é o centro do futebol saudita em rápida transformação, com Al-Hilal, Al-Nassr e a chegada de estrelas mundiais.",
      h1: "Futebol em Riade",
    },
    de: {
      name: "Riad",
      intro:
        "Riad ist das Zentrum des sich rasch wandelnden saudischen Fußballs, mit Al-Hilal, Al-Nassr und der Ankunft weltweiter Superstars.",
      h1: "Fußball in Riad",
    },
    it: {
      name: "Riyad",
      intro:
        "Riyad è il centro del calcio saudita in rapida trasformazione, con Al-Hilal, Al-Nassr e l'arrivo di superstar mondiali.",
      h1: "Calcio a Riyad",
    },
    ar: {
      name: "الرياض",
      intro:
        "الرياض مركز كرة القدم السعودية المتغيرة بسرعة، مع الهلال والنصر وقدوم نجوم عالميين.",
      h1: "كرة القدم في الرياض",
    },
  },
  mumbai: {
    en: {
      name: "Mumbai",
      intro:
        "Mumbai is India's football hub, with the Indian Super League and a rapidly growing pool of young talent.",
      h1: "Football in Mumbai",
    },
    es: {
      name: "Bombay",
      intro:
        "Bombay es el hub de fútbol de la India, con la Indian Super League y un creciente talento joven.",
      h1: "Fútbol en Bombay",
    },
    pt: {
      name: "Bombaim",
      intro:
        "Bombaim é o hub de futebol da Índia, com a Indian Super League e um crescente talento jovem.",
      h1: "Futebol em Bombaim",
    },
    de: {
      name: "Mumbai",
      intro:
        "Mumbai ist die Fußball-Drehscheibe Indiens, mit der Indian Super League und einem schnell wachsenden Talentpool.",
      h1: "Fußball in Mumbai",
    },
    it: {
      name: "Mumbai",
      intro:
        "Mumbai è l'hub del calcio indiano, con l'Indian Super League e un pool di giovani talenti in rapida crescita.",
      h1: "Calcio a Mumbai",
    },
    ar: {
      name: "مومباي",
      intro:
        "مومباي مركز كرة القدم الهندي، مع دوري السوبر الهندي ومجموعة متزايدة من المواهب الشابة.",
      h1: "كرة القدم في مومباي",
    },
  },
  lagos: {
    en: {
      name: "Lagos",
      intro:
        "Lagos is a globally recognized Nigerian football talent pool, with academies that feed Europe's biggest clubs.",
      h1: "Football in Lagos",
    },
    es: {
      name: "Lagos",
      intro:
        "Lagos es un vivero de talento nigeriano reconocido mundialmente, con academias que abastecen a los grandes clubes europeos.",
      h1: "Fútbol en Lagos",
    },
    pt: {
      name: "Lagos",
      intro:
        "Lagos é um celeiro de talento nigeriano reconhecido mundialmente, com academias que alimentam os maiores clubes europeus.",
      h1: "Futebol em Lagos",
    },
    de: {
      name: "Lagos",
      intro:
        "Lagos ist ein weltweit anerkannter Pool nigerianischer Fußballtalente, mit Akademien, die die größten europäischen Vereine versorgen.",
      h1: "Fußball in Lagos",
    },
    it: {
      name: "Lagos",
      intro:
        "Lagos è un vivai di talento nigeriano riconosciuto a livello mondiale, con accademie che alimentano i più grandi club europei.",
      h1: "Calcio a Lagos",
    },
    ar: {
      name: "لاغوس",
      intro:
        "لاغوس معقل مواهب نيجيرية معترف بها عالميًا، مع أكاديميات تغذي أكبر الأندية الأوروبية.",
      h1: "كرة القدم في لاغوس",
    },
  },
  "buenos-aires": {
    en: {
      name: "Buenos Aires",
      intro:
        "Buenos Aires is the temple of Argentine football, birthplace of legendary clubs like Boca Juniors and River Plate.",
      h1: "Football in Buenos Aires",
    },
    es: {
      name: "Buenos Aires",
      intro:
        "Buenos Aires es el templo del fútbol argentino, cuna de clubes legendarios como Boca Juniors y River Plate.",
      h1: "Fútbol en Buenos Aires",
    },
    pt: {
      name: "Buenos Aires",
      intro:
        "Buenos Aires é o templo do futebol argentino, berço de clubes lendários como Boca Juniors e River Plate.",
      h1: "Futebol em Buenos Aires",
    },
    de: {
      name: "Buenos Aires",
      intro:
        "Buenos Aires ist der Tempel des argentinischen Fußballs, Geburtsort legendärer Vereine wie Boca Juniors und River Plate.",
      h1: "Fußball in Buenos Aires",
    },
    it: {
      name: "Buenos Aires",
      intro:
        "Buenos Aires è il tempio del calcio argentino, culla di club leggendari come Boca Juniors e River Plate.",
      h1: "Calcio a Buenos Aires",
    },
    ar: {
      name: "بوينوس آيرس",
      intro:
        "بوينوس آيرس معبد كرة القدم الأرجنتينية، مسقط رأس أندية أسطورية مثل بوكا جونيورز وريفر بليت.",
      h1: "كرة القدم في بوينوس آيرس",
    },
  },
  istanbul: {
    en: {
      name: "Istanbul",
      intro:
        "Istanbul bridges Europe and Asia with a devouring football passion, featuring Galatasaray, Fenerbahçe and Beşiktaş.",
      h1: "Football in Istanbul",
    },
    es: {
      name: "Estambul",
      intro:
        "Estambul une Europa y Asia con una pasión futbolística devoradora, con Galatasaray, Fenerbahçe y Beşiktaş.",
      h1: "Fútbol en Estambul",
    },
    pt: {
      name: "Istambul",
      intro:
        "Istambul une a Europa e a Ásia numa paixão futebolística voraz, com Galatasaray, Fenerbahçe e Beşiktaş.",
      h1: "Futebol em Istambul",
    },
    de: {
      name: "Istanbul",
      intro:
        "Istanbul verbindet Europa und Asien mit einer verschlingenden Fußball-Leidenschaft, mit Galatasaray, Fenerbahçe und Beşiktaş.",
      h1: "Fußball in Istanbul",
    },
    it: {
      name: "Istanbul",
      intro:
        "Istanbul unisce Europa e Asia in una passione calcistica divoratrice, con Galatasaray, Fenerbahçe e Beşiktaş.",
      h1: "Calcio a Istanbul",
    },
    ar: {
      name: "إسطنبول",
      intro:
        "إسطنبول جسر بين أوروبا وآسيا في شغف كروي آكل، مع غلطة سراي وفنربخشة وبشيكتاش.",
      h1: "كرة القدم في إسطنبول",
    },
  },
};

export function getLocalizedGeo(
  slug: string,
  locale: SeoLocale,
): LocalizedGeo | null {
  return GEO_I18N[slug]?.[locale] || null;
}
