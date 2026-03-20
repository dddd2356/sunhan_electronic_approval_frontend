

export function detectMimeFromBase64(b64: string): string {
    try {
        const bin = atob(b64.substring(0, 4));
        const b0 = bin.charCodeAt(0), b1 = bin.charCodeAt(1);
        if (b0 === 0xFF && b1 === 0xD8) return 'image/jpeg';
        if (b0 === 0x89 && b1 === 0x50) return 'image/png';
        if (b0 === 0x47 && b1 === 0x49) return 'image/gif';
    } catch {}
    return 'image/png';
}

// data URL이든 순수 base64든 실제 바이트 기준으로 올바른 MIME의 data URL로 변환
// (기존에 잘못된 MIME으로 저장된 data URL도 재감지)
export function toSafeDataUrl(value: string): string {
    if (!value) return '';
    const cleaned = value.replace(/\s/g, '');
    const base64 = cleaned.startsWith('data:')
        ? cleaned.substring(cleaned.indexOf(',') + 1)
        : cleaned;
    return `data:${detectMimeFromBase64(base64)};base64,${base64}`;
}