<div align="center">
  <img src="frontend/public/favicon.svg" alt="Practo Scraper Logo" width="120" />
  <h1>Practo Data Scraper</h1>
  <p>
    <strong>A high-performance, resilient data extraction tool for Practo healthcare profiles.</strong>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Python-3.12+-blue.svg?style=flat-square&logo=python" alt="Python Version" />
    <img src="https://img.shields.io/badge/React-19-black.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/Vite-8-purple.svg?style=flat-square&logo=vite" alt="Vite" />
    <img src="https://img.shields.io/badge/Status-Production_Ready-success.svg?style=flat-square" alt="Status" />
  </p>
</div>

---

## Overview

The Practo Data Scraper is a robust, full-stack application designed to extract, validate, and enrich doctor profiles from Practo. Built to handle scale and edge-case instability, it bypasses native scraping traps (like CAPTCHA false-positives and hidden APIs) to deliver perfectly structured CSV and JSON datasets.

It features a hardened Python backend powered by **Crawl4AI** and **Playwright**, and a stunning, responsive frontend built with **React** and the **Clay Design System**.

---

## Core Features

- **Paranoid State Extraction:** Safely parses Redux states (`window.__REDUX_STATE__`) using regex fallback mechanisms, bypassing volatile DOM changes.
- **Intelligent Enrichment:** 
  - Resolves hidden virtual phone numbers via the native `/health/api/vn/vnpractice` API.
  - Utilizes Natural Language Processing (NLP) to infer missing gender tags from biographies.
  - Automatically extracts unlisted 6-digit Pincodes from complex address strings.
- **Resilience Mechanisms:** 
  - Exponential backoff for API rate limits.
  - Bypasses native login CAPTCHAs by prioritizing JSON payload extraction.
  - Halts cleanly on Server-Sent Events (SSE) disconnections.
- **Clay UI Interface:** A gorgeous, native-app feeling web interface with real-time streaming logs, animated progress tracking, and 1-click CSV/JSON exports.

---

## Quickstart Installation

You do not need to clone this repository manually. The installation is fully automated via a single-command setup pipeline.

### Requirements
- **Windows 10/11**
- **Python 3.12+** (Ensure it is added to your PATH)
- **Node.js**

### Setup Command

Open **Windows PowerShell** and execute the following command. It will automatically download the project, configure all dependencies (`uv` and `pnpm`), and generate a launcher shortcut on your Desktop:

```powershell
irm https://raw.githubusercontent.com/Ns81000/Practo-Scraper/main/install.ps1 | iex
```

### Starting the Application

Once installed, simply double-click the **Practo Scraper** shortcut on your Desktop. 
It will launch both the backend (Uvicorn) and frontend (Vite) servers and automatically open your default browser to `http://localhost:5173`.

### 🛡️ Bulletproof Installation
The setup script utilizes direct module invocation (`python -m uv`) to completely bypass common Windows `PATH` issues when resolving package managers globally.

---

## Application Architecture

The system is strictly decoupled into two isolated services:

### Backend (`/backend`)
- **Language:** Python
- **Package Manager:** `uv`
- **Framework:** FastAPI
- **Extraction Engine:** Crawl4AI / Playwright
- **Log Streaming:** SSE (Server-Sent Events)

### Frontend (`/frontend`)
- **Language:** TypeScript / TSX
- **Package Manager:** `pnpm`
- **Framework:** React 19 + Vite
- **Design System:** Custom Clay UI (`index.css`)
- **Routing:** Single Page Application (SPA)

---

## Usage Guide

1. **Location:** Enter the target city (e.g., `Hyderabad`, `Ludhiana`). The frontend autocomplete will suggest locations.
2. **Specialty:** Enter the target medical specialty (e.g., `Gastroenterologist`, `Dentist`).
3. **Limit:** Select the maximum number of profiles to extract, or select "Unlimited" for a full city-wide scrape.
4. **Execute:** Click Start. The Log Viewer will immediately begin streaming real-time JSON extraction events from the backend.
5. **Export:** Once completed, the dataset can be exported locally as `.csv` or `.json`.

---

## Extracted Data Points

The engine extracts 17 highly specific data points per profile:

1. Full Name
2. Gender *(Inferred via NLP if missing)*
3. Primary Specialty
4. Secondary Specialty
5. Hospital/Clinic Name
6. City
7. State
8. Training and Certifications *(Safely split from degrees)*
9. Years of Experience
10. Medical Council Registration
11. Education
12. Clinic Address
13. Pincode *(Regex extracted if missing)*
14. Mobile Number *(API enriched, strictly logs 404s as unprovisioned)*
15. Awards and Recognition
16. Membership
17. Notes / Biography

---

<div align="center">
  <p>Built for resilience and accuracy.</p>
</div>
