import type { Locale } from '../../i18n';
import { normalize } from './catalog';
import { PROJECTS_PATH } from './project-context';
import {
  modelOverviewIds,
  moreQuestion,
  pitchQuestionLocale,
  repairReviewedSummaryText,
} from './reviewed-questions';
import type { SiteSubject } from './site-content';

const copy = {
  en: {
    casual: 'Not much. What do you wanna know about Timo or his work?',
    greeting:
      'Hey! I can tell you about Timo’s projects, work, or homelab. What are you curious about?',
    thanks: 'You’re welcome!',
    help: 'Ask me what Timo built, what he does at Abacus, or how he runs his homelab. Follow-up questions are welcome.',
    which: 'Which project or machine do you mean?',
    clarify: (options: string) => 'Which one did you mean? ' + options + '?',
    unknown: [
      'I don’t have that detail. You can ask me about one of Timo’s projects, his work, or his homelab.',
      'I’m not sure about that one. If you name the project or setup you’re interested in, I can look for something more specific.',
    ],
  },
  de: {
    casual: 'Nicht viel. Was willst du über Timo oder seine Arbeit wissen?',
    greeting:
      'Hey! Ich erzähle dir gern von Timos Projekten, seiner Arbeit oder seinem Homelab. Was interessiert dich?',
    thanks: 'Gern!',
    help: 'Frag mich, was Timo gebaut hat, was er bei Abacus macht oder wie er sein Homelab betreibt. Du kannst auch nachfragen.',
    which: 'Welches Projekt oder welchen Rechner meinst du?',
    clarify: (options: string) => 'Was davon meinst du? ' + options + '?',
    unknown: [
      'Das Detail habe ich gerade nicht. Frag mich gern nach Timos Projekten, seiner Arbeit oder seinem Homelab.',
      'Da bin ich mir nicht sicher. Wenn du das Projekt oder den Rechner nennst, kann ich gezielter suchen.',
    ],
  },
};

const greeting =
  /^(?:hey|hi|hello|yo|hallo|moin|hoi|servus)(?: there| zusammen)?$/;
const casual =
  /^(?:(?:yo|hey|hi|hallo) )?(?:what s up|whats up|what up|wassup|sup|how (?:are you|s it going)|wie geht s|wie geht es dir|was geht|alles klar)$/;
const thanks =
  /^(?:thanks|thank you|cheers|cool|nice|great|thanks a lot|vielen dank|danke(?: schoen| dir)?|super)(?: very much| that helps| das hilft)?$/;
const thanksAfterConfirmation =
  /^(?:(?:ah|oh|ach) )?(?:(?:yes|yeah|yep|ja) )?(?:that ?s (?:exactly )?what i meant |(?:genau )?das meinte ich )?(?:thanks(?: a lot)?|thank you(?: very much)?|danke(?: dir| schoen)?|vielen dank)$/;
const help =
  /^(?:what can (?:you do|i ask(?: you)?|you help(?: me)? with)|what do you know|who are you|(?:can|could|would) you (?:please )?help(?: me)?(?: please)?|(?:i need )?help|was kannst du|was kann ich (?:dich )?fragen|wer bist du|(?:(?:wo(?:bei|mit)|wie) )?(?:kannst|koenntest) du (?:mir )?(?:bitte )?helfen|(?:ich brauche )?hilfe)$/;
export { moreQuestion };
export const languageQuestion =
  /^(?:(?:programming )?lang(?:ua|au)ges?|(?:programmier)?sprachen?|(?:in )?(?:what|which) (?:programming )?lang(?:ua|au)ges?(?: (?:does (?:it )?)?use| (?:is|was) (?:it )?(?:written|built) in| was used for)?|(?:welche[nr]?|in welcher) (?:programmier)?sprachen?(?: (?:nutzt|verwendet|geschrieben|ist geschrieben)(?: es)?)?)$/;
