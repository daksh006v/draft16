# Draft16

> Where 16s Are Born.

---

## PROJECT OVERVIEW

Draft16 is a full-stack creative workspace for rappers and lyricists that allows users to write lyrics, attach beats, and manage songwriting sessions in one place.

---

## TECH STACK

**Frontend**
- React (Vite)
- Tailwind CSS
- React Router
- Axios

**Backend**
- Node.js
- Express.js

**Database**
- MongoDB Atlas
- Mongoose

**Authentication**
- JWT
- bcrypt

---

## FEATURES

**User Authentication**
- Signup
- Login
- Protected routes

**Songwriting Sessions**
- Create session
- Edit lyrics
- Attach beat URLs
- Save sessions

**Dashboard**
- View sessions
- Open sessions
- Manage drafts

**Session Editor**
- Lyrics editor
- Beat URL integration
- Save changes

**Beat Playback**
- Embedded YouTube beat player inside the writing workspace.

---

## PROJECT STRUCTURE

```text
draft16
├ client
│   ├ src
│   │   ├ components
│   │   ├ pages
│   │   ├ services
│   │   └ utils
│
└ server
├ controllers
├ models
├ routes
├ middleware
└ config
```

---

## API OVERVIEW

**Auth Routes**
- `POST /api/auth/signup`
- `POST /api/auth/login`

**Session Routes**
- `GET /api/sessions`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `PUT /api/sessions/:id`
- `DELETE /api/sessions/:id`

---

## FUTURE IMPROVEMENTS

- Autosave lyrics
- Audio beat uploads
- Voice demo recording
- Session search
- Real-time collaboration

---

## AUTHOR

Daksh Bajaniya