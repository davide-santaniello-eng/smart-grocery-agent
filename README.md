# Smart Grocery Agent 🛒

> Personal AI-powered grocery optimization & household consumption agent.

Smart Grocery Agent minimizes grocery expenditure while taking into account store accessibility, product preferences, brand choices, inventory status, and consumption patterns.

---

## 🏗️ Architecture Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS (Hosted on GitHub Pages)
- **Backend API**: Python 3.12+ + FastAPI + Pydantic v2
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Optimization Engine**: Google OR-Tools CP-SAT Solver
- **AI Orchestration**: LLM with structured Tool Calling
- **Forecasting**: Event-sourced inventory tracking with consumption analytics

---

## 📁 Repository Structure

```text
├── docs/
│   ├── database.md         # Database schema, ER diagram, and dictionary
│   └── ...                 # Architectural and optimization specifications
├── supabase/
│   ├── migrations/         # Supabase PostgreSQL schema migrations
│   └── seed.sql            # Seed data (categories, canonical products, variants)
├── backend/                # FastAPI application (Python)
├── frontend/               # React + Vite application (TypeScript)
└── README.md
```

---

## 🚀 Getting Started with Database & Supabase

1. **Prerequisites**:
   - Supabase project or local Supabase CLI.

2. **Apply Database Migration**:
   - Run the initial migration: `supabase/migrations/20261105000000_initial_schema.sql`
   - Apply the catalog seed data: `supabase/seed.sql`

3. **Database Documentation**:
   - Complete ER diagram, data dictionary, and design decisions are documented in [`docs/database.md`](file:///home/davide/projects/grocery-agent/docs/database.md).
