// LLM Service - Unified interface for Ollama and OpenRouter

export { CompanyExtractor, companyExtractor } from './CompanyExtractor';

// LLM Configuration
export const LLM_CONFIG = {
    ollama: {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
        enabled: !!process.env.OLLAMA_URL
    },
    openrouter: {
        url: 'https://openrouter.ai/api/v1',
        model: 'meta-llama/llama-3.1-8b-instruct',
        enabled: !!process.env.OPENROUTER_API_KEY,
        costPer1k: 0.000001 // Ultra cheap!
    }
};

// Get preferred provider
export const getPreferredProvider = (): 'ollama' | 'openrouter' => {
    if (LLM_CONFIG.ollama.enabled) return 'ollama';
    if (LLM_CONFIG.openrouter.enabled) return 'openrouter';
    return 'ollama'; // Default
};
