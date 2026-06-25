# Render + Cloudflare Deployment Design

## Goal

Deploy Regional Potential Lab from the private GitHub repository to an online Streamlit-compatible host, then expose it through the custom domain `regional-potential-lab.com` managed by Cloudflare.

## Chosen approach

Use Render as the primary host, in the Singapore region, with Railway as a fallback. Vercel is intentionally not used for the Streamlit runtime because this app is a long-running Python web service rather than a serverless ASGI/WSGI entrypoint.

## Render configuration

The repository includes `render.yaml` as a Render Blueprint:

- service type: web
- runtime: python
- region: singapore
- branch: main
- plan: free by default
- build command: install `requirements.txt` and optional `requirements-spatial.txt`
- start command: run Streamlit on Render's `$PORT`
- health check: `/`

If the Free instance cannot build or run GeoPandas/PySAL reliably, upgrade the Render service to Starter.

## Railway fallback

The repository includes `railway.json` with equivalent build and start commands. Railway should be used if Render has build-memory or dependency issues.

## Cloudflare DNS

After Render creates the service, add `regional-potential-lab.com` in Render Custom Domains. In Cloudflare:

- `@` CNAME -> Render `onrender.com` host, DNS only during verification
- `www` CNAME -> same Render host, DNS only during verification
- SSL/TLS mode: Full
- remove conflicting `A` and `AAAA` records

After Render certificate verification succeeds, Cloudflare proxying can be enabled. If Streamlit WebSocket instability appears, return records to DNS only.

## Data posture

The deployment package excludes generated outputs and uses `sample/` data by default. Real data can be uploaded through the app or committed to `data/` only after confirming data size, privacy, and licensing.
