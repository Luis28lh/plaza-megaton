// Controlador Global y Utilidades de Frontend - Plaza Megatón
// Compatible con Servidor Local Node.js y Plataforma Web

const App = {
  // Manejo de sesión local persistente y tolerante a fallos / actualizaciones
  getSession() {
    try {
      let token = localStorage.getItem('megaton_token');
      let userRaw = localStorage.getItem('megaton_user');

      // Si localStorage está vacío o fue limpiado durante actualización, recuperar de respaldo
      if (!token || !userRaw) {
        // Respaldo 1: sessionStorage
        token = sessionStorage.getItem('megaton_token');
        userRaw = sessionStorage.getItem('megaton_user');

        // Respaldo 2: Cookie persistente (1 año)
        if (!token || !userRaw) {
          const cookieMatchToken = document.cookie.match(/(?:^|;\s*)megaton_token=([^;]+)/);
          const cookieMatchUser = document.cookie.match(/(?:^|;\s*)megaton_user=([^;]+)/);
          if (cookieMatchToken && cookieMatchUser) {
            token = decodeURIComponent(cookieMatchToken[1]);
            userRaw = decodeURIComponent(cookieMatchUser[1]);
          }
        }

        // Si se recuperó de respaldo, restaurar en localStorage
        if (token && userRaw) {
          try {
            localStorage.setItem('megaton_token', token);
            localStorage.setItem('megaton_user', userRaw);
          } catch (_) {}
        }
      }

      if (!token || !userRaw) return null;
      return { token, user: JSON.parse(userRaw) };
    } catch (_) {
      return null;
    }
  },

  setSession(user, token) {
    if (!user && !token) return;
    try {
      const userStr = typeof user === 'object' ? JSON.stringify(user) : user;

      if (token) {
        localStorage.setItem('megaton_token', token);
        sessionStorage.setItem('megaton_token', token);
        document.cookie = `megaton_token=${encodeURIComponent(token)}; path=/; max-age=31536000; SameSite=Lax`;
      }
      if (userStr) {
        localStorage.setItem('megaton_user', userStr);
        sessionStorage.setItem('megaton_user', userStr);
        document.cookie = `megaton_user=${encodeURIComponent(userStr)}; path=/; max-age=31536000; SameSite=Lax`;
      }
      localStorage.setItem('megaton_logged_in', '1');
    } catch (e) {
      console.warn('[App] Error guardando sesión persistente:', e);
    }
    this.updateUserHeader();
    this.renderOccupantHomeBanner();
  },

  clearSession() {
    try {
      localStorage.removeItem('megaton_token');
      localStorage.removeItem('megaton_user');
      localStorage.removeItem('megaton_logged_in');
      sessionStorage.removeItem('megaton_token');
      sessionStorage.removeItem('megaton_user');
      document.cookie = 'megaton_token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'megaton_user=; path=/; max-age=0; SameSite=Lax';
    } catch (_) {}
    window.location.href = 'index.html';
  },

  // Notificaciones Toast flotantes
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  },

  // Compresión automática de imágenes en el cliente (Canvas)
  // Convierte fotos pesadas de celulares (4MB-10MB) en JPEG optimizados de ~300KB
  async compressImage(file, maxDimension = 1600, quality = 0.8) {
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          }, 'image/jpeg', quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Formato de moneda dominicana
  formatCurrency(value) {
    if (!value) return 'RD$ 0.00';
    const num = parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(num).replace('DOP', 'RD$');
  },

  // Actualiza el indicador del usuario en la barra superior blanca
  updateUserHeader() {
    const pill = document.getElementById('user-header-pill');
    if (!pill) return;

    const session = this.getSession();
    if (session && session.user) {
      let displayName = session.user.nombre || 'Luis Miguel';
      if (displayName.toLowerCase().includes('luis miguel')) {
        displayName = 'Luis Miguel';
      } else {
        const parts = displayName.replace(/^(Ing\.|Lic\.|Dr\.|Sr\.|Sra\.)\s*/i, '').trim().split(' ');
        displayName = parts.slice(0, 2).join(' ') || displayName;
      }
      pill.style.background = '#FFFFFF';
      pill.style.border = '1.5px solid #22C55E';
      pill.style.color = '#0F172A';
      pill.style.padding = '5px 12px';
      pill.style.borderRadius = '9999px';
      pill.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      pill.style.display = 'inline-flex';
      pill.style.alignItems = 'center';
      pill.style.cursor = 'pointer';
      pill.innerHTML = `👤 <strong style="color:#0F172A; margin: 0 4px;">${displayName}</strong> <span style="background:#DCFCE7; color:#15803D; font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; margin-right:4px;">● Activo</span> <span style="font-size:11px; color:#64748B; text-decoration:underline;">(Cerrar)</span>`;
      pill.title = `Sesión activa de ${session.user.nombre || displayName}. Clic para cerrar sesión.`;
      pill.onclick = (e) => {
        e.preventDefault();
        if (confirm(`¿Deseas cerrar la sesión activa de ${session.user.nombre || displayName}?`)) {
          this.clearSession();
        }
      };
    } else {
      pill.style.background = '';
      pill.style.border = '';
      pill.style.color = '';
      pill.style.padding = '';
      pill.style.borderRadius = '';
      pill.style.boxShadow = '';
      pill.style.display = '';
      pill.style.alignItems = '';
      pill.style.cursor = 'pointer';
      pill.innerHTML = `🔑 Acceder`;
      pill.onclick = () => {
        window.location.href = 'login.html';
      };
    }
  },

  // Eliminada la consola o tarjeta redundante para dejar exclusivamente
  // la interfaz limpia con las 7 tarjetas y la sesión activa en el encabezado
  renderOccupantHomeBanner() {
    const container = document.getElementById('occupant-home-card');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
      container.remove();
    }
  },

  // Inicialización de componentes comunes
  init() {
    this.updateUserHeader();
    this.renderOccupantHomeBanner();

    // Resaltar navegación activa
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (currentPath.includes(href) || (currentPath.endsWith('/') && href.includes('index')))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Inicializar almacenamiento local autónomo si corre en Entorno Estático
    if (this.isStaticHost()) {
      this.initLocalStore();
    }

    // Comprobar mensajes e insignias
    if (typeof checkUnreadMessagesBadge === 'function') {
      checkUnreadMessagesBadge();
    }

    // Cuantificar cargas y accesos (móviles y web)
    this.trackAppLoad();
  },

  // Telemetría y cuantificación de cargas / accesos en teléfonos y web
  trackAppLoad() {
    try {
      const lastTrack = sessionStorage.getItem('pm_last_track');
      if (lastTrack && (Date.now() - parseInt(lastTrack, 10) < 5000)) {
        return;
      }
      sessionStorage.setItem('pm_last_track', String(Date.now()));

      let deviceId = localStorage.getItem('pm_device_id');
      if (!deviceId) {
        deviceId = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        localStorage.setItem('pm_device_id', deviceId);
      }

      const isStandalonePWA = Boolean(
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://')
      );

      const ua = navigator.userAgent || '';
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isAndroid = /Android/i.test(ua);

      let tipoDispositivo = 'Escritorio / Navegador';
      if (isStandalonePWA) {
        tipoDispositivo = isIOS ? '📱 iPhone (App PWA Instalada)' : (isAndroid ? '📱 Android (App PWA Instalada)' : '📱 PWA Móvil Instalada');
      } else if (isMobile) {
        tipoDispositivo = isIOS ? '📱 iPhone / Safari Móvil' : (isAndroid ? '📱 Android / Chrome Móvil' : '📱 Smartphone Móvil');
      }

      const session = this.getSession();
      const payload = {
        deviceId,
        isMobile,
        isPWA: isStandalonePWA,
        tipoDispositivo,
        pantalla: window.location.pathname.split('/').pop() || 'index.html',
        usuario: session && session.user ? `${session.user.nombre} (${session.user.email})` : 'Visitante / Inquilino Móvil',
        cubiculo: session && session.user && session.user.cubiculos ? (Array.isArray(session.user.cubiculos) ? session.user.cubiculos.map(c => c.codigo || c).join(', ') : session.user.cubiculos) : 'N/A'
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetria/carga', JSON.stringify(payload));
      } else {
        fetch('/api/telemetria/carga', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (_) {}
  },

  // Detecta si corre en entorno local estático sin backend Node
  isStaticHost() {
    return window.location.protocol === 'file:';
  },

  // Almacenamiento local persistente para funcionamiento en Entorno Estático (offline/remoto)
  initLocalStore() {
    const OFFICIAL_CUBS = [
      { codigo: "A-101", nivel: "Primer Nivel", area_m2: 64.75, precio_m2: 100.00, cuota: 6475.00, nombre: "Yesenia Grullón", propietario: "YESENIA GRULLON", estado: "Ocupado" },
      { codigo: "A-102", nivel: "Primer Nivel", area_m2: 54.95, precio_m2: 100.00, cuota: 5495.00, nombre: "Alba María García Rodríguez", propietario: "ALBA MARIA GARCIA RODRIGUEZ", rnc: "131516238", estado: "Ocupado" },
      { codigo: "A-103", nivel: "Primer Nivel", area_m2: 170.24, precio_m2: 60.00, cuota: 10214.40, nombre: "Consultorio Dra. Melissa", propietario: "DR. MELISSA", estado: "Ocupado" },
      { codigo: "A-104", nivel: "Primer Nivel", area_m2: 78.26, precio_m2: 100.00, cuota: 7826.00, nombre: "Warn Electrical Services SRL", propietario: "WARN ELECTRICAL SERVICES SRL", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-105", nivel: "Primer Nivel", area_m2: 223.45, precio_m2: 35.00, cuota: 7820.75, nombre: "Armería La Mocana SRL - Pablo Abreu", propietario: "ARMERIA LA MOCANA SRL - PABLO ABREU", rnc: "130060398", estado: "Ocupado" },
      { codigo: "A-105-A", nivel: "Primer Nivel", area_m2: 293.55, precio_m2: 35.00, cuota: 10274.25, nombre: "Bingo", propietario: "EDWAR GRULLON", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-201", nivel: "Segundo Nivel", area_m2: 115.20, precio_m2: 60.00, cuota: 6912.00, nombre: "INABIE", propietario: "INABIE", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-202", nivel: "Segundo Nivel", area_m2: 32.88, precio_m2: 100.00, cuota: 3288.00, nombre: "Luis María García", propietario: "LUIS MARIA GARCIA", estado: "Ocupado" },
      { codigo: "A-203", nivel: "Segundo Nivel", area_m2: 34.18, precio_m2: 100.00, cuota: 3418.00, nombre: "Jet Pack", propietario: "MANUEL SANTOS", estado: "Ocupado" },
      { codigo: "A-204", nivel: "Segundo Nivel", area_m2: 30.83, precio_m2: 100.00, cuota: 3083.00, nombre: "Manuel Santos", propietario: "MANUEL SANTOS", estado: "Ocupado" },
      { codigo: "A-205", nivel: "Segundo Nivel", area_m2: 13.55, precio_m2: 100.00, cuota: 1355.00, nombre: "Centro de Uña", propietario: "ELDA BENCOSME", estado: "Ocupado" },
      { codigo: "A-206", nivel: "Segundo Nivel", area_m2: 66.69, precio_m2: 31.00, cuota: 2067.39, nombre: "Alba Rodríguez & Asociados, SRL", propietario: "ALBA RODRIGUEZ & ASOCIADOS, SRL", rnc: "131262589", estado: "Ocupado" },
      { codigo: "A-207", nivel: "Segundo Nivel", area_m2: 65.14, precio_m2: 31.00, cuota: 2019.34, nombre: "Alba Rodríguez & Asociados, SRL", propietario: "ALBA RODRIGUEZ & ASOCIADOS, SRL", rnc: "131262589", estado: "Ocupado" },
      { codigo: "A-208", nivel: "Segundo Nivel", area_m2: 80.05, precio_m2: 100.00, cuota: 8005.00, nombre: "Nicolás Grullón", propietario: "NICOLAS GRULLON", estado: "Ocupado" },
      { codigo: "A-209", nivel: "Segundo Nivel", area_m2: 79.99, precio_m2: 60.00, cuota: 4799.40, nombre: "Ahsdiel Music Bar SRL", propietario: "AHSDIEL MUSIC BAR SRL", rnc: "132080211", estado: "Ocupado" },
      { codigo: "A-210", nivel: "Segundo Nivel", area_m2: 84.42, precio_m2: 60.00, cuota: 5065.20, nombre: "Ahsdiel Music Bar SRL", propietario: "AHSDIEL MUSIC BAR SRL", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-301-A", nivel: "Tercer Nivel", area_m2: 34.37, precio_m2: 100.00, cuota: 3437.00, nombre: "Vipsania Grullón", propietario: "VIPSANIA GRULLON", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-301-B", nivel: "Tercer Nivel", area_m2: 15.32, precio_m2: 100.00, cuota: 1532.00, nombre: "Vipsania Grullón", propietario: "VIPSANIA GRULLON", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-301-C", nivel: "Tercer Nivel", area_m2: 11.05, precio_m2: 100.00, cuota: 1105.00, nombre: "Vipsania Grullón", propietario: "VIPSANIA GRULLON", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-301-D", nivel: "Tercer Nivel", area_m2: 9.69, precio_m2: 100.00, cuota: 969.00, nombre: "Vipsania Grullón", propietario: "VIPSANIA GRULLON", rnc: "130161267", estado: "Ocupado" },
      { codigo: "A-302", nivel: "Tercer Nivel", area_m2: 43.53, precio_m2: 31.00, cuota: 1349.43, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" },
      { codigo: "A-303", nivel: "Tercer Nivel", area_m2: 43.92, precio_m2: 31.00, cuota: 1361.52, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" },
      { codigo: "A-304", nivel: "Tercer Nivel", area_m2: 34.90, precio_m2: 31.00, cuota: 1081.90, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" },
      { codigo: "A-305", nivel: "Tercer Nivel", area_m2: 39.26, precio_m2: 31.00, cuota: 1217.06, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" },
      { codigo: "A-306", nivel: "Tercer Nivel", area_m2: 33.93, precio_m2: 31.00, cuota: 1051.83, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" },
      { codigo: "A-307", nivel: "Tercer Nivel", area_m2: 202.43, precio_m2: 31.00, cuota: 6275.33, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" },
      { codigo: "A-307-ANT", nivel: "Tercer Nivel", area_m2: 335.77, precio_m2: 31.00, cuota: 10408.87, nombre: "Esward-Sotea, Antena", propietario: "EDWARD GRULLON", rnc: "131712541", estado: "Ocupado" },
      { codigo: "A-307-COF", nivel: "Tercer Nivel", area_m2: 22.62, precio_m2: 180.00, cuota: 4071.60, nombre: "Mega Coffy", propietario: "NICOLAS GRULLON", rnc: "132080211", estado: "Ocupado" },
      { codigo: "A-308", nivel: "Tercer Nivel", area_m2: 62.23, precio_m2: 60.00, cuota: 3733.80, nombre: "Bertha Soury", propietario: "BERTHA SOURY", estado: "Ocupado" },
      { codigo: "A-309", nivel: "Tercer Nivel", area_m2: 79.34, precio_m2: 60.00, cuota: 4760.40, nombre: "Bertha Soury", propietario: "BERTHA SOURY", estado: "Ocupado" },
      { codigo: "A-310", nivel: "Tercer Nivel", area_m2: 1002.06, precio_m2: 31.00, cuota: 31063.86, nombre: "B&B Operadora de Filmes & Gym SRL", propietario: "B&B OPERADORA DE FILMES & GYM SRL", rnc: "131528759", estado: "Ocupado" },
      { codigo: "A-311", nivel: "Tercer Nivel", area_m2: 47.57, precio_m2: 100.00, cuota: 4757.00, nombre: "Elda Bencosme", propietario: "ELDA BENCOSME", estado: "Ocupado" },
      { codigo: "A-312", nivel: "Tercer Nivel", area_m2: 423.35, precio_m2: 31.00, cuota: 5000.00, nombre: "Grupo de Desarrollo Internacional", propietario: "GRUPO DE DESARROLLO INTERNACIONAL", rnc: "106014788", estado: "Ocupado" }
    ];

    if (!localStorage.getItem('pm_cubiculos') || JSON.parse(localStorage.getItem('pm_cubiculos') || '[]')[0]?.codigo?.startsWith('C-')) {
      localStorage.setItem('pm_cubiculos', JSON.stringify(OFFICIAL_CUBS));
    }
    if (!localStorage.getItem('pm_usuarios')) localStorage.setItem('pm_usuarios', '[]');
    if (!localStorage.getItem('pm_reclamaciones')) localStorage.setItem('pm_reclamaciones', '[]');
    if (!localStorage.getItem('pm_pagos')) localStorage.setItem('pm_pagos', '[]');
    if (!localStorage.getItem('pm_historial')) {
      localStorage.setItem('pm_historial', JSON.stringify([{
        id: 'H-001',
        tipo_documento: 'SISTEMA',
        codigo_documento: 'INIT',
        fecha: new Date().toLocaleDateString('es-DO'),
        hora: '12:00 PM',
        usuario: 'Sistema',
        accion: 'Catálogo inicializado',
        estado_anterior: '',
        estado_nuevo: 'ACTIVO',
        observacion: '30 cubículos disponibles en Plaza Megatón'
      }]));
    }
    if (!localStorage.getItem('pm_counters')) {
      localStorage.setItem('pm_counters', JSON.stringify({ US: 18, CL: 7, PG: 0 }));
    }
  },

  // Generador de secuencias en entorno autónomo
  getNextSequence(prefix) {
    const counters = JSON.parse(localStorage.getItem('pm_counters') || '{"US":18,"CL":7,"PG":0}');
    let max = counters[prefix] || (prefix === 'CL' ? 7 : (prefix === 'US' ? 18 : 0));

    if (prefix === 'CL') {
      try {
        const recs = JSON.parse(localStorage.getItem('pm_reclamaciones') || '[]');
        recs.forEach(r => {
          const m = String(r.codigo || '').match(/CL-(\d+)/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > max) max = n;
          }
        });
      } catch (_) {}
    } else if (prefix === 'PG') {
      try {
        const pags = JSON.parse(localStorage.getItem('pm_pagos') || '[]');
        pags.forEach(p => {
          const m = String(p.codigo || '').match(/PG-(\d+)/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > max) max = n;
          }
        });
      } catch (_) {}
    }

    const next = max + 1;
    counters[prefix] = next;
    localStorage.setItem('pm_counters', JSON.stringify(counters));
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

// ==========================================
// CONTROLADOR PWA & INSTALACIÓN MÓVIL
// ==========================================
window.deferredPWAInstallPrompt = null;

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      try { reg.update(); } catch (_) {}
      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nueva versión detectada, actualizando aplicación...');
              window.location.reload();
            }
          });
        }
      });
    }).catch(err => {
      console.warn('[PWA] Registro de Service Worker omitido:', err);
    });
  });
}

