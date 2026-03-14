import React from 'react';

const BeatPlayer = ({ beatSource, beatUrl }) => {
  if (beatSource !== 'youtube' || !beatUrl) {
    return null;
  }

  const extractVideoId = (url) => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) {
      return null;
    }
  };

  const videoId = extractVideoId(beatUrl);

  if (!videoId) return null;

  return (
    <div className="pt-4">
      <iframe
        className="w-full h-52 rounded-lg"
        src={`https://www.youtube.com/embed/${videoId}`}
        allowFullScreen
        title="Beat Player"
      />
    </div>
  );
};

export default BeatPlayer;
