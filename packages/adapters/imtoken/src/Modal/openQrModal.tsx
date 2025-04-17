import React, { render } from 'preact/compat';
import { Modal } from './Modal.js';
import { QRContent } from './QRContent.js';
import { modalStyleSheetContent } from './style.js';
import { i18n } from './i18n.js';

function prepareDomNode() {
    const div = document.createElement('div');
    const style = document.createElement('style');
    style.innerHTML = modalStyleSheetContent;
    document.body.append(style);
    document.body.append(div);
    function onClose() {
        div.remove();
        style.remove();
    }
    return { div, onClose };
}

/**
 * Open a modal that displays a QR code for the given deep‑link.
 * Returns a close handler.
 */
export function openQrModal(link: string) {
    const { div, onClose } = prepareDomNode();
    render(
        <Modal title={i18n('title')} onClose={onClose}>
            <QRContent link={link} />
        </Modal>,
        div
    );
    return onClose;
}
