import React, { useState } from 'react';
import KanbanColumn from './KanbanColumn';
import Overlay from './Overlay';
import { useInProgressEncounters } from '../hooks/useInProgressEncounters';
import { EncounterData } from '../types/encounter';

interface CardData {
  id: string;
  title: string;
  subtitle?: string;
  encounter?: EncounterData;
}

const KanbanBoard: React.FC = () => {
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterData | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  const { encounters: inProgressEncounters } = useInProgressEncounters();

  // Sample data for each column
  const [currentOrderCards] = useState<CardData[]>([]);

  const [aiTriageOrderCards] = useState<CardData[]>([]);

  const [nurseFlagsCards] = useState<CardData[]>([]);

  // Convert encounters to card data for In Progress column
  const inProgressCards: CardData[] = inProgressEncounters.map(encounter => ({
    id: encounter.encounter_token,
    title: encounter.patient_identity?.full_name || 'Unknown Patient',
    subtitle: encounter.current_stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    encounter: encounter,
  }));

  const handleCardClick = (card: CardData) => {
    if (card.encounter) {
      setSelectedEncounter(card.encounter);
      setIsOverlayOpen(true);
    }
  };

  const handleCloseOverlay = () => {
    setIsOverlayOpen(false);
    setSelectedEncounter(null);
  };

  return (
    <div className="h-screen w-full bg-gray-50 font-hind">
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3 h-[calc(100vh-48px)]">
          <KanbanColumn
            title="Current Order"
            cards={currentOrderCards}
            onCardClick={handleCardClick}
          />
          <KanbanColumn
            title="Ai Traige Order"
            cards={aiTriageOrderCards}
            onCardClick={handleCardClick}
          />
          {/* <KanbanColumn
            title="Kiosk Traige Done"
            cards={kioskTriageDoneCards}
            onCardClick={handleCardClick}
          /> */}
          <KanbanColumn
            title="In Progress"
            cards={inProgressCards}
            onCardClick={handleCardClick}
          />
          <KanbanColumn
            title="Nurse Flags"
            cards={nurseFlagsCards}
            onCardClick={handleCardClick}
          />
        </div>
      </div>

      <Overlay
        isOpen={isOverlayOpen}
        onClose={handleCloseOverlay}
        encounter={selectedEncounter}
      />
    </div>
  );
};

export default KanbanBoard;

