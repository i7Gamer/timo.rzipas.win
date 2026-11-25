import type { Locale } from '../../i18n';
import { facts, MAX_CLAIMS, normalize, type MissingDetail } from './catalog.ts';
import type { ChatTurn } from './history.ts';

type ReviewedAnswer = {
  ids: readonly string[];
  partial?: true;
  missing?: MissingDetail;
};

const spotifyTracker = /\b(?:spotify ?tracker|spotify stats tracker)\b/;
const lastFm = /\blast fm\b/;
const tutto = /\btutto\b/;
const otto = /\b(?:ask otto|otto|coach|spielhilfe)\b/;
const stadler = /\bstadler\b/;
const hearthcoil = /\bhearthcoil\b/;
const myspeed = /\bmyspeed\b/;
const carini = /\bcarini\b/;
const monthlyBilling = /\b(?:monthly (?:billing|invoicing)|monatsabrechnung)\b/;
const forecast = /\b(?:predict\w*|forecast\w*|vorhersag\w*|prognostiz\w*)\b/;
const genreCount =
  /\b(?:how many genres|number of genres|wie viele genres|anzahl der genres)\b/;
const kniffel = /\bkniffel\b/;

export const moreQuestion =
  /^(?:(?:that ?s the same(?: again)?|you already said that|das hast du schon gesagt) )?(?:(?:can you )?tell me more|(?:anything|any|what) (?:else|more)|(?:any |some )?more (?:details?|information)|more|erzaehl mir mehr|(?:sonst )?noch (?:etwas|was|mehr)|(?:noch )?(?:mehr|weitere) (?:details|infos))$/;

export function asksAboutAICoding(terms: string) {
  return (
    /\b(?:ai|ki|llm|sprachmodell|artificial intelligence|kuenstliche intelligenz|claude|codex)\b/.test(
      terms,
    ) &&
    /\b(?:code|coded|coding|programming|wrote|written|geschrieben|programmier\w*|develop\w*|entwickl\w*|implement\w*|build|built|bauen|gebaut)\b/.test(
      terms,
    )
  );
}

