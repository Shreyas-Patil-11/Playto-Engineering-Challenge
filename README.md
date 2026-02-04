# Playto - Community Feed Application

Playto is a full-stack community feed application featuring threaded comments, real-time-like interactions, and a karma-based leaderboard system. It demonstrates a robust implementation of nested data structures and concurrent user interactions.

## Project Structure

The project is divided into two main components:

- **[Backend](./backend/README.md)**: A Django REST Framework API that handles data persistence, business logic, and complex queries (e.g., O(n) comment tree building, transaction-safe likes).
- **[Frontend](./frontend/README.md)**: A React + TypeScript + Vite application that provides a responsive and modern user interface using Tailwind CSS.

## Features

- **Deeply Nested Comments**: Efficiently rendered discussion threads.
- **Karma System**: User reputation tracking with safeguards against race conditions.
- **24-Hour Leaderboard**: A dynamic view of the most active community members.
- **Modern UI**: Clean and responsive design.

## Quick Start

To run the full application locally, you will need two terminal instances.

### 1. Start the Backend

```bash
cd backend
python -m venv venv
# Activate venv (Windows: .\venv\Scripts\activate, Unix: source venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend API will run at `http://127.0.0.1:8000/`.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173/` (or the port shown in your terminal).

## Documentation

For specific details on architecture, testing, and configuration, please refer to the README files in each directory:

- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
