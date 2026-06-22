import { createPicker } from "https://unpkg.com/picmo@5.1.0/dist/index.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, off, query, limitToLast, set, onDisconnect, onValue, remove} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCunS8tcfLmaBRT1Up_i0L6T_0gp2Bwiuo",
  authDomain: "benjachat-9dcdc.firebaseapp.com",
  databaseURL: "https://benjachat-9dcdc-default-rtdb.firebaseio.com",
  projectId: "benjachat-9dcdc",
  storageBucket: "benjachat-9dcdc.firebasestorage.app",
  messagingSenderId: "300389095060",
  appId: "1:300389095060:web:07a7494b74beb4f91b8681"
};

// Inicializar Firebase y la Base de Datos
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Nodos del DOM (Mantienen los mismos IDs de tu HTML original)
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username-input');
const currentUserLabel = document.getElementById('current-user');
const roomsList = document.getElementById('rooms-list');
const currentRoomTitle = document.getElementById('current-room-title');
const messagesWindow = document.getElementById('messages-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const emojiBtn = document.getElementById('emoji-btn');
const emojiContainer = document.getElementById('emoji-picker-container');
const fileInput = document.getElementById('file-input');
const searchInput = document.getElementById('search-input');
const notificationSound = document.getElementById('notification-sound');

let nickname = '';
let activeRoom = 'general';
let currentRoomRef = null; // Guardará la referencia activa de Firebase
let miRefEscritura = null; // Guardará la referencia de escritura del usuario actual

// Evento de Login de usuario
authForm.addEventListener('submit', function (e) {
  e.preventDefault();
  nickname = usernameInput.value.trim();
  if (nickname.length >= 3) {
    currentUserLabel.textContent = nickname;
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');

    // Activar los nuevos sistemas en tiempo real
    iniciarSistemaPresenciaYEscritura();
    
    // Conectar a la sala inicial en Firebase
    cambiarDeSala(activeRoom);
  }
});

// Cambiar de Sala conectando las referencias dinámicas de Firebase
function cambiarDeSala(nuevaSala) {
  // Si ya estábamos escuchando una sala antes, apagamos el escuchador para no duplicar mensajes
  if (currentRoomRef) {
    off(currentRoomRef);
  }

  // Si estábamos marcados como escribiendo en la sala anterior, limpiamos ese estado
  if (miRefEscritura) {
    remove(miRefEscritura);
  }

  activeRoom = nuevaSala;
  currentRoomTitle.textContent = `# ${nuevaSala.charAt(0).toUpperCase() + nuevaSala.slice(1)}`;
  
  // Limpiamos la ventana de chat para la nueva sala
  messagesWindow.innerHTML = '';
  
  // Apuntar al nodo específico de esta sala en Firebase: 'messages/nombre_sala'
  currentRoomRef = ref(db, `messages/${activeRoom}`);

  // Actualizar la referencia de escritura para rastrear la sala correcta si el usuario ya inició sesión
  if (nickname) {
    miRefEscritura = ref(db, `typing/${activeRoom}/${nickname}`);
  }

  // Traer los últimos 50 mensajes de Firebase y escuchar nuevos en tiempo real
  const lasMessagesQuery = query(currentRoomRef, limitToLast(50));

  onChildAdded(lasMessagesQuery, (snapshot) => {
    const msg = snapshot.val();
    renderizarUnMensaje(msg);
  }); // 👈 Corregido: Ahora se cierra correctamente el onChildAdded

  // Monitorear quién escribe en la nueva sala
  escucharEscrituraEnSala(nuevaSala);

  // Agregar mensaje del sistema localmente indicando el cambio
  agregarMensajeSistema(`Te has unido a la sala: # ${nuevaSala}`);
}

// Cambiar de sala al hacer click en el Sidebar
roomsList.addEventListener('click', function (e) {
  const item = e.target.closest('.room-item');
  if (!item || item.classList.contains('active')) return;

  document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');
  
  cambiarDeSala(item.dataset.room);
});

// Renderizar un único mensaje individual en el DOM
function renderizarUnMensaje(msg) {
  // Si hay un filtro de búsqueda activo y el texto no coincide, lo ocultamos
  const filtro = searchInput.value.trim().toLowerCase();
  if (filtro && !msg.text.toLowerCase().includes(filtro)) return;

  const msgNode = document.createElement('div');
  msgNode.className = 'message-node';
  
  if (msg.user === 'Sistema') {
    msgNode.className = 'message-node system-notification';
    msgNode.innerHTML = `<div class="msg-body">${msg.text}</div>`;
  } else {
    msgNode.innerHTML = `
      <div class="msg-meta">
        <span class="msg-user">${msg.user}</span>
        <span class="msg-time">${msg.time}</span>
      </div>
      <div class="msg-body">
        <div>${msg.text}</div>
        ${msg.file ? renderingAdjunto(msg.file) : ''}
      </div>
    `;
  }
  
  messagesWindow.appendChild(msgNode);
  messagesWindow.scrollTop = messagesWindow.scrollHeight;

  // Sonido si el mensaje es de otra persona
  if (msg.user !== nickname && msg.user !== 'Sistema') {
    ejecutarNotificacion();
  }
}

function renderingAdjunto(fileData) {
  if (fileData.type.startsWith('image/')) {
    return `<img src="${fileData.url}" class="chat-attachment" alt="Imagen adjunta">`;
  }
  return `<a href="${fileData.url}" target="_blank" class="file-link">📎 Descargar archivo (${fileData.name})</a>`;
}

function agregarMensajeSistema(texto) {
  const ahora = new Date();
  const horaString = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  renderizarUnMensaje({
    user: 'Sistema',
    text: texto,
    time: horaString
  });
}

// ========================================================
// ESCUCHADOR ÚNICO DE ENVÍO DE MENSAJES (100% UNIFICADO)
// ========================================================
messageForm.addEventListener('submit', function (e) {
  e.preventDefault(); // 👈 ¡Frenado total! Esto evita la recarga que te mandaba al login
  
  const texto = messageInput.value.trim();
  const archivo = fileInput.files[0];

  if (!texto && !archivo) return;

  const ahora = new Date();
  const horaString = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const nuevoMensaje = {
    user: nickname,
    text: texto,
    time: horaString,
    timestamp: Date.now()
  };

  if (archivo) {
    const fakeUrl = URL.createObjectURL(archivo);
    nuevoMensaje.file = {
      name: archivo.name,
      type: archivo.type,
      url: fakeUrl
    };
  }

  // Guardar directo en Firebase 
  push(currentRoomRef, nuevoMensaje);

  // Limpiar los inputs de la interfaz de forma limpia
  messageInput.value = '';
  fileInput.value = '';
  emojiContainer.classList.add('hidden');

  // Limpiar los estados de escritura inmediatamente al enviar el mensaje
  if (typingTimeout) clearTimeout(typingTimeout);
  if (miRefEscritura) remove(miRefEscritura);
});

// Buscador reactivo
searchInput.addEventListener('input', function () {
  cambiarDeSala(activeRoom);
});

// Sistema de Notificaciones
function ejecutarNotificacion() {
  notificationSound.play().catch(() => {});
  if (Notification.permission === 'granted') {
    new Notification('Nuevo mensaje en el Chat', {
      body: `Tienes un nuevo mensaje en la sala #${activeRoom}`
    });
  }
}

if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
  Notification.requestPermission();
}

