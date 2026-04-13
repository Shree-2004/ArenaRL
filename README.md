# ArenaRL: Explainable Reinforcement Learning Benchmarking Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Research](https://img.shields.io/badge/category-Explainable--AI--XAI-orange)
![License](https://img.shields.io/badge/license-MIT-green)

**ArenaRL** is a high-fidelity, researcher-focused Reinforcement Learning (RL) platform designed to bridge the gap between abstract algorithmic theory and practical implementation. It features a complete end-to-end pipeline for training, observing, and benchmarking various RL agents (DQN, PPO, A2C, Q-Learning) within interactive gaming environments.

---

## 🚀 Key Features

### 1. **Explainable AI (XAI) Module**
- **Algorithm Handbook:** An integrated reference system mapping real-time behavior to mathematical foundations (Bellman Equations, Policy Gradients).
- **Intelligent Decision Logs:** Human-readable logs detailing why an agent chose a specific action at any given timestamp.

### 2. **Real-Time Neuro-Telemetry**
- **Live Brain Monitor:** Dual-meter tracking of Loss convergence and Reward evolution.
- **Action Probability Visualiser:** Real-time bar charts showing confidence levels for every possible move.
- **Decision Terminal:** Live logging of environment state transitions and agent rewards.

### 3. **The Arena (Benchmarking)**
- **Agent vs Agent Matches:** Compare different architectures (e.g., DQN vs PPO) side-by-side to analyze generalization.
- **Strategic Showcase:** Watch agents solve complex tasks in Connect 4, Snake, Pong, and more.

### 4. **Automated Research Reporting**
- **X-Report System:** One-click PDF generation of training dossiers.
- **Performance Analytics:** Automated win-rate calculation and convergence verdicts.

---

## 🛠 Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Lucide Icons.
- **Backend:** Flask (Python), Flask-SocketIO (Real-time telemetry), SQLAlchemy (SQLite).
- **Core AI:** PyTorch (Neural approximation), NumPy, Gymnasium.
- **Reporting:** ReportLab (PDF generation).

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Create virtual environment: `python -m venv venv`
3. Activate: `venv\Scripts\activate` (Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Start server: `python app.py`

### Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

---

## 📖 Research Frameworks Supported

| Algorithm | Type | Implementation | Best For |
|-----------|------|----------------|----------|
| **DQN** | Off-Policy | Neural (PyTorch) | Large Discrete States |
| **PPO** | On-Policy | Neural (Clipped) | Stability / Control |
| **A2C** | On-Policy | Actor-Critic | Quick Prototyping |
| **Q-Learning** | Off-Policy | Tabular | Finite MDPs |
| **SARSA** | On-Policy | Tabular | Safety-focused tasks |

---

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🎓 Academic Impact (B.Tech Final Year)
This project serves as a comprehensive demonstration of **Full-Stack Engineering** and **Advanced AI Research**. It focuses specifically on the "Explainability" pillar of modern AI, ensuring that decision-making processes are transparent and verifiable.
