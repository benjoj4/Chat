import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  off,
  query,
  limitToLast,
  set,
  onDisconnect,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCunS8tcfLmaBRT1Up_i0L6T_0gp2Bwiuo",
  authDomain: "benjachat-9dcdc.firebaseapp.com",
  databaseURL: "https://benjachat-9dcdc-default-rtdb.firebaseio.com",
  projectId: "benjachat-9dcdc",
  storageBucket: "benjachat-9dcdc.firebasestorage.app",
  messagingSenderId: "300389095060",
  appId: "1:300389095060:web:07a7494b74beb4f91b8681"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

const authContainer = document.getElementById("auth-container");
const chatContainer = document.getElementById("chat-container");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const nicknameGroup = document.getElementById("nickname-group");
const usernameInput = document.getElementById("username-input");
const btnSubmitAuth = document.getElementById("btn-submit-auth");
const btnGoogle = document.getElementById("btn-google");
const toggleAuthMode = document.getElementById("toggle-auth-mode");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");

const currentUserLabel = document.getElementById("current-user");
const roomsList = document.getElementById("rooms-list");
const currentRoomTitle = document.getElementById("current-room-title");
const messagesWindow = document.getElementById("messages-window");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const emojiBtn = document.getElementById("emoji-btn");
const emojiContainer = document.getElementById("emoji-picker-container");
const fileInput = document.getElementById("file-input");
const searchInput = document.getElementById("search-input");
const notificationSound = document.getElementById("notification-sound");
const usersListContainer = document.getElementById("users-list");
const typingIndicator = document.getElementById("typing-indicator");
const sendBtn = document.getElementById("send-btn");
const uploadPreview = document.getElementById("upload-preview");
const uploadFileName = document.getElementById("upload-file-name");
const uploadImagePreview = document.getElementById("upload-image-preview");
const uploadFileMeta = document.getElementById("upload-file-meta");
const clearFileBtn = document.getElementById("clear-file-btn");
const uploadProgress = document.getElementById("upload-progress");
const uploadProgressFill = document.getElementById("upload-progress-fill");
const uploadProgressText = document.getElementById("upload-progress-text");

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "🤩",
  "😢", "😭", "😡", "👍", "👎", "👏", "🙏", "💪", "🔥", "🎉",
  "❤️", "💙", "💯", "💬", "✨", "🚀", "🎮", "🎵", "📎", "📷"
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const INLINE_FALLBACK_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_FALLBACK_MAX_DIMENSION = 1600;
const TYPING_STALE_MS = 7000;

let nickname = "";
let activeRoom = "general";
let currentUser = null;
let isLoginMode = true;
let typingTimeout = null;
let currentRoomRef = null;
let currentMessagesQuery = null;
let roomMessageHandler = null;
let salaEscrituraRef = null;
let salaEscrituraHandler = null;
let presenceRef = null;
let presenceListRef = null;
let presenceHandler = null;
let miRefEscritura = null;
let roomMessagesCache = [];
let previewObjectUrl = null;

toggleAuthMode.addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = "Ingresar al Chat";
    authSubtitle.textContent = "Introduce tus credenciales para unirte a las salas";
    btnSubmitAuth.textContent = "Entrar";
    nicknameGroup.classList.add("hidden");
    usernameInput.removeAttribute("required");
    toggleAuthMode.textContent = "Regístrate aquí";
    document.querySelector(".auth-toggle-text").childNodes[0].textContent = "¿No tienes cuenta? ";
    return;
  }

  authTitle.textContent = "Crear Cuenta";
  authSubtitle.textContent = "Regístrate gratis para empezar a chatear";
  btnSubmitAuth.textContent = "Registrar";
  nicknameGroup.classList.remove("hidden");
  usernameInput.setAttribute("required", "true");
  toggleAuthMode.textContent = "Inicia sesión aquí";
  document.querySelector(".auth-toggle-text").childNodes[0].textContent = "¿Ya tienes cuenta? ";
});

authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (isLoginMode) {
    signInWithEmailAndPassword(auth, email, password).catch((error) => {
      console.error(error);
      alert("Error al iniciar sesión: Verifica tu correo o contraseña.");
    });
    return;
  }

  const inputName = usernameInput.value.trim();
  if (inputName.length < 3) {
    alert("El nombre de usuario debe tener mínimo 3 caracteres.");
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => updateProfile(userCredential.user, { displayName: inputName }))
    .catch((error) => {
      console.error(error);
      alert("Error al registrarse: El correo ya existe o la clave es débil.");
    });
});

