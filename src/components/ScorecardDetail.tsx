import { useState } from 'react';
import type { Scorecard, ParsedScorecardData } from '../types';
import { GameStats } from './GameStats';
import { OfficialScorecard } from './OfficialScorecard';
import { extractTextFromImage, parseScorecard, getResultDescription, type OCRProgress } from '../services/ocr';
import { interpretScorecard, type InterpretedScorecard } from '../services/gemini';
import { getGeminiApiKey, saveTrainingExample, getTrainingExamples, generateId } from '../services/storage';

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
  const [geminiResult, setGeminiResult] = useState<InterpretedScorecard | null>(null);
  const [useGemini, setUseGemini] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResult, setEditedResult] = useState<InterpretedScorecard | null>(null);
  const [trainingCount, setTrainingCount] = useState(getTrainingExamples().length);

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
    const apiKey = getGeminiApiKey();

    if (useGemini && apiKey) {
      // Use Gemini for interpretation
      setOcrProgress({ status: 'Analyzing with Gemini AI', progress: 0.5 });
      try {
        const result = await interpretScorecard(scorecard.imageUrl, apiKey);
        setGeminiResult(result);
        setOcrProgress(null);
      } catch (error) {
        console.error('Gemini interpretation failed:', error);
        alert('Gemini analysis failed. Try again or switch to basic OCR.');
      } finally {
        setIsProcessing(false);
        setOcrProgress(null);
      }
    } else {
      // Fall back to Tesseract OCR
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
    }
  };

  const hasGeminiKey = !!getGeminiApiKey();

  const startEditing = () => {
    if (geminiResult) {
      setEditedResult(JSON.parse(JSON.stringify(geminiResult))); // Deep copy
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setEditedResult(null);
    setIsEditing(false);
  };

  const updateBatterName = (team: 'home' | 'away', batterIdx: number, newName: string) => {
    if (!editedResult) return;
    const batters = team === 'home' ? editedResult.homeBatters : editedResult.awayBatters;
    batters[batterIdx].name = newName;
    setEditedResult({ ...editedResult });
  };

  const updateAtBatResult = (team: 'home' | 'away', batterIdx: number, inning: number, newResult: string) => {
    if (!editedResult) return;
    const batters = team === 'home' ? editedResult.homeBatters : editedResult.awayBatters;
    const atBat = batters[batterIdx].atBats.find(ab => ab.inning === inning);
    if (atBat) {
      atBat.result = newResult;
    } else if (newResult) {
      batters[batterIdx].atBats.push({ inning, result: newResult });
    }
    setEditedResult({ ...editedResult });
  };

  const saveAsTrainingExample = () => {
    if (!editedResult) return;

    const example = {
      id: generateId(),
      imageUrl: scorecard.imageUrl,
      interpretation: editedResult,
      createdAt: new Date().toISOString(),
    };

    saveTrainingExample(example);
    setGeminiResult(editedResult);
    setEditedResult(null);
    setIsEditing(false);
    setTrainingCount(getTrainingExamples().length);
    alert('Saved as training example! Future analyses will learn from your corrections.');
  };

  const currentResult = isEditing && editedResult ? editedResult : geminiResult;

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
            <div className="space-y-6 max-w-4xl mx-auto">
              {hasGeminiKey ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">AI-Powered Scorecard Reader</h3>
                  <p className="text-blue-700 text-sm">
                    Using Gemini AI to read and interpret your handwritten scorecard.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2">Basic OCR Analysis</h3>
                  <p className="text-amber-700 text-sm">
                    Add a Gemini API key in Settings for much better scorecard reading.
                  </p>
                </div>
              )}

              {/* Analysis mode toggle */}
              {hasGeminiKey && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useGemini}
                      onChange={(e) => setUseGemini(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Use Gemini AI (recommended)</span>
                  </label>
                </div>
              )}

              {!geminiResult && !ocrResult && !isProcessing && (
                <button
                  onClick={handleRunOCR}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {hasGeminiKey && useGemini ? 'Read Scorecard with AI' : 'Try Basic OCR'}
                </button>
              )}

              {isProcessing && ocrProgress && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">{ocrProgress.status}...</p>
                </div>
              )}

              {/* Gemini Results */}
              {currentResult && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-green-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Analyzed with Gemini AI
                      </span>
                      {trainingCount > 0 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {trainingCount} training example{trainingCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveAsTrainingExample}
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                          >
                            Save as Training Example
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={startEditing}
                            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                          >
                            Edit & Train
                          </button>
                          <button
                            onClick={() => { setGeminiResult(null); handleRunOCR(); }}
                            className="text-sm text-gray-600 hover:text-gray-800"
                          >
                            Re-analyze
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      <strong>Edit Mode:</strong> Click on any player name or result to correct it.
                      When done, click "Save as Training Example" to teach the AI your handwriting.
                    </div>
                  )}

                  {/* Away Team Batters */}
                  {currentResult.awayBatters.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 bg-gray-600 rounded-full"></span>
                        {currentResult.awayTeam || scorecard.game.teams.away.team.name} (Away)
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-700">Player</th>
                              {[1,2,3,4,5,6,7,8,9].map(i => (
                                <th key={i} className="text-center py-2 px-2 font-medium text-gray-700 w-12">{i}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {currentResult.awayBatters.map((batter, idx) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-3">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={batter.name}
                                      onChange={(e) => updateBatterName('away', idx, e.target.value)}
                                      className="font-medium text-gray-900 bg-white border border-blue-300 rounded px-1 w-full"
                                    />
                                  ) : (
                                    <div className="font-medium text-gray-900">{batter.name}</div>
                                  )}
                                  {batter.position && (
                                    <div className="text-xs text-gray-500">{batter.position}</div>
                                  )}
                                </td>
                                {[1,2,3,4,5,6,7,8,9].map(inning => {
                                  const atBat = batter.atBats.find(ab => ab.inning === inning);
                                  return (
                                    <td key={inning} className="text-center py-2 px-2">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={atBat?.result || ''}
                                          onChange={(e) => updateAtBatResult('away', idx, inning, e.target.value)}
                                          className="w-12 text-center text-xs border border-blue-300 rounded px-1"
                                          placeholder="—"
                                        />
                                      ) : atBat ? (
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                          ['1B', '2B', '3B', 'HR'].includes(atBat.result) ? 'bg-green-100 text-green-800' :
                                          ['BB', 'HBP'].includes(atBat.result) ? 'bg-blue-100 text-blue-800' :
                                          atBat.result.startsWith('E') ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {atBat.result}
                                        </span>
                                      ) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Home Team Batters */}
                  {currentResult.homeBatters.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-600 rounded-full"></span>
                        {currentResult.homeTeam || scorecard.game.teams.home.team.name} (Home)
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-700">Player</th>
                              {[1,2,3,4,5,6,7,8,9].map(i => (
                                <th key={i} className="text-center py-2 px-2 font-medium text-gray-700 w-12">{i}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {currentResult.homeBatters.map((batter, idx) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-3">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={batter.name}
                                      onChange={(e) => updateBatterName('home', idx, e.target.value)}
                                      className="font-medium text-gray-900 bg-white border border-blue-300 rounded px-1 w-full"
                                    />
                                  ) : (
                                    <div className="font-medium text-gray-900">{batter.name}</div>
                                  )}
                                  {batter.position && (
                                    <div className="text-xs text-gray-500">{batter.position}</div>
                                  )}
                                </td>
                                {[1,2,3,4,5,6,7,8,9].map(inning => {
                                  const atBat = batter.atBats.find(ab => ab.inning === inning);
                                  return (
                                    <td key={inning} className="text-center py-2 px-2">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={atBat?.result || ''}
                                          onChange={(e) => updateAtBatResult('home', idx, inning, e.target.value)}
                                          className="w-12 text-center text-xs border border-blue-300 rounded px-1"
                                          placeholder="—"
                                        />
                                      ) : atBat ? (
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                          ['1B', '2B', '3B', 'HR'].includes(atBat.result) ? 'bg-green-100 text-green-800' :
                                          ['BB', 'HBP'].includes(atBat.result) ? 'bg-blue-100 text-blue-800' :
                                          atBat.result.startsWith('E') ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {atBat.result}
                                        </span>
                                      ) : null}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {currentResult.awayBatters.length === 0 && currentResult.homeBatters.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Could not interpret the scorecard.</p>
                      <p className="text-sm mt-2">The handwriting may be difficult to read.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Legacy Tesseract Results */}
              {ocrResult && !geminiResult && (
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
