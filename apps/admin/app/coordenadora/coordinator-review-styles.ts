export const COORDINATOR_REVIEW_CSS = `
  .admin-shell { display: block !important; background: #F2F7F2 !important; }
  .admin-shell .sidebar { display: none !important; }
  .admin-shell .workspace { max-width: none !important; padding: 0 !important; }
  *, *::before, *::after { box-sizing: border-box; }
  .cr-page { min-height: 100vh; background: #F2F7F2; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1A2B20; }
  .cr-center { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .cr-login { background: #fff; border: 1px solid #D0E8C8; border-radius: 20px; box-shadow: 0 16px 48px rgba(27,67,50,.10); padding: 40px; width: 100%; max-width: 440px; }
  .cr-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .cr-brand-mark { width: 44px; height: 44px; background: #1B4332; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 800; }
  .cr-brand-text strong { display: block; font-size: 17px; font-weight: 800; color: #1B4332; }
  .cr-brand-text small { font-size: 12px; color: #6E8C78; }
  .cr-login h1 { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
  .cr-login p { font-size: 14px; color: #5A7060; margin: 0 0 24px; line-height: 1.55; }
  .cr-invite-info { border: 1px solid #D0E8C8; background: #F8FBF7; border-radius: 12px; padding: 12px 14px; margin: 0 0 16px; }
  .cr-invite-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 13px; color: #5A7060; }
  .cr-invite-row strong { color: #1A2B20; text-align: right; }
  .cr-input { width: 100%; border: 1px solid #C8DEC0; border-radius: 10px; padding: 13px 14px; font-size: 14px; color: #1A2B20; background: #F8FBF7; outline: none; margin-bottom: 10px; display: block; }
  .cr-input:focus { border-color: #3E7A3F; background: #fff; }
  .cr-btn { width: 100%; padding: 14px; border-radius: 10px; border: none; background: #1B4332; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 4px; }
  .cr-btn:hover { background: #276246; }
  .cr-btn:disabled { opacity: 0.5; cursor: default; }
  .cr-error { color: #A33A20; background: #FFF1EC; border: 1px solid #F9C9B8; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-top: 10px; }
  .cr-success { color: #1B6B3C; background: #EAF7EE; border: 1px solid #B6DECA; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-top: 10px; }
  .cr-workspace { display: flex; flex-direction: column; min-height: 100vh; }
  .cr-topbar { background: #1B4332; color: #fff; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .cr-topbar-brand { display: flex; align-items: center; gap: 12px; }
  .cr-topbar-mark { width: 36px; height: 36px; background: rgba(255,255,255,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; }
  .cr-topbar-info strong { display: block; font-size: 15px; font-weight: 800; }
  .cr-topbar-info small { font-size: 12px; color: rgba(255,255,255,0.65); }
  .cr-main { padding: 28px; overflow-y: auto; max-width: 980px; margin: 0 auto; width: 100%; }
  .cr-card { background: #fff; border: 1px solid #D0E8C8; border-radius: 16px; padding: 24px; margin-bottom: 20px; }
  .cr-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .cr-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6E8C78; margin: 0 0 4px; }
  .cr-card h2 { font-size: 18px; font-weight: 800; margin: 0; }
  .cr-meta { font-size: 13px; color: #5A7060; line-height: 1.6; margin: 0 0 16px; }
  .cr-badge { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
  .cr-badge.approved { background: #DCF5E0; color: #1B6B3C; }
  .cr-badge.changes { background: #FFF3DB; color: #7A5000; }
  .cr-badge.pending { background: #F0F0F0; color: #6E7C70; }
  .cr-editor-wrap { position: relative; }
  .cr-editor-toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border: 1px solid #C8DEC0; border-bottom: none; border-radius: 10px 10px 0 0; padding: 8px 10px; background: rgba(248, 251, 247, 0.96); backdrop-filter: blur(8px); box-shadow: 0 8px 18px rgba(27, 67, 50, 0.08); }
  .cr-tool-btn { border: 1px solid #D0E8C8; background: #fff; color: #1A2B20; border-radius: 8px; min-width: 34px; height: 32px; padding: 0 10px; font-size: 12px; font-weight: 800; cursor: pointer; }
  .cr-tool-btn:hover { border-color: #3E7A3F; }
  .cr-color-btn { width: 28px; height: 28px; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 1px #C8DEC0; cursor: pointer; }
  .cr-document-editor { width: 100%; min-height: 360px; border: 1px solid #C8DEC0; border-radius: 0 0 10px 10px; padding: 24px 28px; font-size: 15px; line-height: 1.8; background: #fff; color: #1A2B20; outline: none; font-family: Georgia, 'Times New Roman', serif; }
  .cr-document-editor:focus { border-color: #3E7A3F; }
  .cr-document-editor p { margin: 0 0 14px; }
  .cr-document-editor p:last-child { margin-bottom: 0; }
  .cr-document-editor section { margin-bottom: 18px; }
  .cr-document-editor b, .cr-document-editor strong { font-weight: 800; color: #0F261D; }
  .cr-document-editor h1, .cr-document-editor h2, .cr-document-editor h3 { font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #1B4332; margin: 18px 0 10px; line-height: 1.25; }
  .cr-editor-hint { font-size: 11px; color: #6E8C78; margin: 8px 0 0; line-height: 1.4; }
  .cr-notes-area { width: 100%; min-height: 80px; border: 1px solid #C8DEC0; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.6; background: #FAFCF9; color: #1A2B20; resize: vertical; outline: none; font-family: inherit; margin-top: 12px; display: block; }
  .cr-notes-area:focus { border-color: #3E7A3F; background: #fff; }
  .cr-section-label { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #6E8C78; margin: 16px 0 6px; display: block; }
  .cr-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
  .cr-action-btn { flex: 1; min-width: 120px; padding: 12px 16px; border-radius: 10px; border: 1px solid; font-size: 13px; font-weight: 700; cursor: pointer; }
  .cr-action-btn:disabled { opacity: 0.5; cursor: default; }
  .cr-action-btn.comment { background: #F0F9F0; color: #1B4332; border-color: #B6D9AA; }
  .cr-action-btn.request { background: #FFF3DB; color: #7A5000; border-color: #F5D990; }
  .cr-action-btn.approve { background: #1B4332; color: #fff; border-color: #1B4332; }
  .cr-action-btn.approve:hover:not(:disabled) { background: #276246; }
  .cr-history { border-top: 1px solid #E4F0DC; margin-top: 20px; padding-top: 16px; }
  .cr-history h3 { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #6E8C78; margin: 0 0 12px; }
  .cr-event { padding: 10px 12px; border-radius: 8px; border: 1px solid #E4F0DC; background: #F8FBF7; margin-bottom: 8px; }
  .cr-event-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .cr-event-header strong { font-size: 12px; color: #1A2B20; }
  .cr-event-header span { font-size: 11px; color: #6E8C78; }
  .cr-event p { font-size: 12px; color: #5A7060; margin: 0; line-height: 1.5; }
  @media (max-width: 720px) {
    .cr-login { padding: 28px 22px; }
    .cr-main { padding: 18px; }
    .cr-action-btn { min-width: 100%; }
  }
`