btnGoogle.addEventListener("click", () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).catch((error) => {
    console.error(error);
    alert("Hubo un problema al autenticar con Google.");
  });
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (!user) {
    limpiarEstadoChat();
    authContainer.classList.remove("hidden");
    chatContainer.classList.add("hidden");
    return;
  }

  nickname = user.displayName || user.email?.split("@")[0] || "Usuario";
  currentUserLabel.textContent = nickname;
  authContainer.classList.add("hidden");
  chatContainer.classList.remove("hidden");

  iniciarSistemaPresencia();
  cambiarDeSala(activeRoom);
});

function limpiarEstadoChat() {
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }

  if (miRefEscritura) remove(miRefEscritura).catch(() => {});

  if (presenceRef) remove(presenceRef).catch(() => {});

  if (currentMessagesQuery && roomMessageHandler) {
    off(currentMessagesQuery, "child_added", roomMessageHandler);
  }
  currentMessagesQuery = null;
  roomMessageHandler = null;

  if (salaEscrituraRef && salaEscrituraHandler) {
    off(salaEscrituraRef, "value", salaEscrituraHandler);
  }
  salaEscrituraRef = null;
  salaEscrituraHandler = null;

  if (presenceListRef && presenceHandler) {
    off(presenceListRef, "value", presenceHandler);
  }
  presenceListRef = null;
  presenceHandler = null;

  currentRoomRef = null;
  miRefEscritura = null;
  presenceRef = null;
  roomMessagesCache = [];
  usersListContainer.innerHTML = "";
  typingIndicator.textContent = "";
  messagesWindow.innerHTML = "";
  resetUploadPreview();
}

function cambiarDeSala(nuevaSala) {
  if (currentMessagesQuery && roomMessageHandler) {
    off(currentMessagesQuery, "child_added", roomMessageHandler);
  }

  if (salaEscrituraRef && salaEscrituraHandler) {
    off(salaEscrituraRef, "value", salaEscrituraHandler);
  }

  if (miRefEscritura) {
    remove(miRefEscritura).catch(() => {});
  }

  activeRoom = nuevaSala;
  roomMessagesCache = [];
  messagesWindow.innerHTML = "";
  typingIndicator.textContent = "";
  currentRoomTitle.textContent = `# ${nuevaSala.charAt(0).toUpperCase() + nuevaSala.slice(1)}`;
  currentRoomRef = ref(db, `messages/${activeRoom}`);

  actualizarRefEscrituraPropia();

  currentMessagesQuery = query(currentRoomRef, limitToLast(50));
  roomMessageHandler = (snapshot) => {
    const msg = snapshot.val();
    roomMessagesCache.push(msg);
    renderizarUnMensaje(msg);
  };
  onChildAdded(currentMessagesQuery, roomMessageHandler);

  escucharEscrituraEnSala(nuevaSala);
  agregarMensajeSistema(`Te has unido a la sala: # ${nuevaSala}`);
}

roomsList.addEventListener("click", (e) => {
  const item = e.target.closest(".room-item");
  if (!item || item.classList.contains("active")) return;

  document.querySelectorAll(".room-item").forEach((el) => el.classList.remove("active"));
  item.classList.add("active");
  cambiarDeSala(item.dataset.room);
});

function coincideConBusqueda(msg) {
  const filtro = searchInput.value.trim().toLowerCase();
  if (!filtro) return true;

  const texto = (msg.text || "").toLowerCase();
  const nombreArchivo = (msg.file?.name || "").toLowerCase();
  return texto.includes(filtro) || nombreArchivo.includes(filtro);
}

