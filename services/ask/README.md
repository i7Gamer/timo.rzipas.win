# Ask about Timo

This prototype uses the public fact catalogue in `src/data/ask/facts.json`. The
model selects numbered evidence. The gateway renders the reviewed wording and
links from the catalogue, and the browser checks them against its own copy.
The panel includes three static answers in each language.
Ask-enabled builds also extract the main text of every rendered public page into
a matching per-language `/ask-content.json`. The index is generated and served
with the pages, and the browser revalidates it on each question. Named page
overviews can cite the page directly. Compound questions can surface up to
three distinct excerpts across sources. The answer shows the supported parts
first, with each source linked, and identifies any part the excerpts leave open.
When the selector cannot answer, the panel can show related text or link to the
matching page. Page excerpts work with inference offline.

The chat shows the current conversation and uses cited projects or sections to
resolve follow-up questions. **New chat** clears the thread and its context.
Greetings, letter counts, and unambiguous spelling corrections for known
project names are handled in the browser.

The page index includes content in expandable sections. It excludes navigation,
the Ask panel and live service-status labels. For current service uptime, use the
status displayed on the Homelab page.

## Run on this workstation

Use Node 24 and the repository's pinned pnpm. Build both static pages once.

```powershell
pnpm install --frozen-lockfile
$env:ASK_WORK = 'local'
pnpm build
```

Start a dedicated, cloud-disabled Ollama instance in a PowerShell window. It
uses a separate loopback port. Set Ollama's model directory before starting it
if you want a separate model store.

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_QUEUE = '1'
$env:OLLAMA_NOPRUNE = '1'
$env:OLLAMA_DEBUG_LOG_REQUESTS = 'false'
ollama serve
```

In another window, pull the pinned model once and start the gateway.

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
ollama pull qwen3:1.7b
node services/ask/server.ts
```

Start the two previews in separate windows.

```powershell
$env:ASK_WORK = 'local'
$env:LOCALE = 'en' # Use 'de' in the second window.
pnpm preview --ignore-lock
```

