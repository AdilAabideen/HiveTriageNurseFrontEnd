import React from 'react';
import Card from './Card';

interface CardData {
  id: string;
  title: string;
  subtitle?: string[];
}

interface KanbanColumnProps {
  title: string;
  cards: CardData[];
  onCardClick: (card: CardData) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, cards, onCardClick }) => {
  return (
    <div className="flex flex-col h-full border border-gray-300 rounded-lg p-2 bg-white min-h-0">
      <div className="mb-4 flex-shrink-0 p-1">
        <h2 className="text-lg font-semibold text-gray-800 font-hind">{title}</h2>
        <div className="text-sm text-gray-500 font-hind mt-1">{cards.length} items</div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {cards.map((card) => (
          <Card
            key={card.id}
            id={card.id}
            title={card.title}
            subtitle={card.subtitle}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;

