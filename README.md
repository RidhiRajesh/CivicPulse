# CivicPulse — Intelligent Smart-City Issue Reporting & Management Platform

CivicPulse is a problem-centric civic incident management platform designed for citizens, city authorities, and field workers. Multiple citizen reports referencing the same real-world civic problem are correlated into unified Civic Incidents using spatial proximity, category matching, and semantic analysis.

---

## 🛠️ Tech Stack

### Frontend
- **Framework & Build Tool:** React (v18), Vite
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer
- **Routing:** React Router DOM (v7)
- **HTTP Client:** Axios
- **Maps & Charts:** Leaflet, Recharts, Lucide React

### Backend
- **Runtime & Server:** Node.js, Express.js
- **API Style:** REST API
- **Authentication & Security:** JWT (JSON Web Tokens), bcryptjs, CORS
- **File Uploads:** Multer

### Database & ORM
- **Database:** PostgreSQL
- **ORM:** Prisma ORM

---

## 📂 Project Structure

```text
CivicPulse/
├── client/              # React + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/  # Shared components
│   │   ├── pages/       # HealthCheck and page views
│   │   ├── services/    # Axios API client
│   │   ├── App.jsx      # React Router routes
│   │   ├── main.jsx     # App entry point
│   │   └── index.css    # Tailwind CSS imports
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/              # Node.js + Express REST API Backend
│   ├── src/
│   │   ├── config/      # Prisma client setup
│   │   ├── controllers/ # Route logic (e.g., healthController)
│   │   ├── routes/      # API endpoints (e.g., /api/health)
│   │   └── index.js     # Express server setup
│   └── package.json
├── prisma/              # Prisma database schema
│   └── schema.prisma
├── uploads/             # Directory for uploaded issue media
├── .env.example         # Environment configuration template
├── .gitignore           # Git ignore configurations
├── package.json         # Root scripts helper
└── README.md            # Setup and execution guide
```

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **npm** (v9+ recommended)
- **PostgreSQL** instance running locally or on remote server

### 2. Environment Configuration
Create a `.env` file at the root by copying `.env.example`:

```bash
cp .env.example .env
```

Update `DATABASE_URL` in `.env` with your local PostgreSQL credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/civicpulse?schema=public"
JWT_SECRET="your_secure_jwt_secret_key"
VITE_API_BASE_URL="http://localhost:5000/api"
```

---

### 3. Install Dependencies

Install root, server, and client dependencies:

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

---

### 4. Prisma Setup

Generate the Prisma Client based on `prisma/schema.prisma`:

```bash
# From the project root
npm run prisma:generate

# Or inside server/
cd server
npx prisma generate --schema=../prisma/schema.prisma
```

---

## 🏃 Running the Application

### Start Backend Server
```bash
cd server
npm run dev
```
The backend API will run on **`http://localhost:5000`**.

### Start Frontend Application
In a separate terminal window:
```bash
cd client
npm run dev
```
The React frontend application will run on **`http://localhost:5173`**.

---

## 🏥 Verification & Health Check

- **Backend Health Check Endpoint:** `GET http://localhost:5000/api/health`
- **Frontend Status Page:** Navigate to `http://localhost:5173` in your browser to view the real-time system status and database connectivity indicator.
