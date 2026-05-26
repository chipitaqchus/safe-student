/* =========================================
   SAFE STUDENT — Script.js v1.0
   Lógica completa de la aplicación
   ========================================= */

'use strict';

// ─── ESTADO GLOBAL ──────────────────────────
const APP = {
  currentSection: 'home',
  theme: localStorage.getItem('ss-theme') || 'dark',
  location: null,
  deferredInstallPrompt: null,
  activeType: null,
  editingMedId: null,
  notificationPermission: false,
};

// ─── UTILITARIOS ────────────────────────────

/**
 * Genera un UUID sencillo
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Formatea fecha legible
 */
function formatDate(ts) {
  return new Date(ts).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Escapa HTML para evitar XSS
 */
function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ─── STORAGE ─────────────────────────────────

const Storage = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('Storage error:', e); }
  },
  remove(key) { localStorage.removeItem(key); }
};

// ─── TOAST SYSTEM ────────────────────────────

const Toast = {
  container: null,
  init() {
    this.container = document.getElementById('toastContainer');
  },
  show(msg, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
      <div class="toast-msg">${escHtml(msg)}</div>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('exit');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }
};

// ─── NAVEGACIÓN ──────────────────────────────

const Nav = {
  sections: ['home', 'sos', 'reportes', 'recordatorios'],

  init() {
    // Click en links de nav
    document.querySelectorAll('[data-section]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const sec = el.dataset.section;
        if (sec) this.goto(sec);
      });
    });

    // Hash inicial
    const hash = location.hash.replace('#', '');
    if (this.sections.includes(hash)) {
      this.goto(hash, false);
    } else {
      this.goto('home', false);
    }
  },

  goto(section, animate = true) {
    if (!this.sections.includes(section)) return;

    // Ocultar todas
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('active');
    });

    // Mostrar la activa
    const target = document.getElementById(`section-${section}`);
    if (target) {
      if (!animate) target.style.animation = 'none';
      target.classList.add('active');
      if (!animate) setTimeout(() => { target.style.animation = ''; }, 10);
    }

    // Actualizar nav links
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.section === section);
    });

    APP.currentSection = section;
    location.hash = section;

    // Cerrar mobile menu
    MobileMenu.close();

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// ─── MENÚ MÓVIL ──────────────────────────────

const MobileMenu = {
  btn: null,
  menu: null,
  open: false,

  init() {
    this.btn = document.getElementById('navHamburger');
    this.menu = document.getElementById('mobileMenu');

    this.btn?.addEventListener('click', () => this.toggle());

    // Cerrar al click fuera
    document.addEventListener('click', (e) => {
      if (this.open && !this.menu.contains(e.target) && !this.btn.contains(e.target)) {
        this.close();
      }
    });
  },

  toggle() { this.open ? this.close() : this.openMenu(); },

  openMenu() {
    this.open = true;
    this.btn?.classList.add('open');
    this.menu?.classList.add('open');
  },

  close() {
    this.open = false;
    this.btn?.classList.remove('open');
    this.menu?.classList.remove('open');
  }
};

// ─── DARK MODE ────────────────────────────────

const ThemeManager = {
  init() {
    document.documentElement.setAttribute('data-theme', APP.theme);
    this.updateBtn();

    document.getElementById('darkModeBtn')?.addEventListener('click', () => this.toggle());
    document.getElementById('darkModeBtnMobile')?.addEventListener('click', () => this.toggle());
  },

  toggle() {
    APP.theme = APP.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', APP.theme);
    Storage.set('ss-theme', APP.theme);
    this.updateBtn();
  },

  updateBtn() {
    const icon = APP.theme === 'dark' ? '☀️' : '🌙';
    document.querySelectorAll('#darkModeBtn, #darkModeBtnMobile').forEach(btn => {
      if (btn) btn.textContent = icon;
    });
  }
};

// ─── NAVBAR SCROLL ────────────────────────────

function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ─── SISTEMA SOS ─────────────────────────────

