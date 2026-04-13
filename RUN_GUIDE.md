# Project Run Guide

This guide will help you set up and run the application on your local machine.

## Prerequisites

- **Python 3.12+** (for the Backend)
- **Node.js 18+ & npm** (for the Frontend)
- **Virtual Environment** (recommended for Python)

---

## 🚀 Backend Setup (Flask)

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Create a Virtual Environment** (if not already done):
   ```powershell
   py -m venv venv
   ```

3. **Activate the Virtual Environment**:
   - **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```

4. **Install Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

5. **Run the Backend**:
   ```powershell
   python app.py
   ```
   *The server will start on [http://127.0.0.1:5000](http://127.0.0.1:5000)*

---

## 💻 Frontend Setup (React + Vite)

1. **Navigate to the frontend directory**:
   ```powershell
   cd frontend
   ```

2. **Install Dependencies**:
   ```powershell
   npm install
   ```

3. **Run the Development Server**:
   ```powershell
   npm run dev
   ```
   *The frontend will usually be accessible at [http://localhost:5173](http://localhost:5173)*

---

## 🛠️ Troubleshooting

- **Eventlet Warning**: If you see an `EventletDeprecationWarning`, it is normal for this setup and won't stop the app from running.
- **CORS Issues**: Ensure `flask-cors` is installed and initialized in `app.py` to allow the frontend to communicate with the backend.
- **Port 5000 Busy**: If another app is using port 5000, you can change the port in the last line of `app.py`.
