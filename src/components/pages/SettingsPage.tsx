import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Cpu,
  Cloud,
  ShieldCheck,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Key,
  Zap,
  Save,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import {
  PROVIDERS,
  PROVIDER_MODELS,
  getActiveModel,
  testConnection,
  loadAISettings,
  DEFAULT_SETTINGS,
  type AISettings,
  type ModelSelection,
} from '../../services/ai';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ai' | 'general' | 'about'>('ai');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Fetch settings from DB
  const preferences = useLiveQuery(() => db.preferences.toArray());

  // Local state for form handling before save
  const [localSettings, setLocalSettings] = useState<AISettings>(DEFAULT_SETTINGS);

  // Load from DB when ready (with auto-migration of broken model IDs)
  useEffect(() => {
    if (preferences) {
      loadAISettings().then(settings => setLocalSettings(settings));
    }
  }, [preferences]);

  const handleSave = async () => {
    try {
      const aiPref = preferences?.find(p => p.key === 'ai_settings');
      if (aiPref?.id) {
        await db.preferences.update(aiPref.id, { value: localSettings as any });
      } else {
        await db.preferences.add({ key: 'ai_settings', value: localSettings as any });
      }
      setTestResult({ success: true, message: 'Settings saved successfully' });
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setTestResult({ success: false, message: 'Failed to save settings' });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(localSettings);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: 'Test failed unexpectedly.' });
    }

    setIsTesting(false);
  };

  // Get current provider meta
  const currentProvider = PROVIDERS.find(p => p.id === localSettings.provider) || PROVIDERS[0];
  const availableModels = PROVIDER_MODELS[localSettings.provider] || [];
  const currentModels = localSettings.customModels?.[localSettings.provider] || {};

  const updateCustomModel = (field: keyof ModelSelection, value: string) => {
    setLocalSettings({
      ...localSettings,
      customModels: {
        ...localSettings.customModels,
        [localSettings.provider]: {
          ...currentModels,
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-light text-gray-900 tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-[#B8925C]" />
          System Settings
        </h1>
        <p className="text-gray-500 max-w-2xl">
          Configure your AI processing engine. Choose between cloud-based power or complete local privacy.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl w-fit">
        {['ai', 'general', 'about'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'ai' && ' Connectivity'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'ai' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >

            {/* AI Mode Switcher */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-gray-400" />
                  Processing Mode
                </h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cloud Mode Option */}
                <div
                  onClick={() => setLocalSettings({ ...localSettings, mode: 'cloud' })}
                  className={`relative cursor-pointer group p-6 rounded-xl border-2 transition-all duration-300 ${localSettings.mode === 'cloud'
                    ? 'border-[#B8925C] bg-[#B8925C]/5'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <Cloud className={`w-6 h-6 ${localSettings.mode === 'cloud' ? 'text-[#B8925C]' : 'text-gray-400'}`} />
                    </div>
                    {localSettings.mode === 'cloud' && (
                      <div className="w-3 h-3 rounded-full bg-[#B8925C] shadow-[0_0_0_4px_rgba(184,146,92,0.1)]" />
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Cloud API</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Connect to powerful external models like GPT-4 or Claude 3. Requires an API key.
                    Best for complex reasoning and reasoning tasks.
                  </p>
                </div>

                {/* Local Mode Option */}
                <div
                  onClick={() => setLocalSettings({ ...localSettings, mode: 'local' })}
                  className={`relative cursor-pointer group p-6 rounded-xl border-2 transition-all duration-300 ${localSettings.mode === 'local'
                    ? 'border-[#5F865F] bg-[#5F865F]/5'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white rounded-lg shadow-sm">
                      <ShieldCheck className={`w-6 h-6 ${localSettings.mode === 'local' ? 'text-[#5F865F]' : 'text-gray-400'}`} />
                    </div>
                    {localSettings.mode === 'local' && (
                      <div className="w-3 h-3 rounded-full bg-[#5F865F] shadow-[0_0_0_4px_rgba(95,134,95,0.1)]" />
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Local / Private</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Run models on your own hardware (Ollama, LM Studio).
                    <strong>100% Privacy.</strong> No data ever leaves your machine.
                  </p>
                </div>
              </div>
            </section>

            {/* Dynamic Configuration Section */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  {localSettings.mode === 'cloud' ? <Key className="w-5 h-5 text-gray-400" /> : <Server className="w-5 h-5 text-gray-400" />}
                  {localSettings.mode === 'cloud' ? 'API Configuration' : 'Local Endpoint Configuration'}
                </h2>

                {testResult && (
                  <span className={`text-sm flex items-center gap-2 px-3 py-1 rounded-full ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {testResult.message}
                  </span>
                )}
              </div>

              {localSettings.mode === 'cloud' ? (
                /* Cloud Config */
                <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in">
                  {/* Provider Grid — scrollable */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setLocalSettings({ ...localSettings, provider: p.id })}
                        className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${localSettings.provider === p.id
                          ? 'border-[#B8925C] bg-[#B8925C]/5'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className={`text-sm font-semibold ${localSettings.provider === p.id ? 'text-[#B8925C]' : 'text-gray-700'}`}>
                            {p.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 leading-tight line-clamp-2">
                          {p.description}
                        </span>
                        {p.supportsVision && (
                          <span className="mt-1.5 text-[9px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">
                            VISION
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 flex justify-between">
                      <span>API Keys ({(localSettings.apiKeys[localSettings.provider] || []).length})</span>
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="text-xs text-[#B8925C] hover:underline flex items-center gap-1"
                      >
                        {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showApiKey ? 'Hide Keys' : 'Show Keys'}
                      </button>
                    </label>

                    {/* Individual key fields */}
                    <div className="space-y-2">
                      {(localSettings.apiKeys[localSettings.provider] || []).map((key, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={key}
                              onChange={(e) => {
                                const keys = [...(localSettings.apiKeys[localSettings.provider] || [])];
                                keys[idx] = e.target.value;
                                setLocalSettings({
                                  ...localSettings,
                                  apiKeys: { ...localSettings.apiKeys, [localSettings.provider]: keys }
                                });
                              }}
                              className="w-full pl-4 pr-16 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C] transition-all outline-none font-mono text-xs"
                              placeholder={`Key #${idx + 1}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const keys = [...(localSettings.apiKeys[localSettings.provider] || [])];
                              keys.splice(idx, 1);
                              setLocalSettings({
                                ...localSettings,
                                apiKeys: { ...localSettings.apiKeys, [localSettings.provider]: keys }
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove key"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {/* Add Key Button */}
                      <button
                        onClick={() => {
                          const keys = [...(localSettings.apiKeys[localSettings.provider] || []), ''];
                          setLocalSettings({
                            ...localSettings,
                            apiKeys: { ...localSettings.apiKeys, [localSettings.provider]: keys }
                          });
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-[#B8925C] hover:text-[#B8925C] hover:bg-[#B8925C]/5 transition-all"
                      >
                        <Zap className="w-4 h-4" />
                        + Add API Key
                      </button>
                    </div>

                    <p className="text-[10px] text-gray-400 mt-1">
                      Multiple keys enable automatic failover — if one key fails, the next is used automatically with a notification.
                    </p>

                    {/* Dynamic Provider Guidance — auto-generated from PROVIDERS metadata */}
                    <div className="flex items-start gap-2 mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <div className="mt-0.5 min-w-[16px]">💡</div>
                      <p>
                        Get your API key from{' '}
                        <a href={currentProvider.keyUrl} target="_blank" rel="noreferrer" className="text-[#B8925C] hover:underline font-medium">
                          {new URL(currentProvider.keyUrl).hostname.replace('www.', '')}
                        </a>
                        . Chat model: <code className="bg-gray-200 px-1 rounded text-[10px]">{currentProvider.chatModel}</code>
                        {currentProvider.supportsVision && (
                          <>{' '}| Vision: <code className="bg-gray-200 px-1 rounded text-[10px]">{currentProvider.visionModel}</code></>
                        )}
                      </p>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      Your keys are stored locally in your browser's encrypted database. They are never sent to our servers.
                    </p>
                  </div>

                  {/* ── Model Selection ── */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#B8925C]" />
                      Modelo de Chat
                    </h4>
                    <div className="space-y-2">
                      <select
                        value={currentModels.chatModel || ''}
                        onChange={(e) => updateCustomModel('chatModel', e.target.value)}
                        className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C] outline-none transition-all"
                      >
                        <option value="">Por defecto: {currentProvider.chatModel}</option>
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.recommended ? '⭐ ' : ''}{m.name}{m.free ? ' (gratis)' : ''}{m.vision ? ' 👁️' : ''}
                          </option>
                        ))}
                      </select>
                      {/* Show free tag for OpenRouter */}
                      {localSettings.provider === 'openrouter' && (
                        <div className="flex flex-wrap gap-1.5">
                          {availableModels.filter(m => m.free).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updateCustomModel('chatModel', m.id)}
                              className={`text-[10px] px-2 py-1 rounded-full border transition-all ${currentModels.chatModel === m.id
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-700 font-semibold'
                                : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-200'
                                }`}
                            >
                              {m.recommended ? '⭐ ' : '🆓 '}{m.name.replace('🆓 ', '')}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={currentModels.chatModel || ''}
                          onChange={(e) => updateCustomModel('chatModel', e.target.value)}
                          placeholder="O escribe un modelo personalizado..."
                          className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C] outline-none transition-all font-mono"
                        />
                        {currentModels.chatModel && (
                          <button
                            onClick={() => updateCustomModel('chatModel', '')}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Modelo activo: <code className="bg-gray-200 px-1 rounded">{getActiveModel(localSettings, 'chat')}</code>
                      </p>
                    </div>

                    {/* Vision Model — only show if provider supports vision */}
                    {currentProvider.supportsVision && (
                      <>
                        <div className="h-px bg-gray-200" />
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-blue-500" />
                          Modelo de Visión (Escaneo)
                        </h4>
                        <div className="space-y-2">
                          <select
                            value={currentModels.visionModel || ''}
                            onChange={(e) => updateCustomModel('visionModel', e.target.value)}
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C] outline-none transition-all"
                          >
                            <option value="">Por defecto: {currentProvider.visionModel || currentProvider.chatModel}</option>
                            {availableModels.filter(m => m.vision).map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.recommended ? '⭐ ' : ''}{m.name}{m.free ? ' (gratis)' : ''} 👁️
                              </option>
                            ))}
                          </select>
                          {/* Show free vision tag for OpenRouter */}
                          {localSettings.provider === 'openrouter' && (
                            <div className="flex flex-wrap gap-1.5">
                              {availableModels.filter(m => m.free && m.vision).map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => updateCustomModel('visionModel', m.id)}
                                  className={`text-[10px] px-2 py-1 rounded-full border transition-all ${currentModels.visionModel === m.id
                                    ? 'bg-blue-100 border-blue-300 text-blue-700 font-semibold'
                                    : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 hover:border-blue-200'
                                    }`}
                                >
                                  {m.recommended ? '⭐ ' : '👁️ '}{m.name.replace('🆓 ', '')}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={currentModels.visionModel || ''}
                              onChange={(e) => updateCustomModel('visionModel', e.target.value)}
                              placeholder="O escribe un modelo personalizado..."
                              className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#B8925C]/20 focus:border-[#B8925C] outline-none transition-all font-mono"
                            />
                            {currentModels.visionModel && (
                              <button
                                onClick={() => updateCustomModel('visionModel', '')}
                                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Modelo activo: <code className="bg-gray-200 px-1 rounded">{getActiveModel(localSettings, 'vision')}</code>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Local Config */
                <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-amber-900">Hardware Requirement</h4>
                      <p className="text-sm text-amber-700">
                        Running local models requires significant RAM and GPU power.
                        Ensure you have Ollama or LM Studio running in the background.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Local Endpoint URL</label>
                      <input
                        type="text"
                        value={localSettings.local.endpoint}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          local: { ...localSettings.local, endpoint: e.target.value }
                        })}
                        placeholder="http://localhost:11434"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5F865F]/20 focus:border-[#5F865F] transition-all outline-none font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Model Name</label>
                      <input
                        type="text"
                        value={localSettings.local.model}
                        onChange={(e) => setLocalSettings({
                          ...localSettings,
                          local: { ...localSettings.local, model: e.target.value }
                        })}
                        placeholder="llama3, mistral, deepseek-r1"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#5F865F]/20 focus:border-[#5F865F] transition-all outline-none font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Troubleshooting</h4>
                    <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
                      <li>Ensure your local server (e.g., Ollama) is running.</li>
                      <li>Check if port <code>11434</code> (Ollama) or <code>1234</code> (LM Studio) is accessible.</li>
                      <li>Verify the model name exactly matches what you downloaded (run <code>ollama list</code>).</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Test Connection
                </button>
                <button
                  onClick={handleSave}
                  className={`px-6 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg shadow-gray-200 transition-all flex items-center gap-2 ${localSettings.mode === 'cloud'
                    ? 'bg-[#B8925C] hover:bg-[#A47E4E] shadow-[#B8925C]/20'
                    : 'bg-[#5F865F] hover:bg-[#4d6e4d] shadow-[#5F865F]/20'
                    }`}
                >
                  <Save className="w-4 h-4" />
                  Save Configuration
                </button>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'general' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6"
          >
            <h2 className="text-lg font-medium text-gray-900">General Preferences</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-800">Auto-process uploads</p>
                  <p className="text-xs text-gray-500">Automatically analyze documents when uploaded</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#7C5C3F] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-800">Encrypt exports</p>
                  <p className="text-xs text-gray-500">Apply encryption when exporting data backups</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#7C5C3F] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'about' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6 max-w-2xl"
          >
            <div className="flex items-center gap-4">
              <img src="/docia-icon.jpg" alt="DocIA" className="w-16 h-16 rounded-2xl shadow-md" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">DocIA</h2>
                <p className="text-sm text-gray-500">Version 1.0.0 Beta</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                <strong>DocIA</strong> is a privacy-first document intelligence assistant. All your
                data stays in your browser — zero cloud storage, zero tracking.
              </p>
              <p>
                Powered by AI for document scanning, data extraction, and template management.
                Connect to cloud AI providers or use local models for complete privacy.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-sage-400" />
                Local-first architecture — IndexedDB storage
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-sage-400" />
                Multi-provider AI support (OpenAI, Anthropic, Gemini, Groq)
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-sage-400" />
                Local model support via Ollama / LM Studio
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
};

export default SettingsPage;
