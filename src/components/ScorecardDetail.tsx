import { useState } from 'react';
import type { Scorecard, ParsedScorecardData } from '../types';
import { GameStats } from './GameStats';
import { OfficialScorecard } from './OfficialScorecard';
import { extractTextFromImage, parseScorecard, getResultDescription, type OCRProgress } from '../services/ocr';

interface ScorecardDetailProps {
  scorecard: Scorecard;
  onClose: () => void;
  onUpdate: (id: string, parsedData: ParsedScorecardData) => void;
}

export function ScorecardDetail({ scorecard, onClose, onUpdate }: ScorecardDetailProps) {
  const [activeTab, setActiveTab] = useState<'compare' | 'scorecard' | 'official' | 'stats' | 'ocr'>('compare');
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  const [ocrResult, setOcrResult] = useState<ParsedScorecardData | null>(
    scorecard.parsedData || null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleRunOCR = async () => {
    setIsProcessing(true);
    setOcrProgress({ status: 'initializing', progress: 0 });

    try {
      const { text, confidence } = await extractTextFromImage(
        scorecard.imageUrl,
        setOcrProgress
      );

      const parsed = parseScorecard(text, confidence);
      setOcrResult(parsed);
      onUpdate(scorecard.id, parsed);
    } catch (error) {
      console.error('OCR failed:', error);
      alert('Failed to process scorecard. Please try again.');
    } finally {
      setIsProcessing(false);
      setOcrProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {scorecard.game.teams.away.team.name} @ {scorecard.game.teams.home.team.name}
              </h2>
              <p className="text-green-100 text-sm">
                {formatDate(scorecard.game.gameDate)} - {scorecard.game.venue.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-green-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'compare'
                  ? 'bg-white text-green-700'
                  : 'text-green-100 hover:bg-green-500'
              }`}
            >
              Compare
            </button>
            <button
              onClick={() => setActiveTab('scorecard')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'scorecard'
                  ? 'bg-white text-green-700'
                  : 'text-green-100 hover:bg-green-500'
              }`}
            >
              My Scorecard
            </button>
            <button
              onClick={() => setActiveTab('official')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'official'
                  ? 'bg-white text-green-700'
                  : 'text-green-100 hover:bg-green-500'
              }`}
            >
              Official Plays
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'stats'
                  ? 'bg-white text-green-700'
                  : 'text-green-100 hover:bg-green-500'
              }`}
            >
              Box Score
            </button>
            <button
              onClick={() => setActiveTab('ocr')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'ocr'
                  ? 'bg-white text-green-700'
                  : 'text-green-100 hover:bg-green-500'
              }`}
            >
              OCR
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'compare' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Your Scorecard */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  Your Scorecard
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={scorecard.imageUrl}
                    alt="Your scorecard"
                    className="w-full h-auto max-h-[50vh] object-contain"
                  />
                </div>
              </div>

              {/* Official Record */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  Official MLB Record
                </h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-[50vh] overflow-y-auto">
                  <OfficialScorecard game={scorecard.game} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scorecard' && (
            <div className="flex justify-center">
              <img
                src={scorecard.imageUrl}
                alt="Your scorecard"
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          )}

          {activeTab === 'official' && (
            <OfficialScorecard game={scorecard.game} />
          )}

          {activeTab === 'stats' && (
            <GameStats game={scorecard.game} />
          )}

          {activeTab === 'ocr' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 mb-2">Experimental: OCR Analysis</h3>
                <p className="text-amber-700 text-sm">
                  Attempt to read text from your handwritten scorecard using OCR.
                  Note: Handwritten scorecards are difficult to parse - use the "Official Plays" tab
                  for accurate game data.
                </p>
              </div>

              {!ocrResult && !isProcessing && (
                <button
                  onClick={handleRunOCR}
                  className="w-full py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Try OCR Analysis
                </button>
              )}

              {isProcessing && ocrProgress && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 capitalize">{ocrProgress.status}...</p>
                  <div className="w-64 mx-auto mt-2 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-600 h-2 rounded-full transition-all"
                      style={{ width: `${ocrProgress.progress * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {ocrResult && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-500">Confidence: </span>
                      <span className={`font-medium ${
                        ocrResult.confidence > 70 ? 'text-green-600' :
                        ocrResult.confidence > 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {ocrResult.confidence.toFixed(1)}%
                      </span>
                    </div>
                    <button
                      onClick={handleRunOCR}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Re-analyze
                    </button>
                  </div>

                  {ocrResult.batters.length > 0 ? (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Detected Players & At-Bats</h4>
                      <div className="space-y-3">
                        {ocrResult.batters.map((batter, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3">
                            <div className="font-medium text-gray-900">
                              {batter.name || `Player ${idx + 1}`}
                              {batter.position && (
                                <span className="text-gray-500 text-sm ml-2">({batter.position})</span>
                              )}
                            </div>
                            {batter.atBats.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {batter.atBats.map((ab, abIdx) => (
                                  <span
                                    key={abIdx}
                                    className="px-2 py-1 bg-white border border-gray-200 rounded text-sm"
                                    title={getResultDescription(ab.result)}
                                  >
                                    {ab.result}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No player data could be extracted from the scorecard.</p>
                      <p className="text-sm mt-2">
                        Try the "Official Plays" tab to see the actual game data.
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Raw OCR Text</h4>
                    <pre className="bg-gray-100 rounded-lg p-4 text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-48">
                      {ocrResult.rawText || 'No text detected'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Final Score: {scorecard.game.teams.away.score} - {scorecard.game.teams.home.score}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
