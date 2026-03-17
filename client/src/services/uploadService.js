import { api } from './api';
import { getToken } from '../utils/auth';

export const uploadAudio = async (file) => {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await api.post('/upload/audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      // Authorization might be needed depending on your backend routes, although we didn't add it in server.js to /api/upload
      // Let's pass it just in case
      Authorization: `Bearer ${getToken()}`
    }
  });
  
  return response.data;
};
