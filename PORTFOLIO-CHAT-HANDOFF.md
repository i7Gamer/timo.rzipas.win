# Portfolio chat handoff

## Sources

The chatbot snapshot is `b1752e0c5ee6115960993321e06fb0faa7bc0798`. It has 31 reviewed facts and 12 citation sources. The snapshot lives in the local chatbot checkout. These revision-qualified paths open with `git show` in a clone that has the snapshot.

| What                                                                                | Exact Git path                                                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Reviewed EN/DE answers, fact IDs, aliases, evidence pointers, and citation registry | `b1752e0c5ee6115960993321e06fb0faa7bc0798:src/data/ask/facts.json`                                                                   |
| Browser-only AI attribution notes                                                   | `b1752e0c5ee6115960993321e06fb0faa7bc0798:src/data/project-ai.ts`                                                                    |
| Fact schema and citation validation                                                 | `b1752e0c5ee6115960993321e06fb0faa7bc0798:src/lib/ask/catalog.ts`                                                                    |
| Public bundle and page-index builder                                                | `b1752e0c5ee6115960993321e06fb0faa7bc0798:src/lib/ask/version.ts`, `b1752e0c5ee6115960993321e06fb0faa7bc0798:scripts/ask-content.ts` |
| Evidence pins and withdrawal test                                                   | `b1752e0c5ee6115960993321e06fb0faa7bc0798:src/lib/ask/ask.test.ts`                                                                   |

`facts.json` has three top-level fields.

- `sources` maps each `sourceId` to an `href` (shared string or `{en,de}`), bilingual `label`, and `topics` used by retrieval.
- `facts` contains `id`, `sourceId`, `facet`, `aliases`, `answer: {en,de}`, and `evidence`. Optional fields are `standalone` for distinctive queries, `lead: {en,de}` for shorter reviewed wording, and `partial: true` for a known coverage limit. The runtime key `de` carries Swiss Standard German.
- `examples` ties each bilingual `question` to a `factId`.

The build emits `ask-facts.json` with `schemaVersion: 1`, `corpusVersion`, `sources`, and `facts`. Exported facts use `topic` and `answers: {en,de-CH}` and combine aliases and standalone terms. `ask-content.json` is a separate index of rendered public pages with `locale` and `pages`. Each page has `href`, `title`, `overview`, and sections containing headings and paragraphs.

## One complete fact

```json
{
  "id": "tutto-coach",
  "sourceId": "tutto",
  "facet": "strategy coach",
  "aliases": [
    "coach",
    "otto",
    "llm",
    "ai",
    "ki",
    "strategy",
    "strategy suggestions",
    "spielhilfe",
    "strategie",
    "zugvorschlag"
  ],
  "standalone": ["ask otto"],
  "answer": {
    "en": "Tutto’s Ask Otto coach evaluates possible dice outcomes and explains a suggested move using the game’s rules and turn calculations.",
    "de": "Die Spielhilfe Ask Otto bewertet mögliche Würfelergebnisse und erklärt einen Zugvorschlag anhand der Spielregeln und Zugberechnungen."
  },
  "evidence": ["tutto.decisions", "tutto.outcome"]
}
```

The `tutto` source points to `/projects/tutto/`. The evidence pointers refer to reviewed sections of the project story.

## Updating a fact

1. Search for the existing fact and source IDs first. Keep each ID stable for the same claim. Review the English and Swiss German wording together, including the short lead if present. Add natural aliases in both languages. Keep private editorial material outside the catalogue.
2. Check the public source and anchor in both builds. Keep `sourceId` tied to the registry and update the evidence pointers when the supporting fields move. If a claim is withdrawn, remove its examples and direct routes as well.
3. Run `pnpm test` and review any intentional evidence-pin change before updating its snapshot. Rebuild both locales so the browser, gateway, and ranker agree on the corpus version. Replay the original fixtures in `tests/ask/questions.json` and the paraphrases in `tests/ask/paraphrases.json` through the local gateway, including unsupported cases.

## Reproduced coverage gaps

These are synthetic prompts tested against the current checkout. Index-only misses can still reach the selector in local mode.

| Prompt                                                                   | Observed gap                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| What projects is he working on?                                          | A fresh chat points to the project list without naming a project.        |
| Welche Projekte baut er gerade?                                          | A fresh chat finds no answer.                                            |
| What languages does he speak and what programming languages does he use? | The combined question finds neither set of languages.                    |
| Why does SpotifyTracker use Last.fm?                                     | Index mode links to the project without explaining catalogue enrichment. |
| Wie berechnet Otto in Tutto seine Empfehlungen?                          | Index mode links to Tutto without using the coach fact.                  |
| What has Timo built with C# and SQL?                                     | Index mode misses the Stadler plug-ins.                                  |

The older benchmark skipped Granite for empty lexical shortlists. Its SpotifyTracker rebuild and thesis-methods questions passed on the warm full gateway. The German long-pause question passed after adding the plural and inflected aliases. Keep these cases in the gateway regression set.
