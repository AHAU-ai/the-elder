// lib/i18n/translations.ts
// All UI strings for The Elder — 10 languages

export type Locale =
  | "en"
  | "es"
  | "ki" // K'iche'
  | "fr"
  | "pt"
  | "de"
  | "da"
  | "nl"
  | "ja"
  | "zh";

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] =
  [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "es", label: "Spanish", nativeLabel: "Español" },
    { code: "ki", label: "K'iche'", nativeLabel: "K'iche'" },
    { code: "fr", label: "French", nativeLabel: "Français" },
    { code: "pt", label: "Portuguese", nativeLabel: "Português" },
    { code: "de", label: "German", nativeLabel: "Deutsch" },
    { code: "da", label: "Danish", nativeLabel: "Dansk" },
    { code: "nl", label: "Dutch", nativeLabel: "Nederlands" },
    { code: "ja", label: "Japanese", nativeLabel: "日本語" },
    { code: "zh", label: "Chinese", nativeLabel: "中文" },
  ];

export type TranslationKeys = {
  // Threshold page
  threshold_title: string;
  threshold_subtitle: string;
  threshold_enter: string;
  threshold_language_prompt: string;

  // Voice selection / lineage
  choose_voice: string;
  voice_description: string;

  // Chat / divination interface
  chat_placeholder: string;
  chat_send: string;
  chat_thinking: string;
  chat_begin: string;
  new_reading: string;
  back_to_threshold: string;

  // Reading sections
  reading_title: string;
  reading_loading: string;

  // Navigation / general
  nav_home: string;
  nav_about: string;
  nav_voices: string;

  // Footer / legal
  footer_note: string;

  // Errors
  error_generic: string;
  error_try_again: string;

  // Language toggle label
  select_language: string;
};