Open [English](http://127.0.0.1:4511/) or [German](http://127.0.0.1:4512/).
These local preview ports select the two static outputs. The production site
continues to use same-URL language negotiation. The preview proxy handles only
`POST /api/ask` at the gateway, whose listener is on `127.0.0.1:4513`.

Qwen3 1.7B Q4_K_M is a 1.4 GB text model with a pinned manifest digest, run
without thinking. It uses 2,048 context tokens and a 96-token completion
budget. The model receives the question and up to six public records. It returns
one relevance flag per record, which makes it judge every record instead of
picking a few. More than three relevant records fail verification and fall back
to the page excerpt. Before the question, the model sees five worked selections
about an invented person, which show answering, partial and abstaining. They
form a fixed prompt prefix that Ollama keeps cached between requests. The
project-scope clarification still picks slot numbers, and a repeated slot
counts once. The browser keeps the
thread in tab memory until reload or reset. When it makes a gateway request,
it can include selected earlier questions and replies, up to 2,000 bytes of
history. Longer turns can be excerpted to fit. Local-only turns stay in the tab.
All callers share a six-per-minute request quota, a separate 60-per-hour
model budget and one in-flight inference. Reviewed answers can still be
served when inference is limited or unavailable.

Recognized summary requests return reviewed facts by default. Set
`ASK_SUMMARIES=on` in a native gateway or preview environment to let the pinned
local `LiquidAI/lfm2.5-1.2b-instruct:q4_k_m` select and order approved fact IDs.
The gateway renders the corresponding reviewed text and citations. This route
has its own inference budget. It returns the reviewed fallback if the model is
unavailable or returns an invalid selection. The packaged Qwen profile sets
`ASK_SUMMARIES=off`.

The gateway gives evidence selection six seconds and summary generation eight
seconds. The browser and nginx allow ten seconds for the gateway response.
After a selector deadline, one request can reserve the inference slot and let
Ollama settle for up to 350 ms inside that request's deadline. The existing
cooldown still applies after repeated upstream failures.

Use a validated chat probe to warm the pinned selector. Set `ASK_WARMUP=on`
to run it at gateway startup. Reviewed answers remain available during the
probe, and the gateway logs `Ask chat ready` after a verified response.

```sh
node services/ask/ollama.ts
```

For the static preview with examples and page excerpts, set `ASK_WORK=index`,
rebuild, and start the previews with that setting. Use `ASK_WORK=off` or unset
the variable for the ordinary site build. Opt-in output goes into `dist/ask-local` or
`dist/ask-index`. Stop the local processes with Ctrl+C in their windows.

## Try the optional Granite ranker locally

Use the same build and preview commands with `ASK_WORK=local` and
`ASK_GRANITE=local`. Set `ASK_GRANITE=local` in the gateway and prewarm
windows as well. Start the dedicated Ollama on `127.0.0.1:11436` using a
separate model store. Open the [English preview](http://127.0.0.1:4521/) or
[German preview](http://127.0.0.1:4522/). The gateway listens on port 4523.

Use Python 3 with an isolated environment. Put `onnx/model_quint8_avx2.onnx`,
`tokenizer.json` and `tokenizer_config.json` from the
[pinned Granite 97M release](https://huggingface.co/ibm-granite/granite-embedding-97m-multilingual-r2/tree/835ad14087e140460703cf0fae09f97d469d65c2)
in the same model directory. The worker verifies the three file hashes on startup.

```powershell
python -m pip install onnxruntime==1.32.0 tokenizers==0.23.3 numpy==2.5.5
python -B services/ask/granite.py C:/path/to/granite
```

Wait until the worker prints its listening line, then send a rank request.
Expect a `corpusVersion` and a ranked list drawn from the requested IDs.
The ranker benchmark below exercises the same worker through the gateway.

```powershell
$rankRequest = '{"question":"How did SpotifyTracker recover missed plays?","locale":"en","ids":["spotify-recovery","spotify-python"]}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4515/rank -ContentType application/json -Body $rankRequest
```

The worker binds to `127.0.0.1:4515` by default. It ranks facts only when a question mentions
a catalogue topic and keyword matching comes up empty. A follow-up that names
no topic is ranked within the topics of the previous turn. Qwen sees at most
four ranked facts on this path (two beside the broad topic overviews), under
the same six-second gateway deadline. When the ranker is unavailable or its
catalogue version differs, the gateway returns the index response for those
questions. Restart the worker after any change to `facts.json`; the evaluator
refuses to run against a worker that serves an older catalogue version.

An optional private [Open WebUI model preset](https://docs.openwebui.com/features/workspace/models/)
can test a system prompt and a knowledge base made from the approved public facts.
To test the website's exact answers and citations from Open WebUI, a
[Pipe](https://docs.openwebui.com/features/extensibility/plugin/functions/pipe/)
can use the Ask gateway as the answer source.

## Packaged Qwen Docker verification

Run from the repository root with Docker Compose available. Use a fresh project
name for each run so the model volume and containers are isolated. The checked
port, `18093`, must be free. The setup step downloads only the pinned Qwen model
into that project's volume; it does not start the website or gateway.
The packaged profile warms the chat path at startup and keeps Qwen resident
for ten minutes after use. For a true cold benchmark and repeated gateway
restarts between batches, set `ASK_WARMUP=off` in the isolated test stack
and run the chat probe manually before warm measurements.

```sh
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml config --quiet
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml --profile setup run --rm model-setup
ASK_WARMUP=off ASK_TIMINGS=on docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml up --build -d
mkdir -p .local-ask
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --cold-only --report .local-ask/qwen-docker-cold.json
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml restart ask
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml exec -T ask node services/ask/ollama.ts
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --warm-only --report .local-ask/qwen-docker-warm.json
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml restart ask
node services/ask/smoke.ts http://127.0.0.1:18093
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml restart ask
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml pause ollama
node services/ask/smoke.ts http://127.0.0.1:18093 --offline
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml unpause ollama
# Wait for the Ollama container to report healthy before continuing.
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml ps ollama
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml restart ask
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml stop ask
node services/ask/smoke.ts http://127.0.0.1:18093 --gateway-offline
ASK_SMOKE_URL=http://127.0.0.1:18093 pnpm vitest run src/lib/ask/packaged-outage.test.ts
docker compose -p ask-qwen-check-20261124 -f deploy/docker-compose.ask.yml down
```

The HTTP evaluator runs the full fixture suite selected by its flags:
`--routing` runs the routing gate, `--answers` runs approved-answer fixtures,
and no suite flag runs the full baseline, paraphrase and held-out set. These
HTTP suites use the same expectations as the in-process evaluator. Reports label
the approved expectations `approved-v2` and the historical `--baseline`
expectations `baseline-v1`. Run `--suite-only` after preloading to measure the
selected suite separately from a cold probe. The evaluator also has
`--cold-only` and `--warm-only` smoke paths. The cold
path sends one English Flask question before any model preload and requires an
HTTP 200 `answer`, `mode: local`, the exact `spotify-python` claim and its
canonical citation. Restart only `ask` afterward to clear gateway quotas; this
leaves Ollama running and its loaded model intact. `node services/ask/ollama.ts`
runs a real selection with the pinned model and validates the result without
consuming gateway quota. The warm
path then requires an English and a German Flask answer with `mode: local` and
the exact reviewed claim and citation in each locale, plus a reviewed Canadian
capital abstention with no claims or citations and `mode: local`. A warm failure
does not hide the cold report, and a cold failure does not prevent a separate
warm run. Each report records HTTP/result status, mode, claim IDs, citation
links and latency; warm p95 includes only local results. The fixed warm set is
three gateway requests, within the retrieval budget.

The default evidence deadline remains six seconds. To compare eight seconds,
set `ASK_SELECTOR_TIMEOUT_MS=8000` with the same warm-up and timing settings,
then run `docker compose up -d --no-deps ask` on the isolated test project and
repeat the warm suite. `ASK_TIMINGS=on` logs model load, prompt processing and
generation timings plus gateway failures without question or answer text.
`ASK_OLLAMA_THREADS` (default 4) sets the CPU threads per model request. On a
busy shared host, more threads made requests slower. On a 20-thread
i5-13500 host at 54–89 % load from other work, a warm selector request in the
8-CPU Docker VM took 3.6–3.7 s with 4 threads and 6.2–6.3 s with Ollama's
default thread count. In a 16-CPU VM, generation ran at about 4 tokens/s with 4
threads and below 1.5 tokens/s with 6 or more.

Full HTTP evaluation exceeds the per-process gateway quota. Add
`--reset-compose-project <project-name>` to an HTTP suite command to restart
only that Compose project's `ask` service after each four fixture requests.
The flag is restricted to loopback URLs and a validated project name; it keeps
Ollama and its loaded model running. Before the first restart it checks that
`docker compose port website 80` for that project publishes the tested URL
and that the project has the `website`, `ask` and `ollama` services; otherwise
it refuses. Do not use it for a service outside the dedicated evaluation
Compose project.

### Model gate

Three time limits apply, each measured differently:

- **Selector deadline** (`ASK_SELECTOR_TIMEOUT_MS`, 6 s): the gateway's own
  limit for one model selection. Past it the gateway answers 503.
- **Warm p95** (4 s): p95 of successful local answers, end to end over HTTP,
  once the model is loaded.
- **Cold end to end** (6 s): the first request after a fresh start.

`--gate` runs the packaged warm cases plus English and German SpotifyTracker
recovery sentinels that only the local model answers. It fails when a
sentinel misses its reviewed answer, when answers fall back to the index,
when any request times out or fails, or when a time limit is exceeded. It
prints answered/total per route. After each `ask` restart the evaluator waits
for the gateway's warm-up log line, because HTTP readiness comes first and the
gateway answers 503 while it warms up. `--recovery` runs on its own: it waits
for warm-up, pauses the project's `ollama` container, requires a 503 during
the outage (a quota 429 or a fallback does not count), resumes it and then
asks every 12 seconds (inside the normal quota, without restarting `ask`)
until a local answer arrives or two minutes pass. Both exit non-zero on
failure.

Every HTTP report records the git commit and whether the worktree was clean,
the model and digest, context size, budgets, how the model was warmed, and
with a Compose project its image IDs, `ASK_*` settings and Docker CPU and
memory.

```sh
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --gate --reset-compose-project ask-qwen-check-20261124 --report .local-ask/gate.json
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --recovery --reset-compose-project ask-qwen-check-20261124 --report .local-ask/recovery.json
```

From the repository root, preload the pinned model and run each packaged suite
against the dedicated target host. Replace the project name and URL with the
values for that run.

```sh
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --suite-only --routing --reset-compose-project ask-qwen-check-20261124 --report .local-ask/routing.json
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --suite-only --answers --reset-compose-project ask-qwen-check-20261124 --report .local-ask/approved.json
node tests/ask/evaluate.ts --http http://127.0.0.1:18093 --suite-only --reset-compose-project ask-qwen-check-20261124 --report .local-ask/full.json
```

Restart only `ask` again before the ordinary live smoke. It checks exact
bilingual local answers and their citations while the same Ollama model remains
warm. The `--offline` phase pauses Ollama and checks reviewed index answers plus
the no-store 503 response. The `--gateway-offline` phase stops `ask` and checks
nginx's no-store unavailable response; `packaged-outage.test.ts` then runs the
real browser chat against the packaged page and requires a reviewed excerpt
and citation in English and German. Wait for Ollama's health check after
unpausing it before starting a stopped gateway. CI runs both startup and gateway-stopped
smoke without pulling model weights. The optional JSON reports preserve each
phase's results for review.

The website publishes only localhost port 18093 and proxies exactly
`/api/ask`. The gateway shares Ollama's network namespace and reaches the model
through that namespace's loopback. Neither service publishes a host port and
runtime inference uses an internal network. The ordinary Docker build stays on
the static site with the Ask panel off. `down` removes this project's
containers and network but retains its named model volume; remove the volume
only when you intend to delete the downloaded model.

CI runs the smoke script with `--startup` to check the Ask-enabled image,
nginx proxy and bilingual reviewed replies without downloading model weights.

## Verify and update

```powershell
pnpm exec vitest run src/lib/ask/ask.test.ts
python -B -m unittest tests.ask.test_granite_worker
node tests/ask/evaluate.ts --index
node tests/ask/evaluate.ts --lexical
$env:ASK_GRANITE = 'local'
node tests/ask/evaluate.ts --rank-port 4515
Remove-Item Env:ASK_GRANITE
```

`--index` needs no inference service. `--lexical` uses the pinned Ollama model
with lexical retrieval. Start Granite with its default port 4515, then run the
final command with `ASK_GRANITE=local`; it checks real fixture requests through
the gateway. The worker loads and embeds the pinned model before binding, so a
successful connection and `/rank` GET response of `405` confirm ranker
readiness. A fallback response by itself does not. Index and lexical modes are
diagnostic local modes and report no HTTP outages because they do not contact
the gateway. The fixtures compare approved evidence IDs and abstention in both
languages.

On 27 November 2026 the Windows workstation compared three CPU models in the
native gateway at 25–85% host load. The full suite has 49 model-routed
questions.

| Model                      | Correct | Median | p95   |
| -------------------------- | ------- | ------ | ----- |
| Qwen3 4B Instruct 2507     | 48/49   | 4.5 s  | 5.5 s |
| LFM2.5 1.2B                | 38/49   | 2.2 s  | 2.8 s |
| Qwen3 1.7B, slot picking   | 43/49   | 1.5 s  | 2.1 s |
| Qwen3 1.7B, per-slot flags | 45/49   | 2.5 s  | 3.5 s |

The two Qwen3 1.7B rows used worked examples. The per-slot run had 56% host load
against 23% for slot picking, so their times are not directly comparable.

The 4B model missed the six-second deadline for most packaged requests whenever
batch jobs loaded the host. Qwen3 1.7B was chosen for its speed. Its remaining
misses:

- It does not select the reviewed denial that other Abacus teams develop the
  document recognition, for four recognition questions that reach the model.
- It adds a related Hearthcoil fact to both Hearthcoil rules-testing
  paraphrases.

After the recognition fact became an explicit denial, the full suite scored
82/88 (38/44 model questions). Five recognition questions now take the
reviewed route.

Prompt variants did worse: rule lists, a three-level score per record, and
extra sentences about same-project facts each scored 42–43/49. A worked example
of a denial scored 37/44. Passing the `partial` flag with a limitation rule and
the question last scored 33/44. Qwen3 1.7B at Q8 scored the same 82/88 with
different misses and was 15–35% slower than Q4 in alternating runs.

The fixed-candidate test (see below) then showed that per-slot flags mark
every same-project fact relevant once a list holds three or six facts. The
selector went back to slot picking, with the question after the evidence and
one slot per part of a multi-part question. Fixed-candidate results, sizes 1,
3 and 6, natural, reversed and one shuffled order:

| Selector                             | Dev set | Built-in suite |
| ------------------------------------ | ------- | -------------- |
| Qwen3 1.7B, per-slot flags           | –       | 50/314         |
| Qwen3 4B, slot picking (1.7B prompt) | –       | 128/314        |
| Qwen3 1.7B, slot picking             | 183/445 | 219/314        |
| … question last                      | 216/445 | 206/314        |
| … question last, one slot per part   | 267/445 | 187/314        |

The last row, now in use, scored 87/88 end to end (43/44 model questions;
median 2.3 s, p95 3.6 s), against 84/88 for plain slot picking. It still
misses "Did Timo build OCR recognition for Abacus?". A yes/no rule helped
alone but lowered the combination.

On the 120-question dev set, end to end:

| Change                                              | Dev set |
| --------------------------------------------------- | ------- |
| Granite worker serving an older catalogue (stale)   | 30/120  |
| Granite restarted on the current catalogue          | 44/120  |
| Four ranked facts instead of two                    | 45/120  |
| Follow-ups ranked within the previous turn's topics | 58/120  |
| Project names as topics of every project source     | 60/120  |

The built-in suite stayed at 87/88 throughout. Ranking the remaining topic
facts beside a lexical shortlist left the dev set at 60/120 and dropped the
built-in suite to 68/88, because the selector then adds same-project facts.

Remaining dev misses: 21 questions reach the selector with the right facts
but get a wrong selection, and keyword matching often finds only one part of a
two-part question.

Measure again under the Docker host's normal load.

Review the source fields and both CVs when a pinned evidence hash changes.
Update the corresponding bilingual claims before approving the new snapshot.
Use the case study, job section, or CV page that supports each claim.

## Question sets and selector-only runs

The built-in 88 questions have shaped the prompt and rules, so treat them as
development data. New question sets are JSON arrays with `id`, `family`,
`category`, `locale`, `question`, optional `history` (earlier questions with
the fact ids they were answered with), `status` and `acceptableIds`. The
loader rejects unknown fact ids, empty answers and more than three facts per
answer.

```powershell
node tests/ask/evaluate.ts --rank-port 4535 --questions tests/ask/dev-questions.json --report .local-ask/dev.json
node tests/ask/fixed-candidates-run.ts --from-report .local-ask/dev.json --sizes 1,6 --shuffles 2 --report .local-ask/dev-fixed.json
```

Every evaluator row records:

- whether `approved-answers.json` replaced its expectation
  (`expectationOverlay`)
- the number of selector calls
- each model call's raw reply, prompt and output tokens, and load, prompt and
  generation times

Over HTTP the gateway runs in another process, so these stay empty. The
selector skips the model when it has no evidence.

The fixed-candidate run measures the selector apart from routing. It gives
the selector the expected facts plus facts from the same project (by fact id
prefix), at each list size. Each list runs in natural, reversed and seeded
shuffled order. The run reports accuracy per size and order, and the
questions whose result depends on the order.

When a final held-out set is imported as `tests/ask/final-questions.json`,
freeze the questions that are already answered without the model:

```powershell
node tests/ask/final-guard.ts --freeze
```

From then on, a test fails if a later rule answers another final question
without the model, since such a rule would leak that question into the code.
Of the current 48 held-out questions, 9 are answered without the model.

## Later adapter experiment

Freeze owner-reviewed EN and DE question families for evaluation. Compare the
index, the pinned unmodified model, and the same base with a separate adapter
using the same corpus and evaluation settings. Train the adapter only on
owner-authored examples with documented rights. Score claim and citation
accuracy, abstentions, latency and timeouts. Keep answers and citations in the
catalogue for every trial.
