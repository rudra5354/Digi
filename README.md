# Digi-Doc — Secure Temporary Delivery Platform

Digi-Doc is a production-oriented, QR-based temporary package delivery platform. 

The core flow is: **Create Package → Generate QR → Share → Preview → Download → Auto Delete**.

---

## 🛠️ Technology Stack
* **Frontend**: React 19, Vite, TypeScript, Tailwind CSS
* **Backend**: Node.js, Express, TypeScript
* **Database & Storage**: Supabase PostgreSQL + Private Storage buckets
* **Auth**: Supabase Auth (Sender dashboards only; recipients do not need accounts)

---

## 📂 Project Structure
* `/backend` - Express API, Helmet security, rate limiter, and Zod configuration schema.
* `/frontend` - Vite dev server, React Router 7 layouts, and glassmorphic designs.
* `/database` - DDL schemas and migration files.

---

## ⚙️ How to Run the Application

### Option A: Concurrent Startup (Recommended)
You can run both servers concurrently with a single command from the root directory:
```bash
# 1. Start development mode
npm run dev
```

### Option B: Manual Startup (Separate Terminals)
If you prefer to run or debug components individually:

1. **Start the Backend**:
   ```bash
   cd backend
   npm run dev
   ```
   *Runs on [http://localhost:5000](http://localhost:5000)*

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   *Runs on [http://localhost:5173](http://localhost:5173)*