export const translations: Record<Locale, TranslationKeys> = {
  en: {
    threshold_title: "The Elder",
    threshold_subtitle:
      "A myth divination instrument rooted in the living traditions of the world.",
    threshold_enter: "Enter",
    threshold_language_prompt: "Choose your language",
    choose_voice: "Choose a Voice",
    voice_description:
      "Each voice divines from its own tradition's mythological field.",
    chat_placeholder: "Speak what is alive in you…",
    chat_send: "Send",
    chat_thinking: "The Elder listens…",
    chat_begin: "Begin",
    new_reading: "New Reading",
    back_to_threshold: "Return to Threshold",
    reading_title: "Your Reading",
    reading_loading: "The field is forming…",
    nav_home: "Home",
    nav_about: "About",
    nav_voices: "Voices",
    footer_note:
      "The Elder is a mythic instrument, not a substitute for professional counsel.",
    error_generic: "Something shifted in the field. Please try again.",
    error_try_again: "Try Again",
    select_language: "Language",
  },

  es: {
    threshold_title: "El Anciano",
    threshold_subtitle:
      "Un instrumento de adivinación mítica enraizado en las tradiciones vivas del mundo.",
    threshold_enter: "Entrar",
    threshold_language_prompt: "Elige tu idioma",
    choose_voice: "Elige una Voz",
    voice_description:
      "Cada voz adivina desde el campo mitológico de su propia tradición.",
    chat_placeholder: "Habla lo que vive en ti…",
    chat_send: "Enviar",
    chat_thinking: "El Anciano escucha…",
    chat_begin: "Comenzar",
    new_reading: "Nueva Lectura",
    back_to_threshold: "Volver al Umbral",
    reading_title: "Tu Lectura",
    reading_loading: "El campo está tomando forma…",
    nav_home: "Inicio",
    nav_about: "Acerca de",
    nav_voices: "Voces",
    footer_note:
      "El Anciano es un instrumento mítico, no un sustituto del consejo profesional.",
    error_generic: "Algo se movió en el campo. Por favor intenta de nuevo.",
    error_try_again: "Intentar de Nuevo",
    select_language: "Idioma",
  },

  ki: {
    threshold_title: "Ri Mam",
    threshold_subtitle:
      "Jun instrumento taq ch'ab'al ri tijonïk chirij ri ajawarem ri kek'oji' pa ronojel uwächulew.",
    threshold_enter: "Okisaj",
    threshold_language_prompt: "Tixela' a ch'ab'al",
    choose_voice: "Tixela' Jun Tz'ikin Ch'ab'al",
    voice_description:
      "Ronojel tz'ikin ch'ab'al k'ax chupam ri b'anob'al taq tijonïk ruk'in.",
    chat_placeholder: "Titz'ib'aj ri kek'oji' pa a ch'ichu'l…",
    chat_send: "Tiya'",
    chat_thinking: "Ri Mam kachomaj…",
    chat_begin: "Tiq'axow",
    new_reading: "Jun K'ak' Tzijonem",
    back_to_threshold: "Tib'e pa ri K'ojlib'al",
    reading_title: "A Tzijonem",
    reading_loading: "Ri q'atb'al taq tzij kitz'aqatisaj…",
    nav_home: "Uchoq'ab'",
    nav_about: "Uwach'alal",
    nav_voices: "Tz'ikin Ch'ab'al",
    footer_note:
      "Ri Mam jun instrumento ajawarem, man b'a' jun q'alajisaj ri tijonïk ajk'amol b'e.",
    error_generic: "K'ax kitz'aqatisaj ri q'atb'al. Tiq'axow chik.",
    error_try_again: "Tiq'axow Chik",
    select_language: "Ch'ab'al",
  },

  fr: {
    threshold_title: "L'Ancien",
    threshold_subtitle:
      "Un instrument de divination mythique enraciné dans les traditions vivantes du monde.",
    threshold_enter: "Entrer",
    threshold_language_prompt: "Choisissez votre langue",
    choose_voice: "Choisir une Voix",
    voice_description:
      "Chaque voix devine depuis le champ mythologique de sa propre tradition.",
    chat_placeholder: "Exprimez ce qui vit en vous…",
    chat_send: "Envoyer",
    chat_thinking: "L'Ancien écoute…",
    chat_begin: "Commencer",
    new_reading: "Nouvelle Lecture",
    back_to_threshold: "Retourner au Seuil",
    reading_title: "Votre Lecture",
    reading_loading: "Le champ se forme…",
    nav_home: "Accueil",
    nav_about: "À Propos",
    nav_voices: "Voix",
    footer_note:
      "L'Ancien est un instrument mythique, pas un substitut au conseil professionnel.",
    error_generic:
      "Quelque chose a bougé dans le champ. Veuillez réessayer.",
    error_try_again: "Réessayer",
    select_language: "Langue",
  },

  pt: {
    threshold_title: "O Ancião",
    threshold_subtitle:
      "Um instrumento de adivinhação mítica enraizado nas tradições vivas do mundo.",
    threshold_enter: "Entrar",
    threshold_language_prompt: "Escolha o seu idioma",
    choose_voice: "Escolha uma Voz",
    voice_description:
      "Cada voz adivinha a partir do campo mitológico de sua própria tradição.",
    chat_placeholder: "Fale o que vive em você…",
    chat_send: "Enviar",
    chat_thinking: "O Ancião escuta…",
    chat_begin: "Começar",
    new_reading: "Nova Leitura",
    back_to_threshold: "Voltar ao Limiar",
    reading_title: "Sua Leitura",
    reading_loading: "O campo está se formando…",
    nav_home: "Início",
    nav_about: "Sobre",
    nav_voices: "Vozes",
    footer_note:
      "O Ancião é um instrumento mítico, não um substituto para aconselhamento profissional.",
    error_generic: "Algo se moveu no campo. Por favor, tente novamente.",
    error_try_again: "Tentar Novamente",
    select_language: "Idioma",
  },

  de: {
    threshold_title: "Der Älteste",
    threshold_subtitle:
      "Ein mythisches Divinations-Instrument verwurzelt in den lebendigen Traditionen der Welt.",
    threshold_enter: "Eintreten",
    threshold_language_prompt: "Wähle deine Sprache",
    choose_voice: "Wähle eine Stimme",
    voice_description:
      "Jede Stimme weissagt aus dem mythologischen Feld ihrer eigenen Tradition.",
    chat_placeholder: "Sprich, was in dir lebt…",
    chat_send: "Senden",
    chat_thinking: "Der Älteste lauscht…",
    chat_begin: "Beginnen",
    new_reading: "Neue Lesung",
    back_to_threshold: "Zurück zur Schwelle",
    reading_title: "Deine Lesung",
    reading_loading: "Das Feld nimmt Form an…",
    nav_home: "Startseite",
    nav_about: "Über uns",
    nav_voices: "Stimmen",
    footer_note:
      "Der Älteste ist ein mythisches Instrument, kein Ersatz für professionellen Rat.",
    error_generic:
      "Etwas hat sich im Feld verschoben. Bitte versuche es erneut.",
    error_try_again: "Erneut versuchen",
    select_language: "Sprache",
  },

  da: {
    threshold_title: "Den Ældste",
    threshold_subtitle:
      "Et mytisk divinations-instrument forankret i verdens levende traditioner.",
    threshold_enter: "Gå ind",
    threshold_language_prompt: "Vælg dit sprog",
    choose_voice: "Vælg en Stemme",
    voice_description:
      "Hver stemme spår fra sit eget traditionsbaserede mytologiske felt.",
    chat_placeholder: "Tal det, der lever i dig…",
    chat_send: "Send",
    chat_thinking: "Den Ældste lytter…",
    chat_begin: "Begynd",
    new_reading: "Ny Læsning",
    back_to_threshold: "Tilbage til Tærsklen",
    reading_title: "Din Læsning",
    reading_loading: "Feltet tager form…",
    nav_home: "Hjem",
    nav_about: "Om",
    nav_voices: "Stemmer",
    footer_note:
      "Den Ældste er et mytisk instrument, ikke en erstatning for professionel rådgivning.",
    error_generic: "Noget forskød sig i feltet. Prøv venligst igen.",
    error_try_again: "Prøv igen",
    select_language: "Sprog",
  },

  nl: {
    threshold_title: "De Oudste",
    threshold_subtitle:
      "Een mythisch divinatie-instrument geworteld in de levende tradities van de wereld.",
    threshold_enter: "Binnengaan",
    threshold_language_prompt: "Kies je taal",
    choose_voice: "Kies een Stem",
    voice_description:
      "Elke stem waarzegt vanuit het mythologische veld van haar eigen traditie.",
    chat_placeholder: "Spreek wat in jou leeft…",
    chat_send: "Verzenden",
    chat_thinking: "De Oudste luistert…",
    chat_begin: "Beginnen",
    new_reading: "Nieuwe Lezing",
    back_to_threshold: "Terug naar de Drempel",
    reading_title: "Jouw Lezing",
    reading_loading: "Het veld neemt vorm aan…",
    nav_home: "Thuis",
    nav_about: "Over",
    nav_voices: "Stemmen",
    footer_note:
      "De Oudste is een mythisch instrument, geen vervanging voor professioneel advies.",
    error_generic:
      "Er verschoof iets in het veld. Probeer het opnieuw.",
    error_try_again: "Opnieuw proberen",
    select_language: "Taal",
  },

  ja: {
    threshold_title: "長老",
    threshold_subtitle:
      "世界の生きた伝統に根ざした神話的占いの器。",
    threshold_enter: "入る",
    threshold_language_prompt: "言語を選択してください",
    choose_voice: "声を選ぶ",
    voice_description:
      "それぞれの声は、固有の伝統の神話的フィールドから占います。",
    chat_placeholder: "あなたの中に生きるものを語ってください…",
    chat_send: "送信",
    chat_thinking: "長老が耳を傾けています…",
    chat_begin: "始める",
    new_reading: "新しいリーディング",
    back_to_threshold: "入口に戻る",
    reading_title: "あなたのリーディング",
    reading_loading: "フィールドが形成されています…",
    nav_home: "ホーム",
    nav_about: "について",
    nav_voices: "声",
    footer_note:
      "長老は神話的な器であり、専門的な助言の代替ではありません。",
    error_generic:
      "フィールドで何かが変化しました。もう一度お試しください。",
    error_try_again: "再試行",
    select_language: "言語",
  },

  zh: {
    threshold_title: "长者",
    threshold_subtitle: "一件植根于世界各地活态传统的神话占卜器具。",
    threshold_enter: "进入",
    threshold_language_prompt: "选择您的语言",
    choose_voice: "选择一个声音",
    voice_description: "每个声音都从其自身传统的神话场域中进行占卜。",
    chat_placeholder: "说出活在您心中的……",
    chat_send: "发送",
    chat_thinking: "长者在聆听……",
    chat_begin: "开始",
    new_reading: "新的占卜",
    back_to_threshold: "返回门槛",
    reading_title: "您的占卜",
    reading_loading: "场域正在成形……",
    nav_home: "首页",
    nav_about: "关于",
    nav_voices: "声音",
    footer_note: "长者是一件神话器具，而非专业建议的替代品。",
    error_generic: "场域中有所变动。请重试。",
    error_try_again: "重试",
    select_language: "语言",
  },
};

// Helper: map Locale to a full language name for the AI system prompt
export const LOCALE_TO_LANGUAGE_NAME: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
  ki: "K'iche' Maya",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  da: "Danish",
  nl: "Dutch",
  ja: "Japanese",
  zh: "Simplified Chinese",
};

