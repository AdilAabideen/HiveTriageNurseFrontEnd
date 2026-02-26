import React from 'react';

interface CardProps {
  id: string;
  title: string;
  subtitle?: string[];
  onClick: () => void;
}

const Card: React.FC<CardProps> = ({ id, title, subtitle, onClick }) => {

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-3 mb-3 cursor-pointer hover:shadow-md transition-shadow font-hind"
    >
      <div className="text-md font-medium text-gray-900">{title}</div>
      {subtitle && Array.isArray(subtitle) && subtitle.length > 0 && subtitle.map((item, index) => (
        <div key={`${item}-${index}`} className="text-xs text-gray-600 mt-1">{item}</div>
      ))}
      <div className="text-xs text-gray-500 mt-1">Token: {id}</div>
    </div>
  );
};

export default Card;

