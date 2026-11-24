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
ollama pull qwen3:4b-instruct-2507-q4_K_M
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

Qwen3-4B-Instruct-2507 Q4_K_M is a 2.5 GB text model with a pinned manifest
digest. It uses 2,048 context tokens and a 96-token completion budget. The model
receives the question and up to six public records. The browser keeps the
thread in tab memory until reload or reset. When it makes a gateway request,
it can include selected earlier questions and replies, up to 2,000 bytes of
history. Longer turns can be excerpted to fit. Local-only turns stay in the tab.
All callers share a six-per-minute request quota, a separate 60-per-hour
model budget and one in-flight inference. Reviewed answers can still be
served when inference is limited or unavailable.

The gateway gives inference six seconds. Prewarm the model if a cold load on
your machine takes longer.

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

The worker binds to `127.0.0.1:4515`. It ranks facts only when a question mentions
a catalogue topic and keyword matching comes up empty. Qwen sees at most two
ranked facts on this path, under the same six-second gateway deadline. When the
ranker is unavailable or its catalogue version differs, the gateway returns the
index response for those questions.

An optional private [Open WebUI model preset](https://docs.openwebui.com/features/workspace/models/)
can test a system prompt and a knowledge base made from the approved public facts.
To test the website's exact answers and citations from Open WebUI, a
[Pipe](https://docs.openwebui.com/features/extensibility/plugin/functions/pipe/)
can use the Ask gateway as the answer source.

## Docker smoke stack

Run these commands from the repository root on a Docker-enabled host.

```sh
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml config --quiet
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml --profile setup run --rm model-setup
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml up --build -d
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml exec -T ask node services/ask/ollama.ts
node services/ask/smoke.ts http://127.0.0.1:18093
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml restart ask
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml pause ollama
node services/ask/smoke.ts http://127.0.0.1:18093 --offline
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml unpause ollama
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml stop ask
node services/ask/smoke.ts http://127.0.0.1:18093 --gateway-offline
docker compose -p ask-work-smoke -f deploy/docker-compose.ask.yml down
```

The setup container downloads the model into a named volume. The website
publishes localhost port 18093 and proxies exactly `/api/ask` to the gateway.
The gateway shares the Ollama network namespace and reaches the model through
that namespace's loopback. Neither service publishes a host port. Runtime
inference uses an internal network. The ordinary Docker build stays on the
static site with the Ask panel off.

CI runs the smoke script with `--startup` to check the Ask-enabled image,
nginx proxy and bilingual reviewed replies without downloading model weights.
The full smoke also checks live inference and abstention. The offline phases
exercise reviewed fallback with Ollama paused and the static site with the
gateway stopped.

## Verify and update

```powershell
pnpm exec vitest run src/lib/ask/ask.test.ts
python -B -m unittest tests.ask.test_granite_worker
node tests/ask/evaluate.ts --index
node tests/ask/evaluate.ts
```

Prewarm the model before running the live fixtures. The small smoke set compares
approved answer IDs and abstention status in both languages. It runs against the
selector without consuming the browser quota. Separate gateway tests exercise
the request contract and timeout.

On the Windows workstation, Ollama 0.40.16 ran the pinned Qwen model on CPU and
passed all 32 fixtures. The 23 warm selector responses took 1.22 seconds at
the median and 1.31 seconds at p95. A separate cold HTTP request answered in
4.21 seconds. Ollama reported 2.88 GB loaded and zero VRAM. Measure these again
under the Docker host's normal load.

Review the source fields and both CVs when a pinned evidence hash changes.
Update the corresponding bilingual claims before approving the new snapshot.
Use the case study, job section, or CV page that supports each claim.

## Later adapter experiment

Freeze owner-reviewed EN and DE question families for evaluation. Compare the
index, the pinned unmodified model, and the same base with a separate adapter
using the same corpus and evaluation settings. Train the adapter only on
owner-authored examples with documented rights. Score claim and citation
accuracy, abstentions, latency and timeouts. Keep answers and citations in the
catalogue for every trial.