export function reviewedFactId(terms: string) {
  if (spotifyTracker.test(terms) && lastFm.test(terms)) {
    const purpose = terms
      .replace(spotifyTracker, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (
      /^(?:why (?:does )?use last fm|what does last fm (?:add|contribute|provide)(?: (?:to|for)(?: the)?)?|what role does last fm play in|warum (?:nutzt|verwendet) last fm|wozu dient last fm(?: bei| in)?)$/.test(
        purpose,
      )
    )
      return 'spotify-enrichment';
  }

  if ((tutto.test(terms) || /\bask otto\b/.test(terms)) && otto.test(terms)) {
    const move = terms
      .replace(/\b(?:in|bei) tutto\b/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (
      /^(?:how does (?:ask otto|otto|the coach) (?:(?:calculate|choose|work out) (?:its recommendations?|a move|its suggested move)|decide (?:which move to recommend|what to suggest))|wie (?:berechnet|ermittelt|waehlt) (?:ask otto|otto|die spielhilfe) (?:seine empfehlungen|einen zugvorschlag|einen zug))$/.test(
        move,
      )
    )
      return 'tutto-coach';
  }

  const work = terms
    .replace(/\b(?:at|bei) stadler\b/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    /^(?:what (?:(?:did (?:timo|he|you) (?:build|make|develop))|(?:has (?:timo|he) built)|have you built) with (?:c sharp and sql|sql and c sharp)|was hat (?:timo|er) mit (?:c sharp und sql|sql und c sharp) (?:entwickelt|gebaut|programmiert))$/.test(
      work,
    )
  )
    return 'stadler-plugins';
}

const petTopic = /\b(?:pets?|cats?|haustiere?|katzen?)\b/;
const catName = /\b(?:rudi|georgi|benji)\b/;
const petDetails = /\b(?:breeds?|colou?rs?|coats?|rassen?|fell\w*|farben?)\b/;
const petNames = /\b(?:names?|called|heiss\w*|namen?)\b/;
const petKinds =
  /^(?:what kind(?: of)?(?: (?:cats?|pets?)(?: does (?:he|timo) have)?)?|what kind are they|was fuer(?: (?:katzen|haustiere)(?: hat (?:er|timo))?)?|welche art (?:katzen|haustiere))$/;
const petSex =
  /\b(?:male|female|boys?|girls?|sex|gender|maennlich\w*|weiblich\w*|kater|geschlecht)\b/;
const exactBreed =
  /\b(?:exact|exactly|registered|subtype|genaue[rns]?|registriert\w*|zuchttyp)\b/;
const unsupportedPetDetail =
  /\b(?:photos?|pictures?|images?|videos?|fotos?|bilder?|ages?|how old|wie alt|living arrangements|adopt\w*|tierarzt\w*|medicat\w*)\b/;

export function hasPetSubject(terms: string) {
  return petTopic.test(terms) || catName.test(terms);
}

export const PET_DETAIL_IDS = [
  'about.cats.rudi',
  'about.cats.georgi',
  'about.cats.benji',
] as const;

export const WORK_EXPERIENCE_IDS = [
  'abacus-workflow',
  'stadler-vpn',
  'stadler-plugins',
] as const;

export function asksAboutOtherCats(terms: string) {
  return /^(?:(?:what (?:are|about) )?(?:(?:colou?rs?|coats?|breeds?) (?:of )?)?(?:the )?other (?:two|2)(?: (?:cats|pets))?|(?:(?:welche )?(?:farben?|fellfarben?|rassen?) (?:haben |der )?)?(?:die )?anderen (?:zwei|2)(?: katzen)?)$/.test(
    terms,
  );
}

export function isShortPetFollowUp(terms: string) {
  return (
    /^(?:names?|their names|called|colou?rs?|coats?|breeds?|namen?|ihre namen|farben?|fellfarben?|rassen?|sex|gender|geschlecht)$/.test(
      terms,
    ) ||
    petKinds.test(terms) ||
    (petSex.test(terms) &&
      /\b(?:they|he|she|sie|er|all three|alle drei)\b/.test(terms)) ||
    asksAboutOtherCats(terms)
  );
}

function asksPetDetails(terms: string) {
  return /^(?:(?:(?:any|some|more) (?:details?|information)|tell me more) (?:about|on) (?:timo s |his |the )?(?:cats?|pets?)|(?:more details|anything else|tell me more) (?:pets?|cats?)|(?:mehr|weitere|irgendwelche) (?:details|infos?|informationen) (?:ueber|zu) (?:timos |seine[nr]? |den )?(?:katzen?|haustiere?n?)|(?:mehr details|noch etwas) (?:katzen?|haustiere?))$/.test(
    terms,
  );
}

const englishWorkSummary =
  /^(?:(?:(?:can|could|would) you )?(?:please )?(?:(?:give me|show me|provide(?: me)?) (?:a |an )?(?:brief |quick )?(?:summary|overview|rundown) of|summari[sz]e|sum up)|(?:a )?(?:summary|overview) of) (?:his |your |timo s )?(?:work(?: experience)?|professional experience|career(?: history)?)$/;
const germanWorkSummary =
  /^(?:(?:(?:gib mir|erstelle(?: mir)?|zeig mir) )?(?:eine )?(?:kurze )?(?:zusammenfassung|uebersicht) (?:(?:von|ueber) )?(?:seiner |seine |seinen |timos |deine[rn]? )?(?:arbeit|berufserfahrung|beruflichen werdegang)|fass(?:e)? (?:mir )?(?:seine |timos |deine )?(?:arbeit|berufserfahrung) zusammen)$/;

const jobTitles =
  /^(?:(?:what|which) (?:jobs?|roles?|positions?|job titles?) (?:did|does|has|have) (?:timo|he|you) (?:have|had|hold|held)|(?:what|which) (?:were|are) (?:his|timo s|your) (?:roles?|job titles?)|welche (?:rollen?|stellen|positionen) (?:hatte|hat|hattest|hast) (?:timo|er|du))$/;

const educationOverview =
  /^(?:(?:tell me about |what is |what s )?(?:his |timo s |your )?education(?:al background)?|what did (?:timo|he|you) study|(?:timos |seine )?ausbildung|was hat (?:er|timo) studiert)$/;
const educationProjects =
  /^(?:education projects|what else about (?:his|timo s|your) education|(?:what|which) projects did (?:he|timo|you) (?:build|do) (?:during (?:his|your) studies|at school)|projekte waehrend (?:der|seiner) ausbildung)$/;
const leisure =
  /^(?:(?:timo s |his )?(?:leisure|hobbies|spare time|freizeit)|what does (?:he|timo) do (?:for fun|in his (?:spare|free) time)|was macht (?:er|timo) in seiner freizeit)$/;
const homelabMotivation =
  /^(?:homelab motivation|motivation (?:for|fuer) (?:the |his |timos )?home ?lab|why (?:(?:does|did) (?:timo|he)|do you) (?:self host|run (?:a|his|your) home ?lab)|warum (?:betreibt (?:timo|er) (?:ein|sein) home ?lab|hostet (?:timo|er) selbst))$/;
const hiring =
  /^(?:why (?:should|would) (?:i|we) hire (?:him|you|timo(?: rzipa)?)|warum sollte(?:n)? (?:ich|wir) (?:ihn|dich|timo(?: rzipa)?) einstellen)$/;
const perks = /^(?:perks|vorteile)$/;
const publicTimeline =
  /^(?:(?:no )?(?:info|information) (?:about|for) |what (?:happened|did (?:timo|he) do|was (?:timo|he) doing) (?:in|from) |(?:keine )?(?:infos?|informationen) (?:zu|ueber) |was (?:machte|tat) (?:er|timo) (?:von|zwischen) )?2015 (?:to |and |bis |und )?2016$/;
const setbacks =
  /^(?:anything that did not work out|what did not work out (?:on his projects|in his work)|(?:any|a) documented project setback|was hat bei seinen projekten nicht funktioniert)(?: (?:and |und )?(?:any )?(?:gaps?|holes?) in (?:his |the )?(?:cv|resume))?$/;
const cvGaps =
  /\b(?:(?:gaps?|holes?) in (?:(?:his|your|timo s|the) )?(?:cv|resume)|luecken? im lebenslauf)\b/;
const personalJudgment =
  /^(?:(?:what are |tell me )?(?:all )?(?:the )?(?:his |timo s )?(?:personal )?(?:flaws|weaknesses|weak points|negatives|negative (?:things|traits)|downsides)(?: (?:about|of) (?:hiring )?(?:him|timo(?: rzipa)?))?|(?:(?:anything else |any )?more )?negative(?:s)?|(?:was sind )?(?:seine |timos )?(?:schwaechen|negative eigenschaften|nachteile))$/;
const maintainerReview =
  /^(?:what did (?:the |its )?maintainer (?:question|flag) (?:in|about|during) |was (?:hinterfragte|beanstandete) (?:der|die) maintainer(?:in)? (?:bei|beim|an) )/;
const clauseConnector = '(?:and|also|und|sowie|ausserdem|außerdem)';
const independentClause =
  '(?:who|what|which|where|how|when|why|did|does|do|is|are|was|were|can|could|has|have|any (?:holes?|gaps?)|wer|wie|wo|woran|womit|wann|warum|welch\\p{L}*|hat|gibt|ist|kann|auf welchem|lücken)\\b';
const sentenceBoundary = /[?;]\s*(?=\p{L})/u;
const clauseBoundary = new RegExp(
  sentenceBoundary.source +
    '|(?:,\\s*|\\s+)' +
    clauseConnector +
    '\\s+(?=' +
    independentClause +
    ')',
  'iu',
);
const leadingConnector = new RegExp(
  '^' + clauseConnector + '\\s+(?=' + independentClause + ')',
  'iu',
);

export function questionClauses(question: string, includeConnectors = true) {
  return question
    .split(includeConnectors ? clauseBoundary : sentenceBoundary)
    .map((clause, index) =>
      index ? clause.trim().replace(leadingConnector, '') : clause.trim(),
    )
    .filter(
      (clause, index) =>
        !index ||
        !/^(?:please|thanks|thank you|bitte|danke)$/.test(normalize(clause)),
    );
}

const profilePitch =
  /^(?:(?:(?:give|write|show) me )?(?:a )?(?:(?:short|quick|brief) )?(?:pitch|intro(?:duction)?|bio) (?:about|on|for) (?:him|timo(?: rzipa)?)|(?:stell(?:e)? )?timo kurz vor|(?:ein )?kurzprofil (?:zu|von|ueber) timo)$/;
const interestingHighlight =
  /^(?:(?:(?:tell|show|give) me |what (?:is|s) )?(?:one |an? |the )?(?:most )?(?:interesting|surprising|fun) (?:detail|fact|thing)(?: about (?:timo(?: rzipa)?|him|his work|the portfolio))?(?: please)?|(?:(?:nenn|zeig) mir )?(?:ein )?(?:interessantes|spannendes|ueberraschendes) (?:detail|beispiel)(?: (?:ueber|zu) timo)?(?: bitte)?)$/;
const workAndProjectInventory =
  /^(?:(?:please )?(?:list|show(?: me)?|give me|what are) (?:all )?(?:(?:timo ?s|his|your|the) )?(?:(?:work(?: experience)?|jobs?|roles?) and (?:personal )?projects|projects and (?:work(?: experience)?|jobs?|roles?))(?: (?:of|by|from) timo)?(?: please)?|(?:liste|zeig(?: mir)?) (?:alle? )?(?:timos )?(?:arbeit|jobs?|stellen|berufserfahrung) und projekte[n]?(?: von timo)?(?: auf)?)$/;
const inventorySummaryEn =
  /^(?:(?:give|show|write) me (?:a )?(?:(?:nice|short|quick|brief) )?summary (?:of|about)|(?:(?:can|could|would) you |please )?summari[sz]e) /;
const inventorySummaryDe =
  /^(?:gib|zeig|schreib) mir (?:bitte )?(?:eine )?(?:(?:kurze|knappe) )?zusammenfassung (?:von|ueber) /;
const projectInventory =
  /^(?:(?:list|show(?: me)?) all (?:of )?(?:(?:timo ?s|his|your|the) )?projects(?: please)?|(?:liste|zeig(?: mir)?) alle (?:timos )?projekte(?: von timo)?(?: auf)?)$/;
const workTopic = /^(?:work(?: experience)?|career|arbeit|berufserfahrung)$/;
const stadlerOverview =
  /^(?:(?:tell me about|what did (?:timo|he|you) do at|was hat (?:timo|er) bei) )?stadler(?: (rds|altenrhein))?(?: gemacht)?$/;
export const workDetails =
  /^(?:(?:(?:tell|give|show) me )?(?:more (?:details? )?about|expand on) (?:(?:his|timo ?s|your|the) )?(?:work(?: experience)?|career)|(?:erzaehl mir )?mehr (?:zu|ueber) (?:(?:timos|seine|seiner|die|der) )?(?:arbeit|berufserfahrung))$/;
const profileHighlightsQuestion = 'portfolio highlights';
const highlightIds = [
  'hearthcoil-launcher-playtest',
  'spotify-reconciliation-example',
  'portfolio-website-architecture',
  'htl-dornbirn-class-website',
  'homelab-motivation',
];

export function profileHighlightIds(
  terms: string,
  history: readonly ChatTurn[],
) {
  if (terms !== profileHighlightsQuestion && !interestingHighlight.test(terms))
    return;
  const seen = history.map(({ answer }) => normalize(answer));
  return highlightIds.filter((id) => {
    const fact = facts.find((entry) => entry.id === id);
    return (
      fact &&
      !Object.values(fact.answer).some((text) =>
        text.split(/(?<=[.!?])\s+/).some((sentence) => {
          const excerpt = normalize(sentence);
          return excerpt && seen.some((previous) => previous.includes(excerpt));
        }),
      )
    );
  });
}

export function profileFollowUp(terms: string, history: readonly ChatTurn[]) {
  const previous = normalize(history.at(-1)?.question ?? '');
  if (moreQuestion.test(terms)) {
    if (educationOverview.test(previous)) return 'education projects';
    const anchor = normalize(
      history.findLast(
        ({ question }) => !moreQuestion.test(normalize(question)),
      )?.question ?? '',
    );
    if (profilePitch.test(anchor) || interestingHighlight.test(anchor))
      return profileHighlightsQuestion;
  }
  if (
    /^(?:motivation|why|warum)$/.test(terms) &&
    /^(?:home ?lab|tell me about (?:the |his )?home ?lab|erzaehl mir (?:vom|ueber das) home ?lab)$/.test(
      previous,
    )
  )
    return 'homelab motivation';
  if (perks.test(terms) && hiring.test(previous)) return previous;
  if (
    petKinds.test(terms) &&
    reviewedPets(previous)?.ids.includes('about.cats')
  )
    return 'what kind of cats';
  return terms;
}

export function profileQuestionNote(
  terms: string,
  locale: Locale,
  question = terms,
) {
  if (personalJudgment.test(terms))
    return locale === 'de'
      ? 'Das öffentliche Portfolio beschreibt Timos Arbeit und Projekte. Möchtest du nach einer konkreten Projektgrenze oder einem Zeitraum im Lebenslauf fragen?'
      : 'The public portfolio describes Timo’s work and projects. Would you like to ask about a specific project limitation or a period in his CV?';
  if (cvGaps.test(terms) && !approvedAnswer(terms, question))
    return locale === 'de'
      ? 'Welchen Zeitraum im Lebenslauf möchtest du prüfen?'
      : 'Which period in his CV would you like to check?';
  if (perks.test(terms))
    return locale === 'de'
      ? 'Meinst du Timos Berufserfahrung oder Zusatzleistungen bei einem Arbeitgeber?'
      : 'Do you mean Timo’s experience or benefits at an employer?';
  if (terms === 'motivation')
    return locale === 'de'
      ? 'Meinst du die Motivation für sein Homelab, ein Projekt oder seine Berufswahl?'
      : 'Do you mean his motivation for self-hosting, a project, or his career?';
}

export function modelOverviewIds(terms: string): readonly string[] | undefined {
  if (asksPetDetails(terms)) return PET_DETAIL_IDS;
  if (jobTitles.test(terms)) return ['career-role-titles'];
  if (
    workTopic.test(terms) ||
    englishWorkSummary.test(terms) ||
    germanWorkSummary.test(terms)
  )
    return WORK_EXPERIENCE_IDS;
}

function reviewedPets(terms: string): ReviewedAnswer | undefined {
  const name = catName.exec(terms)?.[0];
  if ((!name && !petTopic.test(terms)) || unsupportedPetDetail.test(terms))
    return;
  if (petSex.test(terms)) return { ids: ['about.cats.sex'] };
  if (
    name &&
    (petDetails.test(terms) ||
      /^(?:rudi|georgi|benji|(?:tell me about|who is|wer ist|erzaehl mir von) (?:rudi|georgi|benji))$/.test(
        terms,
      ))
  ) {
    return exactBreed.test(terms)
      ? { ids: ['about.cats.' + name], partial: true }
      : { ids: ['about.cats.' + name] };
  }
  if ((petDetails.test(terms) || petKinds.test(terms)) && petTopic.test(terms))
    return {
      ids: PET_DETAIL_IDS,
    };
  if (petNames.test(terms) && petTopic.test(terms))
    return { ids: ['about.cats.names'] };
  if (
    /^(?:pets?|cats?|haustiere?|katzen?|(?:does (?:timo|he) have|do you have|hat (?:timo|er)|hast du) (?:any )?(?:pets?|cats?|haustiere?|katzen?)|(?:what pets does (?:timo|he) have|welche haustiere hat (?:timo|er))|(?:how many (?:cats|pets) does (?:timo|he) have|wie viele (?:katzen|haustiere) hat (?:timo|er))|(?:tell me about|erzaehl mir von) (?:timo s|his|seinen|timos) (?:pets?|cats?|haustiere?n?|katzen))$/.test(
      terms,
    )
  )
    return { ids: ['about.cats'] };
}

const currentActivityQuestion =
  /^(?:what (?:is (?:timo(?: rzipa)?|he)|are you) (?:currently doing|doing (?:now|right now|at the moment|these days))|(?:what (?:is|s)|whats) (?:timo(?: rzipa)?|he) up to(?: (?:now|right now|at the moment|these days|lately))?|was (?:macht (?:timo(?: rzipa)?|er)|machst du) (?:gerade|aktuell|zurzeit|im moment))$/;
const openSourceOverview =
  /^(?:open ?source(?: (?:work|projects|contributions|arbeit|projekte|beitraege))?|(?:tell me about|show me) (?:timo s |his |your )?open ?source(?: (?:work|projects|contributions))?|(?:what|which) open ?source projects (?:has (?:timo|he) contributed to|has (?:timo|he) worked on|have you contributed to)|(?:welche (?:open ?source|quelloffenen) projekte hat timo (?:unterstuetzt|entwickelt)|wo hat timo zu open ?source beigetragen))$/;

export function needsDatedWorkEvidence(terms: string) {
  return (
    currentActivityQuestion.test(terms) ||
    /^(?:what(?: projects)? (?:are you|is (?:timo|he)) (?:currently )?working on(?: (?:now|right now|at the moment|these days))?|what (?:have you|has (?:timo|he)) been working on (?:lately|recently|these days)|(?:woran|was) (?:arbeitet (?:timo|er)|arbeitest du) (?:gerade|aktuell|zurzeit|im moment)|welche projekte (?:baut (?:timo|er)|baust du) (?:gerade|aktuell|jetzt))$/.test(
      terms,
    )
  );
}

export function approvedAnswer(
  terms: string,
  question = terms,
): ReviewedAnswer | undefined {
  const jointlyReviewed = reviewedSpotifyRewriteAndStack(terms);
  if (jointlyReviewed) return jointlyReviewed;
  const clauses = questionClauses(question);
  if (clauses.length <= 1) return approvedClause(terms);

  const ids = new Set<string>();
  let missing: MissingDetail | undefined;
  for (const clause of clauses) {
    const part = normalize(clause);
    const reviewed = approvedClause(part);
    const direct = reviewed ? undefined : reviewedFactId(part);
    const covered = reviewed?.ids ?? (direct ? [direct] : []);
    const combined = new Set([...ids, ...covered]);
    if (combined.size <= MAX_CLAIMS) {
      for (const id of covered) ids.add(id);
    }
    if (cvGaps.test(part) || reviewed?.missing === 'cv-gaps')
      missing = 'cv-gaps';
    else if (!covered.length || reviewed?.partial || combined.size > MAX_CLAIMS)
      missing ??= 'additional-question';
  }
  if (ids.size)
    return missing
      ? { ids: [...ids], partial: true, missing }
      : { ids: [...ids] };
}

function reviewedSpotifyRewriteAndStack(
  terms: string,
): ReviewedAnswer | undefined {
  const [work, stack, extra] = terms.split(/\s+(?:and|und)\s+/);
  if (
    stack &&
    extra === undefined &&
    spotifyTracker.test(work) &&
    /^(?:what|which|was|welche)\b/.test(work) &&
    /\b(?:rebuild|rewrite|reimplement|neu entwickelt|neu geschrieben|umgebaut)\b/.test(
      work,
    ) &&
    /^(?:(?:what|which) (?:technology|technologies|tech stack|programming language) did (?:timo|he) use|welche (?:technologien?|programmiersprachen?) hat (?:timo|er) (?:genutzt|verwendet|eingesetzt))$/.test(
      stack,
    )
  )
    return { ids: ['spotify-python'] };
}

function approvedClause(terms: string): ReviewedAnswer | undefined {
  if (profilePitch.test(terms)) return { ids: ['portfolio-pitch'] };
  if (
    workAndProjectInventory.test(
      terms
        .replace(inventorySummaryEn, 'list ')
        .replace(inventorySummaryDe, 'liste '),
    )
  )
    return { ids: ['career-role-titles', 'portfolio-project-inventory'] };
  if (projectInventory.test(terms))
    return { ids: ['portfolio-project-inventory'] };
  const stadlerRole = stadlerOverview.exec(terms);
  if (stadlerRole)
    return {
      ids: [
        stadlerRole[1] === 'altenrhein' ? 'stadler-plugins' : 'stadler-vpn',
      ],
    };
  if (workDetails.test(terms)) return { ids: WORK_EXPERIENCE_IDS };
  if (educationOverview.test(terms)) return { ids: ['cv-degree', 'cv-matura'] };
  if (educationProjects.test(terms))
    return { ids: ['bachelor-contribution', 'htl-dornbirn-class-website'] };
  if (leisure.test(terms)) return { ids: ['portfolio-leisure'] };
  if (homelabMotivation.test(terms)) return { ids: ['homelab-motivation'] };
  if (hiring.test(terms))
    return { ids: ['abacus-workflow', 'stadler-vpn', 'spotify-python'] };
  if (publicTimeline.test(terms)) return { ids: ['cv-2015-2016'] };
  if (setbacks.test(terms))
    return cvGaps.test(terms)
      ? { ids: ['spotify-upstream-review'], partial: true, missing: 'cv-gaps' }
      : { ids: ['spotify-upstream-review'] };
  if (
    maintainerReview.test(terms) &&
    (spotifyTracker.test(terms) || /\bupstream spotify\b/.test(terms))
  )
    return { ids: ['spotify-upstream-review'] };

  if (needsDatedWorkEvidence(terms)) return { ids: ['current-work'] };
  const pets = reviewedPets(terms);
  if (pets) return pets;

  if (openSourceOverview.test(terms))
    return { ids: ['myspeed-fork', 'spotify-upstream-review'] };

  if (
    /^(?:where (?:is timo based|does timo live)|wo (?:ist timo ansaessig|wohnt timo|lebt timo))$/.test(
      terms,
    )
  )
    return { ids: ['portfolio-role-location'] };

  if (
    /^(?:(?:what|which) (?:spoken )?languages (?:does (?:timo|he) speak|do you speak)|what is timo s english level|what(?: s| is) (?:his|your) english level|welche sprachen spricht (?:timo|er)|welches (?:sprach|englisch)niveau hat timo(?: in englisch)?|wie gut spricht timo englisch)$/.test(
      terms,
    )
  )
    return { ids: ['portfolio-spoken-languages'] };

  if (
    spotifyTracker.test(terms) &&
    /\b(?:compare view|compare page|vergleichsansicht)\b/.test(terms) &&
    /\b(?:performance|benchmark|fast(?:er)?|speed|sort\w*|schnell\w*|umsortier\w*|latenz)\b/.test(
      terms,
    )
  )
    return { ids: ['spotify-compare-performance'] };

  if (
    /\b(?:this (?:portfolio )?(?:website|site)|this portfolio|portfolio (?:website|stack)|diese (?:website|seite)|dieses portfolio)\b/.test(
      terms,
    ) &&
    /\b(?:stack|host\w*|built|same urls|gehostet|gebaut|sprachwahl|nginx|betrieben)\b/.test(
      terms,
    )
  )
    return { ids: ['portfolio-website-architecture'] };

  if (
    tutto.test(terms) &&
    /\b(?:older server|archived server|aelteren? server|archivierten? server|321175e)\b/.test(
      terms,
    ) &&
    /\b(?:compatib\w*|kompatib\w*|commands|befehle|protokoll|protocol)\b/.test(
      terms,
    )
  )
    return { ids: ['tutto-online-compatibility'] };

  if (
    /^(?:(?:does|can) ask otto (?:use|run on) (?:an? )?(?:llm|language model|ai)|is ask otto (?:an? )?(?:llm|language model|ai)|(?:nutzt|verwendet) ask otto (?:ein )?(?:llm|sprachmodell|ki)|ist ask otto (?:ein )?(?:llm|sprachmodell|ki))$/.test(
      terms,
    )
  )
    return { ids: ['tutto-coach'] };

  if (
    hearthcoil.test(terms) &&
    /^(?:which (?:company|publisher) published hearthcoil|who published hearthcoil|does hearthcoil have a publisher|how (?:will|does) (?:timo|he) (?:plan to )?(?:publish|release) hearthcoil|welch\w* (?:anbieter|firma|publisher) hat hearthcoil veroeffentlicht|wer hat hearthcoil veroeffentlicht|wie (?:will|moechte) (?:timo|er) hearthcoil veroeffentlichen)$/.test(
      terms,
    )
  )
    return { ids: ['hearthcoil-release-plan'] };

  if (
    /\bcoilwatch\b/.test(terms) &&
    /\bpush (?:notifications?|nachrichten|benachrichtigungen?)\b/.test(terms) &&
    /^(?:how|why|wie|warum)\b/.test(terms) &&
    /\b(?:working|enabled?|activate|blocked|blockiert|zum laufen|aktivier\w*|funktionier\w*)\b/.test(
      terms,
    )
  )
    return { ids: ['coilwatch-push-notifications'] };

  if (
    /\b(?:spotifystatstracker|spotify stats tracker|spotifytracker)\b/.test(
      terms,
    )
  ) {
    if (
      /\bimport\w*\b/.test(terms) &&
      /\b(?:upstream|original|urspruenglich\w*)\b/.test(terms) &&
      /\b(?:contribut\w*|improv\w*|verbesser\w*|beitrag)\b/.test(terms)
    )
      return { ids: ['spotify-upstream-review'] };

    if (
      /^(?:who (?:created|started|originated|developed) (?:the )?(?:original |upstream )?|wer hat (?:das )?(?:urspruengliche )?)(?:spotifystatstracker|spotify stats tracker|spotifytracker)(?: entwickelt| erstellt)?$/.test(
        terms,
      )
    )
      return { ids: ['spotify-rewrite'] };

    if (
      /^what year did timo (?:invent|create|start) the original (?:spotifystatstracker|spotifytracker) upstream app$/.test(
        terms,
      )
    )
      return { ids: ['spotify-rewrite'], partial: true };
  }

  if (
    spotifyTracker.test(terms) &&
    lastFm.test(terms) &&
    genreCount.test(terms)
  )
    return { ids: ['spotify-enrichment'], partial: true };

  if (
    stadler.test(terms) &&
    /\b(?:exact (?:date|day)|genau\w* datum|genau\w* tag)\b/.test(terms) &&
    /\b(?:join\w*|start\w*|begann|angefangen|eintritt\w*)\b/.test(terms)
  )
    return { ids: ['stadler-start-month'] };

  if (
    /\b(?:bachelor thesis|bachelorarbeit)\b/.test(terms) &&
    /\b(?:title|titel)\b/.test(terms) &&
    /^(?:what (?:is|was)|wie (?:lautete|lautet|hiess))\b/.test(terms)
  )
    return { ids: ['bachelor-title'] };

  if (
    /\b(?:master(?: s)? degree|masterabschluss)\b/.test(terms) &&
    /\b(?:cv|lebenslauf)\b/.test(terms) &&
    /\b(?:lists?|mentions?|aufgefuehrt|steht|nennt)\b/.test(terms)
  )
    return { ids: ['cv-masters-listing'] };

  if (carini.test(terms)) {
    if (
      monthlyBilling.test(terms) &&
      /\b(?:language|sprache|programmiersprache)\b/.test(terms)
    )
      return { ids: ['carini-billing-scope'] };
    if (
      /\b(?:programming language|programmiersprache|technology|technologie)\b/.test(
        terms,
      ) &&
      /\b(?:document view(?:er)?|dokumentenansicht)\b/.test(terms)
    )
      return { ids: ['carini-document-view'] };
  }

  if (
    myspeed.test(terms) &&
    forecast.test(terms) &&
    /^(?:can|does|kann|bietet|unterstuetzt)\b/.test(terms) &&
    /\b(?:bandwidth|bandbreit\w*|bill|rechnung)\b/.test(terms)
  )
    return { ids: ['myspeed-forecast-scope'] };

  if (
    kniffel.test(terms) &&
    /\b(?:test|fixture|kniffel wahrscheinlichkeitstest)\b/.test(terms) &&
    /\b1 5\b/.test(terms) &&
    /\b(?:kept|behalten)\b/.test(terms)
  ) {
    if (
      /\b(?:classic|klassischen regeln)\b/.test(terms) &&
      /\b(?:last die just rolled a 6|letzte wuerfel zeigte gerade eine 6)\b/.test(
        terms,
      ) &&
      /\b(?:turn score was zero|zugpunktestand war null)\b/.test(terms) &&
      /\b(?:another draw is disabled|weitere karte kann nicht gezogen werden)\b/.test(
        terms,
      )
    )
      return { ids: ['tutto-kniffel-completed-fixture'] };
    if (
      /\b(?:probability test|wahrscheinlichkeitstest)\b/.test(terms) &&
      /\b(?:last die has not been rolled|letzte wuerfel wurde noch nicht geworfen)\b/.test(
        terms,
      )
    )
      return { ids: ['tutto-kniffel-completion-fixture'] };
  }
}

export function asksUnsupportedDetail(terms: string) {
  return (
    (hasPetSubject(terms) && unsupportedPetDetail.test(terms)) ||
    (/\babacus\b/.test(terms) &&
      /\b(?:ocr|recognition|belegerkennung)\b/.test(terms) &&
      (/^(?:who|wer)\b/.test(terms) ||
        /\b(?:vendor|supplier|anbieter|lieferant)\b/.test(terms))) ||
    (kniffel.test(terms) &&
      /\b(?:odds|probability|recommend\w*|wahrscheinlichkeit|empfiehl\w*|punkte)\b/.test(
        terms,
      )) ||
    (hearthcoil.test(terms) &&
      /\b(?:release date|veroeffentlichungsdatum|wann (?:erscheint|wurde|wird) hearthcoil)\b/.test(
        terms,
      )) ||
    (myspeed.test(terms) &&
      /\b(?:how much|wie hoch|wie viel)\b/.test(terms) &&
      /\b(?:pay|bill|cost\w*|rechnung|kosten)\b/.test(terms)) ||
    (spotifyTracker.test(terms) &&
      lastFm.test(terms) &&
      genreCount.test(terms)) ||
    ((tutto.test(terms) || /\bask otto\b/.test(terms)) &&
      otto.test(terms) &&
      /\b(?:exact (?:odds|probabilit\w*)|genaue wahrscheinlichkeit)\b/.test(
        terms,
      )) ||
    (stadler.test(terms) &&
      /\b(?:outlook version|version of outlook)\b/.test(terms)) ||
    (myspeed.test(terms) &&
      /\b(?:bandwidth|bandbreit\w*)\b/.test(terms) &&
      forecast.test(terms)) ||
    (carini.test(terms) && monthlyBilling.test(terms))
  );
}