function renderizarUnMensaje(msg) {
  if (!coincideConBusqueda(msg)) return;

  const msgNode = document.createElement("div");
  msgNode.className = "message-node";

  if (msg.user === "Sistema") {
    msgNode.className = "message-node system-notification";
    const body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = msg.text || "";
    msgNode.appendChild(body);
  } else {
    const meta = document.createElement("div");
    meta.className = "msg-meta";

    const userNode = document.createElement("span");
    userNode.className = "msg-user";
    userNode.textContent = msg.user || "Usuario";

    const timeNode = document.createElement("span");
    timeNode.className = "msg-time";
    timeNode.textContent = msg.time || "";

    meta.appendChild(userNode);
    meta.appendChild(timeNode);

    const body = document.createElement("div");
    body.className = "msg-body";

    if (msg.text) {
      const textNode = document.createElement("div");
      textNode.textContent = msg.text;
      body.appendChild(textNode);
    }

    const attachmentNode = crearNodoAdjunto(msg.file);
    if (attachmentNode) {
      body.appendChild(attachmentNode);
    }

    msgNode.appendChild(meta);
    msgNode.appendChild(body);
  }

  messagesWindow.appendChild(msgNode);
  messagesWindow.scrollTop = messagesWindow.scrollHeight;

  if (msg.user !== nickname && msg.user !== "Sistema") {
    ejecutarNotificacion();
  }
}

function crearNodoAdjunto(fileData) {
  if (!fileData?.url) return null;

  if ((fileData.type || "").startsWith("image/")) {
    const image = document.createElement("img");
    image.src = fileData.url;
    image.className = "chat-attachment";
    image.alt = fileData.name ? `Imagen adjunta: ${fileData.name}` : "Imagen adjunta";
    image.loading = "lazy";
    return image;
  }

  const link = document.createElement("a");
  link.href = fileData.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "file-link";
  link.download = fileData.name || "adjunto";
  link.textContent = `📎 Descargar archivo (${fileData.name || "adjunto"})`;
  return link;
}

function renderizarMensajesDesdeCache() {
  messagesWindow.innerHTML = "";
  roomMessagesCache.forEach((msg) => renderizarUnMensaje(msg));
}

function agregarMensajeSistema(texto) {
  const ahora = new Date();
  const horaString = ahora.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  renderizarUnMensaje({
    user: "Sistema",
    text: texto,
    time: horaString
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo para fallback."));
    reader.readAsDataURL(file);
  });
}

function getDataUrlPayloadSize(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return dataUrl.length;
  const payload = dataUrl.slice(commaIndex + 1);
  return Math.floor((payload.length * 3) / 4);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo procesar la imagen para fallback."));
    };
    image.src = objectUrl;
  });
}

async function compressImageForInlineFallback(file, maxBytes) {
  const image = await loadImageFromFile(file);
  const ratio = Math.min(
    1,
    IMAGE_FALLBACK_MAX_DIMENSION / Math.max(image.width || 1, image.height || 1)
  );

  const width = Math.max(1, Math.round((image.width || 1) * ratio));
  const height = Math.max(1, Math.round((image.height || 1) * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo inicializar el compresor de imagen.");
  }
  ctx.drawImage(image, 0, 0, width, height);

  let bestResult = null;
  for (let quality = 0.9; quality >= 0.3; quality -= 0.1) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const payloadSize = getDataUrlPayloadSize(dataUrl);
    bestResult = {
      dataUrl,
      payloadSize,
      contentType: "image/jpeg"
    };

    if (payloadSize <= maxBytes) {
      return bestResult;
    }
  }

  return bestResult;
}

function getFriendlyUploadError(error) {
  const code = error?.code || "";
  if (code.includes("storage/unauthorized") || code.includes("storage/permission-denied")) {
    return "Storage rechazó la subida (permisos/reglas). Se intentará fallback automático.";
  }
  if (code.includes("storage/canceled")) {
    return "La subida fue cancelada.";
  }
  if (code.includes("storage/retry-limit-exceeded")) {
    return "La subida agotó reintentos. Verifica tu conexión.";
  }
  return error?.message || "No se pudo subir el archivo.";
}

async function buildInlineFallbackAttachment(file, uploadError) {
  const baseError = getFriendlyUploadError(uploadError);

  if ((file.type || "").startsWith("image/")) {
    const compressed = await compressImageForInlineFallback(file, INLINE_FALLBACK_MAX_BYTES);

    if (!compressed || compressed.payloadSize > INLINE_FALLBACK_MAX_BYTES) {
      throw new Error(
        `${baseError} La imagen es demasiado grande incluso comprimida. Intenta con una imagen más liviana.`
      );
    }

    return {
      name: file.name,
      type: compressed.contentType,
      size: compressed.payloadSize,
      url: compressed.dataUrl,
      inlineFallback: true
    };
  }

  if (file.size > INLINE_FALLBACK_MAX_BYTES) {
    throw new Error(
      `${baseError} El fallback solo soporta archivos no imagen de hasta ${formatFileSize(INLINE_FALLBACK_MAX_BYTES)}.`
    );
  }

  const dataUrl = await fileToDataUrl(file);
  const payloadSize = getDataUrlPayloadSize(dataUrl);
  if (payloadSize > INLINE_FALLBACK_MAX_BYTES) {
    throw new Error(
      `${baseError} El archivo supera el límite del fallback (${formatFileSize(INLINE_FALLBACK_MAX_BYTES)}).`
    );
  }

  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: payloadSize,
    url: dataUrl,
    inlineFallback: true
  };
}

