import { useState } from 'react';
import type { Scorecard } from '../types';

interface ScorecardGalleryProps {
  scorecards: Scorecard[];
  onDelete: (id: string) => void;
}

export function ScorecardGallery({ scorecards, onDelete }: ScorecardGalleryProps) {
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
              className="aspect-[4/3] cursor-pointer overflow-hidden"
              onClick={() => setSelectedCard(scorecard)}
            >
              <img
                src={scorecard.imageUrl}
                alt="Scorecard"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">
                {scorecard.game.teams.away.team.teamName} @{' '}
                {scorecard.game.teams.home.team.teamName}
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
              <div className="mt-3 flex justify-end">
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
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh]">
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={selectedCard.imageUrl}
              alt="Scorecard full view"
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-4 text-center text-white">
              <h3 className="text-xl font-semibold">
                {selectedCard.game.teams.away.team.name} @{' '}
                {selectedCard.game.teams.home.team.name}
              </h3>
              <p className="text-gray-300">{formatDate(selectedCard.game.gameDate)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