const SOS = {
  active: false,
  coords: null,

  init() {
    document.getElementById('sosMainBtn')?.addEventListener('click', () => this.activate());
    document.getElementById('sosGetLocation')?.addEventListener('click', () => this.getLocation());
    document.getElementById('sosBtnWhatsapp')?.addEventListener('click', () => this.sendWhatsapp());
    document.getElementById('sosBtnEmail')?.addEventListener('click', () => this.sendEmail());
    document.getElementById('sosBtnCopy')?.addEventListener('click', () => this.copyMsg());
  },

  activate() {
    const btn = document.getElementById('sosMainBtn');
    btn?.classList.add('activated');
    setTimeout(() => btn?.classList.remove('activated'), 600);

    this.playAlert();
    this.getLocation();
    Toast.show('🚨 SOS activado. Obteniendo ubicación...', 'warning', 4000);
  },

  playAlert() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const freqs = [880, 660, 880];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.15);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      });
    } catch {}
  },

  getLocation() {
    const statusEl = document.getElementById('locationStatus');
    const statusText = document.getElementById('locationStatusText');

    this.setStatus('loading', '🔍 Obteniendo ubicación GPS...');

    if (!navigator.geolocation) {
      this.setStatus('error', '❌ Geolocalización no disponible en este dispositivo.');
      Toast.show('GPS no disponible.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        APP.location = { lat, lng, accuracy };
        this.coords = { lat, lng, accuracy };

        this.setStatus('success', `✅ Ubicación obtenida (±${Math.round(accuracy)}m)`);

        // Mostrar coordenadas
        document.getElementById('coordLat').textContent = lat.toFixed(6);
        document.getElementById('coordLng').textContent = lng.toFixed(6);
        document.getElementById('coordAcc').textContent = `±${Math.round(accuracy)}m`;

        // Cargar mapa
        this.loadMap(lat, lng);

        // Habilitar botones
        document.getElementById('sosBtnWhatsapp')?.removeAttribute('disabled');
        document.getElementById('sosBtnEmail')?.removeAttribute('disabled');
        document.getElementById('sosBtnCopy')?.removeAttribute('disabled');

        Toast.show('📍 Ubicación obtenida correctamente.', 'success');
      },
      (err) => {
        const msgs = {
          1: 'Permiso de ubicación denegado. Ve a Configuración > Permisos.',
          2: 'No se pudo obtener la ubicación. Verifica el GPS.',
          3: 'Tiempo agotado. Intenta de nuevo.'
        };
        this.setStatus('error', `❌ ${msgs[err.code] || 'Error desconocido.'}`);
        Toast.show(msgs[err.code] || 'Error al obtener ubicación.', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  },

  setStatus(type, msg) {
    const el = document.getElementById('locationStatus');
    if (!el) return;
    el.className = `location-status ${type}`;
    const text = el.querySelector('.status-text');
    if (text) text.textContent = msg;
  },

  loadMap(lat, lng) {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    const zoom = 15;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.005},${lat-0.005},${lng+0.005},${lat+0.005}&layer=mapnik&marker=${lat},${lng}`;
    mapContainer.innerHTML = `<iframe src="${mapUrl}" title="Tu ubicación" allowfullscreen loading="lazy"></iframe>`;
  },

  buildMessage() {
    if (!this.coords) return '⚠️ Necesito ayuda urgente. No se pudo obtener la ubicación exacta. Por favor contáctame de inmediato.';
    const { lat, lng } = this.coords;
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
    return `🚨 *EMERGENCIA - SAFE STUDENT*\n\n` +
      `Necesito ayuda urgente. Esta es mi ubicación:\n\n` +
      `📍 Google Maps: ${mapsUrl}\n` +
      `🗺️ OpenStreetMap: ${osmUrl}\n\n` +
      `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
      `Precisión: ±${Math.round(this.coords.accuracy)}m\n\n` +
      `Enviado desde: SAFE STUDENT App\n` +
      `Hora: ${new Date().toLocaleString('es-PE')}`;
  },

  sendWhatsapp() {
    const msg = encodeURIComponent(this.buildMessage());
    const phone = document.getElementById('sosPhone')?.value?.replace(/\D/g, '') || '';
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
    Toast.show('Abriendo WhatsApp...', 'success');
  },

  sendEmail() {
    const subject = encodeURIComponent('🚨 EMERGENCIA - SAFE STUDENT');
    const body = encodeURIComponent(this.buildMessage().replace(/\*/g, ''));
    const email = document.getElementById('sosEmail')?.value || '';
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    Toast.show('Abriendo cliente de correo...', 'info');
  },

  copyMsg() {
    const msg = this.buildMessage();
    navigator.clipboard.writeText(msg)
      .then(() => Toast.show('📋 Mensaje copiado al portapapeles.', 'success'))
      .catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = msg;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        Toast.show('📋 Mensaje copiado.', 'success');
      });
  }
};

// ─── REPORTES ANÓNIMOS ────────────────────────

