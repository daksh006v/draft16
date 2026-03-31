import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import SessionEditor from './pages/SessionEditor';
import NewSession from './pages/NewSession';
import AuthSuccess from './pages/AuthSuccess';
import AuthError from './pages/AuthError';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/session/new" element={<NewSession />} />
        <Route path="/sessions/:id" element={<SessionEditor />} />
        <Route path="/auth-success" element={<AuthSuccess />} />
        <Route path="/auth-error" element={<AuthError />} />
      </Routes>
    </Router>
    </ThemeProvider>
  );
}

export default App;
