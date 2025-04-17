import React from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import QRCode from 'qrcode';
import { i18n } from './i18n.js';

export function QRContent(props: { link: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, props.link, {
                errorCorrectionLevel: 'H',
                width: 240,
                height: 240,
            }).catch((err: Error) => console.error(err));
        }
    }, [props.link]);

    return (
        <div className="imtoken-qr-content">
            <canvas ref={canvasRef} />
            <p>{i18n('qrContent')}</p>
            <p dangerouslySetInnerHTML={{ __html: i18n('downloadImToken') }} />
        </div>
    );
}
