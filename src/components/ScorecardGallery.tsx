import { useState } from 'react';
import type { Scorecard } from '../types';
import { ScorecardDetail } from './ScorecardDetail';

interface ScorecardGalleryProps {
  scorecards: Scorecard[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Scorecard>) => void;
}

export function ScorecardGallery({ scorecards, onDelete, onUpdate }: ScorecardGalleryProps) {
  const [selectedCard, setSelectedCard] = useState<Scorecard | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (scorecards.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-16 w-16 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          No scorecards yet
        </h3>
        <p className="mt-2 text-gray-500">
          Upload your first scorecard to get started!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {scorecards.map((scorecard) => (
          <div
            key={scorecard.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div
              className="aspect-[4/3] cursor-pointer overflow-hidden relative group"
              onClick={() => setSelectedCard(scorecard)}
            >
              <img
                src={scorecard.imageUrl}
                alt="Scorecard"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-900 px-4 py-2 rounded-lg font-medium text-sm transition-opacity">
                  View Details
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">
                {scorecard.game.teams.away.team.name} @{' '}
                {scorecard.game.teams.home.team.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(scorecard.game.gameDate)}
              </p>
              <p className="text-sm text-gray-500">{scorecard.game.venue.name}</p>
              {scorecard.game.status.detailedState === 'Final' && (
                <p className="text-sm font-medium text-gray-700 mt-2">
                  Final: {scorecard.game.teams.away.score} -{' '}
                  {scorecard.game.teams.home.score}
                </p>
              )}
              <div className="mt-3 flex justify-between items-center">
                <button
                  onClick={() => setSelectedCard(scorecard)}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  View Stats
                </button>
                <button
                  onClick={() => onDelete(scorecard.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedCard && (
        <ScorecardDetail
          scorecard={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
