import { Link } from 'react-router-dom';

const SessionCard = ({ session, onDelete }) => {

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      onDelete(session._id);
    }
  };
  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 truncate">{session.title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Created: {formattedDate}</p>
      
      <div className="flex gap-3">
        <Link 
          to={`/sessions/${session._id}`}
          className="flex-1 text-center bg-gray-800 dark:bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          Open
        </Link>
        <button 
          onClick={handleDelete}
          className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default SessionCard;