// Lógica de Emojis 
const picker = createPicker({
  rootElement: emojiContainer
});

picker.addEventListener('emoji', event => {
  messageInput.value += event.emoji;
  messageInput.focus(); 
});

emojiBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  emojiContainer.classList.toggle('hidden');
});

document.addEventListener('click', function (e) {
  if (!emojiContainer.contains(e.target) && e.target !== emojiBtn) {
    emojiContainer.classList.add('hidden');
  }
});

// ========================================================
//  LOGICA EXTRA: USUARIOS EN LÍNEA Y "ESCRIBIENDO..."
// ========================================================
const usersListContainer = document.getElementById('users-list');
const typingIndicator = document.getElementById('typing-indicator');
let typingTimeout = null;

function iniciarSistemaPresenciaYEscritura() {
  // 1. REGISTRAR QUE ESTAMOS EN LÍNEA
  const miRefPresencia = ref(db, `presence/${nickname}`);
  set(miRefPresencia, { status: "online" });
  
  // Si el usuario cierra la pestaña, se borra automáticamente de la lista
  onDisconnect(miRefPresencia).remove();

  // 2. ESCUCHAR A TODOS LOS USUARIOS CONECTADOS
  const listaPresenciaRef = ref(db, 'presence');
  onValue(listaPresenciaRef, (snapshot) => {
    usersListContainer.innerHTML = ''; 
    
    snapshot.forEach((childSnapshot) => {
      const nombreUsuarioConectado = childSnapshot.key;
      
      const li = document.createElement('li');
      li.className = 'user-item';
      li.textContent = nombreUsuarioConectado;
      
      usersListContainer.appendChild(li);
    });
  });

  // Inicializar la referencia exacta de escritura para la sala activa
  miRefEscritura = ref(db, `typing/${activeRoom}/${nickname}`);

  // 3. ACTUALIZAR NUESTRO ESTADO EN FIREBASE AL TECLEAR
  messageInput.addEventListener('input', () => {
    if (!miRefEscritura) return;

    set(miRefEscritura, true);
    clearTimeout(typingTimeout);

    // Si pasan 2 segundos sin teclear, se borra el indicador
    typingTimeout = setTimeout(() => {
      if (miRefEscritura) remove(miRefEscritura);
    }, 2000);
  });
}

// 4. ESCUCHAR QUIÉN ESTÁ ESCRIBIENDO EN LA SALA ACTUAL
let salaEscrituraRef = null;

function escucharEscrituraEnSala(sala) {
  if (salaEscrituraRef) {
    off(salaEscrituraRef);
  }

  salaEscrituraRef = ref(db, `typing/${sala}`);
  
  onValue(salaEscrituraRef, (snapshot) => {
    const escritores = [];
    
    snapshot.forEach((childSnapshot) => {
      const usuarioEscribiendo = childSnapshot.key;
      if (usuarioEscribiendo !== nickname) {
        escritores.push(usuarioEscribiendo);
      }
    });

    if (escritores.length === 1) {
      typingIndicator.textContent = `${escritores[0]} está escribiendo...`;
    } else if (escritores.length > 1) {
      typingIndicator.textContent = `Varios usuarios están escribiendo...`;
    } else {
      typingIndicator.textContent = ''; 
    }
  });
}