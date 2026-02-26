import React from 'react';

interface CardProps {
  id: string;
  title: string;
  subtitle?: string[];
  triageTier?: number | null;
  useFullTierBorder?: boolean;
  onClick: () => void;
}

function getTierBorderClasses(tier?: number | null, useFullTierBorder?: boolean): string {
  let LefttierColorClass = 'border-l-gray-200';
  let tierColorClass = 'border-gray-200';

  if (tier !== null && tier !== undefined) {
    if (tier >= 4 && tier <= 5) LefttierColorClass = 'border-l-green-500';
    else if (tier === 3) LefttierColorClass = 'border-l-orange-500';
    else if (tier >= 1 && tier <= 2) LefttierColorClass = 'border-l-red-500';
  }

  if (tier !== null && tier !== undefined) {
    if (tier >= 4 && tier <= 5) tierColorClass = 'border-green-500';
    else if (tier === 3) tierColorClass = 'border-orange-500';
    else if (tier >= 1 && tier <= 2) tierColorClass = 'border-red-500';
  }

  if (useFullTierBorder) {
    return `border-2 ${tierColorClass}`;
  }

  return `border border-gray-200 border-l-[3px] ${LefttierColorClass}`;
}

const Card: React.FC<CardProps> = ({ id, title, subtitle, triageTier, useFullTierBorder, onClick }) => {
  const borderClasses = getTierBorderClasses(triageTier, useFullTierBorder);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg p-3 mb-3 cursor-pointer hover:shadow-md transition-shadow font-hind ${borderClasses}`}
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
