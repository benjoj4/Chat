
//IMPORTAR EMOJIS
import { createPicker } from "https://unpkg.com/picmo@5.1.0/dist/index.js";
// Importar los SDKs de Firebase desde el CDN (Formato compatible con navegadores directos)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, off, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 2. Tu configuración real de Firebase
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

// Evento de Login de usuario
authForm.addEventListener('submit', function (e) {
  e.preventDefault();
  nickname = usernameInput.value.trim();
  if (nickname.length >= 3) {
    currentUserLabel.textContent = nickname;
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
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

  activeRoom = nuevaSala;
  currentRoomTitle.textContent = `# ${nuevaSala.charAt(0).toUpperCase() + nuevaSala.slice(1)}`;
  
  // Limpiamos la ventana de chat para la nueva sala
  messagesWindow.innerHTML = '';
  
  // Apuntar al nodo específico de esta sala en Firebase: 'messages/nombre_sala'
  currentRoomRef = ref(db, `messages/${activeRoom}`);

  // Traer los últimos 50 mensajes de Firebase y escuchar nuevos en tiempo real
  const lasMessagesQuery = query(currentRoomRef, limitToLast(50));

  onChildAdded(lasMessagesQuery, (snapshot) => {
    const msg = snapshot.val();
    renderizarUnMensaje(msg);
  });

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

// Enviar Mensaje a Firebase
messageForm.addEventListener('submit', function (e) {
  e.preventDefault();
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

  // Mantenemos tu lógica de "Blob URL temporal" local para los adjuntos por ahora
  if (archivo) {
    const fakeUrl = URL.createObjectURL(archivo);
    nuevoMensaje.file = {
      name: archivo.name,
      type: archivo.type,
      url: fakeUrl
    };
  }

  // Guardar directo en Firebase (Sustituye por completo al socket.emit antiguo)
  push(currentRoomRef, nuevoMensaje);

  messageInput.value = '';
  fileInput.value = '';
  emojiContainer.classList.add('hidden');
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

// Creamos el selector utilizando directamente la función importada arriba
const picker = createPicker({
  rootElement: emojiContainer
});

// Al hacer clic en un emoji, se añade al input de texto
picker.addEventListener('emoji', event => {
  messageInput.value += event.emoji;
  messageInput.focus(); // Mantiene el foco para que sigas escribiendo
});

// Mostrar / Ocultar el contenedor de emojis al presionar el botón de la carita
emojiBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  emojiContainer.classList.toggle('hidden');
});

// Cerrar el selector de emojis si el usuario hace clic fuera de él
document.addEventListener('click', function (e) {
  if (!emojiContainer.contains(e.target) && e.target !== emojiBtn) {
    emojiContainer.classList.add('hidden');
  }
});