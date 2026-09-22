# Internet Consensus Oracle — roadmap

- [x] Dark cyberpunk design tokens
- [x] Live-only GenLayer client via genlayer-js (no simulator, no mocks)
- [x] MetaMask connection: EIP-1193, account/chain listeners, balance, add/switch network
- [x] submit_question through the connected signer; exact qid captured via latest_qid_of delta
- [x] Strict per-qid polling with get_submission_status
- [x] Verdict card: evidence badge, confidence, claims, fetched URLs, retrieval audit
- [x] Recent verdicts feed with search, status filter, deep links (?qid=)
- [x] Route head metadata

Note: the contract 0xc2e0CB1284F33080B107cBD5E82C2A84bcC4e584 responds on GenLayer
Studionet (chain 61999); it is not deployed on Bradbury, so Studionet is the default.