function resetUploadPreview({ clearInput = true } = {}) {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  uploadPreview.classList.add("hidden");
  uploadImagePreview.classList.add("hidden");
  uploadImagePreview.removeAttribute("src");
  uploadFileName.textContent = "";
  uploadFileMeta.textContent = "";
  actualizarProgresoSubida(0, false);

  if (clearInput) {
    fileInput.value = "";
  }
}

function mostrarPreviewArchivo(file) {
  uploadPreview.classList.remove("hidden");
  uploadFileName.textContent = file.name;
  uploadFileMeta.textContent = `${formatFileSize(file.size)} · ${file.type || "Archivo"}`;

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  if ((file.type || "").startsWith("image/")) {
    previewObjectUrl = URL.createObjectURL(file);
    uploadImagePreview.src = previewObjectUrl;
    uploadImagePreview.classList.remove("hidden");
  } else {
    uploadImagePreview.classList.add("hidden");
    uploadImagePreview.removeAttribute("src");
  }

  actualizarProgresoSubida(0, false);
}

function actualizarProgresoSubida(percent, visible = true) {
  const clamped = Math.max(0, Math.min(100, percent));
  uploadProgressFill.style.width = `${clamped}%`;
  uploadProgressText.textContent = `${Math.round(clamped)}%`;
  uploadProgress.classList.toggle("hidden", !visible);
}

fileInput.addEventListener("change", () => {
  const archivo = fileInput.files[0];
  if (!archivo) {
    resetUploadPreview({ clearInput: false });
    return;
  }
  mostrarPreviewArchivo(archivo);
});

clearFileBtn.addEventListener("click", () => {
  if (clearFileBtn.disabled) return;
  resetUploadPreview();
});

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const texto = messageInput.value.trim();
  const archivo = fileInput.files[0];
  if (!currentUser || !currentRoomRef) return;
  if (!texto && !archivo) return;

  try {
    sendBtn.disabled = true;
    fileInput.disabled = true;
    clearFileBtn.disabled = true;
    sendBtn.textContent = archivo ? "Subiendo..." : "Enviando...";

    const ahora = new Date();
    const horaString = ahora.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const nuevoMensaje = {
      user: nickname,
      text: texto,
      time: horaString,
      timestamp: Date.now()
    };

    if (archivo) {
      if (archivo.size > MAX_FILE_SIZE_BYTES) {
        throw new Error("El archivo supera el límite de 10MB.");
      }

      try {
        const filePath = `chat_uploads/${activeRoom}/${currentUser.uid}/${Date.now()}-${archivo.name.replace(/[^\w.-]/g, "_")}`;
        const fileStorageRef = storageRef(storage, filePath);
        const uploadTask = uploadBytesResumable(fileStorageRef, archivo);

        const snapshot = await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (taskSnapshot) => {
              const progress = (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 100;
              actualizarProgresoSubida(progress, true);
            },
            reject,
            () => resolve(uploadTask.snapshot)
          );
        });
        actualizarProgresoSubida(100, true);

        const downloadUrl = await getDownloadURL(snapshot.ref);
        nuevoMensaje.file = {
          name: archivo.name,
          type: archivo.type || "application/octet-stream",
          size: archivo.size,
          url: downloadUrl
        };
      } catch (uploadError) {
        console.warn("Storage upload failed, using inline fallback when possible:", uploadError);
        actualizarProgresoSubida(100, true);
        nuevoMensaje.file = await buildInlineFallbackAttachment(archivo, uploadError);
      }
    }

    await push(currentRoomRef, nuevoMensaje);
    messageInput.value = "";
    emojiContainer.classList.add("hidden");
    resetUploadPreview();

    if (typingTimeout) clearTimeout(typingTimeout);
    if (miRefEscritura) remove(miRefEscritura).catch(() => {});
  } catch (error) {
    console.error(error);
    alert(error.message || "No fue posible enviar el mensaje/archivo.");
  } finally {
    sendBtn.disabled = false;
    fileInput.disabled = false;
    clearFileBtn.disabled = false;
    sendBtn.textContent = "Enviar";
  }
});

