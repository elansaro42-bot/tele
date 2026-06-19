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
const dateInput = document.getElementById('date');
const addDateBtn = document.getElementById('add-date-btn');
const selectedDatesHiddenInput = document.getElementById('selected-dates');
const selectedDatesList = document.getElementById('selected-dates-list');
const STORAGE_KEY = 'videoScheduleItems';

const titleInput = document.getElementById('title');
const videoUrlInput = document.getElementById('video-url');
const titleAutofillHint = document.getElementById('title-autofill-hint');

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

initializeMultiDatePicker();

setupTitleAutofill();

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
    alert('Uy, contraseña incorrecta 😅. Vuelve a intentar.');
  }
});


adminLogoutBtn.addEventListener('click', () => {
  setAdminMode(false);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();


  const title = document.getElementById('title').value.trim();
  const videoUrl = document.getElementById('video-url').value.trim();
  const dateInput = document.getElementById('date');
  const selectedDatesStr = document.getElementById('selected-dates').value;
  const selectedDates = selectedDatesStr
    ? selectedDatesStr.split(',').map((d) => d.trim()).filter(Boolean)
    : [];
  const timeStart = document.getElementById('time-start').value;
  const timeEnd = document.getElementById('time-end').value;

  const file = fileInput.files[0];

  if (!title || (!videoUrl && !file) || selectedDates.length === 0 || !timeStart || !timeEnd) {
    alert('Falta algo en el formulario: título, enlace/archivo, fechas y horas.');
    return;
  }


  const startTime = timeStart;
  const endTime = timeEnd;

  // Validación simple: hora fin debe ser mayor o igual a hora inicio.
  // (Asumimos mismo día por evento: si quieres cruzar medianoche, habría que ampliar el modelo.)
  const startMinutes = parseInt(startTime.split(':')[0], 10) * 60 + parseInt(startTime.split(':')[1], 10);
  const endMinutes = parseInt(endTime.split(':')[0], 10) * 60 + parseInt(endTime.split(':')[1], 10);
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || endMinutes < startMinutes) {
    alert('La hora fin debe ser mayor o igual que la hora inicio.');
    return;
  }


  // Crea un ítem por cada fecha seleccionada.
  const newItems = selectedDates.map((date) => {
    const startDatetime = new Date(`${date}T${startTime}`);
    const id = `${Date.now().toString()}-${date}-${startTime}`;
    return {
      id,
      title,
      type: file ? 'file' : 'url',
      url: file ? '' : videoUrl,
      fileName: file ? file.name : '',
      datetime: startDatetime.toISOString(),
      endDatetime: new Date(`${date}T${endTime}`).toISOString(),
      createdAt: new Date().toISOString(),
    };
  });


  // (El objURL se genera por ítem dentro del bloque newItemsforEach)


  // Inserta los nuevos ítems (uno por fecha)
  newItems.forEach((it) => {
    scheduleItems.push(it);

    if (file) {
      // Una URL por ítem para que el revoke al borrar funcione correctamente.
      fileSources.set(it.id, URL.createObjectURL(file));
    }
  });

  // Limpia selección de fechas para reflejar correctamente el estado tras guardar.
  if (selectedDatesHiddenInput) selectedDatesHiddenInput.value = '';
  if (selectedDatesList) selectedDatesList.innerHTML = '';
  if (dateInput) dateInput.value = '';

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
    const end = item.endDatetime ? new Date(item.endDatetime) : new Date(date.getTime() + 1000 * 60 * 60);
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
      <small>Inicio: ${formatted}</small>
      ${item.endDatetime ? `<small>Fin: ${new Date(item.endDatetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small>` : ''}
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
    .map((item) => ({
      item,
      start: new Date(item.datetime),
      end: item.endDatetime ? new Date(item.endDatetime) : new Date(new Date(item.datetime).getTime() + 1000 * 60 * 60),
    }))
    .filter(({ start, end }) => start <= now && now < end)
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

    // Reinicio explícito para evitar estados raros al recargar.
    video.autoplay = true;
    video.muted = false;
    video.volume = 1;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = fileUrl;

    // Forzamos a que se intente reproducir cuando haya metadata.
    video.addEventListener('loadedmetadata', () => {
      if (offsetSeconds > 0 && offsetSeconds < video.duration) {
        video.currentTime = offsetSeconds;
      }

      // Reintenta play (algunos navegadores lo bloquean si llega tarde).
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // No hacemos nada; la reproducción puede requerir interacción.
        });
      }
    });

    return video;
  }

  return createPlayerForUrl(item.url, offsetSeconds);
}

