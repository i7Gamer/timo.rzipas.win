"""Optional local Granite embedding ranker for the Ask gateway."""

import argparse
import base64
import hashlib
import json
import math
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


HOST = "127.0.0.1"
PORT = 4515
MAX_BODY_BYTES = 8 * 1024
MAX_QUESTION = 500
MAX_RESULTS = 4
MAX_TOKENS = 256
THREADS = 4
HTTP_TIMEOUT = 5
ONNX_SHA256 = "a6022dd8220ea6f6595562a1328ee216f4a94faa55362f2f4747c80f1e78772e"
TOKENIZER_SHA256 = "4f2842d568e2724370aec203652a42ac783c7937f8347a1a2cc7506d71f1582f"
TOKENIZER_CONFIG_SHA256 = "6ed69389e30a8ecabfce2f9ebcdf0c908b34056f24d994340f2f216521c057d5"
FACTS_PATH = Path(__file__).resolve().parents[2] / "src/data/ask/facts.json"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_catalogue():
    catalogue = json.loads(FACTS_PATH.read_text(encoding="utf-8"))
    # Match JS JSON.stringify(data), the representation used by catalogContent.
    content = json.dumps(catalogue, ensure_ascii=False, separators=(",", ":"))
    version = hashlib.sha256(content.encode("utf-8")).digest()
    version_text = base64.urlsafe_b64encode(version).decode("ascii").rstrip("=")
    answers = {fact["id"]: fact["answer"] for fact in catalogue["facts"]}
    return version_text, answers


CORPUS_VERSION, ANSWERS = load_catalogue()
FACT_IDS = tuple(ANSWERS)


def validate_request(value):
    if not isinstance(value, dict) or set(value) != {"question", "locale", "ids"}:
        raise ValueError("invalid request shape")
    question, locale, ids = value["question"], value["locale"], value["ids"]
    if not isinstance(question, str) or not question.strip() or len(question) > MAX_QUESTION:
        raise ValueError("invalid question")
    if locale not in ("en", "de"):
        raise ValueError("invalid locale")
    if not isinstance(ids, list) or not 1 <= len(ids) <= len(ANSWERS):
        raise ValueError("invalid candidate list")
    if any(not isinstance(item, str) or item not in ANSWERS for item in ids):
        raise ValueError("unknown candidate")
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate candidate")
    return {"question": question, "locale": locale, "ids": ids}


def rank(value, ranker):
    request = validate_request(value)
    ids = request["ids"]
    scores = ranker.score(request["question"], request["locale"], ids)
    if len(scores) != len(ids) or any(not math.isfinite(float(score)) for score in scores):
        raise ValueError("invalid scores")
    ordered = sorted(zip(ids, scores), key=lambda item: -float(item[1]))
    return {"corpusVersion": CORPUS_VERSION, "ids": [item for item, _ in ordered[:MAX_RESULTS]]}


class GraniteRanker:
    def __init__(self, model_dir):
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer

        model_dir = Path(model_dir).resolve()
        onnx_file = model_dir / "model_quint8_avx2.onnx"
        tokenizer_file = model_dir / "tokenizer.json"
        config_file = model_dir / "tokenizer_config.json"
        if any(sha256(path) != expected for path, expected in (
            (onnx_file, ONNX_SHA256),
            (tokenizer_file, TOKENIZER_SHA256),
            (config_file, TOKENIZER_CONFIG_SHA256),
        )):
            raise ValueError("Granite assets do not match pinned SHA256")
        self.np = np
        self.tokenizer = Tokenizer.from_file(str(tokenizer_file))
        config = json.loads(config_file.read_text(encoding="utf-8"))
        pad_token = config["pad_token"]
        pad_id = self.tokenizer.token_to_id(pad_token)
        if pad_id is None:
            raise ValueError("tokenizer pad token missing")
        self.tokenizer.enable_padding(pad_id=pad_id, pad_token=pad_token)
        self.tokenizer.enable_truncation(max_length=MAX_TOKENS)
        options = ort.SessionOptions()
        options.intra_op_num_threads = THREADS
        options.inter_op_num_threads = 1
        options.add_session_config_entry("session.intra_op.allow_spinning", "0")
        self.session = ort.InferenceSession(
            str(onnx_file), sess_options=options, providers=["CPUExecutionProvider"]
        )
        if self.session.get_providers() != ["CPUExecutionProvider"]:
            raise ValueError("CPU execution provider required")
        self.embeddings = {
            locale: self._embed([answers[locale] for answers in ANSWERS.values()])
            for locale in ("en", "de")
        }

    def _embed(self, texts):
        records = self.tokenizer.encode_batch(texts)
        fields = {
            "input_ids": [item.ids for item in records],
            "attention_mask": [item.attention_mask for item in records],
            "token_type_ids": [item.type_ids for item in records],
        }
        feed = {
            node.name: self.np.asarray(fields[node.name], dtype=self.np.int64)
            for node in self.session.get_inputs()
        }
        output, = self.session.run(None, feed)
        vectors = output[:, 0]
        norms = self.np.linalg.norm(vectors, axis=1, keepdims=True)
        if not self.np.isfinite(vectors).all() or not self.np.all(norms > 0):
            raise ValueError("invalid model embedding")
        return vectors / norms

    def score(self, question, locale, ids):
        query, = self._embed([question])
        positions = {fact_id: index for index, fact_id in enumerate(FACT_IDS)}
        return [float(self.embeddings[locale][positions[item]] @ query) for item in ids]


class Handler(BaseHTTPRequestHandler):
    ranker = None
    timeout = HTTP_TIMEOUT

    def _reply(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/rank":
            self._reply(404, {"error": 404})
            return
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            if length < 0 or length > MAX_BODY_BYTES:
                raise ValueError("invalid body size")
            if self.headers.get_content_type() != "application/json":
                self._reply(415, {"error": 415})
                return
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            status, payload = 200, rank(body, self.ranker)
        except ValueError:
            status, payload = 400, {"error": 400}
        except Exception:
            status, payload = 503, {"error": 503}
        self._reply(status, payload)

    def log_message(self, format, *args):
        return

    def do_GET(self):
        self._reply(405, {"error": 405})


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model_dir", help="directory containing pinned ONNX and tokenizer files")
    parser.add_argument("--port", type=int, default=PORT, help="loopback port (default: 4515)")
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    Handler.ranker = GraniteRanker(args.model_dir)
    server = HTTPServer((HOST, args.port), Handler)
    try:
        print(f"Granite ranker listening on http://{HOST}:{args.port}", flush=True)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