searchInput.addEventListener("input", () => {
  renderizarMensajesDesdeCache();
});

function ejecutarNotificacion() {
  notificationSound.play().catch(() => {});
  if (Notification.permission === "granted") {
    new Notification("Nuevo mensaje en el Chat", {
      body: `Tienes un nuevo mensaje en la sala #${activeRoom}`
    });
  }
}

if (Notification.permission !== "granted" && Notification.permission !== "denied") {
  Notification.requestPermission();
}

function inicializarEmojiPicker() {
  emojiContainer.innerHTML = "";
  emojiContainer.classList.add("emoji-grid");

  EMOJIS.forEach((emoji) => {
    const emojiOption = document.createElement("button");
    emojiOption.type = "button";
    emojiOption.className = "emoji-option";
    emojiOption.textContent = emoji;
    emojiOption.addEventListener("click", () => {
      messageInput.value += emoji;
      messageInput.focus();
    });
    emojiContainer.appendChild(emojiOption);
  });
}

emojiBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  emojiContainer.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!emojiContainer.contains(e.target) && !emojiBtn.contains(e.target)) {
    emojiContainer.classList.add("hidden");
  }
});

function iniciarSistemaPresencia() {
  if (!currentUser) return;

  if (presenceListRef && presenceHandler) {
    off(presenceListRef, "value", presenceHandler);
  }

  presenceRef = ref(db, `presence/${currentUser.uid}`);
  set(presenceRef, {
    name: nickname,
    status: "online"
  }).catch(() => {});
  onDisconnect(presenceRef).remove();

  presenceListRef = ref(db, "presence");
  presenceHandler = (snapshot) => {
    usersListContainer.innerHTML = "";
    let onlineCount = 0;

    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      if (userData?.status !== "online") return;

      onlineCount += 1;
      const li = document.createElement("li");
      li.className = "user-item";
      li.textContent = userData.name || "Usuario";
      usersListContainer.appendChild(li);
    });

    if (onlineCount === 0) {
      const li = document.createElement("li");
      li.className = "user-item";
      li.textContent = "Sin usuarios conectados";
      usersListContainer.appendChild(li);
    }
  };
  onValue(presenceListRef, presenceHandler);
}

function actualizarRefEscrituraPropia() {
  if (!currentUser) return;
  miRefEscritura = ref(db, `typing/${activeRoom}/${currentUser.uid}`);
  onDisconnect(miRefEscritura).remove();
}

messageInput.addEventListener("input", () => {
  if (!miRefEscritura || !currentUser) return;

  const sigueEscribiendo = messageInput.value.trim().length > 0 || fileInput.files.length > 0;
  if (!sigueEscribiendo) {
    clearTimeout(typingTimeout);
    if (miRefEscritura) remove(miRefEscritura).catch(() => {});
    return;
  }

  set(miRefEscritura, {
    name: nickname,
    at: Date.now()
  }).catch(() => {});

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (miRefEscritura) remove(miRefEscritura).catch(() => {});
  }, 2000);
});

function escucharEscrituraEnSala(sala) {
  salaEscrituraRef = ref(db, `typing/${sala}`);

  salaEscrituraHandler = (snapshot) => {
    const escritores = [];
    const ahora = Date.now();

    snapshot.forEach((childSnapshot) => {
      const uidEscribiendo = childSnapshot.key;
      const typingData = childSnapshot.val() || {};
      const lastTypingAt = Number(typingData.at) || 0;

      if (!lastTypingAt || ahora - lastTypingAt > TYPING_STALE_MS) {
        remove(ref(db, `typing/${sala}/${uidEscribiendo}`)).catch(() => {});
        return;
      }

      if (uidEscribiendo === currentUser?.uid) return;
      const escritorNombre = typingData.name || "Usuario";
      escritores.push(escritorNombre);
    });

    if (escritores.length === 1) {
      typingIndicator.textContent = `${escritores[0]} está escribiendo...`;
    } else if (escritores.length > 1) {
      typingIndicator.textContent = "Varios usuarios están escribiendo...";
    } else {
      typingIndicator.textContent = "";
    }
  };

  onValue(salaEscrituraRef, salaEscrituraHandler);
}

inicializarEmojiPicker();