const Reportes = {
  MAX_CHARS: 500,

  init() {
    // Tipo de problema
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        APP.activeType = btn.dataset.type;
      });
    });

    // Contador de caracteres
    const textarea = document.getElementById('reportDesc');
    const counter = document.getElementById('charCount');
    textarea?.addEventListener('input', () => {
      const len = textarea.value.length;
      if (counter) {
        counter.textContent = `${len} / ${this.MAX_CHARS}`;
        counter.className = 'char-count' + (len > this.MAX_CHARS * 0.9 ? (len >= this.MAX_CHARS ? ' limit' : ' warn') : '');
      }
    });

    // Enviar reporte
    document.getElementById('submitReportBtn')?.addEventListener('click', () => this.submit());

    // Limpiar historial
    document.getElementById('clearReportsBtn')?.addEventListener('click', () => this.clearAll());

    this.render();
  },

  submit() {
    const name = document.getElementById('reportName')?.value.trim();
    const desc = document.getElementById('reportDesc')?.value.trim();
    const type = APP.activeType;

    // Validaciones
    let valid = true;

    if (!type) {
      Toast.show('Selecciona el tipo de problema.', 'warning');
      valid = false;
    }

    if (!desc) {
      const errEl = document.getElementById('descError');
      if (errEl) errEl.classList.add('show');
      valid = false;
    } else {
      const errEl = document.getElementById('descError');
      errEl?.classList.remove('show');
    }

    if (desc && desc.length > this.MAX_CHARS) {
      Toast.show(`Descripción muy larga. Máximo ${this.MAX_CHARS} caracteres.`, 'error');
      valid = false;
    }

    if (!valid) return;

    const report = {
      id: genId(),
      name: name || 'Anónimo',
      type,
      desc,
      ts: Date.now()
    };

    const reports = Storage.get('ss-reports', []);
    reports.unshift(report);
    Storage.set('ss-reports', reports);

    // Limpiar form
    document.getElementById('reportName').value = '';
    document.getElementById('reportDesc').value = '';
    document.getElementById('charCount').textContent = `0 / ${this.MAX_CHARS}`;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
    APP.activeType = null;

    Toast.show('✅ Reporte enviado correctamente. Gracias por informar.', 'success', 4000);
    this.render();
  },

  delete(id) {
    const reports = Storage.get('ss-reports', []).filter(r => r.id !== id);
    Storage.set('ss-reports', reports);
    Toast.show('Reporte eliminado.', 'info');
    this.render();
  },

  clearAll() {
    if (!confirm('¿Eliminar todos los reportes? Esta acción no se puede deshacer.')) return;
    Storage.remove('ss-reports');
    Toast.show('Historial limpiado.', 'info');
    this.render();
  },

  render() {
    const container = document.getElementById('reportsList');
    if (!container) return;

    const reports = Storage.get('ss-reports', []);

    if (reports.length === 0) {
      container.innerHTML = `
        <div class="reports-empty">
          <div class="reports-empty-icon">📋</div>
          <p style="font-size:0.9rem">No hay reportes aún.<br><span style="color:var(--text-muted);font-size:0.8rem">Los reportes se guardan localmente en tu dispositivo.</span></p>
        </div>`;
      return;
    }

    const typeConfig = {
      bullying: { label: 'Bullying', color: 'orange', emoji: '😔' },
      violencia: { label: 'Violencia', color: 'red', emoji: '⚠️' },
      acoso: { label: 'Acoso', color: 'orange', emoji: '🚫' },
      amenazas: { label: 'Amenazas', color: 'red', emoji: '❗' }
    };

    container.innerHTML = reports.map(r => {
      const cfg = typeConfig[r.type] || { label: r.type, color: 'blue', emoji: '📌' };
      return `
        <div class="glass-card report-item" id="report-${r.id}">
          <div class="report-item-header">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span class="badge badge-${cfg.color}">${cfg.emoji} ${cfg.label}</span>
              <span class="report-item-title" style="font-size:0.8rem;color:var(--text-muted)">— ${escHtml(r.name)}</span>
            </div>
            <button class="btn btn-icon" onclick="Reportes.delete('${r.id}')" title="Eliminar reporte" style="width:32px;height:32px;font-size:0.8rem;">🗑️</button>
          </div>
          <p class="report-item-desc">${escHtml(r.desc)}</p>
          <div class="report-item-date">📅 ${formatDate(r.ts)}</div>
        </div>`;
    }).join('');
  }
};

// ─── RECORDATORIOS MÉDICOS ────────────────────

