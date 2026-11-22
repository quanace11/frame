'use strict';
/* ========= Basics ========= */
const $ = s => document.querySelector(s);
const DPR = Math.min(window.devicePixelRatio || 1, 2);
let W = 1080, H = 1920;
const PALETTE = ['#111111','#ffffff','#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#8e24aa','#f6c7a8','#8d6e63','#9e9e9e','#00acc1'];
const S = {
  frames: [], bgs: [], cur: 0, layer: 'char', tool: 'brush',
  color: '#111111', size: 8, opacity: 1, pressure: true, brush: 'pen', eraserType: 'hard', recentColors: [], brushOp: {}, sizeScreen: true,
  onion: true, onionAlpha: 0.3, showBg: true, showChar: true, showCol: true, showVec: true, showPP: true, bendR: 160, mbendR: 0, vdm: 'point', snap: false, snapR: 24,
  fingerDraw: false, smooth: 0.3, defaultDur: 0.1, loop: true, fillTol: 120,
  uiHide: { rail: false, top: false, tl: false }
};
let uidN = 1;
const newId = () => Date.now().toString(36) + (uidN++).toString(36);
function makeCanvas(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const curFrame = () => S.frames[S.cur];
const bgOf = f => f ? S.bgs.find(b => b.id === f.bgId) : null;
function activeObj() { const f = curFrame(); return S.layer === 'bg' ? bgOf(f) : f; } // 'vec', 'char' and 'col' all live on the frame
// colour layer: each frame may have f.col (a canvas under the line pixels). Fill writes here, so erasing a line never moves the colour.
function colOf(f, make) { if (!f.col && make && f.kind === 'char' && f.canvas) f.col = makeCanvas(); return f.col; }
function copyCol(dst, src) { if (src && src.col) { colOf(dst, true).getContext('2d').drawImage(src.col, 0, 0); dst.colVer = (dst.colVer || 0) + 1; } }
function freeFrame(f) { if (f.canvas) f.canvas.width = 0; if (f.col) { f.col.width = 0; f.col = null; } }
function drawCol(x, f, w, h) { if (S.showCol && f.col) w ? x.drawImage(f.col, 0, 0, w, h) : x.drawImage(f.col, 0, 0); }
function objByTarget(t) { return t.type === 'bg' ? S.bgs.find(b => b.id === t.id) : S.frames.find(f => f.id === t.id); }
const targetOf = o => ({ type: o.kind, id: o.id });

let toastT;
function toast(msg, ms = 1800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

/* ========= Settings ========= */
const SETTINGS_KEYS = ['color','size','opacity','pressure','onion','onionAlpha','fingerDraw','smooth','defaultDur','loop','snap','snapR','tlCollapsed','rotGesture','vdm','mbendR','lineLayer','uiHide','panelHidden','brush','eraserType','recentColors','brushOp','sizeScreen','bigUi','fastVideo','selMode','warpSoft','atlOpen'];
function loadSettings() { try { const o = JSON.parse(localStorage.getItem('fs-settings') || '{}'); for (const k of SETTINGS_KEYS) if (k in o) { if (k === 'panelHidden') Object.assign(panelHidden, o[k]); else S[k] = o[k]; } } catch (e) {}
  S.uiHide = Object.assign({ rail: false, top: false, tl: false }, S.uiHide); }
function applyBigUi() { document.body.classList.toggle('bigui', !!S.bigUi); }
function saveSettings() { try { const o = {}; for (const k of SETTINGS_KEYS) o[k] = S[k]; localStorage.setItem('fs-settings', JSON.stringify(o)); } catch (e) {} }

