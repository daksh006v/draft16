<div align="center">
  <img src="./client/public/favicon.png?v=2" alt="Draft16 Logo" width="120" height="120" />

  # Draft16 Studio

  **The ultimate distraction-free drafting workspace tailored specifically for lyricists and songwriters.**
  
  [**Visit Live App**](https://draft16.vercel.app/) • [**Report Bug**](https://github.com/daksh006v/draft16/issues/new?labels=bug) • [**Request Feature**](https://github.com/daksh006v/draft16/issues/new?labels=enhancement)
</div>

<br/>

## 🎵 About The Project

Draft16 is a professional-grade web application designed from the ground up for music artists, producers, and lyricists. Far too often, writers are forced to juggle multiple apps—a notes app for writing, a browser for finding beats, and a separate app for syllable counting. 

Draft16 merges the entire creative workflow into a single, cohesive environment. 

With a deeply considered, distraction-free UI inspired by premium tools like Notion and Figma, Draft16 allows artists to write verses, count syllables in real-time, record takes, and loop audio tracks simultaneously without ever breaking their creative flow.

### ✨ Key Features

- **Distraction-Free Editor**: A fluid, typography-focused writing canvas (powered by CodeMirror) designed for writing bars without visual clutter.
- **Integrated BeatPlayer**: Load local audio files or instantly stream YouTube beats directly alongside your lyrics, complete with loop functionality.
- **Real-time Syllable Counting**: Built-in syllable analysis helps you perfect your flow and manage your cadences effortlessly.
- **Instant Cloud Syncing**: Secure, real-time saving of all your sessions so your lyrics are never lost.
- **Invisible Authentication**: Seamless, one-click Google OAuth means getting straight to writing without password fatigue.

---

## 📸 Interface Previews


<div align="center">
  <img src="./.github/assets/landing.png" alt="Draft16 Landing Page" width="800" />
  <p><em>The intuitive and welcoming landing portal.</em></p>
  
  <br/>

  <img src="./.github/assets/dashboard-dark.png" alt="Draft16 Dashboard (Dark Mode)" width="800" />
  <p><em>Managing your sessions and creative projects.</em></p>
  
  <br/>

  <img src="./.github/assets/editor.png" alt="Draft16 Session Editor" width="800" />
  <p><em>The core editing environment featuring the integrated BeatPlayer and syllable counter.</em></p>

  <br/>

  <img src="./.github/assets/dashboard-light.png" alt="Draft16 Dashboard (Light Mode)" width="800" />
  <p><em>Seamless light mode support for different studio environments.</em></p>
</div>

---

## 🛠️ Technology Stack

Draft16 is a modern Full-Stack application utilizing a decoupled client-server architecture.

### Frontend (Client)
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS with [TailwindCSS 4](https://tailwindcss.com/) overrides for maximum control.
- **Editor**: [CodeMirror 6](https://codemirror.net/) via `@uiw/react-codemirror`
- **Utilities**: `syllable` for lyrical analysis, `dnd-kit` for drag-and-drop interactions.

### Backend (Server)
- **Environment**: [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) & Mongoose
- **Authentication**: JWT (JSON Web Tokens) & Google OAuth 2.0 Integration
- **Media Storage**: [Cloudinary](https://cloudinary.com/) (Multer integration)

### Deployment
- **Frontend Hosting**: [Vercel](https://vercel.com/)
- **Backend Hosting**: [Render](https://render.com/)

---

## 🚀 Getting Started Locally

To get a local copy of Draft16 up and running, follow these simple steps.

### Prerequisites
Make sure you have Node.js and npm installed on your machine.
* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. **Clone the repo**
   ```sh
   git clone https://github.com/your-username/draft16.git
   ```

2. **Setup the Backend**
   ```sh
   cd server
   npm install
   ```
   *Create a `.env` file in the `server` directory using `.env.example` as a template and provide your MongoDB URI and Cloudinary credentials.*

3. **Setup the Frontend**
   ```sh
   cd ../client
   npm install
   ```

4. **Run both environments**
   *You can run them in separate terminal windows.*
   
   *Window 1 (Backend):*
   ```sh
   cd server
   npm run dev
   ```
   
   *Window 2 (Frontend):*
   ```sh
   cd client
   npm run dev
   ```

5. **Open Application**
   Navigate to `http://localhost:5173` in your browser.

---

## 🔒 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  Built specifically to push the culture forward. 
  <br/>
  <b>Draft16</b>
</div>