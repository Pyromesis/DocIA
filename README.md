# DocIA — AI Document Intelligence Platform

<p align="center">
  <em>Privacy-first document scanning, extraction, and regeneration — powered by AI, stored locally.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active%20development-A47E4E" />
  <img src="https://img.shields.io/badge/license-MIT-B8925C" />
  <img src="https://img.shields.io/badge/storage-local%20only-5F865F" />
  <img src="https://img.shields.io/badge/PRs-welcome-5F865F" />
</p>

---

## Vision

**DocIA** transforms document workflows with a privacy-first approach. Upload any file — PDFs, scanned images, Word documents — and let our AI engine extract, analyze, and regenerate structured data using customizable templates.

> *"From chaos to structure — powered by intelligence, protected by design."*

---

## 🔒 Why Local Browser Storage?

DocIA uses **IndexedDB** (via [Dexie.js](https://dexie.org/)) as its primary storage engine. This is a deliberate architectural decision rooted in **user privacy and data sovereignty**:

| Principle | Implementation |
|---|---|
| **Zero Network Calls** | No data ever leaves the browser. Documents, templates, and preferences are stored in IndexedDB — a browser-native, sandboxed database. |
| **No Server Dependencies** | The app works fully offline after initial load. No cloud accounts, no API keys required for data storage. |
| **Full Transparency** | Users can export their entire dataset as human-readable JSON at any time. Every field is inspectable — no hidden data, no telemetry, no tracking. |
| **Instant Purge** | One-click "Wipe All Data" erases everything from the browser instantly. No residual caches, no server-side copies. |
| **Integrity Verification** | Every export includes a checksum. On import, the checksum is verified to detect file corruption or tampering. |
| **Origin Sandboxing** | IndexedDB is sandboxed per origin. Other websites cannot access DocIA data. |

### Data Architecture

```
IndexedDB: DocIA_LocalDB
├── documents       — Scanned files, extracted text, metadata
├── templates       — Output format definitions with field schemas
├── projects        — Organizational workspaces
├── preferences     — User settings (theme, language, etc.)
└── activityLogs    — Processing history and audit trail
```

### Data Operations

| Operation | Description |
|---|---|
| **Export** | Downloads a `.json` file with all tables, timestamped, checksum-protected |
| **Import** | Restores from a `.json` backup after checksum verification |
| **Wipe** | Clears all IndexedDB tables instantly — irreversible |
| **Seed** | First-run demo data for immediate exploration |

---

## Design Language

DocIA uses a **"Premium Stationery"** aesthetic:

| Element | Description |
|---|---|
| **Base** | Crisp whites (`#FDFCFA`) and soft cloud greys (`#F0EDEA`) |
| **Primary Accent** | Warm tan / taupe (`#B8925C`, `#A47E4E`) |
| **Secondary** | Deep coffee browns (`#7C5C3F`, `#644A34`) |
| **Languages** | 🇺🇸 English, 🇪🇸 Spanish, 🇨🇳 Mandarin Chinese |
| **Success** | Muted sage greens (`#5F865F`) |
| **Typography** | Inter (UI) + Playfair Display (brand) |
| **Shadows** | Soft, organic — never harsh |
| **Feel** | Clean, calm, expensive |

---

## Key Features

| Feature | Description |
|---|---|
| 📄 **Multi-format Scanning** | PDF, DOCX, PNG, JPG, TIFF |
| 🤖 **AI Extraction** | OCR + LLM pipeline for intelligent data extraction |
| 📐 **Template Engine** | **Formal Library** (Contracts, Invoices, Legal) + **AI Custom Builder** (Natural Language Instructions) |
| 📊 **Analytics** | Track processing accuracy, volume, and trends |
| 🗂️ **Projects** | Group documents into logical workspaces |
| 🔒 **Data Vault** | Full IndexedDB management — export, import, wipe |
| ✨ **Security Companion** | Animated AI assistant with privacy-focused guidance |
| ⚙️ **AI Connectivity** | Unified cloud/local AI management with hybrid mode |

---

## ⚙️ AI Connectivity & Hybrid Mode

DocIA features a **Global AI Switch** to transition between Cloud and Edge computing, ensuring privacy and flexibility.

| Mode | Description |
|---|---|
| **Cloud (API)** | Connects to major LLM providers (OpenAI, Anthropic, Gemini, Groq). API keys are stored locally and encrypted. Best for complex reasoning tasks. |
| **Local (Edge)** | **100% Privacy.** Disables all external API calls. Routes requests to local endpoints (e.g., Ollama, LM Studio). ideal for sensitive documents. |

**Key Capabilities:**
- **Unified Integration**: Manage all API keys in one secure dashboard.
- **Connection Testing**: Live validation of API keys and local server reachability.
- **Hardware Guidance**: In-app tips for optimizing local model performance (RAM/GPU).
- **Privacy Enforcement**: Strict routing logic ensures no data leaves the machine when Local Mode is active.

---

## 🖌️ Visual Template Annotation ("Paint Editor")

The **Template Library** module introduces a sophisticated visual editor for training the AI on custom document layouts.

- **Dual-Mode Interface**:
  - **Scan Mode (Upload & Scan)**: Routine processing using pre-defined templates.
  - **Design Mode (Templates)**: Visual annotation tool for creating new templates.
- **Color-Coded Semantic Mapping**:
  - 🔴 **Red (Variable)**: Dynamic fields (Dates, Invoice #, Totals).
  - 🔵 **Blue (Anchor)**: Static labels used for relative positioning.
  - 🟢 **Green (Table)**: Repeating structures and line items.
- **Technical Features**:
  - **Sticky Preview**: Left panel stays in view while scrolling results.
  - **Canvas Overlay**: HTML5 Canvas layer for precise bounding box drawing.
  - **Coordinate Normalization**: Annotations are stored as relative percentages (0-100%) to support any image resolution.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Frontend (React + Vite)              │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Sidebar   │  │ Main Content │  │  Security     │  │
│  │   Nav      │  │    Area      │  │  Companion    │  │
│  └───────────┘  └──────────────┘  └───────────────┘  │
├──────────────────────────────────────────────────────┤
│                  Local Data Layer                      │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Dexie.js │  │  IndexedDB   │  │   Export /    │  │
│  │  ORM      │  │  (Browser)   │  │   Import      │  │
│  └───────────┘  └──────────────┘  └───────────────┘  │
├──────────────────────────────────────────────────────┤
│                    API Gateway (Optional)              │
├──────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   OCR     │  │  AI / LLM    │  │   Template    │  │
│  │  Engine   │  │  Analysis    │  │    Engine     │  │
│  └───────────┘  └──────────────┘  └───────────────┘  │
│                 Backend (FastAPI) — Optional           │
└──────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite** — Lightning-fast builds
- **Tailwind CSS 4** — Custom warm palette
- **Framer Motion** — Fluid animations
- **Dexie.js** — Typed IndexedDB wrapper
- **Lucide React** — Consistent iconography

### Backend *(Planned / Optional)*
- **FastAPI** (Python) — Async API
- **Tesseract / PaddleOCR** — OCR
- **OpenAI / Local LLM** — Document intelligence

---

## Project Structure

```
src/
├── App.tsx                          # Root application shell
├── main.tsx                         # Entry point
├── index.css                        # Global styles & warm palette
│
├── db/                              # 🔒 Local Data Layer
│   ├── schema.ts                    # Dexie database class & entity types
│   ├── seed.ts                      # First-run demo data
│   └── operations.ts               # Export / Import / Wipe / Stats
│
├── hooks/
│   └── useDatabase.ts               # React hook for reactive DB state
│
├── types/
│   └── navigation.ts                # TypeScript interfaces
│
├── constants/
│   └── navigation.ts                # Nav configuration (incl. Data Vault)
│
├── utils/
│   └── cn.ts                        # Tailwind class merge
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx              # Collapsible sidebar
│   │   └── Header.tsx               # Top header with privacy indicator
│   ├── companion/
│   │   └── AICompanion.tsx          # Security-focused animated assistant
│   └── pages/
│       ├── DashboardPage.tsx        # Live stats from IndexedDB
│       ├── SettingsPage.tsx         # AI Connectivity & System Configuration
│       ├── DataVaultPage.tsx        # Export / Import / Wipe interface
│       └── EmptyPage.tsx            # Placeholder for unbuilt modules
```

---

## Quick Start

```bash
git clone https://github.com/your-org/docia.git
cd docia
npm install
npm run dev
```

---

## Security Model

```
┌─────────────────────────────────┐
│          User's Browser          │
│  ┌───────────────────────────┐  │
│  │      DocIA Application     │  │
│  │  ┌─────────────────────┐  │  │
│  │  │     IndexedDB        │  │  │
│  │  │  (Origin-Sandboxed)  │  │  │
│  │  │                      │  │  │
│  │  │  documents[]         │  │  │
│  │  │  templates[]         │  │  │
│  │  │  projects[]          │  │  │
│  │  │  preferences[]       │  │  │
│  │  │  activityLogs[]      │  │  │
│  │  └─────────────────────┘  │  │
│  │            │                │  │
│  │     Export ↓ ↑ Import       │  │
│  │     (.json backup file)     │  │
│  └───────────────────────────┘  │
│                                  │
│  ✗ No network calls             │
│  ✗ No cookies / tracking        │
│  ✗ No server storage            │
│  ✓ Full user control            │
│  ✓ Instant wipe capability      │
└─────────────────────────────────┘
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'feat: add my feature'`)
4. Push (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with care by the DocIA community.<br/>
  <em>Your documents. Your data. Your browser.</em>
</p>
