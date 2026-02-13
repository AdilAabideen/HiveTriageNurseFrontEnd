import React from 'react';

interface CardProps {
  id: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}

const Card: React.FC<CardProps> = ({ id, title, subtitle, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow font-hind"
    >
      <div className="text-sm font-medium text-gray-900">{title}</div>
      {subtitle && (
        <div className="text-xs text-gray-600 mt-1">{subtitle}</div>
      )}
      <div className="text-xs text-gray-500 mt-1">Token: {id}</div>
    </div>
  );
};

export default Card;

