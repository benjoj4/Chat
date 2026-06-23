// Importaciones de Firebase (Añadido getAuth y sus herramientas de Login)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, off, query, limitToLast, set, onDisconnect, onValue, remove} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCunS8tcfLmaBRT1Up_i0L6T_0gp2Bwiuo",
  authDomain: "benjachat-9dcdc.firebaseapp.com",
  databaseURL: "https://benjachat-9dcdc-default-rtdb.firebaseio.com",
  projectId: "benjachat-9dcdc",
  storageBucket: "benjachat-9dcdc.firebasestorage.app",
  messagingSenderId: "300389095060",
  appId: "1:300389095060:web:07a7494b74beb4f91b8681"
};

// Inicializar Firebase, Base de Datos y Autenticación
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Nodos del DOM (Se acoplan a tus nuevos inputs píldora)
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const nicknameGroup = document.getElementById('nickname-group');
const usernameInput = document.getElementById('username-input');
const btnSubmitAuth = document.getElementById('btn-submit-auth');
const btnGoogle = document.getElementById('btn-google');
const toggleAuthMode = document.getElementById('toggle-auth-mode');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');

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
let currentRoomRef = null; 
let miRefEscritura = null; 
let isLoginMode = true; // Rastrea si la tarjeta está en modo Login o Registro

// ========================================================
// INTERRUPTOR INTERACTIVO: LOGIN / REGISTRO
// ========================================================
toggleAuthMode.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = "Ingresar al Chat";
    authSubtitle.textContent = "Introduce tus credenciales para unirte a las salas";
    btnSubmitAuth.textContent = "Entrar";
    nicknameGroup.classList.add('hidden');
    usernameInput.removeAttribute('required');
    toggleAuthMode.textContent = "Regístrate aquí";
    document.querySelector('.auth-toggle-text').childNodes[0].textContent = "¿No tienes cuenta? ";
  } else {
    authTitle.textContent = "Crear Cuenta";
    authSubtitle.textContent = "Regístrate gratis para empezar a chatear";
    btnSubmitAuth.textContent = "Registrar";
    nicknameGroup.classList.remove('hidden');
    usernameInput.setAttribute('required', 'true');
    toggleAuthMode.textContent = "Inicia sesión aquí";
    document.querySelector('.auth-toggle-text').childNodes[0].textContent = "¿Ya tienes cuenta? ";
  }
});

// ========================================================
// CONTROLADOR DE AUTENTICACIÓN (CORREO / CONTRASEÑA)
// ========================================================
authForm.addEventListener('submit', function (e) {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (isLoginMode) {
    // Proceso de Inicio de Sesión clásico
    signInWithEmailAndPassword(auth, email, password)
      .catch(error => {
        console.error(error);
        alert("Error al iniciar sesión: Verifica tu correo o contraseña.");
      });
  } else {
    // Proceso de Registro de nueva cuenta
    const inputName = usernameInput.value.trim();
    if (inputName.length < 3) {
      alert("El nombre de usuario debe tener mínimo 3 caracteres.");
      return;
    }
    
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Guardamos el Alias (Nickname) dentro del perfil interno de Firebase
        return updateProfile(userCredential.user, { displayName: inputName });
      })
      .catch(error => {
        console.error(error);
        alert("Error al registrarse: El correo ya existe o la clave es débil.");
      });
  }
});

// ========================================================
// CONTROLADOR DE AUTENTICACIÓN CON GOOGLE
// ========================================================
btnGoogle.addEventListener('click', () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .catch(error => {
      console.error(error);
      alert("Hubo un problema al autenticar con Google.");
    });
});

