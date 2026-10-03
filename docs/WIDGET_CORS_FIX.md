# Widget customization CORS repair — 2026-10-04

The visitor-identity transport sends `X-Chatty-Visitor` on widget API requests.
The public widget preflight middleware intercepted OPTIONS requests before the
general CORS middleware, but its explicit header allowlist omitted that header.
Browsers consequently rejected theme reads even though a direct API GET worked.
The widget then displayed its default name, orange color and minimal preset.

Source commit: `137626ecf730d9b0b725e3bdb9ecdefe5bde99d3`.
The repair adds only `X-Chatty-Visitor` to the explicit widget header allowlist;
it does not alter identity checks, dashboard origin restrictions, secrets or SQL.

Validation:

- 38 focused widget-CORS and contact-identity tests passed.
- CI `37145540289`, compose smoke `37145540190`, CodeQL `37145540267`
  and secret scan passed.
- Candidate and production: readiness 200, widget preflight 204 advertising
  `X-Chatty-Visitor`, and anonymous protected Inbox access 401.
- Live main-page widget restored the saved name, logo, colors and Neubrutalism
  cards. The embed preview route used by Customizer loaded Neubrutalism,
  DM Sans and 105% scaling without browser fetch errors. Settings were not edited.

Cloud Run service `chatty-api`, project `personaliai`, region `us-central1`:
`chatty-api-cors-20261004` receives 100% traffic. Built from the canonical
`backend/` source using its Dockerfile, with existing service identity and secret
bindings preserved. Candidate tag was removed after verification/promotion.
No frontend or VPS deployment was necessary for this repair.

Rollback (restores the previous image but also restores the CORS defect):

```powershell
gcloud run services update-traffic chatty-api --project personaliai --region us-central1 --to-revisions chatty-api-00166-nlw=100
```

Reproduce regression checks from the repository root:

```powershell
backend/.venv311/Scripts/python.exe -m pytest backend/tests/test_widget_cors.py backend/tests/test_contact_identity.py -q
```

Already-open widgets should be reloaded to rerun their initial theme request.
