// ============================================================
// Barrel export for all AI provider callers
// ============================================================

export { AICallerError } from "./errors";

// --- Text/Chat providers ---
export { callDeepSeek } from "./deepseek";
export { callQwen } from "./qwen";
export { callDoubao } from "./doubao";
export { callGroq } from "./groq";
export { callFireworks } from "./fireworks";
export { callMoonshot } from "./moonshot";
export { callMiniMax } from "./minimax";
export { callHuggingFaceText, callHuggingFaceImage, callHuggingFaceMusic, callHuggingFaceTTS } from "./huggingface";

// --- Search providers ---
export { callTavily } from "./tavily";
export { callExa } from "./exa";
export { callSerpAPI } from "./serpapi";
export { callDataForSEO } from "./dataforseo";

// --- Image providers ---
export { callFal } from "./flux";
export { callIdeogram } from "./ideogram";
export { callSegmind } from "./segmind";

// --- Image editing ---
export { callClipDropRemoveBackground, callClipDropUpscale, callClipDropCleanup } from "./clipdrop";

// Dead callers removed — no task type, workflow step, or frontend referenced them:
// - Audio: suno.ts, udio.ts
// - OCR/TTS: mistral.ts, google.ts
// - Mockups: printful.ts, printify.ts
// Re-add when a workflow step or task type needs them.