// ========================================================
// ESCUCHADOR DE ESTADO DE AUTENTICACIÓN REAL
// ========================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Si el usuario entra mediante Google, extrae su nombre de Google. Si se registró por correo, extrae su alias.
    nickname = user.displayName || user.email.split('@')[0];
    
    currentUserLabel.textContent = nickname;
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');

    // Inicializamos el ecosistema del chat en tiempo real
    iniciarSistemaPresenciaYEscritura();
    cambiarDeSala(activeRoom);
  } else {
    // Por si el usuario cierra sesión, limpia la pantalla
    authContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
  }
});

// ========================================================
// LÓGICA DE SALAS Y MENSAJES (SISTEMA INTEGRADO)
// ========================================================
function cambiarDeSala(nuevaSala) {
  if (currentRoomRef) off(currentRoomRef);
  if (miRefEscritura) remove(miRefEscritura);

  activeRoom = nuevaSala;
  currentRoomTitle.textContent = `# ${nuevaSala.charAt(0).toUpperCase() + nuevaSala.slice(1)}`;
  messagesWindow.innerHTML = '';
  
  currentRoomRef = ref(db, `messages/${activeRoom}`);

  if (nickname) {
    miRefEscritura = ref(db, `typing/${activeRoom}/${nickname}`);
  }

  const lasMessagesQuery = query(currentRoomRef, limitToLast(50));

  onChildAdded(lasMessagesQuery, (snapshot) => {
    const msg = snapshot.val();
    renderizarUnMensaje(msg);
  });

  escucharEscrituraEnSala(nuevaSala);
  agregarMensajeSistema(`Te has unido a la sala: # ${nuevaSala}`);
}

roomsList.addEventListener('click', function (e) {
  const item = e.target.closest('.room-item');
  if (!item || item.classList.contains('active')) return;

  document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');
  
  cambiarDeSala(item.dataset.room);
});

function renderizarUnMensaje(msg) {
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

  if (archivo) {
    const fakeUrl = URL.createObjectURL(archivo);
    nuevoMensaje.file = {
      name: archivo.name,
      type: archivo.type,
      url: fakeUrl
    };
  }

  push(currentRoomRef, nuevoMensaje);

  messageInput.value = '';
  fileInput.value = '';
  emojiContainer.classList.add('hidden');

  if (typingTimeout) clearTimeout(typingTimeout);
  if (miRefEscritura) remove(miRefEscritura);
});

searchInput.addEventListener('input', function () {
  cambiarDeSala(activeRoom);
});

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
// ECOSISTEMA EN TIEMPO REAL: PRESENCIA Y "ESCRIBIENDO..."
// ========================================================
const usersListContainer = document.getElementById('users-list');
const typingIndicator = document.getElementById('typing-indicator');
let typingTimeout = null;

function iniciarSistemaPresenciaYEscritura() {
  const miRefPresencia = ref(db, `presence/${nickname}`);
  set(miRefPresencia, { status: "online" });
  
  onDisconnect(miRefPresencia).remove();

  const listaPresenciaRef = ref(db, 'presence');
  
  onValue(listaPresenciaRef, (snapshot) => {
    usersListContainer.innerHTML = ''; 
    
    // Log para verificar si llegan datos
    console.log("Usuarios en presencia:", snapshot.val()); 

    snapshot.forEach((childSnapshot) => {
      const nombreUsuarioConectado = childSnapshot.key;
      
      const li = document.createElement('li');
      li.className = 'user-item';
      li.style.display = "flex"; // Forzamos visibilidad
      li.style.color = "#b9bbbe"; // Aseguramos color visible
      li.textContent = nombreUsuarioConectado;
      
      usersListContainer.appendChild(li);
    });
  });

  miRefEscritura = ref(db, `typing/${activeRoom}/${nickname}`);

  messageInput.addEventListener('input', () => {
    if (!miRefEscritura) return;
    set(miRefEscritura, true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (miRefEscritura) remove(miRefEscritura);
    }, 2000);
  });
}

let salaEscrituraRef = null;

function escucharEscrituraEnSala(sala) {
  if (salaEscrituraRef) off(salaEscrituraRef);

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