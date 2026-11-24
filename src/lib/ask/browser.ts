import {
  CLIENT_TIMEOUT,
  MAX_CLAIMS,
  MAX_QUESTION,
  PET_SOURCE_PATH,
  documentAnswer,
  exampleMatch,
  isPortfolioPageHref,
  normalize,
  validateResult,
  type AskResult,
} from './catalog';
import {
  clarification,
  followUp,
  languageQuestion,
  questionLocale,
  moreQuestion,
  pickSubject,
  removeChatPrefix,
  socialReply,
  subjectCorrection,
  unknownReply,
} from './conversation';
import {
  findSiteContent,
  namesSiteSubject,
  parseSiteContent,
  petSubject,
  resolveSiteNames,
  SITE_CONTENT_PATH,
  type SiteAnswer,
  type SiteSubject,
} from './site-content';
import {
  findEarlierTurn,
  recallChat,
  selectChatHistory,
  type ChatTurn,
} from './history';
import { LOCAL_PETS_PATH, parseLocalPets, type LocalPets } from './local-pets';
import { isShortPetFollowUp } from './reviewed-questions';
import { careerFollowUpScope } from './career';
import {
  projectChoice,
  projectFollowUp,
  PROJECTS_PATH,
} from './project-context';

const SITE_CONTENT_TIMEOUT = 1_500;
const SCROLL_TOLERANCE = 40;
const earlierTopic =
  /^(?:(?:go |going )?back to|zur(?:ue|ü)ck (?:zu|zum|zur))\s+([^,:;]+)(?:\s*[,;:]\s*(.+))?$/i;
const spotifyPrompts = {
  en: ['What languages does it use?', 'How does it avoid duplicate plays?'],
  de: ['Welche Sprachen nutzt es?', 'Wie vermeidet es doppelte Wiedergaben?'],
};

function addParagraph(parent: HTMLElement, text: string, className?: string) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  if (className) paragraph.className = className;
  parent.append(paragraph);
  return paragraph;
}

function citation(href: string, label: string) {
  if (!isPortfolioPageHref(href)) {
    const attribution = document.createElement('span');
    attribution.className = 'text-muted mt-1 block text-xs';
    attribution.textContent = label;
    attribution.setAttribute('data-ask-attribution', '');
    return attribution;
  }
  const link = document.createElement('a');
  link.className = 'link-accent mt-1 block w-fit text-xs';
  link.href = href;
  link.textContent = label;
  return link;
}

function answerText(node: Node): string {
  if (
    node.nodeName === 'A' ||
    node.nodeName === 'DETAILS' ||
    (node.nodeType === node.ELEMENT_NODE &&
      (node as Element).hasAttribute('data-ask-attribution'))
  )
    return '';
  if (node.nodeType === node.TEXT_NODE) return node.textContent ?? '';
  return Array.from(node.childNodes, answerText).filter(Boolean).join(' ');
}

