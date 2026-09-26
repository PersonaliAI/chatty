# Chatty Backend API Google Cloud Run Deployment Guide

This guide details how to deploy the Chatty FastAPI Backend service to Google Cloud Run (`playvoid-280b1`).

---

## 1. Prerequisites

1. Google Cloud SDK (`gcloud`) installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project playvoid-280b1
   ```
2. Cloud Run & Artifact Registry APIs enabled:
   ```bash
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
   ```
3. Prepare `backend/env.yaml`:
   ```bash
   cd backend
   cp env.yaml.example env.yaml
   # Fill in SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY, and the LIVEKIT_* keys from your VPS!
   ```

---

## 2. Deploy Command

Deploy directly using source build to Cloud Run:
```bash
gcloud run deploy chatty-backend \
  --source . \
  --region us-central1 \
  --project playvoid-280b1 \
  --env-vars-file env.yaml \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300
```

---

## 3. Custom Domain & DNS Mapping

Map your custom backend domain (e.g. `api.chatty.personaliai.com`) to Cloud Run:
```bash
gcloud beta run domain-mappings create \
  --service chatty-backend \
  --domain api.chatty.personaliai.com \
  --region us-central1 \
  --project playvoid-280b1
```
Follow the DNS records provided in the output to configure your CNAME/A records.
