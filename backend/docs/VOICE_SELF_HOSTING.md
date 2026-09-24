# Chatty voice worker: production self-hosting

The canonical, step-by-step deployment guide is published with the Chatty
documentation at [`guides/voice-self-hosting`](../../chatty/docs/guides/voice-self-hosting.mdx).
This backend copy is kept in the source distribution so operators who clone
only the API repository still have the deployment contract in-tree.

The supported topology is **managed Supabase + Chatty API + voice worker**.
Self-hosted LiveKit and its private Redis are optional. The worker's
`voice-agent/.env.example`, `voice-agent/docker-compose.yml`, `setup.sh`, and
`Dockerfile` are the executable reference. Apply migrations before starting
production calls, including the voice observability migration so the dashboard
can report latency, RSS memory, CPU, turns, nudges, errors, and cost.

For platform-specific instructions (Contabo/VPS, Railway, Render, Heroku),
TLS/firewall requirements, and troubleshooting, read the published guide.
