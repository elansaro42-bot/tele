const form = document.getElementById('schedule-form');
const list = document.getElementById('schedule-list');
const playerArea = document.getElementById('player-area');
const channelStatus = document.getElementById('channel-status');
const currentTimeDisplay = document.getElementById('current-time');
const liveBadge = document.getElementById('live-badge');
const fileInput = document.getElementById('video-file');
const adminLoginPanel = document.getElementById('admin-login-panel');
const adminPanel = document.getElementById('admin-panel');
const adminWelcomeText = document.getElementById('admin-welcome-text');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const toggleScheduleButton = document.getElementById('toggle-schedule-content');
const scheduleContent = document.getElementById('schedule-content');
const STORAGE_KEY = 'videoScheduleItems';
const ADMIN_KEY = 'tvAdminAccess';
const ADMIN_PASSWORD = 'german';
const fileSources = new Map();
let isAdmin = false;
let currentActiveId = null;

initializeAdmin();
if (toggleScheduleButton && scheduleContent) {
  toggleScheduleButton.addEventListener('click', () => {
    scheduleContent.classList.toggle('hidden');
    const icon = toggleScheduleButton.querySelector('.accordion-icon');
    if (icon) {
      icon.textContent = scheduleContent.classList.contains('hidden') ? '▼' : '▲';
    }
  });
}
let scheduleItems = loadSchedule();
renderSchedule();
updateActiveTransmission();
updateCurrentTime();
setInterval(updateActiveTransmission, 1000);
setInterval(updateCurrentTime, 1000);

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'f') {
    return;
  }
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) {
    return;
  }
  event.preventDefault();
  toggleFullscreen();
});

playerArea.addEventListener('dblclick', () => {
  toggleFullscreen();
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (playerArea.requestFullscreen) {
      playerArea.requestFullscreen();
    } else if (playerArea.webkitRequestFullscreen) {
      playerArea.webkitRequestFullscreen();
    } else if (playerArea.msRequestFullscreen) {
      playerArea.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function adjustVolume(increment) {
  const videoElement = playerArea.querySelector('video');
  if (!videoElement) {
    return;
  }
  
  videoElement.volume = Math.max(0, Math.min(1, videoElement.volume + increment));
}

adminLoginBtn.addEventListener('click', () => {
  const password = adminPasswordInput.value.trim();
  if (password === ADMIN_PASSWORD) {
    setAdminMode(true);
  } else {
    alert('Contraseña incorrecta');
  }
});

adminLogoutBtn.addEventListener('click', () => {
  setAdminMode(false);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = document.getElementById('title').value.trim();
  const videoUrl = document.getElementById('video-url').value.trim();
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const file = fileInput.files[0];

  if (!title || (!videoUrl && !file) || !date || !time) {
    return;
  }

  const datetime = new Date(`${date}T${time}`);
  const id = Date.now().toString();
  const item = {
    id,
    title,
    type: file ? 'file' : 'url',
    url: file ? '' : videoUrl,
    fileName: file ? file.name : '',
    datetime: datetime.toISOString(),
    createdAt: new Date().toISOString(),
  };

  if (file) {
    fileSources.set(id, URL.createObjectURL(file));
  }

  scheduleItems.push(item);

  scheduleItems.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  saveSchedule();
  renderSchedule();
  updateActiveTransmission();
  form.reset();
});

function loadSchedule() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.error('Error cargando programación:', error);
    return [];
  }
}

function saveSchedule() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduleItems));
}

function initializeAdmin() {
  isAdmin = localStorage.getItem(ADMIN_KEY) === '1';
  updateAdminUI();
}

function setAdminMode(enabled) {
  isAdmin = enabled;
  localStorage.setItem(ADMIN_KEY, enabled ? '1' : '0');
  updateAdminUI();
}