// Capturar el evento de instalación nativa en Android y Navegadores compatibles
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAInstallPrompt = e;
  const installBanner = document.getElementById('pwa-install-banner');
  const installCard = document.getElementById('pwa-install-card');
  const installBtn = document.getElementById('btn-pwa-install');
  if (installBanner) installBanner.style.display = 'flex';
  if (installCard) installCard.style.display = 'flex';
  if (installBtn) installBtn.style.display = 'inline-flex';
});

// Evento cuando la app ya fue instalada
window.addEventListener('appinstalled', () => {
  window.deferredPWAInstallPrompt = null;
  const installBanner = document.getElementById('pwa-install-banner');
  const installCard = document.getElementById('pwa-install-card');
  if (installBanner) installBanner.style.display = 'none';
  if (installCard) installCard.style.display = 'none';
  App.showToast('¡Plaza Megatón instalada con éxito en su teléfono!', 'success');
});

// Función global para disparar la instalación o mostrar guía para iPhone
window.triggerPWAInstall = async function() {
  // 1. Si tenemos el prompt nativo (Chrome / Android / Edge / Opera)
  if (window.deferredPWAInstallPrompt) {
    try {
      window.deferredPWAInstallPrompt.prompt();
      const choiceResult = await window.deferredPWAInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        App.showToast('Instalando Plaza Megatón en su dispositivo...', 'info');
      }
      window.deferredPWAInstallPrompt = null;
      return;
    } catch (err) {
      console.warn('Error al activar prompt de instalación:', err);
    }
  }

  // 2. Detección de iOS (iPhone / iPad / Safari)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isIOS) {
    if (isStandalone) {
      App.showToast('Ya estás usando Plaza Megatón como aplicación instalada.', 'success');
      return;
    }
    showIOSInstallModal();
    return;
  }

  // 3. Si ya está instalada o es navegador de escritorio
  if (isStandalone) {
    App.showToast('Plaza Megatón ya se encuentra instalada en este dispositivo.', 'info');
  } else {
    showGenericInstallModal();
  }
};

