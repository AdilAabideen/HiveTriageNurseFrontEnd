import React from 'react';
import { ChiefComplaintData, Discriminator } from '../types/encounter';

interface ChiefComplaintViewProps {
  chiefComplaint: ChiefComplaintData;
  discriminatorsData?: Record<string, Discriminator[]>;
}

const ChiefComplaintView: React.FC<ChiefComplaintViewProps> = ({ 
  chiefComplaint, 
  discriminatorsData = {} 
}) => {

  const getTierColor = (tier: string) => {
    switch (tier) {
      case '1': return 'bg-red-100 border-red-300 text-red-900';
      case '2': return 'bg-orange-100 border-orange-300 text-orange-900';
      case '3': return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case '4': return 'bg-green-100 border-green-300 text-green-900';
      default: return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case '1': return 'Tier 1 - Critical';
      case '2': return 'Tier 2 - Urgent';
      case '3': return 'Tier 3 - Standard';
      case '4': return 'Tier 4 - Low Priority';
      default: return `Tier ${tier}`;
    }
  };

  // Group discriminators by tier for graphical display
  const groupDiscriminatorsByTier = (discriminators: Discriminator[]) => {
    const grouped: Record<string, Discriminator[]> = {};
    discriminators.forEach(d => {
      if (!grouped[d.tier]) {
        grouped[d.tier] = [];
      }
      grouped[d.tier].push(d);
    });
    return grouped;
  };

  return (
    <div className="space-y-6">
      {/* Overall Text */}
      {chiefComplaint.overall_text && (
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 font-hind">Chief Complaint Text</h3>
          <p className="text-gray-700 font-hind italic">"{chiefComplaint.overall_text}"</p>
        </div>
      )}

      {/* Category Selections */}
      {chiefComplaint.category_selections && chiefComplaint.category_selections.length > 0 && (
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 font-hind">Selected Categories</h3>
          <div className="flex flex-wrap gap-2">
            {chiefComplaint.category_selections.map((cat, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-hind"
              >
                {cat.category_name || cat.category_id.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Presentations with Discriminators - Graphical View */}
      {chiefComplaint.presentations && chiefComplaint.presentations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 font-hind">Presentations & Discriminators</h3>
          <div className="space-y-6">
            {chiefComplaint.presentations.map((pres, idx) => {
              const presDiscriminators = discriminatorsData[pres.presentation_id] || [];
              const groupedByTier = groupDiscriminatorsByTier(presDiscriminators);
              const tiers = ['1', '2', '3', '4'].filter(t => groupedByTier[t]);

              return (
                <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-white">
                  {/* Presentation Header */}
                  <div className="mb-4 pb-3 border-b">
                    <h4 className="text-md font-semibold text-gray-900 font-hind capitalize">
                      {pres.presentation_id.replace(/_/g, ' ')}
                    </h4>
                    <div className="flex gap-4 mt-2 text-sm text-gray-600 font-hind">
                      {pres.offset && (
                        <span>Offset: <span className="font-medium">{pres.offset}</span></span>
                      )}
                      {pres.trend && (
                        <span>Trend: <span className="font-medium capitalize">{pres.trend}</span></span>
                      )}
                    </div>
                  </div>
                  
                  {/* Discriminators by Tier - Graphical Layout */}
                  {tiers.length > 0 ? (
                    <div className="space-y-4">
                      {tiers.map(tier => {
                        const tierDiscriminators = groupedByTier[tier];
                        const tierColor = getTierColor(tier);
                        
                        return (
                          <div key={tier} className="space-y-2">
                            <div className={`px-3 py-1 rounded-md border font-semibold text-sm font-hind ${tierColor}`}>
                              {getTierLabel(tier)}
                            </div>
                            <div className="ml-4 space-y-2">
                              {tierDiscriminators.map((disc, discIdx) => (
                                <div
                                  key={discIdx}
                                  className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="font-medium text-gray-900 font-hind">
                                      {disc.label}
                                    </div>
                                    <div className="text-xs text-gray-500 font-hind">
                                      {(disc.confidence * 100).toFixed(0)}% confidence
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-700 font-hind mb-2">
                                    {disc.definition}
                                  </div>
                                  {disc.rationale && (
                                    <div className="text-xs text-gray-600 italic font-hind mt-1">
                                      Rationale: {disc.rationale}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 font-hind italic">
                      No discriminators available for this presentation
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChiefComplaintView;