function updateAdminUI() {
  adminPanel.classList.toggle('hidden', !isAdmin);
  adminLoginPanel.classList.toggle('hidden', isAdmin);
  adminLogoutBtn.classList.toggle('hidden', !isAdmin);
  adminWelcomeText.textContent = isAdmin
    ? 'Añade tu programación y controla lo que se transmite en vivo.'
    : '';
  adminPasswordInput.value = '';
}

function renderSchedule() {
  list.innerHTML = '';
  if (scheduleItems.length === 0) {
    list.innerHTML = '<p>No hay programas. Usa el formulario para añadir uno.</p>';
    return;
  }

  const now = new Date();

  scheduleItems.forEach((item) => {
    const itemElement = document.createElement('article');
    itemElement.className = 'schedule-item';

    const date = new Date(item.datetime);
    const end = new Date(date.getTime() + 1000 * 60 * 60);
    const isActive = now >= date && now < end;

    if (isActive) {
      itemElement.classList.add('current');
    }

    const formatted = date.toLocaleString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    itemElement.innerHTML = `
      <strong>${item.title}</strong>
      ${isActive ? '<span class="current-label">EN VIVO</span>' : ''}
      <small>Hora: ${formatted}</small>
      ${item.type === 'file' ? `<small>Archivo: ${item.fileName}</small>` : ''}
      ${item.type === 'file' && !fileSources.has(item.id) ? '<small>(adjunto disponible solo en esta sesión)</small>' : ''}
      <div class="schedule-actions">
        <button type="button" class="delete-button" data-id="${item.id}">Eliminar</button>
      </div>
    `;

    const deleteButton = itemElement.querySelector('.delete-button');
    deleteButton.addEventListener('click', () => {
      if (item.type === 'file' && fileSources.has(item.id)) {
        URL.revokeObjectURL(fileSources.get(item.id));
        fileSources.delete(item.id);
      }
      scheduleItems = scheduleItems.filter((entry) => entry.id !== item.id);
      saveSchedule();
      renderSchedule();
      updateActiveTransmission();
    });

    list.appendChild(itemElement);
  });
}

function updateCurrentTime() {
  const now = new Date();
  const formatted = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  currentTimeDisplay.textContent = formatted;
}

function updateActiveTransmission() {
  const now = new Date();
  const hadChanges = cleanupPastItems(now);
  if (hadChanges) {
    renderSchedule();
  }

  const activeItems = scheduleItems
    .map((item) => ({ item, start: new Date(item.datetime) }))
    .filter(({ start }) => start <= now)
    .sort((a, b) => b.start - a.start);

  const activeItem = activeItems.length > 0 ? activeItems[0].item : null;

  if (!activeItem) {
    if (currentActiveId !== null) {
      currentActiveId = null;
      channelStatus.innerHTML = '<p>No hay video en vivo. El contenido se reproducirá aquí cuando sea su hora.</p>';
      playerArea.innerHTML = '<p>No hay video en vivo. El contenido se reproducirá aquí cuando sea su hora.</p>';
      liveBadge.classList.add('hidden');
    }
    return;
  }

  const start = new Date(activeItem.datetime);
  const offsetSeconds = Math.max(0, Math.floor((now - start) / 1000));

  if (activeItem.id === currentActiveId) {
    return;
  }

  currentActiveId = activeItem.id;
  const formatted = start.toLocaleString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  channelStatus.innerHTML = `
    <p>En vivo ahora: <strong>${activeItem.title}</strong></p>
    ${activeItem.type === 'file' ? `<p>Inicio: ${formatted}</p>` : ''}
  `;

  const embed = createPlayerForItem(activeItem, offsetSeconds);
  liveBadge.classList.remove('hidden');

  playerArea.innerHTML = '';
  playerArea.appendChild(liveBadge);
  playerArea.appendChild(embed);
}

