// components.js — โหลด nav และ footer เข้าทุกหน้า
async function loadComponent(id, path) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Not found');
    el.innerHTML = await res.text();
    if (id === 'nav-root') initNav();
  } catch(e) {
    console.warn('Component load failed:', path, e);
  }
}

function initNav() {
  // Sticky shadow
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('main-nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
  });
  // Lang switcher close on outside click
  document.addEventListener('click', e => {
    const sel = document.getElementById('langSel');
    if (sel && !e.target.closest('#langSel')) sel.classList.remove('open');
  });
}

window.setLang = function(code, el) {
  const label = document.getElementById('langLabel');
  if (label) label.textContent = code;
  document.querySelectorAll('.lang-item').forEach(i => i.classList.remove('lang-active'));
  el.classList.add('lang-active');
  document.getElementById('langSel')?.classList.remove('open');
};

// โหลด components เมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('nav-root', '/components/nav.html');
  loadComponent('footer-root', '/components/footer.html');
});
