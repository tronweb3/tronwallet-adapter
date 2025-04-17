export const modalStyleSheetContent = `
.imtoken-modal-mask,
.imtoken-modal-wrap {
  position: fixed;
  top: 0; right: 0; bottom: 0; left: 0;
  z-index: 1000;
  font-family: 'PingFangSC-Regular', 'Arial', sans-serif, 'Droid Sans', 'Helvetica Neue';
}
.imtoken-modal-mask {
  background: rgba(0,0,0,0.45);
}
.imtoken-modal-wrap { overflow: auto; outline: 0; }
.imtoken-modal {
  position: relative;
  margin: 0 auto;
  padding-bottom: 24px;
  top: 50px;
  width: 400px;
}
.imtoken-modal-content {
  position: relative;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.imtoken-modal-close {
  position: absolute;
  top: 0; right: 0;
  width: 48px; height: 48px;
  border: none; background: transparent;
  font-size: 24px; cursor: pointer;
}
.imtoken-modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 18px; font-weight: 500;
  text-align: center;
}
.imtoken-modal-body { padding: 24px; text-align: center; }
.imtoken-qr-content canvas { width: 240px; height: 240px; }
.imtoken-qr-content p { margin-bottom: 16px; font-size: 14px; }
`;
