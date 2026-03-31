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

// NOTE: Dead callers removed (no task type, workflow step, or frontend uses them):
// - Audio: callSuno (suno.ts), callUdio (udio.ts)
// - OCR: callMistralOCR (mistral.ts), callGoogleVisionOCR, callGoogleTTS (google.ts)
// - Mockups: callPrintful (printful.ts), callPrintify (printify.ts)
// Source files retained for future use; re-export when wired into a workflow.
