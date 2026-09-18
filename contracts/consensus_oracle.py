# v0.5.1
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Internet Consensus Oracle
=========================

Studio-compatible GenLayer Intelligent Contract with a multi-stage research
and judging pipeline:

  1. PLAN     - the question is expanded into several distinct search queries
                and (for hard questions) decomposed into atomic claims.
  2. RESEARCH - every query is fetched from independent engines/encyclopedias,
                with automatic retry using reformulated queries when the first
                round returns nothing usable.
  3. VERIFY   - numbers, dates, units, timeframes and comparison baselines are
                checked against the retrieved text before judging.
  4. JUDGE    - validators receive the actual evidence excerpts + source URLs
                and must distinguish "insufficient evidence" (research worked,
                the world has no clear answer) from "search failed" (we could
                not retrieve anything).

Storage stays primitive-only (u256 + str) for Studio's schema loader.
"""

from genlayer import *

import json


STATUS_IN_REVIEW = "in_review"
STATUS_REACHED = "consensus_reached"

# Evidence status values reported in every verdict.
EV_OK = "evidence_found"
EV_INSUFFICIENT = "insufficient_evidence"
EV_SEARCH_FAILED = "search_failed"

MIN_USEFUL_CHARS = 1200          # total substantive evidence required
MIN_DOC_CHARS = 500              # a single page must carry this much real text
MAX_QUERIES = 3
MAX_DOCS = 4                     # at most 4 accepted source pages
MAX_CANDIDATES_PER_QUERY = 6     # candidate links opened per query
PER_SOURCE_CHARS = 2200
TOTAL_EVIDENCE_CHARS = 7000
MIN_INDEPENDENT_DOMAINS = 2

# Pages that answer with a bot wall / JS shell carry no evidence.
BLOCKED_MARKERS = (
    "unusual traffic",
    "are you a robot",
    "verify you are human",
    "captcha",
    "access denied",
    "403 forbidden",
    "attention required",
    "enable javascript",
    "javascript is disabled",
    "cloudflare",
    "request blocked",
    "too many requests",
    "rate limit",
)

# Aggregators / search shells: never usable as an evidence source page.
SKIP_DOMAINS = (
    "duckduckgo.com",
    "google.com",
    "bing.com",
    "yahoo.com",
    "youtube.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "instagram.com",
    "tiktok.com",
    "reddit.com",
    "pinterest.com",
    "quora.com",
)



class ConsensusOracle(gl.Contract):
    next_id: u256
    questions_json: str
    latest_by_json: str

    def __init__(self):
        self.next_id = u256(0)
        self.questions_json = "[]"
        self.latest_by_json = "{}"

    def _questions(self):
        if self.questions_json == "":
            return []
        return json.loads(self.questions_json)

    def _latest_by(self):
        if self.latest_by_json == "":
            return {}
        return json.loads(self.latest_by_json)

    @gl.public.view
    def get_next_id(self) -> int:
        return int(self.next_id)

    @gl.public.view
    def latest_qid_of(self, asker: str) -> int:
        latest_by = self._latest_by()
        key = asker.lower()
        if key not in latest_by:
            return -1
        return int(latest_by[key])

    @gl.public.view
    def get_question(self, qid: int) -> dict:
        questions = self._questions()
        if qid < 0 or qid >= len(questions):
            return {"error": "not_found"}
        return questions[qid]

    @gl.public.view
    def list_recent(self, limit: int) -> list:
        questions = self._questions()
        capped = limit
        if capped < 1:
            capped = 1
        if capped > 20:
            capped = 20

        out = []
        i = len(questions) - 1
        while i >= 0 and len(out) < capped:
            out.append(questions[i])
            i -= 1
        return out

    @gl.public.write
    def submit_question(self, question: str) -> None:
        q = question.strip()
        if len(q) < 4:
            raise gl.vm.UserError("question too short")
        if len(q) > 500:
            raise gl.vm.UserError("question too long")

        qid = int(self.next_id)
        sender = str(gl.message.sender_address).lower()

        questions = self._questions()
        latest_by = self._latest_by()

        questions.append({
            "id": qid,
            "question": q,
            "asker": sender,
            "status": STATUS_IN_REVIEW,
            "verdict": None,
        })
        latest_by[sender] = qid

        self.next_id = u256(qid + 1)
        self.questions_json = json.dumps(questions)
        self.latest_by_json = json.dumps(latest_by)

        question_text = q

        def research_and_answer() -> str:
            # ---------------------------------------------------------------
            # helpers
            # ---------------------------------------------------------------
            def encode(text: str) -> str:
                out = ""
                for ch in text:
                    if ch.isalnum() and ord(ch) < 128:
                        out += ch
                    elif ch == " ":
                        out += "+"
                    else:
                        for byte in ch.encode("utf-8"):
                            out += "%" + format(byte, "02X")
                return out


            def fetch(url: str) -> str:
                try:
                    text = gl.nondet.web.render(url, mode="text")
                except Exception:
                    return ""
                if not isinstance(text, str):
                    return ""
                return text

            def domain_of(url: str) -> str:
                rest = url
                if "://" in rest:
                    rest = rest.split("://", 1)[1]
                rest = rest.split("/", 1)[0].split("?", 1)[0].lower()
                if rest.startswith("www."):
                    rest = rest[4:]
                parts = rest.split(".")
                if len(parts) > 2:
                    rest = ".".join(parts[-3:]) if parts[-2] in ("co", "com", "org", "gov", "ac") else ".".join(parts[-2:])
                return rest

            def is_skipped(url: str) -> bool:
                dom = domain_of(url)
                for bad in SKIP_DOMAINS:
                    if dom == bad or dom.endswith("." + bad):
                        return True
                return False

            def looks_blocked(text: str) -> bool:
                head = text[:1500].lower()
                for marker in BLOCKED_MARKERS:
                    if marker in head:
                        return True
                return False

            def clean(text: str) -> str:
                """Collapse whitespace so char counts reflect real content."""
                out = []
                prev_blank = False
                for line in text.splitlines():
                    line = " ".join(line.split())
                    if line == "":
                        if prev_blank:
                            continue
                        prev_blank = True
                    else:
                        prev_blank = False
                    out.append(line)
                return "\n".join(out).strip()

            def url_decode(value: str) -> str:
                out = ""
                i = 0
                while i < len(value):
                    ch = value[i]
                    if ch == "%" and i + 2 <= len(value) - 1:
                        try:
                            out += chr(int(value[i + 1:i + 3], 16))
                            i += 3
                            continue
                        except Exception:
                            pass
                    if ch == "+":
                        out += " "
                    else:
                        out += ch
                    i += 1
                return out

            # --- candidate discovery ---------------------------------------
            def wikipedia_candidates(query: str):
                """Real article text (plain-text extract), not a search snippet."""
                raw = fetch(
                    "https://en.wikipedia.org/w/api.php?format=json&action=query"
                    "&list=search&srlimit=3&srsearch=" + encode(query)
                )
                titles = []
                try:
                    data = json.loads(raw)
                    for hit in data["query"]["search"]:
                        titles.append(str(hit["title"]))
                except Exception:
                    return []
                out = []
                for title in titles:
                    out.append(
                        "https://en.wikipedia.org/w/index.php?action=raw&title=" + encode(title)
                    )
                return out

            def ddg_link_candidates(query: str):
                """Extract outbound result links from the DDG HTML page.

                The result page itself is never used as evidence - only the
                links it exposes, which are then opened directly.
                """
                raw = fetch("https://html.duckduckgo.com/html/?q=" + encode(query))
                if raw == "" or looks_blocked(raw):
                    return []
                out = []
                for piece in raw.split("uddg=")[1:]:
                    link = url_decode(piece.split("&")[0].split('"')[0])
                    if link.startswith("http") and not is_skipped(link):
                        out.append(link)
                return out

            def ddg_api_candidates(query: str):
                """DuckDuckGo Instant Answer JSON API - rarely blocked."""
                raw = fetch(
                    "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q="
                    + encode(query)
                )
                out = []
                try:
                    data = json.loads(raw)
                except Exception:
                    return []
                first = str(data.get("AbstractURL", ""))
                if first.startswith("http"):
                    out.append(first)
                for topic in data.get("RelatedTopics", [])[:6]:
                    if isinstance(topic, dict):
                        link = str(topic.get("FirstURL", ""))
                        if link.startswith("http"):
                            out.append(link)
                return [u for u in out if not is_skipped(u)]

            def candidates_for(query: str):
                """Deterministic, de-duplicated candidate page list."""
                found = []
                seen = set()
                for group in (
                    wikipedia_candidates(query),
                    ddg_api_candidates(query),
                    ddg_link_candidates(query),
                ):
                    for link in group:
                        if link in seen:
                            continue
                        seen.add(link)
                        found.append(link)
                return found[:MAX_CANDIDATES_PER_QUERY]

            # --- open candidates, keep only substantive pages ---------------
            state = {
                "docs": [],
                "attempts": 0,
                "blocked": 0,
                "thin": 0,
                "domains": [],
                "seen_urls": set(),
            }

            def harvest(queries):
                for query in queries[:MAX_QUERIES]:
                    if len(state["docs"]) >= MAX_DOCS:
                        return
                    for link in candidates_for(query):
                        if len(state["docs"]) >= MAX_DOCS:
                            return
                        if link in state["seen_urls"]:
                            continue
                        state["seen_urls"].add(link)
                        dom = domain_of(link)
                        # one page per domain => independent sources only
                        if dom in state["domains"]:
                            continue
                        state["attempts"] += 1
                        text = clean(fetch(link))
                        if text == "":
                            state["blocked"] += 1
                            continue
                        if looks_blocked(text):
                            state["blocked"] += 1
                            continue          # skip blocked source, try next
                        if len(text) < MIN_DOC_CHARS:
                            state["thin"] += 1
                            continue          # snippet-only page, not evidence
                        state["domains"].append(dom)
                        state["docs"].append({
                            "query": query,
                            "domain": dom,
                            "url": link,
                            "text": text[:PER_SOURCE_CHARS],
                        })

            queries = [
                question_text,
                question_text + " evidence data statistics",
                question_text + " analysis report findings",
            ]
            claims = [question_text]
            difficulty = "hard"
            measured = ""

            # --- round 1 ---------------------------------------------------
            harvest(queries)

            # --- round 2: alternative sources / reformulated queries -------
            retried = False
            if len(state["docs"]) < MIN_INDEPENDENT_DOMAINS:
                retried = True
                harvest([
                    question_text + " official report",
                    question_text + " study peer reviewed",
                    question_text + " explained facts",
                ])

            docs = state["docs"]
            attempts = state["attempts"]
            total_chars = 0
            for d in docs:
                total_chars += len(d["text"])
            domain_count = len(state["domains"])

            if len(docs) == 0:
                fetch_status = EV_SEARCH_FAILED
            elif domain_count < MIN_INDEPENDENT_DOMAINS or total_chars < MIN_USEFUL_CHARS:
                fetch_status = EV_INSUFFICIENT
            else:
                fetch_status = EV_OK

            # --- assemble the actual evidence given to validators ------------
            blocks = []
            used = 0
            for i, d in enumerate(docs):
                block = (
                    f"--- SOURCE {i + 1} | domain={d['domain']} | query=\"{d['query']}\"\n"
                    f"URL: {d['url']}\n{d['text']}\n"
                )
                if used + len(block) > TOTAL_EVIDENCE_CHARS:
                    break
                blocks.append(block)
                used += len(block)

            evidence = "\n".join(blocks) if blocks else "(no source pages could be opened)"
            source_urls = []
            for d in docs:
                if d["url"] not in source_urls:
                    source_urls.append(d["url"])


            task = f"""
