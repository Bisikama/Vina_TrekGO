const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64Encode(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;
    parts.push(
      BASE64_CHARS[a >> 2] +
        BASE64_CHARS[((a & 3) << 4) | (b >> 4)] +
        (hasB ? BASE64_CHARS[((b & 15) << 2) | (c >> 6)] : "=") +
        (hasC ? BASE64_CHARS[c & 63] : "="),
    );
  }
  return parts.join("");
}

/** Địa chỉ trên mạng của một mục không có trong gói bản đồ. */
export function remoteUrlForKey(key: string, styleUrl: string, apiKey: string): string {
  if (key === "style/style.json") return styleUrl;
  if (key.startsWith("terrarium/")) {
    return `https://s3.amazonaws.com/elevation-tiles-prod/${key}`;
  }
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://api.maptiler.com/${path}?key=${encodeURIComponent(apiKey)}`;
}
