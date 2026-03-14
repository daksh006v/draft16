import { Link } from 'react-router-dom';

const SessionCard = ({ session }) => {
  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <h3 className="text-xl font-bold text-gray-800 mb-2 truncate">{session.title}</h3>
      <p className="text-sm text-gray-500 mb-6">Created: {formattedDate}</p>
      
      <div className="flex gap-3">
        <Link 
          to={`/sessions/${session._id}`}
          className="flex-1 text-center bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Open
        </Link>
        <button 
          className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default SessionCard;