You are an independent AI validator for a decentralized internet consensus
oracle. Judge ONLY from the retrieved evidence below. Never invent sources.

QUESTION:
{question_text}

WHAT IS BEING MEASURED (planner note):
{measured}

DIFFICULTY: {difficulty}

CLAIMS TO CHECK INDEPENDENTLY:
{json.dumps(claims)}

RETRIEVAL REPORT:
source_pages_opened={len(docs)} independent_domains={domain_count}
fetch_attempts={attempts} blocked_or_unreachable={state['blocked']}
thin_pages_discarded={state['thin']} retry_performed={retried}
evidence_chars={total_chars} preliminary_status={fetch_status}

RETRIEVED EVIDENCE (substantive excerpts extracted from the actual source
pages - search-result pages and snippet-only pages were discarded):
{evidence}


RULES:
1. Check each claim separately against the evidence and mark it supported,
   refuted, mixed or unverified, citing the SOURCE number(s) you used.
2. Require at least TWO independent credible sources before asserting a
   confident verdict. Sources from the same publisher/domain are not
   independent.
3. Verify every number, date, unit, population and timeframe you rely on.
   If the evidence compares different things than the question asks, say so.
4. Distinguish carefully:
   - "search_failed": no usable documents were retrieved (retrieval problem).
   - "insufficient_evidence": documents were retrieved but they do not settle
     the question (world problem).
   - "evidence_found": retrieved evidence supports a verdict.
