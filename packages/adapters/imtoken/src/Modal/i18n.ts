export const zh: Record<string, string> = {
    title: '扫码连接',
    qrContent: '用 imToken 扫描二维码打开 DApp',
    downloadImToken:
        '或访问 <a href="https://token.im/" target="_blank" rel="noopener noreferrer">https://token.im/</a> 下载 imToken 钱包',
};

export const en: Record<string, string> = {
    title: 'Scan QRCode',
    qrContent: 'Use imToken to scan the QR code',
    downloadImToken:
        'Or visit <a href="https://token.im/" target="_blank" rel="noopener noreferrer">https://token.im/</a> to download',
};

const ZH = ['zh-cn', 'zh-tw', 'zh-hk', 'zh-tc'];

export function i18n(text: string) {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const searchParamsLang = searchParams.get('lang');
    const storageSettingLang = globalThis.localStorage.getItem('lang');
    const appLang = (searchParamsLang || storageSettingLang || '').toLowerCase();
    const browserSettingLang = (globalThis.navigator.language || '').toLowerCase();
    let browserLang: typeof zh | typeof en = zh;
    if (ZH.includes(browserSettingLang) || ZH.includes(appLang)) {
        browserLang = zh;
    } else {
        browserLang = en;
    }
    return browserLang[text] || text;
}
