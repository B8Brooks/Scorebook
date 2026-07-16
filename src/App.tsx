import { useState, useEffect, useCallback } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { GameSelector } from './components/GameSelector';
import { ScorecardGallery } from './components/ScorecardGallery';
import { Settings } from './components/Settings';
import { Scouting } from './components/Scouting';
import { getScorecards, saveScorecard, deleteScorecard, updateScorecard, generateId, getGeminiApiKey } from './services/storage';
import { compressImage } from './utils/imageUtils';
import { detectGameInfo } from './services/ocr';
import { analyzeScorecard } from './services/gemini';
import type { Game, Scorecard } from './types';

type View = 'gallery' | 'upload' | 'scout';

function App() {
  const [view, setView] = useState<View>('gallery');
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [detectedDate, setDetectedDate] = useState<string | null>(null);
  const [scanningImage, setScanningImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setScorecards(getScorecards());
  }, []);

  const handleImageSelect = useCallback(async (imageUrl: string) => {
    setUploadedImage(imageUrl);
    setStep(2);
    setDetectedDate(null);
    setScanningImage(true);

    // Check if Gemini API key is configured
    const geminiApiKey = getGeminiApiKey();

    try {
      if (geminiApiKey) {
        // Use Gemini for better OCR
        console.log('Using Gemini for scorecard analysis...');
        const result = await analyzeScorecard(imageUrl, geminiApiKey);
        if (result.date) {
          setDetectedDate(result.date);
        }
      } else {
        // Fall back to Tesseract OCR
        console.log('Using Tesseract OCR (no Gemini API key configured)...');
        const gameInfo = await detectGameInfo(imageUrl);
        if (gameInfo.date) {
          setDetectedDate(gameInfo.date);
        }
      }
    } catch (error) {
      console.error('Failed to detect game info from image:', error);
    } finally {
      setScanningImage(false);
    }
  }, []);

  const handleGameSelect = useCallback((game: Game) => {
    setSelectedGame(game);
  }, []);

  const handleSave = useCallback(async () => {
    if (!uploadedImage || !selectedGame || saving) return;

    setSaving(true);
    try {
      // Compress the image to reduce storage size
      const compressedImage = await compressImage(uploadedImage, 1200, 0.7);

      const newScorecard: Scorecard = {
        id: generateId(),
        imageUrl: compressedImage,
        game: selectedGame,
        createdAt: new Date().toISOString(),
      };

      saveScorecard(newScorecard);
      setScorecards(getScorecards());

      // Reset form
      setUploadedImage(null);
      setSelectedGame(null);
      setDetectedDate(null);
      setStep(1);
      setView('gallery');
    } catch (error) {
      console.error('Failed to save scorecard:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert('Storage is full. Please delete some old scorecards to make room.');
      } else {
        alert('Failed to save scorecard. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [uploadedImage, selectedGame, saving]);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this scorecard?')) {
      deleteScorecard(id);
      setScorecards(getScorecards());
    }
  }, []);

  const handleUpdateScorecard = useCallback((id: string, updates: Partial<Scorecard>) => {
    updateScorecard(id, updates);
    setScorecards(getScorecards());
  }, []);

  const handleCancel = useCallback(() => {
    setUploadedImage(null);
    setSelectedGame(null);
    setDetectedDate(null);
    setStep(1);
    setView('gallery');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 no-print">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Scorebook</h1>
                <p className="text-sm text-gray-500">Your MLB scorecard collection</p>
              </div>
            </div>
            <nav className="flex gap-2 items-center">
              <button
                onClick={() => setView('gallery')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'gallery'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                My Scorecards
              </button>
              <button
                onClick={() => setView('upload')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'upload'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Add New
              </button>
              <button
                onClick={() => setView('scout')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'scout'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Scout
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'scout' && <Scouting />}

        {view === 'gallery' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                My Scorecards
              </h2>
              <span className="text-gray-500">
                {scorecards.length} {scorecards.length === 1 ? 'card' : 'cards'}
              </span>
            </div>
            <ScorecardGallery scorecards={scorecards} onDelete={handleDelete} onUpdate={handleUpdateScorecard} />
          </div>
        )}

        {view === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                      step >= 1
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    1
                  </div>
                  <span className="ml-2 font-medium text-gray-900">Upload Photo</span>
                </div>
                <div className="w-16 h-0.5 bg-gray-200 mx-4"></div>
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                      step >= 2
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    2
                  </div>
                  <span className="ml-2 font-medium text-gray-900">Select Game</span>
                </div>
              </div>

              {step === 1 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Upload Your Scorecard
                  </h3>
                  <ImageUpload onImageSelect={handleImageSelect} />
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Which game is this scorecard from?
                    </h3>
                    <button
                      onClick={() => setStep(1)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Change photo
                    </button>
                  </div>

                  {uploadedImage && (
                    <div className="mb-6">
                      <img
                        src={uploadedImage}
                        alt="Uploaded scorecard"
                        className="w-full max-h-48 object-contain rounded-lg border border-gray-200"
                      />
                    </div>
                  )}

                  {scanningImage && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      Scanning scorecard for game date...
                    </div>
                  )}

                  {detectedDate && !scanningImage && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Detected date: {new Date(detectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}

                  <GameSelector
                    onGameSelect={handleGameSelect}
                    selectedGame={selectedGame}
                    detectedDate={detectedDate}
                  />

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!selectedGame || !uploadedImage || saving}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        selectedGame && uploadedImage && !saving
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save Scorecard'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>Scorebook - Your personal MLB scorecard collection</p>
          <p className="mt-1">Game data powered by MLB Stats API</p>
        </div>
      </footer>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default App;
