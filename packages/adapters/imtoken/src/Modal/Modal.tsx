import React from 'preact/compat';
import type { RenderableProps } from 'preact';

type ModalProps = RenderableProps<{
    onClose: () => void;
    title: string;
    width?: number | string;
}>;

export function Modal(props: ModalProps) {
    return (
        <div className="imtoken-modal-root">
            <div className="imtoken-modal-mask" onClick={props.onClose}></div>
            <div className="imtoken-modal-wrap">
                <div className="imtoken-modal" style={{ width: props.width || '400px' }}>
                    <div className="imtoken-modal-content">
                        <button
                            onClick={props.onClose}
                            aria-label="Close"
                            type="button"
                            className="imtoken-modal-close"
                        >
                            ×
                        </button>
                        <div className="imtoken-modal-header">{props.title}</div>
                        <div className="imtoken-modal-body">{props.children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