function createPlayerForItem(item, offsetSeconds = 0) {
  if (item.type === 'file') {
    const fileUrl = fileSources.get(item.id);
    if (!fileUrl) {
      const message = document.createElement('p');
      message.textContent = 'Este archivo adjunto solo está disponible en esta sesión del navegador. Recarga la página y vuelve a agregarlo si lo necesitas.';
      return message;
    }

    const video = document.createElement('video');
    video.title = '';
    video.setAttribute('aria-label', 'Video en vivo');
    video.controls = false;
    video.style.pointerEvents = 'none';
    video.src = fileUrl;
    video.autoplay = true;
    video.muted = false;
    video.volume = 1;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadedmetadata', () => {
      if (offsetSeconds > 0 && offsetSeconds < video.duration) {
        video.currentTime = offsetSeconds;
      }
    });
    return video;
  }

  return createPlayerForUrl(item.url, offsetSeconds);
}

function cleanupPastItems(now) {
  const oneHourMillis = 1000 * 60 * 60;
  const validItems = scheduleItems.filter((item) => {
    const start = new Date(item.datetime).getTime();
    return now.getTime() <= start + oneHourMillis;
  });

  const removedAny = validItems.length !== scheduleItems.length;
  if (removedAny) {
    scheduleItems = validItems;
    saveSchedule();
    if (currentActiveId !== null) {
      const stillActive = scheduleItems.some((item) => item.id === currentActiveId);
      if (!stillActive) {
        currentActiveId = null;
      }
    }
  }

  return removedAny;
}

function createPlayerForUrl(url, offsetSeconds = 0) {
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeId(url);
    const iframe = document.createElement('iframe');
    iframe.title = '';
    iframe.setAttribute('aria-label', 'Video en vivo');
    iframe.style.pointerEvents = 'none';
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=0&start=${offsetSeconds}`;
    iframe.allow = 'autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    return iframe;
  }

  if (isVimeoUrl(url)) {
    const videoId = extractVimeoId(url);
    const iframe = document.createElement('iframe');
    iframe.title = '';
    iframe.setAttribute('aria-label', 'Video en vivo');
    iframe.style.pointerEvents = 'none';
    iframe.src = `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0&controls=0#t=${offsetSeconds}s`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    return iframe;
  }

  if (isDirectVideoUrl(url)) {
    const video = document.createElement('video');
    video.title = '';
    video.setAttribute('aria-label', 'Video en vivo');
    video.controls = false;
    video.style.pointerEvents = 'none';
    video.src = url;
    video.autoplay = true;
    video.muted = false;
    video.volume = 1;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadedmetadata', () => {
      if (offsetSeconds > 0 && offsetSeconds < video.duration) {
        video.currentTime = offsetSeconds;
      }
    });
    return video;
  }

  const iframe = document.createElement('iframe');
  iframe.title = '';
  iframe.setAttribute('aria-label', 'Video en vivo');
  iframe.style.pointerEvents = 'none';
  iframe.src = url;
  iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  iframe.allowFullscreen = true;
  return iframe;
}

function shareVideoLink(item) {
  if (!item.url) {
    alert('No hay enlace de video disponible para compartir.');
    return;
  }

  const shareData = {
    title: item.title,
    text: `Mira este video: ${item.title}`,
    url: item.url,
  };

  if (navigator.share) {
    navigator.share(shareData).catch((error) => {
      console.warn('Error al compartir:', error);
      fallbackCopyLink(item.url);
    });
  } else {
    fallbackCopyLink(item.url);
  }
}

function fallbackCopyLink(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(
      () => {
        alert('Enlace copiado al portapapeles. Puedes pegarlo para compartirlo.');
      },
      () => {
        prompt('Copia este enlace para compartir:', url);
      }
    );
  } else {
    prompt('Copia este enlace para compartir:', url);
  }
}

function isYouTubeUrl(url) {
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))/i.test(url);
}

function isVimeoUrl(url) {
  return /(?:vimeo\.com\/)([0-9]+)/i.test(url);
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov|m3u8)(?:\?|$)/i.test(url);
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/i);
  return match ? match[1] : '';
}

function extractVimeoId(url) {
  const match = url.match(/(?:vimeo\.com\/)([0-9]+)/i);
  return match ? match[1] : '';
}
