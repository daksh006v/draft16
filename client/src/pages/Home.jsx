import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Draft16</h1>
      <p className="text-lg text-gray-600 mb-8">Where 16s Are Born.</p>
      <div className="flex gap-4">
        <Link to="/signup" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">Get Started</Link>
        <Link to="/login" className="bg-white text-gray-800 border border-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors">Login</Link>
      </div>
    </div>
  );
};

export default Home;