const Recordatorios = {
  notifTimer: null,

  init() {
    document.getElementById('addMedBtn')?.addEventListener('click', () => this.openModal());
    document.getElementById('saveMedBtn')?.addEventListener('click', () => this.save());
    document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
    document.getElementById('medModalOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'medModalOverlay') this.closeModal();
    });
    document.getElementById('requestNotifBtn')?.addEventListener('click', () => this.requestNotifications());

    this.render();
    this.scheduleNotifications();
  },

  openModal(id = null) {
    APP.editingMedId = id;
    const modal = document.getElementById('medModalOverlay');
    const title = document.getElementById('modalTitle');

    if (id) {
      const meds = Storage.get('ss-meds', []);
      const med = meds.find(m => m.id === id);
      if (med) {
        document.getElementById('medName').value = med.name;
        document.getElementById('medTime').value = med.time;
        document.getElementById('medDesc').value = med.desc || '';
        document.getElementById('medIcon').value = med.icon || '💊';
        if (title) title.textContent = '✏️ Editar Recordatorio';
      }
    } else {
      document.getElementById('medForm')?.reset();
      if (title) title.textContent = '➕ Nuevo Recordatorio';
    }

    if (modal) modal.classList.add('open');
  },

  closeModal() {
    const modal = document.getElementById('medModalOverlay');
    if (modal) modal.classList.remove('open');
    APP.editingMedId = null;
  },

  save() {
    const name = document.getElementById('medName')?.value.trim();
    const time = document.getElementById('medTime')?.value;
    const desc = document.getElementById('medDesc')?.value.trim();
    const icon = document.getElementById('medIcon')?.value || '💊';

    // Validar
    let valid = true;
    if (!name) {
      document.getElementById('medNameError')?.classList.add('show');
      valid = false;
    } else {
      document.getElementById('medNameError')?.classList.remove('show');
    }
    if (!time) {
      document.getElementById('medTimeError')?.classList.add('show');
      valid = false;
    } else {
      document.getElementById('medTimeError')?.classList.remove('show');
    }
    if (!valid) return;

    const meds = Storage.get('ss-meds', []);

    if (APP.editingMedId) {
      const idx = meds.findIndex(m => m.id === APP.editingMedId);
      if (idx !== -1) {
        meds[idx] = { ...meds[idx], name, time, desc, icon };
        Toast.show('✏️ Recordatorio actualizado.', 'success');
      }
    } else {
      meds.push({ id: genId(), name, time, desc, icon, createdAt: Date.now() });
      Toast.show('✅ Recordatorio guardado.', 'success');
    }

    Storage.set('ss-meds', meds);
    this.closeModal();
    this.render();
    this.scheduleNotifications();
  },

  delete(id) {
    const meds = Storage.get('ss-meds', []).filter(m => m.id !== id);
    Storage.set('ss-meds', meds);
    Toast.show('Recordatorio eliminado.', 'info');
    this.render();
    this.scheduleNotifications();
  },

  render() {
    const container = document.getElementById('medsGrid');
    if (!container) return;

    const meds = Storage.get('ss-meds', []);

    if (meds.length === 0) {
      container.innerHTML = `
        <div class="reports-empty" style="grid-column:1/-1">
          <div class="reports-empty-icon">💊</div>
          <p style="font-size:0.9rem">No hay recordatorios aún.<br><span style="color:var(--text-muted);font-size:0.8rem">Agrega tus medicamentos para recibir alertas.</span></p>
        </div>`;
      return;
    }

    // Ordenar por hora
    const sorted = [...meds].sort((a, b) => a.time.localeCompare(b.time));

    container.innerHTML = sorted.map(m => {
      const nextDose = this.getNextDose(m.time);
      return `
        <div class="glass-card med-card" id="med-${m.id}">
          <div class="med-card-icon">${escHtml(m.icon || '💊')}</div>
          <div class="med-name">${escHtml(m.name)}</div>
          <div class="med-time">⏰ ${escHtml(m.time)}</div>
          ${m.desc ? `<p class="med-desc">${escHtml(m.desc)}</p>` : ''}
          <div class="med-next">🔔 ${nextDose}</div>
          <div class="med-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="Recordatorios.openModal('${m.id}')">✏️ Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="Recordatorios.delete('${m.id}')" style="color:var(--red-400)">🗑️</button>
          </div>
        </div>`;
    }).join('');
  },

  getNextDose(timeStr) {
    const now = new Date();
    const [h, min] = timeStr.split(':').map(Number);
    const next = new Date();
    next.setHours(h, min, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const diffMs = next - now;
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor((diffMs % 3600000) / 60000);
    if (diffH === 0) return `En ${diffM} min`;
    if (diffH < 24) return `En ${diffH}h ${diffM}min`;
    return 'Mañana a las ' + timeStr;
  },

  scheduleNotifications() {
    clearTimeout(this.notifTimer);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const meds = Storage.get('ss-meds', []);
    meds.forEach(m => {
      const [h, min] = m.time.split(':').map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(h, min, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const delay = target - now;

      setTimeout(() => {
        this.showNotification(m);
      }, delay);
    });
  },

  showNotification(med) {
    if (Notification.permission !== 'granted') return;
    const n = new Notification('💊 SAFE STUDENT — Recordatorio', {
      body: `Es hora de tomar: ${med.name}${med.desc ? '\n' + med.desc : ''}`,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-72.png',
      vibrate: [200, 100, 200],
      tag: `med-${med.id}`
    });
    n.onclick = () => {
      window.focus();
      Nav.goto('recordatorios');
    };
    Toast.show(`💊 Hora de tomar: ${med.name}`, 'warning', 6000);
  },

  async requestNotifications() {
    if (!('Notification' in window)) {
      Toast.show('Tu navegador no soporta notificaciones.', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      APP.notificationPermission = true;
      document.getElementById('notifBanner')?.classList.add('hidden');
      this.scheduleNotifications();
      Toast.show('🔔 Notificaciones activadas.', 'success');
    } else {
      Toast.show('Permiso denegado para notificaciones.', 'warning');
    }
  }
};

// ─── PWA — SERVICE WORKER ─────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('[App] SW registrado:', reg.scope))
        .catch(err => console.warn('[App] SW error:', err));
    });
  }
}

