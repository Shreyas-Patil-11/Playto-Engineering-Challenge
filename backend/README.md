# Playto Backend (Community Feed)

This is the backend API for the Playto Community Feed, built with Django and Django REST Framework. It handles user interactions, threaded comments, and karma leaderboards.

## Features

- **Community Feed**: Posts and threaded comments.
- **Optimized Comment Tree**: Using an O(n) algorithm to build nested comment trees without N+1 query issues.
- **Karma System**: Tracks user actions (likes) and calculates leaderboards.
- **24-Hour Leaderboard**: Efficiently queries the top 5 users based on karma earned in the last 24 hours.
- **Concurrency Safety**: Robust handling of "like" actions using atomic transactions and database locking to prevent race conditions.

## Tech Stack

- **Framework**: Django 4.x, Django REST Framework 3.x
- **Database**: SQLite (default for dev), support for PostgreSQL in production (via psycopg2)
- **Utilities**: 
  - `django-cors-headers` for cross-origin requests
  - `python-dotenv` for environment management
  - `Pillow` for image processing

## Setup Instructions

### Prerequisites

- Python 3.8+
- pip

### Installation

1. **Clone the repository** (if you haven't already).

2. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

3. **Create a virtual environment**:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

4. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Environment Configuration**:
   - Copy `.env.example` to `.env`.
   - Update the variables if necessary.

6. **Database Setup**:
   ```bash
   python manage.py migrate
   ```

7. **Run the Development Server**:
   ```bash
   python manage.py runserver
   ```
   The API will be available at `http://127.0.0.1:8000/`.

## Running Tests

The project includes specific tests for critical features like the leaderboard calculation and race condition handling.

```bash
python manage.py test feed
```
