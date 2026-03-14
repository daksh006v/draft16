# Draft16

> Where 16s Are Born.

---

## PROJECT OVERVIEW

Draft16 is a full-stack creative workspace for rappers and lyricists. Users can sign up, create songwriting sessions, write lyrics, attach YouTube beats, and manage all their drafts from a personal dashboard — all in one place.

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 (Vite), Tailwind CSS v4, React Router v7, Axios |
| Backend | Node.js, Express.js v5 |
| Database | MongoDB Atlas, Mongoose |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Dev Tools | Nodemon, ESLint |

---

## FEATURES

### User Authentication
- **Signup** — Register with username, email, and a hashed password
- **Login** — Authenticate and receive a JWT stored in `localStorage`
- **Protected routes** — Unauthenticated users are redirected to `/login`
- **Dynamic Navbar** — Shows Login/Signup for guests; Dashboard/Logout for authenticated users

### Songwriting Sessions (Full CRUD)
- **Create** a new session with a title and optional beat URL
- **Read** all sessions on the dashboard in a responsive card grid
- **Update** session title, lyrics, and beat URL in the session editor
- **Delete** sessions from the dashboard

### Session Editor
- Large `textarea` for focused lyric writing
- Beat source selector (YouTube / External / Upload coming soon)
- Beat URL input field with live YouTube embed preview
- Save changes button with loading state feedback

### Beat Playback (Step 8)
- `BeatPlayer.jsx` component parses YouTube URLs using a `extractVideoId()` helper
- Supports both `youtube.com/watch?v=` and `youtu.be/` URL formats
- Renders a responsive embedded YouTube iframe directly inside the editor
- Player only activates when `beatSource === "youtube"` and a valid URL is provided

---

## PROJECT STRUCTURE

```
draft16/
├── client/                        ← React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx               ← App entry point
│       ├── App.jsx                ← Router + Navbar setup
│       ├── index.css              ← Global styles
│       ├── components/
│       │   ├── BeatPlayer.jsx     ← YouTube iframe beat player
│       │   ├── Navbar.jsx         ← Auth-aware navigation bar
│       │   └── SessionCard.jsx    ← Dashboard session card
│       ├── pages/
│       │   ├── Home.jsx           ← Landing page
│       │   ├── Login.jsx          ← Login form + JWT flow
│       │   ├── Signup.jsx         ← Signup form + JWT flow
│       │   ├── Dashboard.jsx      ← Protected sessions list
│       │   ├── NewSession.jsx     ← Create session form
│       │   └── SessionEditor.jsx  ← Lyrics + beat editor
│       ├── services/
│       │   ├── api.js             ← Axios base instance (baseURL: /api)
│       │   ├── authService.js     ← login() and signup() API calls
│       │   └── sessionService.js  ← Full session CRUD API calls
│       └── utils/
│           └── auth.js            ← getToken / setToken / removeToken
│
└── server/                        ← Node.js + Express backend
    ├── server.js                  ← App entry, middleware, route binding
    ├── package.json
    ├── config/
    │   └── db.js                  ← MongoDB Atlas connection (Mongoose)
    ├── controllers/
    │   ├── authController.js      ← signup and login handlers
    │   └── sessionController.js   ← CRUD handlers for sessions
    ├── middleware/
    │   └── authMiddleware.js      ← JWT verification middleware
    ├── models/
    │   ├── User.js                ← Username, email, hashed password
    │   └── Session.js             ← Title, lyrics, beatSource, beatUrl, userId
    └── routes/
        ├── authRoutes.js          ← POST /signup, POST /login
        └── sessionRoutes.js       ← Protected session CRUD routes
```

---

## API REFERENCE

All session routes require the `Authorization: Bearer <token>` header.

### Auth Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Register a new user | No |
| POST | `/api/auth/login` | Login, returns JWT + user | No |

**Signup / Login response:**
```json
{
  "token": "eyJhbGci...",
  "user": { "_id": "...", "username": "...", "email": "..." }
}
```

### Session Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/sessions` | Get all sessions for logged-in user | Yes |
| POST | `/api/sessions` | Create a new session | Yes |
| GET | `/api/sessions/:id` | Get a single session by ID | Yes |
| PUT | `/api/sessions/:id` | Update session | Yes |
| DELETE | `/api/sessions/:id` | Delete session | Yes |

**Session model fields:**
```json
{
  "title": "String",
  "lyrics": "String",
  "beatSource": "youtube | external | upload",
  "beatUrl": "String",
  "userId": "ObjectId (ref: User)"
}
```

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Returns `{ status: 'server running' }` |

---

## GETTING STARTED

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (get a connection string)

### 1. Clone the repository

```bash
git clone https://github.com/daksh006v/draft16.git
cd draft16
```

### 2. Setup the Server

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:

```env
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

Start the server:

```bash
npx nodemon server.js
```

### 3. Setup the Client

```bash
cd client
npm install
npm run dev
```

The app will be running at `http://localhost:5173`

---

## HOW IT WORKS

1. User registers or logs in → JWT is saved in `localStorage`
2. Navbar detects the token and renders authenticated links
3. User creates a session from the Dashboard
4. In the Session Editor, user writes lyrics and pastes a YouTube beat URL
5. `BeatPlayer` parses the URL, extracts the video ID, and embeds the YouTube player inline
6. User saves the session — title, lyrics, beatSource, and beatUrl are persisted to MongoDB
7. All session API calls include the JWT in the `Authorization` header via the token utils

---

## FUTURE IMPROVEMENTS

- Autosave lyrics (debounced auto-save on keystroke)
- Audio beat file uploads (direct upload support)
- Voice demo recording in the workspace
- Session search and tag filtering
- Real-time collaboration with Socket.io

---

## AUTHOR

**Daksh Bajaniya**