export function setupAskWork(panel: HTMLElement) {
  const siteLocale = document.documentElement.lang;
  const form = panel.querySelector('form');
  const input = panel.querySelector('textarea');
  const button = form?.querySelector('button');
  const reset = panel.querySelector<HTMLButtonElement>('[data-ask-reset]');
  const output = panel.querySelector<HTMLElement>('[data-ask-result]');
  const validation = panel.querySelector<HTMLElement>('[data-ask-validation]');
  const topic = panel.querySelector<HTMLElement>('[data-ask-topic]');
  const controls = panel.querySelector<HTMLElement>('[data-ask-controls]');
  const starters = panel.querySelector<HTMLElement>('[data-ask-starters]');
  const actions = panel.querySelector<HTMLElement>('[data-ask-actions]');
  const staticExamples = panel.querySelector<HTMLElement>(
    '[data-ask-static-examples]',
  );
  const version = panel.dataset.version;
  if (
    !form ||
    !input ||
    !button ||
    !output ||
    !version ||
    (siteLocale !== 'en' && siteLocale !== 'de') ||
    !panel.dataset.messages
  )
    return;

  const siteMessages = JSON.parse(panel.dataset.messages);
  const otherMessages = panel.dataset.askOtherMessages
    ? JSON.parse(panel.dataset.askOtherMessages)
    : siteMessages;
  let locale: 'en' | 'de' = siteLocale;
  let messages = siteMessages;
  const transcript: (ChatTurn & {
    subjects: SiteSubject[];
    evidence: string[];
    localOnly: boolean;
  })[] = [];
  const replySubjects = new WeakMap<HTMLElement, SiteSubject[]>();
  let subjects: SiteSubject[] = [];
  let pending:
    { question: string; subjects: SiteSubject[]; spelling?: true } | undefined;
  let active: AbortController | undefined;
  let unknownCount = 0;
  let followLatest = true;
  let localPets: Promise<LocalPets | null> | undefined;
  form.hidden = false;
  const submitPrompt = (question: string) => {
    if (button.disabled) return;
    input.value = question;
    input.focus();
    form.requestSubmit();
  };
  if (starters) {
    starters.hidden = false;
    if (staticExamples) staticExamples.hidden = true;
    for (const starter of starters.querySelectorAll<HTMLButtonElement>(
      '[data-ask-prompt]',
    )) {
      const question = starter.dataset.askPrompt;
      if (question)
        starter.addEventListener('click', () => submitPrompt(question));
    }
  }
  output.addEventListener('scroll', () => {
    followLatest =
      output.scrollHeight - output.clientHeight - output.scrollTop <=
      SCROLL_TOLERANCE;
  });
  const scrollToLatest = () => {
    if (followLatest) output.scrollTop = output.scrollHeight;
  };

  const sayUnknown = (reply: HTMLElement) => {
    reply.textContent = unknownReply(locale, unknownCount++);
  };
  const indexOnly = panel.dataset.mode === 'index';
  const canShowSiteImmediately = (answer: SiteAnswer) =>
    indexOnly ||
    (!answer.preferModel && (answer.status !== 'unknown' || answer.localOnly));
  const askProjectScope = (
    reply: HTMLElement,
    project: NonNullable<ReturnType<typeof projectChoice>>,
    question: string,
  ) => {
    pending = {
      question,
      subjects: [
        project,
        {
          href: PROJECTS_PATH,
          label: locale === 'de' ? 'Andere Projekte' : 'Other projects',
        },
      ],
    };
    reply.textContent =
      locale === 'de'
        ? `Möchtest du mehr über ${project.label} erfahren oder über andere Projekte?`
        : `Do you mean more about ${project.label}, or other projects?`;
  };
  const setSubjects = (nextSubjects: SiteSubject[]) => {
    subjects = nextSubjects;
    if (topic) {
      topic.hidden = subjects.length !== 1;
      topic.textContent = topic.hidden
        ? ''
        : messages.topic.replace('{subject}', () => subjects[0].label);
    }
  };
  const rememberSubjects = (
    reply: HTMLElement,
    nextSubjects: SiteSubject[],
  ) => {
    setSubjects(nextSubjects);
    replySubjects.set(reply, nextSubjects);
  };
  const updateActions = () => {
    if (!actions) return;
    const choices = pending?.subjects.map(({ label }) => label);
    const suggestions =
      subjects.length === 1 &&
      subjects[0].href === '/projects/spotify-stats-tracker/'
        ? spotifyPrompts[locale].filter(
            (prompt) =>
              !transcript.some(
                ({ question }) => normalize(question) === normalize(prompt),
              ),
          )
        : [];
    actions.replaceChildren(
      ...(choices ?? suggestions).map((label) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'btn-muted text-sm';
        action.textContent = label;
        action.addEventListener('click', () => submitPrompt(label));
        return action;
      }),
    );
  };
  const rememberReply = (question: string, reply: HTMLElement) => {
    const answer = answerText(reply)
      .replace(/[\s\p{Cc}]+/gu, ' ')
      .toWellFormed()
      .trim();
    if (answer)
      transcript.push({
        question: question.replace(/[\p{Cc}]/gu, ' ').toWellFormed(),
        answer,
        subjects: replySubjects.get(reply) ?? [],
        evidence: Array.from(
          reply.querySelectorAll('[data-ask-evidence] p'),
          (part) => part.textContent ?? '',
        ),
        localOnly: reply.hasAttribute('data-ask-local-only'),
      });
    if (starters)
      starters.hidden = transcript.some(({ subjects }) => subjects.length > 0);
    updateActions();
    scrollToLatest();
  };

  const showFacts = (
    reply: HTMLElement,
    result: AskResult,
    pageAnswer?: SiteAnswer | null,
  ) => {
    if (result.status === 'unknown') {
      sayUnknown(reply);
      return;
    }
    reply.textContent = result.status === 'partial' ? messages.partial : '';
    for (const source of result.sources) {
      for (const { text } of result.claims.filter(
        ({ sourceId }) => sourceId === source.id,
      ))
        addParagraph(reply, text);
      reply.append(citation(source.href, source.label));
    }
    const confirmed = new Map<string, SiteSubject>();
    for (const { href, label } of result.sources) {
      const [path, fragment] = href.split('#');
      const resolved = pageAnswer?.subjects?.filter(
        (subject) =>
          subject.href === path &&
          (path !== '/about/' ||
            !fragment ||
            (subject.heading &&
              normalize(subject.heading).includes(normalize(fragment)))),
      );
      if (path === PET_SOURCE_PATH) {
        confirmed.set(
          path,
          petSubject(
            result.locale,
            result.claims.map(({ id }) => id),
          ),
        );
      } else if (resolved?.length) {
        for (const subject of resolved)
          confirmed.set(subject.href + '#' + (subject.heading ?? ''), subject);
      } else if (path.startsWith('/projects/') && path !== '/projects/') {
        // The project overview and contribution may cite the same subject.
        confirmed.set(path + '#', { href: path, label: label.split(' · ')[0] });
      }
    }
    rememberSubjects(reply, [...confirmed.values()]);
  };

  const showSite = (
    reply: HTMLElement,
    answer: SiteAnswer,
    subject?: SiteSubject,
    related = false,
  ) => {
    const { status, sources, missing, lead, note } = answer;
    if (answer.localOnly) reply.setAttribute('data-ask-local-only', '');
    reply.replaceChildren();
    if (lead) addParagraph(reply, lead);
    const statusLine =
      note ??
      (status === 'unknown'
        ? subject && messages.missingSubject
          ? messages.missingSubject.replace('{subject}', () => subject.label)
          : messages.seePage
        : related && !lead
          ? messages.related
          : '');
    if (statusLine)
      addParagraph(
        reply,
        statusLine,
        related || lead ? 'text-muted' : undefined,
      );
    for (const { href, title, excerpts } of sources) {
      const section = document.createElement('div');
      section.className = 'space-y-1';
      const supporting = excerpts.filter((text) => text !== lead);
      const evidence =
        lead && supporting.length ? document.createElement('details') : null;
      if (evidence) {
        evidence.setAttribute('data-ask-evidence', '');
        evidence.className = 'text-muted text-xs';
        const summary = document.createElement('summary');
        summary.textContent = messages.evidence;
        summary.className = 'cursor-pointer';
        evidence.append(summary);
      }
      for (const text of supporting) {
        const spec =
          (subject ?? answer.subjects?.[0])?.heading &&
          answer.subjects?.length === 1 &&
          /^(CPU|GPU|RAM|Memory|OS) (.+)$/.exec(text);
        const label = subject?.label ?? answer.subjects?.[0]?.label;
        const sentence =
          spec && label && messages.spec
            ? messages.spec.replace(
                /\{(subject|spec|value)\}/g,
                (_: string, key: string) =>
                  ({ subject: label, spec: spec[1], value: spec[2] })[
                    key as 'subject' | 'spec' | 'value'
                  ],
              )
            : text;
        addParagraph(evidence ?? section, sentence);
      }
      section.append(citation(href, title));
      if (evidence) section.append(evidence);
      reply.append(section);
    }
    for (const detail of missing) {
      addParagraph(
        reply,
        messages.missing.replace('{detail}', () => detail),
        'text-muted',
      );
    }
    if (answer.subjects?.length) rememberSubjects(reply, answer.subjects);
  };

  reset?.addEventListener('click', () => {
    active?.abort();
    active = undefined;
    locale = siteLocale;
    messages = siteMessages;
    setSubjects([]);
    pending = undefined;
    unknownCount = 0;
    transcript.length = 0;
    output.replaceChildren();
    if (controls) controls.hidden = true;
    if (starters) starters.hidden = false;
    updateActions();
    followLatest = true;
    if (validation) validation.textContent = '';
    input.value = '';
    button.disabled = false;
    input.focus();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!button.disabled) form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const line = input.value.trim();
    if (!line || [...line].length > MAX_QUESTION) {
      if (validation) validation.textContent = messages.length;
      return;
    }
    locale = questionLocale(line, locale);
    messages = locale === siteLocale ? siteMessages : otherMessages;
    if (validation) validation.textContent = '';
    input.value = '';
    if (controls) controls.hidden = false;
    if (starters) starters.hidden = true;
    actions?.replaceChildren();
    const userMessage = addParagraph(
      output,
      line,
      'bg-panel ml-auto w-fit max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap break-words',
    );
    userMessage.setAttribute('data-ask-user', '');
    userMessage.lang = locale;
    const reply = document.createElement('div');
    reply.className =
      'bg-surface max-w-[95%] space-y-2 rounded-xl border border-line px-3 py-2 break-words';
    reply.setAttribute('data-ask-reply', '');
    reply.lang = locale;
    output.append(reply);
    scrollToLatest();

    const social = socialReply(line, locale);
    if (social) {
      reply.textContent = social;
      rememberReply(line, reply);
      return;
    }

    const rawQuestion = removeChatPrefix(line);
    const recalled = recallChat(rawQuestion, transcript);
    if (recalled) {
      reply.textContent =
        recalled.turn?.[recalled.field] ??
        (locale === 'de'
          ? 'Das finde ich in diesem Chat nicht.'
          : 'I can’t find that in this chat.');
      if (recalled.turn?.subjects.length)
        rememberSubjects(reply, recalled.turn.subjects);
      if (recalled.turn?.localOnly)
        reply.setAttribute('data-ask-local-only', '');
      pending = undefined;
      rememberReply(line, reply);
      return;
    }
    const pivot = earlierTopic.exec(rawQuestion);
    const earlier =
      pivot &&
      findEarlierTurn(
        transcript.filter(({ subjects }) => subjects.length),
        pivot[1],
      );
    if (earlier && !pivot?.[2]) {
      reply.textContent = earlier.answer;
      rememberSubjects(reply, earlier.subjects);
      if (earlier.localOnly) reply.setAttribute('data-ask-local-only', '');
      pending = undefined;
      rememberReply(line, reply);
      return;
    }
    let chosen = pending && pickSubject(rawQuestion, pending.subjects);
    const projectListChosen = chosen?.href === PROJECTS_PATH;
    const unresolved =
      chosen && !projectListChosen ? pending?.question : undefined;
    const choseSpelling = chosen && pending?.spelling;
    pending = undefined;
    let question =
      unresolved ??
      (pivot?.[2]
        ? earlier
          ? pivot[2]
          : pivot[2] + ' (' + pivot[1] + ')'
        : (pivot?.[1] ?? rawQuestion));
    const example = exampleMatch(question);
    if (example) {
      showFacts(
        reply,
        documentAnswer([example], 'answer', 'index', locale, version),
      );
      rememberReply(line, reply);
      return;
    }

    const controller = new AbortController();
    active = controller;
    button.disabled = true;
    reply.textContent = messages.wait;
    let pageAnswer: SiteAnswer | null = null;
    let focus: SiteSubject | undefined;
    let projectForClarification: ReturnType<typeof projectChoice>;
    try {
      // Fetch the content for this build and language. Conversation state stays in this tab.
      const contentPath =
        locale === siteLocale
          ? SITE_CONTENT_PATH
          : '/ask-content-' + locale + '.json';
      const index = await fetch(contentPath, {
        cache: 'no-cache',
        redirect: 'error',
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(SITE_CONTENT_TIMEOUT),
        ]),
      })
        .then(async (response) =>
          response.ok ? parseSiteContent(await response.json(), locale) : null,
        )
        .catch(() => null);
      if (index && panel.dataset.askLocalPets === 'true') {
        localPets ??= fetch(LOCAL_PETS_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(SITE_CONTENT_TIMEOUT),
        })
          .then(async (response) =>
            response.ok ? parseLocalPets(await response.json()) : null,
          )
          .catch(() => null);
        const pets = await localPets;
        if (pets) index.localPets = pets;
        else localPets = undefined;
      }
      controller.signal.throwIfAborted();

      if (index) {
        const resolved = resolveSiteNames(
          question,
          index,
          choseSpelling ? chosen?.label : undefined,
        );
        if (resolved.alternatives.length) {
          setSubjects([]);
          const candidates = index.pages.filter(({ title }) =>
            resolved.alternatives.includes(title),
          );
          pending = {
            question: resolved.question,
            subjects: candidates.map(({ href, title }) => ({
              href,
              label: title,
            })),
            spelling: true,
          };
          reply.textContent = clarification(locale, resolved.alternatives);
          return;
        }
        question = resolved.question;
      }

      const correction = !chosen && subjectCorrection(rawQuestion);
      if (index && correction) {
        const target = pickSubject(
          correction,
          index.pages.map(({ href, title }) => ({ href, label: title })),
        );
        if (target) {
          const last = transcript.at(-1);
          const priorQuestion = last && followUp(last.question);
          if (priorQuestion) chosen = target;
          question = priorQuestion || correction;
        }
      }

      const publicHistory = transcript.filter(({ localOnly }) => !localOnly);
      const careerFollowUp =
        panel.dataset.mode === 'local' &&
        careerFollowUpScope(normalize(question), publicHistory);
      const projectContext =
        !indexOnly &&
        (!chosen || projectListChosen) &&
        projectFollowUp(normalize(question), publicHistory);
      if (projectContext) projectForClarification = projectContext.focus;
      const petFollowUp =
        subjects.length === 1 &&
        subjects[0].href === PET_SOURCE_PATH &&
        isShortPetFollowUp(normalize(question));
      const next = followUp(question) ?? (petFollowUp ? question : null);
      const shortFollowUp = next && normalize(next);
      const isFollowUp =
        chosen ||
        earlier ||
        petFollowUp ||
        (shortFollowUp &&
          (languageQuestion.test(shortFollowUp) ||
            moreQuestion.test(shortFollowUp) ||
            !(index && namesSiteSubject(question, index))));
      if (careerFollowUp || (projectContext && !projectContext.projectId)) {
        setSubjects([]);
      } else if (isFollowUp) {
        const previous =
          pivot && earlier && pickSubject(pivot[1], earlier.subjects);
        const options = chosen
          ? [chosen]
          : previous
            ? [previous]
            : earlier
              ? earlier.subjects
              : subjects;
        if (options.length !== 1) {
          if (options.length)
            pending = { question: next ?? question, subjects: options };
          reply.textContent = clarification(
            locale,
            options.map(({ label }) => label),
          );
          return;
        }
        focus = options[0];
        if (
          focus.href === '/homelab/' &&
          shortFollowUp &&
          (languageQuestion.test(shortFollowUp) ||
            /duplicate plays|doppelte wiedergaben/.test(shortFollowUp))
        ) {
          const projects = new Map<string, SiteSubject>();
          for (const { subjects: prior } of transcript)
            for (const subject of prior)
              if (
                subject.href.startsWith('/projects/') &&
                subject.href !== '/projects/'
              )
                projects.set(subject.href, subject);
          const choices = [...projects.values()].slice(-MAX_CLAIMS);
          if (choices.length)
            pending = { question: next ?? question, subjects: choices };
          reply.textContent =
            choices.length > 1
              ? clarification(
                  locale,
                  choices.map(({ label }) => label),
                )
              : locale === 'de'
                ? 'Welches Projekt meinst du?'
                : 'Which project do you mean?';
          return;
        }
        pageAnswer =
          index &&
          ((choseSpelling
            ? findSiteContent(question, index, 'overview', focus)
            : null) ??
            findSiteContent(next ?? question, index, 'related', focus));
        if ((pageAnswer && canShowSiteImmediately(pageAnswer)) || indexOnly) {
          if (pageAnswer) showSite(reply, pageAnswer, focus);
          else sayUnknown(reply);
          return;
        }
        const context = ' (' + focus.label + ')';
        question =
          [...(next ?? question)]
            .slice(0, MAX_QUESTION - [...context].length)
            .join('') + context;
      } else {
        setSubjects([]);

        const overview = index && findSiteContent(question, index, 'overview');
        if (overview && canShowSiteImmediately(overview)) {
          showSite(reply, overview);
          return;
        }
        pageAnswer = overview ?? (index && findSiteContent(question, index));
      }
      const excerptCount = pageAnswer?.sources.reduce(
        (count, { excerpts }) => count + excerpts.length,
        0,
      );
      if (
        pageAnswer &&
        !pageAnswer.preferModel &&
        (pageAnswer.status === 'partial' || (excerptCount ?? 0) > 1)
      ) {
        showSite(reply, pageAnswer);
        return;
      }
      if (indexOnly) {
        if (pageAnswer) showSite(reply, pageAnswer, undefined, true);
        else sayUnknown(reply);
        return;
      }
      const history = selectChatHistory(
        publicHistory.map(({ question, answer }) => ({ question, answer })),
        question,
      );
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        body: JSON.stringify({
          question,
          locale,
          ...(history.length ? { history } : {}),
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(CLIENT_TIMEOUT),
        ]),
      });
      controller.signal.throwIfAborted();
      if (response.status === 429) {
        if (projectForClarification) {
          askProjectScope(reply, projectForClarification, question);
        } else if (pageAnswer) {
          showSite(reply, pageAnswer, focus, true);
          addParagraph(reply, messages.limited, 'text-muted');
        } else {
          reply.textContent = messages.limited;
        }
        return;
      }
      if (!response.ok) throw new Error('Ask unavailable');
      const result = validateResult(await response.json(), locale, version);
      controller.signal.throwIfAborted();
      if (!result) throw new Error('Invalid answer');
      const project =
        result.clarifyProject && projectChoice(result.clarifyProject);
      if (project) {
        askProjectScope(reply, project, question);
        return;
      }
      if (result.status === 'unknown' && pageAnswer)
        showSite(reply, pageAnswer, focus, true);
      else showFacts(reply, result, pageAnswer);
    } catch {
      if (controller.signal.aborted) return;
      if (projectForClarification)
        askProjectScope(reply, projectForClarification, question);
      else if (pageAnswer) showSite(reply, pageAnswer, focus, true);
      else reply.textContent = messages.offline;
    } finally {
      if (active === controller) {
        rememberReply(line, reply);
        active = undefined;
        button.disabled = false;
      }
    }
  });
}