function cleanupPastItems(now) {
  const validItems = scheduleItems.filter((item) => {
    const end = item.endDatetime ? new Date(item.endDatetime).getTime() : new Date(new Date(item.datetime).getTime() + 1000 * 60 * 60).getTime();
    return now.getTime() < end;
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
    if (!videoId) {
      const message = document.createElement('p');
      message.textContent = 'No se pudo detectar el ID de YouTube desde el enlace. Asegúrate de pegar una URL válida.';
      return message;
    }

    const start = offsetSeconds;

    const iframe = document.createElement('iframe');
    iframe.title = '';
    iframe.setAttribute('aria-label', 'Video en vivo');
    iframe.style.pointerEvents = 'none';
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=0&start=${start}`;
    iframe.allow = 'autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    return iframe;

  }


  // Vimeo
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

      // Asegura continuidad tras recargar/re-render: intentar iniciar reproducción.
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Si el navegador bloquea autoplay, el usuario podrá iniciar manualmente.
          // Pero mantenemos volumen/estado como pediste.
        });
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
    alert('Parce, no hay enlace de video para compartir por aquí.');
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
  if (!url) return '';

  // 1) youtu.be/<id>
  let match = url.match(/(?:youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (match) return match[1];

  // 2) youtube.com/watch?v=<id>&...
  match = url.match(/[?&]v=([A-Za-z0-9_-]{11})/i);
  if (match) return match[1];

  // 3) youtube.com/embed/<id>
  match = url.match(/(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/i);
  if (match) return match[1];

  // 4) youtube.com/shorts/<id>
  match = url.match(/(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i);
  if (match) return match[1];

  // 5) youtube.com/v/<id>
  match = url.match(/(?:youtube\.com\/v\/)([A-Za-z0-9_-]{11})/i);
  if (match) return match[1];

  return '';
}


function extractVimeoId(url) {
  const match = url.match(/(?:vimeo\.com\/)([0-9]+)/i);
  return match ? match[1] : '';
}

function setupTitleAutofill() {
  if (!titleInput || !videoUrlInput) return;
  if (!titleAutofillHint) return;

  let lastHandledUrl = '';
  let manualTitle = titleInput.value.trim().length > 0;

  const markManual = () => {
    manualTitle = true;
  };

  titleInput.addEventListener('input', markManual);

  const setLoading = (loading) => {
    if (!titleAutofillHint) return;
    titleAutofillHint.textContent = loading
      ? 'Buscando el título del video...'
      : 'Si pegas un enlace, intentaremos poner el título automáticamente.';
  };

  const trySetTitleFromUrl = async () => {
    const url = (videoUrlInput.value || '').trim();
    if (!url || url === lastHandledUrl) return;
    lastHandledUrl = url;

    if (manualTitle) return;

    setLoading(true);
    titleInput.value = '';

    try {
      // YouTube oEmbed (sin API key)
      const ytMatch = extractYouTubeId(url);
      if (ytMatch) {
        const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytMatch}`)}&format=json`;
        const res = await fetch(api);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) {
            titleInput.value = String(data.title);
            manualTitle = true;
            setLoading(false);
            return;
          }
        }
      }

      // Vimeo oEmbed
      const vimeoMatch = extractVimeoId(url);
      if (vimeoMatch) {
        const api = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${vimeoMatch}`)}`;
        const res = await fetch(api);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) {
            titleInput.value = String(data.title);
            manualTitle = true;
            setLoading(false);
            return;
          }
        }
      }

      // Si no se pudo, mantenemos el título vacío para que el admin lo complete manual.
    } catch (e) {
      // Silent: no queremos bloquear el flujo.
    } finally {
      setLoading(false);
    }
  };

  let t = null;
  videoUrlInput.addEventListener('input', () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      trySetTitleFromUrl();
    }, 600);
  });

  // Si el admin pega el enlace y el título ya está vacío, intentamos una vez al salir del campo.
  videoUrlInput.addEventListener('blur', () => {
    trySetTitleFromUrl();
  });
}

function initializeMultiDatePicker() {
  if (!dateInput || !addDateBtn || !selectedDatesHiddenInput || !selectedDatesList) {
    return;
  }

  /** @type {string[]} */
  let selectedDates = [];

  const loadFromHidden = () => {
    const raw = selectedDatesHiddenInput.value;
    if (!raw) {
      selectedDates = [];
      return;
    }
    selectedDates = raw.split(',').map((d) => d.trim()).filter(Boolean);
  };

  const saveToHidden = () => {
    selectedDatesHiddenInput.value = selectedDates.join(',');
  };

  const formatDateForList = (isoDate) => {
    const d = new Date(`${isoDate}T00:00:00`);
    // dd/mm/yyyy (es-ES)
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const render = () => {
    selectedDatesList.innerHTML = '';
    if (selectedDates.length === 0) {
      selectedDatesList.innerHTML = '<span class="hint">No hay fechas seleccionadas.</span>';
      return;
    }

    selectedDates.forEach((isoDate) => {
      const chip = document.createElement('div');
      chip.className = 'selected-date-chip';
      chip.innerHTML = `
        <span class="selected-date-text">${formatDateForList(isoDate)}</span>
        <button type="button" class="selected-date-remove" data-date="${isoDate}" aria-label="Eliminar fecha">✕</button>
      `;

      const removeBtn = chip.querySelector('.selected-date-remove');
      removeBtn.addEventListener('click', () => {
        selectedDates = selectedDates.filter((d) => d !== isoDate);
        saveToHidden();
        render();
      });

      selectedDatesList.appendChild(chip);
    });
  };

  loadFromHidden();
  render();

  addDateBtn.addEventListener('click', () => {
    const value = dateInput.value;
    if (!value) return;
    if (!selectedDates.includes(value)) {
      selectedDates.push(value);
      selectedDates.sort();
      saveToHidden();
      render();
    }
    dateInput.value = '';
    dateInput.focus();
  });

  dateInput.addEventListener('change', () => {
    // Permite añadir automáticamente al cambiar (mejor UX).
    // Si no se desea, se puede comentar estas líneas.
    if (dateInput.value) {
      addDateBtn.click();
    }
  });
}