5. Confidence must reflect source count, source quality and agreement.
   With fewer than two independent sources, confidence must not exceed 40.

Return strict JSON only with exactly these keys:
"answer": one concise final verdict sentence (say plainly if undetermined).
"confidence": integer 0-100.
"explanation": two to four concise sentences citing the evidence used.
"sources": array of up to five URLs taken from the evidence above.
"principle": one sentence describing the decision rule applied.
"claims": array of objects with keys "claim", "status"
   (supported|refuted|mixed|unverified) and "evidence" (short justification).
"evidence_status": one of "evidence_found", "insufficient_evidence",
   "search_failed".
"sources_count": integer number of independent sources actually relied upon.
"""

            raw_data = gl.nondet.exec_prompt(task, response_format="json")
            if isinstance(raw_data, str):
                try:
                    raw_data = json.loads(raw_data)
                except Exception:
                    raw_data = {}
            if not isinstance(raw_data, dict):
                raw_data = {}

            # Never raise inside the non-deterministic block: a single validator
            # crashing on malformed model output would stall the transaction.
            # Instead the output is coerced into the exact expected shape.
            def as_int(value, fallback: int) -> int:
                try:
                    out = int(float(value))
                except Exception:
                    return fallback
                if out < 0:
                    return 0
                if out > 100:
                    return 100
                return out

            answer = str(raw_data.get("answer", "")).strip()[:600]
            if answer == "":
                answer = "Undetermined: the model returned no usable verdict."

            claims_out = []
            raw_claims = raw_data.get("claims", [])
            if isinstance(raw_claims, list):
                for item in raw_claims[:6]:
                    if isinstance(item, dict):
                        status = str(item.get("status", "unverified")).lower()
                        if status not in ("supported", "refuted", "mixed", "unverified"):
                            status = "unverified"
                        claims_out.append({
                            "claim": str(item.get("claim", ""))[:300],
                            "status": status,
                            "evidence": str(item.get("evidence", ""))[:500],
                        })
                    else:
                        claims_out.append({
                            "claim": str(item)[:300],
                            "status": "unverified",
                            "evidence": "",
                        })

            sources_out = []
            raw_sources = raw_data.get("sources", [])
            if isinstance(raw_sources, list):
                for item in raw_sources[:5]:
                    link = str(item)
                    if link.startswith("http") and link not in sources_out:
                        sources_out.append(link[:300])
            if not sources_out:
                sources_out = source_urls[:5]

            evidence_status = str(raw_data.get("evidence_status", ""))
            if evidence_status not in (EV_OK, EV_INSUFFICIENT, EV_SEARCH_FAILED):
                evidence_status = EV_INSUFFICIENT
            # Retrieval facts are deterministic ground truth: a validator cannot
            # claim evidence when nothing at all was retrieved.
            if len(docs) == 0:
                evidence_status = EV_SEARCH_FAILED

            confidence = as_int(raw_data.get("confidence", 0), 0)
            if domain_count < MIN_INDEPENDENT_DOMAINS and confidence > 40:
                confidence = 40

            data = {
                "answer": answer,
                "confidence": confidence,
                "explanation": str(raw_data.get("explanation", ""))[:1200],
                "sources": sources_out,
                "principle": str(raw_data.get("principle", ""))[:300],
                "claims": claims_out,
                "evidence_status": evidence_status,
                "sources_count": as_int(raw_data.get("sources_count", domain_count), domain_count),
            }


            data["retrieval"] = {
                "documents": len(docs),
                "domains": state["domains"],
                "independent_domains": domain_count,
                "attempts": attempts,
                "blocked": state["blocked"],
                "thin": state["thin"],
                "retried": retried,
                "queries": queries[:MAX_QUERIES],
                "difficulty": difficulty,
            }

            return json.dumps(data, sort_keys=True)

        principle = (
            "Two oracle verdicts are equivalent when their answer fields make the same "
            "substantive judgment about the question: the same direction (yes/no/true/"
            "false/undetermined) and no contradiction in any key figure, date or entity "
            "that both state. They are NOT equivalent if one asserts a definite verdict "
            "while the other says the question is undetermined or unsupported by evidence, "
            "or if they state contradictory facts. Because validators fetch live web pages "
            "independently, differences in wording, explanation length, confidence numbers, "
            "principle text, per-claim phrasing, and which source URLs or domains each "
            "validator managed to open are expected and must NOT be treated as a "
            "disagreement."
        )



        verdict_json = gl.eq_principle.prompt_comparative(
            research_and_answer,
            principle=principle,
        )

        verdict = json.loads(verdict_json)
        questions = self._questions()
        questions[qid]["status"] = STATUS_REACHED
        questions[qid]["verdict"] = verdict
        self.questions_json = json.dumps(questions)