const countQuestion =
  /^(?:how many (?:letters? )?["'“‘]?(\p{L})["'”’]?s? (?:are |are there )?in|wie viele (?:buchstaben )?["'„]?(\p{L})["'“]? (?:sind |gibt es )?in)(?: the word| dem wort| im wort)?\s+["'“‘„]?(\p{L}+)["'”’“]?[?.!]*$/iu;
const ambiguousShortFragment = /^[\p{L}\p{N}_-]{1,4}$/u;

export function questionLocale(question: string, fallback: Locale): Locale {
  const text = normalize(question);
  const pitchLocale = pitchQuestionLocale(text);
  if (pitchLocale) return pitchLocale;
  if (text === 'mehr') return 'de';
  // One-word fragments are often project names, labels, or continuation prompts.
  // Let conversation state decide unless the word itself is a clear sentence cue.
  if (ambiguousShortFragment.test(text) && text !== 'work') return fallback;
  const leadingGerman =
    /^(?:wann|wozu|warum|woran|womit|wofuer|wie|wer|welche[nr]?|nutzt|verwendet|verhindert|gib|fanden|kostet|hat|macht|ist|sind|war|wird|kann|kannst)\b/u;
  const leadingEnglish =
    /^(?:what|which|where|when|who|why|how|can|could|did|do|does|is|are|were|would|will|has|have|tell|show|please|ignore|open)\b/u;
  const startsGerman = leadingGerman.test(text);
  const startsEnglish =
    leadingEnglish.test(text) && !/^open source\b/.test(text);
  if (startsGerman !== startsEnglish) return startsGerman ? 'de' : 'en';
  if (/^was (?:the|this|that|it|he|she|there)\b/.test(text)) return 'en';
  // English past-tense questions invert the auxiliary and subject; a following
  // English article is a strong signal that "Was" is not German "what".
  if (/^was [\p{L}\p{N}_-]+ (?:a|an|the)\b/u.test(text)) return 'en';
  if (
    /^was [\p{L}\p{N}_-]+ (?:built|written|made|created|designed|developed|used|based|run) (?:in|by|from)\b/u.test(
      text,
    )
  )
    return 'en';
  if (
    /^was (?:kostet|hat|macht|nutzt|verwendet|ist|sind|war|wird|kann|kannst|bedeutet|enthaelt|zeigt|erzaehlt|verhindert)\b/.test(
      text,
    )
  )
    return 'de';
  if (text === 'was') return fallback;
  if (/^(?:bitte )?laenger(?: bitte)?$/.test(text)) return 'de';
  if (text === 'longer') return 'en';
  const german =
    /^war /.test(text) ||
    /^was (?:kostet|hat|macht|nutzt|verwendet|ist|sind|war|wird|kann|kannst|bedeutet|enthaelt|zeigt|erzaehlt)\b/.test(
      text,
    ) ||
    /\b(?:wie|wo|woran|wofuer|warum|wer|welch\w*|ist|hast|hat|kann\w*|erzaehl\w*|zeig\w*|danke|hallo|heiss\w*|beitraege|haustier\w*|katzen?|sprachen?|berufserfahrung(?:en)?|werdegang|maennlich|weiblich|geschlecht|kater|andere|weitere|fruehere|fass(?:e)?|noch|dieses|ausbildung|freizeit|schwaechen|lebenslauf|spannendes|interessantes|kurzprofil|projekte|arbeit|zusammenfassung|ausfuehrlicher)\b/.test(
      text,
    );
  const english =
    text === 'work' ||
    /\b(?:(?:short|quick|brief) (?:pitch|intro|bio)|what|whats|which|where|when|who|why|how|does|tell|show|have|are|please|thanks|thank|hello|called|languages?|langauges?|cats?|pets?|his|any|more|summary|summari[sz]e|experience|colou?rs?|male|female|gender|other|different|education|leisure|hobbies|downsides|perks|interesting|projects)\b/.test(
      text,
    );
  if (german === english) {
    const repaired = repairReviewedSummaryText(text);
    return repaired === text ? fallback : questionLocale(repaired, fallback);
  }
  return german ? 'de' : 'en';
}

export function socialReply(question: string, locale: Locale) {
  const count = countQuestion.exec(question.normalize('NFC'));
  if (count) {
    const letter = (count[1] ?? count[2]).toLocaleLowerCase(locale);
    const word = count[3];
    const total = Array.from(word.toLocaleLowerCase(locale)).filter(
      (item) => item === letter,
    ).length;
    return locale === 'de'
      ? `In „${word}“ kommt „${letter}“ ${total}-mal vor.`
      : `“${word}” has ${total} ${letter}${total === 1 ? '' : '’s'}.`;
  }
  const text = normalize(question);
  if (casual.test(text)) return copy[locale].casual;
  if (greeting.test(text)) return copy[locale].greeting;
  if (thanks.test(text) || thanksAfterConfirmation.test(text))
    return copy[locale].thanks;
  if (help.test(normalize(removeChatPrefix(question))))
    return copy[locale].help;
  return null;
}

export function removeChatPrefix(question: string) {
  return question.replace(
    /^(?:hey|hi|hello|yo|hallo|moin|hoi|servus|thanks|thank you|danke(?: dir)?)[,!]\s+/i,
    '',
  );
}

export function followUp(question: string) {
  const prefix =
    /^(?:and(?: what about)?|what about|how about|und(?: wie sieht es mit)?|wie sieht es mit)\s+/i;
  const text = normalize(question);
  if (modelOverviewIds(text)) return null;
  const refersBack =
    /^(?:what are they called|wie heissen sie)$/.test(text) ||
    /\b(?:its|their|it|dessen|deren|seine[rmn]?|ihre[rmn]?|es)\b/.test(text) ||
    (/\ber\b/.test(text) &&
      /\b(?:cpu|gpu|ram|prozessor|grafikkarte|arbeitsspeicher)\b/.test(text));
  if (
    !prefix.test(question) &&
    !refersBack &&
    !moreQuestion.test(text) &&
    !languageQuestion.test(text)
  )
    return null;
  return question.replace(prefix, '');
}

export function subjectCorrection(answer: string) {
  const text = normalize(answer);
  return (
    /^(?:i mean|ich meine) (.+)$/.exec(text)?.[1] ??
    /^(.+) (?:i mean|meine ich)$/.exec(text)?.[1]
  );
}

export function pickSubject(answer: string, subjects: SiteSubject[]) {
  const name = (subjectCorrection(answer) ?? normalize(answer)).replace(
    /^(?:the|der|die|das|den) /,
    '',
  );
  const matches = subjects.filter(({ label }) => normalize(label) === name);
  if (matches.length === 1) return matches[0];
  if (
    /^(?:(?:more about )?(?:this|that) project|(?:mehr ueber )?dieses projekt)$/.test(
      name,
    ) &&
    subjects.some(({ href }) => href === PROJECTS_PATH)
  ) {
    const named = subjects.filter(({ href }) => href !== PROJECTS_PATH);
    if (named.length === 1) return named[0];
  }
}

export function clarification(locale: Locale, labels: string[]) {
  if (labels.length < 2) return copy[locale].which;
  const names = new Intl.ListFormat(locale, { type: 'disjunction' }).format(
    labels,
  );
  return copy[locale].clarify(names);
}

export function unknownReply(locale: Locale, index: number) {
  const replies = copy[locale].unknown;
  return replies[index % replies.length];
}
