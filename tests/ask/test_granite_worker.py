import importlib.util
import json
from http.server import HTTPServer
import threading
import urllib.error
import urllib.request
import unittest
from pathlib import Path
from unittest.mock import Mock


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("granite_worker", ROOT / "services/ask/granite.py")
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class FakeRanker:
    def __init__(self, scores):
        self.scores = scores

    def score(self, question, locale, ids):
        return [self.scores.get(item, 0) for item in ids]


class RequestTests(unittest.TestCase):
    def test_validation_rejects_invalid_shapes_and_unknown_ids(self):
        valid = {"question": "question", "locale": "en", "ids": ["spotify-rewrite"]}
        for body in (
            {}, {**valid, "locale": "fr"}, {**valid, "ids": []},
            {**valid, "ids": ["missing"]}, {**valid, "ids": ["spotify-rewrite"] * 2},
            {**valid, "question": "x" * (worker.MAX_QUESTION + 1)},
            {**valid, "ids": [*worker.FACT_IDS, "spotify-rewrite"]},
            {**valid, "extra": True},
        ):
            with self.subTest(body=body):
                with self.assertRaises(ValueError):
                    worker.validate_request(body)

    def test_ranking_returns_only_scoped_ids_in_score_order_capped_at_four(self):
        allowed = [
            "spotify-rewrite", "spotify-python", "spotify-accounts",
            "spotify-recovery", "spotify-enrichment",
        ]
        result = worker.rank({"question": "q", "locale": "en", "ids": allowed}, FakeRanker({
            "spotify-rewrite": 0.1, "spotify-python": 0.9, "spotify-accounts": 0.8,
            "spotify-recovery": 0.7, "spotify-enrichment": 0.6,
        }))
        self.assertEqual(result, {"corpusVersion": worker.CORPUS_VERSION, "ids": allowed[1:]})

    def test_equal_scores_keep_gateway_candidate_order(self):
        ids = ["spotify-rewrite", "spotify-python"]
        result = worker.rank({"question": "q", "locale": "de", "ids": ids}, FakeRanker({}))
        self.assertEqual(result["ids"], ids)

    def test_ranks_the_full_scoped_catalogue_but_only_returns_four(self):
        ids = list(worker.FACT_IDS)
        result = worker.rank({"question": "q", "locale": "en", "ids": ids}, FakeRanker({}))
        self.assertEqual(result["ids"], ids[:4])

    def test_http_endpoint_returns_json_and_rejects_oversized_body(self):
        worker.Handler.ranker = FakeRanker({"spotify-rewrite": 1})
        server = HTTPServer((worker.HOST, 0), worker.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://{worker.HOST}:{server.server_port}/rank"
        try:
            body = json.dumps({"question": "q", "locale": "en", "ids": ["spotify-rewrite"]}).encode()
            request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=3) as response:
                result = json.loads(response.read())
                self.assertEqual(response.status, 200)
                self.assertEqual(result["ids"], ["spotify-rewrite"])
            too_large = urllib.request.Request(
                url, data=b"x" * (worker.MAX_BODY_BYTES + 1),
                headers={"Content-Type": "application/json"},
            )
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(too_large, timeout=3)
            self.assertEqual(error.exception.code, 400)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