// ─── PWA — INSTALL PROMPT ─────────────────────

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    APP.deferredInstallPrompt = e;
    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.add('show');
  });

  document.getElementById('installBtn')?.addEventListener('click', () => {
    if (!APP.deferredInstallPrompt) return;
    APP.deferredInstallPrompt.prompt();
    APP.deferredInstallPrompt.userChoice.then(result => {
      if (result.outcome === 'accepted') Toast.show('🎉 App instalada correctamente.', 'success');
      APP.deferredInstallPrompt = null;
      document.getElementById('installBanner')?.classList.remove('show');
    });
  });

  document.getElementById('installDismiss')?.addEventListener('click', () => {
    document.getElementById('installBanner')?.classList.remove('show');
  });

  window.addEventListener('appinstalled', () => {
    Toast.show('✅ SAFE STUDENT instalada en tu dispositivo.', 'success', 5000);
    document.getElementById('installBanner')?.classList.remove('show');
  });
}

// ─── NOTIF BANNER ─────────────────────────────

function checkNotifPermission() {
  if (!('Notification' in window)) return;
  const banner = document.getElementById('notifBanner');
  if (Notification.permission === 'granted') {
    APP.notificationPermission = true;
    if (banner) banner.classList.add('hidden');
  } else if (Notification.permission === 'denied') {
    if (banner) banner.classList.add('hidden');
  }
  // Si es 'default', mostrar el banner
}

// ─── LOADING SCREEN ───────────────────────────

function hideLoadingScreen() {
  const screen = document.getElementById('loadingScreen');
  if (!screen) return;
  setTimeout(() => {
    screen.classList.add('hidden');
    setTimeout(() => screen.remove(), 500);
  }, 1800);
}

// ─── INICIALIZACIÓN PRINCIPAL ─────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Core
  Toast.init();
  ThemeManager.init();
  initNavbarScroll();
  MobileMenu.init();
  Nav.init();

  // Módulos
  SOS.init();
  Reportes.init();
  Recordatorios.init();

  // PWA
  registerServiceWorker();
  initInstallPrompt();
  checkNotifPermission();

  // Loading screen
  hideLoadingScreen();

  // Verificar notificaciones al llegar a recordatorios
  document.querySelectorAll('[data-section="recordatorios"]').forEach(el => {
    el.addEventListener('click', () => {
      if (!APP.notificationPermission && 'Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
          document.getElementById('notifBanner')?.classList.remove('hidden');
        }, 500);
      }
    });
  });

  console.log('%c🛡️ SAFE STUDENT v1.0', 'font-size:16px;font-weight:bold;color:#3b82f6;');
  console.log('%cProtegiendo estudiantes mediante tecnología.', 'color:#94a3b8;');
});
