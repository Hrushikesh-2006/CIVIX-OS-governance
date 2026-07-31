# 🏛️ CIVIX OS - Autonomous Smart Civic Governance Platform

> **Transforming Urban Municipalities Through Artificial Intelligence, 100% Anti-Corruption Public Auditability, and Gamified Citizen Participation.**

---

## 👥 Project Team

- **Captain / Project Lead**: Anumula Hrushikesh
- **Team Members**: Sai Prakash Reddy, Megna
- **Repository**: [CIVIX-OS-governance](https://github.com/Hrushikesh-2006/CIVIX-OS-governance)

---

## 📌 Executive Summary

**CIVIX OS** is a state-of-the-art civic operating system built to modernize public municipal management. By pairing **Google Gemini AI Vision** for autonomous complaint auto-triage with a **100% Public Audit Trail**, CIVIX OS eliminates administrative delays, prevents fund misallocation, and reduces government corruption. 

Citizens earn **+10 Civic Coins** for reporting issues and climb the city **Champions Leaderboard**, while municipal department officials receive pre-classified dispatch tickets requiring verified **After-Repair Photo Proofs** before ticket closure.

---

## 🌟 Key Application Screenshots & Interface Demonstrations

### 1. Autonomous AI Triage & Vision Processing
![Smart City AI Vision Triage](./public/landing_smart_city_ai.png)
*Google Gemini AI Vision automatically classifies complaint category (e.g. Water Leakage, Pothole, Power Grid), evaluates urgency, and dispatches the ticket to the responsible department in milliseconds.*

### 2. Dual-Card Verification Proof & Anti-Corruption Auditability
![Official Dual-Card Verification Proof](./public/landing_official_verification.png)
*Officials cannot mark an issue "Resolved" without uploading an after-fixing proof photo, notes, and timestamped site location, creating a 100% transparent public audit record.*

### 3. Gamified Citizen Rewards & Champions Leaderboard
![Civic Rewards & Champions Leaderboard](./public/landing_civic_rewards.png)
*Citizens build their civic score, earn badges (Civic Legend, City Crusader), and climb the city-wide Leaderboard as their reported issues get resolved by city field crews.*

---

## ⚖️ Traditional Civic Portals vs. CIVIX OS Platform

| Feature / Metric | Traditional Civic Portals ❌ | CIVIX OS Platform 🚀 |
|---|---|---|
| **Complaint Classification** | Slow manual paper/manual queue sorting | **Autonomous AI Triage (Google Gemini 2.0)** |
| **Corruption & Fake Closures** | High risk; tickets marked closed without work | **Zero Corruption; Dual Photo Proof Required** |
| **Officer Delay Tracking** | Untracked delays; no public accountability | **Exact Response Timestamps & Delay Ratings** |
| **Citizen Engagement** | Low response rate; passive reporting | **Gamified +10 Civic Coins & Badges** |
| **Commuter Communication** | No public warnings for road work/power cuts | **Live Official Broadcast Advisories Ticker** |
| **Geographic Visibility** | Text lists without spatial awareness | **Interactive Color-Coded Neighborhood GPS Map** |
| **District Telemetry** | Hidden internal spreadsheets | **Public District Daily & Monthly Analytics** |

---

## 🚀 Key Advantages & Platform Capabilities

### 🙋‍♂️ For Citizens
1. **1-Click GPS Reporting**: Snap a photo of a pothole, broken streetlight, or water leak; GPS coordinates are captured automatically.
2. **+10 Civic Coins & Leaderboard**: Earn coins for every verified report and unlock rank badges (*Civic Legend*, *City Crusader*, *Community Hero*).
3. **24/7 CIVIX AI Assistant**: Direct access to real Google Gemini AI for instant queries regarding municipal department rules and procedures.
4. **⏱️ Officer Delay Timestamp Auditing**: Publicly view the exact time taken by officers to resolve your complaint (`e.g., Action Time: 2h 15m • Fast Action ⚡`).
5. **🗺️ Interactive Neighborhood Map**: View all active civic issues around your location on an interactive GPS map.
6. **📢 Public Road & Power Advisories**: Receive live broadcast notices from officials regarding road closures, water repairs, or power outages.

### 🏛️ For Municipal Department Officials
1. **Zero Manual Sorting**: Autonomous Gemini AI routes incoming tickets directly to the exact department officer.
2. **Department Command Hub**: Manage pending, in-progress, and resolved complaints across sectors.
3. **Public Advisory Dispatcher**: Broadcast urgent road closures or scheduled maintenance directly to citizens.
4. **Verified Resolution Proof**: Upload side-by-side after-fixing repair photos to build public trust and close cases transparently.
5. **District Performance Telemetry**: Monitor daily and monthly resolution rates and department efficiency ratings.

---

## 🔑 Demo Official Credentials

| Role / Department | Email Address | Password | Department ID |
|---|---|---|---|
| **Central Administrator** | `admin@civix.gov.in` | `Admin@2026` | `admin` |
| **Municipal Administration** | `municipal@civix.gov.in` | `Muni@2026` | `municipal` |
| **Road Transport & Traffic** | `transport@civix.gov.in` | `Trans@2026` | `transport` |
| **Power Grid Board** | `electricity@civix.gov.in` | `Elec@2026` | `electricity` |
| **Water Works Department** | `water@civix.gov.in` | `Water@2026` | `water` |
| **Education Department** | `education@civix.gov.in` | `Edu@2026` | `education` |
| **Health Department** | `health@civix.gov.in` | `Health@2026` | `health` |

---

## 💻 Technology Stack

| Component | Technology Used |
|---|---|
| **Frontend UI** | React 18, TypeScript, TailwindCSS, Lucide Icons, Framer Motion |
| **Build System & Dev Server** | Vite, Node.js, Express REST Proxy (`server.ts`) |
| **Artificial Intelligence Engine** | Google Gemini 2.0 Flash REST API (Vision & Chat) |
| **Authentication & Profile Store** | Clerk Authentication, LocalStorage DB Engine with Real-Time `onSnapshot` |
| **Maps & Geolocation** | OpenStreetMap, Leaflet / Native Geolocation API |

---

## 🛠️ Local Installation & Setup Guide

### 1. Clone the Repository
```bash
git clone https://github.com/Hrushikesh-2006/CIVIX-OS-governance.git
cd CIVIX-OS-governance
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the root directory:
```env
VITE_GEMINI_API_KEY=YOUR_GOOGLE_STUDIO_GEMINI_KEY
VITE_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
```

### 4. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:3001`** in your browser to experience CIVIX OS!

---

## 📄 License
Licensed under the [MIT License](LICENSE).
