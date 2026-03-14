import axios from 'axios';

export const getRhymes = async (word) => {
  try {
    const response = await axios.get(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}`);
    return response.data.slice(0, 10).map(item => item.word);
  } catch (error) {
    console.error('Error fetching rhymes:', error);
    return [];
  }
};
