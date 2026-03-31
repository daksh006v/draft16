<div align="center">
  <h1> Draft16 </h1>
  <p><strong>The Ultimate Web-Based Writing Studio for Vocalists & Songwriters</strong></p>
</div>

## 📖 Overview
Draft16 is a full-stack, aesthetically driven web application designed specifically for recording artists, rappers, and songwriters. It combines a distraction-free glassmorphic text editor with integrated beat playback, syllable tracking, rhyme dictionaries, and synchronized vocal recording—all in one browser window.

Gone are the days of juggling a notes app, YouTube for beats, and a voice memo app. Draft16 brings the entire ideation studio into a single, cohesive, premium environment.

## ✨ Key Features

### 📝 Advanced CodeMirror Writing Workspace
- **Distraction-Free UI:** A deep-space dark mode aesthetic with frosted-glass panels and modern typography.
- **Section Highlighting:** Automatically styles structural markers like `[Hook]`, `[Verse]`, and `[Bridge]` so you can see song structure at a glance.
- **Multiple Drafts:** Create, drag-and-drop sort, and manage multiple drafts within a single session.
- **Auto-save:** Never lose a bar. The editor continuously syncs with the database.

### 🧠 Intelligent Lyric Tools
- **Syllable Counting:** Visually highlights and counts syllables per line to help you stay in the pocket.
- **Rhyme Finder:** Integrated Datamuse API instantly fetches rhymes for selected words without switching tabs.
- **Rhyme Scheme Visualization:** Automatically detects and color-codes rhyme schemes (AABB, ABAB) at the end of each line using a custom CodeMirror plugin.

### 🎧 Beat Integration & Navigation
- **BeatPlayer:** Paste a YouTube URL or upload an audio file to write alongside your instrumental.
- **Sync Markers & Looping:** Drop timestamps while the beat plays to quickly jump between sections. Highlight a section of the beat to loop dynamically.
- **Metronome:** Keep your timing sharp with an integrated visual metronome mapped to your custom BPM.

### 🎙️ In-Browser Recording (Takes)
- **Zero-Latency Recording:** Record vocal takes directly in the browser over your beats.
- **Sync Modes:** Record just your vocals or sync your vocals against the playing instrumental.
- **Cloud Storage:** Takes are gracefully encoded as `WebM` and securely uploaded to Cloudinary for instant playback across devices.

## 🛠️ Tech Stack

**Frontend**
- **Framework:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Custom Space-Glassmorphism theme & Fonts: *Outfit* & *Inter*)
- **Editor Core:** [CodeMirror 6](https://codemirror.net/)
- **Audio:** Web Audio API & MediaRecorder API
- **Routing:** React Router DOM
- **State Management:** React Hooks
- **Drag & Drop:** `@dnd-kit`

**Backend**
- **Runtime:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Authentication:** JSON Web Tokens (JWT) & bcrypt
- **File Storage:** Cloudinary (via Multer)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB connection string
- Cloudinary account credentials

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/draft16.git
   cd draft16
   ```

2. **Backend Setup:**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
   Start the backend server:
   ```bash
   npm run dev
   ```

3. **Frontend Setup:**
   ```bash
   cd ../client
   npm install
   ```
   Start the frontend development server:
   ```bash
   npm run dev
   ```

4. **Launch Draft16:**
   Navigate to `http://localhost:5173/` in your browser.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📜 License
This project is licensed under the MIT License.