function showIOSInstallModal() {
  let modal = document.getElementById('ios-pwa-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ios-pwa-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.65); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
    modal.innerHTML = `
      <div style="background:#FFFFFF; border-radius:20px; max-width:400px; width:100%; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); position:relative; text-align:center;">
        <button onclick="document.getElementById('ios-pwa-modal').style.display='none'" style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:22px; cursor:pointer; color:#64748B;">✕</button>
        <img src="assets/icon-192.png" alt="Logo" style="width:68px; height:68px; border-radius:16px; margin-bottom:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.15);">
        <h3 style="font-size:18px; font-weight:800; color:#0F172A; margin:0 0 6px;">Instalar en tu iPhone o iPad</h3>
        <p style="font-size:13px; color:#475569; margin:0 0 16px; line-height:1.4;">Agrega Plaza Megatón a tu pantalla de inicio para usarla a pantalla completa y recibir avisos.</p>
        
        <div style="text-align:left; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:14px; padding:14px; font-size:13px; color:#1E293B; line-height:1.6; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <span style="font-size:22px;">1️⃣</span>
            <span>Toca el botón <strong>Compartir</strong> <strong style="font-size:16px;">📤</strong> en la barra inferior de Safari.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <span style="font-size:22px;">2️⃣</span>
            <span>Desliza hacia arriba y selecciona <strong>"Agregar a inicio"</strong> ➕.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">3️⃣</span>
            <span>Toca <strong>"Agregar"</strong> en la esquina superior derecha.</span>
          </div>
        </div>

        <button onclick="document.getElementById('ios-pwa-modal').style.display='none'" class="btn-primary" style="width:100%; min-height:44px; font-weight:700;">¡Listo, Entendido!</button>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
  }
}

function showGenericInstallModal() {
  App.showToast('Para instalar: abre el menú de tu navegador (⋮ o Compartir) y elige "Instalar aplicación" o "Agregar a pantalla principal".', 'info');
}

// ==========================================
// INSIGNIAS EN EL ICONO (APP BADGING API)
// ==========================================
window.updateAppBadge = function(count) {
  const numericCount = parseInt(count, 10) || 0;
  
  // 1. App Badging API en la app instalada
  if ('setAppBadge' in navigator) {
    if (numericCount > 0) {
      navigator.setAppBadge(numericCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  // 2. Notificar al Service Worker
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: numericCount > 0 ? 'SET_BADGE' : 'CLEAR_BADGE',
      count: numericCount
    });
  }

  // 3. Actualizar insignia visual en la barra inferior móvil
  updateNavBadgeCount(numericCount);
};

function updateNavBadgeCount(count) {
  const navItems = document.querySelectorAll('.bottom-nav a[href*="mensajes"]');
  navItems.forEach(item => {
    let badge = item.querySelector('.nav-badge-pill');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge-pill';
        badge.style.cssText = 'position:absolute; top:2px; right:20%; background:#DC2626; color:#FFF; font-size:10px; font-weight:900; border-radius:999px; padding:1px 5px; min-width:16px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.3);';
        item.style.position = 'relative';
        item.appendChild(badge);
      }
      badge.innerText = count > 9 ? '9+' : count;
      badge.style.display = 'inline-block';
    } else if (badge) {
      badge.style.display = 'none';
    }
  });
}

// Consultar automáticamente mensajes no leídos al cargar
async function checkUnreadMessagesBadge() {
  try {
    const session = App.getSession();
    const storedEmail = session ? session.user.email : (localStorage.getItem('pm_user_email') || '');
    if (!storedEmail) return;

    const res = await fetch(`/api/mensajes?email=${encodeURIComponent(storedEmail)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.mensajes)) {
        const unread = data.mensajes.filter(m => !m.leido).length;
        window.updateAppBadge(unread);
      }
    }
  } catch (_) {}
}
