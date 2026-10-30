const apiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? "";
const styleId = process.env.EXPO_PUBLIC_MAPTILER_STYLE_ID?.trim() ?? "";
export const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/${encodeURIComponent(styleId)}/style.json?key=${encodeURIComponent(apiKey)}`;