import { api } from './api';
import { getToken } from '../utils/auth';

export const getSessions = async () => {
  const response = await api.get('/sessions', {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
  return response.data;
};

export const getSessionById = async (id) => {
  const response = await api.get(`/sessions/${id}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
  return response.data;
};

export const updateSession = async (id, data) => {
  const response = await api.put(`/sessions/${id}`, data, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
  return response.data;
};

export const createSession = async (data) => {
  const response = await api.post('/sessions', data, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
  return response.data;
};
